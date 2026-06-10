import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, ClipboardCheck, CheckCircle2, User, BookOpen,
} from 'lucide-react';
import { adminFetch } from './adminFetch';

const AttemptCard = ({ attempt, token, onGraded }) => {
  // grades keyed by answer_id: { score, correct }
  const [grades, setGrades] = useState(() => {
    const init = {};
    attempt.answers.forEach((a) => {
      init[a.answer_id] = {
        score: a.score_awarded !== null ? a.score_awarded : '',
        feedback: '',
      };
    });
    return init;
  });
  const [feedbackSummary, setFeedbackSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setScore = (id, score) => setGrades((g) => ({ ...g, [id]: { ...g[id], score } }));
  const setFeedback = (id, feedback) => setGrades((g) => ({ ...g, [id]: { ...g[id], feedback } }));

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const answers = attempt.answers.map((a) => {
        const score = parseFloat(grades[a.answer_id].score) || 0;
        return {
          answer_id: a.answer_id,
          score_awarded: score,
          is_correct: score >= (a.max_score || 1),
          feedback: grades[a.answer_id].feedback || null,
        };
      });
      await adminFetch(`/attempts/${attempt.attempt_id}/grade`, token, {
        method: 'POST',
        body: JSON.stringify({ answers, feedback_summary: feedbackSummary || null }),
      });
      onGraded(attempt.attempt_id);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {attempt.student_username || 'Unknown'}</span>
        {attempt.lesson_title && <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {attempt.lesson_title}</span>}
        {attempt.submitted_at && <span className="ml-auto">{new Date(attempt.submitted_at).toLocaleString()}</span>}
      </div>

      {attempt.answers.map((a) => (
        <div key={a.answer_id} className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
          <p className="text-sm font-medium text-slate-800">{a.prompt}</p>
          <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap border-l-2 border-slate-200 pl-2">
            {a.student_answer || <span className="italic text-slate-400">No answer provided</span>}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs text-slate-500">Score</label>
            <input
              type="number" min="0" max={a.max_score} step="0.5"
              value={grades[a.answer_id].score}
              onChange={(e) => setScore(a.answer_id, e.target.value)}
              className="w-20 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-primary"
            />
            <span className="text-xs text-slate-400">/ {a.max_score}</span>
            <input
              value={grades[a.answer_id].feedback}
              onChange={(e) => setFeedback(a.answer_id, e.target.value)}
              placeholder="Feedback (optional)"
              className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      ))}

      <textarea
        value={feedbackSummary}
        onChange={(e) => setFeedbackSummary(e.target.value)}
        placeholder="Overall feedback for the learner (optional)"
        rows={2}
        className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary"
      />

      {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {error}</p>}

      <div className="flex justify-end">
        <button onClick={submit} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Submit grade
        </button>
      </div>
    </div>
  );
};

/**
 * Manual grading queue for short-answer responses awaiting a human grade.
 */
export const GradingQueue = ({ courseId, token }) => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch(`/courses/${courseId}/grading-queue`, token);
      setQueue(res.queue || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => { load(); }, [load]);

  const handleGraded = (attemptId) => {
    setQueue((q) => q.filter((a) => a.attempt_id !== attemptId));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading grading queue…</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4 text-slate-400" /> Grading queue
        <span className="text-xs font-normal text-slate-400">({queue.length} awaiting)</span>
      </h3>

      {queue.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-6 text-center text-sm text-emerald-700 flex flex-col items-center gap-2">
          <CheckCircle2 className="w-6 h-6" />
          All caught up — no short-answer responses awaiting grading.
        </div>
      ) : (
        queue.map((a) => (
          <AttemptCard key={a.attempt_id} attempt={a} token={token} onGraded={handleGraded} />
        ))
      )}
    </div>
  );
};

export default GradingQueue;
