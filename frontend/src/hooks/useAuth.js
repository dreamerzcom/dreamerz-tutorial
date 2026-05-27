import { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TOKEN_KEY = 'dreamerz_beta_token_v1';
const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');

const AuthContext = createContext(null);

const getStoredToken = () => {
  try {
    // Try new TOKEN_KEY first
    let token = localStorage.getItem(TOKEN_KEY);
    if (token) return token;
    
    // Fallback to old STORAGE_KEY for migration
    const oldAuth = localStorage.getItem('dreamerz_beta_auth_v1');
    if (oldAuth) {
      try {
        const parsed = JSON.parse(oldAuth);
        if (parsed?.token) {
          // Migrate to new storage
          saveToken(parsed.token);
          localStorage.removeItem('dreamerz_beta_auth_v1');
          return parsed.token;
        }
      } catch (e) {
        console.error('Failed to parse old auth data', e);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to parse token from localStorage', error);
    return null;
  }
};

const saveToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

const storePasswordCredential = async ({ username, email, password }) => {
  if (!window.PasswordCredential || !navigator.credentials || !password) {
    return;
  }

  try {
    const credential = new window.PasswordCredential({
      id: email || username,
      name: username || email,
      password,
    });
    await navigator.credentials.store(credential);
  } catch (error) {
    console.debug('Password credential storage was skipped', error);
  }
};

const buildUserProfile = ({
  username,
  email,
  profile,
  phone,
  country_code,
  theme,
  lastLoginAt,
  createdAt,
  preferredLanguage,
  role,
  aiGenerationEnabled,
  trialExpiresAt,
  trialDaysRemaining,
}) => ({
  username,
  email,
  role: role || 'learner',
  aiGenerationEnabled: aiGenerationEnabled || false,
  preferredLanguage: preferredLanguage || 'en',
  firstName: profile?.firstName || '',
  lastName: profile?.lastName || '',
  phone: phone || profile?.phone || '',
  country_code: country_code || profile?.country_code || '',
  bio: profile?.bio || '',
  location: profile?.location || '',
  theme: theme || 'light',
  lastLoginAt: lastLoginAt || new Date().toISOString(),
  createdAt: createdAt || new Date().toISOString(),
  // Free-trial bookkeeping. `trialExpiresAt` is an ISO string for learners
  // and null for exempt roles (admin/creator/supervisor — never gated).
  trialExpiresAt: trialExpiresAt || null,
  // We cache the server-computed number too, but `useAuth` recomputes from
  // `trialExpiresAt` on every render so the Navbar countdown stays current.
  trialDaysRemaining: trialDaysRemaining || null,
});

// Recompute days remaining locally so the Navbar badge updates as time
// passes without needing a server round-trip. Returns:
//   null  → exempt user (no trial)
//   0     → expired
//   N>0   → whole days left
const computeTrialDaysRemaining = (user) => {
  if (!user) return null;
  if (!user.trialExpiresAt) {
    // Exempt accounts (admins etc.) intentionally have a null expiry.
    // Learners with a null expiry mean a backfill miss → treat as expired.
    const role = (user.role || 'learner').toLowerCase();
    if (role === 'admin' || role === 'creator' || role === 'supervisor') {
      return null;
    }
    return 0;
  }
  const expiry = new Date(user.trialExpiresAt).getTime();
  if (Number.isNaN(expiry)) return 0;
  const ms = expiry - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
};

const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const storedToken = getStoredToken();
    if (storedToken) {
      if (isTokenExpired(storedToken)) {
        // Token expired — clear stored token
        clearToken();
      } else {
        setToken(storedToken);
        // Fetch fresh user data from backend
        fetch(`${API_BASE}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${storedToken}`,
          },
        })
          .then(res => {
            if (res.ok) return res.json();
            throw new Error('Failed to fetch user data');
          })
          .then(result => {
            setUser(buildUserProfile({
              username: result.username,
              email: result.email,
              preferredLanguage: result.preferred_language,
              phone: result.phone,
              country_code: result.country_code,
              theme: result.theme,
              profile: result.profile,
              createdAt: result.created_at,
              lastLoginAt: new Date().toISOString(),
              role: result.role,
              aiGenerationEnabled: result.ai_generation_enabled,
              trialExpiresAt: result.trial_expires_at,
              trialDaysRemaining: result.trial_days_remaining,
            }));
          })
          .catch(err => {
            console.error('Failed to fetch user data on mount', err);
            clearToken();
            setToken(null);
          })
          .finally(() => setIsLoaded(true));
        return;
      }
    }
    setIsLoaded(true);
  }, []);

  const login = useCallback(async ({ username, email, password }) => {
    const payload = { password };
    if (username) payload.username = username;
    if (email) payload.email = email;

    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.detail || result.message || 'Login failed');
    }

    const token = result.access_token;
    saveToken(token);
    setToken(token);

    const user = buildUserProfile({
      username: result.username,
      email: result.email,
      preferredLanguage: result.preferred_language,
      phone: result.phone,
      country_code: result.country_code,
      theme: result.theme,
      profile: result.profile,
      createdAt: result.created_at,
      lastLoginAt: new Date().toISOString(),
      role: result.role,
      aiGenerationEnabled: result.ai_generation_enabled,
      trialExpiresAt: result.trial_expires_at,
      trialDaysRemaining: result.trial_days_remaining,
    });

    setUser(user);
    await storePasswordCredential({ username: result.username || username, email: result.email || email, password });
    return { token, user };
  }, []);

  const socialLogin = useCallback(async ({ provider, token }) => {
    const response = await fetch(`${API_BASE}/api/auth/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, token }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.detail || 'Social login failed');
    }

    const accessToken = result.access_token;
    saveToken(accessToken);
    setToken(accessToken);

    const user = buildUserProfile({
      username: result.username,
      email: result.email,
      preferredLanguage: result.preferred_language,
      phone: result.phone,
      country_code: result.country_code,
      theme: result.theme,
      profile: result.profile,
      createdAt: result.created_at,
      lastLoginAt: new Date().toISOString(),
      role: result.role,
      aiGenerationEnabled: result.ai_generation_enabled,
      trialExpiresAt: result.trial_expires_at,
      trialDaysRemaining: result.trial_days_remaining,
    });

    setUser(user);
    return { token: accessToken, user };
  }, []);

  const register = useCallback(async ({ username, email, password, preferred_language, role }) => {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        email,
        password,
        preferred_language: preferred_language || 'en',
        role: role || 'learner',
      })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.detail || result.message || 'Registration failed');
    }

    await login({ username, email, password });
    navigate('/learn');
    return result;
  }, [login, navigate]);

  // Swap in a fresh TokenResponse (e.g. after change-password).
  // Keeps the user logged in seamlessly without bouncing through /login.
  const applyAuthResponse = useCallback((response) => {
    const token = response.access_token;
    saveToken(token);
    setToken(token);

    const user = buildUserProfile({
      username: response.username,
      email: response.email,
      preferredLanguage: response.preferred_language,
      phone: response.phone,
      country_code: response.country_code,
      theme: response.theme,
      profile: response.profile,
      createdAt: response.created_at,
      lastLoginAt: new Date().toISOString(),
      role: response.role,
      aiGenerationEnabled: response.ai_generation_enabled,
      trialExpiresAt: response.trial_expires_at,
      trialDaysRemaining: response.trial_days_remaining,
    });

    setUser(user);
    return { token, user };
  }, []);

  const updateProfile = useCallback((updates) => {
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      return {
        ...currentUser,
        ...updates
      };
    });
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const result = await response.json();
        const updatedUser = buildUserProfile({
          username: result.username,
          email: result.email,
          preferredLanguage: result.preferred_language,
          phone: result.phone,
          country_code: result.country_code,
          theme: result.theme,
          profile: result.profile,
          createdAt: result.created_at,
          lastLoginAt: new Date().toISOString(),
          role: result.role,
          aiGenerationEnabled: result.ai_generation_enabled,
          trialExpiresAt: result.trial_expires_at,
          trialDaysRemaining: result.trial_days_remaining,
        });
        setUser(updatedUser);
      }
    } catch (error) {
      console.error('Failed to refresh user data', error);
    }
  }, [token]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setToken(null);
    navigate('/');
  }, [navigate]);

  // Recomputed every render so the badge keeps ticking down without a
  // refresh. null → exempt (no trial); 0 → expired; N>0 → days left.
  const trialDaysRemaining = computeTrialDaysRemaining(user);
  const isTrialActive = trialDaysRemaining === null || trialDaysRemaining > 0;
  const isTrialExpired =
    Boolean(token) && trialDaysRemaining !== null && trialDaysRemaining <= 0;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoaded,
        isAuthenticated: Boolean(token),
        trialDaysRemaining,
        isTrialActive,
        isTrialExpired,
        login,
        socialLogin,
        register,
        applyAuthResponse,
        updateProfile,
        refreshUser,
        logout,
        hasRole: (user, ...roles) => roles.includes(user?.role || 'learner'),
        isAdmin: () => user?.role === 'admin',
        isCreator: () => user?.role === 'creator' || user?.role === 'admin',
        isSupervisor: () => user?.role === 'supervisor' || user?.role === 'admin',
        isLearner: () => user?.role === 'learner' || (!user?.role),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
