/**
 * CanvaCreatorPanel — Lab-tab panel for the Canva course.
 *
 * Canva sets `X-Frame-Options: DENY` on canva.com, so we cannot embed the
 * editor or Magic Media inside the lesson. We also don't have a paid
 * text-to-image API key wired up (the platform stays on one backend —
 * Anthropic Claude — via TOOL_PERSONAS). So the panel does the part it
 * can do well: teach the learner to write a good visual brief, refine it
 * via our existing /api/ai endpoint with the Canva persona, then hand off
 * to Canva's own Magic Studio in a new tab with the brief on the
 * clipboard so they just paste-and-generate.
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Image as ImageIcon,
  Video,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Wand2,
  Loader2,
} from 'lucide-react';

import { getStoredAuthToken } from '../config/constants';

const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');

// Use the shared token reader so any future storage-key change only
// needs updates in config/constants.js.
const getAuthHeaders = () => {
  const token = getStoredAuthToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
};

// Canva's own Magic Studio entry points. These pages prompt the user for
// their description on arrival, so pasting the refined brief works cleanly.
const CANVA_URLS = {
  image: 'https://www.canva.com/ai-image-generator/',
  video: 'https://www.canva.com/create/videos/',
};

const EXAMPLE_PROMPTS = {
  image: [
    'A flat-illustration poster for a school science fair, bright colors, simple shapes',
    'A minimal Instagram story background with soft pastel gradients and abstract circles',
    'A retro 1980s-style movie poster about robots learning to cook',
  ],
  video: [
    'A 15-second explainer about the water cycle, friendly narrator vibe, simple animated illustrations',
    'A snappy 10-second product reel for a study-planner notebook, upbeat music feel',
    'A short reel teaching one English phrasal verb a day, kid-friendly visuals',
  ],
};

export const CanvaCreatorPanel = () => {
  const [mediaType, setMediaType] = useState('image');
  const [prompt, setPrompt] = useState('');
  const [improved, setImproved] = useState('');
  const [improving, setImproving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');

  const polishedPrompt = useMemo(
    () => (improved || prompt).trim(),
    [improved, prompt],
  );
  const canvaUrl = CANVA_URLS[mediaType];

  const refineWithAI = async () => {
    if (!prompt.trim()) return;
    setErr('');
    setImproving(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          prompt:
            `Rewrite this brief so Canva's Magic Media can produce a great `
            + `${mediaType}. Keep it to 1-2 sentences, vivid and specific about `
            + `subject, style, mood, and any composition cues. Return ONLY the `
            + `rewritten brief, no quotes, no preamble.\n\nOriginal:\n${prompt}`,
          mode: `canva_lab_${mediaType}`,
          tool_id: 'canva',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Please sign in again to use the AI refine step.');
        }
        if (res.status === 403 && data.detail === 'trial_expired') {
          throw new Error('Your free trial has ended — AI refine is paused.');
        }
        throw new Error(data.detail || `Refine failed (${res.status})`);
      }
      const text = (data.response || '').trim();
      if (text) setImproved(text);
      else setErr('AI returned an empty response — your original prompt still works.');
    } catch (e) {
      setErr(e.message || 'Could not reach the refine endpoint.');
    } finally {
      setImproving(false);
    }
  };

  const copyToClipboard = async () => {
    if (!polishedPrompt) return false;
    try {
      await navigator.clipboard.writeText(polishedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      return true;
    } catch {
      return false;
    }
  };

  // Clicking "Open in Canva" also copies the brief — saves a manual step,
  // and Canva's Magic Media page lets you paste straight into the input.
  const openInCanva = async (e) => {
    if (polishedPrompt) {
      // Best-effort — clipboard may be blocked on insecure origins.
      await copyToClipboard();
    }
    // anchor handles the actual navigation
    e?.stopPropagation?.();
  };

  const reset = () => {
    setPrompt('');
    setImproved('');
    setErr('');
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header — Canva brand-adjacent cyan/teal so it doesn't look like a
          ChatGPT/Claude-style chat panel. */}
      <div className="bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-xl flex-shrink-0">
          🎨
        </div>
        <div className="flex-grow min-w-0">
          <h4 className="font-semibold text-white text-base">Canva Lab</h4>
          <p className="text-white/85 text-xs">
            Write a brief, refine it with AI, then open Canva Magic Studio to generate the real {mediaType}.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Media-type toggle */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'image', label: 'Image', icon: ImageIcon },
            { id: 'video', label: 'Video', icon: Video },
          ].map((opt) => {
            const active = mediaType === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => { setMediaType(opt.id); setImproved(''); }}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-cyan-50 text-cyan-700 border-cyan-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Brief textarea */}
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-500 font-bold mb-1">
            Describe your {mediaType}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setImproved(''); }}
            placeholder={`e.g., ${EXAMPLE_PROMPTS[mediaType][0]}`}
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 resize-none"
          />
        </div>

        {/* Inspiration chips */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-bold">Try one</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS[mediaType].map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setPrompt(ex); setImproved(''); }}
                className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-cyan-50 hover:border-cyan-300 text-slate-700 transition-colors text-left"
              >
                {ex.length > 70 ? `${ex.slice(0, 70)}…` : ex}
              </button>
            ))}
          </div>
        </div>

        {/* Refined brief (only when we have one) */}
        {improved && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-cyan-50 border border-cyan-200 p-3"
          >
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-700 mb-1">
                  Refined brief
                </div>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {improved}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {err && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {err}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={refineWithAI}
            disabled={!prompt.trim() || improving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {improving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {improving ? 'Refining…' : 'Refine with AI'}
          </button>
          <button
            type="button"
            onClick={copyToClipboard}
            disabled={!polishedPrompt}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy brief'}
          </button>
          <a
            href={canvaUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openInCanva}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
          >
            <ExternalLink className="w-4 h-4" />
            Open in Canva
          </a>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Canva blocks direct iframe embedding, so the actual {mediaType} is
          generated on Canva.com in a new tab. Clicking <strong>Open in Canva</strong>{' '}
          also copies your brief to the clipboard — paste it into Canva&apos;s
          Magic Media / Magic Design input.
        </p>

        {polishedPrompt && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-slate-500 hover:text-slate-700 hover:underline underline-offset-2"
          >
            Start over
          </button>
        )}
      </div>
    </div>
  );
};

export default CanvaCreatorPanel;
