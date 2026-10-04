import { apiRequest } from './client';

export interface PlatformUpdateConfig {
  /** android.versionCode / ios.buildNumber of the newest released build. */
  latestBuild: number;
  /** Builds below this must update. */
  minBuild: number;
  /** On: every build below latestBuild must update, not just those below minBuild. */
  forceUpdate: boolean;
  updateUrl: string;
}

export interface AppConfig {
  /** Staff app maintenance — locks out Staff, never Owners. */
  maintenance: { enabled: boolean; message: string };
  /** Customer website maintenance. */
  webMaintenance: { enabled: boolean; message: string };
  android: PlatformUpdateConfig;
  ios: PlatformUpdateConfig;
  updatedAt: string | null;
}

export type AppConfigInput = Omit<AppConfig, 'updatedAt'>;

// No token: the app reads this before anyone has signed in.
export const getAppConfig = () => apiRequest<{ data: AppConfig }>('/app-config');

export const updateAppConfig = (token: string, data: AppConfigInput) =>
  apiRequest<{ data: AppConfig }>('/app-config', {
    method: 'PUT',
    token,
    body: data as unknown as Record<string, unknown>,
  });
