import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, CheckCircle2, Save, CalendarClock, Eye, Lock,
} from 'lucide-react';
import { adminFetch } from './adminFetch';

const DRIP_TYPES = [
  { value: 'none', label: 'No drip (all unlocked)' },
  { value: 'sequential', label: 'Sequential (unlock after previous lesson)' },
  { value: 'days_after_enrollment', label: 'Days after enrollment (per lesson)' },
  { value: 'date', label: 'Fixed calendar date (per lesson)' },
];

/**
 * Delivery configuration: course-level drip + completion rule, and per-lesson
 * free-preview / drip scheduling.
 */
export const CourseDelivery = ({ courseId, token, readOnly }) => {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [dripEnabled, setDripEnabled] = useState(false);
  const [dripType, setDripType] = useState('none');
  const [completionRule, setCompletionRule] = useState('all_lessons');

  const flash = (m) => { setSuccess(m); setTimeout(() => setSuccess(''), 2500); };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [c, sections, ls] = await Promise.all([
        adminFetch(`/courses/${courseId}`, token),
        adminFetch(`/courses/${courseId}/sections`, token),
        adminFetch(`/courses/${courseId}/lessons`, token),
      ]);
      setDripEnabled(c.drip_enabled ?? false);
      setDripType(c.drip_type || 'none');
      setCompletionRule(c.completion_rule || 'all_lessons');
      const sectionTitle = {};
      sections.forEach((s) => { sectionTitle[s.id] = s.title; });
      setLessons(ls.map((l) => ({ ...l, section_title: sectionTitle[l.section_id] || '' })));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => { load(); }, [load]);

  const saveCourseDelivery = async () => {
    try {
      await adminFetch(`/courses/${courseId}/delivery`, token, {
        method: 'PUT',
        body: JSON.stringify({ drip_enabled: dripEnabled, drip_type: dripType, completion_rule: completionRule }),
      });
      flash('Delivery settings saved');
    } catch (e) { setError(e.message); }
  };

  const patchLesson = async (lessonId, patch) => {
    setLessons((prev) => prev.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)));
    try {
      await adminFetch(`/lessons/${lessonId}/delivery`, token, { method: 'PUT', body: JSON.stringify(patch) });
    } catch (e) {
      setError(e.message);
      load();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…</div>;
  }

  const showDripDays = dripEnabled && dripType === 'days_after_enrollment';
  const showDripDate = dripEnabled && dripType === 'date';

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error}</div>}
      {success && <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" /> {success}</div>}

      {/* Course-level delivery */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-slate-400" /> Drip & completion</h3>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={dripEnabled} onChange={(e) => setDripEnabled(e.target.checked)} disabled={readOnly} /> Enable drip scheduling
        </label>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Drip rule</label>
          <select value={dripType} onChange={(e) => setDripType(e.target.value)} disabled={!dripEnabled || readOnly}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400">
            {DRIP_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Completion criteria</label>
          <select value={completionRule} onChange={(e) => setCompletionRule(e.target.value)} disabled={readOnly}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary">
            <option value="all_lessons">All lessons completed</option>
            <option value="all_lessons_and_quizzes">All lessons completed + all quizzes passed</option>
          </select>
        </div>
        {!readOnly && (
          <div className="flex justify-end">
            <button onClick={saveCourseDelivery} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        )}
      </div>

      {/* Per-lesson */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Lessons</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Mark free-preview lessons and set per-lesson drip timing.</p>
        </div>
        {lessons.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No lessons yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {lessons.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate">{l.title}</div>
                  {l.section_title && <div className="text-[11px] text-slate-400">{l.section_title}</div>}
                </div>

                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  {l.is_free_preview ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <Lock className="w-3.5 h-3.5 text-slate-300" />}
                  <input type="checkbox" checked={!!l.is_free_preview} disabled={readOnly}
                    onChange={(e) => patchLesson(l.id, { is_free_preview: e.target.checked })} />
                  Free preview
                </label>

                {showDripDays && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <input type="number" min="0" defaultValue={l.drip_days ?? ''} placeholder="days" disabled={readOnly}
                      onBlur={(e) => patchLesson(l.id, { drip_days: e.target.value ? Number(e.target.value) : 0 })}
                      className="w-16 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-primary" />
                    days after enroll
                  </div>
                )}
                {showDripDate && (
                  <input type="date" defaultValue={l.drip_date ? l.drip_date.slice(0, 10) : ''} disabled={readOnly}
                    onBlur={(e) => patchLesson(l.id, { drip_date: e.target.value || '' })}
                    className="text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-primary" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseDelivery;
