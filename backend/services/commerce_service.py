"""Commerce + delivery service — pricing, coupons, mock checkout, and drip
unlock logic shared by the creator-tools and learner routes.

The checkout flow is deliberately gateway-agnostic: free/zero-cost courses
enrol immediately; paid courses create a `pending` Order that is settled by
`confirm_order` (the mock gateway). Swapping in Stripe/Razorpay means creating
the provider order in `create_checkout` and calling `confirm_order` from the
provider's webhook instead of the mock confirm endpoint.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.sql_models import (
    Course, Module, Lesson, Coupon, Order,
    StudentCourseEnrollment, StudentLessonProgress,
)
from services import progress_service

logger = logging.getLogger(__name__)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def quote_price(course: Course, coupon: Optional[Coupon]) -> dict:
    """Return {list_price, amount, currency, discount} after applying a coupon."""
    list_price = float(course.price or 0)
    amount = list_price
    if coupon and not course.is_free and list_price > 0:
        if coupon.discount_type == "percent":
            amount = list_price * (1 - float(coupon.discount_value) / 100)
        else:  # fixed
            amount = list_price - float(coupon.discount_value)
    amount = max(0.0, round(amount, 2))
    return {
        "list_price": round(list_price, 2),
        "amount": amount,
        "currency": course.currency or "USD",
        "discount": round(list_price - amount, 2),
    }


async def validate_coupon(
    session: AsyncSession, course: Course, code: str
) -> tuple[Optional[Coupon], Optional[str]]:
    """Return (coupon, error). `error` is a human string when invalid."""
    if not code:
        return None, "No code provided"
    coupon = (
        await session.execute(
            select(Coupon).where(
                and_(Coupon.course_id == course.id, Coupon.code == code.strip())
            )
        )
    ).scalars().first()
    if not coupon or not coupon.is_active:
        return None, "Invalid coupon code"
    if coupon.expires_at and _aware(coupon.expires_at) < datetime.now(timezone.utc):
        return None, "This coupon has expired"
    if coupon.max_redemptions is not None and coupon.times_redeemed >= coupon.max_redemptions:
        return None, "This coupon has reached its redemption limit"
    return coupon, None


async def is_enrolled(session: AsyncSession, user_id: int, course_id: int) -> bool:
    enr = (
        await session.execute(
            select(StudentCourseEnrollment).where(
                and_(
                    StudentCourseEnrollment.student_user_id == user_id,
                    StudentCourseEnrollment.course_id == course_id,
                )
            )
        )
    ).scalars().first()
    return bool(enr and enr.is_active)


async def create_checkout(
    session: AsyncSession,
    user_id: int,
    course: Course,
    coupon_code: Optional[str] = None,
) -> dict:
    """Start a purchase. Free/zero-cost → enrol now. Paid → pending Order.

    Returns a dict the frontend can act on: free purchases come back
    `status='free'` already enrolled; paid purchases come back `status='pending'`
    with an `order_id` to confirm via the (mock) gateway.
    """
    # Already enrolled? Idempotent success.
    if await is_enrolled(session, user_id, course.id):
        return {"status": "already_enrolled", "enrolled": True}

    coupon = None
    if coupon_code and not course.is_free:
        coupon, err = await validate_coupon(session, course, coupon_code)
        if err:
            return {"status": "error", "detail": err}

    quote = quote_price(course, coupon)

    # Free course or fully-discounted to zero → enrol immediately.
    if course.is_free or quote["amount"] <= 0:
        order = Order(
            student_user_id=user_id,
            course_id=course.id,
            coupon_id=coupon.id if coupon else None,
            list_price=quote["list_price"],
            amount=0,
            currency=quote["currency"],
            status="free",
            payment_provider="mock",
            paid_at=datetime.now(timezone.utc),
        )
        session.add(order)
        if coupon:
            coupon.times_redeemed += 1
        await session.flush()
        await progress_service.start_course_enrollment(user_id, course.id, session)
        await session.commit()
        return {"status": "free", "enrolled": True, "order_id": order.id, **quote}

    # Paid → pending order awaiting (mock) gateway confirmation.
    order = Order(
        student_user_id=user_id,
        course_id=course.id,
        coupon_id=coupon.id if coupon else None,
        list_price=quote["list_price"],
        amount=quote["amount"],
        currency=quote["currency"],
        status="pending",
        payment_provider="mock",
        provider_ref=f"mock_{uuid.uuid4().hex[:18]}",
    )
    session.add(order)
    await session.commit()
    await session.refresh(order)
    return {"status": "pending", "enrolled": False, "order_id": order.id, **quote}


async def confirm_order(session: AsyncSession, user_id: int, order_id: int) -> dict:
    """Settle a pending order (mock gateway success) and enrol the learner."""
    order = (
        await session.execute(select(Order).where(Order.id == order_id))
    ).scalars().first()
    if not order or order.student_user_id != user_id:
        return {"status": "error", "detail": "Order not found"}
    if order.status in ("paid", "free"):
        return {"status": order.status, "enrolled": True, "order_id": order.id}
    if order.status != "pending":
        return {"status": "error", "detail": f"Order is {order.status}"}

    order.status = "paid"
    order.paid_at = datetime.now(timezone.utc)
    if order.coupon_id:
        coupon = (
            await session.execute(select(Coupon).where(Coupon.id == order.coupon_id))
        ).scalars().first()
        if coupon:
            coupon.times_redeemed += 1
    await session.flush()
    await progress_service.start_course_enrollment(user_id, order.course_id, session)
    await session.commit()
    return {"status": "paid", "enrolled": True, "order_id": order.id}


async def compute_access(
    session: AsyncSession, user_id: Optional[int], course: Course
) -> dict:
    """Compute the learner's access + per-lesson unlock state for a course.

    Drip rules (when `drip_enabled`):
      - date:                  unlock when now >= lesson.drip_date
      - days_after_enrollment: unlock when now >= enrolled_at + lesson.drip_days
      - sequential:            unlock when the previous lesson is completed
    Free-preview lessons are always unlocked. Unenrolled learners on a paid
    course only see free-preview lessons.
    """
    enrolled = bool(user_id) and await is_enrolled(session, user_id, course.id)
    has_access = enrolled or course.is_free

    # Enrollment start (for days_after_enrollment) and completed lessons (for sequential).
    enrolled_at = None
    completed_lesson_ids: set[int] = set()
    if user_id:
        enr = (
            await session.execute(
                select(StudentCourseEnrollment).where(
                    and_(
                        StudentCourseEnrollment.student_user_id == user_id,
                        StudentCourseEnrollment.course_id == course.id,
                    )
                )
            )
        ).scalars().first()
        if enr:
            enrolled_at = _aware(enr.started_at) or _aware(enr.created_at)
        completed_lesson_ids = {
            r for r in (
                await session.execute(
                    select(StudentLessonProgress.lesson_id).where(
                        and_(
                            StudentLessonProgress.student_user_id == user_id,
                            StudentLessonProgress.course_id == course.id,
                            StudentLessonProgress.status == "completed",
                        )
                    )
                )
            ).scalars().all()
        }

    now = datetime.now(timezone.utc)
    lessons_in_order = (
        await session.execute(
            select(Lesson)
            .join(Module, Lesson.module_id == Module.id)
            .where(Module.course_id == course.id)
            .order_by(Module.sort_order, Lesson.sort_order)
        )
    ).scalars().all()

    lessons_access = {}
    prev_completed = True  # first lesson has no predecessor
    for lesson in lessons_in_order:
        unlocked = True
        reason = None

        if lesson.is_free_preview:
            unlocked, reason = True, None
        elif not has_access:
            unlocked, reason = False, "purchase_required"
        elif course.drip_enabled and course.drip_type != "none":
            if course.drip_type == "date":
                if lesson.drip_date and _aware(lesson.drip_date) > now:
                    unlocked, reason = False, "scheduled"
            elif course.drip_type == "days_after_enrollment":
                if lesson.drip_days and enrolled_at:
                    if now < enrolled_at + timedelta(days=lesson.drip_days):
                        unlocked, reason = False, "scheduled"
                elif lesson.drip_days and not enrolled_at:
                    unlocked, reason = False, "scheduled"
            elif course.drip_type == "sequential":
                if not prev_completed:
                    unlocked, reason = False, "complete_previous"

        lessons_access[lesson.slug] = {
            "unlocked": unlocked,
            "reason": reason,
            "is_free_preview": lesson.is_free_preview,
            "drip_days": lesson.drip_days,
            "drip_date": lesson.drip_date.isoformat() if lesson.drip_date else None,
        }
        prev_completed = lesson.id in completed_lesson_ids

    return {
        "enrolled": enrolled,
        "has_access": has_access,
        "is_free": course.is_free,
        "price": float(course.price or 0),
        "currency": course.currency or "USD",
        "drip_enabled": course.drip_enabled,
        "drip_type": course.drip_type,
        "lessons": lessons_access,
    }
