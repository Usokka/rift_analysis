from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import Settings
from app.core.models import Base

config = context.config
target_metadata = Base.metadata


def include_name(name, type_, parent_names):
    # Autogeneration must not manage unrelated PostgreSQL schemas.
    if type_ == "schema":
        return name in (None, "raw", "staging", "analytics")
    # PostgreSQL reflects public as the default schema (None).
    if type_ == "table" and name == "alembic_version":
        return parent_names.get("schema_name") not in (None, "public")
    return True


def configure(connection=None, url=None):
    context.configure(
        connection=connection,
        url=url,
        target_metadata=target_metadata,
        include_schemas=True,
        include_name=include_name,
        compare_type=True,
        version_table_schema="public",
        literal_binds=connection is None,
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    configure(url=config.attributes.get("database_url") or Settings().database_url)
elif (connection := config.attributes.get("connection")) is not None:
    # Allows callers/tests to own the transaction; never close their connection.
    configure(connection=connection)
else:
    engine = create_engine(
        config.attributes.get("database_url") or Settings().database_url,
        poolclass=pool.NullPool,
        connect_args={"connect_timeout": 3},
    )
    try:
        with engine.connect() as connection:
            configure(connection=connection)
    finally:
        engine.dispose()
