import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Same configuration-only stubs as client.test.ts, plus the native uploader:
// this is a test of what the upload does about an expired token, not of the
// device's file system.
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { hostUri: '10.0.0.5:8081' } } }));

const store = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => store.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void store.set(k, v),
  deleteItemAsync: async (k: string) => void store.delete(k),
}));

const upload = vi.fn();
vi.mock('expo-file-system', () => ({
  File: class {
    constructor(public uri: string) {}
    upload = (url: string, options: unknown) => upload(this.uri, url, options);
  },
  UploadType: { MULTIPART: 'multipart' },
}));

import { registerAuthHandlers, REFRESH_TOKEN_KEY } from './client';
import { uploadProductImage } from './catalog';

const photo = { uri: 'file:///cache/saree.jpg', name: 'saree.jpg', type: 'image/jpeg' };
const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;
const uploadReply = (status: number, body: unknown) => ({ status, body: JSON.stringify(body) });
const tokenSentWith = (call: number) => (upload.mock.calls[call][2] as any).headers.Authorization;

const EXPIRED = uploadReply(401, { message: 'Invalid or expired access token' });
const STORED = uploadReply(201, { data: { id: 'img-1', url: 'https://media.example/products/p1.jpg' } });

let onAuthExpired: ReturnType<typeof vi.fn>;
let onTokenRefreshed: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store.clear();
  store.set(REFRESH_TOKEN_KEY, 'stored-refresh-token');
  upload.mockReset();
  onAuthExpired = vi.fn();
  onTokenRefreshed = vi.fn();
  registerAuthHandlers({ onTokenRefreshed, onAuthExpired });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('photo upload and an expired access token', () => {
  it('sends the photo once when the token is good, with no refresh', async () => {
    upload.mockResolvedValueOnce(STORED);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const image = await uploadProductImage('good', 'p1', photo);

    expect(image).toEqual({ id: 'img-1', url: 'https://media.example/products/p1.jpg' });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][1]).toMatch(/\/admin\/products\/p1\/image$/);
    expect(tokenSentWith(0)).toBe('Bearer good');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // What happened on the shop phones: the save just before the upload had
  // refreshed the token, the screen still held the old one, and the photo
  // went out with it. It was refused and never sent again, so the product
  // was saved without its photo.
  it('gets a fresh token and sends the photo again when the first try is refused as expired', async () => {
    upload.mockResolvedValueOnce(EXPIRED).mockResolvedValueOnce(STORED);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, { data: { tokens: { accessToken: 'fresh', refreshToken: 'rotated' } } }));
    vi.stubGlobal('fetch', fetchMock);

    const image = await uploadProductImage('stale', 'p1', photo);

    expect(image.url).toBe('https://media.example/products/p1.jpg');
    expect(upload).toHaveBeenCalledTimes(2);
    expect(tokenSentWith(0)).toBe('Bearer stale');
    expect(tokenSentWith(1)).toBe('Bearer fresh');
    // the same photo, both times
    expect(upload.mock.calls[1][0]).toBe(photo.uri);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/auth\/refresh$/);
    expect(onTokenRefreshed).toHaveBeenCalledWith('fresh');
    expect(store.get(REFRESH_TOKEN_KEY)).toBe('rotated');
    expect(onAuthExpired).not.toHaveBeenCalled();
  });

  it('tries again only once', async () => {
    upload.mockResolvedValue(EXPIRED);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json(200, { data: { tokens: { accessToken: 'fresh', refreshToken: 'rotated' } } }))
    );

    await expect(uploadProductImage('stale', 'p1', photo)).rejects.toMatchObject({ status: 401 });
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('signs the user out, and does not resend, when the server rejects the sign-in itself', async () => {
    upload.mockResolvedValueOnce(EXPIRED);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(401, { message: 'Session expired' })));

    await expect(uploadProductImage('stale', 'p1', photo)).rejects.toMatchObject({
      status: 401,
      message: 'Invalid or expired access token',
    });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
  });

  it('keeps the user signed in when the refresh simply could not reach the server', async () => {
    upload.mockResolvedValueOnce(EXPIRED);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network request failed')));

    await expect(uploadProductImage('stale', 'p1', photo)).rejects.toMatchObject({ status: 0 });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(onAuthExpired).not.toHaveBeenCalled();
    expect(store.get(REFRESH_TOKEN_KEY)).toBe('stored-refresh-token');
  });

  it('does not refresh for a refusal that has nothing to do with the token', async () => {
    upload.mockResolvedValueOnce(uploadReply(400, { message: 'This picture could not be read. Please choose another one.' }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadProductImage('good', 'p1', photo)).rejects.toMatchObject({
      status: 400,
      message: 'This picture could not be read. Please choose another one.',
    });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
