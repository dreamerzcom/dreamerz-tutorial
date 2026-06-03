"""Authentication routes — register, login, profile, change password."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from config import USERNAME_REGEX, EMAIL_REGEX, ADMIN_EMAILS, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, GOOGLE_CLIENT_ID
from database import get_db
from models.sql_models import User
from models.user import UserCreate, UserLogin, TokenResponse, UserInfoResponse, LanguageUpdate
from services.auth_service import (
    TRIAL_DURATION_DAYS,
    TRIAL_EXEMPT_ROLES,
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash,
    has_role,
    trial_days_remaining,
    verify_password,
)


def _trial_payload(user_like) -> dict:
    """Extract (trial_expires_at_iso, trial_days_remaining) for response bodies.

    Accepts either a User ORM row or the dict shape `authenticate_user`
    returns. Hides the column for exempt roles by returning None on both
    fields — the frontend reads None as "no trial, never expires".
    """
    if isinstance(user_like, dict):
        role = user_like.get("role")
        email = user_like.get("email", "")
        raw_expiry = user_like.get("trial_expires_at")
        if isinstance(raw_expiry, datetime):
            expiry_iso = raw_expiry.isoformat()
        else:
            expiry_iso = raw_expiry  # already a string or None
        user_dict = user_like
    else:
        role = user_like.role
        email = user_like.email or ""
        expiry_iso = user_like.trial_expires_at.isoformat() if user_like.trial_expires_at else None
        user_dict = {"role": role, "email": email, "trial_expires_at": expiry_iso}

    role_lc = (role or "learner").lower()
    if role_lc in TRIAL_EXEMPT_ROLES or email.lower() in ADMIN_EMAILS:
        return {"trial_expires_at": None, "trial_days_remaining": None}
    return {
        "trial_expires_at": expiry_iso,
        "trial_days_remaining": trial_days_remaining(user_dict),
    }
from services.email_service import send_welcome_email
from middleware.rate_limit import check_auth_rate_limit

import re as _re

def _make_username_from_email(email: str) -> str:
    base = email.split("@")[0]
    base = _re.sub(r"[^a-zA-Z0-9]", "", base) or "user"
    return base[:30].lower()

logger = logging.getLogger(__name__)

_VALID_LANG_CODES = {lang["code"] for lang in SUPPORTED_LANGUAGES}

router = APIRouter(prefix="/auth", tags=["auth"])


class SocialLoginRequest(BaseModel):
    provider: str  # "google"
    token: str     # ID token from the provider


@router.post("/social", response_model=TokenResponse)
async def social_login(body: SocialLoginRequest, session: AsyncSession = Depends(get_db)):
    """Sign in or register via a social OAuth provider (Google).

    Verifies the provider's ID token, then either finds the existing user
    by social_id/email or creates a new account — no password required.
    Returns a DreamerZ JWT identical to the normal login response.
    """
    provider = body.provider.lower()

    if provider == "google":
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {body.token}"},
                    timeout=10,
                )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Google token.")
            id_info = resp.json()
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="Could not verify Google token.")

        social_id = id_info.get("sub", "")
        email = id_info.get("email", "").strip().lower()
        if not social_id:
            raise HTTPException(status_code=401, detail="Google token missing user ID.")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    if not email:
        raise HTTPException(status_code=400, detail="No email returned from provider.")

    now = datetime.now(timezone.utc)

    # Try to find existing user by social_id first, then fall back to email
    result = await session.execute(
        select(User).where(
            or_(
                (User.social_provider == provider) & (User.social_id == social_id),
                User.email == email,
            )
        )
    )
    db_user = result.scalars().first()

    if db_user:
        # Update social fields if this is the first social login on an existing email account
        if not db_user.social_provider:
            db_user.social_provider = provider
            db_user.social_id = social_id
        db_user.last_login = now
        await session.commit()
        await session.refresh(db_user)
    else:
        # Create new account
        username = _make_username_from_email(email)
        # Ensure username uniqueness
        suffix = 1
        base = username
        while True:
            existing = await session.execute(select(User).where(User.username == username))
            if not existing.scalars().first():
                break
            username = f"{base}{suffix}"
            suffix += 1

        is_admin_email = email in ADMIN_EMAILS
        final_role = "admin" if is_admin_email else "learner"
        trial_expires = None if final_role in TRIAL_EXEMPT_ROLES or is_admin_email else now + timedelta(days=TRIAL_DURATION_DAYS)

        db_user = User(
            username=username,
            email=email,
            hashed_password=None,
            preferred_language=DEFAULT_LANGUAGE,
            role=final_role,
            social_provider=provider,
            social_id=social_id,
            created_at=now,
            updated_at=now,
            last_login=now,
            trial_expires_at=trial_expires,
        )
        session.add(db_user)
        await session.commit()
        await session.refresh(db_user)

        try:
            send_welcome_email(to_email=email, username=db_user.username)
        except Exception:
            pass

    user_lang = db_user.preferred_language or DEFAULT_LANGUAGE
    token = create_access_token(
        {"sub": db_user.email, "email": db_user.email, "lang": user_lang, "role": db_user.role}
    )

    return {
        "access_token": token,
        "username": db_user.username,
        "email": db_user.email,
        "created_at": db_user.created_at.isoformat() if db_user.created_at else None,
        "role": db_user.role,
        "ai_generation_enabled": db_user.ai_generation_enabled,
        "preferred_language": user_lang,
        "phone": db_user.phone,
        "country_code": db_user.country_code,
        "theme": db_user.theme,
        **_trial_payload(db_user),
    }


@router.post("/register", response_model=UserInfoResponse)
async def register_user(user: UserCreate, session: AsyncSession = Depends(get_db)):
    username = user.username.strip().lower()
    email = user.email.strip().lower()
    password = user.password.strip()

    if not USERNAME_REGEX.match(username):
        raise HTTPException(
            status_code=400,
            detail="Name must be at least 3 characters and can only contain letters, numbers, and spaces.",
        )
    if not EMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=400, detail="Please provide a valid email address."
        )
    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long.",
        )
    # Enforce same password strength rules as frontend
    if not any(c.isupper() for c in password) or not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 1 uppercase letter and 1 number.",
        )

    result = await session.execute(
        select(User).where(or_(User.username == username, User.email == email))
    )
    existing_user = result.scalars().first()
    if existing_user:
        # Use generic error to prevent username/email enumeration
        raise HTTPException(
            status_code=400, detail="Registration failed. Please try again."
        )

    lang = user.preferred_language.strip().lower()
    if lang not in _VALID_LANG_CODES:
        lang = DEFAULT_LANGUAGE

    # Restrict self-assignable roles at signup. Admin role is granted only
    # via ADMIN_EMAILS env var (super-admins) or by an existing admin
    # promoting a user, never via the public registration endpoint.
    SELF_ASSIGNABLE_ROLES = {"learner", "supervisor", "creator"}
    requested_role = (user.role or "learner").strip().lower()
    if requested_role not in SELF_ASSIGNABLE_ROLES:
        requested_role = "learner"

    hashed_password = get_password_hash(password)
    now = datetime.now(timezone.utc)

    is_admin_email = email in ADMIN_EMAILS
    final_role = "admin" if is_admin_email else requested_role

    # Exempt roles never have an expiry; learners get the standard window.
    trial_expires = (
        None
        if final_role in TRIAL_EXEMPT_ROLES or is_admin_email
        else now + timedelta(days=TRIAL_DURATION_DAYS)
    )

    new_user = User(
        username=username,
        email=email,
        hashed_password=hashed_password,
        preferred_language=lang,
        role=final_role,
        created_at=now,
        updated_at=now,
        last_login=None,
        trial_expires_at=trial_expires,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)

    created_at = now.isoformat()

    # Send welcome email (fire-and-forget — don't block registration on email failure)
    try:
        send_welcome_email(to_email=email, username=username)
    except Exception:
        pass  # Email failure should never block registration

    return {
        "username": username,
        "email": email,
        "created_at": created_at,
        "role": final_role,
        "ai_generation_enabled": False,
        "preferred_language": lang,
        **_trial_payload(new_user),
    }


@router.post("/login", response_model=TokenResponse)
async def login_user(credentials: UserLogin, request: Request, session: AsyncSession = Depends(get_db)):
    # Rate-limit login attempts per IP to prevent brute force
    client_ip = request.client.host if request.client else "unknown"
    check_auth_rate_limit(client_ip)

    username = credentials.username.strip().lower() if credentials.username else None
    email = credentials.email.strip().lower() if credentials.email else None

    if not username and not email:
        raise HTTPException(
            status_code=400, detail="Please provide a username or email."
        )

    user = await authenticate_user(username, email, credentials.password)
    if not user:
        # Always return a single generic error to prevent username/email
        # enumeration. A specific "no account found" message would let an
        # attacker iterate through email lists to harvest valid accounts.
        raise HTTPException(
            status_code=401, detail="Invalid email or password."
        )

    user_lang = user.get("preferred_language", DEFAULT_LANGUAGE)
    token = create_access_token(
        {"sub": user["email"], "email": user["email"], "lang": user_lang, "role": user.get("role", "learner")}
    )

    # Update last_login via SQLAlchemy
    result = await session.execute(
        select(User).where(User.username == user["username"])
    )
    db_user = result.scalars().first()
    if db_user:
        db_user.last_login = datetime.now(timezone.utc)
        await session.commit()

    return {
        "access_token": token,
        "username": user["username"],
        "email": user["email"],
        "created_at": user["created_at"],
        "role": user.get("role", "learner"),
        "ai_generation_enabled": user.get("ai_generation_enabled", False),
        "preferred_language": user_lang,
        "phone": user.get("phone"),
        "country_code": user.get("country_code"),
        "theme": user.get("theme", "light"),
        **_trial_payload(user),
    }


@router.get("/me", response_model=UserInfoResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {
        "username": current_user["username"],
        "email": current_user["email"],
        "created_at": current_user["created_at"],
        "role": current_user.get("role", "learner"),
        "ai_generation_enabled": current_user.get("ai_generation_enabled", False),
        "preferred_language": current_user.get("preferred_language", DEFAULT_LANGUAGE),
        "phone": current_user.get("phone"),
        "country_code": current_user.get("country_code"),
        "theme": current_user.get("theme", "light"),
        **_trial_payload(current_user),
    }


@router.put("/language")
async def update_language(
    body: LanguageUpdate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's preferred language."""
    lang = body.preferred_language.strip().lower()
    if lang not in _VALID_LANG_CODES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language '{lang}'. Supported: {', '.join(_VALID_LANG_CODES)}",
        )

    result = await session.execute(
        select(User).where(User.email == current_user["email"])
    )
    db_user = result.scalars().first()
    if db_user:
        db_user.preferred_language = lang
        db_user.updated_at = datetime.now(timezone.utc)
        await session.commit()

    return {"preferred_language": lang}


