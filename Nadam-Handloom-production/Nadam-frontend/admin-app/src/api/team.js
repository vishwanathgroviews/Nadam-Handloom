// The team endpoints (owners only; the server refuses everyone else).
import { api } from './client';

const json = (method, body) => ({ method, body });

// 20 at a time: offset 0, then the answer's nextOffset. counts cover everyone.
export const listTeam = ({ tab = 'team', q = '', offset = 0 } = {}) => api(`/team?tab=${tab}&q=${encodeURIComponent(q)}&offset=${offset}`);
export const getMember = (id) => api(`/team/${id}`);
export const invite = ({ name, mobile, role }) => api('/team', json('POST', { name, mobile, role }));
export const rename = (id, name) => api(`/team/${id}`, json('PATCH', { name }));
export const changeRole = (id, role) => api(`/team/${id}/role`, json('PUT', { role }));
export const removeAccess = (id) => api(`/team/${id}/remove`, json('POST'));
export const inviteAgain = (id, role) => api(`/team/${id}/reinvite`, json('POST', { role }));
export const makeMainOwner = (id) => api(`/team/${id}/main-owner`, json('POST'));
export const signOutPhone = (id, deviceId) => api(`/team/${id}/devices/${deviceId}`, { method: 'DELETE' });
export const signOutAllPhones = (id) => api(`/team/${id}/devices/sign-out-all`, json('POST'));
