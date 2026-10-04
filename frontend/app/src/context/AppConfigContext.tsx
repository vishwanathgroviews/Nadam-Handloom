import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AppConfig, getAppConfig } from '../api/appConfig';

interface AppConfigContextValue {
  /** null until the first answer arrives, and when the server has never been reachable. */
  config: AppConfig | null;
  /** Asks the server again. Resolves with what it got, or null if it could not be reached. */
  refresh: () => Promise<AppConfig | null>;
  /** Puts in place a config the caller already holds — the settings screen has just saved it. */
  setConfig: (config: AppConfig) => void;
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

/**
 * Holds the server's app config (maintenance switches, required builds) for
 * AppGate to act on.
 *
 * It is read when the app opens and every time it comes back to the front —
 * a phone in a shop is rarely closed, so "on launch" alone would leave a
 * maintenance switch or a forced update unnoticed for days.
 *
 * Nothing waits on it. The app shows as usual while the request is out, and
 * a request that fails changes nothing: whatever was last known stays, and a
 * first failure simply means no gate at all.
 */
export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const inFlight = useRef<Promise<AppConfig | null> | null>(null);

  const refresh = useCallback(() => {
    if (!inFlight.current) {
      inFlight.current = getAppConfig()
        .then((res) => {
          setConfig(res.data);
          return res.data;
        })
        .catch(() => null)
        .finally(() => {
          inFlight.current = null;
        });
    }
    return inFlight.current;
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const value = useMemo(() => ({ config, refresh, setConfig }), [config, refresh]);

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfigContextValue {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig must be used within an AppConfigProvider');
  return ctx;
}
