/* ============================================================================
   profile.js — your profile, interests, quick links, edit, and logout.
   ========================================================================== */
registerView('profile', {
  tab: 'profile',
  title: 'Profile',
  actions: function () { return '<button class="iconbtn" id="pfEdit" title="Edit">✏️</button>'; },
  onAppbar: function () { var b = $('#pfEdit'); if (b) b.addEventListener('click', function () { go('editProfile'); }); },
  render: function (host) {
    var m = S.me || {};
    host.innerHTML =
      '<div class="profile-head"><div class="avatar-edit" id="pfAvatar">' + avatarHTML(m, 'xl') + '<div class="cam">📷</div></div>' +
        '<div class="pn">' + esc(m.name || 'You') + '</div>' +
        '<div class="muted small">' + esc([m.city, m.email || m.phone].filter(Boolean).join(' · ')) + '</div>' +
        ((m.statusEmoji || m.statusText) ? '<div class="chip soft" style="margin-top:8px">' + esc(m.statusEmoji || '') + (m.statusText ? ' ' + esc(m.statusText) : '') + '</div>' : '') +
        '</div>' +
      '<button class="btn primary block" id="pfQR" style="margin:0 0 14px">📱 Show my member QR</button>' +
      '<div class="stat-row" id="pfStats">' +
        '<div class="stat"><div class="v" id="pfConn">–</div><div class="l">Connections</div></div>' +
        '<div class="stat"><div class="v">' + ((m.hobbies || []).length) + '</div><div class="l">Interests</div></div></div>' +
      (m.bio ? '<div class="card center">' + esc(m.bio) + '</div>' : '') +
      (m.hobbies && m.hobbies.length ? '<div class="section-title">Interests</div><div class="chips">' +
        m.hobbies.map(function (h) { return '<span class="chip soft">' + esc(h) + '</span>'; }).join('') + '</div>' : '') +
      '<div id="pfBadges"></div>' +
      (S.me && (S.me.role === 'admin' || S.me.role === 'owner') ?
        '<div class="section-title">Staff</div><div class="list">' +
          navItem('admin', '🛡️', 'Admin panel', 'Manage events, bookings, members & rewards') + '</div>' : '') +
      '<div class="section-title">Your activity</div>' +
      '<div class="list">' +
        navItem('rewards', '★', 'Rewards & points', 'Redeem your loyalty points') +
        navItem('credits', '💳', 'Store credits', 'Prepaid balance for advance orders') +
        navItem('tiers', '🏅', 'Tiers & perks', 'What each tier unlocks') +
        navItem('orders', '🛍️', 'Advance orders', 'Your ahead orders & QR codes') +
        navItem('history', '🧾', 'My orders', 'Purchase history from the café') +
        navItem('myEvents', '🎉', 'My events', 'Events you\'re attending') +
        navItem('reserve', '📅', 'My reservations', 'Upcoming table bookings') +
        navItem('inquiries', '✉️', 'My inquiries', 'Questions & replies') +
      '</div>' +
      /* The public website. target=_blank matters in the native shells: cromamnl.com is a
         different host from the app's server.url, so Capacitor hands it to the system browser
         instead of navigating the WebView away and trapping the user inside the app. */
      '<div class="section-title">Croma MNL</div>' +
      '<div class="list">' +
        '<a class="item" href="https://www.cromamnl.com/" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">' +
          '<div style="font-size:19px;width:34px;text-align:center">🌐</div>' +
          '<div class="grow"><div class="t">Visit our website</div>' +
          '<div class="s">Menu, events, and how to find us</div></div><div class="chev">↗</div></a>' +
        '<a class="item" href="https://www.cromamnl.com/visit.html" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">' +
          '<div style="font-size:19px;width:34px;text-align:center">📍</div>' +
          '<div class="grow"><div class="t">Directions &amp; hours</div>' +
          '<div class="s">M.L. Quezon St., Bambang, Taguig · 9am–10pm daily</div></div><div class="chev">↗</div></a>' +
        '<a class="item" href="https://www.cromamnl.com/privacy.html" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">' +
          '<div style="font-size:19px;width:34px;text-align:center">🔒</div>' +
          '<div class="grow"><div class="t">Privacy Policy</div>' +
          '<div class="s">What we collect, why, and your rights</div></div><div class="chev">↗</div></a>' +
      '</div>' +
      ((canInstallPWA() || pushNeedsEnable()) ?
        '<div class="section-title">Get the app</div><div class="list">' +
          (canInstallPWA() ?
            '<div class="item" id="pfInstall"><div style="font-size:19px;width:34px;text-align:center">⬇️</div>' +
              '<div class="grow"><div class="t">Install Croma MNL app</div><div class="s">Add it to your home screen — no app store needed</div></div><div class="chev">›</div></div>' : '') +
          (pushNeedsEnable() ?
            '<div class="item" id="pfNotif"><div style="font-size:19px;width:34px;text-align:center">🔔</div>' +
              '<div class="grow"><div class="t">Enable notifications</div><div class="s">Order updates, replies, gifts & rewards</div></div><div class="chev">›</div></div>' : '') +
        '</div>' : '') +
      '<div class="section-title">Account</div>' +
      '<div class="list">' +
        '<div class="item" id="pfEdit2">' + '<div style="font-size:19px;width:34px;text-align:center">⚙️</div><div class="grow"><div class="t">Edit profile</div></div><div class="chev">›</div></div>' +
        '<div class="item" id="pfLogout"><div style="font-size:19px;width:34px;text-align:center">🚪</div><div class="grow"><div class="t" style="color:var(--red)">Log out</div></div></div>' +
        // Google Play requires an in-app route to account deletion, not just an email address.
        '<div class="item" id="pfDelete"><div style="font-size:19px;width:34px;text-align:center">🗑️</div>' +
          '<div class="grow"><div class="t" style="color:var(--red)">Delete my account</div>' +
          '<div class="s">Permanently removes your profile, points and activity</div></div><div class="chev">›</div></div>' +
      '</div>' +
      /* Both versions, not just the app's. A mismatch here is the first thing to check when
         something looks unfixed — the backend deploys separately from the client, so either half
         can be behind. `be:?` means no call has landed yet, which is itself worth seeing. */
      '<div class="center muted small mt16">' + esc(CROMA.APP_NAME) +
        ' · ui:' + esc(CROMA.VERSION) + ' · be:' + esc(S.sv || '?') + '</div>';

    $$('#viewBody [data-nav]').forEach(function (it) { it.addEventListener('click', function () { go(it.dataset.nav); }); });
    $('#pfAvatar').addEventListener('click', changeAvatar);
    var qb = $('#pfQR'); if (qb) qb.addEventListener('click', showMemberQR);
    $('#pfEdit2').addEventListener('click', function () { go('editProfile'); });
    $('#pfLogout').addEventListener('click', doLogout);
    var db = $('#pfDelete'); if (db) db.addEventListener('click', doDeleteAccount);
    var ib = $('#pfInstall'); if (ib) ib.addEventListener('click', installApp);
    var nb = $('#pfNotif'); if (nb) nb.addEventListener('click', function () {
      if (window.CromaNativePush && CromaNativePush.available())
        CromaNativePush.enable().then(function (r) { if (!r || !r.ok) toast('Push unavailable: ' + ((r && r.why) || 'unknown')); });
      else if (window.CromaPush) CromaPush.enable();
    });
    apiSWR('myConnections', {}, function (r) { var n = ((r && r.connections) || []).length; var e = $('#pfConn'); if (e) e.textContent = n; });
    fillBadgeStrip('pfBadges');                    // your badges — the same strip other members see
  },
});
function navItem(view, ic, title, sub) {
  return '<div class="item" data-nav="' + view + '"><div style="font-size:19px;width:34px;text-align:center">' + ic + '</div>' +
    '<div class="grow"><div class="t">' + title + '</div><div class="s">' + sub + '</div></div><div class="chev">›</div></div>';
}
// ---- PWA install (custom button; the browser only auto-prompts once) ----
function isNativeApp() { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); }
function isStandalonePWA() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
function isIOSDevice() { return /iphone|ipad|ipod/i.test(navigator.userAgent || '') || (/Mac/i.test(navigator.platform || '') && 'ontouchend' in document); }
function canInstallPWA() { return !isNativeApp() && !isStandalonePWA(); }   // hide inside the native app or when already installed
// Inside the native shells the web Push API doesn't exist, so offer the Capacitor plugin instead.
// Native permission state isn't synchronously readable, so the item stays available there — tapping
// it again when already granted just refreshes the token, which is harmless.
function pushNeedsEnable() {
  if (window.CromaNativePush && CromaNativePush.available()) return true;
  return !!(window.CromaPush && CromaPush.available() && window.Notification && Notification.permission !== 'granted');
}
function installApp() {
  if (window._pwaPrompt) {                                   // Chrome/Android/desktop: fire the real install prompt
    var p = window._pwaPrompt; window._pwaPrompt = null;
    try { p.prompt(); } catch (e) {}
    (p.userChoice || Promise.resolve({})).then(function (res) {
      if (res && res.outcome === 'accepted') toast('Installing…'); else toast('You can install anytime from here.');
      renderCurrent();
    });
    return;
  }
  if (isIOSDevice()) {                                       // iOS has no install API — show the Add-to-Home-Screen steps
    modal('<h3>Install on iPhone / iPad</h3><p class="muted">In <b>Safari</b>, add Croma MNL to your Home Screen:</p>' +
      '<ol class="muted" style="padding-left:20px;line-height:1.9;text-align:left"><li>Tap the <b>Share</b> icon (a square with an up-arrow ↑)</li><li>Scroll down and tap <b>Add to Home Screen</b></li><li>Tap <b>Add</b></li></ol>' +
      '<div class="modal-actions"><button class="btn primary" id="iiOk">Got it</button></div>');
    var c = $('#iiOk'); if (c) c.addEventListener('click', closeModal); return;
  }
  modal('<h3>Install the app</h3><p class="muted">Open your browser menu (⋮) and tap <b>Install app</b> or <b>Add to Home screen</b>. On a phone, use <b>Chrome</b> for the best result.</p>' +
    '<div class="modal-actions"><button class="btn primary" id="iiOk2">Got it</button></div>');
  var c2 = $('#iiOk2'); if (c2) c2.addEventListener('click', closeModal);
}
function changeAvatar() {
  pickImage(function (dataUrl) {
    toast('Uploading…');
    api('uploadAvatar', { dataUrl: dataUrl }).then(function (r) {
      if (r && r.ok) { S.me.avatarUrl = r.avatarUrl || dataUrl; saveSession(); swrDrop('home', 'members', 'myConnections'); toast('Photo updated ✓'); renderCurrent(); }
      else toast((r && r.error) || 'Upload failed.');
    });
  });
}
function doLogout() {
  modal('<h3>Log out?</h3><p class="muted">You can sign back in anytime.</p>' +
    '<div class="modal-actions"><button class="btn ghost" id="loCancel">Cancel</button>' +
    '<button class="btn danger" id="loYes">Log out</button></div>');
  $('#loCancel').addEventListener('click', closeModal);
  $('#loYes').addEventListener('click', function () { api('logout'); closeModal(); showAuth(); });
}

