export const QUIZ_PASSING_SCORE = 70;
export const ROLEPLAY_HISTORY_LIMIT = 6;
export const FALLBACK_PREVIEW_VIDEO = 'https://www.youtube.com/embed/zegMOOKy_6A';
export const MAX_CHAT_MESSAGES = 100;
export const PASSWORD_MIN_LENGTH = 8;
// One source of truth for "how much XP a completed lesson is worth". Used by
// useProgress (when computing totalXP) and by JourneyPlayer (when showing the
// per-course "earned / max XP" badge). Keep them in sync — if you ever make
// XP variable per lesson, replace both call sites at once.
export const XP_PER_LESSON = 25;
// The current auth token storage key. Stored as a RAW string (the JWT),
// NOT as a JSON object — see useAuth.js. Previously this constant pointed
// to the legacy 'dreamerz_beta_auth_v1' (a JSON blob with .token), but
// useAuth migrated to the raw-string key and deletes the legacy entry on
// first sign-in. Any consumer that JSON.parse'd the old shape silently
// lost auth after the migration — Roleplay, TryIt, Prompt Lab, Canva,
// progress/parent/assessment services were all reading nothing and
// sending unauthenticated requests.
export const AUTH_STORAGE_KEY = 'dreamerz_beta_token_v1';

/** Single source of truth for "get the current auth token from storage".
 *  Returns the raw JWT string, or null if not signed in. Use this instead
 *  of `localStorage.getItem(AUTH_STORAGE_KEY)` directly so future storage
 *  changes only need updates here.
 */
export const getStoredAuthToken = () => {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) || null;
  } catch {
    return null;
  }
};
export const PROGRESS_STORAGE_KEY = 'dreamerz_beta_progress_v1';
// Persists the dark / light choice across logout. The literal string is
// also baked into the inline boot script in public/index.html — keep them
// in sync if you ever rename this.
export const THEME_STORAGE_KEY = 'dreamerz_beta_theme_v1';
