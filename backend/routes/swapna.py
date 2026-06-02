"""Swapna chat route — POST /api/swapna/chat.

Public endpoint (no auth required) so prospective users on the landing
page can ask Swapna questions. Lightweight in-memory rate-limit caps
abuse without needing Redis.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from services import swapna_service


router = APIRouter(prefix="/swapna", tags=["swapna"])


# ── Rate limiting ───────────────────────────────────────────────
# In-memory sliding window: each client (by IP) gets MAX_REQUESTS
# requests per WINDOW_SECONDS. Survives within a single process.
# Render free tier has one worker per service, so this is sufficient
# without bringing in Redis. For multi-worker deployments, swap for
# slowapi + Redis.
RATE_LIMIT_MAX = 8
RATE_LIMIT_WINDOW_SEC = 60
_buckets: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    # Render fronts the app behind a proxy — X-Forwarded-For has the
    # client IP. Falls back to the direct peer when not present.
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limit_check(ip: str) -> bool:
    now = time.time()
    bucket = _buckets[ip]
    # Trim stale entries before counting.
    while bucket and now - bucket[0] > RATE_LIMIT_WINDOW_SEC:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT_MAX:
        return False
    bucket.append(now)
    return True


# ── Request / response models ───────────────────────────────────
class ChatTurn(BaseModel):
    role: str = Field(description="'user' or 'assistant'")
    content: str = Field(description="What was said in that turn.")


class ChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=2000,
        description="The user's current message.",
    )
    history: Optional[List[ChatTurn]] = Field(
        default=None,
        description="Recent chat turns — only the last 10 are used.",
    )


class ChatResponse(BaseModel):
    reply: str
    model: str
    demo: bool = False


# ── Route ───────────────────────────────────────────────────────
@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, request: Request):
    """Send a message to Swapna; receive a reply.

    The endpoint is public — no auth. Cap per-IP traffic with the
    sliding-window limiter above.
    """
    ip = _client_ip(request)
    if not _rate_limit_check(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "You're sending messages too quickly. "
                "Wait a moment and try again."
            ),
        )

    history_dicts = (
        [{"role": t.role, "content": t.content} for t in body.history]
        if body.history
        else None
    )
    result = await swapna_service.respond(body.message, history=history_dicts)
    return ChatResponse(**result)


@router.get("/health")
async def health():
    """Trivial liveness probe — no AI call. Useful for the frontend to
    decide whether to render the Swapna widget at all."""
    from config import ANTHROPIC_API_KEY

    return {
        "ok": True,
        "configured": bool(ANTHROPIC_API_KEY),
        "model": swapna_service.SWAPNA_MODEL,
    }
