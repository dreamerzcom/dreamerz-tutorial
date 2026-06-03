"""Add module_id column to media_assets table.

Revision ID: add_module_id_to_media_assets
Revises: make_hashed_password_nullable
Create Date: 2026-06-03

Idempotent: a previous run (or an earlier ad-hoc DDL) left module_id +
its index + FK in place on the Render DB, and a non-guarded
ADD COLUMN aborted the deploy with `DuplicateColumn`. Each step now
checks the live schema before mutating it — same pattern as
add_is_highlight_to_media_assets.py.
"""
from typing import Union, Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = 'add_module_id_to_media_assets'
down_revision: Union[str, Sequence[str], None] = 'make_hashed_password_nullable'
branch_labels = None
depends_on = None


_TABLE = 'media_assets'
_COLUMN = 'module_id'
_INDEX = 'ix_media_assets_module_id'
_FK = 'fk_media_assets_module_id'


def _column_exists(inspector, table: str, column: str) -> bool:
    return any(c['name'] == column for c in inspector.get_columns(table))


def _index_exists(inspector, table: str, index_name: str) -> bool:
    return any(ix['name'] == index_name for ix in inspector.get_indexes(table))


def _fk_exists(inspector, table: str, fk_name: str) -> bool:
    return any(fk.get('name') == fk_name for fk in inspector.get_foreign_keys(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _column_exists(inspector, _TABLE, _COLUMN):
        op.add_column(_TABLE, sa.Column(_COLUMN, sa.Integer(), nullable=True))
        # Re-inspect so the next checks see the just-added column.
        inspector = inspect(bind)

    if not _index_exists(inspector, _TABLE, _INDEX):
        op.create_index(_INDEX, _TABLE, [_COLUMN])
        inspector = inspect(bind)

    if not _fk_exists(inspector, _TABLE, _FK):
        op.create_foreign_key(
            _FK,
            _TABLE,
            'modules',
            [_COLUMN],
            ['id'],
            ondelete='CASCADE',
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _fk_exists(inspector, _TABLE, _FK):
        op.drop_constraint(_FK, _TABLE, type_='foreignkey')
        inspector = inspect(bind)

    if _index_exists(inspector, _TABLE, _INDEX):
        op.drop_index(_INDEX, table_name=_TABLE)
        inspector = inspect(bind)

    if _column_exists(inspector, _TABLE, _COLUMN):
        op.drop_column(_TABLE, _COLUMN)
