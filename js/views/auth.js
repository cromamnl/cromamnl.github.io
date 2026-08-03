/* ============================================================================
   auth.js — pre-login screens: welcome/login, register, and onboarding.
   Rendered into #authScreen (outside the tab shell).
   ========================================================================== */
var Auth = (function () {
  var host = function () { return $('#authScreen'); };

  var HOBBY_SUGGESTIONS = ['Specialty coffee', 'Espresso', 'Pour-over', 'Matcha', 'Baking', 'Photography',
    'Books', 'Board games', 'Running', 'Cycling', 'Art', 'Music', 'Film', 'Writing', 'Travel', 'Foodie', 'Gaming', 'Plants'];

  function logoBlock(tag) {
    return '<div class="logo-wrap"><img src="' + (window.CROMA_LOGO || '') + '" alt="Croma MNL"/>' +
      '<div class="tag">' + esc(tag || 'COMMUNITY') + '</div></div>';
  }

  // ---- Google Sign-In. Web → Google's official rendered button (reliable +
  //      policy-compliant). Native → Capacitor plugin. Demo → a stub button. ----
  function googleSlot() {
    var show = CROMA.GOOGLE_CLIENT_ID || !CROMA.API_URL;   // real client id, or demo mode
    return show ? '<div id="gslot" style="min-height:44px;display:flex;justify-content:center"></div><div class="divider">or</div>' : '';
  }
  function customGBtnHTML() {
    return '<button class="gbtn" id="gbtn">' +
      '<svg viewBox="0 0 48 48" width="19" height="19"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6c1.9-5.6 7.1-9.8 13.7-9.8z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.9-9.9 6.9-17.4z"/><path fill="#FBBC05" d="M10.3 28.7c-.5-1.4-.7-3-.7-4.7s.3-3.2.7-4.7l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.5 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.3-5.7c-2 1.4-4.7 2.3-7.7 2.3-6.6 0-12.2-4.5-14.2-10.5l-7.8 6C6.4 42.6 14.6 48 24 48z"/></svg>' +
      'Continue with Google</button>';
  }
  function waitForGIS(cb) {
    var n = 0;
    (function poll() {
      if (window.google && google.accounts && google.accounts.id) return cb(true);
      if (n++ > 50) return cb(false);   // ~5s for the GIS script to load
      setTimeout(poll, 100);
    })();
  }
  // Running inside the Capacitor native shell with the GoogleAuth plugin installed?
  function isNativeGoogle() {
    return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()
      && Capacitor.Plugins && Capacitor.Plugins.GoogleAuth);
  }
  // Native sign-in via @codetrix-studio/capacitor-google-auth → returns a Google idToken.
  function nativeGoogleSignIn() {
    var GA = Capacitor.Plugins.GoogleAuth;
    var init = GA.initialize ? Promise.resolve(GA.initialize({ clientId: CROMA.GOOGLE_CLIENT_ID, scopes: ['profile', 'email'], grantOfflineAccess: false })).catch(function () {}) : Promise.resolve();
    return init.then(function () { return GA.signIn(); }).then(function (res) {
      var t = res && (res.authentication ? res.authentication.idToken : res.idToken);
      if (!t) throw new Error('No Google token returned.');
      return t;
    });
  }

  /* Turn the plugin's error into something actionable. The old fallback said "sign-in was
     cancelled" for EVERY failure, which sends you looking at the user when the cause is almost
     always configuration — Google's status 10 (DEVELOPER_ERROR) means the app's signing
     certificate + package name are not registered as an Android OAuth client, so a build installed
     from Play fails while a local one works. */
  function googleErr_(e) {
    var msg = String((e && (e.message || e.error)) || ''), code = (e && (e.code || e.status)) || '';
    var all = (msg + ' ' + code);
    if (/10/.test(all) || /DEVELOPER_ERROR/i.test(all))
      return 'Google sign-in is not configured for this build (error 10). The app’s signing certificate needs registering in Google Cloud. Use email and password for now.';
    if (/12501/.test(all) || /cancel/i.test(all)) return 'Google sign-in was cancelled.';
    if (/7/.test(code) || /NETWORK/i.test(all)) return 'No connection — check your internet and try again.';
    return msg ? ('Google sign-in failed: ' + msg + (code ? ' (' + code + ')' : '')) : 'Google sign-in failed. Try email and password.';
  }

  function wireGoogle() {
    var slot = $('#gslot'); if (!slot) return;

    if (isNativeGoogle()) {                    // native app → Capacitor GoogleAuth plugin
      slot.innerHTML = customGBtnHTML();
      $('#gbtn').addEventListener('click', function () {
        setErr('Opening Google…');
        nativeGoogleSignIn()
          .then(function (idToken) { setErr(''); return api('googleLogin', { idToken: idToken }).then(finish); })
          .catch(function (e) { setErr(googleErr_(e)); });
      });
      return;
    }
    // Native shell WITHOUT the GoogleAuth plugin: Google blocks its *web* Sign-In inside
    // embedded WebViews, so there's no working path here — hide the button (and its "or"
    // divider) so app users cleanly use email/password. Google still works on the web/PWA.
    if (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
      var divider = slot.nextElementSibling;
      if (slot.parentNode) slot.parentNode.removeChild(slot);
      if (divider && divider.classList && divider.classList.contains('divider') && divider.parentNode) divider.parentNode.removeChild(divider);
      return;
    }
    if (!CROMA.GOOGLE_CLIENT_ID) {             // demo mode — no client id configured
      slot.innerHTML = customGBtnHTML();
      $('#gbtn').addEventListener('click', function () {
        api('googleLogin', { idToken: 'demo', name: 'Maya Santos', email: 'maya@example.com' }).then(finish);
      });
      return;
    }
    // web → Google's official button via Google Identity Services
    waitForGIS(function (ready) {
      if (!ready) { slot.innerHTML = '<div class="muted small">Google sign-in unavailable — check your connection.</div>'; return; }
      try {
        google.accounts.id.initialize({
          client_id: CROMA.GOOGLE_CLIENT_ID,
          callback: function (resp) { setErr(''); api('googleLogin', { idToken: resp.credential }).then(finish); },
          auto_select: false,
          cancel_on_tap_outside: true
        });
        google.accounts.id.renderButton(slot, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', logo_alignment: 'center', width: 300 });
      } catch (e) { slot.innerHTML = ''; }
    });
  }

  function setErr(m) { var e = $('#authErr'); if (e) e.textContent = m || ''; }
  function finish(r) {
    if (!r || !r.ok) { setErr((r && r.error) || 'Sign-in failed.'); return; }
    onLoggedIn(r);
  }

  /* ---------------------------------------------------------------- login */
  function render() {
    host().innerHTML =
      '<div class="auth">' + logoBlock('COMMUNITY') +
      '<div class="auth-card">' +
        '<h2>Welcome back</h2><div class="sub">Sign in to your Croma MNL community account.</div>' +
        googleSlot() +
        '<input class="field" id="liId" type="text" inputmode="email" placeholder="Email or phone" autocomplete="username"/>' +
        '<input class="field" id="liPw" type="password" placeholder="Password" autocomplete="current-password"/>' +
        '<button class="btn primary block big" id="liBtn">Sign in</button>' +
        '<p class="err" id="authErr"></p>' +
        '<div class="switch-line">New here? <a id="toReg">Create an account</a></div>' +
      '</div></div>';
    wireGoogle();
    $('#liBtn').addEventListener('click', doLogin);
    $('#liPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    $('#toReg').addEventListener('click', register);
  }
  function doLogin() {
    var idv = $('#liId').value.trim(), pw = $('#liPw').value;
    if (!idv || !pw) { setErr('Enter your email/phone and password.'); return; }
    setErr('');
    api('login', { emailOrPhone: idv, password: pw }).then(finish);
  }

  /* ---------------------------------------------------------------- register */
  function register(e) {
    if (e && e.preventDefault) e.preventDefault();
    host().innerHTML =
      '<div class="auth">' + logoBlock('JOIN THE COMMUNITY') +
      '<div class="auth-card">' +
        '<h2>Create your account</h2><div class="sub">Join fellow Croma MNL regulars.</div>' +
        googleSlot() +
        '<input class="field" id="rgName" placeholder="Full name" autocomplete="name"/>' +
        '<input class="field" id="rgEmail" type="email" inputmode="email" placeholder="Email" autocomplete="email"/>' +
        '<input class="field" id="rgPhone" type="tel" inputmode="tel" placeholder="Phone (optional)" autocomplete="tel"/>' +
        '<input class="field" id="rgPw" type="password" placeholder="Password (min 6 characters)" autocomplete="new-password"/>' +
        '<button class="btn primary block big" id="rgBtn">Create account</button>' +
        '<p class="err" id="authErr"></p>' +
        '<div class="switch-line">Already have an account? <a id="toLogin">Sign in</a></div>' +
      '</div></div>';
    wireGoogle();
    $('#rgBtn').addEventListener('click', doRegister);
    $('#toLogin').addEventListener('click', render);
  }
  function doRegister() {
    var name = $('#rgName').value.trim(), email = $('#rgEmail').value.trim(),
        phone = $('#rgPhone').value.trim(), pw = $('#rgPw').value;
    if (!name) return setErr('Please enter your name.');
    if (!email && !phone) return setErr('Enter an email or phone number.');
    if (pw.length < 6) return setErr('Password must be at least 6 characters.');
    setErr('');
    api('register', { name: name, email: email, phone: phone, password: pw, referredBy: pendingRef() }).then(function (r) { if (r && r.ok) clearPendingRef(); finish(r); });
  }

  /* ---------------------------------------------------------------- onboarding */
  var _ob = { avatar: '', hobbies: [] };
  function onboarding() {
    _ob = { avatar: (S.me && S.me.avatarUrl) || '', hobbies: (S.me && S.me.hobbies) || [] };
    $('#mainScreen').classList.remove('active');
    host().classList.add('active');
    var chips = HOBBY_SUGGESTIONS.map(function (h) {
      return '<span class="chip' + (_ob.hobbies.indexOf(h) >= 0 ? ' on' : '') + '" data-h="' + esc(h) + '">' + esc(h) + '</span>';
    }).join('');
    host().innerHTML =
      '<div class="auth"><div class="auth-card">' +
        '<h2>Set up your profile</h2><div class="sub">A photo and a few interests help fellow regulars find you.</div>' +
        '<div class="profile-head"><div class="avatar-edit" id="obAvatar">' +
          avatarHTML({ name: (S.me && S.me.name), avatarUrl: _ob.avatar }, 'xl') +
          '<div class="cam">📷</div></div></div>' +
        '<label class="lbl mt16">Your interests</label>' +
        '<div class="chips" id="obHobbies">' + chips + '</div>' +
        '<input class="field mt16" id="obCustom" placeholder="Add your own + Enter"/>' +
        '<label class="lbl">Short bio</label>' +
        '<textarea class="field" id="obBio" maxlength="160" placeholder="e.g. Flat white loyalist, always up for board games.">' + esc((S.me && S.me.bio) || '') + '</textarea>' +
        '<label class="lbl">City</label>' +
        '<input class="field" id="obCity" placeholder="e.g. Manila" value="' + esc((S.me && S.me.city) || '') + '"/>' +
        '<button class="btn primary block big mt8" id="obDone">Enter the community</button>' +
        '<div class="switch-line"><a id="obSkip">Skip for now</a></div>' +
        '<p class="err" id="authErr"></p>' +
      '</div></div>';
    $('#obAvatar').addEventListener('click', function () {
      pickImage(function (dataUrl) { _ob.avatar = dataUrl; $('#obAvatar').innerHTML = avatarHTML({ avatarUrl: dataUrl }, 'xl') + '<div class="cam">📷</div>'; });
    });
    $$('#obHobbies .chip').forEach(function (c) { c.addEventListener('click', function () { toggleHobby(c.dataset.h, c); }); });
    $('#obCustom').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && this.value.trim()) {
        var h = this.value.trim(); this.value = '';
        if (_ob.hobbies.indexOf(h) < 0) { _ob.hobbies.push(h);
          var chip = el('span', { class: 'chip on', 'data-h': h }, esc(h));
          chip.addEventListener('click', function () { toggleHobby(h, chip); });
          $('#obHobbies').appendChild(chip); }
      }
    });
    $('#obDone').addEventListener('click', function () { commitOnboarding(true); });
    $('#obSkip').addEventListener('click', function () { commitOnboarding(false); });
  }
  function toggleHobby(h, chip) {
    var i = _ob.hobbies.indexOf(h);
    if (i >= 0) { _ob.hobbies.splice(i, 1); chip.classList.remove('on'); }
    else { _ob.hobbies.push(h); chip.classList.add('on'); }
  }
  function commitOnboarding(full) {
    var params = { hobbies: _ob.hobbies, bio: full ? $('#obBio').value.trim() : '', city: full ? $('#obCity').value.trim() : '', avatarUrl: _ob.avatar };
    api('completeOnboarding', params).then(function (r) {
      if (!r || !r.ok) { setErr((r && r.error) || 'Could not save.'); return; }
      S.me = r.member; saveSession();
      host().classList.remove('active');
      go('home'); toast('Welcome to the community! ☕');
    });
  }

  return { render: render, register: register, onboarding: onboarding };
})();
