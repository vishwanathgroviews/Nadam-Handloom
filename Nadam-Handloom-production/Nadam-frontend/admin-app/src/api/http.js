// The one place that talks to the server. Every reply error becomes an ApiError
// with a stable `code` the screens switch on (same codes as the server sends).
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { getDeviceInfo } from '../auth/device';
import { connectivity } from './connectivity';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4100/api/v2').replace(/\/$/, '');
const APP_VERSION = `${Application.nativeApplicationVersion || Constants.expoConfig?.version || '2.0.0'} (${Application.nativeBuildVersion || 'dev'})`;
const TIMEOUT_MS = 30000; // the server's own work stops at 25 s, so the app never gives up on a change that then completes

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || {};
  }
}

// bytes: the reply is a file (a PDF or CSV): its bytes come back as a Uint8Array.
export async function http(path, { method = 'GET', body, token, timeoutMs = TIMEOUT_MS, bytes = false } = {}) {
  const device = await getDeviceInfo();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Device-Id': device.id,
        'X-Platform': device.platform,
        'X-App-Version': APP_VERSION,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (bytes && res.ok) {
      const buf = new Uint8Array(await res.arrayBuffer());
      connectivity.reachedServer();
      return buf;
    }
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    connectivity.reachedServer();
    if (!res.ok) {
      const e = data?.error || {};
      throw new ApiError(res.status, e.code || `HTTP_${res.status}`, e.message || 'Something went wrong. Please try again.', e.details);
    }
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err?.name === 'AbortError') {
      connectivity.serverUnreachable();
      throw new ApiError(0, 'TIMEOUT', 'The server is taking too long. Nothing was lost. Try again in a moment.');
    }
    connectivity.serverUnreachable();
    throw new ApiError(0, 'NETWORK', 'Can\'t reach the server. Check your internet and try again.');
  } finally {
    clearTimeout(timer);
  }
}
