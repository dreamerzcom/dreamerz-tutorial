"""
Idempotent schema bootstrap for deploy build steps.

This script replaces the naive `alembic upgrade head` buildCommand that
breaks on fresh or half-bootstrapped databases. It handles five DB
states cleanly using two facts: whether the schema matches the current
SQLAlchemy models, and what revision alembic has recorded.

  FRESH        no `users` table at all
                → init_db + stamp head
                The whole schema is created from models in one shot;
                historical migrations are skipped because they're now
                redundant.

  PARTIAL      schema is missing tables or columns the models declare
               AND alembic has no recorded revision
                → init_db + stamp head
                Same as fresh — we treat this as "init_db hadn't
                finished" and bootstrap from scratch.

  SCHEMA_CURRENT_BUT_ALEMBIC_BEHIND
               every column in every model already exists in the DB,
               but alembic_version is empty or shows a revision earlier
               than head
                → stamp head only — DO NOT replay migrations.
                This is the test DB's state after a previous deploy ran
                init_db (which created every model's columns) and then
                got interrupted in the middle of `alembic upgrade head`.
                Historical migrations would crash trying to ADD columns
                init_db already produced. We just sync alembic to the
                schema that's already on disk.

  AT_HEAD      alembic's current revision IS head
                → no-op (exit immediately).

  PENDING      schema is missing some model columns AND alembic has a
               recorded revision earlier than head
                → alembic upgrade head (the prod path for applying new
                migrations between deploys).

Detection is explicit: no heuristics, no string parsing. We use
SQLAlchemy's inspector for the schema check and alembic's own
MigrationContext + ScriptDirectory for the revision check.

Usage (from backend/):
    python scripts/bootstrap_db.py

Render's buildCommand:
    pip install -r requirements.txt && python scripts/bootstrap_db.py
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path

# Make `database`, `models`, etc. importable when invoked from backend/.
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from alembic.config import Config  # noqa: E402
from alembic.runtime.migration import MigrationContext  # noqa: E402
from alembic.script import ScriptDirectory  # noqa: E402
from sqlalchemy import create_engine, inspect  # noqa: E402

from database import init_db  # noqa: E402


def _sync_db_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL is not set in this environment.")
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url.replace("+asyncpg", "")


def _head_revision() -> str:
    cfg = Config(str(HERE.parent / "alembic.ini"))
    cfg.set_main_option("script_location", str(HERE.parent / "migrations"))
    script = ScriptDirectory.from_config(cfg)
    head = script.get_current_head()
    if head is None:
        raise RuntimeError("No alembic head revision found in migrations/")
    return head


def _db_state() -> tuple[bool, str | None, bool]:
    """Return (has_users, current_alembic_revision, schema_matches_models).

    `schema_matches_models` is True when every column in every
    Base.metadata table also exists in the DB. That's the signal that
    init_db has already produced the full current schema, even if
    alembic doesn't know about it yet.
    """
    # Importing the Base only after the path is set lets all the
    # model modules register their tables.
    from database import Base  # noqa: WPS433
    import models.sql_models  # noqa: F401, WPS433 — load model definitions

    with create_engine(_sync_db_url()).connect() as conn:
        i = inspect(conn)
        has_users = i.has_table("users")

        if i.has_table("alembic_version"):
            ctx = MigrationContext.configure(conn)
            current = ctx.get_current_revision()
        else:
            current = None

        schema_matches = True
        for table in Base.metadata.tables.values():
            if not i.has_table(table.name):
                schema_matches = False
                break
            db_cols = {c["name"] for c in i.get_columns(table.name)}
            model_cols = {c.name for c in table.columns}
            if not model_cols.issubset(db_cols):
                schema_matches = False
                break

    return has_users, current, schema_matches


def main() -> None:
    head = _head_revision()
    has_users, current, schema_matches = _db_state()

    if not has_users:
        # FRESH — never touched.
        print(f"bootstrap_db: FRESH. init_db + stamp {head}", flush=True)
        asyncio.run(init_db())
        subprocess.check_call(["alembic", "stamp", "head"])
        return

    if current == head:
        # AT_HEAD — already synced. Done.
        print(f"bootstrap_db: AT_HEAD ({head}). no-op", flush=True)
        return

    if schema_matches:
        # SCHEMA_CURRENT_BUT_ALEMBIC_BEHIND — the test DB's half-
        # bootstrapped state. init_db already produced every model
        # column on a previous run; replaying historical migrations
        # would crash on duplicate-column ADDs. Just fast-forward
        # alembic to head.
        print(
            f"bootstrap_db: SCHEMA_CURRENT (models satisfied; alembic at "
            f"{current!r}). stamp head — skipping {head}",
            flush=True,
        )
        subprocess.check_call(["alembic", "stamp", "head"])
        return

    if current is None:
        # PARTIAL — tables exist for SOME of the schema but not all,
        # and alembic has no recorded revision. Treat like fresh:
        # init_db fills in the missing tables (CREATE TABLE IF NOT
        # EXISTS), then stamp head.
        print(f"bootstrap_db: PARTIAL. init_db + stamp {head}", flush=True)
        asyncio.run(init_db())
        subprocess.check_call(["alembic", "stamp", "head"])
        return

    # PENDING — established DB with new migrations to apply (the prod
    # path when a new migration ships).
    print(f"bootstrap_db: PENDING (current={current}, head={head}). upgrade head", flush=True)
    subprocess.check_call(["alembic", "upgrade", "head"])


if __name__ == "__main__":
    main()
