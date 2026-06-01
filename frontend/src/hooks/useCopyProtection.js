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
      return;
    }

    document.body.classList.add('copy-protected-route');

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
      document.body.classList.remove('copy-protected-route');
    };
  }, [protectedRoute]);
};

export default useCopyProtection;
