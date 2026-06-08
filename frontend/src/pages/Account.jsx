import { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircle2, Mail, Clock3, Phone, Globe, Lock, Palette, Sun, Moon,
  Briefcase, BookOpen, Target, X, Plus, ChevronDown, CheckCircle2, Circle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { SEO } from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
import { useLanguage, LANGUAGES } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { toast } from 'sonner';

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance & Banking', 'Education',
  'Retail & E-commerce', 'Manufacturing', 'Consulting', 'Marketing & Media',
  'Legal', 'Real Estate', 'Non-profit', 'Government', 'Other',
];

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: 'Just starting out' },
  { value: 'intermediate', label: 'Intermediate', desc: '1–3 years experience' },
  { value: 'advanced', label: 'Advanced', desc: '3–7 years experience' },
  { value: 'expert', label: 'Expert', desc: '7+ years experience' },
];

const LEARNING_GOALS = [
  { value: 'skill_development', label: 'Skill Development', desc: 'Build new technical skills' },
  { value: 'career_change', label: 'Career Change', desc: 'Switch to a new field' },
  { value: 'academic_growth', label: 'Academic Growth', desc: 'Supplement formal education' },
  { value: 'personal_interest', label: 'Personal Interest', desc: 'Learn for enjoyment' },
];

const INTEREST_CHIPS = [
  'Artificial Intelligence', 'Machine Learning', 'Data Science',
  'Coding & Development', 'English Communication', 'Leadership',
  'Marketing', 'UX / Design', 'Finance', 'Project Management',
  'Cloud Computing', 'Cybersecurity', 'Content Creation', 'Sales',
];

// Exported so LearnHub can import it for the completion card
export const computeProfileCompletion = (user) => {
  if (!user) return 0;
  const fields = [
    user.username,
    user.email,
    user.phone,
    user.age,
    user.industry,
    user.profession,
    user.interests?.length > 0,
    user.desiredTopics?.length > 0,
    user.experienceLevel,
    user.learningGoal,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
};

const formatDateTime = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
};

// Returns class string for an input/select that may be empty
const fieldCls = (isFilled, extra = '') =>
  `${extra} mt-1.5 w-full rounded-xl border px-4 py-2.5 text-slate-900 outline-none transition-colors ${
    isFilled
      ? 'border-slate-200 bg-slate-50 focus:border-primary focus:ring-1 focus:ring-primary'
      : 'border-amber-300 bg-amber-50/60 focus:border-amber-400 focus:ring-1 focus:ring-amber-300'
  }`;

const FieldHint = ({ filled }) =>
  filled ? null : (
    <p className="mt-1 text-xs text-amber-600 font-medium">Fill in to complete your profile</p>
  );

