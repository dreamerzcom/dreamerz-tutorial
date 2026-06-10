import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, ChevronDown, ChevronRight, Trash2, Edit3, Save, X,
  BookOpen, Eye, GraduationCap, RefreshCw, AlertTriangle, CheckCircle2,
  FolderPlus, FilePlus, Info, BarChart3, Megaphone, Award, ClipboardCheck,
  Copy, GripVertical, Wrench, DollarSign, Users, CalendarClock,
} from 'lucide-react';
import { LessonEditor } from './LessonEditor';
import { JourneyPlayer } from '../../components/JourneyPlayer';
import { publishedCourseToLearnerTool } from './publishedCourseAdapter';
import { CourseAnalytics } from './CourseAnalytics';
import { CourseAnnouncements } from './CourseAnnouncements';
import { CertificateSettings } from './CertificateSettings';
import { GradingQueue } from './GradingQueue';
import { CoursePricing } from './CoursePricing';
import { CourseLearners } from './CourseLearners';
import { CourseDelivery } from './CourseDelivery';
import { formatErrorDetail } from '../../lib/utils';

const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');

const adminFetch = async (path, token, options = {}) => {
  const res = await fetch(`${API_BASE}/api/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatErrorDetail(err.detail) || `Request failed (${res.status})`);
  }
  return res.json();
};

export const CourseDetail = ({ courseId, token, onBack, onCourseDeleted, onNavigateToDraft }) => {
  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [lessonsBySection, setLessonsBySection] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [expandedSections, setExpandedSections] = useState(new Set());
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);

  // Reset lesson/section selection whenever the course being viewed changes
  // (e.g. after creating a draft and navigating to it). Without this, the
  // previously-selected lesson slug from the old course would leak into the
  // new course context and edits would target the wrong lesson.
  useEffect(() => {
    setSelectedLessonId(null);
    setExpandedSections(new Set());
    setInitialLoad(true);
  }, [courseId]);

  // Draft version creation state
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [cloning, setCloning] = useState(false);

  // Top-level tab: builder | analytics | announcements | certificate | grading
  const [mainTab, setMainTab] = useState('builder');

  // Drag-and-drop reorder state
  const [dragModuleId, setDragModuleId] = useState(null);
  const [dragLesson, setDragLesson] = useState(null); // { lessonId, fromSectionId }

  // Preview mode: creator | learner
  const [previewMode, setPreviewMode] = useState('creator');

  // Inline add module state
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  // Inline add lesson state { sectionId, title }
  const [addingLessonFor, setAddingLessonFor] = useState(null);
  const [newLessonTitle, setNewLessonTitle] = useState('');

  // Inline rename
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');

  // Delete confirmations
  const [confirmDelete, setConfirmDelete] = useState(null); // { type, id }

  // Publishing state
  const [publishing, setPublishing] = useState(false);
  const [publishedOverlay, setPublishedOverlay] = useState(false);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const loadCourseData = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError('');
    try {
      const [courseData, sectionsData, lessonsData] = await Promise.all([
        adminFetch(`/courses/${courseId}`, token),
        adminFetch(`/courses/${courseId}/sections`, token),
        adminFetch(`/courses/${courseId}/lessons`, token),
      ]);
      setCourse(courseData);
      setSections(sectionsData);

      // Group lessons by section
      const byS = {};
      sectionsData.forEach(s => { byS[s.id] = []; });
      lessonsData.forEach(l => {
        if (l.section_id && byS[l.section_id] !== undefined) {
          byS[l.section_id].push(l);
        }
      });
      // Sort lessons by sort_order
      Object.keys(byS).forEach(sid => {
        byS[sid].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });
      setLessonsBySection(byS);

      // Auto-expand first section and select first lesson only on initial load
      if (initialLoad) {
        if (sectionsData.length > 0 && expandedSections.size === 0) {
          setExpandedSections(new Set([sectionsData[0].id]));
        }
        if (!selectedLessonId && lessonsData.length > 0) {
          setSelectedLessonId(lessonsData[0].id);
        }
        setInitialLoad(false);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, token, initialLoad, selectedLessonId, expandedSections]);

  useEffect(() => { loadCourseData(); }, [loadCourseData]);

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections(s => {
      const n = new Set(s);
      n.has(sectionId) ? n.delete(sectionId) : n.add(sectionId);
      return n;
    });
  };

  // ── Add Module ──
  const createModule = async () => {
    if (!newModuleTitle.trim()) return;
    try {
      const newSection = await adminFetch(`/courses/${courseId}/sections`, token, {
        method: 'POST',
        body: JSON.stringify({ title: newModuleTitle.trim() }),
      });
      setSections(prev => [...prev, newSection]);
      setLessonsBySection(prev => ({ ...prev, [newSection.id]: [] }));
      setExpandedSections(s => new Set(s).add(newSection.id));
      setAddingModule(false);
      setNewModuleTitle('');
      showSuccess('Module added');
    } catch (e) {
      setError(e.message);
    }
  };

  // ── Delete Module ──
  const deleteSection = async (sectionId) => {
    try {
      await adminFetch(`/sections/${sectionId}`, token, { method: 'DELETE' });
      setSections(prev => prev.filter(s => s.id !== sectionId));
      setLessonsBySection(prev => {
        const n = { ...prev };
        delete n[sectionId];
        return n;
      });
      // If selected lesson was in this section, clear it
      if (selectedLessonId) {
        const wasInDeleted = Object.entries(lessonsBySection[sectionId] || []).some(
          ([, l]) => l.id === selectedLessonId
        );
        if (wasInDeleted) setSelectedLessonId(null);
      }
      setConfirmDelete(null);
      showSuccess('Module deleted');
    } catch (e) {
      setError(e.message);
    }
  };

  // ── Rename Module ──
  const startEditSection = (section) => {
    setEditingSectionId(section.id);
    setEditingSectionTitle(section.title);
  };

  const saveEditSection = async (sectionId) => {
    try {
      await adminFetch(`/sections/${sectionId}`, token, {
        method: 'PUT',
        body: JSON.stringify({ title: editingSectionTitle }),
      });
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, title: editingSectionTitle } : s));
      setEditingSectionId(null);
      showSuccess('Module renamed');
    } catch (e) {
      setError(e.message);
    }
  };

  // ── Add Lesson ──
  const createLesson = async (sectionId) => {
    if (!newLessonTitle.trim()) return;
    try {
      const newLesson = await adminFetch(`/sections/${sectionId}/lessons`, token, {
        method: 'POST',
        body: JSON.stringify({ title: newLessonTitle.trim() }),
      });
      setLessonsBySection(prev => ({
        ...prev,
        [sectionId]: [...(prev[sectionId] || []), newLesson],
      }));
      setAddingLessonFor(null);
      setNewLessonTitle('');
      setSelectedLessonId(newLesson.id);
      showSuccess('Lesson added — use AI Actions to generate content');
    } catch (e) {
      setError(e.message);
    }
  };

  // ── Lesson handlers ──
  const handleLessonUpdated = () => {
    // Refresh lesson list to pick up new titles/status
    loadCourseData();
  };

  const handleLessonDeleted = (lessonId) => {
    setLessonsBySection(prev => {
      const n = { ...prev };
      Object.keys(n).forEach(sid => {
        n[sid] = n[sid].filter(l => l.id !== lessonId);
      });
      return n;
    });
    if (selectedLessonId === lessonId) setSelectedLessonId(null);
    showSuccess('Lesson deleted');
  };

  // ── Delete course ──
  const deleteCourse = async () => {
    try {
      const res = await adminFetch(`/courses/${courseId}`, token, { method: 'DELETE' });
      // If we just deleted a draft that had a parent, navigate back to the parent
      if (res?.parent_slug && onNavigateToDraft) {
        onNavigateToDraft(res.parent_slug);
      } else {
        onCourseDeleted?.();
      }
    } catch (e) {
      setError(e.message);
    }
  };

  // ── Publish draft course ──
  const publishCourse = async () => {
    if (totalLessons === 0) {
      setError('Cannot publish a course with no lessons');
      return;
    }
    setPublishing(true);
    setError('');
    try {
      await adminFetch(`/courses/${courseId}/publish`, token, { method: 'POST' });
      setPublishedOverlay(true);
      // Show overlay briefly, then return to the course manager home (list view).
      setTimeout(() => {
        setPublishedOverlay(false);
        onBack?.();
      }, 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  };

  // ── Delete the draft version of a published course (when viewed from
  // the published parent). Removes the draft course row entirely; the
  // published course stays untouched. After deletion we refresh the
  // current course so the "Create Draft" banner reappears.
  const [deletingDraft, setDeletingDraft] = useState(false);
  const deleteDraftVersion = async () => {
    if (!course?.draft_slug) return;
    setDeletingDraft(true);
    setError('');
    try {
      await adminFetch(`/courses/${course.draft_slug}`, token, { method: 'DELETE' });
      // Re-fetch the published course so draft_version_id / draft_slug clear.
      await loadCourseData();
      setConfirmDelete(null);
      showSuccess('Draft deleted');
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingDraft(false);
    }
  };

  // ── Create draft version of published course ──
  const createDraftVersion = async () => {
    setCreatingDraft(true);
    setError('');
    try {
      const result = await adminFetch(`/courses/${courseId}/create-draft`, token, { method: 'POST' });
      if (onNavigateToDraft) {
        onNavigateToDraft(result.draft_slug);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCreatingDraft(false);
    }
  };

  // ── Clone course (deep copy into a new independent draft) ──
  const cloneCourse = async () => {
    setCloning(true);
    setError('');
    try {
      const result = await adminFetch(`/courses/${courseId}/clone`, token, { method: 'POST' });
      if (onNavigateToDraft) {
        onNavigateToDraft(result.clone_slug);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCloning(false);
    }
  };

  // ── Drag-and-drop reordering ──
  const persistModuleOrder = async (orderedIds) => {
    try {
      await adminFetch(`/courses/${courseId}/sections/reorder`, token, {
        method: 'PUT',
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
    } catch (e) {
      setError(e.message);
      loadCourseData(); // resync on failure
    }
  };

  const handleModuleDrop = (targetId) => {
    if (!dragModuleId || dragModuleId === targetId) { setDragModuleId(null); return; }
    setSections((prev) => {
      const ids = prev.map((s) => s.id);
      const from = ids.indexOf(dragModuleId);
      const to = ids.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persistModuleOrder(next.map((s) => s.id));
      return next;
    });
    setDragModuleId(null);
  };

  const persistLessonOrder = async (sectionsPayload) => {
    try {
      await adminFetch(`/courses/${courseId}/lessons/reorder`, token, {
        method: 'PUT',
        body: JSON.stringify({ sections: sectionsPayload }),
      });
    } catch (e) {
      setError(e.message);
      loadCourseData();
    }
  };

  // Drop a lesson onto a target lesson (reorder within/across sections) or
  // onto a section header (append to that section).
  const handleLessonDrop = (targetSectionId, targetLessonId = null) => {
    if (!dragLesson) return;
    const { lessonId, fromSectionId } = dragLesson;
    setLessonsBySection((prev) => {
      const next = { ...prev };
      const fromList = [...(next[fromSectionId] || [])];
      const idx = fromList.findIndex((l) => l.id === lessonId);
      if (idx === -1) { return prev; }
      const [moved] = fromList.splice(idx, 1);
      next[fromSectionId] = fromList;

      const toList = fromSectionId === targetSectionId ? fromList : [...(next[targetSectionId] || [])];
      if (targetLessonId) {
        const tIdx = toList.findIndex((l) => l.id === targetLessonId);
        toList.splice(tIdx === -1 ? toList.length : tIdx, 0, moved);
      } else {
        toList.push(moved);
      }
      next[targetSectionId] = toList;

      // Persist both affected sections.
      const affected = new Set([fromSectionId, targetSectionId]);
      persistLessonOrder([...affected].map((sid) => ({
        section_id: sid,
        lesson_ids: (next[sid] || []).map((l) => l.id),
      })));
      return next;
    });
    setDragLesson(null);
  };

  // ── Learner preview data ──
  // Drafts are not surfaced by the public `/api/content/courses/{slug}`
  // endpoint (it filters to status=published). For the admin in-editor
  // preview we therefore hit the auth-gated admin variant which returns
  // the same payload shape regardless of course status.
  const [learnerCourse, setLearnerCourse] = useState(null);
  const loadLearnerPreview = useCallback(async () => {
    try {
      const data = await adminFetch(`/courses/${courseId}/learner-preview`, token);
      setLearnerCourse(data);
    } catch (e) {
      // Surface so the user knows the preview couldn't load (e.g. course not
      // found, network error). Don't replace previously-loaded data.
      setError(e.message || 'Could not load learner preview');
    }
  }, [courseId, token]);

  useEffect(() => {
    if (previewMode === 'learner') {
      loadLearnerPreview();
    }
  }, [previewMode, loadLearnerPreview]);

  const learnerData = useMemo(() => {
    if (!learnerCourse) return null;
    return publishedCourseToLearnerTool(learnerCourse);
  }, [learnerCourse]);

  if (loading && !course) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading course...
      </div>
    );
  }

  if (!course) {
    return <div className="text-center text-slate-400 py-12">Course not found</div>;
  }

  const totalLessons = Object.values(lessonsBySection).reduce((sum, arr) => sum + arr.length, 0);

  // Determine if course is editable (only drafts can be edited)
  const isEditable = course?.status === 'draft';

  return (
    <div className="space-y-4 relative">
      {/* Published overlay */}
      {publishedOverlay && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3 max-w-sm">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Course Published!</h3>
            <p className="text-sm text-slate-600 text-center">
              Your course is now live. Redirecting to the course list...
            </p>
          </div>
        </div>
      )}

      {/* Draft banner */}
      {course.status === 'draft' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-3">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-xs text-amber-800 font-medium">
            This course is in <span className="font-bold">draft</span> status. It will not be visible to learners until published.
          </span>
        </div>
      )}

      {/* Published course - create draft banner */}
      {course.status === 'published' && !course.draft_version_id && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div>
              <span className="text-xs text-blue-800 font-medium">
                This course is <span className="font-bold">published</span> and in read-only mode.
              </span>
              <span className="text-xs text-blue-700 block mt-0.5">Use <span className="font-semibold">Create Draft</span> in the header to make edits without affecting learners.</span>
            </div>
          </div>
        </div>
      )}

      {/* Read-only indicator for published courses with draft */}
      {course.status === 'published' && course.draft_version_id && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div>
              <span className="text-xs text-emerald-800 font-medium">
                This course is <span className="font-bold">published</span> and in read-only mode.
              </span>
              <span className="text-xs text-emerald-700 block mt-0.5">Edit the <span className="text-emerald-600 font-semibold">draft version</span> to make changes.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onNavigateToDraft && onNavigateToDraft(course.draft_slug)}
              className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-1.5 font-medium"
            >
              <Edit3 className="w-4 h-4" />
              Go to Draft
            </button>
            {confirmDelete?.type === 'draft' ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={deleteDraftVersion}
                  disabled={deletingDraft}
                  className="text-sm bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 font-medium"
                >
                  {deletingDraft ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Confirm'
                  )}
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={deletingDraft}
                  className="text-sm bg-slate-100 text-slate-600 px-2 py-2 rounded-lg hover:bg-slate-200"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete({ type: 'draft', id: course.draft_slug })}
                className="text-sm bg-white border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 flex items-center gap-1.5 font-medium"
                title="Discard the draft version (published course is untouched)"
              >
                <Trash2 className="w-4 h-4" />
                Delete Draft
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg flex-shrink-0"
            title="Back to course list"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">{course.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {course.category_id} · {sections.length} modules · {totalLessons} lessons
              {course.status === 'draft' && <span className="ml-2 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-medium">draft</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Preview mode toggle */}
          <div className={`items-center bg-slate-100 rounded-lg p-1 ${mainTab === 'builder' ? 'flex' : 'hidden'}`}>
            <button
              onClick={() => setPreviewMode('creator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                previewMode === 'creator'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Creator
            </button>
            <button
              onClick={() => setPreviewMode('learner')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                previewMode === 'learner'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Learner
            </button>
          </div>

          {/* Create Draft — editable copy of a published course (header action) */}
          {course.status === 'published' && !course.draft_version_id && (
            <button
              onClick={createDraftVersion}
              disabled={creatingDraft}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              title="Create a draft version to edit without affecting learners"
            >
              {creatingDraft ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FilePlus className="w-3.5 h-3.5" />
                  Create Draft
                </>
              )}
            </button>
          )}

          {/* Publish button for draft courses */}
          {mainTab === 'builder' && course.status === 'draft' && (
            <button
              onClick={publishCourse}
              disabled={publishing || totalLessons === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {publishing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Publish
                </>
              )}
            </button>
          )}

          {/* Clone course — deep-copies into a new independent draft.
              UI hidden for now (cloneCourse handler retained for re-enable). */}
          {false && (
            <button
              onClick={cloneCourse}
              disabled={cloning}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Duplicate this course into a new draft"
            >
              {cloning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              Clone
            </button>
          )}

          {/* Delete course */}
          {isEditable && (
            <>
              {confirmDelete?.type === 'course' ? (
                <div className="flex items-center gap-1">
                  <button onClick={deleteCourse} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600">
                    Confirm
                  </button>
                  <button onClick={() => setConfirmDelete(null)} className="text-xs bg-slate-100 text-slate-600 px-2 py-1.5 rounded-lg">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete({ type: 'course', id: courseId })}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white border border-red-300 text-red-600 hover:bg-red-50"
                  title={course?.status === 'draft' ? 'Delete draft' : 'Delete course'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {course?.status === 'draft' ? 'Delete Draft' : 'Delete Course'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Top-level tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 overflow-x-auto">
        {[
          { id: 'builder', label: 'Builder', icon: Wrench },
          { id: 'pricing', label: 'Pricing & Sales', icon: DollarSign },
          { id: 'delivery', label: 'Delivery', icon: CalendarClock },
          { id: 'learners', label: 'Learners', icon: Users },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'announcements', label: 'Announcements', icon: Megaphone },
          { id: 'grading', label: 'Grading', icon: ClipboardCheck },
          { id: 'certificate', label: 'Certificate', icon: Award },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMainTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              mainTab === id ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Non-builder tabs */}
      {mainTab === 'pricing' && <CoursePricing courseId={courseId} token={token} />}
      {mainTab === 'delivery' && <CourseDelivery courseId={courseId} token={token} readOnly={!isEditable} />}
      {mainTab === 'learners' && <CourseLearners courseId={courseId} token={token} />}
      {mainTab === 'analytics' && <CourseAnalytics courseId={courseId} token={token} />}
      {mainTab === 'announcements' && <CourseAnnouncements courseId={courseId} token={token} />}
      {mainTab === 'grading' && <GradingQueue courseId={courseId} token={token} />}
      {mainTab === 'certificate' && <CertificateSettings courseId={courseId} token={token} />}
      {success && (
        <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Learner preview mode */}
      {mainTab === 'builder' && previewMode === 'learner' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-3">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs text-amber-800 font-medium">
              Learner preview — progress and XP are not saved
            </span>
          </div>
          {learnerData ? (
            <div className="min-h-[600px]">
              <JourneyPlayer
                tool={learnerData.tool}
                sections={learnerData.sections}
                isModuleCompleted={learnerData.isModuleCompleted}
                isModuleUnlocked={learnerData.isModuleUnlocked}
                getModuleProgress={learnerData.getModuleProgress}
                completeModule={learnerData.completeModule}
                initialModuleId={null}
                previewVideoUrl=""
                previewMode
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Loading learner preview...
            </div>
          )}
        </div>
      )}

      {/* Creator mode: sidebar + main editor */}
      {mainTab === 'builder' && previewMode === 'creator' && (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* Sidebar: Modules tree */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1 max-h-[calc(100vh-240px)] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modules</h3>
              {!isEditable && (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Read-only</span>
              )}
            </div>

            {sections.length === 0 && !addingModule && (
              <p className="text-xs text-slate-400 text-center py-4">
                {isEditable ? 'No modules yet. Click below to add one.' : 'No modules in this course.'}
              </p>
            )}

            {sections.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const lessons = lessonsBySection[section.id] || [];
              return (
                <div key={section.id} className="rounded-lg overflow-hidden">
                  <div
                    className={`flex items-center gap-1 hover:bg-slate-50 rounded-lg px-1 ${
                      dragModuleId === section.id ? 'opacity-40' : ''
                    }`}
                    draggable={isEditable && editingSectionId !== section.id}
                    onDragStart={() => setDragModuleId(section.id)}
                    onDragEnd={() => setDragModuleId(null)}
                    onDragOver={(e) => { if (dragModuleId) e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragModuleId) handleModuleDrop(section.id);
                      else if (dragLesson) handleLessonDrop(section.id);
                    }}
                  >
                    {isEditable && (
                      <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0 cursor-grab" />
                    )}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="p-1 flex-shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                    {editingSectionId === section.id ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          value={editingSectionTitle}
                          onChange={(e) => setEditingSectionTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEditSection(section.id)}
                          autoFocus
                          className="flex-1 text-sm border border-primary rounded px-1.5 py-0.5 focus:outline-none"
                        />
                        <button onClick={() => saveEditSection(section.id)} className="text-emerald-600 p-0.5">
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingSectionId(null)} className="text-slate-400 p-0.5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="flex-1 text-left py-1.5 text-sm font-semibold text-slate-800 truncate"
                        >
                          {section.title}
                        </button>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {lessons.length}
                        </span>
                        {isEditable && (
                          <>
                            <button
                              onClick={() => startEditSection(section)}
                              className="p-1 text-slate-400 hover:text-primary"
                              title="Rename module"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            {confirmDelete?.type === 'section' && confirmDelete?.id === section.id ? (
                              <div className="flex items-center gap-0.5">
                                <button onClick={() => deleteSection(section.id)} className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded">
                                  Del
                                </button>
                                <button onClick={() => setConfirmDelete(null)} className="text-[10px] text-slate-400 px-0.5">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete({ type: 'section', id: section.id })}
                                className="p-1 text-slate-400 hover:text-red-500"
                                title="Delete module"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Lessons list */}
                  {isExpanded && (
                    <div className="ml-5 space-y-0.5 pb-1">
                      {lessons.map((lesson) => (
                        <button
                          key={lesson.id}
                          onClick={() => setSelectedLessonId(lesson.id)}
                          draggable={isEditable}
                          onDragStart={(e) => { e.stopPropagation(); setDragLesson({ lessonId: lesson.id, fromSectionId: section.id }); }}
                          onDragEnd={() => setDragLesson(null)}
                          onDragOver={(e) => { if (dragLesson) { e.preventDefault(); e.stopPropagation(); } }}
                          onDrop={(e) => {
                            if (!dragLesson) return;
                            e.preventDefault();
                            e.stopPropagation();
                            handleLessonDrop(section.id, lesson.id);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                            selectedLessonId === lesson.id
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-slate-600 hover:bg-slate-50'
                          } ${dragLesson?.lessonId === lesson.id ? 'opacity-40' : ''}`}
                        >
                          {isEditable
                            ? <GripVertical className="w-3 h-3 flex-shrink-0 text-slate-300 cursor-grab" />
                            : <BookOpen className="w-3 h-3 flex-shrink-0" />}
                          <span className="flex-1 truncate">{lesson.title}</span>
                          {lesson.status === 'draft' && (
                            <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded">draft</span>
                          )}
                        </button>
                      ))}

                      {/* Add lesson */}
                      {isEditable && (
                        <>
                          {addingLessonFor === section.id ? (
                            <div className="flex items-center gap-1 px-1 py-1">
                              <input
                                value={newLessonTitle}
                                onChange={(e) => setNewLessonTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && createLesson(section.id)}
                                placeholder="New lesson title..."
                                autoFocus
                                className="flex-1 text-xs border border-primary rounded px-1.5 py-1 focus:outline-none"
                              />
                              <button onClick={() => createLesson(section.id)} className="text-emerald-600 p-0.5">
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => { setAddingLessonFor(null); setNewLessonTitle(''); }} className="text-slate-400 p-0.5">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAddingLessonFor(section.id)}
                              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-primary hover:bg-primary/5"
                            >
                              <FilePlus className="w-3 h-3" />
                              Add lesson
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Module */}
            {isEditable && (
              <>
                {addingModule ? (
                  <div className="flex items-center gap-1 px-1 py-1 border-t border-slate-100 pt-2 mt-2">
                    <input
                      value={newModuleTitle}
                      onChange={(e) => setNewModuleTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createModule()}
                      placeholder="New module title..."
                      autoFocus
                      className="flex-1 text-sm border border-primary rounded px-2 py-1 focus:outline-none"
                    />
                    <button onClick={createModule} className="text-emerald-600 p-0.5">
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setAddingModule(false); setNewModuleTitle(''); }} className="text-slate-400 p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingModule(true)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-primary hover:bg-primary/5 border-t border-slate-100 pt-2 mt-2"
                  >
                    <FolderPlus className="w-3 h-3" />
                    Add module
                  </button>
                )}
              </>
            )}
          </div>

          {/* Main: Lesson editor */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            {selectedLessonId ? (
              <>
                {!isEditable && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 mb-4 flex items-center gap-3">
                    <Info className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <span className="text-xs text-slate-700 font-medium">
                      This lesson is in <span className="font-bold">read-only</span> mode. Edit the draft version to make changes.
                    </span>
                  </div>
                )}
                <LessonEditor
                  key={selectedLessonId}
                  lessonId={selectedLessonId}
                  token={token}
                  onLessonUpdated={handleLessonUpdated}
                  onLessonDeleted={handleLessonDeleted}
                  readOnly={!isEditable}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                <BookOpen className="w-12 h-12 mb-3" />
                <p className="text-sm">Select a lesson to edit</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
