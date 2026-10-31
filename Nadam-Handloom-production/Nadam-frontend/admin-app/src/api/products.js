// The product and tag endpoints (Module 4). The first page of the list is kept on
// the phone so the Products tab still shows something without internet.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, UploadType } from 'expo-file-system';
import { api } from './client';
import { API_URL, ApiError } from './http';
import { connectivity } from './connectivity';
import { getDeviceInfo } from '../auth/device';
import { session, SESSION_END_CODES } from '../auth/session';

const OFFLINE = new Set(['NETWORK', 'TIMEOUT']);
const json = (method, body) => ({ method, body });
const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

// { products, nextOffset, counts, totals, savedAt } — savedAt is set when it is the phone's copy.
// 20 at a time (also when searching): offset 0, then the answer's nextOffset.
export async function listProducts({ q = '', filter = 'all', subcategoryId, offset = 0, limit = 20 } = {}) {
  const path = `/products?${qs({ q: q.trim(), filter, subcategoryId, offset, limit })}`;
  const keep = !q.trim() && offset === 0 ? `products-copy:${filter}:${subcategoryId || ''}` : null;
  try {
    const data = await api(path);
    if (keep) AsyncStorage.setItem(keep, JSON.stringify({ data, savedAt: Date.now() })).catch(() => {});
    return { ...data, savedAt: null };
  } catch (err) {
    if (keep && OFFLINE.has(err.code)) {
      const raw = await AsyncStorage.getItem(keep).catch(() => null);
      if (raw) { const c = JSON.parse(raw); return { ...c.data, savedAt: c.savedAt }; }
    }
    throw err;
  }
}

export const getProduct = (id) => api(`/products/${id}`);
export const updateProduct = (id, body) => api(`/products/${id}`, json('PATCH', body));
export const deleteProduct = (id) => api(`/products/${id}`, { method: 'DELETE' });
export const orderPhotos = (id, ids) => api(`/products/${id}/photos/order`, json('PUT', { ids }));
export const deletePhoto = (id, photoId) => api(`/products/${id}/photos/${photoId}`, { method: 'DELETE' });

export const changeTag = (id, pieceId, code) => api(`/products/${id}/tags/${pieceId}/change`, json('POST', { code }));
export const replaceTag = (id, pieceId, code) => api(`/products/${id}/tags/${pieceId}/replace`, json('POST', { code }));
export const markDamaged = (id, pieceId) => api(`/products/${id}/tags/${pieceId}/damaged`, { method: 'POST' });
export const backInStock = (id, pieceId) => api(`/products/${id}/tags/${pieceId}/back-in-stock`, { method: 'POST' });
export const removeTag = (id, pieceId) => api(`/products/${id}/tags/${pieceId}/remove`, { method: 'POST' });

// One tag, checked the moment it is scanned: { code, status: free|taken|sold|retired|invalid, message, product }.
export async function checkTag(code) {
  const r = await api('/tags/check', json('POST', { codes: [code] }));
  return r.tags[0];
}
export const checkTags = async (codes) => (await api('/tags/check', json('POST', { codes }))).tags;
// More sarees of the same design: their tags join this listing (a set).
export const addTags = (id, codes) => api(`/products/${id}/tags`, json('POST', { codes }));
export const findTag = (code) => api(`/tags/${encodeURIComponent(code)}`);

// Sends a photo file as multipart form data (field "photo") with extra fields, using
// Expo's native uploader (reliable with phone files on Android and iPhone, as in
// Module 3). Renews the access key once if it has expired.
async function uploadFile(path, uri, { method = 'POST', fields = {} } = {}) {
  const send = async (token) => {
    const device = await getDeviceInfo();
    let res;
    try {
      res = await new File(uri).upload(`${API_URL}${path}`, {
        httpMethod: method,
        uploadType: UploadType.MULTIPART,
        fieldName: 'photo',
        mimeType: 'image/jpeg',
        parameters: fields,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'X-Device-Id': device.id, 'X-Platform': device.platform },
      });
    } catch {
      if (!new File(uri).exists) throw new ApiError(0, 'PHOTO_LOST', 'The photo is no longer on this phone. Take or choose it again.');
      connectivity.serverUnreachable();
      throw new ApiError(0, 'NETWORK', 'Couldn\'t send the photo. Check your internet and try again.');
    }
    connectivity.reachedServer();
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

// One listing (the upload queue calls this): { product, repeated }. One tag goes as
// `tag` (as before sets); a set's tags as `tags`, comma-separated.
export const createProduct = ({ photoUri, subcategoryId, tags, channel, clientRef, batchId }) =>
  uploadFile('/products', photoUri, { fields: { subcategoryId, ...(tags.length > 1 ? { tags: tags.join(',') } : { tag: tags[0] }), channel, clientRef, ...(batchId ? { batchId } : {}) } });
export const addPhoto = (id, photoUri) => uploadFile(`/products/${id}/photos`, photoUri);
