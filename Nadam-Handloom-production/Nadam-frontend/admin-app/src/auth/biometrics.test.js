jest.mock('../../modules/nandam-biometrics', () => ({
  getStatus: jest.fn(async () => ({ available: true, type: 'faceId', secureHardware: true })),
  createKey: jest.fn(async () => 'PUBLIC_KEY_B64'),
  hasKey: jest.fn(async () => true),
  deleteKey: jest.fn(async () => {}),
  sign: jest.fn(async () => 'SIGNATURE_B64'),
}));
jest.mock('../api/http', () => ({ http: jest.fn() }));
jest.mock('../api/client', () => ({ api: jest.fn(async () => ({})) }));
jest.mock('./device', () => ({ getDeviceInfo: jest.fn(async () => ({ id: 'device-1', name: 'iPhone 15', platform: 'ios' })) }));
jest.mock('./session', () => ({ markFaceChanged: jest.fn(async () => {}) }));

const Native = require('../../modules/nandam-biometrics');
const { http } = require('../api/http');
const { api } = require('../api/client');
const { markFaceChanged } = require('./session');
const { getBiometricStatus, enableBiometric, signInWithBiometric } = require('./biometrics');

beforeEach(() => jest.clearAllMocks());
const coded = (code) => Object.assign(new Error(code), { code });

test('labels the phone\'s biometric type', async () => {
  expect((await getBiometricStatus()).label).toBe('Face ID');
  Native.getStatus.mockResolvedValueOnce({ available: true, type: 'fingerprint' });
  expect((await getBiometricStatus()).label).toBe('Fingerprint');
});

test('turning on: makes a key, proves it with one check, then registers the public key', async () => {
  await enableBiometric({ accountId: 'acc-1', label: 'Face ID' });
  expect(Native.createKey).toHaveBeenCalledWith('acc-1');
  expect(Native.sign).toHaveBeenCalled();
  expect(api).toHaveBeenCalledWith('/me/biometric', { method: 'POST', body: { publicKey: 'PUBLIC_KEY_B64' } });
});

test('turning on sends the PIN with the key (the server checks it)', async () => {
  await enableBiometric({ accountId: 'acc-1', label: 'Face ID', pin: '482913' });
  expect(api).toHaveBeenCalledWith('/me/biometric', { method: 'POST', body: { publicKey: 'PUBLIC_KEY_B64', pin: '482913' } });
});

test('a wrong PIN from the server undoes the key on the phone', async () => {
  api.mockRejectedValueOnce(coded('WRONG_PIN'));
  await expect(enableBiometric({ accountId: 'acc-1', label: 'Face ID', pin: '111111' })).rejects.toMatchObject({ code: 'WRONG_PIN' });
  expect(Native.deleteKey).toHaveBeenCalledWith('acc-1');
});

test('turning on is undone if the check is cancelled', async () => {
  Native.sign.mockRejectedValueOnce(coded('CANCELLED'));
  await expect(enableBiometric({ accountId: 'acc-1', label: 'Face ID' })).rejects.toMatchObject({ code: 'CANCELLED' });
  expect(Native.deleteKey).toHaveBeenCalledWith('acc-1');
  expect(api).not.toHaveBeenCalled();
});

test('sign-in: challenge, sign, login', async () => {
  http.mockResolvedValueOnce({ challengeId: 'c1', payload: 'nandam-biometric-v1:c1:n:device-1' }).mockResolvedValueOnce({ status: 'signed_in' });
  await expect(signInWithBiometric({ mobile: '9000000001', accountId: 'acc-1', label: 'Face ID' })).resolves.toEqual({ status: 'signed_in' });
  expect(Native.sign.mock.calls[0][1]).toBe('nandam-biometric-v1:c1:n:device-1');
  expect(http.mock.calls[1][1].body).toMatchObject({ challengeId: 'c1', signature: 'SIGNATURE_B64', device: { id: 'device-1' } });
});

test('face settings changed: the key is removed and the warning is remembered', async () => {
  http.mockResolvedValueOnce({ challengeId: 'c1', payload: 'p' });
  Native.sign.mockRejectedValueOnce(coded('INVALIDATED'));
  await expect(signInWithBiometric({ mobile: '9000000001', accountId: 'acc-1', label: 'Face ID' })).rejects.toMatchObject({ code: 'INVALIDATED' });
  expect(Native.deleteKey).toHaveBeenCalledWith('acc-1');
  expect(markFaceChanged).toHaveBeenCalledWith(true);
});

test('the server no longer has the key: the local key is removed too', async () => {
  http.mockRejectedValueOnce(coded('BIOMETRIC_UNAVAILABLE'));
  await expect(signInWithBiometric({ mobile: '9000000001', accountId: 'acc-1', label: 'Face ID' })).rejects.toMatchObject({ code: 'BIOMETRIC_UNAVAILABLE' });
  expect(Native.deleteKey).toHaveBeenCalledWith('acc-1');
});
