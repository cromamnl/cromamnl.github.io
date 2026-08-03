/* ============================================================================
   core.js — state, storage, API client (+ demo mode), UI helpers, router.
   Vanilla JS, no framework — mirrors the POS's small-helper style.
   ========================================================================== */

/* ------------------------------------------------------------------ state */
var S = {
  token: null,
  me: null,                 // current member object
  tab: 'home',              // active bottom tab
  stack: [],                // navigation stack: [{name, params}]
  cache: {},                // misc per-view caches
  unread: 0,                // unread chat count (drives badges)
  sv: '',                   // backend version, stamped on every response — shown in Profile
};

/* ------------------------------------------------------------------ dom helpers */
function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return [].slice.call((el || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
  return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function el(tag, attrs, html) {
  var e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  });
  if (html != null) e.innerHTML = html;
  return e;
}

/* ------------------------------------------------------------------ formatting */
function initials(name) {
  var p = String(name || '?').trim().split(/\s+/);
  return ((p[0] || '')[0] || '?').toUpperCase() + (p.length > 1 ? (p[p.length - 1][0] || '').toUpperCase() : '');
}
function avatarHTML(m, size) {
  size = size || 'md';
  var name = (m && (m.name || m.senderName)) || '?';
  var url = m && m.avatarUrl;
  var emoji = m && m.statusEmoji;
  var badge = emoji ? '<span class="avatar-status">' + esc(emoji) + '</span>' : '';
  var inner = url ? '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover" alt=""/>' : esc(initials(name));
  return '<div class="avatar ' + size + '">' + inner + badge + '</div>';
}
function money(n) { return '₱' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function two(n) { return (n < 10 ? '0' : '') + n; }
function parseDT(v) { // accepts 'yyyy-MM-dd HH:mm', ISO, or Date
  if (!v) return null;
  if (v instanceof Date) return v;
  var s = String(v).trim().replace(' ', 'T');
  var d = new Date(s);
  return isNaN(d) ? null : d;
}
function timeAgo(v) {
  var d = parseDT(v); if (!d) return '';
  var s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return fmtDate(d);
}
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function fmtDate(v) { var d = parseDT(v); if (!d) return ''; return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
function fmtDateTime(v) { var d = parseDT(v); if (!d) return ''; var h = d.getHours(), ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12;
  return MONTHS[d.getMonth()] + ' ' + d.getDate() + ' · ' + h + ':' + two(d.getMinutes()) + ' ' + ap; }
function fmtTime(v) { var d = parseDT(v); if (!d) return ''; var h = d.getHours(), ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return h + ':' + two(d.getMinutes()) + ' ' + ap; }
// Date heading for grouped lists: "Today" / "Yesterday" / "Mon, Jul 14".
function dayLabel(v) {
  var d = parseDT(v); if (!d) return '';
  var t = new Date(), y = new Date(t.getTime() - 86400000);
  function k(x) { return x.getFullYear() + '-' + two(x.getMonth() + 1) + '-' + two(x.getDate()); }
  if (k(d) === k(t)) return 'Today';
  if (k(d) === k(y)) return 'Yesterday';
  return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
}
function fmt12h(t) { var m = String(t == null ? '' : t).match(/^\s*(\d{1,2}):(\d{2})/); if (!m) return String(t == null ? '' : t); var h = parseInt(m[1], 10), ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return h + ':' + m[2] + ' ' + ap; }
function fmtEventWhen(v) { var d = parseDT(v); if (!d) return ''; return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ' · ' + fmtTime(d); }

/* ------------------------------------------------------------------ storage */
var STORE_KEY = 'croma_community';
function saveSession() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ token: S.token, me: S.me })); } catch (e) {}
}
function loadSession() {
  try { var r = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); S.token = r.token || null; S.me = r.me || null; } catch (e) {}
}
function clearSession() {
  S.token = null; S.me = null;
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  try { swrClearAll(); } catch (e) {}   // the persisted read cache holds this member's data — never leave it for the next sign-in
  try { clearReplicaToken(); } catch (e) {}          // ...and so does the replica ID token
  try { localStorage.removeItem('croma_joined'); } catch (e) {}
}
// Referral: capture ?ref=<memberId> from an invite link so registration can credit both sides.
function pendingRef() { try { return localStorage.getItem('croma_ref') || ''; } catch (e) { return ''; } }
function clearPendingRef() { try { localStorage.removeItem('croma_ref'); } catch (e) {} }
(function () { try { var r = new URLSearchParams(location.search).get('ref'); if (r) localStorage.setItem('croma_ref', String(r).slice(0, 48)); } catch (e) {} })();

