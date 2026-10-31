import { lazy } from 'react';

const RELOADED = 'nh-reloaded-for-update';

// Leaving the website (a new address typed, a reload) cancels page code still downloading.
// That is not an error to show or report: the page is going anyway.
let leaving = false;
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { leaving = true; });
  window.addEventListener('pageshow', () => { leaving = false; });
  window.addEventListener('beforeunload', () => { leaving = true; });
}
const never = () => new Promise(() => {});

// A page whose code loads when first opened. If that fails:
// - offline: wait for the connection and try again (patchy mobile data);
// - the website was updated and the old file is gone: reload once to get the new version.
export function lazyPage(load) {
  return lazy(async () => {
    try {
      return await load();
    } catch (err) {
      if (leaving) return never();
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await new Promise((resolve) => { window.addEventListener('online', resolve, { once: true }); });
      }
      try {
        return await load();
      } catch (again) {
        if (leaving) return never();
        let last = 0;
        try { last = Number(sessionStorage.getItem(RELOADED) || 0); } catch { /* private mode */ }
        if (Date.now() - last > 30000) {
          try { sessionStorage.setItem(RELOADED, String(Date.now())); } catch { /* private mode */ }
          window.location.reload();
          return new Promise(() => {}); // the page is reloading
        }
        throw again || err;
      }
    }
  });
}