/* Deleting an account is irreversible, so this asks for a typed word rather than a tap — the one
   destructive action in the app where a mis-tap cannot be undone. The list is not decoration: it
   is the published policy from cromamnl.com/delete-account.html, and members should see what
   they are agreeing to without leaving the app to read it.

   The server checks the phrase too. A confirmation dialog is a courtesy to the person, not a
   security control — the endpoint is reachable directly like any other. */
function doDeleteAccount() {
  modal('<h3 style="color:var(--red)">Delete your account?</h3>' +
    '<p class="muted small">This cannot be undone. We permanently remove:</p>' +
    '<ul class="muted small" style="margin:8px 0 10px 18px;line-height:1.7">' +
      '<li>Your profile — name, photo, bio, contact details</li>' +
      '<li>Your points, tier and any unused reward vouchers</li>' +
      '<li>Your posts, comments, likes, messages and connections</li>' +
      '<li>Your advance orders, reservations, RSVPs and inquiries</li>' +
    '</ul>' +
    '<p class="muted small">Receipts for purchases you already made are kept — Philippine tax law ' +
      'requires the café to retain its sales records. They are no longer linked to you.</p>' +
    '<p class="muted small" style="margin-top:10px">Type <strong>DELETE</strong> to confirm.</p>' +
    '<input class="field" id="daWord" autocapitalize="characters" autocomplete="off" placeholder="DELETE"/>' +
    '<div id="daErr" class="muted small" style="color:var(--red);margin-top:8px"></div>' +
    '<div class="modal-actions"><button class="btn ghost" id="daCancel">Keep my account</button>' +
    '<button class="btn danger" id="daYes">Delete forever</button></div>');

  $('#daCancel').addEventListener('click', closeModal);
  $('#daYes').addEventListener('click', function () {
    var word = ($('#daWord').value || '').trim().toUpperCase();
    if (word !== 'DELETE') { $('#daErr').textContent = 'Type DELETE to confirm.'; return; }
    var btn = this;
    btn.disabled = true; btn.textContent = 'Deleting…';
    api('deleteMyAccount', { confirm: 'DELETE' }).then(function (r) {
      if (r && r.ok) {
        closeModal();
        // showAuth() -> clearSession() already drops the token, the persisted SWR cache, the
        // replica ID token and the joined-clubs list. Clearing keys by hand here would only
        // risk naming them wrongly, and leaving this member's cached data behind for whoever
        // signs in on this device next is exactly what clearSession exists to prevent.
        showAuth();
        toast('Your account has been deleted.');
      } else {
        btn.disabled = false; btn.textContent = 'Delete forever';
        $('#daErr').textContent = (r && r.error) || 'Could not delete your account.';
      }
    });
  });
}

