// Secure storage: iOS Keychain / Android Keystore, readable only on this device
// while it is unlocked, never copied to backups or other phones.
import * as SecureStore from 'expo-secure-store';

export const SECURE_OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const KEYS = {
  deviceId: 'nandam.deviceId', // random id for this install, used by the server to recognise a trusted device
  session: 'nandam.session', // { refreshToken, sessionExpiresAt, user, device }
  remembered: 'nandam.remembered', // { accountId, mobile, name, faceChanged? } shown on the sign-in screen
};

export async function readJSON(key) {
  try {
    const raw = await SecureStore.getItemAsync(key, SECURE_OPTS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const writeJSON = (key, value) => SecureStore.setItemAsync(key, JSON.stringify(value), SECURE_OPTS);

export async function remove(key) {
  try {
    await SecureStore.deleteItemAsync(key, SECURE_OPTS);
  } catch {
    // already gone
  }
}

export const getItem = (key) => SecureStore.getItemAsync(key, SECURE_OPTS);
export const setItem = (key, value) => SecureStore.setItemAsync(key, value, SECURE_OPTS);
