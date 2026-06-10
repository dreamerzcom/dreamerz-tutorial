"""Creator commerce + delivery routes (gap-report Phase 1 & 2).

Creator surface (`content_router`, prefix `/admin`, creator-gated):
  - aggregate creator dashboard
  - course pricing + sales-page config
  - coupons CRUD
  - delivery config (drip + completion rule) at course and lesson level
  - learner roster

Learner surface (`learner_router`):
  - public sales page, coupon validation, mock checkout + confirm, access map
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.sql_models import (
    User, Course, Module, Lesson, Coupon, Order, Certificate,
    StudentCourseEnrollment,
)
from services.auth_service import get_current_creator, get_current_user, has_role
from services import commerce_service
from routes.creator_tools import _load_owned_course, _grading_queue_count

logger = logging.getLogger(__name__)

content_router = APIRouter(prefix="/admin", tags=["creator-commerce"], dependencies=[Depends(get_current_creator)])
learner_router = APIRouter(tags=["creator-commerce-learner"])


async def _load_owned_lesson(session: AsyncSession, lesson_slug: str, current_user: dict):
    """Return (lesson, course) for a lesson slug, enforcing course ownership."""
    row = (
        await session.execute(
            select(Lesson, Course)
            .join(Module, Lesson.module_id == Module.id)
            .join(Course, Module.course_id == Course.id)
            .where(Lesson.slug == lesson_slug)
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson, course = row
    if (
        not has_role(current_user, "admin")
        and (course.created_by or "") != current_user.get("username", "")
    ):
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson, course


# ══════════════════════════════════════════════════════════
# CREATOR DASHBOARD (aggregate across the creator's courses)
# ══════════════════════════════════════════════════════════

@content_router.get("/creator/dashboard")
async def creator_dashboard(
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Aggregate KPIs across every course the creator owns (all for admins)."""
    is_admin = has_role(current_user, "admin")
    username = current_user.get("username", "")

    course_stmt = select(Course)
    if not is_admin:
        course_stmt = course_stmt.where(Course.created_by == username)
    courses = (await session.execute(course_stmt)).scalars().all()
    course_ids = [c.id for c in courses]

    published = sum(1 for c in courses if c.status == "published")
    drafts = sum(1 for c in courses if c.status == "draft")

    now = datetime.now(timezone.utc)
    cutoff_30 = now - timedelta(days=30)

    total_enrollments = 0
    active_30 = 0
    completions = 0
    completion_pcts: list[float] = []
    per_course = []

    if course_ids:
        enrollments = (
            await session.execute(
                select(StudentCourseEnrollment).where(StudentCourseEnrollment.course_id.in_(course_ids))
            )
        ).scalars().all()
        total_enrollments = len(enrollments)
        for e in enrollments:
            completion_pcts.append(float(e.completion_percent or 0))
            if e.status == "completed":
                completions += 1
            la = e.last_accessed_at
            if la is not None:
                la = la if la.tzinfo else la.replace(tzinfo=timezone.utc)
                if la >= cutoff_30:
                    active_30 += 1

        # Per-course enrollment + completion counts
        enr_by_course: dict[int, list] = {}
        for e in enrollments:
            enr_by_course.setdefault(e.course_id, []).append(e)

        # Revenue from paid orders
        rev_rows = (
            await session.execute(
                select(Order.course_id, func.coalesce(func.sum(Order.amount), 0))
                .where(and_(Order.course_id.in_(course_ids), Order.status == "paid"))
                .group_by(Order.course_id)
            )
        ).all()
        revenue_by_course = {cid: float(amt) for cid, amt in rev_rows}

        for c in courses:
            ces = enr_by_course.get(c.id, [])
            comp = sum(1 for e in ces if e.status == "completed")
            per_course.append({
                "id": c.slug,
                "name": c.name,
                "status": c.status,
                "is_free": c.is_free,
                "price": float(c.price or 0),
                "currency": c.currency,
                "enrollments": len(ces),
                "completions": comp,
                "completion_rate": round(comp / len(ces) * 100, 1) if ces else 0.0,
                "revenue": revenue_by_course.get(c.id, 0.0),
            })
        total_revenue = sum(revenue_by_course.values())
        certs_issued = (
            await session.execute(
                select(func.count(Certificate.id)).where(Certificate.course_id.in_(course_ids))
            )
        ).scalar() or 0
        awaiting_grading = 0
        for cid in course_ids:
            awaiting_grading += await _grading_queue_count(session, cid)
    else:
        total_revenue = 0.0
        certs_issued = 0
        awaiting_grading = 0

    per_course.sort(key=lambda x: x["enrollments"], reverse=True)

    return {
        "totals": {
            "courses": len(courses),
            "published": published,
            "drafts": drafts,
            "total_enrollments": total_enrollments,
            "active_learners_30d": active_30,
            "completions": completions,
            "avg_completion_percent": round(sum(completion_pcts) / len(completion_pcts), 1) if completion_pcts else 0.0,
            "total_revenue": round(total_revenue, 2),
            "certificates_issued": int(certs_issued),
            "awaiting_grading": awaiting_grading,
        },
        "courses": per_course,
    }


