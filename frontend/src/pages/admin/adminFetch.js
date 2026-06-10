import { formatErrorDetail } from '../../lib/utils';

const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');

/**
 * Thin fetch wrapper for the authenticated `/api/admin` surface.
 * Mirrors the inline helper used across the admin pages, extracted so the
 * creator-tools components (analytics, grading, announcements, certificates)
 * can share one implementation.
 */
export const adminFetch = async (path, token, options = {}) => {
  const res = await fetch(`${API_BASE}/api/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatErrorDetail(err.detail) || `Request failed (${res.status})`);
  }
  return res.json();
};

export default adminFetch;
