// JavaScript side of the Face ID / Touch ID / fingerprint key module.
// On builds without the native code (Expo Go, web) everything reports "not available".
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

const Native = requireOptionalNativeModule('NandamBiometrics');

export const isNativeAvailable = !!Native;

export async function getStatus() {
  if (!Native) return { available: false, type: 'none', reason: 'NOT_AVAILABLE', secureHardware: false };
  return Native.getStatus();
}

export const createKey = (alias) => Native.createKey(alias);
export const hasKey = async (alias) => (Native ? Native.hasKey(alias) : false);
export const deleteKey = async (alias) => (Native ? Native.deleteKey(alias) : undefined);

// texts: { reason, fallbackTitle } on iOS; { title, subtitle, cancelText } on Android.
export function sign(alias, payload, texts) {
  if (Platform.OS === 'ios') return Native.sign(alias, payload, texts.reason, texts.fallbackTitle);
  return Native.sign(alias, payload, texts.title, texts.subtitle, texts.cancelText);
}
