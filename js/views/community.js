/* ============================================================================
   community.js — find and connect with fellow regulars; manage requests.
   ========================================================================== */
/* How many members Discover shows at once; "Show more" bumps it. Module scope, like the credits
   screen's _crLimit, so it survives a re-render of the view — but it is reset on a NEW search, or
   typing a name would inherit however far someone had paged through the full list. */
var _cmLimit = 20;

registerView('community', {
  tab: 'community',
  title: 'Community',
  render: function (host) {
    host.innerHTML =
      '<input class="field" id="cmSearch" placeholder="Search members by name or interest…"/>' +
      '<div id="cmClubs"><div class="section-title">Clubs</div><div style="display:flex;gap:10px;overflow:hidden;padding:2px 0 6px">' +
        '<div style="flex:none;width:130px;height:92px;border-radius:12px;background:var(--surface2);opacity:.55"></div>'.repeat(3) +
      '</div></div>' +
      '<div id="cmRequests"></div>' +
      '<div class="section-title">Your connections</div><div id="cmConns">' + skeletonList(2) + '</div>' +
      '<div class="section-title">Discover</div><div id="cmDiscover">' + skeletonList(3) + '</div>';

    apiSWR('clubs', {}, function (r, isCached) {
      var clubs = (r && r.clubs) || [];
      if (!isCached) saveJoinedClubs_(clubs.filter(function (c) { return c.joined; }).map(function (c) { return c.id; }));
      $('#cmClubs').innerHTML = clubs.length
        ? '<div class="section-title">Clubs <a id="cmAllClubs">See all</a></div>' +
          '<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px">' + clubs.slice(0, 8).map(function (c) {
            return '<div class="card tap" data-club="' + esc(c.id) + '" style="margin:0;flex:none;width:130px;text-align:center;padding:14px 10px">' +
              '<div style="display:flex;justify-content:center">' + clubLogoHTML(c, 48) + '</div><div style="font-weight:700;font-size:13px;margin-top:6px;line-height:1.2">' + esc(c.name) + '</div>' +
              '<div class="muted small" style="margin-top:4px">' + c.members + ' member' + (c.members === 1 ? '' : 's') + (c.joined ? ' · ✓' : '') + '</div></div>';
          }).join('') + '</div>'
        : '';
      var all = $('#cmAllClubs'); if (all) all.addEventListener('click', function () { go('clubs'); });
      $$('#cmClubs [data-club]').forEach(function (c) { c.addEventListener('click', function () { go('clubDetail', { clubId: c.dataset.club }); }); });
    }, { fsDoc: 'public/clubs', fsShape: clubsFromReplica_ });
    loadConns();
    search('');
    var t;
    $('#cmSearch').addEventListener('input', function () { var q = this.value.trim(); clearTimeout(t); t = setTimeout(function () { _cmLimit = 20; search(q); }, 220); });

    function loadConns() {
      apiSWR('myConnections', {}, function (r) {
        var reqs = (r && r.requests) || [], conns = (r && r.connections) || [];
        $('#cmRequests').innerHTML = reqs.length
          ? '<div class="section-title">Requests <span class="badge red">' + reqs.length + '</span></div><div class="list">' + reqs.map(reqRow).join('') + '</div>'
          : '';
        $('#cmConns').innerHTML = conns.length ? '<div class="list">' + conns.map(function (m) { return memberRow(m, 'connected'); }).join('') + '</div>'
          : emptyState('👋', 'No connections yet', 'Discover regulars below and say hi.');
        wire($('#cmRequests')); wire($('#cmConns'));
      });
    }
    function search(q) {
      apiSWR('members', { q: q, limit: _cmLimit }, function (r) {
        // Not-yet-visited members get the unlock card instead of an empty list, so the state reads
        // as "there's something to earn here" rather than "the app is broken".
        if (isVisitLocked(r)) { $('#cmDiscover').innerHTML = visitLockCard(r.error); wireVisitLock($('#cmDiscover')); return; }
        var list = ((r && r.members) || []).filter(function (m) { return m.id !== (S.me && S.me.id); });
        var total = Number(r && r.total) || list.length;
        var more = total - list.length;
        $('#cmDiscover').innerHTML = list.length
          ? '<div class="list">' + list.map(function (m) { return memberRow(m, m.status); }).join('') + '</div>' +
            (more > 0 ? '<button class="btn ghost block mt8" id="cmMore">Show more (' + more + ' more)</button>' : '')
          : emptyState('🔍', 'No members found');
        wire($('#cmDiscover'));
        var mb = $('#cmMore');
        if (mb) mb.addEventListener('click', function () {
          this.disabled = true; this.textContent = 'Loading…';
          /* Drop the cache before re-asking: the entry is keyed by action+params, and the new
             limit makes a DIFFERENT key — so without this the old short page lingers in storage
             for every future render at the original limit. */
          _cmLimit += 20; swrDrop('members'); search(q);
        });
      });
    }
    function wire(scope) {
      $$('[data-open]', scope).forEach(function (row) { row.addEventListener('click', function (e) {
        if (e.target.closest('[data-act]')) return; go('memberProfile', { memberId: row.dataset.open });
      }); });
      $$('[data-act]', scope).forEach(function (btn) { btn.addEventListener('click', function (e) {
        e.stopPropagation(); doAction(btn.dataset.act, btn.dataset.id, btn);
      }); });
    }
    // All connection actions are SILENT (no full-page overlay) and optimistic: the row updates the
    // instant you tap, the request goes out in the background, and the lists then refresh themselves.
    function refreshQuietly() { swrDrop('myConnections', 'members', 'home'); loadConns(); search(cq()); }
    function cq() { var s = $('#cmSearch'); return s ? s.value.trim() : ''; }
    function doAction(act, mid, btn) {
      if (act === 'connect') {
        var row = btn.parentNode;                                  // remember where the button was, to undo on failure
        btn.outerHTML = '<span class="badge soft">Requested ✓</span>';
        api('connect', { memberId: mid }, true).then(function (r) {
          if (visitLockToast(r)) { refreshQuietly(); return; }
          if (r && r.ok === false) {
            toast(r.error || 'Could not send the request.');
            var t = row && row.querySelector('.badge.soft');
            if (t) t.outerHTML = '<button class="btn primary sm" data-act="connect" data-id="' + esc(mid) + '">Connect</button>';
            wire(row); return;
          }
          if (r && r.accepted) toast('Connected! 🎉');
          refreshQuietly();
        });
      }
      else if (act === 'accept') {
        btn.outerHTML = '<span class="badge green">Connected ✓</span>';
        api('respondConnection', { memberId: mid, accept: true }, true).then(function (r) {
          if (r && r.ok === false) toast(r.error || 'Could not accept.'); else toast('Connected! 🎉');
          refreshQuietly();
        });
      }
      else if (act === 'ignore') {
        var item = btn.closest('.item'); if (item) item.style.display = 'none';
        api('respondConnection', { memberId: mid, accept: false }, true).then(refreshQuietly);
      }
      else if (act === 'cancelReq') {
        var row2 = btn.parentNode;
        btn.outerHTML = '<span class="badge soft">Cancelled</span>';
        api('disconnect', { memberId: mid }, true).then(function (r) {
          if (r && r.ok === false) {
            toast(r.error || 'Could not cancel.');
            var t = row2 && row2.querySelector('.badge.soft');
            if (t) t.outerHTML = '<button class="btn ghost sm danger" data-act="cancelReq" data-id="' + esc(mid) + '">Cancel</button>';
            wire(row2); return;
          }
          refreshQuietly();
        });
      }
      else if (act === 'message') { openChatWith(mid); }
    }
  },
});

