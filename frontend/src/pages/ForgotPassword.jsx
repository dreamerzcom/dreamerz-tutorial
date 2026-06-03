import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, User, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '../components/ui/button';
import { SEO } from '../components/SEO';
import { useAuth } from '../hooks/useAuth';

const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');

/**
 * Two-mode password-recovery page:
 *   - No ?token=…  → request-link mode. User enters email; backend
 *     emails a one-time link. Page shows a generic confirmation
 *     either way (no account enumeration).
 *   - ?token=… present → reset mode. User sets a new password; backend
 *     validates the token (15-min TTL, single-use enforced via the
 *     current password-hash fingerprint).
 */
export const ForgotPassword = () => {
  const { applyAuthResponse } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  // Mode flag is derived from URL; we never let the user toggle it
  // manually — receiving a token is what proves email control.
  const isResetMode = Boolean(token);

  // Request-mode state
  const [loginId, setLoginId] = useState('');
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  // Reset-mode state
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [resetDone, setResetDone] = useState(false);

  // Shared
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Clear state on token change (e.g. user clicks a fresh email link).
  useEffect(() => {
    setError('');
  }, [token]);

  const handleRequestLink = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      // The backend always returns 200 with the same generic message
      // regardless of whether the account exists — preventing
      // enumeration. We mirror that on the client.
      await fetch(`${API_BASE}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_id: loginId }),
      });
      setRequestSubmitted(true);
    } catch (err) {
      // Network errors are the only thing worth showing — backend
      // errors come back as 200 too.
      setError('Could not reach the server. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Must be at least 8 characters long, with 1 uppercase letter and 1 number.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          new_password: password,
          confirm_password: confirm,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.detail || 'Could not reset password.');
      }
      // Backend returns a fresh JWT — drop it in and route to /learn.
      applyAuthResponse(result);
      setResetDone(true);
      setTimeout(() => navigate('/learn'), 1500);
    } catch (err) {
      setError(err.message || 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-16">
      <SEO
        title={isResetMode ? 'Reset password' : 'Forgot password'}
        description="Reset your DreamerZ password via email link."
      />
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 mt-10">
          {resetDone ? (
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Password reset</h1>
              <p className="text-slate-600">Signing you in with the new password…</p>
            </div>
          ) : requestSubmitted ? (
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
              <p className="text-slate-600 mb-2">
                If an account exists for that username or email, we've sent a
                password reset link.
              </p>
              <p className="text-slate-500 text-sm">
                The link expires in 15 minutes. Don't see it? Check your spam folder,
                or{' '}
                <button
                  type="button"
                  onClick={() => setRequestSubmitted(false)}
                  className="text-primary hover:underline"
                >
                  try again
                </button>
                .
              </p>
            </div>
          ) : isResetMode ? (
            // ───── Reset-with-token mode ─────
            <>
              <h1 className="text-3xl font-bold text-slate-900 mb-3">Set a new password</h1>
              <p className="text-slate-600 mb-8">
                Choose a new password for your DreamerZ account. You'll be signed in
                automatically.
              </p>

              <form className="space-y-6" onSubmit={handleResetPassword}>
                <label className="block text-sm font-medium text-slate-700">
                  New password
                  <div className="mt-2 relative rounded-xl border border-slate-200 bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border-0 bg-transparent py-3 pl-12 pr-4 text-slate-900 outline-none"
                      placeholder="At least 8 characters, 1 uppercase, 1 number"
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Re-enter new password
                  <div className="mt-2 relative rounded-xl border border-slate-200 bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="w-full rounded-xl border-0 bg-transparent py-3 pl-12 pr-4 text-slate-900 outline-none"
                      placeholder="Repeat the password"
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </label>

                {error && <div className="text-sm text-rose-600">{error}</div>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Resetting…' : 'Set new password'}
                </Button>
              </form>

              <p className="mt-6 text-sm text-slate-500">
                Link expired or invalid?{' '}
                <Link to="/forgot-password" className="text-primary font-semibold hover:text-primary/80">
                  Request a new one
                </Link>
              </p>
            </>
          ) : (
            // ───── Request-link mode ─────
            <>
              <h1 className="text-3xl font-bold text-slate-900 mb-3">Forgot your password?</h1>
              <p className="text-slate-600 mb-8">
                Enter the email or username on your account. We'll email you a one-time
                link to set a new password.
              </p>

              <form className="space-y-6" onSubmit={handleRequestLink}>
                <label className="block text-sm font-medium text-slate-700">
                  Username or Email
                  <div className="mt-2 relative rounded-xl border border-slate-200 bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      className="w-full rounded-xl border-0 bg-transparent py-3 pl-12 pr-4 text-slate-900 outline-none"
                      placeholder="yourname or email@example.com"
                      autoComplete="username"
                      required
                    />
                  </div>
                </label>

                {error && <div className="text-sm text-rose-600">{error}</div>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending…' : 'Email me a reset link'}
                </Button>
              </form>

              <p className="mt-6 text-sm text-slate-600">
                Remembered it?{' '}
                <Link to="/login" className="text-primary font-semibold hover:text-primary/80">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
