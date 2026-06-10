"""Add creator-tools schema: certificate config, certificates, announcements.

Revision ID: add_creator_tools_tables
Revises: add_learning_profile_fields
Create Date: 2026-06-10

Adds:
  - courses.certificate_enabled (bool), courses.certificate_title (str)
  - certificates table (issued completion certificates)
  - announcements table (creator notices to learners)

Idempotent: each DDL step checks the live schema before acting so the
migration is safe to re-run and works on both SQLite (local) and Postgres.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "add_creator_tools_tables"
down_revision: Union[str, Sequence[str], None] = "add_learning_profile_fields"
branch_labels = None
depends_on = None


def _inspector():
    return inspect(op.get_bind())


def _column_exists(insp, table: str, column: str) -> bool:
    return any(c["name"] == column for c in insp.get_columns(table))


def _table_exists(insp, table: str) -> bool:
    return table in insp.get_table_names()


def upgrade() -> None:
    insp = _inspector()

    # ── courses: certificate config columns ──
    if _table_exists(insp, "courses"):
        if not _column_exists(insp, "courses", "certificate_enabled"):
            op.add_column(
                "courses",
                sa.Column("certificate_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
            )
        if not _column_exists(insp, "courses", "certificate_title"):
            op.add_column("courses", sa.Column("certificate_title", sa.String(255), nullable=True))

    # ── certificates ──
    if not _table_exists(insp, "certificates"):
        op.create_table(
            "certificates",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("serial", sa.String(64), nullable=False, unique=True),
            sa.Column("student_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
            sa.Column("student_name_snapshot", sa.String(255), nullable=True),
            sa.Column("course_name_snapshot", sa.String(255), nullable=True),
            sa.Column("title", sa.String(255), nullable=True),
            sa.Column("completion_percent", sa.Numeric(5, 2), nullable=True),
            sa.Column("average_score", sa.Numeric(5, 2), nullable=True),
            sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("student_user_id", "course_id", name="uq_certificate_student_course"),
        )

    # ── announcements ──
    if not _table_exists(insp, "announcements"):
        op.create_table(
            "announcements",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_by", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    insp = _inspector()
    if _table_exists(insp, "announcements"):
        op.drop_table("announcements")
    if _table_exists(insp, "certificates"):
        op.drop_table("certificates")
    if _table_exists(insp, "courses"):
        if _column_exists(insp, "courses", "certificate_title"):
            op.drop_column("courses", "certificate_title")
        if _column_exists(insp, "courses", "certificate_enabled"):
            op.drop_column("courses", "certificate_enabled")