# ══════════════════════════════════════════════════════════
# PRICING + SALES PAGE
# ══════════════════════════════════════════════════════════

class PricingPayload(BaseModel):
    is_free: bool = True
    price: float = 0
    currency: str = "USD"


@content_router.put("/courses/{course_id}/pricing")
async def update_pricing(
    course_id: str,
    payload: PricingPayload,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Set a course's price / free flag / currency."""
    course = await _load_owned_course(session, course_id, current_user)
    course.is_free = payload.is_free
    course.price = 0 if payload.is_free else max(0.0, round(payload.price, 2))
    course.currency = (payload.currency or "USD").upper()[:3]
    course.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return {"detail": "Pricing updated", "is_free": course.is_free, "price": float(course.price), "currency": course.currency}


class SalesPagePayload(BaseModel):
    sales_page: dict


@content_router.put("/courses/{course_id}/sales-page")
async def update_sales_page(
    course_id: str,
    payload: SalesPagePayload,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Save the course sales/landing-page content (headline, outcomes, …)."""
    course = await _load_owned_course(session, course_id, current_user)
    course.sales_page = payload.sales_page
    course.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return {"detail": "Sales page updated", "sales_page": course.sales_page}


# ══════════════════════════════════════════════════════════
# DELIVERY (drip + completion rule + free preview)
# ══════════════════════════════════════════════════════════

class DeliveryPayload(BaseModel):
    drip_enabled: Optional[bool] = None
    drip_type: Optional[str] = None  # none | date | days_after_enrollment | sequential
    completion_rule: Optional[str] = None  # all_lessons | all_lessons_and_quizzes


@content_router.put("/courses/{course_id}/delivery")
async def update_delivery(
    course_id: str,
    payload: DeliveryPayload,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Course-level drip + completion-criteria config."""
    course = await _load_owned_course(session, course_id, current_user)
    valid_drip = {"none", "date", "days_after_enrollment", "sequential"}
    valid_rule = {"all_lessons", "all_lessons_and_quizzes"}
    if payload.drip_type is not None:
        if payload.drip_type not in valid_drip:
            raise HTTPException(status_code=400, detail=f"drip_type must be one of {sorted(valid_drip)}")
        course.drip_type = payload.drip_type
    if payload.drip_enabled is not None:
        course.drip_enabled = payload.drip_enabled
    if payload.completion_rule is not None:
        if payload.completion_rule not in valid_rule:
            raise HTTPException(status_code=400, detail=f"completion_rule must be one of {sorted(valid_rule)}")
        course.completion_rule = payload.completion_rule
    course.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return {
        "detail": "Delivery settings updated",
        "drip_enabled": course.drip_enabled,
        "drip_type": course.drip_type,
        "completion_rule": course.completion_rule,
    }


class LessonDeliveryPayload(BaseModel):
    is_free_preview: Optional[bool] = None
    drip_days: Optional[int] = None
    drip_date: Optional[str] = None  # ISO date/datetime


@content_router.put("/lessons/{lesson_id}/delivery")
async def update_lesson_delivery(
    lesson_id: str,
    payload: LessonDeliveryPayload,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Per-lesson free-preview flag + drip schedule (days / date)."""
    lesson, _course = await _load_owned_lesson(session, lesson_id, current_user)
    if payload.is_free_preview is not None:
        lesson.is_free_preview = payload.is_free_preview
    if payload.drip_days is not None:
        lesson.drip_days = max(0, payload.drip_days) if payload.drip_days else None
    if payload.drip_date is not None:
        if payload.drip_date.strip() == "":
            lesson.drip_date = None
        else:
            try:
                dt = datetime.fromisoformat(payload.drip_date.replace("Z", "+00:00"))
                lesson.drip_date = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except ValueError:
                raise HTTPException(status_code=400, detail="drip_date must be ISO 8601")
    lesson.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return {
        "detail": "Lesson delivery updated",
        "is_free_preview": lesson.is_free_preview,
        "drip_days": lesson.drip_days,
        "drip_date": lesson.drip_date.isoformat() if lesson.drip_date else None,
    }


# ══════════════════════════════════════════════════════════
# COUPONS
# ══════════════════════════════════════════════════════════

class CouponPayload(BaseModel):
    code: str
    discount_type: str = "percent"  # percent | fixed
    discount_value: float = 0
    max_redemptions: Optional[int] = None
    expires_at: Optional[str] = None
    is_active: bool = True


@content_router.get("/courses/{course_id}/coupons")
async def list_coupons(
    course_id: str,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    course = await _load_owned_course(session, course_id, current_user)
    rows = (
        await session.execute(
            select(Coupon).where(Coupon.course_id == course.id).order_by(Coupon.created_at.desc())
        )
    ).scalars().all()
    return [c.to_dict() for c in rows]


@content_router.post("/courses/{course_id}/coupons")
async def create_coupon(
    course_id: str,
    payload: CouponPayload,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    course = await _load_owned_course(session, course_id, current_user)
    code = payload.code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Coupon code is required")
    if payload.discount_type not in ("percent", "fixed"):
        raise HTTPException(status_code=400, detail="discount_type must be 'percent' or 'fixed'")
    existing = (
        await session.execute(
            select(Coupon).where(and_(Coupon.course_id == course.id, Coupon.code == code))
        )
    ).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail="A coupon with that code already exists for this course")
    expires = None
    if payload.expires_at:
        try:
            dt = datetime.fromisoformat(payload.expires_at.replace("Z", "+00:00"))
            expires = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="expires_at must be ISO 8601")
    coupon = Coupon(
        course_id=course.id,
        code=code,
        discount_type=payload.discount_type,
        discount_value=max(0.0, payload.discount_value),
        max_redemptions=payload.max_redemptions,
        is_active=payload.is_active,
        expires_at=expires,
        created_by=current_user.get("username"),
    )
    session.add(coupon)
    await session.commit()
    await session.refresh(coupon)
    return coupon.to_dict()


@content_router.delete("/coupons/{coupon_id}")
async def delete_coupon(
    coupon_id: int,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    coupon = (
        await session.execute(select(Coupon).where(Coupon.id == coupon_id))
    ).scalars().first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    course_slug = (
        await session.execute(select(Course.slug).where(Course.id == coupon.course_id))
    ).scalar_one()
    await _load_owned_course(session, course_slug, current_user)
    await session.delete(coupon)
    await session.commit()
    return {"detail": "Coupon deleted"}


# ══════════════════════════════════════════════════════════
# LEARNER ROSTER (creator-scoped)
# ══════════════════════════════════════════════════════════

@content_router.get("/courses/{course_id}/learners")
async def course_learners(
    course_id: str,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Enrolled-learner roster for a course with progress + scores."""
    course = await _load_owned_course(session, course_id, current_user)
    rows = (
        await session.execute(
            select(StudentCourseEnrollment, User)
            .join(User, StudentCourseEnrollment.student_user_id == User.id)
            .where(StudentCourseEnrollment.course_id == course.id)
            .order_by(StudentCourseEnrollment.created_at.desc())
        )
    ).all()
    learners = []
    for enr, user in rows:
        learners.append({
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "status": enr.status,
            "completion_percent": float(enr.completion_percent or 0),
            "lessons_completed": enr.lessons_completed_count,
            "total_lessons": enr.total_lessons_count,
            "average_quiz_score": float(enr.average_quiz_score) if enr.average_quiz_score is not None else None,
            "last_accessed_at": enr.last_accessed_at.isoformat() if enr.last_accessed_at else None,
            "enrolled_at": enr.created_at.isoformat() if enr.created_at else None,
        })
    return {"course": {"id": course.slug, "name": course.name}, "count": len(learners), "learners": learners}


# ══════════════════════════════════════════════════════════
# LEARNER-FACING: SALES PAGE, CHECKOUT, ACCESS
# ══════════════════════════════════════════════════════════

@learner_router.get("/courses/{course_id}/sales-page")
async def public_sales_page(
    course_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Public marketing page for a published course (no auth)."""
    course = (
        await session.execute(
            select(Course).where(and_(Course.slug == course_id, Course.status == "published"))
        )
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Curriculum outline + free-preview lessons
    modules = (
        await session.execute(
            select(Module).where(Module.course_id == course.id).order_by(Module.sort_order)
        )
    ).scalars().all()
    curriculum = []
    free_preview = []
    for m in modules:
        lessons = (
            await session.execute(
                select(Lesson).where(Lesson.module_id == m.id).order_by(Lesson.sort_order)
            )
        ).scalars().all()
        curriculum.append({
            "title": m.title,
            "lessons": [{"title": l.title, "is_free_preview": l.is_free_preview} for l in lessons],
        })
        free_preview.extend([{"id": l.slug, "title": l.title} for l in lessons if l.is_free_preview])

    return {
        "id": course.slug,
        "name": course.name,
        "tagline": course.tagline,
        "description": course.description,
        "icon": course.icon,
        "theme_color": course.theme_color,
        "difficulty": course.difficulty,
        "is_free": course.is_free,
        "price": float(course.price or 0),
        "currency": course.currency,
        "sales_page": course.sales_page or {},
        "curriculum": curriculum,
        "free_preview_lessons": free_preview,
    }


class CouponValidatePayload(BaseModel):
    code: str


@learner_router.post("/courses/{course_id}/coupon/validate")
async def validate_course_coupon(
    course_id: str,
    payload: CouponValidatePayload,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Validate a coupon and return the resulting price quote."""
    course = (
        await session.execute(select(Course).where(Course.slug == course_id))
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    coupon, err = await commerce_service.validate_coupon(session, course, payload.code)
    if err:
        return {"valid": False, "detail": err}
    quote = commerce_service.quote_price(course, coupon)
    return {"valid": True, "code": coupon.code, **quote}


class CheckoutPayload(BaseModel):
    coupon_code: Optional[str] = None


@learner_router.post("/courses/{course_id}/checkout")
async def checkout_course(
    course_id: str,
    payload: CheckoutPayload,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Start a (mock) purchase. Free courses enrol immediately."""
    course = (
        await session.execute(
            select(Course).where(and_(Course.slug == course_id, Course.status == "published"))
        )
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    result = await commerce_service.create_checkout(
        session, current_user.get("id"), course, payload.coupon_code
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("detail", "Checkout failed"))
    return result


@learner_router.post("/orders/{order_id}/confirm")
async def confirm_order_route(
    order_id: int,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Mock-gateway confirmation: settle a pending order and enrol the learner."""
    result = await commerce_service.confirm_order(session, current_user.get("id"), order_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("detail", "Confirmation failed"))
    return result


@learner_router.get("/courses/{course_id}/access")
async def course_access(
    course_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Per-lesson unlock map for the current learner (enrollment + drip)."""
    course = (
        await session.execute(select(Course).where(Course.slug == course_id))
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return await commerce_service.compute_access(session, current_user.get("id"), course)
