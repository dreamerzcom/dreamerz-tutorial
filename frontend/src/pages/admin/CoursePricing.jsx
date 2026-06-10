import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, CheckCircle2, Save, DollarSign, Tag, Plus, Trash2,
  LayoutTemplate, X,
} from 'lucide-react';
import { adminFetch } from './adminFetch';

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD'];

export const CoursePricing = ({ courseId, token }) => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // pricing
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState('USD');

  // sales page
  const [sp, setSp] = useState({ headline: '', subheadline: '', outcomes: '', instructor_bio: '', cta_label: '', faqs: [], testimonials: [] });

  // new coupon
  const [newCoupon, setNewCoupon] = useState({ code: '', discount_type: 'percent', discount_value: 10, max_redemptions: '', expires_at: '' });

  const flash = (m) => { setSuccess(m); setTimeout(() => setSuccess(''), 2500); };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [c, cps] = await Promise.all([
        adminFetch(`/courses/${courseId}`, token),
        adminFetch(`/courses/${courseId}/coupons`, token).catch(() => []),
      ]);
      setIsFree(c.is_free ?? true);
      setPrice(c.price ?? 0);
      setCurrency(c.currency || 'USD');
      const s = c.sales_page || {};
      setSp({
        headline: s.headline || '',
        subheadline: s.subheadline || '',
        outcomes: Array.isArray(s.outcomes) ? s.outcomes.join('\n') : '',
        instructor_bio: s.instructor_bio || '',
        cta_label: s.cta_label || '',
        faqs: Array.isArray(s.faqs) ? s.faqs : [],
        testimonials: Array.isArray(s.testimonials) ? s.testimonials : [],
      });
      setCoupons(cps);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => { load(); }, [load]);

  const savePricing = async () => {
    try {
      await adminFetch(`/courses/${courseId}/pricing`, token, {
        method: 'PUT',
        body: JSON.stringify({ is_free: isFree, price: Number(price) || 0, currency }),
      });
      flash('Pricing saved');
    } catch (e) { setError(e.message); }
  };

  const saveSalesPage = async () => {
    try {
      const payload = {
        headline: sp.headline,
        subheadline: sp.subheadline,
        outcomes: sp.outcomes.split('\n').map((s) => s.trim()).filter(Boolean),
        instructor_bio: sp.instructor_bio,
        cta_label: sp.cta_label,
        faqs: sp.faqs.filter((f) => f.q?.trim()),
        testimonials: sp.testimonials.filter((t) => t.quote?.trim()),
      };
      await adminFetch(`/courses/${courseId}/sales-page`, token, {
        method: 'PUT',
        body: JSON.stringify({ sales_page: payload }),
      });
      flash('Sales page saved');
    } catch (e) { setError(e.message); }
  };

  const addCoupon = async () => {
    if (!newCoupon.code.trim()) return;
    try {
      const body = {
        code: newCoupon.code.trim(),
        discount_type: newCoupon.discount_type,
        discount_value: Number(newCoupon.discount_value) || 0,
        max_redemptions: newCoupon.max_redemptions ? Number(newCoupon.max_redemptions) : null,
        expires_at: newCoupon.expires_at || null,
      };
      const created = await adminFetch(`/courses/${courseId}/coupons`, token, { method: 'POST', body: JSON.stringify(body) });
      setCoupons((p) => [created, ...p]);
      setNewCoupon({ code: '', discount_type: 'percent', discount_value: 10, max_redemptions: '', expires_at: '' });
      flash('Coupon created');
    } catch (e) { setError(e.message); }
  };

  const deleteCoupon = async (id) => {
    try {
      await adminFetch(`/coupons/${id}`, token, { method: 'DELETE' });
      setCoupons((p) => p.filter((c) => c.id !== id));
    } catch (e) { setError(e.message); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…</div>;
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error}<button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button></div>}
      {success && <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" /> {success}</div>}

      {/* Pricing */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><DollarSign className="w-4 h-4 text-slate-400" /> Pricing</h3>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} /> This course is free
        </label>
        {!isFree && (
          <div className="flex items-center gap-2">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-2 py-2 focus:outline-none focus:border-primary">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
              className="w-32 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary" />
            <span className="text-xs text-slate-400">list price</span>
          </div>
        )}
        <div className="flex justify-end">
          <button onClick={savePricing} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">
            <Save className="w-3.5 h-3.5" /> Save pricing
          </button>
        </div>
      </div>

      {/* Coupons */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Tag className="w-4 h-4 text-slate-400" /> Coupons</h3>
        {isFree && <p className="text-xs text-amber-600">Coupons only apply to paid courses.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <input value={newCoupon.code} onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
            placeholder="CODE" className="w-28 text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary" />
          <select value={newCoupon.discount_type} onChange={(e) => setNewCoupon({ ...newCoupon, discount_type: e.target.value })}
            className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary">
            <option value="percent">% off</option>
            <option value="fixed">fixed off</option>
          </select>
          <input type="number" min="0" value={newCoupon.discount_value} onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: e.target.value })}
            className="w-20 text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="number" min="0" value={newCoupon.max_redemptions} onChange={(e) => setNewCoupon({ ...newCoupon, max_redemptions: e.target.value })}
            placeholder="max uses" className="w-24 text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="date" value={newCoupon.expires_at} onChange={(e) => setNewCoupon({ ...newCoupon, expires_at: e.target.value })}
            className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary" />
          <button onClick={addCoupon} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {coupons.length > 0 && (
          <div className="divide-y divide-slate-100">
            {coupons.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-mono font-semibold text-slate-800">{c.code}</span>
                  <span className="text-slate-500 ml-2">
                    {c.discount_type === 'percent' ? `${c.discount_value}% off` : `${c.discount_value} off`}
                    {c.max_redemptions ? ` · ${c.times_redeemed}/${c.max_redemptions} used` : ` · ${c.times_redeemed} used`}
                    {!c.is_active && ' · inactive'}
                  </span>
                </div>
                <button onClick={() => deleteCoupon(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sales page */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><LayoutTemplate className="w-4 h-4 text-slate-400" /> Sales page</h3>
        <input value={sp.headline} onChange={(e) => setSp({ ...sp, headline: e.target.value })}
          placeholder="Headline" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary" />
        <input value={sp.subheadline} onChange={(e) => setSp({ ...sp, subheadline: e.target.value })}
          placeholder="Subheadline" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary" />
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Learning outcomes (one per line)</label>
          <textarea value={sp.outcomes} onChange={(e) => setSp({ ...sp, outcomes: e.target.value })} rows={4}
            placeholder={'Build X\nUnderstand Y\nShip Z'} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary" />
        </div>
        <textarea value={sp.instructor_bio} onChange={(e) => setSp({ ...sp, instructor_bio: e.target.value })} rows={2}
          placeholder="Instructor bio" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary" />
        <input value={sp.cta_label} onChange={(e) => setSp({ ...sp, cta_label: e.target.value })}
          placeholder="Call-to-action label (e.g. Enroll now)" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary" />

        {/* FAQs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-500">FAQs</label>
            <button onClick={() => setSp({ ...sp, faqs: [...sp.faqs, { q: '', a: '' }] })}
              className="text-xs text-primary flex items-center gap-1"><Plus className="w-3 h-3" /> Add FAQ</button>
          </div>
          {sp.faqs.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={f.q} onChange={(e) => { const n = [...sp.faqs]; n[i] = { ...n[i], q: e.target.value }; setSp({ ...sp, faqs: n }); }}
                placeholder="Question" className="flex-1 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-primary" />
              <input value={f.a} onChange={(e) => { const n = [...sp.faqs]; n[i] = { ...n[i], a: e.target.value }; setSp({ ...sp, faqs: n }); }}
                placeholder="Answer" className="flex-1 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-primary" />
              <button onClick={() => setSp({ ...sp, faqs: sp.faqs.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-500">Testimonials</label>
            <button onClick={() => setSp({ ...sp, testimonials: [...sp.testimonials, { name: '', quote: '' }] })}
              className="text-xs text-primary flex items-center gap-1"><Plus className="w-3 h-3" /> Add testimonial</button>
          </div>
          {sp.testimonials.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={t.name} onChange={(e) => { const n = [...sp.testimonials]; n[i] = { ...n[i], name: e.target.value }; setSp({ ...sp, testimonials: n }); }}
                placeholder="Name" className="w-32 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-primary" />
              <input value={t.quote} onChange={(e) => { const n = [...sp.testimonials]; n[i] = { ...n[i], quote: e.target.value }; setSp({ ...sp, testimonials: n }); }}
                placeholder="Quote" className="flex-1 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-primary" />
              <button onClick={() => setSp({ ...sp, testimonials: sp.testimonials.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button onClick={saveSalesPage} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">
            <Save className="w-3.5 h-3.5" /> Save sales page
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoursePricing;
