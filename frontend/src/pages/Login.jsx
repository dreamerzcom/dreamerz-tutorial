import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { Button } from '../components/ui/button';
import { SEO } from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';

// Sanitize error messages to prevent XSS
const sanitizeError = (error) => {
  if (typeof error !== 'string') return 'An error occurred';
  return error
    .replace(/[<>]/g, '')
    .replace(/["']/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
};

export const Login = () => {
  const { login, socialLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setSocialLoading('google');
      try {
        // Exchange Google access token for user info, then send id_token to backend
        await socialLogin({ provider: 'google', token: tokenResponse.access_token });
        navigate('/learn');
      } catch (err) {
        setError(sanitizeError(err.message) || 'Google login failed.');
      } finally {
        setSocialLoading('');
      }
    },
    onError: () => setError('Google login was cancelled or failed.'),
  });

  const validateEmail = () => {
    const trimmedEmail = email.trim();

    if (trimmedEmail.length === 0) {
      setEmailError('Email is required.');
      return false;
    }

    if (trimmedEmail.length > 254) {
      setEmailError('Email is too long (max 254 characters).');
      return false;
    }

    // More strict email validation: require at least 2 chars in TLD
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address (e.g., user@example.com).');
      return false;
    }

    setEmailError('');
    return true;
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (emailError) setEmailError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    // Validate email before submitting
    const emailValid = validateEmail();
    if (!emailValid) {
      return;
    }

    setLoading(true);

    try {
      await login({ email, password });
      navigate('/learn');
    } catch (err) {
      setError(sanitizeError(err.message) || 'Unable to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-16">
      <SEO title="Login" description="Login to DreamerZ to save your progress and access your account." />
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 mt-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Welcome back</h1>
          <p className="text-slate-600 mb-6">Sign in to your account.</p>

          {/* Social login buttons */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => handleGoogleLogin()}
              disabled={!!socialLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors disabled:opacity-60"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {socialLoading === 'google' ? 'Signing in...' : 'Continue with Google'}
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form
            className="space-y-6"
            onSubmit={handleSubmit}
            autoComplete="on"
            method="post"
            action="#"
          >
            <label className="block text-sm font-medium text-slate-700">
              Email
              <div className="relative">
                <div className={`mt-2 relative rounded-xl border bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${emailError ? 'border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-500' : 'border-slate-200'}`}>
                  <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${emailError ? 'text-rose-500' : 'text-slate-400'}`} />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="username email"
                    inputMode="email"
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={validateEmail}
                    className={`w-full rounded-xl border-0 bg-transparent py-3 pl-12 pr-4 outline-none ${emailError ? 'text-rose-900' : 'text-slate-900'}`}
                    placeholder="email@example.com"
                    required
                    maxLength={254}
                  />
                </div>
                {emailError && (
                  <div className="absolute z-10 mt-2 left-0 right-0 bg-rose-600 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                    <div className="relative">
                      {emailError}
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-rose-600 transform rotate-45"></div>
                    </div>
                  </div>
                )}
              </div>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Password
              <div className="mt-2 relative rounded-xl border border-slate-200 bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border-0 bg-transparent py-3 pl-12 pr-12 text-slate-900 outline-none"
                  placeholder="Enter your password"
                  required
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </label>

            {error && (
              <div className="text-sm text-rose-600 space-y-1">
                <div>{error}</div>
                <Link
                  to="/forgot-password"
                  className="inline-block text-primary font-semibold hover:text-primary/80"
                >
                  Forget my password →
                </Link>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || emailError}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            New here?{' '}
            <Link to="/register" className="text-primary font-semibold hover:text-primary/80">
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-sm text-slate-500">
            <Link to="/forgot-password" className="hover:text-slate-700">
              Forget my password
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
