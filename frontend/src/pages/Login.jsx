import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { Button } from '../components/ui/button';
import { SEO } from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
import { Lock, Mail, User, Eye, EyeOff } from 'lucide-react';

const sanitizeError = (error) => {
  if (typeof error !== 'string') return 'An error occurred';
  return error
    .replace(/[<>]/g, '')
    .replace(/["']/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/["']/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
};

// useGoogleLogin can't be called conditionally (Rules of Hooks) and it
// throws when the surrounding GoogleOAuthProvider hasn't been mounted —
// which is the case in local dev when REACT_APP_GOOGLE_CLIENT_ID is
// unset. Wrapping the hook + button in this child component keeps the
// hook call unconditional WITHIN the child, while the parent
// conditionally mounts the child only when OAuth is actually available.
const GoogleSignInButton = ({ onSuccess, onError, loading, disabled }) => {
  const handleGoogleLogin = useGoogleLogin({
    onSuccess,
    onError,
  });
  return (
    <button
      type="button"
      onClick={() => handleGoogleLogin()}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors disabled:opacity-60 shadow-sm"
    >
      {loading ? (
        <svg className="w-5 h-5 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      ) : (
        <GoogleIcon />
      )}
      {loading ? 'Signing in with Google…' : 'Continue with Google'}
    </button>
  );
};

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export const Login = () => {
  const { login, register, socialLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // mode: 'signin' | 'signup'
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Google OAuth is only available when both the client-id env var is set
  // (we conditionally mount the provider in App.js) and we're in a context
  // that loaded the SDK. Locally REACT_APP_GOOGLE_CLIENT_ID is typically
  // unset, in which case we hide the Google button + divider entirely
  // rather than crash the page with 'Missing required parameter client_id'.
  const googleEnabled = Boolean(process.env.REACT_APP_GOOGLE_CLIENT_ID);

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setNotFound(false);
  };

  const handleGoogleResult = async (tokenResponse) => {
    setGoogleLoading(true);
    try {
      await socialLogin({ provider: 'google', token: tokenResponse.access_token });
      navigate('/learn');
    } catch (err) {
      setError(sanitizeError(err.message) || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Email submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotFound(false);
    setLoading(true);
    try {
      if (mode === 'signin') {
        await login({ email: email.trim(), password });
      } else {
        const sanitizedName = sanitizeInput(name.trim());
        await register({ username: sanitizedName, email: email.trim(), password, preferred_language: 'en', role: 'learner' });
      }
      navigate('/learn');
    } catch (err) {
      const msg = sanitizeError(err.message) || '';
      if (msg.toLowerCase().includes('no account found') || msg.includes('404')) {
        setNotFound(true);
      } else {
        setError(msg || (mode === 'signin' ? 'Invalid email or password.' : 'Could not create account. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const isSignIn = mode === 'signin';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-16">
      <SEO />
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/icons/logo.jpg" alt="DreamerZ" className="w-16 h-16 rounded-2xl object-cover mb-4 shadow-md" />
          <h1 className="text-2xl font-bold text-slate-900">
            {isSignIn ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {isSignIn ? 'Sign in to continue learning.' : 'Start your learning journey today.'}
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">

          {/* Google — primary CTA. Hidden entirely when OAuth isn't
              configured (e.g. local dev without REACT_APP_GOOGLE_CLIENT_ID)
              so the page doesn't crash trying to mount a button whose hook
              has no GoogleOAuthProvider context. Email/password still works
              as the fallback. */}
          {googleEnabled && (
            <>
              <GoogleSignInButton
                onSuccess={handleGoogleResult}
                onError={() => setError('Google sign-in was cancelled.')}
                loading={googleLoading}
                disabled={googleLoading || loading}
              />

              <p className="text-center text-xs text-slate-400 mt-2 mb-5">
                New or returning — Google handles it automatically
              </p>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400">or continue with email</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
            </>
          )}

          {/* Mode toggle */}
          <div className="flex rounded-xl border border-slate-200 p-1 mb-5 bg-slate-50">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${isSignIn ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!isSignIn ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Create account
            </button>
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">

            {/* Name — signup only */}
            {!isSignIn && (
              <div className="relative rounded-xl border border-slate-200 bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(sanitizeInput(e.target.value))}
                  className="w-full rounded-xl border-0 bg-transparent py-3 pl-10 pr-4 text-slate-900 text-sm outline-none placeholder:text-slate-400"
                  placeholder="Your name"
                  required
                  minLength={3}
                  maxLength={50}
                />
              </div>
            )}

            {/* Email */}
            <div className="relative rounded-xl border border-slate-200 bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                name="email"
                type="email"
                autoComplete={isSignIn ? 'username email' : 'email'}
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border-0 bg-transparent py-3 pl-10 pr-4 text-slate-900 text-sm outline-none placeholder:text-slate-400"
                placeholder="you@example.com"
                required
                maxLength={254}
              />
            </div>

            {/* Password */}
            <div className="relative rounded-xl border border-slate-200 bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                name="password"
                autoComplete={isSignIn ? 'current-password' : 'new-password'}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border-0 bg-transparent py-3 pl-10 pr-10 text-slate-900 text-sm outline-none placeholder:text-slate-400"
                placeholder={isSignIn ? 'Password' : 'Create a password (8+ chars, 1 uppercase, 1 number)'}
                required
                maxLength={128}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {notFound && (
              <div className="text-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="font-medium text-amber-800">No account found for this email.</p>
                <p className="text-amber-700 mt-0.5">
                  Would you like to{' '}
                  <button
                    type="button"
                    onClick={() => { switchMode('signup'); }}
                    className="font-semibold text-primary underline hover:text-primary/80"
                  >
                    create a new account
                  </button>
                  {' '}instead?
                </p>
              </div>
            )}

            {error && (
              <div className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-2.5">
                {error}
                {isSignIn && (
                  <Link to="/forgot-password" className="block mt-1 text-primary font-semibold hover:text-primary/80">
                    Reset my password →
                  </Link>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading
                ? (isSignIn ? 'Signing in…' : 'Creating account…')
                : (isSignIn ? 'Sign in' : 'Create account')}
            </Button>
          </form>

          {isSignIn && (
            <p className="mt-4 text-center text-xs text-slate-400">
              <Link to="/forgot-password" className="hover:text-slate-600 transition-colors">
                Forgot your password?
              </Link>
            </p>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By continuing you agree to DreamerZ's terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
};

export default Login;
