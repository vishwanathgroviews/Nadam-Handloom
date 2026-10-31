// Face ID / Touch ID / fingerprint, end to end (docs section 8.3):
//   turn on  -> the phone makes a key in its security chip, proves it works with one
//               biometric check, and the server stores the public half;
//   sign in  -> the server sends a one-time challenge, the phone signs it after a
//               biometric check, the server verifies it and starts the 7-day sign-in.
import { Platform } from 'react-native';
import { http } from '../api/http';
import { api } from '../api/client';
import { getDeviceInfo } from './device';
import { nativeBiometrics as Native, deleteLocalBiometricKey } from './biometricKeys';
import { markFaceChanged } from './session';

const LABELS = { faceId: 'Face ID', touchId: 'Touch ID', opticId: 'Optic ID', fingerprint: 'Fingerprint', face: 'Face unlock', iris: 'Iris unlock' };

// { available, type, label, reason }  reason: NOT_ENROLLED | NOT_AVAILABLE | LOCKOUT | ...
export async function getBiometricStatus() {
  try {
    const s = await Native.getStatus();
    const label = LABELS[s.type] || (Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint');
    // inSentence: "Sign in with fingerprint" but "Sign in with Face ID".
    return { ...s, label, inSentence: ['fingerprint', 'face', 'iris'].includes(s.type) ? label.toLowerCase() : label };
  } catch {
    const label = Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint';
    return { available: false, type: 'none', label, inSentence: Platform.OS === 'ios' ? label : 'fingerprint', reason: 'NOT_AVAILABLE' };
  }
}

const promptTexts = (label, purpose) => ({
  reason: purpose === 'enable' ? `Turn on ${label} for Nandam Admin` : 'Sign in to Nandam Admin',
  fallbackTitle: 'Use PIN',
  title: purpose === 'enable' ? `Turn on ${label.toLowerCase()} sign-in` : 'Sign in to Nandam Admin',
  subtitle: purpose === 'enable' ? 'Confirm it\'s you' : `Use your ${label.toLowerCase()}`,
  cancelText: purpose === 'enable' ? 'Cancel' : 'Use PIN',
});

// Turn on for the signed-in person on this phone. pin: the person's PIN (since 16 Oct 2026
// the server checks it, so a copied sign-in key alone can't add someone else's face).
export async function enableBiometric({ accountId, label, pin }) {
  const publicKey = await Native.createKey(accountId);
  try {
    // Prove the key works (one biometric check) before telling the server about it.
    await Native.sign(accountId, `nandam-biometric-enable:${Date.now()}`, promptTexts(label, 'enable'));
    await api('/me/biometric', { method: 'POST', body: pin ? { publicKey, pin } : { publicKey } });
    await markFaceChanged(false);
  } catch (err) {
    await deleteLocalBiometricKey(accountId);
    throw err;
  }
}

export async function disableBiometric({ accountId }) {
  await deleteLocalBiometricKey(accountId);
  await api('/me/biometric', { method: 'DELETE' });
}

// Returns the sign-in reply. Errors carry `code`:
//   CANCELLED / FALLBACK (use the PIN), LOCKOUT, INVALIDATED (face/fingerprint settings
//   changed: key removed), BIOMETRIC_UNAVAILABLE (server no longer has the key), LOCKED, NETWORK...
export async function signInWithBiometric({ mobile, accountId, label }) {
  const device = await getDeviceInfo();
  let challenge;
  try {
    challenge = await http('/auth/biometric/challenge', { method: 'POST', body: { mobile, deviceId: device.id } });
  } catch (err) {
    if (err.code === 'BIOMETRIC_UNAVAILABLE') await deleteLocalBiometricKey(accountId);
    throw err;
  }
  let signature;
  try {
    signature = await Native.sign(accountId, challenge.payload, promptTexts(label, 'signin'));
  } catch (err) {
    if (err.code === 'INVALIDATED' || err.code === 'KEY_NOT_FOUND') {
      await deleteLocalBiometricKey(accountId);
      await markFaceChanged(err.code === 'INVALIDATED');
    }
    throw err;
  }
  return http('/auth/biometric/login', { method: 'POST', body: { challengeId: challenge.challengeId, signature, device } });
}
