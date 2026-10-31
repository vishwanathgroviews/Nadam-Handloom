// The catalogue endpoints. Reads keep a copy on the phone, so the catalogue stays
// viewable without internet (decision 5.12); changes always need the server.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, UploadType } from 'expo-file-system';
import { api } from './client';
import { API_URL, ApiError } from './http';
import { getDeviceInfo } from '../auth/device';
import { session, SESSION_END_CODES } from '../auth/session';

const KEY = (path) => `catalogue-copy:${path}`;
const OFFLINE = new Set(['NETWORK', 'TIMEOUT']);

// Returns the server's answer, or the saved copy when offline: { ...data, savedAt }.
async function read(path) {
  try {
    const data = await api(path);
    AsyncStorage.setItem(KEY(path), JSON.stringify({ data, savedAt: Date.now() })).catch(() => {});
    return { ...data, savedAt: null };
  } catch (err) {
    if (OFFLINE.has(err.code)) {
      const raw = await AsyncStorage.getItem(KEY(path)).catch(() => null);
      if (raw) {
        const copy = JSON.parse(raw);
        return { ...copy.data, savedAt: copy.savedAt };
      }
    }
    throw err;
  }
}
const json = (method, body) => ({ method, body });

// Lists come 20 at a time: offset 0, then the answer's nextOffset. Searches run on the
// server (name or price), so they cover every subcategory.
const listQs = ({ q = '', filter = 'all', offset = 0 } = {}) => `q=${encodeURIComponent(q.trim())}&filter=${filter}&offset=${offset}`;
export const listCategories = (offset = 0) => read(`/catalog/categories?offset=${offset}`);
export const searchSubcategories = (opts) => read(`/catalog/subcategories?${listQs(opts)}`);
export const getCategory = (id, opts) => read(`/catalog/categories/${id}?${listQs(opts)}`);
export const getSubcategory = (id) => read(`/catalog/subcategories/${id}`);

export const createCategory = (b) => api('/catalog/categories', json('POST', b));
export const updateCategory = (id, b) => api(`/catalog/categories/${id}`, json('PATCH', b));
export const deleteCategory = (id) => api(`/catalog/categories/${id}`, { method: 'DELETE' });
export const reorderCategories = (ids) => api('/catalog/categories/order', json('PUT', { ids }));

export const createSubcategory = (categoryId, b) => api(`/catalog/categories/${categoryId}/subcategories`, json('POST', b));
export const updateSubcategory = (id, b) => api(`/catalog/subcategories/${id}`, json('PATCH', b));
export const deleteSubcategory = (id) => api(`/catalog/subcategories/${id}`, { method: 'DELETE' });
export const reorderSubcategories = (categoryId, ids) => api(`/catalog/categories/${categoryId}/subcategories/order`, json('PUT', { ids }));
export const makeCataloguePdf = (id) => api(`/catalog/subcategories/${id}/catalogue-pdf`, { method: 'POST', timeoutMs: 120000 });

// Uploads a prepared JPEG (from the crop screen) as the photo of a category or subcategory.
// Uses Expo's native uploader (multipart, field "photo"), which handles phone files
// reliably on Android and iPhone; renews the access key once if it has expired.
export async function uploadPhoto(kind, id, uri) {
  const url = `${API_URL}/catalog/${kind === 'category' ? 'categories' : 'subcategories'}/${id}/photo`;
  const send = async (token) => {
    const device = await getDeviceInfo();
    let res;
    try {
      res = await new File(uri).upload(url, {
        httpMethod: 'PUT',
        uploadType: UploadType.MULTIPART,
        fieldName: 'photo',
        mimeType: 'image/jpeg',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'X-Device-Id': device.id, 'X-Platform': device.platform },
      });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Couldn\'t send the photo. Check your internet and try again.');
    }
    let data = null;
    try { data = res.body ? JSON.parse(res.body) : null; } catch { data = null; }
    if (res.status >= 200 && res.status < 300) return data;
    const e = data?.error || {};
    throw new ApiError(res.status, e.code || `HTTP_${res.status}`, e.message || 'Something went wrong. Please try again.', e.details);
  };
  let token = await session.getAccessToken();
  try {
    return await send(token);
  } catch (err) {
    if (err.code === 'ACCESS_TOKEN_EXPIRED') {
      token = await session.refresh(token);
      return send(token);
    }
    if (SESSION_END_CODES.has(err.code)) await session.end(err.code);
    throw err;
  }
}