function memberRow(m, status) {
  var btn;
  if (status === 'connected') btn = '<button class="btn accent sm" data-act="message" data-id="' + esc(m.id) + '">Message</button>';
  // A sent request is withdrawable right from the list — otherwise a mis-tap is permanent.
  else if (status === 'pending') btn = '<button class="btn ghost sm danger" data-act="cancelReq" data-id="' + esc(m.id) + '">Cancel</button>';
  else if (status === 'incoming') btn = '<button class="btn primary sm" data-act="accept" data-id="' + esc(m.id) + '">Accept</button>';
  else btn = '<button class="btn primary sm" data-act="connect" data-id="' + esc(m.id) + '">Connect</button>';
  return '<div class="item" data-open="' + esc(m.id) + '">' + avatarHTML(m, 'md') +
    '<div class="grow"><div class="t">' + esc(m.name) + '</div>' +
    '<div class="s">' + esc((m.city ? m.city + ' · ' : '') + ((m.hobbies || []).slice(0, 3).join(', ') || 'Croma regular')) + '</div></div>' + btn + '</div>';
}
/* The clubs replica is a PUBLIC shell — it can't carry `joined`, since one shared copy would be
   wrong for every member. Overlay it from this device's own record of what it has joined, so the
   instant paint shows the right ✓ / Join state instead of flickering when the real answer lands. */
