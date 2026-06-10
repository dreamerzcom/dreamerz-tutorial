import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, Award, Save, CheckCircle2, ShieldOff, ShieldCheck,
} from 'lucide-react';
import { adminFetch } from './adminFetch';

/**
 * Creator config for completion certificates plus the list of issued
 * certificates (with revoke / restore).
 */
export const CertificateSettings = ({ courseId, token }) => {
  const [data, setData] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch(`/courses/${courseId}/certificates`, token);
      setData(res);
      setEnabled(!!res.course.certificate_enabled);
      // Pull the title from the course record (analytics endpoint not needed)
      const course = await adminFetch(`/courses/${courseId}`, token);
      setTitle(course.certificate_title || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await adminFetch(`/courses/${courseId}/certificate`, token, {
        method: 'PUT',
        body: JSON.stringify({ certificate_enabled: enabled, certificate_title: title }),
      });
      setSuccess('Certificate settings saved');
      setTimeout(() => setSuccess(''), 2500);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleRevoke = async (serial) => {
    try {
      await adminFetch(`/certificates/${serial}/revoke`, token, { method: 'POST' });
      load();
    } catch (e) { setError(e.message); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…</div>;
  }

  const certs = data?.certificates || [];

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Award className="w-4 h-4 text-slate-400" /> Completion certificate
        </h3>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Issue a certificate automatically when a learner completes this course
        </label>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Certificate title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Certificate of Completion"
            disabled={!enabled}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <div className="flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save settings
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">
          Issued certificates <span className="text-xs font-normal text-slate-400">({certs.length})</span>
        </h3>
        {certs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            No certificates issued yet. They appear here as learners complete the course.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {certs.map((c) => (
              <div key={c.serial} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{c.student_name || '—'}</div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    {c.serial} · {c.issued_at ? new Date(c.issued_at).toLocaleDateString() : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {c.revoked
                    ? <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded">revoked</span>
                    : <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">valid</span>}
                  <button onClick={() => toggleRevoke(c.serial)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100">
                    {c.revoked ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                    {c.revoked ? 'Restore' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CertificateSettings;
