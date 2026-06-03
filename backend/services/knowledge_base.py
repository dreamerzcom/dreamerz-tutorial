"""Auto-gathered site knowledge for Swapna (the help chatbot).

Builds a single Markdown blob the LLM can use as grounded context. The
blob is regenerated on demand and cached for KB_TTL_SECONDS so we don't
hammer the DB on every chat turn.

What goes in:
  - Static facts (support email, sign-up flow, supervisor dashboard,
    pricing model, mobile/web support, etc.) — facts that don't change
    with content.
  - Categories (slug + name + count of published courses).
  - Published courses (name, tagline, difficulty, category, total XP).
  - Active FAQs (question + answer) from the faqs table.

What's deliberately NOT in:
  - Per-lesson content (would blow the context window; the chatbot
    points users to the lesson player instead).
  - User-specific data (chat is currently un-authed — see swapna_service
    for the public/auth split).
"""

from __future__ import annotations

import time
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session
from models.sql_models import Category, Course, FAQ


KB_TTL_SECONDS = 300  # 5 min — short enough to pick up content edits, long
                     # enough that a burst of chat traffic doesn't pummel
                     # Postgres.


# ── Static facts ─────────────────────────────────────────────
#
# Facts that don't live in the DB but every user asks about. Update this
# block when policies change (e.g. support email, trial duration). Kept
# as a Markdown blob because Claude reads Markdown well and the headings
# help it cite the right section in answers.
_STATIC_FACTS_MD = """\
# About DreamerZ

DreamerZ is an educational platform for college students (primarily India,
ages 19–22) focused on AI tools, professional communication, startup
thinking, and placement readiness. Most courses are paired theory + lab
lessons with portfolio-grade artifacts at the end.

Site URL: https://dreamer-z.com
Support email: dreamerz.support@gmail.com (replies within 24 hours)

# How to sign up

1. Click "Sign up" on the top-right of any page.
2. Choose email + password OR Google sign-in.
3. New accounts get a free trial — explore any course immediately.
4. After the trial expires, the trial-expired page links to the support
   email for an extension or upgrade.

# How to log in

Top-right → "Sign in" or visit /login. Forgot password → use the
/forgot-password page which emails a reset link via the Resend
integration.

# Courses, modules, lessons

The catalog page is /learn. Courses are grouped by category (AI
Learning, Job Assist, Business Setup, etc.). Each course contains
modules; each module contains paired theory + lab lessons.

To start a course: click into the course card → it opens the journey
player. Progress, XP, and completion are tracked automatically.

# Supervisor dashboard (teachers / mentors / guardians)

People who supervise a learner can access /supervisors/dashboard to monitor
progress. Supervisors are added per-learner. Public landing page for
supervisors: /supervisors.

# Account, password, settings

/account holds profile info, theme (light/dark), and trial status.
Password change is at /reset-password. Account deletion: contact
support.

# AI features

Most lessons include an AI sidekick — chat with Claude inside the
lesson to clarify concepts, get example outputs, or practise the lab.
The platform uses Claude (Anthropic's API) as the LLM provider.

# Pricing

The course content is freely accessible during the trial. Long-term
access and certain premium features may be paid — the pricing page
(/supervisors includes a section, and the trial-expired page details the
upgrade path) has the latest plans. For specific pricing or invoice
questions, email dreamerz.support@gmail.com.

# Content protection

Lessons are watermarked with the viewer's email and shown with copy
protection on /learn pages. This is to deter casual scraping;
legitimate learning is unaffected.

# Common navigation

- Catalog:                /learn
- My progress:            /learn/myprogress
- Account settings:       /account
- For supervisors:        /supervisors
- Supervisor dashboard:   /supervisors/dashboard
- Admin (creators only):  /admin

# Social media

DreamerZ posts updates, behind-the-scenes content, and learning tips on
the channels below. These are the only official handles — anything not
on this list is not us. (If a learner reports an impersonator, escalate
to dreamerz.support@gmail.com.)

- Instagram: https://www.instagram.com/dreamerz8314
- Facebook:  https://www.facebook.com/share/18gki1kfVd/
- LinkedIn:  https://www.linkedin.com/in/dreamer-z-185669413
- YouTube:   https://youtube.com/@dreamerz-m1y

When a learner asks "where can I follow you?", "do you have Instagram?",
"YouTube channel?", etc., share the matching link from the list. If they
ask for a platform that's not listed (TikTok, X/Twitter, Discord, etc.),
say we don't have an official account there yet and point them at the
ones above.

# Languages

English-first. Some lessons include Hindi/Bengali support tips. UI is
English only.

# Troubleshooting

- Login fails: check email/password; use /forgot-password if needed.
- Lesson won't load: refresh the page, or sign out and back in.
- Video won't play: the module hero videos are served by Cloudinary;
  check your network connection.
- Trial expired: visit /trial-expired or email support.

# Escalation

If Swapna can't answer a question, the user should email
dreamerz.support@gmail.com or use the Contact section in the footer.
The support team replies within 24 hours.
"""


