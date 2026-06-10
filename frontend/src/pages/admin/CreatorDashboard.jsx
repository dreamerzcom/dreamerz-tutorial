import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, BookOpen, Users, CheckCircle2, DollarSign,
  Award, ClipboardCheck, Activity, ArrowRight,
} from 'lucide-react';
import { adminFetch } from './adminFetch';

const Card = ({ icon: Icon, label, value, tone }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4">
    <div className="flex items-center gap-2 text-slate-400 mb-1">
      <Icon className={`w-4 h-4 ${tone}`} />
      <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-2xl font-bold text-slate-900">{value}</div>
  </div>
);

/**
 * Aggregate creator landing dashboard — KPIs across all the creator's courses
 * plus a per-course quick table. Opens by default for creators.
 */
export const CreatorDashboard = ({ token, onOpenCourse }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminFetch('/creator/dashboard', token));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading dashboard…</div>;
  }
  if (error) {
    return <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
      <AlertTriangle className="w-4 h-4" /> {error}</div>;
  }
  if (!data) return null;

  const t = data.totals;
  const money = (v, cur = 'USD') => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(v); }
    catch { return `${cur} ${v}`; }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Creator Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {t.courses} courses · {t.published} published · {t.drafts} drafts
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={Users} label="Total learners" value={t.total_enrollments} tone="text-indigo-500" />
        <Card icon={Activity} label="Active (30d)" value={t.active_learners_30d} tone="text-sky-500" />
        <Card icon={CheckCircle2} label="Completions" value={t.completions} tone="text-emerald-500" />
        <Card icon={DollarSign} label="Revenue" value={money(t.total_revenue)} tone="text-amber-500" />
        <Card icon={Activity} label="Avg progress" value={`${t.avg_completion_percent}%`} tone="text-sky-500" />
        <Card icon={Award} label="Certificates" value={t.certificates_issued} tone="text-emerald-500" />
        <Card icon={ClipboardCheck} label="To grade" value={t.awaiting_grading} tone="text-amber-500" />
        <Card icon={BookOpen} label="Courses" value={t.courses} tone="text-indigo-500" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Your courses</h3>
        </div>
        {data.courses.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">No courses yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="text-left font-semibold px-4 py-2">Course</th>
                  <th className="text-left font-semibold px-3 py-2">Status</th>
                  <th className="text-right font-semibold px-3 py-2">Price</th>
                  <th className="text-right font-semibold px-3 py-2">Learners</th>
                  <th className="text-right font-semibold px-3 py-2">Completion</th>
                  <th className="text-right font-semibold px-3 py-2">Revenue</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.courses.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{c.name}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        c.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">
                      {c.is_free ? <span className="text-emerald-600">Free</span> : money(c.price, c.currency)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{c.enrollments}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{c.completion_rate}%</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{money(c.revenue, c.currency)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => onOpenCourse?.(c.id)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        Open <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorDashboard;
