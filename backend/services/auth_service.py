"""Authentication service — password hashing, JWT tokens, user lookup."""

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Header, HTTPException
from jwt import ExpiredSignatureError, InvalidTokenError
from passlib.context import CryptContext
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_MINUTES, ADMIN_EMAILS
from database import async_session
from models.sql_models import User
from utils.sanitizers import sanitize_str

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Free trial ────────────────────────────────────────────
# Learner accounts get a 30-day window from registration. Once it lapses
# they are routed to the trial-expired page and blocked from progress /
# AI endpoints. Roles in TRIAL_EXEMPT_ROLES are never gated.
# Note: existing users keep their original trial_expires_at — only new
# registrations from this point on are bound to the 30-day window.
TRIAL_DURATION_DAYS = 30
TRIAL_EXEMPT_ROLES = {"admin", "creator", "supervisor"}

# Dummy hash for constant-time comparison when user is not found
_DUMMY_HASH = pwd_context.hash("dummy-password-for-timing-safety")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    data: dict, expires_delta: Optional[timedelta] = None
) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=JWT_EXPIRATION_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _user_to_dict(user: User) -> dict:
    """Convert a User ORM instance to the dict shape exposed by the auth API."""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "hashed_password": user.hashed_password,
        "preferred_language": user.preferred_language or "en",
        "role": user.role or "learner",
        "ai_generation_enabled": user.ai_generation_enabled or False,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "trial_expires_at": user.trial_expires_at.isoformat() if user.trial_expires_at else None,
        "phone": user.phone,
        "country_code": user.country_code,
        "theme": user.theme,
    }


def _coerce_expiry(value) -> Optional[datetime]:
    """Normalise a trial_expires_at value into a timezone-aware datetime.

    Accepts ISO strings (the shape we serialise into dicts), naive datetimes
    (treated as UTC), and aware datetimes (used as-is). Returns None for
    falsy / unparseable input — the caller decides what that means.
    """
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def is_trial_active(user: dict) -> bool:
    """True if the user can still access gated features.

    Exempt roles (admin / creator / supervisor) always pass. Learners pass
    while now < trial_expires_at. A NULL expiry is treated as expired for
    learner-role accounts so we don't accidentally grant unlimited access
    if backfill ever missed a row.
    """
    role = (user.get("role") or "learner").lower()
    if role in TRIAL_EXEMPT_ROLES:
        return True
    if user.get("email", "").lower() in ADMIN_EMAILS:
        return True
    expiry = _coerce_expiry(user.get("trial_expires_at"))
    if not expiry:
        return False
    return datetime.now(timezone.utc) < expiry


def trial_days_remaining(user: dict) -> Optional[int]:
    """Whole days left in the trial, or None for exempt accounts.

    A non-exempt user with no expiry returns 0 (expired). Already-expired
    users return 0, not a negative number — the frontend uses 0 as the
    "expired" marker.
    """
    role = (user.get("role") or "learner").lower()
    if role in TRIAL_EXEMPT_ROLES or user.get("email", "").lower() in ADMIN_EMAILS:
        return None
    expiry = _coerce_expiry(user.get("trial_expires_at"))
    if not expiry:
        return 0
    delta = expiry - datetime.now(timezone.utc)
    return max(0, math.ceil(delta.total_seconds() / 86400))


async def require_trial_active(authorization: Optional[str] = Header(None)):
    """FastAPI dependency — block gated endpoints once the trial lapses.

    Returns 403 with a stable `detail='trial_expired'` so the frontend can
    detect and route to the trial-expired page. Wraps `get_current_user`
    so callers still get the user dict.
    """
    user = await get_current_user(authorization)
    if not is_trial_active(user):
        raise HTTPException(status_code=403, detail="trial_expired")
    return user


async def get_user_by_login_identifier(
    username: Optional[str], email: Optional[str], session: Optional[AsyncSession] = None,
):
    """Look up a user by email or username. Returns user dict or None."""
    close_session = False
    if session is None:
        session = async_session()
        close_session = True

    try:
        if email:
            email = sanitize_str(email, "email").lower()
            result = await session.execute(
                select(User).where(User.email == email)
            )
        elif username:
            username = sanitize_str(username, "username").lower()
            result = await session.execute(
                select(User).where(User.username == username)
            )
        else:
            return None

        user = result.scalars().first()
        return _user_to_dict(user) if user else None
    finally:
        if close_session:
            await session.close()


async def get_current_user(authorization: Optional[str] = Header(None)):
    """FastAPI dependency — extract and validate current user from JWT."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Authorization header missing"
        )
    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.email == email.lower())
        )
        user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Return dict without hashed_password
    d = _user_to_dict(user)
    d.pop("hashed_password", None)
    return d


def has_role(user: dict, *roles: str) -> bool:
    """Check if a user has any of the specified roles."""
    user_role = user.get("role", "learner")
    # Super-admins (emails in ADMIN_EMAILS) are always considered admins
    if user.get("email", "").lower() in ADMIN_EMAILS and "admin" in roles:
        return True
    return user_role in roles


async def require_role(*roles: str):
    """FastAPI dependency factory — require specific role(s)."""
    async def role_dependency(authorization: Optional[str] = Header(None)):
        user = await get_current_user(authorization)
        if not has_role(user, *roles):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role(s): {', '.join(roles)}"
            )
        return user
    return role_dependency


async def get_current_admin(authorization: Optional[str] = Header(None)):
    """FastAPI dependency — require admin privileges."""
    user = await get_current_user(authorization)
    if not has_role(user, "admin"):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user


async def get_current_creator(authorization: Optional[str] = Header(None)):
    """FastAPI dependency — require creator or admin privileges."""
    user = await get_current_user(authorization)
    if not has_role(user, "creator", "admin"):
        raise HTTPException(status_code=403, detail="Creator or admin privileges required")
    return user


async def get_current_supervisor(authorization: Optional[str] = Header(None)):
    """FastAPI dependency — require supervisor or admin privileges."""
    user = await get_current_user(authorization)
    if not has_role(user, "supervisor", "admin"):
        raise HTTPException(status_code=403, detail="Supervisor or admin privileges required")
    return user


async def require_ai_generation_enabled(authorization: Optional[str] = Header(None)):
    """FastAPI dependency — require AI generation to be enabled for user."""
    user = await get_current_user(authorization)
    # Admins always have AI generation enabled
    if has_role(user, "admin"):
        return user
    # Creators must have ai_generation_enabled flag
    if has_role(user, "creator") and user.get("ai_generation_enabled"):
        return user
    raise HTTPException(
        status_code=403,
        detail="AI generation feature not enabled for your account"
    )


async def authenticate_user(username: Optional[str], email: Optional[str], password: str):
    """Authenticate a user by credentials. Returns user dict or None.

    Uses constant-time comparison to prevent timing-based user enumeration.
    """
    user = await get_user_by_login_identifier(username, email)

    if not user:
        # Always run bcrypt to prevent timing attacks that reveal user existence
        verify_password(password, _DUMMY_HASH)
        return None

    if not verify_password(password, user.get("hashed_password", "")):
        return None

    # Check if user account is active
    if not user.get("is_active", True):
        return None

    return user
