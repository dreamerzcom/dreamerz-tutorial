/**
 * SampleLesson — public preview of one real lesson from a published course,
 * linked from the "See a sample lesson" CTA on the marketing landing page.
 *
 * The course slug is hard-coded because this is a single curated marketing
 * surface, not a generic preview tool. If we ever want multiple samples
 * (per-category landing pages, A/B variants), lift it to site config — for
 * now, keeping it inline avoids a config layer that exists for one slug.
 *
 * Why a dedicated page (and not the existing /learn/:cat/:tool route in
 * previewMode):
 *  - That route is wrapped in RequireTrialActive, which bounces anonymous
 *    visitors to /login — so the marketing-funnel intent ("try it before
 *    signing up") can't pass through it.
 *  - We want the *first* lesson on its own, not the whole sidebar of
 *    locked lessons. Progression actions (Next, Quiz, Lab) all funnel to
 *    /register, not to silent in-memory state.
 *  - Backend `/api/content/courses/{id}` is already public, so we just
 *    fetch and render without touching auth gates.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  Lock,
  Sparkles,
  UserPlus,
} from 'lucide-react';

import { MarkdownContent } from '../components/MarkdownContent';
import { ModuleHeroVideo } from '../components/ModuleHeroVideo';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';

const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');

// The one course this landing CTA points to. The d9b685 suffix is part of
// the live published slug (business-setup category) — don't trim it.
const SAMPLE_COURSE_SLUG = 'startup-studio-d9b685';
const SAMPLE_COURSE_HREF = `/learn/business-setup/${SAMPLE_COURSE_SLUG}`;

/** Find the first highlighted media asset on a lesson, or the first video
 *  asset if nothing is explicitly flagged. Same logic JourneyPlayer uses
 *  to pick the lesson-level hero video, kept aligned so the sample feels
 *  identical to the real player.
 */
const pickHeroAsset = (lesson) => {
  if (!lesson || !Array.isArray(lesson.media_assets)) return null;
  const highlighted = lesson.media_assets.find((a) => a.is_highlight);
  if (highlighted) return highlighted;
  return lesson.media_assets.find(
    (a) => (a.asset_type || a.type) === 'video' || a.mime_type?.startsWith('video/'),
  ) || null;
};

const flattenLessons = (course) => {
  if (!course) return [];
  if (Array.isArray(course.sections)) {
    return course.sections.flatMap((s) => s.lessons || []);
  }
  return course.modules || [];
};

/** Single "Sign in to continue" CTA — used for every progression action so
 *  the message is consistent and the visitor always lands on /register. */
const SignInGate = ({ label = 'Sign in to continue', compact = false }) => (
  <Link
    to="/register"
    state={{ from: { pathname: SAMPLE_COURSE_HREF } }}
    className={`inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 text-white font-semibold shadow-lg shadow-primary/30 hover:from-primary/90 hover:to-violet-700 transition-colors ${
      compact ? 'px-4 py-2 text-sm' : 'px-6 py-3 text-base'
    }`}
    data-testid="sample-signin-cta"
  >
    <UserPlus className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
    {label}
  </Link>
);

