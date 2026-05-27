import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { Button } from '../components/ui/button';
import { SEO } from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
import { LANGUAGES } from '../hooks/useLanguage';
import { Lock, Mail, User, Briefcase, Globe, Eye, EyeOff } from 'lucide-react';

// Sanitize input to prevent XSS
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/["']/g, '') // Remove quotes to prevent attribute injection
    .replace(/\/\*/g, '') // Remove comment start
    .replace(/\*\//g, '') // Remove comment end
    .replace(/--/g, '') // Remove SQL comment
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove inline event handlers
};

// Sanitize error messages to prevent XSS
const sanitizeError = (error) => {
  if (typeof error !== 'string') return 'An error occurred';
  return error
    .replace(/[<>]/g, '')
    .replace(/["']/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
};

const ROLE_OPTIONS = [
  {
    value: 'learner',
    label: 'Learner / Student',
    description: 'I want to learn from courses.',
  },
  {
    value: 'supervisor',
    label: 'Parent / Supervisor',
    description: 'I want to monitor a learner\u2019s progress.',
    disabled: true,
  },
  {
    value: 'creator',
    label: 'Course Creator',
    description: 'I want to build and publish courses.',
    disabled: true,
  },
];

export const Register = () => {
  const { register, socialLogin } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('learner');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setSocialLoading('google');
      try {
        await socialLogin({ provider: 'google', token: tokenResponse.access_token });
        navigate('/learn');
      } catch (err) {
        setError(err.message || 'Google sign-in failed.');
      } finally {
        setSocialLoading('');
      }
    },
    onError: () => setError('Google sign-in was cancelled or failed.'),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    // Trigger all validations
    const nameValid = validateName();
    const emailValid = validateEmail();
    const passwordValid = validatePassword();

    if (!nameValid || !emailValid || !passwordValid) {
      return;
    }

    setLoading(true);
    try {
      const sanitizedName = sanitizeInput(name.trim());
      await register({ username: sanitizedName, email, password, role, preferred_language: preferredLanguage });
      navigate('/learn');
    } catch (err) {
      setError(sanitizeError(err.message) || 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  const validateName = () => {
    const sanitizedName = sanitizeInput(name.trim());

    if (sanitizedName.length === 0) {
      setNameError('Name is required.');
      return false;
    }

    if (sanitizedName.length < 3) {
      setNameError('Name must be at least 3 characters long. Current length: ' + sanitizedName.length);
      return false;
    }

    if (!/^[a-zA-Z0-9\s]+$/.test(sanitizedName)) {
      const invalidChars = sanitizedName.replace(/[a-zA-Z0-9\s]/g, '');
      setNameError('Name can only contain letters, numbers, and spaces.');
      return false;
    }

    setNameError('');
    return true;
  };

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

  const validatePassword = () => {
    if (password.length === 0) {
      setPasswordError('Password is required.');
      return false;
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setPasswordError('Must be at least 8 characters long, with 1 uppercase letter and 1 number.');
      return false;
    }

    setPasswordError('');
    return true;
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    const sanitized = sanitizeInput(value);
    setName(sanitized);
    if (nameError) setNameError('');
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (emailError) setEmailError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-16">
      <SEO title="Register" description="Create a DreamerZ account with your name, email, and password." />
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 mt-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Create your account</h1>
          <p className="text-slate-600 mb-6">Sign up to get started.</p>

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
              {socialLoading === 'google' ? 'Signing up...' : 'Continue with Google'}
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or register with email</span>
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
              Name
              <div className="relative">
                <div className={`mt-2 relative rounded-xl border bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${nameError ? 'border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-500' : 'border-slate-200'}`}>
                  <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${nameError ? 'text-rose-500' : 'text-slate-400'}`} />
                  <input
                    id="register-name"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={handleNameChange}
                    onBlur={validateName}
                    className={`w-full rounded-xl border-0 bg-transparent py-3 pl-12 pr-4 outline-none ${nameError ? 'text-rose-900' : 'text-slate-900'}`}
                    placeholder="Your name"
                    required
                    minLength={3}
                    maxLength={50}
                  />
                </div>
                {nameError && (
                  <div className="absolute z-10 mt-2 left-0 right-0 bg-rose-600 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                    <div className="relative">
                      {nameError}
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-rose-600 transform rotate-45"></div>
                    </div>
                  </div>
                )}
              </div>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Email address
              <div className="relative">
                <div className={`mt-2 relative rounded-xl border bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${emailError ? 'border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-500' : 'border-slate-200'}`}>
                  <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${emailError ? 'text-rose-500' : 'text-slate-400'}`} />
                  <input
                    id="register-email"
                    name="email"
                    autoComplete="username email"
                    type="email"
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
              <div className="relative">
                <div className={`mt-2 relative rounded-xl border bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${passwordError ? 'border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-500' : 'border-slate-200'}`}>
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 ${passwordError ? 'text-rose-500' : 'text-slate-400'}`} />
                  <input
                    id="register-password"
                    name="new-password"
                    autoComplete="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    onBlur={validatePassword}
                    className={`w-full rounded-xl border-0 bg-transparent py-3 pl-12 pr-12 outline-none ${passwordError ? 'text-rose-900' : 'text-slate-900'}`}
                    placeholder="Create a password"
                    required
                    minLength={8}
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
                {passwordError && (
                  <div className="absolute z-10 mt-2 left-0 right-0 bg-rose-600 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                    <div className="relative">
                      {passwordError}
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-rose-600 transform rotate-45"></div>
                    </div>
                  </div>
                )}
              </div>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              I am a…
              <div className="mt-2 relative rounded-xl border border-slate-200 bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={role}
                  onChange={(e) => {
                    const target = ROLE_OPTIONS.find((o) => o.value === e.target.value);
                    if (!target || target.disabled) return;
                    setRole(e.target.value);
                  }}
                  className="w-full rounded-xl border-0 bg-transparent py-3 pl-12 pr-4 text-slate-900 outline-none appearance-none cursor-pointer"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                      {opt.label}{opt.disabled ? ' — coming soon' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {ROLE_OPTIONS.find((o) => o.value === role)?.description}
              </p>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Preferred language
              <div className="mt-2 relative rounded-xl border border-slate-200 bg-slate-50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={preferredLanguage}
                  onChange={(e) => {
                    const target = LANGUAGES.find((l) => l.code === e.target.value);
                    if (!target || target.disabled) return;
                    setPreferredLanguage(e.target.value);
                  }}
                  className="w-full rounded-xl border-0 bg-transparent py-3 pl-12 pr-4 text-slate-900 outline-none appearance-none cursor-pointer"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} disabled={lang.disabled}>
                      {lang.flag} {lang.nativeName} ({lang.name}){lang.disabled ? ' — coming soon' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Only English is available right now. More languages coming soon.
              </p>
            </label>

            {error && <div className="text-sm text-rose-600">{error}</div>}

            <Button type="submit" className="w-full" disabled={loading || nameError || emailError || passwordError}>
              {loading ? 'Creating account...' : 'Register'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:text-primary/80">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
