import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest, refreshAccessToken, registerAuthHandlers, REFRESH_TOKEN_KEY, isAuthFailure } from '../api/client';

// Persisted alongside the refresh token — lets MpinLoginScreen ask for just
// an MPIN on repeat logins from the same device rather than a mobile number
// every time, matching how a phone banking app remembers which account it
// belongs to. Cleared only by logging out and activating a different
// account, not by an ordinary MPIN login/logout cycle.
const LAST_MOBILE_KEY = 'nandam_staff_last_mobile';
import { decodeJwtPayload } from '../utils/jwt';
import { registerForPushNotifications } from '../utils/push';
import { registerDevice, unregisterDevice } from '../api/notifications';

export type Role = 'ADMIN' | 'STAFF';

interface AccessTokenClaims {
  sub: string;
  roles: Role[];
}

interface SessionTokens {
  accessToken: string;
  refreshToken?: string;
}

interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  roles: Role[];
}

interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  accessToken: string | null;
  user: AuthUser | null;
  role: Role | null;
  requestActivation: (mobile: string) => Promise<{ devOtp?: string }>;
  verifyActivationOtp: (data: { mobile: string; code: string }) => Promise<string>;
  setupMpin: (data: { setupToken: string; mpin: string; confirmMpin: string }) => Promise<void>;
  login: (data: { mobile: string; mpin: string }) => Promise<void>;
  requestMpinReset: (mobile: string) => Promise<{ devOtp?: string }>;
  confirmMpinReset: (data: {
    mobile: string;
    code: string;
    newMpin: string;
    confirmNewMpin: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  getRememberedMobile: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const platform = () => (Platform.OS === 'ios' ? 'ios' : 'android');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const applySession = useCallback(async (tokens: SessionTokens, sessionUser: AuthUser) => {
    setAccessToken(tokens.accessToken);
    setUser(sessionUser);
    setStatus('authenticated');
    if (tokens.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
    }
    // Only a real login/activation response carries `phone` — the silent
    // cold-launch refresh (below) reconstructs a bare-bones user from JWT
    // claims alone (no phone), so this naturally leaves the remembered
    // number untouched on every app open, not just the ones that log in.
    if (sessionUser.phone) {
      await SecureStore.setItemAsync(LAST_MOBILE_KEY, sessionUser.phone);
    }
    // Best-effort — a device that can't get a push token (simulator, no EAS
    // project yet, permission denied) still gets a fully working session.
    try {
      const push = await registerForPushNotifications();
      if (push) await registerDevice(tokens.accessToken, push.token, push.platform);
    } catch (err) {
      console.warn('Push registration failed:', err);
    }
  }, []);

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }, []);

  // Lets apiRequest (client.ts) recover transparently from an access token
  // that expired mid-session: on a 401 it refreshes and retries once, then
  // reports the new token here so the rest of the UI (which reads
  // accessToken fresh from context on every call) picks it up too. If the
  // refresh token itself is invalid/expired/revoked, it drops the user back
  // to the login screen instead of leaving every screen stuck erroring.
  useEffect(() => {
    registerAuthHandlers({
      onTokenRefreshed: (newAccessToken) => setAccessToken(newAccessToken),
      onAuthExpired: () => {
        clearSession();
      },
    });
  }, [clearSession]);

  useEffect(() => {
    (async () => {
      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!storedRefreshToken) {
        setStatus('unauthenticated');
        return;
      }
      // A cold start on a weak connection must not look like a logout. Only a
      // session the server actually rejected clears the stored refresh token;
      // a transport failure is retried a couple of times and then leaves the
      // token in place, so the next launch with signal restores the session
      // silently instead of demanding the MPIN again.
      const BACKOFF_MS = [0, 1500, 4000];
      for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
        if (BACKOFF_MS[attempt]) await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
        try {
          const newAccessToken = await refreshAccessToken();
          const claims = decodeJwtPayload<AccessTokenClaims>(newAccessToken);
          if (!claims) throw new Error('Invalid access token');
          await applySession(
            { accessToken: newAccessToken },
            { id: claims.sub, email: null, phone: null, roles: claims.roles }
          );
          return;
        } catch (err) {
          if (isAuthFailure(err) || (err as { code?: string })?.code === 'NO_REFRESH_TOKEN') {
            await clearSession();
            return;
          }
          // Transport failure — fall through and try again.
        }
      }
      // Still unreachable. Show the sign-in screen, but keep the refresh
      // token: this was the network's fault, not the session's.
      setStatus('unauthenticated');
    })();
  }, [applySession, clearSession]);

  const requestActivation = useCallback(async (mobile: string) => {
    const res = await apiRequest<{ data: { mobile: string; devOtp?: string } }>('/auth/app/activate', {
      method: 'POST',
      body: { mobile },
    });
    return { devOtp: res.data.devOtp };
  }, []);

  const verifyActivationOtp = useCallback(async (data: { mobile: string; code: string }) => {
    const res = await apiRequest<{ data: { setupToken: string } }>('/auth/app/otp/verify', {
      method: 'POST',
      body: data,
    });
    return res.data.setupToken;
  }, []);

  const setupMpin = useCallback(
    async (data: { setupToken: string; mpin: string; confirmMpin: string }) => {
      const res = await apiRequest<{ data: { tokens: SessionTokens; user: AuthUser } }>(
        '/auth/app/mpin/setup',
        { method: 'POST', body: { ...data, platform: platform() } }
      );
      await applySession(res.data.tokens, res.data.user);
    },
    [applySession]
  );

  const login = useCallback(
    async (data: { mobile: string; mpin: string }) => {
      const res = await apiRequest<{ data: { tokens: SessionTokens; user: AuthUser } }>('/auth/app/login', {
        method: 'POST',
        body: { ...data, platform: platform() },
      });
      await applySession(res.data.tokens, res.data.user);
    },
    [applySession]
  );

  const requestMpinReset = useCallback(async (mobile: string) => {
    const res = await apiRequest<{ data: { devOtp?: string } }>('/auth/app/mpin/forgot', {
      method: 'POST',
      body: { mobile },
    });
    return { devOtp: res.data?.devOtp };
  }, []);

  const confirmMpinReset = useCallback(
    async (data: { mobile: string; code: string; newMpin: string; confirmNewMpin: string }) => {
      await apiRequest('/auth/app/mpin/reset', { method: 'POST', body: data });
    },
    []
  );

  const logout = useCallback(async () => {
    const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    try {
      if (accessToken) {
        const push = await registerForPushNotifications();
        if (push) await unregisterDevice(accessToken, push.token);
      }
    } catch {
      // best-effort — a lost phone shouldn't block logging out on this one
    }
    try {
      await apiRequest('/auth/logout', { method: 'POST', body: { refreshToken: storedRefreshToken } });
    } catch {
      // best-effort — clear the local session regardless of network outcome
    }
    await clearSession();
  }, [accessToken, clearSession]);

  const getRememberedMobile = useCallback(async () => {
    return SecureStore.getItemAsync(LAST_MOBILE_KEY);
  }, []);

  const role: Role | null = user?.roles?.includes('ADMIN')
    ? 'ADMIN'
    : user?.roles?.includes('STAFF')
      ? 'STAFF'
      : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      accessToken,
      user,
      role,
      requestActivation,
      verifyActivationOtp,
      setupMpin,
      login,
      requestMpinReset,
      confirmMpinReset,
      logout,
      getRememberedMobile,
    }),
    [status, accessToken, user, role, requestActivation, verifyActivationOtp, setupMpin, login, requestMpinReset, confirmMpinReset, logout, getRememberedMobile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
