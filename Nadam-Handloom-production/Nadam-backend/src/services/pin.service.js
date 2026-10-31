// PIN scrambling with argon2id, the same settings as the old backend, so every
// existing PIN keeps working in the new app.
import argon2 from 'argon2';

const OPTIONS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 };
let dummyHash = null;

export const hashPin = (pin) => argon2.hash(String(pin), OPTIONS);

export async function verifyPin(hash, pin) {
  if (!hash) return false;
  try {
    return await argon2.verify(hash, String(pin));
  } catch {
    return false;
  }
}

// Used for numbers with no account, so a reply takes as long as a real check
// and timing can't reveal which numbers are registered.
export async function spendCheckTime(pin) {
  dummyHash ??= await argon2.hash('not-a-real-pin', OPTIONS);
  await verifyPin(dummyHash, pin);
}
