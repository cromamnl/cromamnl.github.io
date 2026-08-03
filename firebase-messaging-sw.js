/* Firebase Cloud Messaging background service worker.
   Config is passed in the registration query string (from config.js FIREBASE) so this file
   stays generic. Also passes fetch through with NO caching, so it doubles as the installability
   service worker (the app registers only ONE worker). */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

try {
  var cfg = {};
  new URL(self.location).searchParams.forEach(function (v, k) { cfg[k] = v; });
  if (cfg.projectId) {
    firebase.initializeApp(cfg);
    // firebase-messaging auto-displays the `notification` payload when the app is in the background.
    firebase.messaging();
  }
} catch (e) { /* not configured yet — stay a passthrough worker */ }

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
