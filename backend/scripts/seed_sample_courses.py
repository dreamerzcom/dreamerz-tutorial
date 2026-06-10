"""
Seed the local SQLite database with TWO fully-featured sample courses.

Unlike ``seed_local.py`` (which DROPS every table and reseeds the bundled
curriculum), this script is **additive and idempotent** — it leaves existing
data untouched and skips courses whose slug already exists. It populates the
newer creator features too (pricing, coupons, sales pages, drip, free preview,
certificates) and creates a sample learner enrolment with progress + a paid
order, so the Analytics / Dashboard / Learners / Pricing tabs show real data.

Usage:
    cd backend && python scripts/seed_sample_courses.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone

# Make the backend package importable and default to local SQLite.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./dreamerz.db")

from sqlalchemy import select  # noqa: E402

from database import async_session, engine  # noqa: E402
from models.sql_models import (  # noqa: E402
    Category, Course, Module, Lesson, LessonContent, Quiz, QuizQuestion,
    User, Coupon, Order, StudentCourseEnrollment, StudentLessonProgress,
    AssessmentAttempt,
)
from services import progress_service  # noqa: E402


async def _get_or_create_category(s, slug, name):
    cat = (await s.execute(select(Category).where(Category.slug == slug))).scalars().first()
    if not cat:
        cat = Category(slug=slug, name=name, description=name)
        s.add(cat)
        await s.flush()
    return cat


async def _build_course(s, spec, created_by):
    """Create one course from a plain-dict spec. Returns the Course or None
    when a course with that slug already exists (idempotent skip)."""
    existing = (await s.execute(select(Course).where(Course.slug == spec["slug"]))).scalars().first()
    if existing:
        print(f"  • Course '{spec['slug']}' already exists — skipped.")
        return None

    cat = await _get_or_create_category(s, spec["category_slug"], spec["category_name"])
    course = Course(
        category_id=cat.id,
        slug=spec["slug"],
        name=spec["name"],
        description=spec["description"],
        tagline=spec["tagline"],
        difficulty=spec["difficulty"],
        total_xp=spec["total_xp"],
        status="published",
        available_languages=["en"],
        tags={"tags": ["sample"]},
        is_free=spec["is_free"],
        price=spec["price"],
        currency=spec["currency"],
        sales_page=spec["sales_page"],
        certificate_enabled=spec["certificate_enabled"],
        certificate_title=spec.get("certificate_title"),
        completion_rule=spec["completion_rule"],
        drip_enabled=spec["drip_enabled"],
        drip_type=spec["drip_type"],
        created_by=created_by,
    )
    s.add(course)
    await s.flush()

    for m_i, mod_spec in enumerate(spec["modules"], start=1):
        module = Module(
            course_id=course.id,
            slug=f"{spec['slug']}-m{m_i}",
            title=mod_spec["title"],
            description=mod_spec.get("description", ""),
            sort_order=m_i,
            status="published",
        )
        s.add(module)
        await s.flush()

        for l_i, les_spec in enumerate(mod_spec["lessons"], start=1):
            lesson = Lesson(
                module_id=module.id,
                slug=f"{spec['slug']}-m{m_i}-l{l_i}",
                title=les_spec["title"],
                description=les_spec.get("description", ""),
                sort_order=l_i,
                level=les_spec.get("level", "beginner"),
                estimated_minutes=les_spec.get("minutes", 10),
                xp_reward=les_spec.get("xp", 100),
                status="published",
                is_free_preview=les_spec.get("free_preview", False),
                drip_days=les_spec.get("drip_days"),
            )
            s.add(lesson)
            await s.flush()

            s.add(LessonContent(
                lesson_id=lesson.id,
                language="en",
                explanation=les_spec.get("explanation", ""),
                example=les_spec.get("example", ""),
                activity=les_spec.get("activity", ""),
                status="published",
            ))

            quiz_spec = les_spec.get("quiz")
            if quiz_spec:
                quiz = Quiz(
                    lesson_id=lesson.id,
                    title=quiz_spec["title"],
                    passing_score=quiz_spec.get("passing_score", 70),
                    status="published",
                )
                s.add(quiz)
                await s.flush()
                for q_i, q in enumerate(quiz_spec["questions"], start=1):
                    s.add(QuizQuestion(
                        quiz_id=quiz.id,
                        question_text=q["text"],
                        question_type=q.get("type", "mcq"),
                        options=q.get("options"),
                        correct_answer=str(q["correct"]),
                        sort_order=q_i,
                    ))

    print(f"  ✓ Created course '{course.name}' ({course.slug})")
    return course


# ── Sample course specs ──────────────────────────────────────────────

SAMPLE_COURSES = [
    {
        "slug": "sample-spoken-english-foundations",
        "name": "Spoken English Foundations",
        "tagline": "Speak confidently in everyday situations.",
        "description": "A beginner-friendly course to build everyday spoken English fluency.",
        "category_slug": "spoken-writing-english",
        "category_name": "Conversational English",
        "difficulty": "beginner",
        "total_xp": 500,
        "is_free": True,
        "price": 0,
        "currency": "USD",
        "certificate_enabled": True,
        "certificate_title": "Certificate of Completion — Spoken English Foundations",
        "completion_rule": "all_lessons",
        "drip_enabled": False,
        "drip_type": "none",
        "sales_page": {
            "headline": "Speak English with confidence in 4 weeks",
            "subheadline": "Practical, everyday conversation skills — no grammar drills.",
            "outcomes": ["Introduce yourself naturally", "Order food and shop", "Handle small talk", "Ask for directions"],
            "instructor_bio": "Taught by a friendly conversation coach with 10+ years of experience.",
            "cta_label": "Start learning free",
            "faqs": [{"q": "Do I need any prior English?", "a": "No — this starts from the basics."}],
            "testimonials": [{"name": "Riya", "quote": "I finally stopped freezing in conversations!"}],
        },
        "modules": [
            {
                "title": "Getting Started",
                "lessons": [
                    {
                        "title": "Greetings & Introductions",
                        "free_preview": True,
                        "explanation": "Learn common greetings and how to introduce yourself.",
                        "example": "Hi, I'm Sam. Nice to meet you!",
                        "activity": "Record a 20-second self-introduction.",
                        "quiz": {
                            "title": "Greetings quiz",
                            "questions": [
                                {"text": "Which is a greeting?", "options": ["Goodbye", "Hello", "Maybe"], "correct": 1},
                                {"text": "'Nice to meet you' is used when…", "options": ["Leaving", "Meeting someone new", "Eating"], "correct": 1},
                            ],
                        },
                    },
                    {
                        "title": "Talking About Yourself",
                        "explanation": "Describe your job, hobbies and family.",
                        "example": "I work as a designer and I love hiking.",
                        "activity": "Write 3 sentences about your hobbies.",
                    },
                ],
            },
            {
                "title": "Everyday Conversations",
                "lessons": [
                    {
                        "title": "At the Restaurant",
                        "explanation": "Order food and ask about the menu.",
                        "example": "Could I have the soup, please?",
                        "activity": "Role-play ordering a meal.",
                        "quiz": {
                            "title": "Restaurant quiz",
                            "questions": [
                                {"text": "How do you politely order?", "options": ["Give me food", "Could I have…, please?", "Food now"], "correct": 1},
                            ],
                        },
                    },
                ],
            },
        ],
    },
    {
        "slug": "sample-prompt-engineering-claude",
        "name": "Prompt Engineering with Claude",
        "tagline": "Get reliably great results from AI.",
        "description": "Learn to design effective prompts and build with Claude.",
        "category_slug": "ai-learning",
        "category_name": "AI Learning",
        "difficulty": "intermediate",
        "total_xp": 800,
        "is_free": False,
        "price": 49.00,
        "currency": "USD",
        "certificate_enabled": True,
        "certificate_title": "Certificate of Completion — Prompt Engineering with Claude",
        "completion_rule": "all_lessons_and_quizzes",
        "drip_enabled": True,
        "drip_type": "sequential",
        "sales_page": {
            "headline": "Master prompt engineering with Claude",
            "subheadline": "From first prompt to production-grade AI workflows.",
            "outcomes": ["Write clear, structured prompts", "Use system prompts & roles", "Chain prompts for complex tasks", "Evaluate and iterate"],
            "instructor_bio": "Built by an AI engineer shipping LLM features in production.",
            "cta_label": "Enroll now",
            "faqs": [{"q": "Is this hands-on?", "a": "Yes — every lesson has a practice activity."}],
            "testimonials": [{"name": "Arjun", "quote": "My prompts went from hit-or-miss to reliable."}],
        },
        "modules": [
            {
                "title": "Prompt Foundations",
                "lessons": [
                    {
                        "title": "Anatomy of a Great Prompt",
                        "free_preview": True,
                        "explanation": "Context, instruction, examples, and output format.",
                        "example": "You are a helpful editor. Rewrite the text below to be concise.",
                        "activity": "Rewrite a vague prompt to be specific.",
                        "quiz": {
                            "title": "Foundations quiz",
                            "questions": [
                                {"text": "A good prompt usually includes…", "options": ["Only a question", "Context + clear instruction", "Random words"], "correct": 1},
                            ],
                        },
                    },
                    {
                        "title": "System Prompts & Roles",
                        "explanation": "Steer behavior with a system prompt and clear role.",
                        "example": "System: You are a meticulous code reviewer.",
                        "activity": "Write a system prompt for a tutoring assistant.",
                        "drip_days": 2,
                    },
                ],
            },
            {
                "title": "Advanced Techniques",
                "lessons": [
                    {
                        "title": "Prompt Chaining",
                        "explanation": "Break complex tasks into chained steps.",
                        "example": "Step 1: outline. Step 2: expand each section.",
                        "activity": "Design a 2-step chain for writing a blog post.",
                        "drip_days": 5,
                        "quiz": {
                            "title": "Chaining quiz",
                            "questions": [
                                {"text": "Chaining helps because…", "options": ["It's slower", "It breaks complexity into steps", "It uses more words"], "correct": 1},
                            ],
                        },
                    },
                ],
            },
        ],
    },
]


async def _seed_engagement(s, course_a, course_b, learner):
    """Enrol the sample learner so dashboards/analytics/roster have data."""
    if not learner:
        print("  • No learner user found — skipping enrolment seeding.")
        return

    # Free course A: enrol + complete the first lesson + a passed quiz attempt.
    if course_a:
        first_lesson = (
            await s.execute(
                select(Lesson).join(Module, Lesson.module_id == Module.id)
                .where(Module.course_id == course_a.id).order_by(Module.sort_order, Lesson.sort_order)
            )
        ).scalars().first()
        await progress_service.start_course_enrollment(learner.id, course_a.id, s)
        if first_lesson:
            s.add(StudentLessonProgress(
                student_user_id=learner.id, course_id=course_a.id,
                module_id=first_lesson.module_id, lesson_id=first_lesson.id,
                status="completed", time_spent_seconds=420, visit_count=2,
            ))
            quiz = (await s.execute(select(Quiz).where(Quiz.lesson_id == first_lesson.id))).scalars().first()
            if quiz:
                s.add(AssessmentAttempt(
                    student_user_id=learner.id, course_id=course_a.id,
                    module_id=first_lesson.module_id, lesson_id=first_lesson.id,
                    assessment_type="quiz", assessment_id=quiz.id, attempt_number=1,
                    status="graded", percentage_score=90, passed=True,
                    submitted_at=datetime.now(timezone.utc),
                ))
        await s.flush()
        await progress_service._sync_enrollment_counters(s, learner.id, course_a.id)
        print("  ✓ Enrolled learner in the free course with progress + a passed quiz.")

    # Paid course B: record a paid order + enrol (revenue shows on dashboard).
    if course_b:
        existing_order = (
            await s.execute(
                select(Order).where(Order.student_user_id == learner.id, Order.course_id == course_b.id)
            )
        ).scalars().first()
        if not existing_order:
            s.add(Order(
                student_user_id=learner.id, course_id=course_b.id,
                list_price=float(course_b.price), amount=float(course_b.price),
                currency=course_b.currency, status="paid", payment_provider="mock",
                provider_ref="seed_paid_order", paid_at=datetime.now(timezone.utc),
            ))
        await progress_service.start_course_enrollment(learner.id, course_b.id, s)
        await s.flush()
        await progress_service._sync_enrollment_counters(s, learner.id, course_b.id)
        print("  ✓ Enrolled learner in the paid course with a paid order ($49 revenue).")


async def main():
    print(f"Database: {os.environ['DATABASE_URL']}\n")
    async with async_session() as s:
        creator = (await s.execute(select(User).where(User.username == "creator"))).scalars().first()
        learner = (await s.execute(select(User).where(User.role == "learner"))).scalars().first()
        created_by = creator.username if creator else "admin"
        print(f"Courses will be owned by: {created_by}\n")

        course_a = await _build_course(s, SAMPLE_COURSES[0], created_by)
        course_b = await _build_course(s, SAMPLE_COURSES[1], created_by)
        await s.commit()

        # Coupon on the paid course (idempotent).
        if course_b:
            exists = (
                await s.execute(select(Coupon).where(Coupon.course_id == course_b.id, Coupon.code == "LAUNCH20"))
            ).scalars().first()
            if not exists:
                s.add(Coupon(
                    course_id=course_b.id, code="LAUNCH20", discount_type="percent",
                    discount_value=20, max_redemptions=100, is_active=True, created_by=created_by,
                ))
                await s.commit()
                print("  ✓ Added coupon LAUNCH20 (20% off) to the paid course.")

        await _seed_engagement(s, course_a, course_b, learner)
        await s.commit()

    await engine.dispose()
    print("\nDone. Log in as 'creator' (or admin) → Content Management to see the courses.")


if __name__ == "__main__":
    asyncio.run(main())