/* ------------------------------------------------------------------ loading / toast / modal (from POS) */
var _load = 0;
function loadInc() { _load++; if (_load === 1) $('#loadingOverlay').classList.add('show'); }
function loadDec() { _load = Math.max(0, _load - 1); if (_load === 0) $('#loadingOverlay').classList.remove('show'); }
function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2400); }
function modal(html, opts) {
  opts = opts || {};
  var r = $('#modalRoot');
  r.innerHTML = '<div class="modal-backdrop"><div class="modal"><div class="grab"></div>' +
    (opts.noX ? '' : '<button class="modal-x" title="Close">&times;</button>') + html + '</div></div>';
  var x = r.querySelector('.modal-x'); if (x) x.addEventListener('click', closeModal);
  return r.querySelector('.modal');
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
/* First-visit gate (backend Visited.gs). The social layer opens after a first recorded purchase,
   so a stranger who found the website can look around but can't reach real customers. Framed as an
   unlock because that's what it is — and because a reason to visit beats a wall. */
function visitLockCard(msg) {
  return '<div class="card center"><div style="font-size:34px">☕</div>' +
    '<div style="font-weight:700;margin-top:8px;color:var(--brand)">Unlocked on your first visit</div>' +
    '<div class="muted small mt8">' + esc(msg || 'Come in, order anything, and scan your member QR at the counter — the community opens up straight after.') + '</div>' +
    '<button class="btn primary block big mt16" id="vlQR">Show my member QR</button>' +
    '<div class="muted small mt8">Meanwhile: browse the menu, and RSVP to any event.</div></div>';
}
function wireVisitLock(scope) {
  var b = (scope || document).querySelector('#vlQR');
  if (b) b.addEventListener('click', function () { if (typeof showMemberQR === 'function') showMemberQR(); });
}
function isVisitLocked(r) { return !!(r && r.ok === false && r.locked === 'visit'); }
// For action buttons (connect, send, post) where there's no list to replace.
function visitLockToast(r) {
  if (!isVisitLocked(r)) return false;
  modal('<h3>☕ Unlocked on your first visit</h3><p class="muted">' + esc(r.error) + '</p>' +
    '<div class="modal-actions"><button class="btn ghost" id="vlNo">Got it</button>' +
    '<button class="btn primary" id="vlYes">Show my member QR</button></div>');
  var n = $('#vlNo'); if (n) n.addEventListener('click', closeModal);
  var y = $('#vlYes'); if (y) y.addEventListener('click', function () { closeModal(); if (typeof showMemberQR === 'function') showMemberQR(); });
  return true;
}

// Yes/no sheet for destructive actions. `body` may contain markup, so pass it pre-escaped.
function confirmModal(title, body, okLabel, onOk) {
  modal('<h3>' + title + '</h3><div class="muted small mt8">' + body + '</div>' +
    '<div class="modal-actions"><button class="btn ghost" id="cfNo">Cancel</button>' +
    '<button class="btn primary danger" id="cfYes">' + (okLabel || 'Confirm') + '</button></div>');
  $('#cfNo').addEventListener('click', closeModal);
  $('#cfYes').addEventListener('click', function () { closeModal(); onOk(); });
}

/* ------------------------------------------------------------------ API client */
// Every backend action returns {ok:true,...} or {ok:false,error}. To dodge CORS
// preflight against Apps Script we POST text/plain with a JSON string body.
function api(action, params, silent) {
  params = params || {};
  // Envelope LAST. Spreading params last let a payload key named `action` silently rewrite the
  // ROUTE: admin.js sent {memberId, action:'ban'} to 'adminMemberAction', so the server received
  // action='ban', matched no handler, and answered "Unknown action: ban" - member moderation
  // could never work. `token` was hijackable the same way. Route and session belong to the
  // transport; a caller's params must not be able to reach them.
  var payload = Object.assign({}, params, { action: action, token: S.token });
  if (!CROMA.API_URL) return DEMO.handle(action, payload);     // demo mode
  var timer = silent ? 0 : setTimeout(loadInc, 240), shown = !silent;
  return fetch(CROMA.API_URL, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  }).then(function (r) { return r.json(); })
    .then(function (j) { if (timer) clearTimeout(timer); if (shown) loadDec(); shown = false;
      // The backend stamps its version on every response (json_ in Code.gs). Keeping the latest
      // costs nothing and lets Profile show which BACKEND you are actually talking to — the
      // question that wasted the most time here, when a fix looked undeployed but the client was
      // simply stale, or the other way round.
      if (j && j.sv) S.sv = j.sv;
      return j; })
    .catch(function (e) { if (timer) clearTimeout(timer); if (shown) loadDec(); shown = false;
      return { ok: false, error: 'Network error — check your connection.' }; });
}
// convenience: resolves with data or throws the error string (for try/catch flows)
function apiOrThrow(action, params) {
  return api(action, params).then(function (r) { if (!r || !r.ok) throw new Error((r && r.error) || 'Something went wrong.'); return r; });
}

