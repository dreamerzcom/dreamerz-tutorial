"""remove unique constraint from username

Revision ID: d6892656cff9
Revises: aa56d1692adb
Create Date: 2026-05-21 11:49:25.138350

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd6892656cff9'
down_revision: Union[str, Sequence[str], None] = 'aa56d1692adb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Why this migration is dialect-branched:
#   * Postgres supports `ALTER TABLE ... DROP CONSTRAINT ...` directly,
#     so we just drop the auto-generated unique constraint by name.
#     SQLAlchemy names it `<table>_<column>_key` when `unique=True`, so
#     for `users.username` that's `users_username_key`. IF EXISTS keeps
#     the migration idempotent and safe to re-run.
#   * SQLite cannot drop a constraint in-place. The historical version
#     of this migration handled that by recreating the whole `users`
#     table and copying rows over — that DDL was SQLite-only
#     (`INTEGER PRIMARY KEY AUTOINCREMENT`, `DEFAULT 1` for booleans,
#     etc.) and blew up the Render Postgres deploy with
#     "syntax error at or near 'AUTOINCREMENT'". The SQLite path is
#     preserved verbatim below; we just gate it so it only runs on
#     SQLite.


_SQLITE_REBUILD_NO_USERNAME_UNIQUE = """
CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(500) NOT NULL,
    preferred_language VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT 1,
    role VARCHAR(20) DEFAULT 'learner' NOT NULL,
    ai_generation_enabled BOOLEAN DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    trial_expires_at DATETIME,
    phone VARCHAR(20),
    country_code VARCHAR(10)
)
"""

_SQLITE_REBUILD_WITH_USERNAME_UNIQUE = """
CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(500) NOT NULL,
    preferred_language VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT 1,
    role VARCHAR(20) DEFAULT 'learner' NOT NULL,
    ai_generation_enabled BOOLEAN DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    trial_expires_at DATETIME,
    phone VARCHAR(20),
    country_code VARCHAR(10)
)
"""

_SQLITE_COPY_ROWS = """
INSERT INTO users_new (
    id, username, email, hashed_password, preferred_language, is_active,
    role, ai_generation_enabled, created_at, updated_at, last_login,
    trial_expires_at, phone, country_code
)
SELECT
    id, username, email, hashed_password, preferred_language, is_active,
    role, ai_generation_enabled, created_at, updated_at, last_login,
    trial_expires_at, phone, country_code
FROM users
"""


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    """Upgrade schema — drop the unique constraint on users.username."""
    if _is_postgres():
        # Idempotent: no-op if the constraint has already been dropped
        # (or was never created under that name).
        op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key")
        return

    # SQLite path — rebuild table without the username UNIQUE.
    op.execute(_SQLITE_REBUILD_NO_USERNAME_UNIQUE)
    op.execute(_SQLITE_COPY_ROWS)
    op.execute("DROP TABLE users")
    op.execute("ALTER TABLE users_new RENAME TO users")


def downgrade() -> None:
    """Downgrade schema — restore the unique constraint on users.username."""
    if _is_postgres():
        # Idempotent: skip if a constraint with this name already exists.
        op.execute(
            "DO $$ BEGIN "
            "IF NOT EXISTS ("
            "  SELECT 1 FROM pg_constraint "
            "  WHERE conname = 'users_username_key' "
            "    AND conrelid = 'users'::regclass"
            ") THEN "
            "  ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username); "
            "END IF; END $$;"
        )
        return

    # SQLite path — rebuild table with the username UNIQUE.
    op.execute(_SQLITE_REBUILD_WITH_USERNAME_UNIQUE)
    op.execute(_SQLITE_COPY_ROWS)
    op.execute("DROP TABLE users")
    op.execute("ALTER TABLE users_new RENAME TO users")
