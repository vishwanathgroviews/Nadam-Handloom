import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { parsePublicKey, verifySignature, challengePayload } from '../../src/services/biometric.service.js';
import { phoneKeys } from '../support/helpers.js';

describe('Face ID / fingerprint signatures', () => {
  const keys = phoneKeys();
  const payload = challengePayload({ id: 'c1', nonce: 'n1' }, 'dev-1');

  it('accepts a signature made with the phone key', () => {
    expect(verifySignature(keys.publicKey, payload, keys.sign(payload))).toBe(true);
  });
  it('rejects a signature over a different challenge', () => {
    expect(verifySignature(keys.publicKey, payload, keys.sign(`${payload}x`))).toBe(false);
  });
  it('rejects a signature from another phone', () => {
    const other = phoneKeys();
    expect(verifySignature(keys.publicKey, payload, other.sign(payload))).toBe(false);
  });
  it('rejects garbage signatures without throwing', () => {
    expect(verifySignature(keys.publicKey, payload, 'bm90LWEtc2lnbmF0dXJl')).toBe(false);
  });
  it('only accepts EC P-256 public keys', () => {
    const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
    const p384 = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
    expect(() => parsePublicKey(rsa)).toThrow();
    expect(() => parsePublicKey(p384)).toThrow();
    expect(() => parsePublicKey(keys.publicKey)).not.toThrow();
  });
});
