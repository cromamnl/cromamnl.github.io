/* ============================================================================
   home.js — dashboard: greeting, quick actions, next event, community feed.
   ========================================================================== */
registerView('home', {
  tab: 'home',
  actions: function () {
    return '<button class="iconbtn" id="hbNotif" title="Notifications" style="position:relative">🔔<span id="hbNotifDot" style="display:none;position:absolute;top:4px;right:4px;width:9px;height:9px;border-radius:50%;background:var(--red,#c0392b)"></span></button>' +
      '<button class="iconbtn" id="hbInquire" title="Ask us">✉️</button>';
  },
  onAppbar: function () {
    var b = $('#hbInquire'); if (b) b.addEventListener('click', function () { openAskModal(); });
    var n = $('#hbNotif'); if (n) n.addEventListener('click', function () { openNotifPopup(); });
  },
  render: function (host) {
    var greet = greeting();
    host.innerHTML =
      '<div class="hero"><div class="spread">' +
        '<div><div class="hi">' + greet + ',</div><div class="name">' + esc(firstName(S.me && S.me.name)) + '</div></div>' +
        // Tapping your own photo is the gesture people expect to reach their profile. Wrapped
        // rather than making avatarHTML itself clickable: it renders in seven other places
        // (feed posts, comments, composers) where the avatar is someone else's, or nobody's.
        '<div id="heroAvatar" role="button" tabindex="0" aria-label="Open your profile" style="cursor:pointer">' +
          avatarHTML(S.me, 'lg') +
        '</div>' +
      '</div><div class="meta" id="heroMeta"></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">' +
        '<div class="card tap" data-q="rewards" style="margin:0;display:flex;align-items:center;gap:10px;padding:14px">' +
          '<div style="font-size:22px">★</div><div class="grow" style="flex:1">' +
          '<div style="font-weight:700;font-size:14px">Rewards</div><div class="muted small" id="loyStripSub">Your points</div></div></div>' +
        '<div class="card tap" data-q="credits" style="margin:0;display:flex;align-items:center;gap:10px;padding:14px">' +
          '<div style="font-size:22px">💳</div><div class="grow" style="flex:1">' +
          '<div style="font-weight:700;font-size:14px">Credits</div><div class="muted small" id="crStripSub">Prepaid balance</div></div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:4px">' +
        qtile('order', '🛍️', 'Order ahead') +
        qtile('reserve', '📅', 'Reserve a table') +
        qtile('events', '🎉', 'Events') +
        qtile('inquiries', '💬', 'Ask us') +
      '</div>' +
      '<div id="nextEvent"></div>' +
      '<div class="section-title" style="display:flex;align-items:center;justify-content:space-between">Community feed ' + refreshBtn('feedRefresh') + '</div>' +
      '<div style="text-align:right;margin:-6px 2px 8px"><a href="#" id="feedAll" style="display:none;font-size:12.5px;font-weight:600;color:var(--brand)"></a></div>' +
      '<div class="composer" id="composer">' + avatarHTML(S.me, 'md') +
        '<input class="field" id="composerInput" placeholder="Share something with the community…" readonly/></div>' +
      '<div id="feed">' + skeletonList(3) + '</div>';

    var ha = $('#heroAvatar');
    if (ha) {
      ha.addEventListener('click', function () { go('profile'); });
      // role="button" without key handling is a keyboard trap for anyone not using touch.
      ha.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); go('profile'); }
      });
    }

    $$('#viewBody [data-q]').forEach(function (t) { t.addEventListener('click', function () {
      if (t.dataset.q === 'inquiries') { openAskModal(); return; }   // "Ask us" opens a popup, not a full page
      go(t.dataset.q);
    }); });
    $('#composer').addEventListener('click', Feed.compose);
    $('#feedAll').addEventListener('click', function (e) { e.preventDefault(); go('feed'); });
    load();
    wireRefresh('feedRefresh', load);

    // Relaxed: the feed/home only re-fetches if the cache is older than a few minutes (not on every
    // visit). Tapping Refresh forces a fresh pull.
    function load(force) {
      if (force) swrDrop('home');
      return apiSWR('home', {}, function (r) {
        if (!r || !r.ok) return;
        if (r.member) { S.me = r.member; saveSession(); }
        S.unread = r.unreadChat || 0; renderTabbar(Views.home);
        // Tappable: a count that tells you something happened should take you to it.
        $('#heroMeta').innerHTML =
          '<span class="tap" data-goto="community">👥 ' + (r.connections || 0) + ' connections</span>' +
          (r.requests ? '<span class="tap" data-goto="community">🙋 ' + r.requests + ' request' + (r.requests > 1 ? 's' : '') + '</span>' : '') +
          (r.unreadChat ? '<span class="tap" data-goto="chat">💬 ' + r.unreadChat + ' unread</span>' : '');
        $$('#heroMeta [data-goto]').forEach(function (el) {
          el.style.cursor = 'pointer'; el.style.textDecoration = 'underline';
          el.addEventListener('click', function () { go(el.dataset.goto); });
        });
        if (r.points != null) { var sub = $('#loyStripSub'); if (sub) sub.innerHTML = '<strong>' + r.points + '</strong> pts · ' + esc(r.tier || 'Bronze'); }
        if (r.credits != null) { var cs = $('#crStripSub'); if (cs) cs.innerHTML = '<strong>' + money(r.credits) + '</strong>' + (r.credits > 0 ? '' : ' · top up'); }
        var nd = $('#hbNotifDot'); if (nd) nd.style.display = (r.unreadNotifs > 0) ? 'block' : 'none';
        // The replica snapshot carries only this member's counters — no events, no feed. Leaving
        // the skeletons alone is right; blanking them and repainting a beat later reads as a bug.
        if (r.partial) return;
        // With no event scheduled this whole strip used to vanish, leaving a gap between the tiles
        // and the feed. For someone who hasn't bought anything yet that space is better spent
        // telling them how any of this starts working.
        if (r.nextEvent) {
          $('#nextEvent').innerHTML = '<div class="section-title">Next up</div>' + Events.cardHTML(r.nextEvent);
          Events.wireCards($('#nextEvent'));
        } else if (r.visited === false) {
          $('#nextEvent').innerHTML =
            '<div class="section-title">Getting started</div>' +
            '<div class="card"><div style="font-weight:700">Scan your member QR at the counter</div>' +
              '<div class="muted small mt8">That is how a purchase gets linked to you — points, tier and the '
              + 'community all switch on from your first one.</div>' +
              '<button class="btn primary block" id="hmQR" style="margin-top:12px">☕ Show my member QR</button></div>';
          var q = $('#hmQR'); if (q) q.addEventListener('click', function () { go('rewards'); });
        } else $('#nextEvent').innerHTML = '';
        Feed.renderInto($('#feed'), r.feed || [], r.visited);
        // The home feed is a preview. Without this, everything older than the newest few posts is
        // simply unreachable — it stays in the sheet and no screen ever shows it.
        var more = (Number(r.feedTotal) || 0) - (r.feed || []).length;
        var al = $('#feedAll');
        if (al) { al.style.display = more > 0 ? '' : 'none'; al.textContent = 'See all ' + r.feedTotal + ' posts ›'; }
      }, { freshFor: 300000,        // ~5 min — don't re-fetch on every visit
           // Member-scoped node, guarded by a rule of auth.uid === $uid.
           fsDoc: 'members/' + ((S.me && S.me.id) || '_'), fsAuth: true,
           fsShape: function (d) {
             if (!d || d.points == null) return null;
             if (d.joinedClubs) saveJoinedClubs_(d.joinedClubs);   // keeps the clubs overlay honest
             return { ok: true, partial: true, points: d.points, tier: d.tier,
               connections: d.connections, requests: d.requests, credits: d.credits,
               unreadChat: d.unreadChat, unreadNotifs: d.unreadNotifs };
           } });
    }
  },
});

