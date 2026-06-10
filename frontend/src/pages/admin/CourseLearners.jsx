import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, AlertTriangle, Users, Search } from 'lucide-react';
import { adminFetch } from './adminFetch';

const STATUS_STYLE = {
  completed: 'bg-emerald-100 text-emerald-700',
  in_progress: 'bg-sky-100 text-sky-700',
  not_started: 'bg-slate-100 text-slate-500',
};

/**
 * Creator-scoped roster of learners enrolled in a course, with progress and
 * average quiz score. Backed by GET /admin/courses/{id}/learners.
 */
export const CourseLearners = ({ courseId, token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminFetch(`/courses/${courseId}/learners`, token));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.learners;
    return data.learners.filter(
      (l) => l.username?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q)
    );
  }, [data, search]);

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading learners…</div>;
  }
  if (error) {
    return <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
      <AlertTriangle className="w-4 h-4" /> {error}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" /> Learners
          <span className="text-xs font-normal text-slate-400">({data.count})</span>
        </h3>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
            className="text-sm border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-primary" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-8 text-center text-sm text-slate-400">
          {data.count === 0 ? 'No learners enrolled yet.' : 'No learners match your search.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="text-left font-semibold px-4 py-2">Learner</th>
                <th className="text-left font-semibold px-3 py-2">Status</th>
                <th className="text-right font-semibold px-3 py-2">Progress</th>
                <th className="text-right font-semibold px-3 py-2">Avg quiz</th>
                <th className="text-right font-semibold px-3 py-2">Last active</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.user_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-800">{l.username}</div>
                    <div className="text-[11px] text-slate-400">{l.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLE[l.status] || 'bg-slate-100 text-slate-500'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.round(l.completion_percent)}%` }} />
                      </div>
                      <span className="text-slate-600 text-xs w-16 text-right">
                        {Math.round(l.completion_percent)}% ({l.lessons_completed}/{l.total_lessons})
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600">
                    {typeof l.average_quiz_score === 'number' ? `${Math.round(l.average_quiz_score)}%` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-500 text-xs">
                    {l.last_accessed_at ? new Date(l.last_accessed_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CourseLearners;
