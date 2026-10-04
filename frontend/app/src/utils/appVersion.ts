import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import type { AppPlatform } from './appGate';

export const appPlatform = (): AppPlatform => (Platform.OS === 'ios' ? 'ios' : 'android');

/**
 * This build's number — android.versionCode or ios.buildNumber from app.json,
 * which is embedded in the app when it is built. That, not "1.0.0", is what
 * tells one release from the next. 0 when it cannot be read (Expo Go, web).
 */
export const currentBuild = (): number => {
  const config = Constants.expoConfig;
  const raw = Platform.OS === 'ios' ? config?.ios?.buildNumber : config?.android?.versionCode;
  const build = Number(raw);
  return Number.isInteger(build) && build > 0 ? build : 0;
};

/** "v1.0.0 (23)" — the form staff are asked to read out when something goes wrong. */
export const versionLabel = (): string => {
  const build = currentBuild();
  return `v${Constants.expoConfig?.version ?? '1.0.0'}${build ? ` (${build})` : ''}`;
};

const TESTFLIGHT_WEB = 'https://beta.itunes.apple.com/';

/**
 * Opens the store page the app config points at. A TestFlight page is tried
 * through TestFlight's own scheme first, which lands in the TestFlight app
 * rather than a web page; the plain link is the fallback.
 */
export const openUpdateLink = async (url: string): Promise<void> => {
  if (Platform.OS === 'ios' && url.startsWith(TESTFLIGHT_WEB)) {
    try {
      await Linking.openURL(url.replace('https://', 'itms-beta://'));
      return;
    } catch {
      // TestFlight not installed — fall through to the web page.
    }
  }
  await Linking.openURL(url);
};
