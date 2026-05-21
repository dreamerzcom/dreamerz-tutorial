"""drop full_name column from users

Revision ID: aa56d1692adb
Revises: d78dfff32aa3
Create Date: 2026-05-21 10:45:52.519355

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa56d1692adb'
down_revision: Union[str, Sequence[str], None] = 'd78dfff32aa3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('users', 'full_name')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('users', sa.Column('full_name', sa.String(length=255), nullable=True))