function clubsFromReplica_(d) {
  if (!d || !d.clubs || !d.clubs.length) return null;
  var mine = joinedClubs_();
  return { ok: true, clubs: d.clubs.map(function (c) {
    var o = {}; for (var k in c) o[k] = c[k];
    o.joined = mine.indexOf(c.id) > -1;
    return o;
  }) };
}
function reqRow(m) {
  return '<div class="item" data-open="' + esc(m.id) + '">' + avatarHTML(m, 'md') +
    '<div class="grow"><div class="t">' + esc(m.name) + '</div><div class="s">wants to connect</div></div>' +
    '<div class="row-gap"><button class="btn primary sm" data-act="accept" data-id="' + esc(m.id) + '">Accept</button>' +
    '<button class="btn ghost sm" data-act="ignore" data-id="' + esc(m.id) + '">Ignore</button></div></div>';
}

registerView('memberProfile', {
  title: 'Profile',
  nav: false,
  render: function (host, p) {
    host.innerHTML = skeletonList(2);
    api('memberProfile', { memberId: p.memberId }, true).then(function (r) {
      var m = r && r.member; if (!m) { host.innerHTML = emptyState('❓', 'Member not found'); return; }
      host.innerHTML =
        '<div class="profile-head">' + avatarHTML(m, 'xl') +
          '<div class="pn">' + esc(m.name) + '</div>' +
          '<div class="muted small">' + esc(m.city || '') + '</div></div>' +
        (m.bio ? '<div class="card center" style="margin-top:14px">' + esc(m.bio) + '</div>' : '') +
        (m.hobbies && m.hobbies.length ? '<div class="section-title">Interests</div><div class="chips">' +
          m.hobbies.map(function (h) { return '<span class="chip soft">' + esc(h) + '</span>'; }).join('') + '</div>' : '') +
        '<div id="mpBadges"></div>' +
        '<div class="mt16" id="mpActions"></div>';
      fillBadgeStrip('mpBadges', m.id);            // their badges — public, same strip as their own profile
      paintActions(m.status || 'none');
      function paintActions(st) {
        var acts = '';
        if (st === 'connected') acts = '<button class="btn accent block big" id="mpMsg">💬 Message</button>' +
          '<button class="btn ghost danger block" id="mpRemove" style="margin-top:8px">Remove connection</button>';
        else if (st === 'incoming') acts = '<button class="btn primary block big" id="mpAccept">Accept request</button>' +
          '<button class="btn ghost block" id="mpIgnore" style="margin-top:8px">Ignore</button>';
        else if (st === 'pending') acts = '<button class="btn ghost block big" disabled>Request sent ✓</button>' +
          '<button class="btn ghost danger block" id="mpCancelReq" style="margin-top:8px">Cancel request</button>';
        else acts = '<button class="btn primary block big" id="mpConnect">Connect</button>';
        var box = $('#mpActions'); if (!box) return;
        box.innerHTML = acts;
        var b;
        if ((b = $('#mpMsg'))) b.addEventListener('click', function () { openChatWith(m.id); });
        // Withdraw a request I sent — no confirm needed, it's harmless and reversible.
        if ((b = $('#mpCancelReq'))) b.addEventListener('click', function () {
          paintActions('none');
          api('disconnect', { memberId: m.id }, true).then(function (r) {
            swrDrop('myConnections', 'members', 'home');
            if (r && r.ok === false) { paintActions('pending'); toast(r.error || 'Could not cancel.'); }
            else toast('Request withdrawn.');
          });
        });
        // Unfriend — confirm first, since it drops an established connection on both sides.
        if ((b = $('#mpRemove'))) b.addEventListener('click', function () {
          confirmModal('Remove connection?', 'You and ' + esc(firstName(m.name)) + ' will no longer be connected. You can send a new request anytime.', 'Remove', function () {
            paintActions('none');
            api('disconnect', { memberId: m.id }, true).then(function (r) {
              swrDrop('myConnections', 'members', 'home');
              if (r && r.ok === false) { paintActions('connected'); toast(r.error || 'Could not remove.'); }
              else toast('Connection removed.');
            });
          });
        });
        if ((b = $('#mpIgnore'))) b.addEventListener('click', function () {
          paintActions('none');
          api('respondConnection', { memberId: m.id, accept: false }, true).then(function () { swrDrop('myConnections', 'members', 'home'); });
        });
        // Silent + optimistic: the button flips immediately, the request goes out in the background.
        if ((b = $('#mpConnect'))) b.addEventListener('click', function () {
          paintActions('pending');
          api('connect', { memberId: m.id }, true).then(function (r) {
            if (visitLockToast(r)) { paintActions('none'); return; }
            swrDrop('myConnections', 'members', 'home');
            if (r && r.accepted) { paintActions('connected'); toast('Connected! 🎉'); }
            else if (r && r.ok === false) { paintActions('none'); toast(r.error || 'Could not send the request.'); }
          });
        });
        if ((b = $('#mpAccept'))) b.addEventListener('click', function () {
          paintActions('connected');
          api('respondConnection', { memberId: m.id, accept: true }, true).then(function (r) {
            swrDrop('myConnections', 'members', 'home');
            if (r && r.ok === false) { paintActions('incoming'); toast(r.error || 'Could not accept.'); } else toast('Connected! 🎉');
          });
        });
      }
    });
  },
});