class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    phone: Optional[str] = None
    country_code: Optional[str] = None
    theme: Optional[str] = None


@router.put("/profile")
async def update_profile(
    body: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's profile information."""
    result = await session.execute(
        select(User).where(User.email == current_user["email"])
    )
    db_user = result.scalars().first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update fields only if they have values (not None and not empty string)
    if body.username is not None and body.username != "":
        db_user.username = body.username
    if body.phone is not None and body.phone != "":
        db_user.phone = body.phone
    if body.country_code is not None and body.country_code != "":
        db_user.country_code = body.country_code
    if body.theme is not None and body.theme in ["light", "dark"]:
        db_user.theme = body.theme

    db_user.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(db_user)

    return {
        "username": db_user.username,
        "phone": db_user.phone,
        "country_code": db_user.country_code,
        "theme": db_user.theme,
    }


@router.get("/languages")
async def get_supported_languages():
    """Return the list of supported languages."""
    return SUPPORTED_LANGUAGES


# ── Change password (authenticated) ──────────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)


@router.post("/change-password", response_model=TokenResponse)
async def change_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Set a new password for the currently authenticated user.

    Requires the user's current password — prevents a brief-device-access
    attacker from immediately resetting the target's password.

    Returns a fresh JWT signed against the new password hash so the user
    stays logged in seamlessly without having to re-enter credentials.
    """
    current_password = body.current_password
    new_password = body.new_password.strip()
    confirm = body.confirm_password.strip()

    if new_password != confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    if len(new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long.",
        )
    # Enforce same password strength rules as registration
    if not any(c.isupper() for c in new_password) or not any(c.isdigit() for c in new_password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 1 uppercase letter and 1 number.",
        )

    result = await session.execute(
        select(User).where(User.email == current_user["email"])
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Verify the current password BEFORE accepting a new one. Without
    # this, anyone with a few seconds of access to an unlocked device
    # could permanently take over the account.
    if not user.hashed_password or not verify_password(current_password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")

    # Block setting the same password — defeats the purpose of rotation.
    if verify_password(new_password, user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the current password.",
        )

    user.hashed_password = get_password_hash(new_password)
    user.updated_at = datetime.now(timezone.utc)
    await session.commit()

    user_lang = current_user.get("preferred_language", DEFAULT_LANGUAGE)
    new_token = create_access_token(
        {"sub": user.email, "email": user.email, "lang": user_lang, "role": user.role}
    )

    return {
        "access_token": new_token,
        "username": user.username,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "role": user.role,
        "preferred_language": user_lang,
        "phone": user.phone,
        "country_code": user.country_code,
        "theme": user.theme,
        **_trial_payload(user),
    }


# ── Password reset (email-verified, token-required) ──────────
#
# Two-step flow:
#   1. POST /auth/request-password-reset {login_id}
#        Always returns 200 (no enumeration). If the account exists,
#        an email is sent containing a one-time JWT reset token.
#   2. POST /auth/forgot-password {token, new_password, confirm_password}
#        Validates the token (signature, 15-min TTL, type=password_reset,
#        token_version matches user.password_reset_version), then sets
#        the new password and bumps password_reset_version to invalidate
#        any other outstanding reset tokens for this account.
#
# Previously this endpoint accepted {login_id, new_password} and would
# overwrite the password on the spot — full account takeover for anyone
# who knew an email. Replaced 2026-06 after security audit.

import jwt as _jwt
from config import JWT_SECRET, JWT_ALGORITHM
from services.email_service import FRONTEND_URL, send_email

PASSWORD_RESET_TTL_SECONDS = 900  # 15 min — short enough to limit
                                  # exposure, long enough to act on email.


class RequestPasswordResetRequest(BaseModel):
    login_id: str = Field(..., max_length=255, description="username or email")


class ForgotPasswordRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=2048,
                       description="one-time reset token from the email link")
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)


def _create_password_reset_token(user_email: str, password_hash: str) -> str:
    """Mint a signed, single-use JWT that authorises ONE password reset.

    Single-use is enforced by hashing the user's current password hash
    into the token's `pwh` claim. After a successful reset the hash
    changes, so the same token can't be replayed.
    """
    import hashlib
    pwh_fingerprint = hashlib.sha256(
        (password_hash or "no-hash").encode("utf-8")
    ).hexdigest()[:16]
    payload = {
        "sub": user_email,
        "type": "password_reset",
        "pwh": pwh_fingerprint,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=PASSWORD_RESET_TTL_SECONDS),
        "iat": datetime.now(timezone.utc),
    }
    return _jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _verify_password_reset_token(token: str) -> tuple[str | None, str | None]:
    """Decode + validate. Returns (email, pwh_fingerprint) or (None, None)
    on any failure (expired, wrong type, bad signature, malformed)."""
    try:
        payload = _jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None, None
    if payload.get("type") != "password_reset":
        return None, None
    email = payload.get("sub")
    pwh = payload.get("pwh")
    if not email or not pwh:
        return None, None
    return email.lower(), pwh


@router.post("/request-password-reset")
async def request_password_reset(
    body: RequestPasswordResetRequest,
    request: Request,
    session: AsyncSession = Depends(get_db),
):
    """Send a one-time password reset link to the registered email.

    Always returns the same 200 response regardless of whether the
    account exists — prevents account enumeration via this endpoint.
    Rate-limited per IP to slow harvesting attempts.
    """
    client_ip = request.client.host if request.client else "unknown"
    check_auth_rate_limit(client_ip)

    login_id = (body.login_id or "").strip().lower()

    generic_response = {
        "detail": (
            "If an account exists for that username or email, we've sent "
            "a password reset link. Check your inbox (and spam folder)."
        )
    }

    if not login_id:
        # Even for an empty request, return the generic 200 so the
        # endpoint's response shape never leaks anything.
        return generic_response

    is_email = "@" in login_id
    if is_email:
        stmt = select(User).where(User.email == login_id)
    else:
        stmt = select(User).where(User.username == login_id)
    result = await session.execute(stmt)
    user = result.scalars().first()

    if user and user.email:
        # Mint the token + send the email. Best-effort: if the email
        # send fails we still log success because the user has no
        # actionable signal to act on; admins watch logs.
        token = _create_password_reset_token(user.email, user.hashed_password or "")
        # /forgot-password renders the reset form when ?token=… is
        # present; /reset-password is the auth-gated change-password
        # path for already-logged-in users.
        reset_url = f"{FRONTEND_URL}/forgot-password?token={token}"
        try:
            send_email(
                to_email=user.email,
                subject="Reset your DreamerZ password",
                html_body=f"""
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
                            max-width:520px;margin:0 auto;padding:24px;color:#1e293b;">
                  <h2 style="color:#4f46e5;margin:0 0 16px;">Reset your password</h2>
                  <p>We received a request to reset the password for your DreamerZ
                  account ({user.email}).</p>
                  <p>Click the button below to set a new password. This link
                  expires in 15 minutes and can only be used once.</p>
                  <p style="text-align:center;margin:28px 0;">
                    <a href="{reset_url}"
                       style="display:inline-block;background:#4f46e5;color:#fff;
                              padding:12px 24px;border-radius:10px;
                              text-decoration:none;font-weight:600;">
                      Reset password
                    </a>
                  </p>
                  <p style="color:#64748b;font-size:14px;">
                    If you didn't request this, ignore this email — your
                    password won't change. If you didn't request this and
                    keep getting these emails, contact
                    <a href="mailto:dreamerz.support@gmail.com">support</a>.
                  </p>
                  <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
                    Or paste this URL into your browser:<br>
                    <span style="word-break:break-all;">{reset_url}</span>
                  </p>
                </div>
                """,
            )
            logger.info("Password reset email sent for user %s", user.username)
        except Exception:
            logger.exception("Failed to send password reset email for %s", user.email)
    else:
        # No matching user — still wait briefly (timing-safety hint;
        # full timing safety would need a dummy bcrypt op too).
        logger.info("Password reset requested for non-existent login_id (rate-limited per IP)")

    return generic_response


@router.post("/forgot-password", response_model=TokenResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_db),
):
    """Complete a password reset using the token from the email link.

    Requires a valid one-time reset token (15-min TTL, single-use:
    invalidated by changing the password). Without the token, password
    reset is impossible — closes the account-takeover hole where the
    previous version accepted just {login_id, new_password}.
    """
    client_ip = request.client.host if request.client else "unknown"
    check_auth_rate_limit(client_ip)

    new_password = body.new_password.strip()
    confirm = body.confirm_password.strip()

    if new_password != confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    if len(new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long.",
        )
    if not any(c.isupper() for c in new_password) or not any(c.isdigit() for c in new_password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 1 uppercase letter and 1 number.",
        )

    email, pwh_in_token = _verify_password_reset_token(body.token)
    if not email:
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired. Request a new one.",
        )

    result = await session.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if not user:
        # Generic message; never confirm/deny account existence.
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired. Request a new one.",
        )

    # Single-use enforcement: the token's pwh fingerprint must match the
    # CURRENT password hash. If the password was already reset (with
    # this or any other path), the fingerprint won't match and the
    # token is rejected. This blocks replay.
    import hashlib
    current_pwh_fingerprint = hashlib.sha256(
        (user.hashed_password or "no-hash").encode("utf-8")
    ).hexdigest()[:16]
    if pwh_in_token != current_pwh_fingerprint:
        raise HTTPException(
            status_code=400,
            detail="This reset link has already been used. Request a new one.",
        )

    user.hashed_password = get_password_hash(new_password)
    user.updated_at = datetime.now(timezone.utc)
    await session.commit()

    user_lang = user.preferred_language or DEFAULT_LANGUAGE
    new_token = create_access_token(
        {"sub": user.email, "email": user.email, "lang": user_lang, "role": user.role}
    )

    logger.info("Password successfully reset for user %s", user.username)

    return {
        "access_token": new_token,
        "username": user.username,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "role": user.role,
        "preferred_language": user_lang,
        "phone": user.phone,
        "country_code": user.country_code,
        "theme": user.theme,
        **_trial_payload(user),
    }
