/* ============================================================================
   app.js — boot. Restores the session, routes to the app or the login screen,
   and wires the hardware back button (Android / Capacitor).
   ========================================================================== */
(function () {
  // --- PWA install: capture the browser's install prompt so a button can trigger it on demand.
  //     (Chrome only auto-shows the prompt once, which is why it couldn't be replicated.) ---
  window._pwaPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); window._pwaPrompt = e;
    try { if (current() && current().name === 'profile') renderCurrent(); } catch (x) {}
  });
  window.addEventListener('appinstalled', function () { window._pwaPrompt = null; try { toast('App installed ✓'); } catch (x) {} });
  // Service worker: when push is configured, use the Firebase messaging worker (it also passes fetch
  // through, so it doubles as the installability worker); otherwise the plain passthrough sw.js.
  var _isNative = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  var _FB = (window.CROMA && CROMA.FIREBASE) || {};
  window._fbSWReg = null;
  if ('serviceWorker' in navigator && !_isNative) {
    window.addEventListener('load', function () {
      if (_FB.projectId) window._fbSWReg = navigator.serviceWorker.register('firebase-messaging-sw.js?' + new URLSearchParams(_FB).toString()).catch(function () { return null; });
      else navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  /* --- NATIVE push (Capacitor / Android+iOS) -------------------------------------------------
     The native shells load this same published site via server.url, and Capacitor still injects
     its native bridge for remote content — so the one web bundle drives both transports and the
     "web changes reach the apps automatically" property is preserved. Web push (service worker +
     VAPID) does NOT work inside an Android WebView, which is exactly why this exists.

     The token goes to the SAME registerPushToken endpoint with platform 'android'/'ios', and
     sendPush_ already treats every stored token identically — so no backend change was needed. */
  window.CromaNativePush = (function () {
    var _p = null;
    /* Getting at the native plugin from a REMOTELY loaded page is the subtle part, and getting it
       wrong is why the first build registered no token at all.

       Capacitor.Plugins.PushNotifications only exists once the plugin's own JS package calls
       Capacitor.registerPlugin(). That happens in a bundled app; this app is plain scripts served
       from GitHub Pages, so it never happens. And the natively-injected native-bridge.js does NOT
       define registerPlugin either — it only ships nativePromise / nativeCallback / addListener.
       So both of the obvious routes are undefined here.

       Those raw bridge calls are all we actually need, so drive the plugin through them, while
       still preferring the real proxy if a future bundled build provides one. */
    function plugin() {
      if (!_isNative) return null;
      if (_p) return _p;
      var C = window.Capacitor; if (!C) return null;
      if (C.Plugins && C.Plugins.PushNotifications) { _p = C.Plugins.PushNotifications; return _p; }
      if (typeof C.registerPlugin === 'function') { try { _p = C.registerPlugin('PushNotifications'); return _p; } catch (e) {} }
      if (typeof C.nativePromise !== 'function' || typeof C.addListener !== 'function') return null;
      var call = function (m) { return function () { return C.nativePromise('PushNotifications', m, {}); }; };
      _p = {
        addListener: function (ev, cb) { return C.addListener('PushNotifications', ev, cb); },
        checkPermissions: call('checkPermissions'),
        requestPermissions: call('requestPermissions'),
        register: call('register')
      };
      return _p;
    }
    var _wired = false;
    function register(loud) {
      var P = plugin();
      if (!P) return Promise.resolve({ ok: false, why: _isNative ? 'native bridge unavailable' : 'not the native app' });
      // Listeners must be attached BEFORE register(), or the token event can be missed. Attach once.
      try {
        if (!_wired) { _wired = true;
        P.addListener('registration', function (t) {
          var tok = t && t.value;
          if (!tok) { if (loud) try { toast('Push: empty token from FCM.'); } catch (e) {} return; }
          var plat = (Capacitor.getPlatform && Capacitor.getPlatform()) || 'android';
          // Report the real outcome — on a tablet there's no console to read, so a silent failure
          // here is indistinguishable from "push is broken".
          api('registerPushToken', { pushToken: tok, platform: plat }, true).then(function (r) {
            if (!loud) return;
            try { toast((r && r.ok) ? 'Notifications on ✓ device registered' : ('Push register failed: ' + ((r && r.error) || 'unknown'))); } catch (e) {}
          });
        });
        P.addListener('registrationError', function (e) {
          if (loud) try { toast('Push registration error: ' + ((e && (e.error || e.message)) || 'unknown')); } catch (x) {}
        });
        // Foreground delivery: Android doesn't show a tray notification while the app is open.
        P.addListener('pushNotificationReceived', function (n) {
          try { toast((n && n.body) || (n && n.title) || 'New notification'); } catch (e) {}
        });
        // Tap on the tray notification → open the screen the backend routed it to (data.route).
        P.addListener('pushNotificationActionPerformed', function (a) {
          try {
            var route = a && a.notification && a.notification.data && a.notification.data.route;
            if (route && Views[route]) go(route);
          } catch (e) {}
        });
        }
      } catch (e) { return Promise.resolve({ ok: false, why: 'listener wiring failed: ' + e }); }
      var done = function () { return { ok: true, why: 'register() called' }; };
      return P.checkPermissions().then(function (p) {
        if (p && p.receive === 'granted') return P.register().then(done);
        if (p && p.receive === 'denied') return { ok: false, why: 'permission denied in phone settings' };
        // Only the user-initiated path may prompt. The boot refresh must stay silent — throwing a
        // permission dialog at someone just for opening the app is how you get it denied for good.
        if (!loud) return { ok: false, why: 'not granted yet' };
        return P.requestPermissions().then(function (q) {
          if (!q || q.receive !== 'granted') return { ok: false, why: 'permission not granted' };
          return P.register().then(done);
        });
      }).catch(function (e) { return { ok: false, why: 'plugin call failed: ' + ((e && (e.message || e.errorMessage)) || e) }; });
    }
    return {
      available: function () { return !!plugin(); },
      enable: function () { return register(true); },       // user-initiated → report what happened
      refresh: function () { if (plugin()) register(false); }   // silent token refresh on boot
    };
  })();

  // --- Push notifications (Firebase Cloud Messaging). Guarded: inert until CROMA.FIREBASE.projectId is set. ---
  window.CromaPush = (function () {
    var VAPID = (window.CROMA && CROMA.FIREBASE_VAPID_KEY) || '', messaging = null, loaded = null;
    function on() { return !!(_FB.projectId && VAPID) && !_isNative && ('Notification' in window) && ('serviceWorker' in navigator); }
    function load() {
      if (loaded) return loaded;
      loaded = new Promise(function (resolve) {
        if (!on()) { resolve(false); return; }
        function add(src, next) { var s = document.createElement('script'); s.src = src; s.onload = next; s.onerror = function () { resolve(false); }; document.head.appendChild(s); }
        add('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', function () {
          add('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js', function () {
            try { if (!firebase.apps.length) firebase.initializeApp(_FB); messaging = firebase.messaging(); resolve(true); } catch (e) { resolve(false); }
          });
        });
      });
      return loaded;
    }
    function getAndRegister() {
      return load().then(function (ok) {
        if (!ok || !messaging) return false;
        return (window._fbSWReg || Promise.resolve(null)).then(function (reg) {
          var opts = { vapidKey: VAPID }; if (reg) opts.serviceWorkerRegistration = reg;
          return messaging.getToken(opts).then(function (token) {
            if (!token) return false;
            try { messaging.onMessage(function (p) { try { toast((p.notification && p.notification.body) || 'New notification'); } catch (e) {} }); } catch (e) {}
            return api('registerPushToken', { pushToken: token, platform: 'web' }, true).then(function () { return true; });
          });
        });
      }).catch(function () { return false; });
    }
    return {
      available: function () { return on() && Notification.permission !== 'denied'; },
      enable: function () {
        if (!on()) { toast('Push notifications aren\'t set up yet.'); return; }
        Notification.requestPermission().then(function (perm) {
          if (perm !== 'granted') { toast('Notifications are blocked — allow them in your browser settings.'); return; }
          getAndRegister().then(function (okk) { toast(okk ? 'Notifications are on ✓' : 'Could not enable notifications.'); try { renderCurrent(); } catch (e) {} });
        });
      },
      refresh: function () { if (on() && Notification.permission === 'granted') getAndRegister(); }   // keep a returning user's token fresh
    };
  })();

  function boot() {
    loadSession();
    if (S.token && S.me) {
      // optimistic: show the app, then refresh the profile in the background
      if (!S.me.onboarded) { Auth.onboarding(); }
      else {
        go('home'); setTimeout(prefetch, 1800);
        try { CromaPush.refresh(); } catch (e) {}              // web (browser / installed PWA)
        try { CromaNativePush.refresh(); } catch (e) {}        // native (Capacitor Android / iOS)
        openDeepLink();
      }
      api('me').then(function (r) {
        if (r && r.ok && r.member) { S.me = r.member; saveSession(); if (current() && current().name === 'profile') renderCurrent(); }
        else if (r && r.ok === false && /session|token|auth/i.test(r.error || '')) { showAuth(); }
      });
    } else {
      showAuth();
    }
  }

  // --- Stale-shell guard -------------------------------------------------------------------
  // index.html is served by GitHub Pages with max-age=600, so a returning visitor can run the
  // PREVIOUS build for up to 10 minutes after a publish (its ?v= asset stamps point at the old
  // files). The service worker now revalidates navigations, but this covers clients that are
  // ALREADY stale (their old SW has no such handler) and any no-SW context. Compare our asset
  // stamp against the live one; if we're behind, refresh the cache entry and reload — once.
  function checkForNewBuild() {
    try {
      var link = document.querySelector('link[href*="theme.css"]');
      var mine = link && (String(link.getAttribute('href')).match(/\?v=(\d+)/) || [])[1];
      if (!mine) return;
      // cache:'reload' forces the network AND rewrites the HTTP cache entry for this exact URL,
      // so the location.reload() below actually picks up the new shell.
      fetch(location.href, { cache: 'reload' }).then(function (r) { return r.text(); }).then(function (html) {
        var live = (html.match(/\?v=(\d+)/) || [])[1];
        if (!live || Number(live) <= Number(mine)) return;
        if (sessionStorage.getItem('croma_build') === live) return;    // already reloaded for this build
        sessionStorage.setItem('croma_build', live);                   // hard guard against a reload loop
        location.reload();
      }).catch(function () {});
    } catch (e) {}
  }

  // Open a deep link from a notification click: URL ?go=<view> → navigate there after boot.
  function openDeepLink() {
    try {
      var g = new URLSearchParams(location.search).get('go');
      if (g && Views[g]) setTimeout(function () { try { go(g); } catch (e) {} }, 450);
    } catch (e) {}
  }

  // Android hardware back button (Capacitor). Falls back to browser history on web.
  document.addEventListener('backbutton', function (e) {
    if ($('#modalRoot').innerHTML) { closeModal(); return; }
    if ($('#mainScreen').classList.contains('active')) { back(); }
  }, false);

  // Web: keep the browser back button roughly sane while previewing.
  window.addEventListener('popstate', function () {
    if ($('#modalRoot').innerHTML) { closeModal(); return; }
    if ($('#mainScreen').classList.contains('active') && S.stack.length > 1) { back(); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(checkForNewBuild, 2500);          // after first paint — never delays startup
})();
