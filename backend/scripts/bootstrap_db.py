"""
Idempotent schema bootstrap for deploy build steps.

This script replaces the naïve `alembic upgrade head` buildCommand
that breaks on fresh databases. It handles four DB states cleanly:

  - FRESH       (no tables at all) → create schema from models,
                                     stamp alembic at head.
  - PARTIAL     (tables exist from a previous failed bootstrap, but
                 alembic_version is empty / missing) → stamp head.
                 Do NOT replay historical migrations: they will crash
                 trying to ADD columns that init_db already produced.
  - AT_HEAD     (tables exist, alembic_version records head) → no-op.
                 Just confirms quickly and exits.
  - PENDING     (tables exist, alembic_version records an earlier
                 revision) → run `alembic upgrade head` to apply
                 pending migrations. This is the prod path.

Detection uses alembic's own MigrationContext to read the current
revision out of alembic_version, then compares to the head revision
discovered by ScriptDirectory. No heuristics.

Usage (from backend/):
    python scripts/bootstrap_db.py

Render's buildCommand for any backend service:
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
    """The head revision id according to migrations/ on disk."""
    cfg = Config(str(HERE.parent / "alembic.ini"))
    cfg.set_main_option("script_location", str(HERE.parent / "migrations"))
    script = ScriptDirectory.from_config(cfg)
    head = script.get_current_head()
    if head is None:
        raise RuntimeError("No alembic head revision found in migrations/")
    return head


def _db_state() -> tuple[bool, str | None]:
    """(has_users_table, current_alembic_revision_or_None)"""
    with create_engine(_sync_db_url()).connect() as conn:
        i = inspect(conn)
        has_users = i.has_table("users")
        if i.has_table("alembic_version"):
            ctx = MigrationContext.configure(conn)
            current = ctx.get_current_revision()
        else:
            current = None
    return has_users, current


def main() -> None:
    head = _head_revision()
    has_users, current = _db_state()

    if not has_users:
        # FRESH — never touched. Create schema from models, then stamp.
        print(f"bootstrap_db: FRESH (no users table). init_db + stamp {head}", flush=True)
        asyncio.run(init_db())
        subprocess.check_call(["alembic", "stamp", "head"])
        return

    if current is None:
        # PARTIAL — tables exist (probably from a prior init_db run that
        # then failed mid-migration). Stamping head fast-forwards alembic
        # to match the schema that's already on disk. Do NOT upgrade
        # head: the historical migrations will crash trying to ADD
        # columns that already exist.
        print(f"bootstrap_db: PARTIAL (tables exist, no alembic revision). stamp {head}", flush=True)
        subprocess.check_call(["alembic", "stamp", "head"])
        return

    if current == head:
        # AT_HEAD — already synchronised. Run upgrade head anyway as a
        # no-op safety net (it'll exit immediately if there's nothing
        # pending) so the build still surfaces any future-revision
        # script that was added between deploys.
        print(f"bootstrap_db: AT_HEAD (current={head}). upgrade head (will no-op)", flush=True)
        subprocess.check_call(["alembic", "upgrade", "head"])
        return

    # PENDING — established DB with newer migrations to apply. Prod path.
    print(f"bootstrap_db: PENDING (current={current}, head={head}). upgrade head", flush=True)
    subprocess.check_call(["alembic", "upgrade", "head"])


if __name__ == "__main__":
    main()