function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
function firstName(n) { return String(n || 'there').trim().split(/\s+/)[0]; }
function qtile(q, ic, label) {
  return '<div class="card tap" data-q="' + q + '" style="margin:0;display:flex;align-items:center;gap:12px;padding:15px">' +
    '<div style="font-size:24px">' + ic + '</div><div style="font-weight:600;font-size:14px;line-height:1.2">' + label + '</div></div>';
}

/* ------------------------------------------------------------------ Feed (shared) */
var FEED_CLAMP = 260;   // characters shown before a post collapses behind "Read more"
var Feed = (function () {
  function postCardHTML(p) {
    var mine = p.memberId === (S.me && S.me.id);
    // Long posts are clamped so one essay doesn't push everything else off the screen.
    var long = String(p.text || '').length > FEED_CLAMP;
    return '<div class="post" data-post="' + esc(p.id) + '">' +
      '<div class="phead">' + avatarHTML({ name: p.name, avatarUrl: p.avatarUrl }, 'md') +
        '<div class="grow" style="flex:1"><div class="pname">' + esc(p.name) + '</div>' +
        '<div class="ptime">' + esc(timeAgo(p.createdAt)) + (mine ? ' · you' : '') + '</div></div></div>' +
      '<div class="ptext' + (long ? ' clamped' : '') + '">' + linkify(p.text) + '</div>' +
      (long ? '<button class="ptext-more" data-act="more">Read more</button>' : '') +
      (p.imageUrl ? '<img class="pimg" src="' + esc(p.imageUrl) + '" alt=""/>' : '') +
      '<div class="pacts">' +
        '<button data-act="like" class="' + (p.liked ? 'liked' : '') + '">' + (p.liked ? '❤️' : '🤍') + ' <span class="lc">' + (p.likeCount || 0) + '</span></button>' +
        '<button data-act="comment">💬 <span>' + (p.commentCount || 0) + '</span></button>' +
      '</div></div>';
  }
  function linkify(t) { return esc(t).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }

  function renderInto(elm, posts, visited) {
    if (!posts.length) {
      // Only invite them to post if they actually CAN. createPost is gated on a first purchase, so
      // "Be the first to share something" sends a brand-new member straight into a rejection.
      elm.innerHTML = (visited === false)
        ? emptyState('📝', 'The feed opens up after your first visit',
            'Buy anything at the counter and you can post, message other regulars and see who else is in.')
        : emptyState('📝', 'No posts yet', 'Be the first to share something.');
      return;
    }
    elm.innerHTML = posts.map(postCardHTML).join('');
    $$('.post', elm).forEach(function (card) { wireCard(card); });
  }
  function wireCard(card) {
    var pid = card.dataset.post;
    var mb = card.querySelector('[data-act="more"]');
    if (mb) mb.addEventListener('click', function () {
      var t = card.querySelector('.ptext'), open = t.classList.toggle('clamped');
      mb.textContent = open ? 'Read more' : 'Show less';
    });
    card.querySelector('[data-act="like"]').addEventListener('click', function () {
      var btn = this, liked = btn.classList.toggle('liked');
      btn.firstChild.textContent = liked ? '❤️ ' : '🤍 ';
      var lc = btn.querySelector('.lc'); lc.textContent = Math.max(0, (parseInt(lc.textContent, 10) || 0) + (liked ? 1 : -1));
      api('likePost', { postId: pid }, true);
    });
    card.querySelector('[data-act="comment"]').addEventListener('click', function () { openComments(pid); });
  }
  function compose() {
    var img = '';
    modal('<h3>Share with the community</h3>' +
      '<textarea class="field" id="cpText" maxlength="500" placeholder="What\'s on your mind?" style="min-height:110px"></textarea>' +
      '<div id="cpPreview"></div>' +
      '<button class="btn ghost block" id="cpPhoto">📷 Add photo</button>' +
      '<div class="modal-actions"><button class="btn ghost" id="cpCancel">Cancel</button>' +
      '<button class="btn primary" id="cpPost">Post</button></div>');
    $('#cpCancel').addEventListener('click', closeModal);
    $('#cpPhoto').addEventListener('click', function () { pickImage(function (d) { img = d; $('#cpPreview').innerHTML = '<img src="' + d + '" style="width:100%;border-radius:12px;margin:8px 0"/>'; }); });
    $('#cpPost').addEventListener('click', function () {
      var text = $('#cpText').value.trim();
      if (!text && !img) { toast('Write something or add a photo.'); return; }
      var postBtn = this;
      postBtn.disabled = true;
      api('createPost', { text: text, imageUrl: img }).then(function (r) {
        // Re-enable rather than closing: the unlock modal replaces this one, and if they dismiss it
        // their typed post should still be there.
        if (visitLockToast(r)) { postBtn.disabled = false; return; }
        closeModal();
        if (r && r.ok) { swrDrop('home', 'feed'); toast('Posted!'); if (current().name === 'home') renderCurrent(); }
        else toast((r && r.error) || 'Could not post.');
      });
    });
  }
  function openComments(pid) {
    modal('<h3>Comments</h3><div id="cmList">' + skeletonList(2) + '</div>' +
      '<div class="composer" style="margin:12px 0 0">' + avatarHTML(S.me, 'sm') +
      '<input class="field" id="cmInput" placeholder="Add a comment…"/></div>' +
      '<div class="modal-actions"><button class="btn primary block" id="cmSend">Send</button></div>');
    function draw() {
      api('listComments', { postId: pid }, true).then(function (r) {
        var list = (r && r.comments) || [];
        $('#cmList').innerHTML = list.length ? list.map(function (c) {
          return '<div style="display:flex;gap:10px;margin-bottom:12px">' + avatarHTML({ name: c.name, avatarUrl: c.avatarUrl }, 'sm') +
            '<div><div style="font-weight:600;font-size:13px">' + esc(c.name) + (c.statusEmoji ? ' ' + esc(c.statusEmoji) : '') + ' <span class="muted small">· ' + esc(timeAgo(c.createdAt)) + '</span></div>' +
            '<div style="font-size:14px">' + esc(c.text) + '</div></div></div>';
        }).join('') : '<div class="muted small center" style="padding:14px">No comments yet.</div>';
      });
    }
    draw();
    $('#cmSend').addEventListener('click', function () {
      var t = $('#cmInput').value.trim(); if (!t) return;
      $('#cmInput').value = '';
      var box = $('#cmList');   // optimistic: show it right away — no overlay, silent refresh
      if (box) {
        if (box.querySelector('.muted.center')) box.innerHTML = '';
        box.insertAdjacentHTML('beforeend', '<div style="display:flex;gap:10px;margin-bottom:12px">' + avatarHTML(S.me, 'sm') +
          '<div><div style="font-weight:600;font-size:13px">' + esc((S.me && S.me.name) || 'You') + ' <span class="muted small">· now</span></div>' +
          '<div style="font-size:14px">' + esc(t) + '</div></div></div>');
      }
      api('commentPost', { postId: pid, text: t }, true).then(draw);
    });
    $('#cmInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#cmSend').click(); });
  }
  return { renderInto: renderInto, compose: compose, postCardHTML: postCardHTML };
})();

