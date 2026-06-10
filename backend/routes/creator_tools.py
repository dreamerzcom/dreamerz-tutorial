"""Creator-tools routes — analytics, course cloning, drag-and-drop reordering,
manual grading, completion certificates, and course announcements.

These close the gap between DreamerZ's authoring suite and a standard LMS
creator portal. Creator-facing endpoints live on `content_router`
(prefix `/admin`, gated by `get_current_creator`); learner/public endpoints
live on `learner_router`.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.sql_models import (
    User, Course, Module, Lesson, LessonContent, Quiz, QuizQuestion, MediaAsset,
    StudentCourseEnrollment, StudentLessonProgress,
    AssessmentAttempt, AssessmentAttemptAnswer,
    Certificate, Announcement,
)
from services.auth_service import (
    get_current_creator, get_current_user, has_role,
)

logger = logging.getLogger(__name__)

# Creator + admin router (course management surface)
content_router = APIRouter(prefix="/admin", tags=["creator-tools"], dependencies=[Depends(get_current_creator)])

# Learner / public router (certificates + announcement feed)
learner_router = APIRouter(tags=["creator-tools-learner"])


# ── Helpers ──────────────────────────────────────────────

async def _load_owned_course(session: AsyncSession, course_id: str, current_user: dict) -> Course:
    """Return the course identified by slug, enforcing creator ownership.

    Mirrors the existing admin authz rule: only the original creator or an
    admin may act on a course. Ownership failures return 404 (not 403) to
    avoid leaking the existence of other creators' courses.
    """
    result = await session.execute(select(Course).where(Course.slug == course_id))
    course = result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if (
        not has_role(current_user, "admin")
        and (course.created_by or "") != current_user.get("username", "")
    ):
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def _require_draft(course: Course) -> None:
    """Reject structural edits to a published (live) course."""
    if course.status != "draft":
        raise HTTPException(
            status_code=403,
            detail="This course is published and read-only. Create a draft version to make changes.",
        )


# ══════════════════════════════════════════════════════════
# PHASE 1a — COURSE ANALYTICS
# ══════════════════════════════════════════════════════════

@content_router.get("/courses/{course_id}/analytics")
async def course_analytics(
    course_id: str,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Aggregate learner analytics for a single course.

    Reads the progress/assessment tables that already capture every learner
    interaction and rolls them up into creator-friendly KPIs: enrollment
    funnel, per-lesson drop-off, and quiz performance (incl. hardest
    questions). Read-only — never mutates anything.
    """
    course = await _load_owned_course(session, course_id, current_user)
    cid = course.id
    now = datetime.now(timezone.utc)

    # ── Enrollment overview ──
    enr_rows = (
        await session.execute(
            select(StudentCourseEnrollment).where(StudentCourseEnrollment.course_id == cid)
        )
    ).scalars().all()

    total = len(enr_rows)
    completed = sum(1 for e in enr_rows if e.status == "completed")
    in_progress = sum(1 for e in enr_rows if e.status == "in_progress")
    not_started = sum(1 for e in enr_rows if e.status == "not_started")
    avg_completion = (
        sum(float(e.completion_percent or 0) for e in enr_rows) / total if total else 0.0
    )
    quiz_scores = [float(e.average_quiz_score) for e in enr_rows if e.average_quiz_score is not None]
    avg_quiz_score = sum(quiz_scores) / len(quiz_scores) if quiz_scores else None
    total_time = sum(int(e.total_time_spent_seconds or 0) for e in enr_rows)

    def _active_since(days: int) -> int:
        cutoff = now - timedelta(days=days)
        n = 0
        for e in enr_rows:
            la = e.last_accessed_at
            if la is None:
                continue
            if la.tzinfo is None:
                la = la.replace(tzinfo=timezone.utc)
            if la >= cutoff:
                n += 1
        return n

    overview = {
        "total_enrollments": total,
        "completed": completed,
        "in_progress": in_progress,
        "not_started": not_started,
        "completion_rate": round(completed / total * 100, 1) if total else 0.0,
        "avg_completion_percent": round(avg_completion, 1),
        "avg_quiz_score": round(avg_quiz_score, 1) if avg_quiz_score is not None else None,
        "active_last_7_days": _active_since(7),
        "active_last_30_days": _active_since(30),
        "total_time_spent_hours": round(total_time / 3600, 1),
    }

    # ── Per-lesson funnel (drop-off) ──
    lesson_rows = (
        await session.execute(
            select(Lesson, Module.title, Module.slug)
            .join(Module, Lesson.module_id == Module.id)
            .where(Module.course_id == cid)
            .order_by(Module.sort_order, Lesson.sort_order)
        )
    ).all()

    prog_rows = (
        await session.execute(
            select(
                StudentLessonProgress.lesson_id,
                func.count(StudentLessonProgress.id).label("started"),
                func.sum(
                    case((StudentLessonProgress.status == "completed", 1), else_=0)
                ).label("completed"),
                func.avg(StudentLessonProgress.time_spent_seconds).label("avg_time"),
            )
            .where(StudentLessonProgress.course_id == cid)
            .group_by(StudentLessonProgress.lesson_id)
        )
    ).all()
    prog_by_lesson = {
        r.lesson_id: {
            "started": int(r.started or 0),
            "completed": int(r.completed or 0),
            "avg_time": float(r.avg_time or 0),
        }
        for r in prog_rows
    }

    lessons_funnel = []
    for lesson, module_title, module_slug in lesson_rows:
        p = prog_by_lesson.get(lesson.id, {"started": 0, "completed": 0, "avg_time": 0})
        started = p["started"]
        lessons_funnel.append({
            "lesson_id": lesson.slug,
            "title": lesson.title,
            "module_title": module_title,
            "module_slug": module_slug,
            "started": started,
            "completed": p["completed"],
            "completion_rate": round(p["completed"] / started * 100, 1) if started else 0.0,
            "avg_time_minutes": round(p["avg_time"] / 60, 1),
        })

    # ── Quiz performance ──
    quiz_attempts = (
        await session.execute(
            select(AssessmentAttempt).where(
                and_(
                    AssessmentAttempt.course_id == cid,
                    AssessmentAttempt.assessment_type == "quiz",
                )
            )
        )
    ).scalars().all()
    scored = [a for a in quiz_attempts if a.percentage_score is not None]
    passed_n = sum(1 for a in quiz_attempts if a.passed)
    quiz_overview = {
        "total_attempts": len(quiz_attempts),
        "pass_rate": round(passed_n / len(quiz_attempts) * 100, 1) if quiz_attempts else 0.0,
        "avg_score": round(
            sum(float(a.percentage_score) for a in scored) / len(scored), 1
        ) if scored else None,
        "awaiting_grading": await _grading_queue_count(session, cid),
    }

    # Hardest questions: highest incorrect-answer rate (min 3 answers)
    q_rows = (
        await session.execute(
            select(
                AssessmentAttemptAnswer.question_id,
                func.max(AssessmentAttemptAnswer.prompt_snapshot).label("prompt"),
                func.count(AssessmentAttemptAnswer.id).label("answered"),
                func.sum(
                    case((AssessmentAttemptAnswer.is_correct.is_(True), 1), else_=0)
                ).label("correct"),
            )
            .join(AssessmentAttempt, AssessmentAttemptAnswer.attempt_id == AssessmentAttempt.id)
            .where(AssessmentAttempt.course_id == cid)
            .group_by(AssessmentAttemptAnswer.question_id)
        )
    ).all()
    hardest = []
    for r in q_rows:
        answered = int(r.answered or 0)
        if answered < 3:
            continue
        correct = int(r.correct or 0)
        hardest.append({
            "question_id": r.question_id,
            "prompt": (r.prompt or "")[:160],
            "answered": answered,
            "correct_rate": round(correct / answered * 100, 1),
        })
    hardest.sort(key=lambda x: x["correct_rate"])

    # ── Enrollment trend (last 30 days) ──
    cutoff = now - timedelta(days=30)
    trend_rows = (
        await session.execute(
            select(
                func.date(StudentCourseEnrollment.created_at).label("day"),
                func.count(StudentCourseEnrollment.id).label("n"),
            )
            .where(
                and_(
                    StudentCourseEnrollment.course_id == cid,
                    StudentCourseEnrollment.created_at >= cutoff,
                )
            )
            .group_by(func.date(StudentCourseEnrollment.created_at))
            .order_by(func.date(StudentCourseEnrollment.created_at))
        )
    ).all()
    enrollment_trend = [{"date": str(r.day), "count": int(r.n)} for r in trend_rows]

    return {
        "course": {"id": course.slug, "name": course.name, "status": course.status},
        "overview": overview,
        "lessons_funnel": lessons_funnel,
        "quiz": {**quiz_overview, "hardest_questions": hardest[:10]},
        "enrollment_trend": enrollment_trend,
    }


