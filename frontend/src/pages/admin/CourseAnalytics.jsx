import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Users, CheckCircle2, Activity, Clock, AlertTriangle,
  TrendingDown, BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { adminFetch } from './adminFetch';

const TONE = {
  slate: 'text-slate-500',
  indigo: 'text-indigo-500',
  emerald: 'text-emerald-500',
  sky: 'text-sky-500',
  amber: 'text-amber-500',
};

const Stat = ({ icon: Icon, label, value, sub, tone = 'slate' }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4">
    <div className="flex items-center gap-2 text-slate-400 mb-1">
      <Icon className={`w-4 h-4 ${TONE[tone] || TONE.slate}`} />
      <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-2xl font-bold text-slate-900">{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
  </div>
);

/**
 * Read-only analytics dashboard for a single course. Pulls the aggregated
 * KPIs, lesson drop-off funnel, quiz performance and enrollment trend from
 * `GET /admin/courses/{id}/analytics`.
 */
export const CourseAnalytics = ({ courseId, token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminFetch(`/courses/${courseId}/analytics`, token));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading analytics...
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error}
      </div>
    );
  }
  if (!data) return null;

  const o = data.overview;
  const q = data.quiz;
  const funnel = data.lessons_funnel.map(l => ({
    name: l.title.length > 18 ? l.title.slice(0, 17) + '…' : l.title,
    completion: l.completion_rate,
    started: l.started,
  }));
  const trend = data.enrollment_trend.map(t => ({ date: t.date.slice(5), count: t.count }));

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Users} label="Enrollments" value={o.total_enrollments}
          sub={`${o.active_last_7_days} active this week`} tone="indigo" />
        <Stat icon={CheckCircle2} label="Completion rate" value={`${o.completion_rate}%`}
          sub={`${o.completed} completed`} tone="emerald" />
        <Stat icon={Activity} label="Avg progress" value={`${o.avg_completion_percent}%`}
          sub={`${o.in_progress} in progress`} tone="sky" />
        <Stat icon={Clock} label="Learning time" value={`${o.total_time_spent_hours}h`}
          sub={o.avg_quiz_score !== null ? `Avg quiz ${o.avg_quiz_score}%` : 'No quiz data'} tone="amber" />
      </div>

      {o.total_enrollments === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> No learners have enrolled yet — charts will populate as learners join.
        </div>
      )}

      {/* Lesson funnel */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-slate-400" /> Lesson completion (drop-off)
        </h3>
        {funnel.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No lessons yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, funnel.length * 34)}>
            <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => n === 'completion' ? [`${v}%`, 'Completion'] : [v, 'Started']} />
              <Bar dataKey="completion" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Enrollment trend */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Enrollments (last 30 days)</h3>
          {trend.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No recent enrollments.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quiz performance */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Quiz performance</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center bg-slate-50 rounded-lg py-2">
              <div className="text-lg font-bold text-slate-900">{q.total_attempts}</div>
              <div className="text-[10px] text-slate-500 uppercase">Attempts</div>
            </div>
            <div className="text-center bg-slate-50 rounded-lg py-2">
              <div className="text-lg font-bold text-emerald-600">{q.pass_rate}%</div>
              <div className="text-[10px] text-slate-500 uppercase">Pass rate</div>
            </div>
            <div className="text-center bg-slate-50 rounded-lg py-2">
              <div className="text-lg font-bold text-amber-600">{q.awaiting_grading}</div>
              <div className="text-[10px] text-slate-500 uppercase">To grade</div>
            </div>
          </div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Hardest questions</h4>
          {q.hardest_questions.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Not enough answers yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {q.hardest_questions.slice(0, 5).map((h) => (
                <li key={h.question_id} className="flex items-center gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded font-semibold ${
                    h.correct_rate < 50 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>{h.correct_rate}%</span>
                  <span className="text-slate-600 truncate">{h.prompt}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseAnalytics;
