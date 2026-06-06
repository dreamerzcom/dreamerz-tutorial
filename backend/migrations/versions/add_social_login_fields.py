"""add social login fields to users

Revision ID: add_social_login_fields
Revises: 7f40f876a576
Create Date: 2026-05-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_social_login_fields'
down_revision: Union[str, Sequence[str], None] = '7f40f876a576'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
#    op.add_column('users', sa.Column('social_provider', sa.String(length=20), nullable=True))
#    op.add_column('users', sa.Column('social_id', sa.String(length=255), nullable=True))


def downgrade() -> None:
#    op.drop_column('users', 'social_id')
#    op.drop_column('users', 'social_provider')
