// Settings (Module 11, owners). The start-up check every phone makes is in gate/store.js.
import { api } from './client';

export const get = () => api('/settings');
export const setMaintenance = (body) => api('/settings/maintenance', { method: 'PATCH', body });
export const setUpdates = (body) => api('/settings/updates', { method: 'PATCH', body });
export const setShop = (body) => api('/settings/shop', { method: 'PATCH', body });
