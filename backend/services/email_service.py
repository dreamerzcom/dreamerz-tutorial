"""Email service — sends transactional emails via SMTP (Gmail / any SMTP provider)."""

import logging
import os
import smtplib
import socket
import time
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid

logger = logging.getLogger(__name__)

# ── Config (from environment) ────────────────────────────────
SMTP_SERVER   = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT     = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
FROM_EMAIL    = os.environ.get("FROM_EMAIL") or SMTP_USERNAME or ""
SENDER_NAME   = os.environ.get("SENDER_NAME", "DreamerZ")

# Connection budget. Without an explicit timeout smtplib falls back to
# Python's global default (typically `None` = block forever). On Render
# we've seen outbound to Gmail hang long enough that the worker dies
# before the calling request can return; capping at 15s gets us a clean
# TimeoutError we can actually retry. Override via env if Gmail is being
# unusually slow.
SMTP_TIMEOUT_SECONDS = int(os.environ.get("SMTP_TIMEOUT_SECONDS", "15"))
SMTP_MAX_ATTEMPTS    = int(os.environ.get("SMTP_MAX_ATTEMPTS", "2"))

# Public frontend URL — used to build absolute links inside HTML emails.
FRONTEND_URL  = os.environ.get("FRONTEND_URL", "https://dreamerz.com").rstrip("/")

# Domain portion of FROM_EMAIL used for Message-ID header
_from_domain = (FROM_EMAIL.split("@")[-1].strip(">") if "@" in FROM_EMAIL else "dreamerz.com")


# Errors worth retrying. Auth failures (SMTPAuthenticationError) and
# recipient rejections (SMTPRecipientsRefused) are deterministic — the
# next attempt would fail the same way, so we don't retry those.
_RETRYABLE_EXCEPTIONS = (
    smtplib.SMTPServerDisconnected,
    smtplib.SMTPConnectError,
    smtplib.SMTPHeloError,
    TimeoutError,
    ConnectionResetError,
    ConnectionRefusedError,
    socket.gaierror,    # DNS resolution failure — usually transient
    socket.timeout,
    OSError,            # catch-all for network-unreachable, etc.
)


def _is_configured() -> bool:
    return bool(SMTP_USERNAME and SMTP_PASSWORD)


class _IPv4SMTP(smtplib.SMTP):
    """smtplib.SMTP that forces IPv4 connections.

    Render's container network resolves smtp.gmail.com to an AAAA record
    first; the kernel then tries the IPv6 address and the egress fails
    with `OSError: [Errno 101] Network is unreachable` because the
    container has no working IPv6 route. socket.create_connection raises
    the *first* attempt's exception, so even though IPv4 would have
    worked we never get there. Overriding `_get_socket` to filter
    getaddrinfo to AF_INET sidesteps the bad path entirely.
    """

    def _get_socket(self, host, port, timeout):
        last_err: OSError | None = None
        for af, socktype, proto, _canon, sa in socket.getaddrinfo(
            host, port, socket.AF_INET, socket.SOCK_STREAM
        ):
            sock = None
            try:
                sock = socket.socket(af, socktype, proto)
                if timeout is not None and timeout is not socket._GLOBAL_DEFAULT_TIMEOUT:  # type: ignore[attr-defined]
                    sock.settimeout(timeout)
                if self.source_address is not None:
                    sock.bind(self.source_address)
                sock.connect(sa)
                return sock
            except OSError as e:
                last_err = e
                if sock is not None:
                    sock.close()
                continue
        # No IPv4 address worked. Re-raise so the caller's retry/log
        # logic kicks in with the actual ENETUNREACH / refused / etc.
        if last_err is not None:
            raise last_err
        raise OSError(f"No IPv4 addresses resolved for {host}")


