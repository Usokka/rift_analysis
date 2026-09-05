"""Create the raw, staging and analytics namespaces.

Revision ID: 0001
Revises: none
"""

from alembic import op
from sqlalchemy.schema import CreateSchema, DropSchema

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Fail on existing unmanaged schemas rather than silently adopting them.
    for schema in ("raw", "staging", "analytics"):
        op.execute(CreateSchema(schema))


def downgrade() -> None:
    # No CASCADE: refuse to delete a schema that still contains data or objects.
    for schema in ("analytics", "staging", "raw"):
        op.execute(DropSchema(schema, cascade=False))
