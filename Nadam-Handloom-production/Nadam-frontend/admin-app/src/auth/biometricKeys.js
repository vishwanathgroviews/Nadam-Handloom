// Thin layer over the native module (modules/nandam-biometrics). One key per account
// on this phone, so two people sharing a phone never share a Face ID key.
import * as Native from '../../modules/nandam-biometrics';

export const nativeBiometrics = Native;

export async function hasLocalBiometricKey(accountId) {
  try {
    return accountId ? await Native.hasKey(accountId) : false;
  } catch {
    return false;
  }
}

export async function deleteLocalBiometricKey(accountId) {
  try {
    if (accountId) await Native.deleteKey(accountId);
  } catch {
    // nothing to delete
  }
}