/* ---------------------------------------------------------------- read replica (Realtime Database)
   An Apps Script round trip costs ~1.8s of platform overhead no matter how little work it does; a
   direct read of the replica is ~100ms. The backend mirrors hot PUBLIC data there (see
   backend/Mirror.gs), so a view can paint from the replica first and let the authoritative Apps
   Script response correct it a beat later. RTDB speaks plain JSON, so there is nothing to decode.
   Returns null on anything unexpected — the caller then behaves exactly as it did before the
   replica existed. */
var FS_BASE = (window.CROMA && CROMA.FIREBASE && CROMA.FIREBASE.databaseURL) || '';
function fsGet(docPath, opts) {
  if (!FS_BASE) return Promise.resolve(null);
  var go = function (auth) {
    var u = FS_BASE.replace(/\/+$/, '') + '/' + docPath + '.json' + (auth ? '?auth=' + encodeURIComponent(auth) : '');
    return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  };
  if (!(opts && opts.auth)) return go('');
  return replicaIdToken().then(function (t) { return t ? go(t) : null; });
}

/* Per-member replica reads need a Firebase ID token. The backend mints a short-lived CUSTOM token
   (signed by the same service account as push), which we exchange with Identity Toolkit for an ID
   token, then pass to the database as ?auth=. That lets a rule of `auth.uid === $uid` protect each
   member's own node — the replica can hold points/tier without exposing them to anyone else.

   Guarded: if Firebase Authentication isn't enabled on the project the exchange returns
   CONFIGURATION_NOT_FOUND, we cache the failure and stop asking, and every caller falls back to
   Apps Script exactly as before. Nothing breaks; the fast path is simply unavailable. */
var _replicaTok = null, _replicaFail = 0;
function replicaIdToken() {
  if (_replicaTok && _replicaTok.exp > Date.now() + 60000) return Promise.resolve(_replicaTok.t);
  if (_replicaFail && (Date.now() - _replicaFail) < 6e5) return Promise.resolve('');   // 10-min backoff
  try {
    var c = JSON.parse(localStorage.getItem('croma_rtok') || 'null');
    if (c && c.exp > Date.now() + 60000 && c.uid === (S.me && S.me.id)) { _replicaTok = c; return Promise.resolve(c.t); }
  } catch (e) {}
  if (!S.token) return Promise.resolve('');
  return api('replicaToken', {}, true).then(function (r) {
    if (!r || !r.ok || !r.token) { _replicaFail = Date.now(); return ''; }
    var key = r.apiKey || (window.CROMA && CROMA.FIREBASE && CROMA.FIREBASE.apiKey) || '';
    if (!key) { _replicaFail = Date.now(); return ''; }
    return fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + key, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: r.token, returnSecureToken: true })
    }).then(function (x) { return x.ok ? x.json() : null; }).then(function (d) {
      if (!d || !d.idToken) { _replicaFail = Date.now(); return ''; }
      // expiresIn is seconds (typically 3600). Keep it well inside the real expiry.
      _replicaTok = { t: d.idToken, uid: r.uid, exp: Date.now() + (Number(d.expiresIn || 3600) * 1000) };
      try { localStorage.setItem('croma_rtok', JSON.stringify(_replicaTok)); } catch (e) {}
      return d.idToken;
    });
  }).catch(function () { _replicaFail = Date.now(); return ''; });
}
function clearReplicaToken() { _replicaTok = null; _replicaFail = 0; try { localStorage.removeItem('croma_rtok'); } catch (e) {} }