/* ------------------------------------------------------------------ Clubs */
// A club's badge: uploaded logo image if set, else its emoji (sized in px).
function clubLogoHTML(c, px) {
  px = px || 44;
  if (c && c.logoUrl) return '<img src="' + esc(c.logoUrl) + '" style="width:' + px + 'px;height:' + px + 'px;border-radius:50%;object-fit:cover;flex:none;background:var(--surface2)"/>';
  return '<div style="width:' + px + 'px;height:' + px + 'px;font-size:' + Math.round(px * 0.62) + 'px;line-height:1;display:flex;align-items:center;justify-content:center;flex:none">' + esc((c && c.emoji) || '👥') + '</div>';
}
registerView('clubs', {
  title: 'Clubs',
  nav: false,
  render: function (host) {
    host.innerHTML = '<div class="muted small mb8">Join a club to meet regulars who share your thing.</div><div id="clList">' + skeletonList(3) + '</div>';
    apiSWR('clubs', {}, function (r, isCached) {
      var clubs = (r && r.clubs) || [];
      if (!isCached) saveJoinedClubs_(clubs.filter(function (c) { return c.joined; }).map(function (c) { return c.id; }));
      $('#clList').innerHTML = clubs.length ? clubs.map(function (c) {
        return '<div class="card tap" data-club="' + esc(c.id) + '" style="display:flex;gap:14px;align-items:center">' +
          clubLogoHTML(c, 48) +
          '<div style="flex:1"><div style="font-weight:700">' + esc(c.name) + (c.joined ? ' <span class="badge green">Joined ✓</span>' : '') + '</div>' +
          '<div class="muted small mt8">' + esc((c.description || '').slice(0, 80)) + '</div>' +
          '<div class="muted small" style="margin-top:4px">👥 ' + c.members + ' member' + (c.members === 1 ? '' : 's') + '</div></div><div class="chev">›</div></div>';
      }).join('') : emptyState('👥', 'No clubs yet', 'The café will open clubs soon — watch this space!');
      $$('#clList [data-club]').forEach(function (c) { c.addEventListener('click', function () { go('clubDetail', { clubId: c.dataset.club }); }); });
    }, { fsDoc: 'public/clubs', fsShape: clubsFromReplica_ });
  }
});

