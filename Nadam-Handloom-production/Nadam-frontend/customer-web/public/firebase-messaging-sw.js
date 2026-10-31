/* Nandam Handlooms website notifications (W1). Firebase Cloud Messaging delivers through the
   browser's standard Push API; this worker shows each message and opens its page when tapped.
   The page subscribes with Firebase (getToken) using this worker's registration.
   While the website is open and in front, the page shows the message itself instead. */
'use strict';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Only links on this website are opened.
function safeLink(link) {
  try {
    const url = new URL(link || '/', self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin + '/';
  } catch {
    return self.location.origin + '/';
  }
}

self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { notification: { body: event.data ? event.data.text() : '' } };
  }
  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || 'Nandam Handlooms';
  const link = safeLink((payload.fcmOptions && payload.fcmOptions.link) || d.link);
  const options = {
    body: n.body || d.body || '',
    icon: n.icon || '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: n.tag || d.type || undefined,
    data: { link, id: d.notificationId || null },
  };
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const front = list.find((c) => c.focused && c.visibilityState === 'visible');
      if (front) {
        front.postMessage({ type: 'nh-push', title, body: options.body, link });
        return undefined;
      }
      return self.registration.showNotification(title, options);
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = safeLink(event.notification.data && event.notification.data.link);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin));
      if (open) return open.focus().then((c) => (c && 'navigate' in c ? c.navigate(link) : undefined));
      return self.clients.openWindow(link);
    }),
  );
});