registerView('myEvents', {
  title: 'My events',
  nav: false,
  render: function (host) {
    host.innerHTML = '<div id="meList">' + skeletonList(2) + '</div>';
    api('myEvents', {}, true).then(function (r) {
      var evs = (r && r.events) || [];
      $('#meList').innerHTML = evs.length ? evs.map(Events.cardHTML).join('')
        : emptyState('🎟️', 'No events yet', 'RSVP to events and they\'ll appear here.');
      Events.wireCards($('#meList'));
    });
  },
});

registerView('editProfile', {
  title: 'Edit profile',
  nav: false,
  render: function (host) {
    var m = S.me || {}; var hobbies = (m.hobbies || []).slice();
    host.innerHTML =
      '<div class="profile-head"><div class="avatar-edit" id="epAvatar">' + avatarHTML(m, 'xl') + '<div class="cam">📷</div></div></div>' +
      '<div class="card">' +
        '<label class="lbl">Name</label><input class="field" id="epName" value="' + esc(m.name || '') + '"/>' +
        '<label class="lbl">Status</label>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<input class="field" id="epStatusEmoji" maxlength="4" value="' + esc(m.statusEmoji || '') + '" placeholder="😀" style="width:60px;text-align:center;font-size:20px;margin:0"/>' +
          '<input class="field" id="epStatusText" maxlength="40" value="' + esc(m.statusText || '') + '" placeholder="What\'s on your mind?" style="flex:1;margin:0"/></div>' +
        '<div class="chips" id="epEmojiPick" style="margin:8px 0 4px">' + ['☕', '😀', '😎', '🔥', '📚', '🎮', '💻', '🎨', '🏃', '✈️', '😴', '❤️', '🎉', '🍵'].map(function (e) { return '<span class="chip" data-emoji="' + e + '" style="font-size:18px;cursor:pointer">' + e + '</span>'; }).join('') + '</div>' +
        '<label class="lbl">City</label><input class="field" id="epCity" value="' + esc(m.city || '') + '"/>' +
        '<label class="lbl">Phone</label><input class="field" id="epPhone" type="tel" value="' + esc(m.phone || '') + '"/>' +
        '<label class="lbl">Birthday <span class="muted">(for a birthday treat 🎂)</span></label><input class="field" id="epBday" type="date" value="' + esc(m.birthdate || '') + '"/>' +
        '<label class="lbl">Bio</label><textarea class="field" id="epBio" maxlength="160">' + esc(m.bio || '') + '</textarea>' +
        '<div class="chips" id="epBioEmoji" style="margin:-4px 0 8px">' +
          ['🇵🇭', '☕', '❤️', '✨', '🌱', '🎨', '📷', '🎶', '🏀', '🐶', '🐱', '🌊', '⛰️', '🍰', '😊', '🙌'].map(function (e) { return '<span class="chip" data-bioemoji="' + e + '" style="font-size:17px;cursor:pointer">' + e + '</span>'; }).join('') + '</div>' +
        '<label class="lbl">Interests <span class="muted">(tap to remove, or add below)</span></label>' +
        '<div class="chips" id="epHobbies"></div>' +
        '<input class="field mt8" id="epAddHobby" placeholder="Add an interest + Enter"/>' +
      '</div>' +
      '<button class="btn primary block big" id="epSave">Save changes</button>';
    drawHobbies();
    $('#epAvatar').addEventListener('click', changeAvatar);
    $$('#epEmojiPick .chip').forEach(function (c) { c.addEventListener('click', function () { $('#epStatusEmoji').value = c.dataset.emoji; }); });
    $$('#epBioEmoji .chip').forEach(function (c) { c.addEventListener('click', function () {
      var ta = $('#epBio'), em = c.dataset.bioemoji, s = ta.selectionStart || ta.value.length;
      ta.value = ta.value.slice(0, s) + em + ta.value.slice(ta.selectionEnd || s);
      ta.focus(); ta.selectionStart = ta.selectionEnd = s + em.length;
    }); });
    $('#epAddHobby').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && this.value.trim()) { var h = this.value.trim(); this.value = ''; if (hobbies.indexOf(h) < 0) { hobbies.push(h); drawHobbies(); } }
    });
    $('#epSave').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      api('updateProfile', { name: $('#epName').value.trim(), city: $('#epCity').value.trim(),
        phone: $('#epPhone').value.trim(), birthdate: $('#epBday').value, bio: $('#epBio').value.trim(),
        statusEmoji: $('#epStatusEmoji').value.trim(), statusText: $('#epStatusText').value.trim(), hobbies: hobbies }).then(function (r) {
        btn.disabled = false;
        if (r && r.ok) { S.me = r.member || S.me; saveSession(); swrDrop('home', 'members', 'myConnections'); toast('Saved ✓'); go('profile'); }
        else toast((r && r.error) || 'Could not save.');
      });
    });
    function drawHobbies() {
      $('#epHobbies').innerHTML = hobbies.map(function (h, i) { return '<span class="chip on" data-i="' + i + '">' + esc(h) + ' ✕</span>'; }).join('') || '<span class="muted small">No interests yet.</span>';
      $$('#epHobbies .chip').forEach(function (c) { c.addEventListener('click', function () { hobbies.splice(parseInt(c.dataset.i, 10), 1); drawHobbies(); }); });
    }
  },
});