export const Account = () => {
  const { user, isAuthenticated, isLoaded: authLoaded, token, refreshUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    countryCode: '+1',
  });
  const [usernameError, setUsernameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [learningProfile, setLearningProfile] = useState({
    age: '',
    industry: '',
    profession: '',
    interests: [],
    desiredTopics: [],
    experienceLevel: '',
    learningGoal: '',
  });
  const [topicInput, setTopicInput] = useState('');

  useEffect(() => {
    if (!user) return;
    setFormData({
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      countryCode: user.country_code || '+1',
    });
    setLearningProfile({
      age: user.age || '',
      industry: user.industry || '',
      profession: user.profession || '',
      interests: user.interests || [],
      desiredTopics: user.desiredTopics || [],
      experienceLevel: user.experienceLevel || '',
      learningGoal: user.learningGoal || '',
    });
    if (user.theme && user.theme !== theme) {
      setTheme(user.theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Live per-field completion status — updates as the user types
  const fieldStatus = useMemo(() => ({
    phone: !!formData.phone.trim(),
    age: !!learningProfile.age,
    industry: !!learningProfile.industry,
    profession: !!learningProfile.profession.trim(),
    interests: learningProfile.interests.length > 0,
    desiredTopics: learningProfile.desiredTopics.length > 0,
    experienceLevel: !!learningProfile.experienceLevel,
    learningGoal: !!learningProfile.learningGoal,
  }), [formData.phone, learningProfile]);

  const completionPct = useMemo(() => {
    // username + email are always present (2 mandatory) + 8 optional
    const filled = 2 + Object.values(fieldStatus).filter(Boolean).length;
    return Math.round((filled / 10) * 100);
  }, [fieldStatus]);

  const FIELD_LABELS = {
    phone: 'Phone number',
    age: 'Age',
    industry: 'Industry',
    profession: 'Profession',
    interests: 'Interests',
    desiredTopics: 'Courses I\'m Looking For',
    experienceLevel: 'Experience Level',
    learningGoal: 'Learning Goal',
  };

  const missingFields = useMemo(
    () => Object.entries(fieldStatus).filter(([, ok]) => !ok).map(([k]) => k),
    [fieldStatus],
  );

  const barColor =
    completionPct === 100
      ? 'bg-emerald-500'
      : completionPct >= 70
      ? 'bg-blue-500'
      : completionPct >= 40
      ? 'bg-amber-500'
      : 'bg-rose-500';

  if (authLoaded && !isAuthenticated) return <Navigate to="/login" replace />;
  if (!authLoaded || !user) {
    return (
      <div className="min-h-screen bg-slate-50 pt-24 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = user.username;

  const handleChange = (field) => (event) => {
    setFormData((c) => ({ ...c, [field]: event.target.value }));
    if (field === 'username') setUsernameError('');
    if (field === 'phone') setPhoneError('');
  };

  const validateUsername = () => {
    const u = formData.username.trim();
    if (!u) { setUsernameError('Name is required.'); return false; }
    if (u.length < 3) { setUsernameError('Name must be at least 3 characters long.'); return false; }
    if (!/^[a-zA-Z0-9\s]+$/.test(u)) { setUsernameError('Name can only contain letters, numbers, and spaces.'); return false; }
    setUsernameError('');
    return true;
  };

  const validatePhone = () => {
    const p = formData.phone.trim();
    if (p && !/^\d+$/.test(p)) { setPhoneError('Phone number can only contain numbers.'); return false; }
    setPhoneError('');
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateUsername() || !validatePhone()) return;
    try {
      const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: formData.username,
          phone: formData.phone || null,
          country_code: formData.countryCode || null,
          theme,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to update profile');
      }
      await refreshUser();
      toast.success('Profile updated successfully.');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    }
  };

  const toggleInterest = (interest) =>
    setLearningProfile((p) => ({
      ...p,
      interests: p.interests.includes(interest)
        ? p.interests.filter((i) => i !== interest)
        : [...p.interests, interest],
    }));

  const addTopic = () => {
    const topic = topicInput.trim();
    if (topic && !learningProfile.desiredTopics.includes(topic))
      setLearningProfile((p) => ({ ...p, desiredTopics: [...p.desiredTopics, topic] }));
    setTopicInput('');
  };

  const removeTopic = (topic) =>
    setLearningProfile((p) => ({ ...p, desiredTopics: p.desiredTopics.filter((t) => t !== topic) }));

  const handleLearningProfileSubmit = async (event) => {
    event.preventDefault();
    try {
      const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          age: learningProfile.age ? parseInt(learningProfile.age, 10) : null,
          industry: learningProfile.industry || null,
          profession: learningProfile.profession || null,
          interests: learningProfile.interests,
          desired_topics: learningProfile.desiredTopics,
          experience_level: learningProfile.experienceLevel || null,
          learning_goal: learningProfile.learningGoal || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to update learning profile');
      }
      await refreshUser();
      toast.success('Learning profile updated successfully.');
    } catch (err) {
      toast.error(err.message || 'Failed to update learning profile');
    }
  };

  return (
    <>
      <SEO title="My Account" description="Manage your DreamerZ profile and learning data." />
      <div className="min-h-screen bg-slate-50 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* ── Header card ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-6"
          >
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <UserCircle2 className="w-9 h-9" />
              </div>
              <div className="flex-grow min-w-0">
                <h1 className="text-2xl font-bold text-slate-900 truncate">{displayName}</h1>
                <p className="text-sm text-slate-500">@{user.username}</p>
              </div>
              <div className="hidden sm:flex flex-col text-right text-sm text-slate-500 gap-1 flex-shrink-0">
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

            {/* ── Live completion bar ──────────────────────────── */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Profile completion</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={completionPct}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`text-sm font-bold tabular-nums ${
                      completionPct === 100 ? 'text-emerald-600' : completionPct >= 70 ? 'text-blue-600' : completionPct >= 40 ? 'text-amber-600' : 'text-rose-600'
                    }`}
                  >
                    {completionPct}%
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full ${barColor}`}
                  initial={false}
                  animate={{ width: `${completionPct}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>

              {completionPct === 100 ? (
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Your profile is complete — you'll get the best course recommendations!
                </p>
              ) : (
                <div>
                  <p className="text-xs text-slate-500 mb-2">
                    {missingFields.length} field{missingFields.length !== 1 ? 's' : ''} left to complete your profile:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingFields.map((key) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700"
                      >
                        <Circle className="w-2.5 h-2.5" />
                        {FIELD_LABELS[key]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

            {/* ── Profile Details form ─────────────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-4">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">Profile details</h2>
                <p className="text-slate-600 mt-1">Keep your personal details up to date.</p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Full Name — always filled, no amber */}
                <label className="block text-sm font-medium text-slate-700">
                  Full Name
                  <div className="relative">
                    <input
                      value={formData.username}
                      onChange={handleChange('username')}
                      onBlur={validateUsername}
                      className={`mt-1.5 w-full rounded-xl border px-4 py-2.5 text-slate-900 outline-none focus:ring-1 transition-colors ${
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
                          <div className="absolute -top-1 left-4 w-2 h-2 bg-rose-600 transform rotate-45" />
                        </div>
                      </div>
                    )}
                  </div>
                </label>

                {/* Email — readonly, always filled */}
                <label className="block text-sm font-medium text-slate-700">
                  Email address
                  <input
                    type="email"
                    value={formData.email}
                    readOnly
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-500 outline-none cursor-not-allowed"
                  />
                </label>

                {/* Phone — optional, amber when empty */}
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
                      <option value="+65">🇸🇬 +65</option>
                      <option value="+64">🇳🇿 +64</option>
                      <option value="+351">🇵🇹 +351</option>
                    </select>
                    <div className="flex-1 relative">
                      <input
                        value={formData.phone}
                        onChange={handleChange('phone')}
                        onBlur={validatePhone}
                        className={`w-full rounded-xl border px-4 py-2.5 text-slate-900 outline-none focus:ring-1 transition-colors ${
                          phoneError
                            ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500 bg-rose-50'
                            : fieldStatus.phone
                            ? 'border-slate-200 bg-slate-50 focus:border-primary focus:ring-primary'
                            : 'border-amber-300 bg-amber-50/60 focus:border-amber-400 focus:ring-amber-300'
                        }`}
                        placeholder="Phone number"
                      />
                      {phoneError && (
                        <div className="absolute z-10 mt-2 left-0 right-0 bg-rose-600 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                          <div className="relative">
                            {phoneError}
                            <div className="absolute -top-1 left-4 w-2 h-2 bg-rose-600 transform rotate-45" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <FieldHint filled={fieldStatus.phone} />
                </label>

                {/* Preferred Language */}
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

                {/* Theme */}
                <label className="block text-sm font-medium text-slate-700">
                  <span className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-slate-400" />
                    Theme
                  </span>
                  <div className="mt-1.5 flex gap-3">
                    {[{ val: 'light', Icon: Sun, label: 'Light' }, { val: 'dark', Icon: Moon, label: 'Dark' }].map(({ val, Icon, label }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setTheme(val)}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-all ${
                          theme === val
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </label>

                <div className="flex justify-end pt-2">
                  <Button type="submit">Save profile</Button>
                </div>
              </form>
            </div>

            {/* ── Learning Profile form ────────────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-4">
              <div className="mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Learning Profile</h2>
                  <p className="text-slate-600 text-sm mt-0.5">Help us recommend the right courses for you.</p>
                </div>
              </div>

              <form className="space-y-6" onSubmit={handleLearningProfileSubmit}>

                {/* Age + Industry */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={learningProfile.age}
                      onChange={(e) => setLearningProfile((p) => ({ ...p, age: e.target.value }))}
                      className={fieldCls(fieldStatus.age)}
                      placeholder="Your age"
                    />
                    <FieldHint filled={fieldStatus.age} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        Industry
                      </span>
                    </label>
                    <div className="relative">
                      <select
                        value={learningProfile.industry}
                        onChange={(e) => setLearningProfile((p) => ({ ...p, industry: e.target.value }))}
                        className={fieldCls(fieldStatus.industry, 'appearance-none cursor-pointer')}
                      >
                        <option value="">Select your industry</option>
                        {INDUSTRIES.map((ind) => (
                          <option key={ind} value={ind}>{ind}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    <FieldHint filled={fieldStatus.industry} />
                  </div>
                </div>

                {/* Profession */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Profession / Job Title</label>
                  <input
                    type="text"
                    value={learningProfile.profession}
                    onChange={(e) => setLearningProfile((p) => ({ ...p, profession: e.target.value }))}
                    className={fieldCls(fieldStatus.profession)}
                    placeholder="e.g. Software Engineer, Marketing Manager"
                  />
                  <FieldHint filled={fieldStatus.profession} />
                </div>

                {/* Experience Level */}
                <div>
                  <p className={`text-sm font-medium mb-2 ${fieldStatus.experienceLevel ? 'text-slate-700' : 'text-amber-700'}`}>
                    Experience Level
                    {!fieldStatus.experienceLevel && <span className="ml-2 text-xs font-normal text-amber-600">— select one to complete your profile</span>}
                  </p>
                  <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl p-2 transition-colors ${!fieldStatus.experienceLevel ? 'bg-amber-50/60 border border-amber-200' : ''}`}>
                    {EXPERIENCE_LEVELS.map(({ value, label, desc }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLearningProfile((p) => ({ ...p, experienceLevel: value }))}
                        className={`text-left rounded-xl border px-3 py-2.5 transition-all ${
                          learningProfile.experienceLevel === value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-semibold text-sm">{label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Learning Goal */}
                <div>
                  <p className={`text-sm font-medium mb-2 flex items-center gap-2 ${fieldStatus.learningGoal ? 'text-slate-700' : 'text-amber-700'}`}>
                    <Target className="w-4 h-4" />
                    Learning Goal
                    {!fieldStatus.learningGoal && <span className="text-xs font-normal text-amber-600">— select one to complete your profile</span>}
                  </p>
                  <div className={`grid grid-cols-2 gap-2 rounded-xl p-2 transition-colors ${!fieldStatus.learningGoal ? 'bg-amber-50/60 border border-amber-200' : ''}`}>
                    {LEARNING_GOALS.map(({ value, label, desc }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLearningProfile((p) => ({ ...p, learningGoal: value }))}
                        className={`text-left rounded-xl border px-3 py-2.5 transition-all ${
                          learningProfile.learningGoal === value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-semibold text-sm">{label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interests */}
                <div>
                  <p className={`text-sm font-medium mb-2 ${fieldStatus.interests ? 'text-slate-700' : 'text-amber-700'}`}>
                    Interests
                    {!fieldStatus.interests && <span className="ml-2 text-xs font-normal text-amber-600">— choose at least one</span>}
                  </p>
                  <div className={`flex flex-wrap gap-2 rounded-xl p-3 transition-colors ${!fieldStatus.interests ? 'bg-amber-50/60 border border-amber-200' : 'bg-slate-50 border border-slate-100'}`}>
                    {INTEREST_CHIPS.map((interest) => (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          learningProfile.interests.includes(interest)
                            ? 'border-primary bg-primary text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Desired Topics */}
                <div>
                  <p className={`text-sm font-medium mb-1 ${fieldStatus.desiredTopics ? 'text-slate-700' : 'text-amber-700'}`}>
                    Courses I'm Looking For
                    {!fieldStatus.desiredTopics && <span className="ml-2 text-xs font-normal text-amber-600">— add at least one topic</span>}
                  </p>
                  <p className="text-xs text-slate-400 mb-2">Type a topic and press Enter to add it.</p>
                  <div className={`rounded-xl p-3 transition-colors ${!fieldStatus.desiredTopics ? 'bg-amber-50/60 border border-amber-200' : 'bg-slate-50 border border-slate-100'}`}>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        placeholder="e.g. Prompt Engineering, Business English"
                      />
                      <button
                        type="button"
                        onClick={addTopic}
                        className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary transition-all text-sm font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                    {learningProfile.desiredTopics.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {learningProfile.desiredTopics.map((topic) => (
                          <span
                            key={topic}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border border-violet-200 bg-violet-50 text-violet-700"
                          >
                            {topic}
                            <button type="button" onClick={() => removeTopic(topic)}>
                              <X className="w-3.5 h-3.5 hover:text-violet-900" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit">Save learning profile</Button>
                </div>
              </form>
            </div>

            {/* ── Password ─────────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
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
