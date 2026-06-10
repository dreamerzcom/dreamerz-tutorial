"""Add creator commerce + delivery schema (Phase 1 & 2 gap features).

Revision ID: add_creator_commerce_delivery
Revises: add_creator_tools_tables
Create Date: 2026-06-10

Adds:
  - courses: is_free, price, currency, sales_page, completion_rule,
    drip_enabled, drip_type
  - lessons: is_free_preview, drip_days, drip_date
  - coupons table (per-course discount codes)
  - orders table (mock-checkout course purchases)

Idempotent: each DDL step checks the live schema before acting; works on
SQLite (local) and Postgres (production).
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "add_creator_commerce_delivery"
down_revision: Union[str, Sequence[str], None] = "add_creator_tools_tables"
branch_labels = None
depends_on = None


def _insp():
    return inspect(op.get_bind())


def _has_col(insp, table: str, col: str) -> bool:
    return any(c["name"] == col for c in insp.get_columns(table))


def _has_table(insp, table: str) -> bool:
    return table in insp.get_table_names()


_COURSE_COLS = [
    ("is_free", lambda: sa.Column("is_free", sa.Boolean(), nullable=False, server_default=sa.true())),
    ("price", lambda: sa.Column("price", sa.Numeric(10, 2), nullable=False, server_default="0")),
    ("currency", lambda: sa.Column("currency", sa.String(3), nullable=False, server_default="USD")),
    ("sales_page", lambda: sa.Column("sales_page", sa.JSON(), nullable=True)),
    ("completion_rule", lambda: sa.Column("completion_rule", sa.String(40), nullable=False, server_default="all_lessons")),
    ("drip_enabled", lambda: sa.Column("drip_enabled", sa.Boolean(), nullable=False, server_default=sa.false())),
    ("drip_type", lambda: sa.Column("drip_type", sa.String(40), nullable=False, server_default="none")),
]

_LESSON_COLS = [
    ("is_free_preview", lambda: sa.Column("is_free_preview", sa.Boolean(), nullable=False, server_default=sa.false())),
    ("drip_days", lambda: sa.Column("drip_days", sa.Integer(), nullable=True)),
    ("drip_date", lambda: sa.Column("drip_date", sa.DateTime(timezone=True), nullable=True)),
]


def upgrade() -> None:
    insp = _insp()

    if _has_table(insp, "courses"):
        for name, factory in _COURSE_COLS:
            if not _has_col(insp, "courses", name):
                op.add_column("courses", factory())

    if _has_table(insp, "lessons"):
        for name, factory in _LESSON_COLS:
            if not _has_col(insp, "lessons", name):
                op.add_column("lessons", factory())

    if not _has_table(insp, "coupons"):
        op.create_table(
            "coupons",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
            sa.Column("code", sa.String(64), nullable=False),
            sa.Column("discount_type", sa.String(20), nullable=False, server_default="percent"),
            sa.Column("discount_value", sa.Numeric(10, 2), nullable=False, server_default="0"),
            sa.Column("max_redemptions", sa.Integer(), nullable=True),
            sa.Column("times_redeemed", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("course_id", "code", name="uq_coupon_course_code"),
        )

    if not _has_table(insp, "orders"):
        op.create_table(
            "orders",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("student_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
            sa.Column("coupon_id", sa.Integer(), sa.ForeignKey("coupons.id", ondelete="SET NULL"), nullable=True),
            sa.Column("list_price", sa.Numeric(10, 2), nullable=False, server_default="0"),
            sa.Column("amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
            sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("payment_provider", sa.String(40), nullable=False, server_default="mock"),
            sa.Column("provider_ref", sa.String(128), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    insp = _insp()
    if _has_table(insp, "orders"):
        op.drop_table("orders")
    if _has_table(insp, "coupons"):
        op.drop_table("coupons")
    if _has_table(insp, "lessons"):
        for name, _ in reversed(_LESSON_COLS):
            if _has_col(insp, "lessons", name):
                op.drop_column("lessons", name)
    if _has_table(insp, "courses"):
        for name, _ in reversed(_COURSE_COLS):
            if _has_col(insp, "courses", name):
                op.drop_column("courses", name)
