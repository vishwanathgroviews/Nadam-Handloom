// Firebase tokens (W1): two asks at the same moment share one answer (two at once made two
// tokens on a real phone, one dropped by Firebase straight away).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fb = vi.hoisted(() => ({ getToken: vi.fn() }));
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []) }));
vi.mock('firebase/messaging', () => ({ isSupported: vi.fn(async () => true), getMessaging: vi.fn(() => ({})), getToken: fb.getToken, deleteToken: vi.fn() }));

const { currentToken, turnOn } = await import('./push.js');
const CONFIG = { apiKey: 'k', appId: 'a', messagingSenderId: 's', vapidKey: 'v' };

beforeEach(() => {
  fb.getToken.mockReset();
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn(async () => ({})), ready: Promise.resolve({}) } });
  globalThis.Notification = { permission: 'granted', requestPermission: vi.fn(async () => 'granted') };
});

describe('the Firebase token', () => {
  it('the page checking and Turn on at the same moment: one ask to Firebase, one token', async () => {
    let answer;
    fb.getToken.mockReturnValue(new Promise((r) => { answer = r; }));
    const both = Promise.all([currentToken(CONFIG), turnOn(CONFIG)]);
    await new Promise((r) => setTimeout(r, 0));
    answer('tok-1');
    const [a, b] = await both;
    expect(a).toBe('tok-1');
    expect(b).toEqual({ permission: 'granted', token: 'tok-1' });
    expect(fb.getToken).toHaveBeenCalledTimes(1);
  });

  it('asked again later: Firebase is asked again (the token can change)', async () => {
    fb.getToken.mockResolvedValueOnce('tok-1').mockResolvedValueOnce('tok-2');
    expect(await currentToken(CONFIG)).toBe('tok-1');
    expect(await currentToken(CONFIG)).toBe('tok-2');
    expect(fb.getToken).toHaveBeenCalledTimes(2);
  });
});