/* Which clubs this member belongs to. The clubs replica is a PUBLIC shell with no `joined` flag —
   one shared copy could not carry it correctly — so the client keeps its own record and overlays
   it. Recorded from every authoritative response; used only to paint the replica shell. */
function joinedClubs_() { try { return JSON.parse(localStorage.getItem('croma_joined') || '[]') || []; } catch (e) { return []; } }
function saveJoinedClubs_(ids) { try { localStorage.setItem('croma_joined', JSON.stringify(ids || [])); } catch (e) {} }

// Stale-while-revalidate cache → instant re-navigation, refresh in the background.
// onData(result, isCached) is called with cached data first (if any), then fresh
// data (unless unchanged). opts.freshFor: skip the network if cache is younger.
// opts.fsDoc + opts.fsShape: paint from the Firestore replica while Apps Script is in flight.
//
// The cache is PERSISTED to localStorage, so a cold start paints the last known data instantly
// instead of showing a skeleton for ~1.8s. Writes are debounced because JSON.stringify of the
// whole cache on every response would be worse than the latency it saves.
var SWR_KEY = 'croma_swr', SWR_MAX = 400000;      // ~400KB ceiling, well inside the 5MB quota
var _swr = (function () {
  try {
    var raw = JSON.parse(localStorage.getItem(SWR_KEY) || '{}') || {};
    // Drop anything older than a day — stale enough that showing it would mislead.
    Object.keys(raw).forEach(function (k) { if (!raw[k] || (Date.now() - raw[k].ts) > 864e5) delete raw[k]; });
    return raw;
  } catch (e) { return {}; }
})();
var _swrSaveT = null;
function _swrPersist() {
  if (_swrSaveT) return;
  _swrSaveT = setTimeout(function () {
    _swrSaveT = null;
    try {
      var s = JSON.stringify(_swr);
      if (s.length > SWR_MAX) return;             // too big to be worth persisting; keep memory-only
      localStorage.setItem(SWR_KEY, s);
    } catch (e) {}                                // quota exceeded → memory-only, no user impact
  }, 800);
}
function swrClearAll() { _swr = {}; try { localStorage.removeItem(SWR_KEY); } catch (e) {} }
function _swrKey(a, p) { return a + '|' + JSON.stringify(p || {}); }
function apiSWR(action, params, onData, opts) {
  opts = opts || {};
  var key = _swrKey(action, params), hit = _swr[key], served = false, done = false;
  if (hit) {
    served = true; try { onData(hit.data, true); } catch (e) {}
    if (opts.freshFor && (Date.now() - hit.ts) < opts.freshFor) return Promise.resolve(hit.data);   // fresh enough — no network
  }
  // Replica first when there's nothing cached to show: ~100ms instead of a ~1.8s blank.
  // opts.fsAuth marks a member-scoped node, which needs an ID token (see replicaIdToken).
  if (!served && opts.fsDoc) {
    fsGet(opts.fsDoc, { auth: !!opts.fsAuth }).then(function (d) {
      if (done || served || !d) return;                  // Apps Script already answered — ignore
      var shaped = opts.fsShape ? opts.fsShape(d) : d;
      if (shaped) { served = true; try { onData(shaped, true); } catch (e) {} }
    });
  }
  return api(action, params, true).then(function (r) {   // silent — the view shows its own section skeleton, not the full-page overlay
    done = true;
    if (r && r.ok !== false) { _swr[key] = { data: r, ts: Date.now() }; _swrPersist(); }
    if (served && hit) { try { if (JSON.stringify(hit.data) === JSON.stringify(r)) return r; } catch (e) {} }  // unchanged — skip re-render
    try { onData(r, false); } catch (e) {}
    return r;
  });
}
// drop cached entries for the given action name(s) after a mutation
function swrDrop() {
  var names = [].slice.call(arguments), hit = false;
  Object.keys(_swr).forEach(function (k) {
    names.forEach(function (n) { if (k.indexOf(n + '|') === 0) { delete _swr[k]; hit = true; } });
  });
  /* PERSIST THE DELETION. apiSWR persists every write but this only ever cleared memory, so the
     stored copy outlived the drop: ban a member, and the next launch rehydrated the old directory
     and showed them again as though the ban had not taken. The server was right the whole time —
     resolveMember_ refuses a banned session on every request — but a moderator watching the list
     has no way to know that, and the natural read is "the ban did nothing". */
  if (hit) _swrPersist();
}
// warm the cache for the other tabs in the background (no loading overlay), so the
// first tap into each feels instant.
function prefetch() {
  ['menu', 'threads', 'myConnections', 'events', 'clubs'].forEach(function (a) {
    if (_swr[_swrKey(a, {})]) return;
    api(a, {}, true).then(function (r) { if (r && r.ok !== false) _swr[_swrKey(a, {})] = { data: r, ts: Date.now() }; });
  });
}