export const SampleLesson = () => {
  const [course, setCourse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const fetchSample = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const langParam = language && language !== 'en' ? `?lang=${language}` : '';
        const res = await fetch(
          `${API_BASE}/api/content/courses/${SAMPLE_COURSE_SLUG}${langParam}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || 'Sample lesson is not available right now.');
        }
        const data = await res.json();
        if (!cancelled) setCourse(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchSample();
    return () => {
      cancelled = true;
    };
  }, [language]);

  const lessons = useMemo(() => flattenLessons(course), [course]);
  const firstLesson = lessons[0] || null;
  const restLessons = lessons.slice(1);

  const heroAsset = useMemo(() => pickHeroAsset(firstLesson), [firstLesson]);
  // Section-level hero falls back to the first section's module video when
  // the lesson itself has no highlighted media — same priority order as
  // JourneyPlayer so the sample matches a real first-lesson view.
  const sectionHero = useMemo(() => {
    if (heroAsset) return null;
    if (!Array.isArray(course?.sections) || !course.sections.length) return null;
    const first = course.sections[0];
    return first?.hero_video || null;
  }, [course, heroAsset]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !course || !firstLesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Sample unavailable
          </h2>
          <p className="text-sm text-slate-600 mb-5">
            {error || "We couldn't load the sample lesson right now."}
          </p>
          <Link
            to="/home"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const explanation = firstLesson.content?.explanation || '';
  const example = firstLesson.content?.example || '';
  const heroVideoUrl =
    heroAsset?.streaming_url
    || heroAsset?.cloudinary_url
    || sectionHero?.streaming_url
    || sectionHero?.cloudinary_url
    || null;
  const heroPoster = heroAsset?.poster_url || sectionHero?.poster_url || null;
  const heroDuration =
    heroAsset?.duration_seconds || sectionHero?.duration_seconds || null;
  const heroTitle = heroAsset?.original_filename || firstLesson.title;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Sample banner — only shown to anonymous visitors. A signed-in
          learner who lands here (e.g. via a deep link) sees the same
          preview content but with a softer prompt to head into the real
          player instead of registering again. */}
      <div className="bg-gradient-to-r from-primary to-violet-600 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            {isAuthenticated
              ? "You're viewing the public sample of this course."
              : "Sample lesson — sign in to track progress, earn XP, and unlock the rest."}
          </p>
          {isAuthenticated ? (
            <Link
              to={SAMPLE_COURSE_HREF}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 inline-flex items-center gap-1"
            >
              Open the full course <ChevronRight className="w-3 h-3" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25"
            >
              Already have an account? Sign in
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 lg:py-10">
        {/* Course identity */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: `${course.theme?.color || '#6366f1'}20` }}
          >
            {course.icon || '📚'}
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
              Sample lesson
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
              {course.name}
            </h1>
          </div>
        </div>

        {/* Lesson card — mirrors the JourneyPlayer layout, minus the
            navigation chrome (sidebar, tab bar, Next/Prev). Anything that
            would normally drive progression is replaced by a sign-in CTA. */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-7 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">
              {firstLesson.title}
            </h2>
            {firstLesson.sectionTitle && (
              <p className="mt-1 text-sm font-medium text-slate-500 truncate">
                {firstLesson.sectionTitle}
              </p>
            )}
          </div>

          <div className="p-5 sm:p-7 space-y-6">
            {/* Hero video — the whole reason this page exists. */}
            {heroVideoUrl ? (
              <ModuleHeroVideo
                videoUrl={heroVideoUrl}
                posterUrl={heroPoster}
                title={heroTitle}
                durationSec={heroDuration}
                subtitle="Watch the intro"
              />
            ) : (
              <div className="rounded-xl bg-slate-100 border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Sample video isn't attached yet — the rest of the lesson is below.
              </div>
            )}

            {/* Learn content */}
            {explanation && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg break-words">
                    Learn the Concept
                  </h3>
                </div>
                <div className="prose prose-sm sm:prose prose-slate max-w-none overflow-x-hidden">
                  <MarkdownContent variant="light">{explanation}</MarkdownContent>
                </div>
              </div>
            )}

            {/* Example block — the second-most-watched section. Kept in the
                preview because it makes the lesson feel real, not stub. */}
            {example && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg break-words">
                    See It In Action
                  </h3>
                </div>
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 sm:p-5 overflow-x-hidden">
                  <MarkdownContent variant="dark">{example}</MarkdownContent>
                </div>
              </div>
            )}
          </div>

          {/* Footer CTA — replaces Prev/Quiz/Next. For anonymous visitors
              this is the only forward path; for signed-in viewers we
              point them to the real player so they keep their progress. */}
          <div className="p-5 sm:p-7 border-t border-slate-100 bg-slate-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  {isAuthenticated
                    ? "Pick up where the sample ends."
                    : "Want the next lesson, quiz, and Lab?"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAuthenticated
                    ? "Open the full course to track progress and earn XP."
                    : "Create a free account — 30-day trial, no card needed."}
                </p>
              </div>
              {isAuthenticated ? (
                <Link
                  to={SAMPLE_COURSE_HREF}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30"
                >
                  Open course
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <SignInGate label="Create free account" />
              )}
            </div>
          </div>
        </div>

        {/* Locked lesson list — gives the visitor a sense of scope without
            opening anything. Each row is a sign-in trigger so the entire
            section funnels into /register. */}
        {restLessons.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs uppercase tracking-wide font-bold text-slate-500 mb-3">
              {restLessons.length} more lesson{restLessons.length === 1 ? '' : 's'} in this course
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
              {restLessons.slice(0, 8).map((lesson, i) => (
                <Link
                  key={lesson.id || i}
                  to="/register"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate group-hover:text-slate-900">
                      {lesson.title}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 group-hover:text-primary flex-shrink-0">
                    Sign in to unlock
                  </span>
                </Link>
              ))}
              {restLessons.length > 8 && (
                <div className="px-4 py-3 text-xs text-slate-500 text-center">
                  + {restLessons.length - 8} more — sign in to see them all.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Why-sign-up panel + bottom CTA. Anonymous-only — signed-in users
            already have the access this panel sells. */}
        {!isAuthenticated && (
          <div className="mt-10 bg-gradient-to-br from-primary/5 to-violet-50 border border-primary/10 rounded-2xl p-6 sm:p-8 text-center">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              Liked what you saw?
            </h3>
            <p className="text-sm text-slate-600 mb-5 max-w-md mx-auto">
              Sign in to take the quiz, try the Lab, and unlock every lesson — plus
              earn XP and build a streak you can show your supervisor.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <SignInGate label="Create free account" />
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                I already have an account
              </Link>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              30-day free trial · No credit card · Cancel anytime
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SampleLesson;
