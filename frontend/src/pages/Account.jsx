import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UserCircle2, Mail, Clock3, Phone, Globe, Lock, Palette, Sun, Moon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { SEO } from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
import { useLanguage, LANGUAGES } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { toast } from 'sonner';

const formatDateTime = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
};

export const Account = () => {
  const { user, isAuthenticated, isLoaded: authLoaded, token, refreshUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  // Theme persists locally via useTheme (localStorage), so it survives
  // logout. The server copy (user.theme) is for cross-device sync only.
  const { theme, setTheme } = useTheme();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    countryCode: '+1',
  });
  const [usernameError, setUsernameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    if (!user) return;
    setFormData({
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      countryCode: user.country_code || '+1',
    });
    // Cross-device sync: if the server has a saved preference that's
    // different from this device's, adopt the server's. Only runs once
    // per user-object change, so toggling locally afterwards isn't
    // clobbered.
    if (user.theme && user.theme !== theme) {
      setTheme(user.theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (authLoaded && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!authLoaded || !user) {
    return (
      <div className="min-h-screen bg-slate-50 pt-24 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = user.username;

  // Profile handlers
  const handleChange = (field) => (event) => {
    setFormData((current) => ({
      ...current,
      [field]: event.target.value
    }));
    // Clear error when user starts typing
    if (field === 'username') setUsernameError('');
    if (field === 'phone') setPhoneError('');
  };

  const validateUsername = () => {
    const username = formData.username.trim();
    if (username.length === 0) {
      setUsernameError('Name is required.');
      return false;
    }
    if (username.length < 3) {
      setUsernameError('Name must be at least 3 characters long.');
      return false;
    }
    if (!/^[a-zA-Z0-9\s]+$/.test(username)) {
      setUsernameError('Name can only contain letters, numbers, and spaces.');
      return false;
    }
    setUsernameError('');
    return true;
  };

  const validatePhone = () => {
    const phone = formData.phone.trim();
    if (phone.length > 0 && !/^\d+$/.test(phone)) {
      setPhoneError('Phone number can only contain numbers.');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const usernameValid = validateUsername();
    const phoneValid = validatePhone();
    if (!usernameValid || !phoneValid) return;

    try {
      const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: formData.username,
          phone: formData.phone || null,
          country_code: formData.countryCode || null,
          theme,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to update profile');
      }

      // useTheme already applied the DOM class + wrote to localStorage
      // when the user clicked the Light/Dark toggle; nothing extra to do
      // on save. We just refresh the user blob so the server's copy
      // matches if a remote update happened.
      await refreshUser();

      toast.success('Profile updated successfully.');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    }
  };

  return (
    <>
      <SEO title="My Account" description="Manage your DreamerZ profile and learning data." />
      <div className="min-h-screen bg-slate-50 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* User header card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <UserCircle2 className="w-9 h-9" />
              </div>
              <div className="flex-grow">
                <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
                <p className="text-sm text-slate-500">@{user.username}</p>
              </div>
              <div className="hidden sm:flex flex-col text-right text-sm text-slate-500 gap-1">
                <div className="flex items-center gap-2 justify-end">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {user.email}
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Clock3 className="w-4 h-4 text-slate-400" />
                  Last login: {formatDateTime(user.lastLoginAt)}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Profile Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">Profile details</h2>
                <p className="text-slate-600 mt-1">Keep your personal details up to date.</p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block text-sm font-medium text-slate-700">
                  Full Name
                  <div className="relative">
                    <input
                      value={formData.username}
                      onChange={handleChange('username')}
                      onBlur={validateUsername}
                      className={`mt-1.5 w-full rounded-xl border px-4 py-2.5 text-slate-900 outline-none focus:ring-1 ${
                        usernameError
                          ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500 bg-rose-50'
                          : 'border-slate-200 bg-slate-50 focus:border-primary focus:ring-primary'
                      }`}
                      placeholder="Your full name"
                    />
                    {usernameError && (
                      <div className="absolute z-10 mt-2 left-0 right-0 bg-rose-600 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                        <div className="relative">
                          {usernameError}
                          <div className="absolute -top-1 left-4 w-2 h-2 bg-rose-600 transform rotate-45"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Email address
                  <input
                    type="email"
                    value={formData.email}
                    readOnly
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-500 outline-none cursor-not-allowed"
                    placeholder="email@example.com"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  <span className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    Phone
                  </span>
                  <div className="mt-1.5 flex gap-2 relative">
                    <select
                      value={formData.countryCode}
                      onChange={handleChange('countryCode')}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none cursor-pointer w-28"
                    >
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+86">🇨🇳 +86</option>
                      <option value="+81">🇯🇵 +81</option>
                      <option value="+49">🇩🇪 +49</option>
                      <option value="+33">🇫🇷 +33</option>
                      <option value="+61">🇦🇺 +61</option>
                      <option value="+55">🇧🇷 +55</option>
                      <option value="+39">🇮🇹 +39</option>
                      <option value="+34">🇪🇸 +34</option>
                      <option value="+7">🇷🇺 +7</option>
                      <option value="+82">🇰🇷 +82</option>
                      <option value="+31">🇳🇱 +31</option>
                      <option value="+27">🇿🇦 +27</option>
                      <option value="+52">🇲🇽 +52</option>
                      <option value="+1">🇨🇦 +1</option>
                      <option value="+65">🇸🇬 +65</option>
                      <option value="+64">🇳🇿 +64</option>
                      <option value="+351">🇵🇹 +351</option>
                    </select>
                    <div className="flex-1 relative">
                      <input
                        value={formData.phone}
                        onChange={handleChange('phone')}
                        onBlur={validatePhone}
                        className={`w-full rounded-xl border px-4 py-2.5 text-slate-900 outline-none focus:ring-1 ${
                          phoneError
                            ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500 bg-rose-50'
                            : 'border-slate-200 bg-slate-50 focus:border-primary focus:ring-primary'
                        }`}
                        placeholder="Phone number"
                      />
                      {phoneError && (
                        <div className="absolute z-10 mt-2 left-0 right-0 bg-rose-600 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                          <div className="relative">
                            {phoneError}
                            <div className="absolute -top-1 left-4 w-2 h-2 bg-rose-600 transform rotate-45"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    Preferred Language
                  </span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.nativeName} ({lang.name})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">Course content will be displayed in this language when available</p>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  <span className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-slate-400" />
                    Theme
                  </span>
                  <div className="mt-1.5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-all ${
                        theme === 'light'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <Sun className="w-5 h-5" />
                      Light
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-all ${
                        theme === 'dark'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <Moon className="w-5 h-5" />
                      Dark
                    </button>
                  </div>
                </label>

                <div className="flex justify-end pt-2">
                  <Button type="submit">Save profile</Button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mt-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Password</h3>
                    <p className="text-sm text-slate-500 mt-1">Choose a new password whenever you want.</p>
                  </div>
                </div>
                <Link
                  to="/reset-password"
                  className="text-sm font-semibold text-primary hover:text-primary/80 px-4 py-2 rounded-xl border border-primary/20 hover:bg-primary/5 transition-colors"
                >
                  Reset password
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Account;
