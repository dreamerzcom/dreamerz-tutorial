"""Add video upload fields to media_assets

Revision ID: afdd2b7225c8
Revises: add_draft_version_to_courses
Create Date: 2026-05-12 07:36:29.419697

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'afdd2b7225c8'
down_revision: Union[str, Sequence[str], None] = 'add_draft_version_to_courses'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Idempotent: only adds columns that don't already exist. Production's
    media_assets table already has these (they were applied via the
    add_media_columns.py one-off script before Alembic was wired up to
    the live DB), so a plain op.add_column would fail with
    'column already exists'.
    """
    from sqlalchemy import inspect

    inspector = inspect(op.get_bind())
    existing = {col["name"] for col in inspector.get_columns("media_assets")}

    new_columns = [
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("poster_url", sa.String(length=500), nullable=True),
        sa.Column("streaming_url", sa.String(length=500), nullable=True),
        sa.Column("upload_status", sa.String(length=30), nullable=False, server_default="ready"),
    ]
    for column in new_columns:
        if column.name not in existing:
            op.add_column("media_assets", column)


def downgrade() -> None:
    """Downgrade schema."""
    from sqlalchemy import inspect

    inspector = inspect(op.get_bind())
    existing = {col["name"] for col in inspector.get_columns("media_assets")}

    for name in ("upload_status", "streaming_url", "poster_url", "height", "width"):
        if name in existing:
            op.drop_column("media_assets", name)
