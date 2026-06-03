"""Add module_id column to media_assets table.

Revision ID: add_module_id_to_media_assets
Revises: make_hashed_password_nullable
Create Date: 2026-06-03
"""
from typing import Union, Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'add_module_id_to_media_assets'
down_revision: Union[str, Sequence[str], None] = 'make_hashed_password_nullable'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('media_assets') as batch_op:
        batch_op.add_column(sa.Column('module_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_media_assets_module_id', ['module_id'])
        batch_op.create_foreign_key(
            'fk_media_assets_module_id',
            'modules',
            ['module_id'],
            ['id'],
            ondelete='CASCADE',
        )


def downgrade() -> None:
    with op.batch_alter_table('media_assets') as batch_op:
        batch_op.drop_constraint('fk_media_assets_module_id', type_='foreignkey')
        batch_op.drop_index('ix_media_assets_module_id')
        batch_op.drop_column('module_id')