/* ------------------------------------------------------------------ router */
var Views = {};
function registerView(name, def) { Views[name] = def; }

var TABS = [
  { id: 'home', ic: '\u{1F3E0}', label: 'Home' },
  { id: 'menu', ic: '☕', label: 'Menu' },
  { id: 'community', ic: '\u{1F465}', label: 'Community' },
  { id: 'chat', ic: '\u{1F4AC}', label: 'Chat' },
  { id: 'profile', ic: '\u{1F642}', label: 'Profile' },
];

function go(name, params, opts) {
  opts = opts || {};
  var def = Views[name];
  if (!def) { console.warn('no view', name); return; }
  if (def.tab) { S.tab = def.tab; S.stack = [{ name: name, params: params || {} }]; }   // a tab root resets the stack
  else if (opts.replace) S.stack[S.stack.length - 1] = { name: name, params: params || {} };
  else S.stack.push({ name: name, params: params || {} });
  renderCurrent();
}
function back() {
  if (S.stack.length > 1) { S.stack.pop(); renderCurrent(); }
  else if (Views[S.tab]) { go(S.tab); }
}
function current() { return S.stack[S.stack.length - 1]; }

function renderCurrent() {
  if (S._poll) { clearInterval(S._poll); S._poll = null; }   // stop any chat/live polling from the previous view
  var cur = current(); if (!cur) { go('home'); return; }
  var def = Views[cur.name];
  $('#mainScreen').classList.add('active');
  $('#authScreen').classList.remove('active');
  renderAppbar(def, cur);
  renderTabbar(def);
  var body = $('#viewBody');
  body.className = 'body' + (def.nav === false ? ' no-nav' : '');
  body.innerHTML = '';
  window.scrollTo(0, 0);
  try { def.render(body, cur.params || {}); }
  catch (e) { console.error(e); body.innerHTML = '<div class="empty"><div class="ico">⚠️</div><div class="msg">' + esc(e.message) + '</div></div>'; }
}

function renderAppbar(def, cur) {
  var bar = $('#appbar');
  var isRoot = !!def.tab;
  var title = typeof def.title === 'function' ? def.title(cur.params || {}) : (def.title || CROMA.APP_NAME);
  var h = '';
  if (isRoot && cur.name === 'home') {
    h += '<img class="logo" src="' + (window.CROMA_LOGO || '') + '" alt="Croma MNL"/>';
    h += '<div><div class="title">Community</div></div>';
  } else if (isRoot) {
    h += '<div class="title">' + esc(title) + '</div>';
  } else {
    h += '<button class="back" aria-label="Back">‹</button><div class="title">' + esc(title) + '</div>';
  }
  h += '<div class="actions">' + (def.actions ? def.actions(cur.params || {}) : '') + '</div>';
  bar.innerHTML = h;
  var b = bar.querySelector('.back'); if (b) b.addEventListener('click', back);
  if (def.onAppbar) def.onAppbar(bar, cur.params || {});
}

function renderTabbar(def) {
  var bar = $('#tabbar');
  if (def.nav === false) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = TABS.map(function (t) {
    var badge = (t.id === 'chat' && S.unread > 0) ? '<span class="badge-dot">' + (S.unread > 99 ? '99+' : S.unread) + '</span>' : '';
    return '<button data-tab="' + t.id + '" class="' + (S.tab === t.id ? 'active' : '') + '">' +
      badge + '<span class="ic">' + t.ic + '</span>' + t.label + '</button>';
  }).join('');
  $$('#tabbar button').forEach(function (btn) {
    btn.addEventListener('click', function () { go(btn.dataset.tab); });
  });
}

