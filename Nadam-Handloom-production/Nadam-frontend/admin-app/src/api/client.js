// Requests that need the signed-in person's access key. If the key has expired
// it is renewed once (silently) and the request is repeated. Codes that mean the
// sign-in has ended hand over to the session, which shows the right message. A staff
// request refused because the staff app is paused shows the maintenance screen (Module 11).
import { http } from './http';
import { session, SESSION_END_CODES } from '../auth/session';
import { gate } from '../gate/store';

export async function api(path, opts = {}) {
  let token = await session.getAccessToken();
  try {
    return await http(path, { ...opts, token });
  } catch (err) {
    if (err.code === 'ACCESS_TOKEN_EXPIRED') {
      token = await session.refresh(token);
      return http(path, { ...opts, token });
    }
    if (SESSION_END_CODES.has(err.code)) await session.end(err.code);
    if (err.code === 'MAINTENANCE') gate.pausedByServer(err.details?.message || err.message);
    throw err;
  }
}

export const publicApi = (path, opts) => http(path, opts);
