"""Add learning profile fields to users for course recommendations.

Revision ID: add_learning_profile_fields
Revises: add_subscription_plan
Create Date: 2026-06-08

Adds: age, industry, profession, interests (JSON), desired_topics (JSON),
experience_level, learning_goal to the users table.

Idempotent: each DDL step checks live schema before acting.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "add_learning_profile_fields"
down_revision: Union[str, Sequence[str], None] = "add_module_id_to_media_assets"
branch_labels = None
depends_on = None

_USERS_TABLE = "users"

_NEW_COLUMNS = [
    ("age", sa.Integer(), True),
    ("industry", sa.String(100), True),
    ("profession", sa.String(100), True),
    ("interests", sa.JSON(), True),
    ("desired_topics", sa.JSON(), True),
    ("experience_level", sa.String(20), True),
    ("learning_goal", sa.String(100), True),
]


def _column_exists(inspector, table: str, column: str) -> bool:
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    for col_name, col_type, nullable in _NEW_COLUMNS:
        if not _column_exists(inspector, _USERS_TABLE, col_name):
            op.add_column(
                _USERS_TABLE,
                sa.Column(col_name, col_type, nullable=nullable),
            )
            inspector = inspect(bind)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    for col_name, _, _ in reversed(_NEW_COLUMNS):
        if _column_exists(inspector, _USERS_TABLE, col_name):
            op.drop_column(_USERS_TABLE, col_name)
