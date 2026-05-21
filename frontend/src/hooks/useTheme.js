/**
 * useTheme — persistent light/dark switch.
 *
 * Source of truth is localStorage under THEME_STORAGE_KEY so the choice
 * survives logout: AuthProvider clears its own auth blob on logout but
 * intentionally leaves this key alone. The inline `<script>` in
 * public/index.html reads the same key BEFORE React mounts and toggles
 * the `dark` class on <html>, so there's no light → dark flash on the
 * first paint.
 *
 * The hook keeps the in-memory state, the DOM class and the storage key
 * in sync, and listens for cross-tab `storage` events so toggling the
 * theme in one tab is immediately reflected in any other tab.
 */

import { useEffect, useState, useCallback } from 'react';
import { THEME_STORAGE_KEY } from '../config/constants';

const VALID = new Set(['light', 'dark']);

const readStoredTheme = () => {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return VALID.has(v) ? v : 'light';
  } catch {
    // localStorage blocked (some private modes) — fall back to light.
    return 'light';
  }
};

const applyTheme = (theme) => {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
};

export const useTheme = () => {
  const [theme, setThemeState] = useState(readStoredTheme);

  // Re-apply on every change. Cheap; the class toggle is a no-op if the
  // class already matches.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Cross-tab sync — if you toggle in one tab, every other tab follows.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_STORAGE_KEY) {
        setThemeState(readStoredTheme());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next) => {
    const t = VALID.has(next) ? next : 'light';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      // ignore — we'll still update the in-memory state below
    }
    setThemeState(t);
  }, []);

  return { theme, setTheme };
};

export default useTheme;
