// A fake server for website tests: queue replies per path; every call is recorded.
import { vi } from 'vitest';

export function fakeServer() {
  const routes = [];
  const calls = [];
  const fetchMock = vi.fn(async (url, init = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '');
    const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    calls.push({ path, method: init.method || 'GET', headers: init.headers || {}, body });
    const i = routes.findIndex((r) => (r.method === (init.method || 'GET')) && (typeof r.path === 'string' ? path.endsWith(r.path) : r.path.test(path)));
    if (i === -1) throw new TypeError(`no fake reply for ${init.method || 'GET'} ${path}`);
    const r = routes[i];
    if (!r.keep) routes.splice(i, 1);
    if (r.network) throw new TypeError('Failed to fetch');
    const text = r.raw ?? (r.json === undefined ? '' : JSON.stringify(r.json));
    return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: new Headers(r.headers || {}), text: async () => text };
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    calls,
    fetchMock,
    on(method, path, status, json, extra = {}) { routes.push({ method, path, status, json, ...extra }); return this; },
    error(method, path, status, code, message, details, extra = {}) {
      return this.on(method, path, status, { error: { code, message, ...(details ? { details } : {}) } }, extra);
    },
  };
}

export const signedInReply = (over = {}) => ({
  status: 'signed_in', accessToken: 'tok-1', accessTokenExpiresIn: 900, sessionExpiresAt: '2026-11-14T00:00:00.000Z',
  customer: { id: 'c1', fullName: 'Priya Sharma', firstName: 'Priya', mobile: '9876543210', email: 'p@example.com', deletion: null, managedByShop: false, marketingOptIn: false },
  ...over,
});
