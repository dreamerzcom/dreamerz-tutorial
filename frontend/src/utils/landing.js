/**
 * landing.js — small helpers for the marketing landing page.
 *  - trackCTA: fire a named analytics event (spec §20). No-ops safely when no
 *    analytics provider is wired; logs in dev so events are verifiable.
 *  - scrollToSection: smooth-scroll to an in-page section, accounting for the
 *    fixed (~64px) navbar so headings aren't hidden under it.
 */

/**
 * Fire a CTA analytics event.
 * @param {string} eventName one of LANDING_EVENTS
 * @param {object} payload   { section, cta_label, audience, destination }
 */
export function trackCTA(eventName, payload = {}) {
  if (!eventName) return;
  const data = { page: 'landing', ...payload };
  try {
    // Google Analytics / gtag
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, data);
    }
    // GTM dataLayer
    if (typeof window !== 'undefined' && Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: eventName, ...data });
    }
  } catch {
    /* analytics must never break the UI */
  }
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[trackCTA]', eventName, data);
  }
}

const NAV_OFFSET = 72; // fixed navbar height + a little breathing room

/** Smooth-scroll to an element id, offset for the fixed navbar. */
export function scrollToSection(id) {
  if (typeof document === 'undefined' || !id) return;
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
  window.scrollTo({ top, behavior: 'smooth' });
}

/**
 * Resolve a config href into a click handler + Link/anchor decision.
 * Returns { type, to, href, onClick }:
 *  - in-page anchor ("#id")      → type 'anchor'
 *  - external/mailto             → type 'external'
 *  - internal route ("/path")    → type 'route'
 */
export function resolveHref(href) {
  if (!href) return { type: 'route', to: '/' };
  if (href.startsWith('#')) return { type: 'anchor', id: href.slice(1) };
  if (/^(https?:|mailto:|tel:)/.test(href)) return { type: 'external', href };
  return { type: 'route', to: href };
}