/* ------------------------------------------------------------------ auth flow bridge */
function showAuth() {
  clearSession();
  $('#mainScreen').classList.remove('active');
  $('#authScreen').classList.add('active');
  Auth.render();
}
function onLoggedIn(r) {          // r = {ok, token, member}
  S.token = r.token; S.me = r.member; saveSession();
  if (!S.me || !S.me.onboarded) { $('#authScreen').classList.remove('active'); Auth.onboarding(); return; }
  go('home');
  setTimeout(prefetch, 1500);
}

/* ------------------------------------------------------------------ tiny UI atoms shared by views */
function emptyState(icon, msg, sub) {
  return '<div class="empty"><div class="ico">' + icon + '</div><div class="msg">' + esc(msg) + '</div>' +
    (sub ? '<div class="small muted mt8">' + esc(sub) + '</div>' : '') + '</div>';
}
function skeletonList(n) {
  var s = ''; for (var i = 0; i < (n || 4); i++) s += '<div class="card" style="height:70px"><div class="skeleton" style="width:60%;height:14px"></div><div class="skeleton" style="width:40%;height:12px;margin-top:10px"></div></div>';
  return s;
}
// A consistent little refresh pill (↻ spins while loading). Used across pages.
function refreshBtn(id) { return '<button class="refresh-btn" id="' + id + '" type="button"><span class="ric">↻</span> Refresh</button>'; }
// Wire a refreshBtn: spins its icon while `loader(true)` (which should return a promise) runs.
function wireRefresh(id, loader) {
  var b = document.getElementById(id); if (!b) return;
  b.addEventListener('click', function () {
    var ric = b.querySelector('.ric'); if (ric) ric.classList.add('spin');
    var done = function () { if (ric) ric.classList.remove('spin'); };
    var p = loader(true); if (p && p.then) p.then(done, done); else done();
  });
}
// ---- loyalty tier helpers (feature gating) ----
function tierRankOf(t) { return t === 'Gold' ? 2 : t === 'Silver' ? 1 : 0; }
function myTier() { return (S.me && S.me.tier) || 'Bronze'; }
function tierAllows(minTier) { return tierRankOf(myTier()) >= tierRankOf(minTier); }
// Full-screen "locked — reach <tier>" upsell with a button to the Rewards/tier screen.
function tierGate(host, feature, minTier, sub) {
  host.innerHTML = '<div class="empty"><div class="ico">🔒</div><div class="msg">' + esc(feature) + ' is a ' + esc(minTier) + ' perk</div>' +
    '<div class="small muted mt8">' + esc(sub || ('Reach ' + minTier + ' tier to unlock this. You\'re currently ' + myTier() + '.')) + '</div></div>' +
    '<button class="btn primary block big" id="tierGoRewards">See tiers &amp; perks</button>';
  var b = $('#tierGoRewards'); if (b) b.addEventListener('click', function () { go('tiers'); });
}
// pick a file as a data URL (for avatar / post / event images)
function pickImage(cb) {
  var inp = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  inp.addEventListener('change', function () {
    var f = inp.files && inp.files[0]; if (!f) return;
    if (f.size > 6 * 1024 * 1024) { toast('Image too large (max 6MB).'); return; }
    var rd = new FileReader();
    rd.onload = function () { downscale(rd.result, 1280, cb); };
    rd.readAsDataURL(f);
  });
  document.body.appendChild(inp); inp.click();
  setTimeout(function () { try { document.body.removeChild(inp); } catch (e) {} }, 60000);
}
// shrink big photos client-side so uploads stay small
function downscale(dataUrl, max, cb) {
  var img = new Image();
  img.onload = function () {
    var w = img.width, h = img.height, sc = Math.min(1, max / Math.max(w, h));
    var c = el('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    try { cb(c.toDataURL('image/jpeg', 0.82)); } catch (e) { cb(dataUrl); }
  };
  img.onerror = function () { cb(dataUrl); };
  img.src = dataUrl;
}

/* ============================================================================
   PULL TO REFRESH

   The gesture people already expect from every other app on their phone: drag
   down at the very top, let go, the page reloads.

   Refresh here means re-run the CURRENT view against fresh data — clear the
   persisted SWR cache, then renderCurrent(). Deliberately not location.reload():
   inside the native shell that re-downloads and re-parses the whole app for
   what is meant to be a quick "is there anything new", and it would throw away
   the view stack, dropping the user back to the home tab.

   Guards, each for a real way this misfires:
     - only from the very top of the page (scrollY <= 0)
     - only in the main app, never over the auth screen
     - never while a modal is open — those scroll their own content
     - never inside an element that scrolls itself (chat, long lists)
     - only on a mostly-VERTICAL drag, so a horizontal swipe is left alone
     - one finger only, so a pinch-zoom cannot trigger it

   body already carries overscroll-behavior-y:none, so the browser's own
   pull-to-refresh is not competing with this one.
   ========================================================================== */
(function () {
  var TRIGGER = 68;      // px dragged before letting go actually refreshes
  var MAX = 104;         // px the indicator can travel — resists past the trigger
  var SLOP = 8;          // px before we decide the drag is vertical

  var startY = 0, startX = 0, dy = 0, tracking = false, decided = false, refreshing = false;
  var bar = null;

  function indicator() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'ptr';
    bar.innerHTML = '<div class="ptr-ring"><span>↻</span></div>';
    document.body.appendChild(bar);
    return bar;
  }
  function move(px, spin) {
    var b = indicator();
    b.style.transform = 'translateX(-50%) translateY(' + px + 'px)';
    b.style.opacity = px > 6 ? Math.min(1, px / TRIGGER) : 0;
    b.classList.toggle('ready', !spin && px >= TRIGGER);
    b.classList.toggle('spin', !!spin);
  }
  function reset(animate) {
    var b = indicator();
    b.style.transition = animate ? 'transform .22s ease, opacity .22s ease' : '';
    move(0, false);
    if (animate) setTimeout(function () { b.style.transition = ''; }, 240);
  }

  /** True when this touch started somewhere that scrolls its own content. */
  function inNestedScroller(node) {
    for (var el = node; el && el !== document.body; el = el.parentElement) {
      var st = window.getComputedStyle(el);
      if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return true;
    }
    return false;
  }
  function eligible(e) {
    if (refreshing || e.touches.length !== 1) return false;
    var main = document.getElementById('mainScreen');
    if (!main || !main.classList.contains('active')) return false;          // auth screen
    var modal = document.getElementById('modalRoot');
    if (modal && modal.innerHTML.trim()) return false;                      // a modal owns the gesture
    if (window.scrollY > 0 || document.documentElement.scrollTop > 0) return false;
    return !inNestedScroller(e.target);
  }

  document.addEventListener('touchstart', function (e) {
    if (!eligible(e)) { tracking = false; return; }
    tracking = true; decided = false; dy = 0;
    startY = e.touches[0].clientY; startX = e.touches[0].clientX;
  }, { passive: true });

  // Non-passive: past the threshold this has to preventDefault, or the page scrolls underneath.
  document.addEventListener('touchmove', function (e) {
    if (!tracking) return;
    var y = e.touches[0].clientY - startY, x = Math.abs(e.touches[0].clientX - startX);
    if (!decided) {
      if (Math.abs(y) < SLOP && x < SLOP) return;    // too small to read yet
      // A sideways drag is somebody else's gesture; an upward one is ordinary scrolling.
      if (x > Math.abs(y) || y <= 0) { tracking = false; return; }
      decided = true;
    }
    if (y <= 0) { dy = 0; move(0, false); return; }
    // Resistance: the first pixels track the finger, then it stiffens. Without this it feels
    // loose and people overshoot without noticing they have passed the trigger.
    dy = Math.min(MAX, y < TRIGGER ? y : TRIGGER + (y - TRIGGER) * 0.35);
    move(dy, false);
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', function () {
    if (!tracking) return;
    tracking = false;
    if (dy < TRIGGER) { reset(true); return; }

    refreshing = true;
    move(TRIGGER * 0.8, true);
    // A refresh that finishes in 40ms reads as a glitch rather than an action, so hold the
    // spinner briefly. The work still starts immediately.
    var started = Date.now();
    var finish = function () {
      setTimeout(function () { reset(true); refreshing = false; }, Math.max(0, 450 - (Date.now() - started)));
    };
    try {
      swrClearAll();                 // next render refetches rather than painting the cache
      renderCurrent();
      finish();
    } catch (err) { console.warn('[ptr]', err); finish(); }
  }, { passive: true });

  document.addEventListener('touchcancel', function () {
    if (!tracking) return;
    tracking = false; reset(true);
  }, { passive: true });
})();
