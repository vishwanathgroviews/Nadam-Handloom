import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | unauthenticated

  const refreshUser = useCallback(async () => {
    const profile = await api.getCurrentUser();
    setUser(profile);
    setStatus(profile ? 'authenticated' : 'unauthenticated');
    return profile;
  }, []);

  useEffect(() => {
    (async () => {
      const restored = await api.bootstrapSession();
      if (restored) {
        await refreshUser();
      } else {
        setStatus('unauthenticated');
      }
    })();
  }, [refreshUser]);

  const login = useCallback(
    async (phone, mpin) => {
      const result = await api.loginUser(phone, mpin);
      if (!result.requiresVerification) {
        await refreshUser();
      }
      return result;
    },
    [refreshUser]
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      login,
      logout,
      refreshUser,
    }),
    [user, status, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