# ── Cache ─────────────────────────────────────────────────────
_cached_kb: Optional[str] = None
_cached_at: float = 0.0


def _is_cache_fresh() -> bool:
    return _cached_kb is not None and (time.time() - _cached_at) < KB_TTL_SECONDS


async def _build_kb_md(session: AsyncSession) -> str:
    parts: list[str] = [_STATIC_FACTS_MD, "\n"]

    # ── Categories ────────────────────────────────────────
    cat_stmt = (
        select(Category)
        .where(Category.is_active.is_(True))
        .order_by(Category.sort_order)
    )
    cats = (await session.execute(cat_stmt)).scalars().all()
    if cats:
        parts.append("# Course categories\n")
        for c in cats:
            count_stmt = (
                select(func.count(Course.id))
                .where(Course.category_id == c.id, Course.status == "published")
            )
            cnt = (await session.execute(count_stmt)).scalar_one()
            parts.append(f"- **{c.name}** (`/learn/{c.slug}`) — {cnt} published course(s)")
        parts.append("")

    # ── Published courses ─────────────────────────────────
    course_stmt = (
        select(Course, Category.slug.label("cat_slug"), Category.name.label("cat_name"))
        .join(Category, Course.category_id == Category.id)
        .where(Course.status == "published")
        .order_by(Category.sort_order, Course.sort_order)
    )
    rows = (await session.execute(course_stmt)).all()
    if rows:
        parts.append("# Published courses\n")
        for course, cat_slug, cat_name in rows:
            line = f"- **{course.name}**"
            if course.tagline:
                line += f" — {course.tagline}"
            line += f" [{course.difficulty}, {cat_name}]"
            parts.append(line)
            if course.description:
                # Trim long descriptions — the catalog page has the full text.
                desc = course.description.strip().split("\n")[0]
                if len(desc) > 280:
                    desc = desc[:280].rsplit(" ", 1)[0] + "…"
                parts.append(f"  {desc}")
        parts.append("")

    # ── Active FAQs ──────────────────────────────────────
    faq_stmt = (
        select(FAQ)
        .where(FAQ.is_active.is_(True))
        .order_by(FAQ.sort_order)
    )
    faqs = (await session.execute(faq_stmt)).scalars().all()
    if faqs:
        parts.append("# Frequently asked questions\n")
        for f in faqs:
            parts.append(f"**Q:** {f.question.strip()}")
            parts.append(f"**A:** {f.answer.strip()}\n")

    return "\n".join(parts)


async def get_knowledge_base() -> str:
    """Return the current site knowledge as a Markdown blob.

    Cached for KB_TTL_SECONDS. First request after expiry refreshes;
    callers don't need to know about the cache.
    """
    global _cached_kb, _cached_at
    if _is_cache_fresh():
        return _cached_kb  # type: ignore[return-value]

    async with async_session() as session:
        kb = await _build_kb_md(session)

    _cached_kb = kb
    _cached_at = time.time()
    return kb


def invalidate_cache() -> None:
    """Drop the cached KB so the next call rebuilds it.

    Call this from admin endpoints that mutate courses/FAQs if you want
    Swapna to pick up the change before the TTL expires. (Optional —
    waiting up to 5 min is usually fine.)
    """
    global _cached_kb, _cached_at
    _cached_kb = None
    _cached_at = 0.0