class _IPv4SMTP_SSL(smtplib.SMTP_SSL):
    """SMTP_SSL counterpart of _IPv4SMTP. Used when SMTP_PORT == 465
    (implicit TLS) instead of 587 (STARTTLS)."""

    def _get_socket(self, host, port, timeout):
        # Delegate to the same v4-only resolver, then let SMTP_SSL wrap
        # the returned socket with TLS in its normal flow.
        last_err: OSError | None = None
        for af, socktype, proto, _canon, sa in socket.getaddrinfo(
            host, port, socket.AF_INET, socket.SOCK_STREAM
        ):
            sock = None
            try:
                sock = socket.socket(af, socktype, proto)
                if timeout is not None and timeout is not socket._GLOBAL_DEFAULT_TIMEOUT:  # type: ignore[attr-defined]
                    sock.settimeout(timeout)
                if self.source_address is not None:
                    sock.bind(self.source_address)
                sock.connect(sa)
                # SMTP_SSL wraps the socket in TLS using self.context and
                # server_hostname=self._host, so cert verification keeps
                # working against the original DNS name (smtp.gmail.com),
                # not the resolved IP.
                return self.context.wrap_socket(sock, server_hostname=self._host)
            except OSError as e:
                last_err = e
                if sock is not None:
                    sock.close()
                continue
        if last_err is not None:
            raise last_err
        raise OSError(f"No IPv4 addresses resolved for {host}")


def _attempt_send(msg: MIMEMultipart) -> None:
    """One SMTP attempt. Raises on any failure; caller decides whether to retry.

    Picks implicit-TLS (SMTP_SSL on 465) or STARTTLS (SMTP on 587)
    based on SMTP_PORT, so switching providers/ports is just an env
    change. Both paths force IPv4 — see _IPv4SMTP for the reasoning.
    """
    if SMTP_PORT == 465:
        with _IPv4SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as server:
            server.ehlo()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with _IPv4SMTP(SMTP_SERVER, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)