/* ------------------------------------------------------------------ Full feed
   The home screen shows the newest few posts. This is where the rest live — without it, anything
   that scrolls off the preview is stored but unreachable. Pages 20 at a time. */
var _feedLimit = 20;
registerView('feed', {
  title: 'Community feed',
  nav: false,
  render: function (host) {
    host.innerHTML =
      '<div class="composer" id="fvComposer">' + avatarHTML(S.me, 'md') +
        '<input class="field" placeholder="Share something with the community…" readonly/></div>' +
      '<div id="fvList">' + skeletonList(4) + '</div>' +
      '<div id="fvMore"></div>';
    $('#fvComposer').addEventListener('click', Feed.compose);
    apiSWR('feed', { limit: _feedLimit }, function (r) {
      if (!r || !r.ok) { $('#fvList').innerHTML = '<div class="card muted small center">Couldn\'t load the feed.</div>'; return; }
      var posts = r.posts || [], total = Number(r.total) || posts.length;
      Feed.renderInto($('#fvList'), posts);
      var mb = $('#fvMore');
      if (total > posts.length) {
        mb.innerHTML = '<button class="btn ghost block" id="fvMoreBtn">Show more (' + (total - posts.length) + ' older)</button>';
        $('#fvMoreBtn').addEventListener('click', function () {
          this.disabled = true; this.textContent = 'Loading…';
          _feedLimit += 20; swrDrop('feed'); renderCurrent();
        });
      } else mb.innerHTML = posts.length
        ? '<div class="muted small center" style="padding:10px 0 4px">That\'s everything — you\'re all caught up.</div>' : '';
    });
  }
});

