import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Disables casual content-extraction shortcuts on learning routes:
 *   - Ctrl/Cmd + P  (print)
 *   - Ctrl/Cmd + S  (save page)
 *   - Ctrl/Cmd + U  (view source)
 *   - F12 / Ctrl+Shift+I/J/C  (dev tools)
 *
 * This is deterrence, not real DRM — anyone with motivation can still
 * open dev tools via the browser menu, take a screenshot, or read the
 * DOM tree directly. The point is to stop casual copy/paste/print.
 *
 * Scoped to specific routes (mainly /learn/...) so that admin pages,
 * account settings, and forms remain fully usable.
 */
const PROTECTED_PATH_PREFIXES = [
  '/learn',          // /learn, /learn/:cat, /learn/:cat/:tool, /learn/myprogress
];

const UNPROTECTED_OVERRIDES = [
  '/admin',          // creators/admins must be able to inspect & copy
];

const isProtectedPath = (pathname) => {
  if (UNPROTECTED_OVERRIDES.some((p) => pathname.startsWith(p))) {
    return false;
  }
  return PROTECTED_PATH_PREFIXES.some((p) => pathname.startsWith(p));
};

export const useCopyProtection = () => {
  const location = useLocation();
  const protectedRoute = isProtectedPath(location.pathname);

  useEffect(() => {
    if (!protectedRoute) {
      document.body.classList.remove('copy-protected-route');
      document.body.classList.remove('tab-hidden');
      document.body.classList.remove('screen-capture-active');
      return;
    }

    document.body.classList.add('copy-protected-route');

    // ─── Visibility-change blur ─────────────────────────────
    // When the user switches tab / minimises / opens the app-switcher
    // on mobile, blur the lesson content. This is a deterrent for the
    // "screenshot a side-by-side window" trick — won't stop a
    // screenshot taken while focused on the tab.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        document.body.classList.add('tab-hidden');
      } else {
        document.body.classList.remove('tab-hidden');
      }
    };

    // Also blur on `blur` (window loses focus, e.g. Cmd+Tab on Mac
    // doesn't always fire visibilitychange immediately).
    const handleBlur = () => document.body.classList.add('tab-hidden');
    const handleFocus = () => document.body.classList.remove('tab-hidden');

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    // ─── In-browser screen-capture detection ──────────────────
    // navigator.mediaDevices.getDisplayMedia is what tools like Loom
    // and built-in Chrome recording use. Wrap it so we know when it's
    // invoked from the page itself. (Doesn't catch OS-level recorders
    // like OBS, QuickTime, Android/iOS screen recording — those are
    // outside the browser sandbox entirely.)
    let originalGetDisplayMedia = null;
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function'
    ) {
      originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(
        navigator.mediaDevices
      );
      navigator.mediaDevices.getDisplayMedia = async (constraints) => {
        // Mark body so CSS can blur lesson content while a capture
        // request is in flight. We let the request proceed (rejecting
        // it would be hostile UX if the user is legitimately screen-
        // sharing in a parallel app), but the content is hidden.
        document.body.classList.add('screen-capture-active');
        try {
          const stream = await originalGetDisplayMedia(constraints);
          // When the user stops sharing, the stream's tracks end.
          stream.getVideoTracks().forEach((track) => {
            track.addEventListener('ended', () => {
              document.body.classList.remove('screen-capture-active');
            });
          });
          return stream;
        } catch (err) {
          document.body.classList.remove('screen-capture-active');
          throw err;
        }
      };
    }

    const handleKeyDown = (e) => {
      // Let inputs work normally — typing in a textarea must not be blocked.
      const tag = (e.target?.tagName || '').toLowerCase();
      const editable = e.target?.isContentEditable;
      const inForm = tag === 'input' || tag === 'textarea' || editable;

      const ctrl = e.ctrlKey || e.metaKey; // metaKey covers ⌘ on macOS

      // Print / Save / View-source — block site-wide on protected routes,
      // even inside form inputs (these aren't typing shortcuts).
      if (ctrl && ['p', 's', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Dev tools shortcuts — block unless inside a form input.
      if (!inForm) {
        if (e.key === 'F12') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        if (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    };

    // Block right-click on any element outside form inputs while on a
    // protected route. (MarkdownContent already blocks at the component
    // level; this is the catch-all for surrounding chrome.)
    const handleContextMenu = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      const editable = e.target?.isContentEditable;
      if (tag === 'input' || tag === 'textarea' || editable) {
        return; // allow context menu in inputs (spell-check, paste, etc.)
      }
      e.preventDefault();
      return false;
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      // Restore the original getDisplayMedia in case some other part of
      // the app needs it (e.g. a future "share my screen" support call).
      if (
        originalGetDisplayMedia &&
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices
      ) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      }
      document.body.classList.remove('copy-protected-route');
      document.body.classList.remove('tab-hidden');
      document.body.classList.remove('screen-capture-active');
    };
  }, [protectedRoute]);
};

export default useCopyProtection;
