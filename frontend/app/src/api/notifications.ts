import { apiRequest } from './client';

export const registerDevice = (token: string, expoPushToken: string, platform: 'ios' | 'android') =>
  apiRequest('/admin/notifications/devices', { method: 'POST', token, body: { expoPushToken, platform } });

export const unregisterDevice = (token: string, expoPushToken: string) =>
  apiRequest('/admin/notifications/devices', { method: 'DELETE', token, body: { expoPushToken } });
