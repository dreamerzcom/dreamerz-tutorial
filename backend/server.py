"""Backward-compatible entry point.

Render (and other deployments) may still reference `uvicorn server:app`.
This shim re-exports the FastAPI app from the new modular entry point.
"""

from main import app  # noqa: F401
