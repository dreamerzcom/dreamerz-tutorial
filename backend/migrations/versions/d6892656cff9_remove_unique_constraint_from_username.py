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


def upgrade() -> None:
    """Upgrade schema."""
    # SQLite doesn't support dropping constraints directly
    # We need to recreate the table without the unique constraint on username
    op.execute("""
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
    """)

    op.execute("""
        INSERT INTO users_new (id, username, email, hashed_password, preferred_language, is_active, role, ai_generation_enabled, created_at, updated_at, last_login, trial_expires_at, phone, country_code)
        SELECT id, username, email, hashed_password, preferred_language, is_active, role, ai_generation_enabled, created_at, updated_at, last_login, trial_expires_at, phone, country_code FROM users
    """)

    op.execute("DROP TABLE users")
    op.execute("ALTER TABLE users_new RENAME TO users")


def downgrade() -> None:
    """Downgrade schema."""
    # Recreate the table with unique constraint on username
    op.execute("""
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
    """)

    op.execute("""
        INSERT INTO users_new (id, username, email, hashed_password, preferred_language, is_active, role, ai_generation_enabled, created_at, updated_at, last_login, trial_expires_at, phone, country_code)
        SELECT id, username, email, hashed_password, preferred_language, is_active, role, ai_generation_enabled, created_at, updated_at, last_login, trial_expires_at, phone, country_code FROM users
    """)

    op.execute("DROP TABLE users")
    op.execute("ALTER TABLE users_new RENAME TO users")