/* ------------------------------------------------------------------ Notification history */
registerView('notifications', {
  title: 'Notifications',
  nav: false,
  render: function (host) {
    host.innerHTML = '<div id="nfBar" style="display:flex;justify-content:flex-end;margin:2px 4px 8px"></div><div id="nfList">' + skeletonList(3) + '</div>';
    var ICONS = { order: '☕', reservation: '📅', inquiry: '✉️', gift: '🎁', bonus: '🏆', badge: '🏅', info: '🔔' };
    api('notifications', {}, true).then(function (r) {
      var list = (r && r.notifications) || [];
      swrDrop('home');   // clear the bell dot next time home refreshes (server already marked them read)
      $('#nfBar').innerHTML = list.some(function (n) { return n.unread; }) ? '<button class="btn ghost small" id="nfMarkAll">✓ Mark all as read</button>' : '';
      $('#nfList').innerHTML = list.length ? list.map(function (n) {
        return '<div class="card" style="' + (n.unread ? 'border-left:3px solid var(--accent);' : 'opacity:.85;') + 'display:flex;gap:12px;align-items:flex-start">' +
          '<div style="font-size:22px">' + (ICONS[n.type] || '🔔') + '</div>' +
          '<div style="flex:1"><div style="font-size:14px">' + esc(n.text) + '</div>' +
          '<div class="muted small mt8">' + esc(timeAgo(n.createdAt)) + '</div></div></div>';
      }).join('') : emptyState('🔔', 'Nothing yet', 'Order updates, replies, bonuses and gifts will appear here.');
      var mb = $('#nfMarkAll'); if (mb) mb.addEventListener('click', function () {
        $$('#nfList .card').forEach(function (c) { c.style.borderLeft = 'none'; c.style.opacity = '.85'; });
        $('#nfBar').innerHTML = ''; var nd = $('#hbNotifDot'); if (nd) nd.style.display = 'none'; toast('All marked read');
      });
    });
  }
});

