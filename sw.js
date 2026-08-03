/* Minimal service worker — makes the PWA reliably installable across browsers.
   Network passthrough with NO caching, so the app always loads fresh (it's an online
   app, and the native builds load the live site too — we never want stale files). */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  // GitHub Pages serves index.html with max-age=600, so a returning visitor could keep running
  // the PREVIOUS build (old ?v= asset stamps) for up to 10 minutes after a publish. Force the
  // app shell to revalidate; every other request passes through untouched.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(function () { return fetch(e.request); }));
  }
});
