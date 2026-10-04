import type { AppConfig } from '../api/appConfig';

/**
 * Decides what the app shows on opening, from the server's app config and
 * what this phone is running: the normal app, a maintenance screen, or an
 * update prompt.
 *
 * Kept free of React Native imports so every rule here is covered by a plain
 * unit test — a mistake in this file locks the shop out of its own app.
 */

export type AppPlatform = 'android' | 'ios';
export type AppRole = 'ADMIN' | 'STAFF' | null;

export type AppGate =
  | { kind: 'ok' }
  | { kind: 'maintenance'; message: string }
  /** The app cannot be used until it is updated. */
  | { kind: 'update_required'; updateUrl: string }
  /** A newer build exists; the app still works and the notice can be dismissed. */
  | { kind: 'update_available'; updateUrl: string };

interface GateInput {
  /** null until it has loaded, or when the server could not be reached. */
  config: AppConfig | null;
  platform: AppPlatform;
  /** This build's number (android.versionCode / ios.buildNumber); 0 if it could not be read. */
  build: number;
  /** null while signed out. */
  role: AppRole;
}

export const decideAppGate = ({ config, platform, build, role }: GateInput): AppGate => {
  // No config means "could not ask": the app opens as usual, so a dropped
  // connection or a server restart never locks anyone out.
  if (!config) return { kind: 'ok' };

  const update = config[platform];
  // A build number that could not be read is never treated as out of date —
  // blocking on a guess would be worse than missing a prompt.
  const buildKnown = build > 0;

  if (buildKnown && (build < update.minBuild || (update.forceUpdate && build < update.latestBuild))) {
    return { kind: 'update_required', updateUrl: update.updateUrl };
  }

  // Maintenance locks out staff only. Owners keep access — they are the ones
  // who have to turn it off again — and a signed-out phone still shows the
  // sign-in screen so an owner can get in.
  if (config.maintenance.enabled && role === 'STAFF') {
    return { kind: 'maintenance', message: config.maintenance.message };
  }

  if (buildKnown && build < update.latestBuild) {
    return { kind: 'update_available', updateUrl: update.updateUrl };
  }

  return { kind: 'ok' };
};

/**
 * Whether saving these settings would leave the phone doing the saving unable
 * to open the app until it is updated — worth a warning before an owner locks
 * themselves out.
 */
export const wouldRequireUpdate = (config: Pick<AppConfig, AppPlatform>, platform: AppPlatform, build: number): boolean => {
  const update = config[platform];
  return build > 0 && (build < update.minBuild || (update.forceUpdate && build < update.latestBuild));
};
