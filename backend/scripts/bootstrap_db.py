"""
Idempotent schema bootstrap for deploy build steps.

Render's buildCommand needs to handle two cases:

  1. Fresh DB (e.g. brand-new dreamerz-db-test). No tables exist, no
     alembic_version. We create the schema from the current SQLAlchemy
     models via Base.metadata.create_all, then stamp alembic at head so
     historical migrations don't try to re-add columns that create_all
     already produced.

  2. Existing DB (prod). The schema is in place and alembic_version
     records the last applied migration. We run `alembic upgrade head`
     to apply any pending migrations.

Detection key: presence of the `alembic_version` table. If it exists,
we're on an established DB; if not, this is the first deploy and we
need to bootstrap.

Usage (from backend/):

    python scripts/bootstrap_db.py

Render's buildCommand for any backend service:

    pip install -r requirements.txt && python scripts/bootstrap_db.py

Replaces the previous `alembic upgrade head` step — works the same on
prod and unblocks fresh DBs simultaneously.
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path

# Make `database`, `models`, etc importable when invoked as
# `python scripts/bootstrap_db.py` from backend/.
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from sqlalchemy import create_engine, inspect  # noqa: E402

from database import init_db  # noqa: E402


def _sync_db_url() -> str:
    """A sync (psycopg2-style) DATABASE_URL for the one-shot inspection.

    Strips `+asyncpg` so we don't pay the cost of spinning up the async
    event loop just to check a single table. Also normalises Render's
    legacy `postgres://` prefix.
    """
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL is not set in this environment.")
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url.replace("+asyncpg", "")


def _alembic_version_present() -> bool:
    with create_engine(_sync_db_url()).connect() as conn:
        return inspect(conn).has_table("alembic_version")


async def _bootstrap_fresh() -> None:
    """Schema build for a brand-new DB: create_all then stamp at head."""
    print("bootstrap_db: fresh DB detected; creating schema from models", flush=True)
    await init_db()
    print("bootstrap_db: schema created; stamping alembic at head", flush=True)
    subprocess.check_call(["alembic", "stamp", "head"])


def _upgrade_existing() -> None:
    """Standard alembic upgrade against an established DB."""
    print("bootstrap_db: existing DB detected; running 'alembic upgrade head'", flush=True)
    subprocess.check_call(["alembic", "upgrade", "head"])


def main() -> None:
    if _alembic_version_present():
        _upgrade_existing()
    else:
        asyncio.run(_bootstrap_fresh())
    print("bootstrap_db: done", flush=True)


if __name__ == "__main__":
    main()
