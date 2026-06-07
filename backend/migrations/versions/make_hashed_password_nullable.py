"""make hashed_password nullable for social auth users

Revision ID: make_hashed_password_nullable
Revises: 7f40f876a576
Create Date: 2026-05-27 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'make_hashed_password_nullable'
down_revision: Union[str, Sequence[str], None] = '7f40f876a576'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite does not support ALTER COLUMN — use batch mode to rebuild the table
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column(
            'hashed_password',
            existing_type=sa.String(length=500),
            nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column(
            'hashed_password',
            existing_type=sa.String(length=500),
            nullable=False,
        )
