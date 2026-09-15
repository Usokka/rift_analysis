import os
from contextlib import contextmanager

import pytest
from sqlalchemy import create_engine, inspect, text

from app.core import database


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="PostgreSQL integration opt-in")
@pytest.mark.parametrize(
    "state", ["empty", "missing_version", "wrong_revision", "missing_schema", "ready"]
)
def test_database_readiness_on_postgres(monkeypatch, state):
    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    try:
        with engine.connect() as connection, connection.begin():
            assert database.REQUIRED_SCHEMAS.isdisjoint(inspect(connection).get_schema_names())
            assert not inspect(connection).has_table("alembic_version", schema="public")

            class TransactionEngine:
                @contextmanager
                def connect(self):
                    yield connection

            monkeypatch.setattr(database, "get_engine", lambda: TransactionEngine())
            transaction = connection.begin_nested()
            try:
                if state != "empty":
                    for schema in sorted(database.REQUIRED_SCHEMAS):
                        if state != "missing_schema" or schema != "analytics":
                            connection.execute(text(f"CREATE SCHEMA {schema}"))
                    connection.execute(
                        text("CREATE TABLE public.alembic_version (version_num text)")
                    )
                    if state != "missing_version":
                        connection.execute(
                            text("INSERT INTO public.alembic_version VALUES (:revision)"),
                            {
                                "revision": "obsolete"
                                if state == "wrong_revision"
                                else database.REQUIRED_REVISION
                            },
                        )
                if state == "ready":
                    database.check_database()
                else:
                    with pytest.raises(database.SchemaNotReadyError):
                        database.check_database()
            finally:
                transaction.rollback()
    finally:
        engine.dispose()