# ══════════════════════════════════════════════════════════
# PHASE 1b — COURSE CLONE / DUPLICATE
# ══════════════════════════════════════════════════════════

@content_router.post("/courses/{course_id}/clone")
async def clone_course(
    course_id: str,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Deep-copy a course into a brand-new independent draft.

    Unlike `create-draft` (which makes an editable copy *linked* to a
    published parent and overwrites it on re-publish), the clone is a free
    standing new course owned by the current user. Copies modules, lessons,
    per-language content, quizzes/questions and media attachments.
    """
    source = await _load_owned_course(session, course_id, current_user)

    base_slug = f"{source.slug}-copy"
    new_slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

    clone = Course(
        category_id=source.category_id,
        slug=new_slug,
        name=f"{source.name} (Copy)",
        description=source.description,
        tagline=source.tagline,
        icon=source.icon,
        theme_color=source.theme_color,
        difficulty=source.difficulty,
        total_xp=source.total_xp,
        sort_order=source.sort_order,
        status="draft",
        available_languages=source.available_languages,
        tags=source.tags,
        blueprint_json=source.blueprint_json,
        certificate_enabled=source.certificate_enabled,
        certificate_title=source.certificate_title,
        created_by=current_user.get("username", "admin"),
    )
    session.add(clone)
    await session.flush()

    modules = (
        await session.execute(
            select(Module).where(Module.course_id == source.id).order_by(Module.sort_order)
        )
    ).scalars().all()

    for module in modules:
        clone_module = Module(
            course_id=clone.id,
            slug=f"{module.slug}-copy-{uuid.uuid4().hex[:6]}",
            title=module.title,
            description=module.description,
            sort_order=module.sort_order,
            is_active=module.is_active,
            status="draft",
        )
        session.add(clone_module)
        await session.flush()

        lessons = (
            await session.execute(
                select(Lesson).where(Lesson.module_id == module.id).order_by(Lesson.sort_order)
            )
        ).scalars().all()

        for lesson in lessons:
            clone_lesson = Lesson(
                module_id=clone_module.id,
                slug=f"{lesson.slug}-copy-{uuid.uuid4().hex[:6]}",
                title=lesson.title,
                description=lesson.description,
                sort_order=lesson.sort_order,
                level=lesson.level,
                estimated_minutes=lesson.estimated_minutes,
                xp_reward=lesson.xp_reward,
                week=lesson.week,
                day=lesson.day,
                is_weekly_test=lesson.is_weekly_test,
                status="draft",
            )
            session.add(clone_lesson)
            await session.flush()

            for content in (
                await session.execute(
                    select(LessonContent).where(LessonContent.lesson_id == lesson.id)
                )
            ).scalars().all():
                session.add(LessonContent(
                    lesson_id=clone_lesson.id,
                    language=content.language,
                    explanation=content.explanation,
                    explanation_format=content.explanation_format,
                    example=content.example,
                    activity=content.activity,
                    bengali_tip=content.bengali_tip,
                    micro_grammar=content.micro_grammar,
                    speaking_task=content.speaking_task,
                    vocab=content.vocab,
                    dialogue=content.dialogue,
                    sort_order=content.sort_order,
                    translated_by=content.translated_by,
                    status="draft",
                ))

            for quiz in (
                await session.execute(select(Quiz).where(Quiz.lesson_id == lesson.id))
            ).scalars().all():
                clone_quiz = Quiz(
                    lesson_id=clone_lesson.id,
                    title=quiz.title,
                    passing_score=quiz.passing_score,
                    max_attempts=quiz.max_attempts,
                    shuffle_questions=quiz.shuffle_questions,
                    shuffle_options=quiz.shuffle_options,
                    sort_order=quiz.sort_order,
                    status="draft",
                )
                session.add(clone_quiz)
                await session.flush()
                for question in (
                    await session.execute(
                        select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id)
                    )
                ).scalars().all():
                    session.add(QuizQuestion(
                        quiz_id=clone_quiz.id,
                        question_text=question.question_text,
                        question_type=question.question_type,
                        options=question.options,
                        correct_answer=question.correct_answer,
                        feedback=question.feedback,
                        sort_order=question.sort_order,
                    ))

            for asset in (
                await session.execute(
                    select(MediaAsset).where(MediaAsset.lesson_id == lesson.id)
                )
            ).scalars().all():
                session.add(MediaAsset(
                    lesson_id=clone_lesson.id,
                    asset_type=asset.asset_type,
                    cloudinary_url=asset.cloudinary_url,
                    cloudinary_public_id=asset.cloudinary_public_id,
                    original_filename=asset.original_filename,
                    mime_type=asset.mime_type,
                    file_size_bytes=asset.file_size_bytes,
                    alt_text=asset.alt_text,
                    duration_seconds=asset.duration_seconds,
                    width=asset.width,
                    height=asset.height,
                    poster_url=asset.poster_url,
                    streaming_url=asset.streaming_url,
                    upload_status=asset.upload_status,
                    sort_order=asset.sort_order,
                    tags=asset.tags,
                    uploaded_by=asset.uploaded_by,
                    is_highlight=asset.is_highlight,
                ))

    await session.commit()
    return {
        "detail": f"Course '{course_id}' cloned",
        "clone_slug": clone.slug,
        "clone_name": clone.name,
    }


# ══════════════════════════════════════════════════════════
# PHASE 1c — DRAG-AND-DROP REORDERING
# ══════════════════════════════════════════════════════════

class ModuleReorder(BaseModel):
    ordered_ids: list[str]  # module slugs in desired order


class LessonReorderGroup(BaseModel):
    section_id: str          # module slug the lessons belong to after the move
    lesson_ids: list[str]    # lesson slugs in desired order


class LessonReorder(BaseModel):
    sections: list[LessonReorderGroup]


@content_router.put("/courses/{course_id}/sections/reorder")
async def reorder_sections(
    course_id: str,
    payload: ModuleReorder,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Persist a new module order (drag-and-drop). 1-based sort_order."""
    course = await _load_owned_course(session, course_id, current_user)
    _require_draft(course)

    modules = (
        await session.execute(select(Module).where(Module.course_id == course.id))
    ).scalars().all()
    by_slug = {m.slug: m for m in modules}

    unknown = [s for s in payload.ordered_ids if s not in by_slug]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown module(s): {', '.join(unknown)}")

    for idx, slug in enumerate(payload.ordered_ids):
        by_slug[slug].sort_order = idx + 1
    await session.commit()
    return {"detail": "Modules reordered", "count": len(payload.ordered_ids)}


@content_router.put("/courses/{course_id}/lessons/reorder")
async def reorder_lessons(
    course_id: str,
    payload: LessonReorder,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Persist lesson order and cross-module moves in one drag-and-drop save.

    Each group lists the lessons (by slug, in order) that should live under a
    module after the drag. A lesson appearing under a different module than
    before is reparented. All lessons/modules must belong to this course.
    """
    course = await _load_owned_course(session, course_id, current_user)
    _require_draft(course)

    modules = (
        await session.execute(select(Module).where(Module.course_id == course.id))
    ).scalars().all()
    module_by_slug = {m.slug: m for m in modules}
    module_ids = {m.id for m in modules}

    lessons = (
        await session.execute(
            select(Lesson).where(Lesson.module_id.in_(module_ids))
        )
    ).scalars().all()
    lesson_by_slug = {l.slug: l for l in lessons}

    moved = 0
    for group in payload.sections:
        module = module_by_slug.get(group.section_id)
        if not module:
            raise HTTPException(status_code=400, detail=f"Unknown module: {group.section_id}")
        for idx, lslug in enumerate(group.lesson_ids):
            lesson = lesson_by_slug.get(lslug)
            if not lesson:
                raise HTTPException(status_code=400, detail=f"Unknown lesson: {lslug}")
            lesson.module_id = module.id
            lesson.sort_order = idx + 1
            moved += 1
    await session.commit()
    return {"detail": "Lessons reordered", "count": moved}


# ══════════════════════════════════════════════════════════
# PHASE 2a — MANUAL GRADING QUEUE
# ══════════════════════════════════════════════════════════

async def _grading_queue_count(session: AsyncSession, course_id: int) -> int:
    """Number of attempts in a course with ungraded short-answer responses."""
    rows = (
        await session.execute(
            select(func.count(func.distinct(AssessmentAttempt.id)))
            .join(AssessmentAttemptAnswer, AssessmentAttemptAnswer.attempt_id == AssessmentAttempt.id)
            .where(
                and_(
                    AssessmentAttempt.course_id == course_id,
                    AssessmentAttemptAnswer.question_type == "short-answer",
                    AssessmentAttemptAnswer.is_correct.is_(None),
                )
            )
        )
    ).scalar()
    return int(rows or 0)


@content_router.get("/courses/{course_id}/grading-queue")
async def grading_queue(
    course_id: str,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """List attempts with short-answer responses awaiting manual grading."""
    course = await _load_owned_course(session, course_id, current_user)

    # Attempts that still have at least one ungraded short-answer answer.
    attempt_ids = (
        await session.execute(
            select(func.distinct(AssessmentAttempt.id))
            .join(AssessmentAttemptAnswer, AssessmentAttemptAnswer.attempt_id == AssessmentAttempt.id)
            .where(
                and_(
                    AssessmentAttempt.course_id == course.id,
                    AssessmentAttemptAnswer.question_type == "short-answer",
                    AssessmentAttemptAnswer.is_correct.is_(None),
                )
            )
        )
    ).scalars().all()

    out = []
    for aid in attempt_ids:
        attempt = (
            await session.execute(select(AssessmentAttempt).where(AssessmentAttempt.id == aid))
        ).scalars().first()
        if not attempt:
            continue
        student = (
            await session.execute(select(User).where(User.id == attempt.student_user_id))
        ).scalars().first()
        lesson = None
        if attempt.lesson_id:
            lesson = (
                await session.execute(select(Lesson).where(Lesson.id == attempt.lesson_id))
            ).scalars().first()
        answers = (
            await session.execute(
                select(AssessmentAttemptAnswer)
                .where(
                    and_(
                        AssessmentAttemptAnswer.attempt_id == aid,
                        AssessmentAttemptAnswer.question_type == "short-answer",
                    )
                )
            )
        ).scalars().all()
        out.append({
            "attempt_id": attempt.id,
            "student_username": student.username if student else None,
            "lesson_title": lesson.title if lesson else None,
            "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
            "answers": [
                {
                    "answer_id": a.id,
                    "question_id": a.question_id,
                    "prompt": a.prompt_snapshot,
                    "student_answer": a.student_answer_text,
                    "max_score": float(a.max_score) if a.max_score is not None else 1.0,
                    "score_awarded": float(a.score_awarded) if a.score_awarded is not None else None,
                    "is_graded": a.is_correct is not None,
                }
                for a in answers
            ],
        })
    return {"course": {"id": course.slug, "name": course.name}, "queue": out, "count": len(out)}


class GradedAnswer(BaseModel):
    answer_id: int
    score_awarded: float
    is_correct: bool
    feedback: Optional[str] = None


class GradeAttemptPayload(BaseModel):
    answers: list[GradedAnswer]
    feedback_summary: Optional[str] = None


@content_router.post("/attempts/{attempt_id}/grade")
async def grade_attempt(
    attempt_id: int,
    payload: GradeAttemptPayload,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Apply manual grades to short-answer answers and finalise the attempt.

    Recomputes the attempt's raw/percentage score from all of its answers and
    marks it teacher-graded. `passed` is derived from the quiz's passing
    score when available.
    """
    attempt = (
        await session.execute(select(AssessmentAttempt).where(AssessmentAttempt.id == attempt_id))
    ).scalars().first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    # Ownership: the attempt's course must belong to this creator (or admin).
    await _load_owned_course(
        session,
        (await session.execute(select(Course.slug).where(Course.id == attempt.course_id))).scalar_one(),
        current_user,
    )

    graded_by_slug = {g.answer_id: g for g in payload.answers}
    answers = (
        await session.execute(
            select(AssessmentAttemptAnswer).where(AssessmentAttemptAnswer.attempt_id == attempt_id)
        )
    ).scalars().all()

    for ans in answers:
        g = graded_by_slug.get(ans.id)
        if g is None:
            continue
        ans.is_correct = g.is_correct
        ans.score_awarded = g.score_awarded
        if g.feedback is not None:
            ans.feedback = g.feedback

    # Recompute totals across every answer in the attempt.
    raw = sum(float(a.score_awarded) for a in answers if a.score_awarded is not None)
    max_total = sum(
        float(a.max_score) if a.max_score is not None else 1.0 for a in answers
    )
    percentage = (raw / max_total * 100) if max_total > 0 else 0.0

    passed = True
    if attempt.assessment_type == "quiz":
        quiz = (
            await session.execute(select(Quiz).where(Quiz.id == attempt.assessment_id))
        ).scalars().first()
        threshold = quiz.passing_score if quiz and quiz.passing_score is not None else 70
        passed = percentage >= threshold

    attempt.raw_score = raw
    attempt.max_score = max_total
    attempt.percentage_score = percentage
    attempt.passed = passed
    attempt.status = "graded"
    attempt.grader_type = "teacher"
    attempt.graded_by_user_id = current_user.get("id")
    attempt.graded_at = datetime.now(timezone.utc)
    if payload.feedback_summary is not None:
        attempt.feedback_summary = payload.feedback_summary

    await session.commit()
    return {
        "detail": "Attempt graded",
        "attempt_id": attempt_id,
        "percentage_score": round(percentage, 1),
        "passed": passed,
    }


# ══════════════════════════════════════════════════════════
# PHASE 2b — CERTIFICATES (creator config + records)
# ══════════════════════════════════════════════════════════

class CertificateConfig(BaseModel):
    certificate_enabled: bool
    certificate_title: Optional[str] = None


@content_router.put("/courses/{course_id}/certificate")
async def update_certificate_config(
    course_id: str,
    payload: CertificateConfig,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Toggle completion certificates for a course and set the title."""
    course = await _load_owned_course(session, course_id, current_user)
    course.certificate_enabled = payload.certificate_enabled
    if payload.certificate_title is not None:
        course.certificate_title = payload.certificate_title.strip() or None
    course.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return {
        "detail": "Certificate settings updated",
        "certificate_enabled": course.certificate_enabled,
        "certificate_title": course.certificate_title,
    }


@content_router.get("/courses/{course_id}/certificates")
async def list_course_certificates(
    course_id: str,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """List certificates issued for a course."""
    course = await _load_owned_course(session, course_id, current_user)
    certs = (
        await session.execute(
            select(Certificate)
            .where(Certificate.course_id == course.id)
            .order_by(Certificate.issued_at.desc())
        )
    ).scalars().all()
    return {
        "course": {"id": course.slug, "name": course.name, "certificate_enabled": course.certificate_enabled},
        "certificates": [c.to_dict() for c in certs],
    }


@content_router.post("/certificates/{serial}/revoke")
async def revoke_certificate(
    serial: str,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Revoke (or un-revoke) an issued certificate."""
    cert = (
        await session.execute(select(Certificate).where(Certificate.serial == serial))
    ).scalars().first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    # Ownership check via the certificate's course.
    course_slug = (
        await session.execute(select(Course.slug).where(Course.id == cert.course_id))
    ).scalar_one()
    await _load_owned_course(session, course_slug, current_user)
    cert.revoked = not cert.revoked
    await session.commit()
    return {"detail": "Certificate updated", "serial": serial, "revoked": cert.revoked}


# ══════════════════════════════════════════════════════════
# PHASE 2c — ANNOUNCEMENTS (creator CRUD)
# ══════════════════════════════════════════════════════════

class AnnouncementPayload(BaseModel):
    title: str
    body: str
    is_published: bool = True
    pinned: bool = False


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    is_published: Optional[bool] = None
    pinned: Optional[bool] = None


@content_router.get("/courses/{course_id}/announcements")
async def list_announcements_admin(
    course_id: str,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """List all announcements (drafts included) for a course."""
    course = await _load_owned_course(session, course_id, current_user)
    rows = (
        await session.execute(
            select(Announcement)
            .where(Announcement.course_id == course.id)
            .order_by(Announcement.pinned.desc(), Announcement.created_at.desc())
        )
    ).scalars().all()
    return [a.to_dict() for a in rows]


@content_router.post("/courses/{course_id}/announcements")
async def create_announcement(
    course_id: str,
    payload: AnnouncementPayload,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Create a course announcement."""
    course = await _load_owned_course(session, course_id, current_user)
    if not payload.title.strip() or not payload.body.strip():
        raise HTTPException(status_code=400, detail="Title and body are required")
    ann = Announcement(
        course_id=course.id,
        title=payload.title.strip(),
        body=payload.body.strip(),
        is_published=payload.is_published,
        pinned=payload.pinned,
        created_by=current_user.get("username"),
    )
    session.add(ann)
    await session.commit()
    await session.refresh(ann)
    return ann.to_dict()


@content_router.put("/announcements/{announcement_id}")
async def update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdate,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Edit an announcement."""
    ann = (
        await session.execute(select(Announcement).where(Announcement.id == announcement_id))
    ).scalars().first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    course_slug = (
        await session.execute(select(Course.slug).where(Course.id == ann.course_id))
    ).scalar_one()
    await _load_owned_course(session, course_slug, current_user)

    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    for k, v in data.items():
        setattr(ann, k, v.strip() if isinstance(v, str) else v)
    ann.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return ann.to_dict()


@content_router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: int,
    current_user: dict = Depends(get_current_creator),
    session: AsyncSession = Depends(get_db),
):
    """Delete an announcement."""
    ann = (
        await session.execute(select(Announcement).where(Announcement.id == announcement_id))
    ).scalars().first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    course_slug = (
        await session.execute(select(Course.slug).where(Course.id == ann.course_id))
    ).scalar_one()
    await _load_owned_course(session, course_slug, current_user)
    await session.delete(ann)
    await session.commit()
    return {"detail": "Announcement deleted"}


# ══════════════════════════════════════════════════════════
# LEARNER / PUBLIC ENDPOINTS
# ══════════════════════════════════════════════════════════

@learner_router.get("/courses/{course_id}/announcements")
async def list_announcements_learner(
    course_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Published announcements for a course, shown to logged-in learners."""
    course = (
        await session.execute(select(Course).where(Course.slug == course_id))
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    rows = (
        await session.execute(
            select(Announcement)
            .where(
                and_(
                    Announcement.course_id == course.id,
                    Announcement.is_published.is_(True),
                )
            )
            .order_by(Announcement.pinned.desc(), Announcement.created_at.desc())
        )
    ).scalars().all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "body": a.body,
            "pinned": a.pinned,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in rows
    ]


@learner_router.get("/certificates/me")
async def my_certificates(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """All (non-revoked) certificates earned by the current user."""
    rows = (
        await session.execute(
            select(Certificate, Course.slug)
            .join(Course, Certificate.course_id == Course.id)
            .where(
                and_(
                    Certificate.student_user_id == current_user.get("id"),
                    Certificate.revoked.is_(False),
                )
            )
            .order_by(Certificate.issued_at.desc())
        )
    ).all()
    out = []
    for cert, course_slug in rows:
        d = cert.to_dict()
        d["course_slug"] = course_slug
        out.append(d)
    return out


@learner_router.get("/certificates/verify/{serial}")
async def verify_certificate(
    serial: str,
    session: AsyncSession = Depends(get_db),
):
    """Public certificate verification by serial. No auth required."""
    cert = (
        await session.execute(select(Certificate).where(Certificate.serial == serial))
    ).scalars().first()
    if not cert:
        return {"valid": False, "detail": "Certificate not found"}
    return {
        "valid": not cert.revoked,
        "revoked": cert.revoked,
        "serial": cert.serial,
        "student_name": cert.student_name_snapshot,
        "course_name": cert.course_name_snapshot,
        "title": cert.title,
        "completion_percent": float(cert.completion_percent) if cert.completion_percent is not None else None,
        "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
    }