registerView('clubDetail', {
  title: 'Club',
  nav: false,
  render: function (host, p) {
    host.innerHTML = skeletonList(3);
    api('clubDetail', { clubId: p.clubId }, true).then(function (r) {
      var c = r && r.club;
      if (!c) { host.innerHTML = emptyState('❓', 'Club not found'); return; }
      host.innerHTML =
        '<div class="card center"><div style="display:flex;justify-content:center;margin-bottom:4px">' + clubLogoHTML(c, 80) + '</div>' +
          '<div style="font-weight:800;font-size:21px;margin-top:6px">' + esc(c.name) + '</div>' +
          (c.description ? '<div class="muted" style="margin-top:8px;font-size:14px">' + esc(c.description) + '</div>' : '') +
          '<div class="muted small mt8">👥 ' + c.members.length + ' member' + (c.members.length === 1 ? '' : 's') + '</div>' +
          '<button class="btn ' + (c.joined ? 'ghost danger' : 'primary') + ' block big mt16" id="clJoin">' + (c.joined ? 'Leave club' : 'Join this club') + '</button></div>' +
        (c.events.length ? '<div class="section-title">Upcoming club events</div><div id="clEvents">' + c.events.map(function (e) {
          return '<div class="card tap" data-ev="' + esc(e.id) + '"><div class="spread"><div><div style="font-weight:700">' + esc(e.title) + '</div>' +
            '<div class="muted small mt8">📅 ' + esc(fmtEventWhen(e.startAt)) + ' · 📍 ' + esc(e.location) + '</div></div><div class="chev">›</div></div></div>';
        }).join('') + '</div>' : '') +
        (c.members.length ? '<div class="section-title">Members</div><div class="list">' + c.members.slice(0, 30).map(function (m) {
          return '<div class="item" data-mem="' + esc(m.id) + '">' + avatarHTML(m, 'md') +
            '<div class="grow"><div class="t">' + esc(m.name) + '</div><div class="s">' + esc(m.city || '') + '</div></div><div class="chev">›</div></div>';
        }).join('') + '</div>' : '');
      $('#clJoin').addEventListener('click', function () {
        var btn = this; btn.disabled = true;
        api(c.joined ? 'leaveClub' : 'joinClub', { clubId: c.id }).then(function (rr) {
          btn.disabled = false;
          if (rr && rr.ok) { swrDrop('clubs'); toast(c.joined ? 'Left the club.' : 'Welcome to ' + c.name + '! ' + c.emoji); renderCurrent(); }
          else toast((rr && rr.error) || 'Error');
        });
      });
      $$('#clEvents [data-ev]').forEach(function (e) { e.addEventListener('click', function () { go('eventDetail', { eventId: e.dataset.ev }); }); });
      $$('#viewBody [data-mem]').forEach(function (m) { m.addEventListener('click', function () { go('memberProfile', { memberId: m.dataset.mem }); }); });
    });
  }
});
