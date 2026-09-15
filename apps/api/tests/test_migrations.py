import io
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import DBAPIError

from app.core.database import REQUIRED_REVISION

ROOT = Path(__file__).resolve().parents[3]
SCHEMAS = {"raw", "staging", "analytics"}


def migration_config():
    return Config(str(ROOT / "alembic.ini"))


def test_readiness_revision_matches_migration_head():
    assert ScriptDirectory.from_config(migration_config()).get_heads() == [REQUIRED_REVISION]


def test_offline_sql_contains_schemas_without_credentials():
    output = io.StringIO()
    config = migration_config()
    config.output_buffer = output
    config.attributes["database_url"] = "postgresql+psycopg://rift:private%25@localhost/test"
    command.upgrade(config, "head", sql=True)
    sql = output.getvalue()
    for schema in SCHEMAS:
        assert f"CREATE SCHEMA {schema}" in sql
    assert "private" not in sql
    assert "alembic_version" in sql


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="PostgreSQL integration opt-in")
def test_migration_lifecycle_on_postgres():
    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                # Refuse to run destructive lifecycle checks on an initialized database.
                assert SCHEMAS.isdisjoint(inspect(connection).get_schema_names())
                assert not inspect(connection).has_table("alembic_version", schema="public")
                config = migration_config()
                config.attributes["connection"] = connection
                command.upgrade(config, "head")
                command.upgrade(config, "head")  # Repeated startup is a no-op.
                assert SCHEMAS <= set(inspect(connection).get_schema_names())
                assert (
                    connection.execute(
                        text("SELECT version_num FROM public.alembic_version")
                    ).scalar_one()
                    == "0001"
                )
                # Unrelated public tables must never become DROP TABLE candidates.
                connection.execute(text("CREATE TABLE public.external_tool (id integer)"))
                command.check(config)  # ORM metadata and database do not drift.
                connection.execute(text("DROP TABLE public.external_tool"))

                connection.execute(text("CREATE TABLE raw.rollback_guard (id integer)"))
                connection.execute(text("INSERT INTO raw.rollback_guard VALUES (42)"))
                with pytest.raises(DBAPIError), connection.begin_nested():
                    command.downgrade(config, "base")
                assert (
                    connection.execute(text("SELECT id FROM raw.rollback_guard")).scalar_one() == 42
                )
                connection.execute(text("DROP TABLE raw.rollback_guard"))

                command.downgrade(config, "base")
                assert SCHEMAS.isdisjoint(inspect(connection).get_schema_names())
                command.upgrade(config, "head")
                assert SCHEMAS <= set(inspect(connection).get_schema_names())
            finally:
                transaction.rollback()
    finally:
        engine.dispose()
