'use client';

import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode
} from 'react';
import { authAPI } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────
export interface UserPreferences {
  language: 'en' | 'ar';
  timezone: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** aliases kept for backward-compat */
  first_name?: string;
  last_name?: string;
  role: string;
  roleId: string;
  phone?: string;
  avatarUrl?: string;
  lastLogin?: string;
  preferences?: UserPreferences;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  language: 'en' | 'ar';
  setLanguage: (lang: 'en' | 'ar') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguageState] = useState<'en' | 'ar'>('en');

  // Persist language in localStorage + apply RTL
  const applyLanguage = useCallback((lang: 'en' | 'ar') => {
    setLanguageState(lang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('language', lang);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      const savedLang = (localStorage.getItem('language') as 'en' | 'ar') || 'en';

      applyLanguage(savedLang);

      if (token && savedUser) {
        try {
          const parsed: User = JSON.parse(savedUser);
          // Ensure both name formats are present
          parsed.first_name = parsed.first_name || parsed.firstName;
          parsed.last_name = parsed.last_name || parsed.lastName;
          setUser(parsed);

          // Refresh user data silently
          try {
            const resp = await authAPI.me();
            if (resp.data?.data) {
              const fresh = resp.data.data;
              const merged: User = {
                id: fresh.id,
                email: fresh.email,
                firstName: fresh.firstName || fresh.first_name,
                lastName: fresh.lastName || fresh.last_name,
                first_name: fresh.firstName || fresh.first_name,
                last_name: fresh.lastName || fresh.last_name,
                role: fresh.role,
                roleId: fresh.roleId || fresh.role_id,
                phone: fresh.phone,
                avatarUrl: fresh.avatarUrl || fresh.avatar_url,
                lastLogin: fresh.lastLogin || fresh.last_login,
                preferences: fresh.preferences,
              };
              setUser(merged);
              localStorage.setItem('user', JSON.stringify(merged));
              if (fresh.preferences?.language) {
                applyLanguage(fresh.preferences.language as 'en' | 'ar');
              }
            }
          } catch {
            // Silent refresh failure is okay; user is still logged in from localStorage
          }
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    restore();
  }, [applyLanguage]);

  const login = async (email: string, password: string, rememberMe = false) => {
    const response = await authAPI.login({ email, password, rememberMe });
    const payload = response.data?.data;

    if (!payload?.token) {
      throw new Error(response.data?.message || 'Login failed');
    }

    const { token, refreshToken, user: raw } = payload;

    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

    const userData: User = {
      id: raw.id,
      email: raw.email,
      firstName: raw.firstName || raw.first_name,
      lastName: raw.lastName || raw.last_name,
      first_name: raw.firstName || raw.first_name,
      last_name: raw.lastName || raw.last_name,
      role: raw.role,
      roleId: raw.roleId || raw.role_id,
      phone: raw.phone,
      avatarUrl: raw.avatarUrl || raw.avatar_url,
      lastLogin: raw.lastLogin || raw.last_login,
      preferences: raw.preferences,
    };

    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    // Apply language from preferences
    if (raw.preferences?.language) {
      applyLanguage(raw.preferences.language as 'en' | 'ar');
    }
  };

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await authAPI.logout(refreshToken ? { refreshToken } : {});
    } catch { /* ignore */ }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  }, []);

  const setLanguage = useCallback(
    async (lang: 'en' | 'ar') => {
      applyLanguage(lang);
      if (user) {
        try {
          await authAPI.updatePreferences({ language: lang });
          setUser(prev =>
            prev
              ? { ...prev, preferences: { ...(prev.preferences || { timezone: 'UTC' }), language: lang } }
              : prev
          );
        } catch { /* non-blocking */ }
      }
    },
    [user, applyLanguage]
  );

  const updatePreferences = useCallback(
    async (prefs: Partial<UserPreferences>) => {
      await authAPI.updatePreferences(prefs);
      if (prefs.language) applyLanguage(prefs.language as 'en' | 'ar');
      setUser(prev =>
        prev
          ? { ...prev, preferences: { ...(prev.preferences || { language: 'en', timezone: 'UTC' }), ...prefs } as UserPreferences }
          : prev
      );
    },
    [applyLanguage]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        updatePreferences,
        language,
        setLanguage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