def send_email(to_email: str, subject: str, html_body: str, text_body: str = "") -> bool:
    """Send a multipart/alternative email via SMTP.

    Always includes a plain-text part alongside HTML — this is the single
    biggest factor in avoiding spam/phishing classification by Gmail.
    Returns True on success, False on failure.

    Retries on transient network errors (connection timeout, DNS failure,
    server disconnect) up to SMTP_MAX_ATTEMPTS times with exponential
    backoff. Deterministic failures (bad credentials, rejected recipient)
    are NOT retried — they'd just fail the same way and burn the request
    budget.
    """
    if not _is_configured():
        logger.warning(
            "Email not configured (SMTP_USERNAME/SMTP_PASSWORD missing). Skipping email to %s",
            to_email,
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"]       = f"{SENDER_NAME} <{FROM_EMAIL}>"
        msg["To"]         = to_email
        msg["Subject"]    = subject
        msg["Date"]       = formatdate(localtime=False)
        msg["Message-ID"] = make_msgid(domain=_from_domain)
        msg["Reply-To"]   = FROM_EMAIL

        # Plain-text part MUST come first; HTML part is the preferred fallback.
        # Mail clients render whichever part they support best.
        plain = text_body or _strip_html(html_body)
        msg.attach(MIMEText(plain, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))
    except Exception as build_err:
        logger.exception(
            "Failed to build MIME message for %s (subject: %s): %r",
            to_email, subject, build_err,
        )
        return False

    last_exc: Exception | None = None
    for attempt in range(1, SMTP_MAX_ATTEMPTS + 1):
        try:
            _attempt_send(msg)
            if attempt > 1:
                logger.info(
                    "Email sent to %s on attempt %d/%d — subject: %s",
                    to_email, attempt, SMTP_MAX_ATTEMPTS, subject,
                )
            else:
                logger.info("Email sent to %s — subject: %s", to_email, subject)
            return True
        except _RETRYABLE_EXCEPTIONS as e:
            last_exc = e
            if attempt < SMTP_MAX_ATTEMPTS:
                # Exponential backoff: 1s, 2s, 4s, ... Capped at the timeout
                # so a slow network doesn't make us wait longer to retry than
                # to give up.
                backoff = min(2 ** (attempt - 1), SMTP_TIMEOUT_SECONDS)
                logger.warning(
                    "SMTP attempt %d/%d failed for %s (%s: %s); retrying in %ds",
                    attempt, SMTP_MAX_ATTEMPTS, to_email,
                    type(e).__name__, e, backoff,
                )
                time.sleep(backoff)
                continue
            break
        except Exception as e:
            # Non-retryable (e.g. SMTPAuthenticationError, SMTPRecipientsRefused).
            # Log with the exception class name so the cause is visible even
            # when the traceback gets truncated in log viewers.
            logger.exception(
                "Failed to send email to %s (non-retryable %s): %r",
                to_email, type(e).__name__, e,
            )
            return False

    # Exhausted retries on a transient error — log the final attempt's
    # exception with the class name front and centre.
    logger.error(
        "Failed to send email to %s after %d attempts. Last error: %s: %s",
        to_email, SMTP_MAX_ATTEMPTS,
        type(last_exc).__name__ if last_exc else "Unknown",
        last_exc,
    )
    return False


def _strip_html(html: str) -> str:
    """Very simple HTML → plain-text: strip tags, collapse whitespace."""
    import re
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def build_welcome_email(username: str) -> str:
    """Build a beautiful HTML welcome email for a new DreamerZ user."""
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to DreamerZ</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6366f1 100%); border-radius:20px 20px 0 0; padding:40px 40px 30px; text-align:center;">
              <div style="display:inline-block; background:rgba(255,255,255,0.2); border-radius:16px; padding:12px 16px; margin-bottom:20px;">
                <span style="font-size:28px;">&#x1F4DA;</span>
              </div>
              <h1 style="color:#ffffff; font-size:28px; font-weight:800; margin:0 0 8px; letter-spacing:-0.5px;">
                Welcome to DreamerZ!
              </h1>
              <p style="color:rgba(255,255,255,0.85); font-size:16px; margin:0; line-height:1.5;">
                Your AI &amp; English learning journey starts now
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background-color:#ffffff; padding:40px;">
              <p style="color:#1e293b; font-size:18px; font-weight:600; margin:0 0 8px;">
                Hey {username} &#x1F44B;
              </p>
              <p style="color:#475569; font-size:15px; line-height:1.7; margin:0 0 28px;">
                We're thrilled to have you on board! DreamerZ is built to help you master AI tools and conversational English. Here's how to get started:
              </p>

              <!-- Steps -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td width="52" valign="top">
                    <div style="width:44px; height:44px; background:linear-gradient(135deg, #4f46e5, #7c3aed); border-radius:12px; text-align:center; line-height:44px; color:#fff; font-weight:700; font-size:16px;">1</div>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="color:#1e293b; font-size:15px; font-weight:600; margin:0 0 4px;">Explore the Learning Hub</p>
                    <p style="color:#64748b; font-size:14px; margin:0; line-height:1.6;">Browse AI tools like ChatGPT, Claude, and Gemini — or jump into our Conversational English course.</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td width="52" valign="top">
                    <div style="width:44px; height:44px; background:linear-gradient(135deg, #f43f5e, #ec4899); border-radius:12px; text-align:center; line-height:44px; color:#fff; font-weight:700; font-size:16px;">2</div>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="color:#1e293b; font-size:15px; font-weight:600; margin:0 0 4px;">Complete Modules &amp; Earn XP</p>
                    <p style="color:#64748b; font-size:14px; margin:0; line-height:1.6;">Each module has interactive lessons and quizzes. Earn XP, build streaks, and track your progress.</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="52" valign="top">
                    <div style="width:44px; height:44px; background:linear-gradient(135deg, #f59e0b, #f97316); border-radius:12px; text-align:center; line-height:44px; color:#fff; font-weight:700; font-size:16px;">3</div>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="color:#1e293b; font-size:15px; font-weight:600; margin:0 0 4px;">Try the Prompt Lab</p>
                    <p style="color:#64748b; font-size:14px; margin:0; line-height:1.6;">Practice writing better AI prompts. See how adding context transforms AI responses!</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 28px;">
                    <a href="{FRONTEND_URL}/learn" target="_blank"
                       style="display:inline-block; background:linear-gradient(135deg, #4f46e5, #7c3aed); color:#ffffff; text-decoration:none; font-weight:700; font-size:16px; padding:14px 36px; border-radius:14px; letter-spacing:0.3px;">
                      Start Learning Now &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#475569; font-size:14px; line-height:1.7; margin:0;">
                If you have any questions or need help, just reply to this email. We're here for you!
              </p>
              <p style="color:#475569; font-size:14px; line-height:1.7; margin:16px 0 0;">
                Happy learning,<br/>
                <strong style="color:#1e293b;">The DreamerZ Team</strong> &#x1F49C;
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#1e293b; border-radius:0 0 20px 20px; padding:28px 40px; text-align:center;">
              <p style="color:#94a3b8; font-size:13px; margin:0 0 8px;">
                <a href="{FRONTEND_URL}/learn" style="color:#818cf8; text-decoration:none; font-weight:600;">Courses</a>
                &nbsp;&middot;&nbsp;
                <a href="{FRONTEND_URL}/account" style="color:#818cf8; text-decoration:none; font-weight:600;">My Account</a>
              </p>
              <p style="color:#64748b; font-size:12px; margin:0;">
                &copy; 2026 DreamerZ. Made with &#x2764;&#xFE0F; for AI &amp; English learners.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def build_password_reset_email(reset_url: str, user_email: str) -> tuple[str, str]:
    """Return (html, plain_text) for the password-reset email."""
    html = f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DreamerZ password reset</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;">
        <tr>
          <td style="padding:36px 40px 0;text-align:center;">
            <p style="color:#64748b;font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">DreamerZ</p>
            <h1 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 24px;">Password reset request</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 36px;">
            <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
              Hello,
            </p>
            <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
              We received a password reset request for the DreamerZ account associated
              with <strong>{user_email}</strong>.
              If you made this request, use the link below to set a new password.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="{reset_url}"
                     style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 30px;border-radius:10px;">
                    Set new password
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#94a3b8;font-size:12px;margin:0 0 6px;">
              Button not working? Copy and paste this link into your browser:
            </p>
            <p style="color:#64748b;font-size:12px;word-break:break-all;margin:0 0 24px;background:#f8fafc;padding:10px 12px;border-radius:8px;border:1px solid #e2e8f0;">
              {reset_url}
            </p>

            <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 20px;" />

            <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">
              This link will expire in 15 minutes.
              If you did not request a password reset, you can safely ignore this email.
              Your password will not change.
            </p>
            <p style="color:#94a3b8;font-size:13px;margin:16px 0 0;">
              &mdash; The DreamerZ Team
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = f"""\
DreamerZ — Password reset request

Hello,

We received a password reset request for the DreamerZ account associated
with {user_email}.

If you made this request, visit the link below to set a new password:

{reset_url}

This link expires in 15 minutes and can only be used once.

If you did not request a password reset, please ignore this email.
Your password will remain unchanged.

— The DreamerZ Team
"""
    return html, plain


def send_welcome_email(to_email: str, username: str) -> bool:
    """Send the welcome email to a newly registered user."""
    html = build_welcome_email(username)
    return send_email(
        to_email=to_email,
        subject=f"Welcome to DreamerZ, {username}!",
        html_body=html,
    )


def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    """Send the password-reset link email."""
    html, plain = build_password_reset_email(reset_url=reset_url, user_email=to_email)
    return send_email(
        to_email=to_email,
        subject="Your DreamerZ password reset link",
        html_body=html,
        text_body=plain,
    )
