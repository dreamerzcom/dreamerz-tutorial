"""Add trial_expires_at column to users (45-day free trial enforcement)

Revision ID: add_trial_expires_at
Revises: 78645d620170
Create Date: 2026-05-17 00:00:00.000000

"""
from typing import Sequence, Union
from datetime import datetime, timedelta, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_trial_expires_at"
down_revision: Union[str, Sequence[str], None] = "78645d620170"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TRIAL_DURATION_DAYS = 45
EXEMPT_ROLES = ("admin", "creator", "supervisor")


def upgrade() -> None:
    """Upgrade schema.

    1. Add nullable `trial_expires_at` column on `users` (idempotent — skip
       if it already exists, since some Render deploys may have it).
    2. Backfill: every existing **learner** row gets `now() + 45 days` so
       nobody is locked out the moment this ships. Exempt roles
       (admin / creator / supervisor) stay NULL — they are not gated.
    """
    from sqlalchemy import inspect

    bind = op.get_bind()
    inspector = inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("users")}

    if "trial_expires_at" not in existing_cols:
        op.add_column(
            "users",
            sa.Column("trial_expires_at", sa.DateTime(timezone=True), nullable=True),
        )

    # Backfill — give every existing learner a fresh 45-day window starting
    # from the deploy timestamp. Exempt roles are left NULL.
    expiry = datetime.now(timezone.utc) + timedelta(days=TRIAL_DURATION_DAYS)
    exempt_list = ", ".join(f"'{r}'" for r in EXEMPT_ROLES)

    op.execute(
        sa.text(
            "UPDATE users SET trial_expires_at = :expiry "
            "WHERE trial_expires_at IS NULL "
            f"AND role NOT IN ({exempt_list})"
        ).bindparams(expiry=expiry)
    )


def downgrade() -> None:
    """Downgrade schema — drop the column.

    Idempotent: only drops if the column is present.
    """
    from sqlalchemy import inspect

    bind = op.get_bind()
    inspector = inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("users")}

    if "trial_expires_at" in existing_cols:
        op.drop_column("users", "trial_expires_at")
