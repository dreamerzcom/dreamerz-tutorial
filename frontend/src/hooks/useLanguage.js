import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';

const LANG_STORAGE_KEY = 'dreamerz_language';
const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');

// Supported languages — mirrors backend config.SUPPORTED_LANGUAGES.
// `disabled: true` keeps a language visible in the UI but prevents selection
// (used while translations are still in progress).
export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳', disabled: true },
];

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const { user, token, updateProfile } = useAuth();

  // Initialise from: user preference > localStorage > default 'en'
  const [language, setLanguageState] = useState(() => {
    if (user?.preferredLanguage) return user.preferredLanguage;
    try {
      return localStorage.getItem(LANG_STORAGE_KEY) || 'en';
    } catch {
      return 'en';
    }
  });

  // Sync when user logs in and their preference is different
  useEffect(() => {
    if (user?.preferredLanguage && user.preferredLanguage !== language) {
      setLanguageState(user.preferredLanguage);
      try { localStorage.setItem(LANG_STORAGE_KEY, user.preferredLanguage); } catch {}
    }
  }, [user?.preferredLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLanguage = useCallback(async (langCode) => {
    // Refuse to switch to a language that's marked disabled
    const target = LANGUAGES.find((l) => l.code === langCode);
    if (!target || target.disabled) return;
    setLanguageState(langCode);
    try { localStorage.setItem(LANG_STORAGE_KEY, langCode); } catch {}

    // Update profile in auth context
    if (updateProfile) {
      updateProfile({ preferredLanguage: langCode });
    }

    // Persist to backend if logged in
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/language`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ preferred_language: langCode }),
        });
      } catch {
        // Silent fail — language will sync on next login
      }
    }
  }, [token, updateProfile]);

  const currentLanguage = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, currentLanguage, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export default useLanguage;
