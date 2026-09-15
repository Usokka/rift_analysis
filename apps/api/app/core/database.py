from functools import lru_cache

from sqlalchemy import Engine, create_engine, text

from app.core.config import get_settings

REQUIRED_REVISION = "0001"
REQUIRED_SCHEMAS = {"raw", "staging", "analytics"}


class SchemaNotReadyError(Exception):
    """The database responds but is not compatible with this application."""


@lru_cache
def get_engine() -> Engine:
    return create_engine(
        get_settings().database_url,
        pool_pre_ping=True,
        pool_timeout=3,
        connect_args={"connect_timeout": 3, "options": "-c statement_timeout=3000"},
    )


def check_database() -> None:
    with get_engine().connect() as connection:
        schemas = set(connection.execute(text("SELECT nspname FROM pg_namespace")).scalars())
        if not REQUIRED_SCHEMAS <= schemas:
            raise SchemaNotReadyError
        revisions = set(
            connection.execute(text("SELECT version_num FROM public.alembic_version")).scalars()
        )
        if revisions != {REQUIRED_REVISION}:
            raise SchemaNotReadyError
