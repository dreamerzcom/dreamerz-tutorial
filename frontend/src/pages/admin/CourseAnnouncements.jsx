import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, Plus, Pin, Trash2, Eye, EyeOff, Megaphone, X, Save,
} from 'lucide-react';
import { adminFetch } from './adminFetch';

/**
 * Creator UI for course announcements: create, edit, pin, publish/unpublish
 * and delete notices that surface to enrolled learners.
 */
export const CourseAnnouncements = ({ courseId, token }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', pinned: false, is_published: true });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await adminFetch(`/courses/${courseId}/announcements`, token));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!draft.title.trim() || !draft.body.trim()) return;
    try {
      await adminFetch(`/courses/${courseId}/announcements`, token, {
        method: 'POST', body: JSON.stringify(draft),
      });
      setDraft({ title: '', body: '', pinned: false, is_published: true });
      setCreating(false);
      load();
    } catch (e) { setError(e.message); }
  };

  const patch = async (id, body) => {
    try {
      await adminFetch(`/announcements/${id}`, token, { method: 'PUT', body: JSON.stringify(body) });
      load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (id) => {
    try {
      await adminFetch(`/announcements/${id}`, token, { method: 'DELETE' });
      setConfirmDelete(null);
      load();
    } catch (e) { setError(e.message); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading announcements...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-slate-400" /> Announcements
          <span className="text-xs font-normal text-slate-400">({items.length})</span>
        </h3>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> New announcement
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Announcement title"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
          />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="Write your message to learners…"
            rows={4}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
          />
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={draft.pinned}
                onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} /> Pin to top
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={draft.is_published}
                onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })} /> Publish immediately
            </label>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => { setCreating(false); setDraft({ title: '', body: '', pinned: false, is_published: true }); }}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100">Cancel</button>
              <button onClick={create}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && !creating && (
        <p className="text-sm text-slate-400 text-center py-8">No announcements yet.</p>
      )}

      <div className="space-y-2">
        {items.map((a) => (
          <div key={a.id} className={`bg-white rounded-xl border p-4 ${a.pinned ? 'border-amber-300' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {a.pinned && <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                  <h4 className="text-sm font-semibold text-slate-900 truncate">{a.title}</h4>
                  {!a.is_published && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">draft</span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {a.created_by} · {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => patch(a.id, { pinned: !a.pinned })}
                  className={`p-1.5 rounded-lg hover:bg-slate-100 ${a.pinned ? 'text-amber-500' : 'text-slate-400'}`}
                  title={a.pinned ? 'Unpin' : 'Pin'}>
                  <Pin className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => patch(a.id, { is_published: !a.is_published })}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                  title={a.is_published ? 'Unpublish' : 'Publish'}>
                  {a.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                {confirmDelete === a.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => remove(a.id)} className="text-[10px] bg-red-500 text-white px-2 py-1 rounded">Del</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-[10px] text-slate-400 px-1"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(a.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CourseAnnouncements;