// Where a notification jumps to when tapped (null = not tappable).
function notifRouteName(n) {
  switch (n && n.type) {
    case 'order': return { view: 'orders' };
    case 'reservation': return { view: 'reserve' };
    case 'inquiry': return { view: 'inquiries' };
    case 'gift': case 'bonus': return { view: 'rewards' };
    case 'badge': return { view: 'badges' };
    default: return null;
  }
}
// Bubble-style notification popup (instead of a full page). Each item is tappable → jumps to it.
function openNotifPopup() {
  var ICONS = { order: '☕', reservation: '📅', inquiry: '✉️', gift: '🎁', bonus: '🏆', badge: '🏅', info: '🔔' };
  modal('<h3 style="display:flex;align-items:center;justify-content:space-between;gap:10px">Notifications ' +
      refreshBtn('nfRefresh') + '</h3>' +
    '<div id="nfPop" style="max-height:60vh;overflow-y:auto;margin:-4px -4px 0">' + skeletonList(3) + '</div>' +
    '<div class="modal-actions"><button class="btn ghost" id="nfMarkAllPop">✓ Mark all read</button><button class="btn ghost" id="nfClose">Close</button></div>');
  $('#nfClose').addEventListener('click', closeModal);
  $('#nfMarkAllPop').addEventListener('click', function () {
    $$('#nfPop .card').forEach(function (c) { c.style.borderLeft = 'none'; c.style.opacity = '.8'; });
    var nd = $('#hbNotifDot'); if (nd) nd.style.display = 'none'; toast('All marked read');
  });
  // Refetch in place. This popup is where you sit waiting on a reply or a top-up approval, so
  // reopening it just to see whether anything landed is the wrong thing to have to do.
  wireRefresh('nfRefresh', loadNotifs);
  loadNotifs();

  function loadNotifs() {
    return api('notifications', {}, true).then(function (r) {
      var box = $('#nfPop'); if (!box) return;   // popup already dismissed
      var list = (r && r.notifications) || [];
      swrDrop('home');
      var nd = $('#hbNotifDot'); if (nd) nd.style.display = 'none';   // opening clears the unread dot
      if (!list.length) { box.innerHTML = emptyState('🔔', 'Nothing yet', 'Order updates, replies, bonuses and gifts appear here.'); return; }
      box.innerHTML = list.slice(0, 25).map(function (n, i) {
        var tappable = !!notifRouteName(n);
        return '<div class="card" data-i="' + i + '" style="margin:8px 4px;' + (n.unread ? 'border-left:3px solid var(--accent);' : 'opacity:.8;') + 'display:flex;gap:12px;align-items:flex-start;' + (tappable ? 'cursor:pointer' : '') + '">' +
          '<div style="font-size:20px">' + (ICONS[n.type] || '🔔') + '</div>' +
          '<div style="flex:1"><div style="font-size:14px">' + esc(n.text) + '</div>' +
          '<div class="muted small mt8">' + esc(timeAgo(n.createdAt)) + (tappable ? ' · Tap to view ›' : '') + '</div></div></div>';
      }).join('');
      $$('#nfPop [data-i]').forEach(function (c) { c.addEventListener('click', function () {
        var dest = notifRouteName(list[Number(c.dataset.i)]);
        if (dest) { closeModal(); go(dest.view, dest.params || {}); }
      }); });
    });
  }
}
