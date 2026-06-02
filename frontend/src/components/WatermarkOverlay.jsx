import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * Renders a repeating, low-opacity diagonal watermark across the parent
 * container. The text encodes the logged-in user's identity + a timestamp
 * so any screenshot of lesson content is traceable back to who took it.
 *
 * This is *not* anti-screenshot — no web tech can prevent OS-level
 * screen capture. It is anti-leak: it makes leaked content auditable.
 * Industry standard for Netflix screeners, Coursera videos, McKinsey
 * decks shown to clients, etc.
 *
 * Usage:
 *   <div style={{ position: 'relative' }}>
 *     <WatermarkOverlay />
 *     ...your protected content...
 *   </div>
 *
 * The overlay uses `position: absolute` + `pointer-events: none`, so it
 * doesn't intercept clicks, doesn't change layout, but appears in any
 * screenshot pixel-for-pixel.
 */
export const WatermarkOverlay = ({ density = 'normal' }) => {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());

  // Refresh timestamp every 60s so the watermark in any new screenshot
  // is tied to roughly when it was taken.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Identity string — falls back gracefully if user isn't logged in,
  // but the watermark wrapping the lesson content should only render
  // inside auth-gated pages anyway.
  const label = useMemo(() => {
    const who = user?.email || user?.username || 'guest';
    const ts = now.toISOString().slice(0, 16).replace('T', ' '); // 2026-06-02 14:32
    return `${who} · ${ts} · dreamer-z.com`;
  }, [user, now]);

  // The same string is repeated many times in a fixed-size grid so the
  // watermark covers the whole content area regardless of scroll. The
  // text is rotated -30deg and uses a near-transparent indigo so it's
  // visible enough to be captured in a screenshot but not loud enough
  // to disrupt reading.
  const rows = density === 'dense' ? 14 : 10;
  const repeats = density === 'dense' ? 10 : 7;
  const cells = Array.from({ length: rows * repeats });

  return (
    <div
      className="watermark-overlay"
      aria-hidden="true"
      data-testid="watermark-overlay"
    >
      <div className="watermark-overlay__grid">
        {cells.map((_, i) => (
          <span key={i} className="watermark-overlay__cell">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * Small visible pill that tells learners "this is watermarked" — a
 * psychological deterrent. Most users won't even attempt screenshots
 * once they know the content is traceable. Render once near the top of
 * a protected page (NOT inside the WatermarkOverlay grid — this one is
 * meant to be loud, not subtle).
 */
export const WatermarkNotice = () => (
  <div
    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 rounded-full px-2.5 py-1 select-none"
    title="Your account identifier and timestamp are embedded in this view. Any screenshot can be traced back to your account."
  >
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
    Watermarked — screenshots are traceable
  </div>
);

export default WatermarkOverlay;
