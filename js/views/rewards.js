/* ============================================================================
   rewards.js — loyalty: points balance, tier progress, reward catalog, and
   the codes to show at the counter. Points are earned from POS purchases.
   ========================================================================== */
var TIER_COLORS = { Bronze: '#a8722b', Silver: '#8a8f98', Gold: '#c79a3a' };
// Metallic hero gradients + a shimmer sweep per tier — the page "feels" bronze/silver/gold.
var TIER_GRADIENTS = {
  Bronze: 'linear-gradient(135deg,#6e4520,#b0773d 45%,#8a5a2b)',
  Silver: 'linear-gradient(135deg,#5d646e,#b9c0ca 45%,#767e89)',
  Gold:   'linear-gradient(135deg,#8f6a12,#e7c95c 45%,#b8901f)'
};
var TIER_MEDALS = { Bronze: '🥉', Silver: '🥈', Gold: '🥇' };
function ensureTierFX() {
  if (document.getElementById('tierFX')) return;
  var s = document.createElement('style'); s.id = 'tierFX';
  s.textContent = '@keyframes tierShine{0%{transform:translateX(-120%) skewX(-18deg)}100%{transform:translateX(240%) skewX(-18deg)}}' +
    '.tier-hero{position:relative;overflow:hidden}' +
    '.tier-hero .shine{position:absolute;top:-20%;bottom:-20%;width:45%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);animation:tierShine 3.2s ease-in-out infinite;pointer-events:none}' +
    '.tier-hero .medal{position:absolute;right:-6px;bottom:-14px;font-size:88px;opacity:.18;pointer-events:none}';
  document.head.appendChild(s);
}

// The member's QR (payload "CROMAMBR:<id>"). The POS scans it to tag the sale so points
// credit automatically — no name-matching needed. renderQR lives in views/order.js.
function showMemberQR() {
  var id = (S.me && S.me.id) || '', tier = (S.me && S.me.tier) || 'Bronze';
  ensureTierFX();
  modal('<div class="tier-hero" style="background:' + (TIER_GRADIENTS[tier] || TIER_GRADIENTS.Bronze) + ';margin:-2px -2px 0;border-radius:16px;padding:18px 16px;color:#fff">' +
      '<span class="shine"></span><span class="medal">' + (TIER_MEDALS[tier] || '🥉') + '</span>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:11px;position:relative">' + avatarHTML(S.me, 'md') +
        '<div style="text-align:left"><div style="font-weight:800;font-size:18px;text-shadow:0 1px 4px rgba(0,0,0,.2)">' + esc((S.me && S.me.name) || 'Member') + '</div>' +
        '<div style="font-size:13px;opacity:.96">' + (TIER_MEDALS[tier] || '★') + ' ' + esc(tier) + ' member</div></div></div></div>' +
    '<div style="background:#fff;border-radius:16px;padding:18px 18px 14px;margin:14px 2px 10px;box-shadow:0 4px 16px rgba(0,0,0,.1)">' +
      '<div id="memberQR" style="display:flex;justify-content:center"></div>' +
      '<div class="center" style="margin-top:12px"><div style="color:#888;font-size:12px">Member code</div>' +
      '<div style="font-family:\'Courier New\',monospace;font-weight:700;font-size:12px;word-break:break-all;color:#333">' + esc(id) + '</div></div></div>' +
    '<p class="muted small center">Show this at the counter — the cashier scans it so your purchase earns points.</p>' +
    '<button class="btn primary block big mt8" id="mqClose">Done</button>');
  if (typeof renderQR === 'function') renderQR($('#memberQR'), 'CROMAMBR:' + id);
  var c = $('#mqClose'); if (c) c.addEventListener('click', closeModal);
}

registerView('rewards', {
  title: 'Rewards',
  render: function (host) {
    host.innerHTML = '<div id="loyHero"></div><div id="loyBody">' + skeletonList(3) + '</div>';
    load();

    function load() {
      Promise.all([api('loyalty', {}, true), api('rewards', {}, true), api('myRedemptions', {}, true)]).then(function (res) {
        var loy = res[0] || {}, rw = res[1] || {}, red = res[2] || {};
        ensureTierFX();
        var tier = loy.tier || 'Bronze';
        var redeemedCount = ((red.redemptions || []).filter(function (r) { return r.status !== 'cancelled'; })).length;
        $('#loyHero').innerHTML =
          '<div class="hero tier-hero" style="background:' + (TIER_GRADIENTS[tier] || TIER_GRADIENTS.Bronze) + '">' +
            '<span class="shine"></span><span class="medal">' + (TIER_MEDALS[tier] || '🥉') + '</span>' +
            '<div class="spread"><div><div class="hi">YOUR POINTS</div>' +
              '<div class="name" style="font-size:34px">' + (loy.points || 0) + '</div></div>' +
              '<span class="badge" style="background:rgba(255,255,255,.92);color:var(--brand);align-self:flex-start">' + (TIER_MEDALS[tier] || '★') + ' ' + esc(tier) + '</span></div>' +
            progressBlock(loy) +
          '</div>' +
          '<div class="stat-row"><div class="stat"><div class="v">' + redeemedCount + '</div><div class="l">Vouchers redeemed</div></div>' +
            '<div class="stat"><div class="v">' + (loy.visits || 0) + '</div><div class="l">Transactions</div></div></div>';

        var reds = (red.redemptions || []).filter(function (r) { return r.status === 'active'; });
        var out = '';
        if (reds.length) {
          out += '<div class="section-title">Ready to claim</div>';
          out += reds.map(codeCard).join('');
        }
        out += '<div class="section-title">Redeem your points</div>';
        out += (rw.rewards || []).map(function (r) { return rewardCard(r); }).join('');
        out += '<button class="btn primary block big" id="myMemberQR" style="margin-top:6px">☕ Show my member QR</button>';
        out += '<button class="btn ghost block" id="seeTiers" style="margin-top:8px">🏅 Tiers &amp; perks — what you unlock</button>';
        out += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px">' +
          '<button class="btn ghost" id="rwGift">🎁 Gift points</button>' +
          '<button class="btn ghost" id="rwInvite">👥 Invite friends</button>' +
          '<button class="btn ghost" id="rwBoard">🏆 Leaderboard</button>' +
          '<button class="btn ghost" id="rwBadges">🏅 Badges</button></div>';
        out += '<div class="card" style="background:var(--surface2);box-shadow:none;margin-top:12px"><div class="small muted">' +
          '☕ Earn <strong>1 point for every ' + money(loy.pesoPerPoint || 10).replace('.00', '') + '</strong> you spend. Scan your member QR at the counter so your purchase counts automatically.</div></div>';
        $('#loyBody').innerHTML = out;
        var qb = $('#myMemberQR'); if (qb) qb.addEventListener('click', showMemberQR);
        var stb = $('#seeTiers'); if (stb) stb.addEventListener('click', function () { go('tiers'); });
        var g1 = $('#rwGift'); if (g1) g1.addEventListener('click', giftPointsFlow);
        var g2 = $('#rwInvite'); if (g2) g2.addEventListener('click', inviteFriendsFlow);
        var g3 = $('#rwBoard'); if (g3) g3.addEventListener('click', function () { go('leaderboard'); });
        var g4 = $('#rwBadges'); if (g4) g4.addEventListener('click', function () { go('badges'); });
        $$('#loyBody [data-redeem]').forEach(function (b) { b.addEventListener('click', function () { confirmRedeem(b.dataset.redeem, b.dataset.title, b.dataset.cost); }); });
      });
    }
    function progressBlock(loy) {
      if (!loy.nextTier) return '<div class="meta"><span>🏆 You\'ve reached the top tier!</span></div>';
      var pct = Math.round((loy.progress || 0) * 100);
      return '<div style="margin-top:14px"><div style="height:8px;border-radius:5px;background:rgba(255,255,255,.28);overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:#fbf6ee;border-radius:5px"></div></div>' +
        '<div class="small" style="margin-top:7px;opacity:.9">' + (loy.toNextTier || 0) + ' more points to <strong>' + esc(loy.nextTier) + '</strong></div></div>';
    }
    function rewardCard(r) {
      var tierChip = (r.minTier && r.minTier !== 'Bronze') ? '<span class="chip soft" style="margin-left:6px;color:' + (TIER_COLORS[r.minTier] || 'var(--accent)') + '">★ ' + esc(r.minTier) + '+</span>' : '';
      var label = r.tierLocked ? esc(r.minTier) + ' only' : (r.canRedeem ? 'Redeem' : 'Locked');
      return '<div class="card"' + (r.tierLocked ? ' style="opacity:.7"' : '') + '><div class="spread" style="align-items:flex-start"><div style="flex:1">' +
        '<div style="font-weight:700;font-size:15px">' + (r.tierLocked ? '🔒 ' : '') + esc(r.title) + '</div>' +
        '<div class="muted small mt8">' + esc(r.description || '') + '</div>' +
        '<div style="margin-top:10px"><span class="chip soft">★ ' + r.cost + ' pts</span>' + tierChip + '</div></div>' +
        '<button class="btn ' + (r.canRedeem ? 'primary' : 'ghost') + ' sm" ' + (r.canRedeem ? '' : 'disabled ') +
          'data-redeem="' + esc(r.id) + '" data-title="' + esc(r.title) + '" data-cost="' + r.cost + '">' + label + '</button></div></div>';
    }
    function codeCard(r) {
      return '<div class="card" style="border:1px dashed var(--accent)"><div class="spread"><div style="font-weight:700">' + esc(r.title) + '</div>' +
        '<span class="badge green">Active</span></div>' +
        '<div style="text-align:center;margin:12px 0 4px"><div class="muted small">Show this code at the counter</div>' +
        '<div style="font-size:30px;font-weight:800;letter-spacing:5px;color:var(--brand);font-family:\'Courier New\',monospace">' + esc(r.code) + '</div></div></div>';
    }
    function confirmRedeem(id, title, cost) {
      modal('<h3>Redeem reward?</h3><p class="muted">Use <strong>' + esc(cost) + ' points</strong> for <strong>' + esc(title) + '</strong>? ' +
        'You\'ll get a code to show at the counter.</p>' +
        '<div class="modal-actions"><button class="btn ghost" id="rdCancel">Cancel</button>' +
        '<button class="btn primary" id="rdYes">Redeem</button></div>');
      $('#rdCancel').addEventListener('click', closeModal);
      $('#rdYes').addEventListener('click', function () {
        this.disabled = true;
        api('redeemReward', { rewardId: id }).then(function (r) {
          closeModal();
          if (r && r.ok) { swrDrop('home', 'rewards', 'loyalty', 'myRedemptions'); toast('Redeemed! Show your code at the counter ☕'); load(); }
          else toast((r && r.error) || 'Could not redeem.');
        });
      });
    }
  },
});

// Tiers & perks page — what each tier unlocks + progress to the next.
registerView('tiers', {
  title: 'Tiers & perks',
  nav: false,
  render: function (host) {
    host.innerHTML = '<div id="tierBody">' + skeletonList(3) + '</div>';
    api('loyalty', {}, true).then(function (loy) {
      loy = loy || {};
      var myT = loy.tier || 'Bronze', rank = { Bronze: 0, Silver: 1, Gold: 2 };
      var ppLabel = money(loy.pesoPerPoint || 10).replace('.00', '');
      var silverAt = loy.tierSilver != null ? loy.tierSilver : 2000, goldAt = loy.tierGold != null ? loy.tierGold : 10000;
      var tiers = [
        { key: 'Bronze', at: 0, color: TIER_COLORS.Bronze, perks: [
          'Earn 1 point for every ' + ppLabel + ' you spend',
          'Redeem points for free drinks, food & discounts',
          'RSVP to Croma MNL events',
          'Community feed, connections & chat',
          'Ask the café anything (inquiries)',
          'Reserve a table for 5 or more' ] },
        { key: 'Silver', at: silverAt, color: TIER_COLORS.Silver, perks: [
          'Everything in Bronze, plus:',
          '🛍️ Advance ordering — order ahead & skip the queue',
          '🎁 Apply reward vouchers to your advance orders' ] },
        { key: 'Gold', at: goldAt, color: TIER_COLORS.Gold, perks: [
          'Everything in Silver, plus:',
          '📅 Reserve small tables — parties under 5 people',
          '✨ Top-tier status' ] }
      ];
      var out = '<div class="hero" style="background:linear-gradient(135deg,var(--brand),' + (TIER_COLORS[myT] || 'var(--accent)') + ')">' +
        '<div class="hi">YOUR TIER</div><div class="name" style="font-size:30px">★ ' + esc(myT) + '</div>' +
        '<div class="meta"><span>' + (loy.nextTier
          ? money(loy.toNextTier || 0).replace('.00', '') + ' more spend (last 12 mo) → ' + esc(loy.nextTier)
          : '🏆 You\'ve reached the top tier!') + '</span></div></div>';
      out += tiers.map(function (t) {
        var reached = rank[myT] >= rank[t.key];
        return '<div class="card" style="border-left:4px solid ' + t.color + (reached ? '' : ';opacity:.9') + '">' +
          '<div class="spread"><div style="font-weight:800;font-size:17px;color:' + t.color + '">' + (reached ? '✓ ' : '') + t.key + '</div>' +
          '<span class="chip soft">' + (t.at > 0 ? money(t.at).replace('.00', '') + ' / 12 mo' : 'Everyone') + '</span></div>' +
          '<div style="margin-top:8px">' + t.perks.map(function (p) {
            return '<div style="display:flex;gap:8px;padding:4px 0;font-size:14px"><span style="color:' + t.color + '">•</span><span>' + esc(p) + '</span></div>';
          }).join('') + '</div></div>';
      }).join('');
      out += '<div class="card" style="background:var(--surface2);box-shadow:none"><div class="small muted">' +
        'Your tier reflects spend over the last 12 months. Points you earn never expire — only your tier status refreshes.</div></div>';
      $('#tierBody').innerHTML = out;
    });
  }
});

// ---- Leaderboard ----
registerView('leaderboard', {
  title: 'Leaderboard', nav: false,
  render: function (host) {
    host.innerHTML = '<div id="lbBody">' + skeletonList(5) + '</div>';
    api('leaderboard', {}, true).then(function (r) {
      if (!r || !r.ok) { $('#lbBody').innerHTML = emptyState('🏆', 'No rankings yet'); return; }
      var medal = ['🥇', '🥈', '🥉'];
      var out = '<div class="muted small mb8">Top members by points' + (r.myRank ? ' — you\'re #' + r.myRank + ' of ' + r.total : '') + '.</div>';
      out += r.top.length ? r.top.map(function (m) {
        return '<div class="card" style="display:flex;align-items:center;gap:12px;margin-bottom:8px' + (m.isMe ? ';border:1px solid var(--accent)' : '') + '">' +
          '<div style="width:30px;text-align:center;font-weight:800;font-size:16px">' + (medal[m.rank - 1] || m.rank) + '</div>' +
          avatarHTML({ name: m.name, avatarUrl: m.avatarUrl }, 'md') +
          '<div class="grow" style="flex:1;font-weight:700">' + esc(m.name) + (m.isMe ? ' <span class="muted small">(you)</span>' : '') + '</div>' +
          '<div style="font-weight:800;color:var(--accent)">' + m.points + '</div></div>';
      }).join('') : emptyState('🏆', 'No rankings yet', 'Earn points to climb the board.');
      $('#lbBody').innerHTML = out;
    });
  }
});

// ---- Badges ----
// Own badges, or another member's when opened with { memberId } (badges are public).
registerView('badges', {
  title: 'Badges', nav: false,
  render: function (host, p) {
    var mid = (p && p.memberId) || '';
    host.innerHTML = '<div id="bgBody">' + skeletonList(3) + '</div>';
    api('badges', mid ? { memberId: mid } : {}, true).then(function (r) {
      if (!r || !r.ok) { $('#bgBody').innerHTML = emptyState('🏅', 'No badges yet'); return; }
      var who = r.mine ? 'You\'ve' : esc(r.name) + ' has';
      $('#bgBody').innerHTML = '<div class="muted small mb8">' + who + ' earned ' + r.earned + ' of ' + r.total + ' badges.</div>' +
        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">' +
        r.badges.map(function (b) {
          return '<div class="card center" style="margin:0;' + (b.got ? '' : 'opacity:.5') + '"><div style="font-size:34px">' + b.icon + '</div>' +
            '<div style="font-weight:700;margin-top:4px">' + esc(b.title) + '</div><div class="muted small">' + esc(b.sub) + '</div>' +
            (b.got ? '<div class="badge green" style="margin-top:6px">Earned ✓</div>' : '<div class="chip soft" style="margin-top:6px">Locked</div>') + '</div>';
        }).join('') + '</div>';
    });
  }
});

/* Badge strip — the earned badges as a horizontal row, shown on your own profile AND on any
   member's public profile. Fills `#<hostId>` in the background so the profile paints instantly. */
function fillBadgeStrip(hostId, memberId) {
  var h0 = $('#' + hostId); if (!h0) return;
  // Placeholder first — another member's badges need a fresh compute, so blank space would just
  // look like "no badges" for a second or two.
  h0.innerHTML = '<div class="section-title">Badges</div><div class="badge-strip">' +
    '<div class="bs-item" style="opacity:.45"><div class="bs-ic">🏅</div><div class="bs-t">…</div></div>'.repeat(4) + '</div>';
  api('badges', memberId ? { memberId: memberId } : {}, true).then(function (r) {
    var host = $('#' + hostId); if (!host) return;              // navigated away while loading
    if (!r || !r.ok) {                                          // never leave the placeholder spinning
      host.innerHTML = '<div class="section-title">Badges</div><div class="card muted small center" style="margin-top:0">' +
        esc((r && r.error) || 'Couldn\'t load badges.') + '</div>';
      return;
    }
    var got = r.badges.filter(function (b) { return b.got; });
    host.innerHTML = '<div class="section-title">Badges <a id="' + hostId + 'All">See all ›</a></div>' +
      (got.length
        ? '<div class="badge-strip">' + got.map(function (b) {
            return '<div class="bs-item"><div class="bs-ic">' + b.icon + '</div><div class="bs-t">' + esc(b.title) + '</div></div>';
          }).join('') + '</div>' +
          '<div class="muted small" style="margin:4px 2px 0">' + (r.mine ? 'You\'ve' : esc(r.name) + ' has') + ' earned ' + r.earned + ' of ' + r.total + '.</div>'
        : '<div class="card muted small center" style="margin-top:0">No badges yet' + (r.mine ? ' — visit the café, connect and post to unlock them.' : '.') + '</div>');
    var a = $('#' + hostId + 'All');
    if (a) a.addEventListener('click', function () { go('badges', memberId ? { memberId: memberId } : {}); });
    $$('#' + hostId + ' .bs-item').forEach(function (el) {
      el.addEventListener('click', function () { go('badges', memberId ? { memberId: memberId } : {}); });
    });
  });
}

// ---- Gift points (to a connection) ----
function giftPointsFlow() {
  // Open the modal INSTANTLY (no waiting on a network round-trip), then fill the recipient list
  // from the SWR cache (myConnections is prefetched at login → usually instant).
  modal('<h3>Gift points</h3>' +
    '<label class="lbl">To</label><select class="field" id="giftTo"><option value="">Loading friends…</option></select>' +
    '<label class="lbl">How many points</label><input class="field" id="giftAmt" type="number" min="1" placeholder="e.g. 50"/>' +
    '<div class="modal-actions"><button class="btn ghost" id="giftX">Cancel</button><button class="btn primary" id="giftGo" disabled>Send gift</button></div>');
  $('#giftX').addEventListener('click', closeModal);
  $('#giftGo').addEventListener('click', function () {
    var to = ($('#giftTo') || {}).value, amt = Number(($('#giftAmt') || {}).value) || 0, btn = this;
    if (!to) { toast('Pick someone to gift to.'); return; }
    if (amt <= 0) { toast('Enter points to gift.'); return; }
    btn.disabled = true;
    api('giftPoints', { toMemberId: to, amount: amt }).then(function (rr) {
      if (rr && rr.ok) { closeModal(); swrDrop('loyalty'); toast('Sent ' + amt + ' pts to ' + rr.to + ' 🎁'); if (current().name === 'rewards') renderCurrent(); }
      else { btn.disabled = false; toast((rr && rr.error) || 'Could not send.'); }
    });
  });
  apiSWR('myConnections', {}, function (r) {
    var sel = $('#giftTo'); if (!sel) return;   // modal already closed
    var conns = (r && r.connections) || [];
    if (!conns.length) { closeModal(); toast('Connect with members in the Community tab first.'); return; }
    sel.innerHTML = conns.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
    var go = $('#giftGo'); if (go) go.disabled = false;
  });
}

// ---- Invite friends (referral) ----
function inviteFriendsFlow() {
  api('myReferral', {}, true).then(function (r) {
    if (!r || !r.ok) { toast('Could not load your invite.'); return; }
    var link = 'https://app.cromamnl.com/?ref=' + encodeURIComponent(r.code);
    modal('<h3>Invite friends</h3>' +
      '<p class="muted small">When a friend joins with your link and makes their first purchase, you get <strong>' + r.bonusReferrer + ' points</strong> and they get <strong>' + r.bonusReferee + '</strong> 🎉</p>' +
      '<div class="card" style="word-break:break-all;font-size:13px;margin:8px 0">' + esc(link) + '</div>' +
      '<div class="muted small">Invited ' + r.invited + ' · earned ' + r.earned + ' pts from referrals</div>' +
      '<div class="modal-actions"><button class="btn ghost" id="invX">Close</button><button class="btn primary" id="invShare">Share / copy</button></div>');
    $('#invX').addEventListener('click', closeModal);
    $('#invShare').addEventListener('click', function () {
      if (navigator.share) { navigator.share({ title: 'Croma MNL Community', text: 'Join me on the Croma MNL app!', url: link }).catch(function () {}); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(link).then(function () { toast('Link copied ✓'); }).catch(function () { toast(link); }); }
      else toast(link);
    });
  });
}

/* ---- Store credits: prepaid pesos, spendable on advance orders ----------------------------------
   Store-only by design: there is no cash-out path anywhere in the app, and top-ups happen at the
   counter (any staff can load them) so no payment gateway is needed for this to work. */
var _crLimit = 10;   // how many top-up requests to show; Show more bumps it
registerView('credits', {
  title: 'Store credits',
  nav: false,
  render: function (host) {
    host.innerHTML =
      '<div class="wallet"><div class="wallet-label">Available balance</div>' +
        '<div id="crBal" class="wallet-bal">…</div>' +
        '<div class="wallet-sub">Prepay your advance orders — skip paying at the counter.</div></div>' +
      '<button class="btn primary block big" id="crPay" style="margin-bottom:14px">📲 Pay with credits at the counter</button>' +
      '<div id="crCounter" class="card"><div style="font-weight:700">Top up at the counter</div>' +
        '<div class="muted small mt8">Pay cash or scan our QR at the POS and any staff member can load it '
        + 'onto your account straight away. Show them your member QR from your profile.</div></div>' +
      '<div id="crOnline"></div>' +
      '<div id="crPending"></div>' +
      '<div class="section-title">Activity</div><div id="crList">' + skeletonList(3) + '</div>';
    var pb = $('#crPay');
    if (pb) pb.addEventListener('click', openPayCode);
    apiSWR('credits', { limit: _crLimit }, function (r) {
      /* Locked replaces the WHOLE screen, not just the list. Leaving the balance card, the pay
         button and the top-up panel in place around a lock notice would show someone a wallet
         they cannot open and a button that only fails — the screen has to read as "not yet",
         not as broken. */
      if (isVisitLocked(r)) { host.innerHTML = visitLockCard(r.error); wireVisitLock(host); return; }
      if (!r || !r.ok) { $('#crList').innerHTML = '<div class="card muted small center">Couldn\'t load your credits.</div>'; return; }
      var b = $('#crBal'); if (b) b.textContent = money(r.balance || 0);
      // Hidden rather than offered when there's no balance for a code to spend.
      if (pb) pb.style.display = (Number(r.balance) > 0) ? '' : 'none';
      renderOnline(r);
      renderPending(r.requests || [], Number(r.requestsTotal) || (r.requests || []).length);
      // Top-ups can be switched off by the owner. Spending never is — an existing balance is money
      // already paid, so it stays usable and we just stop advertising new top-ups.
      var cc = $('#crCounter');
      if (cc && r.topUpsOn === false) cc.innerHTML = '<div style="font-weight:700">Top-ups are paused</div>' +
        '<div class="muted small mt8">We\'re not taking new top-ups at the moment. Your balance above still works as normal.</div>';
      var h = r.history || [];
      // Grouped by day with a running feel, rather than an undifferentiated list of rows.
      $('#crList').innerHTML = h.length ? (function () {
        var out = '', lastDay = '';
        h.forEach(function (e) {
          var day = String(e.createdAt || '').slice(0, 10);
          if (day && day !== lastDay) { lastDay = day; out += '<div class="led-day">' + esc(dayLabel(day)) + '</div>'; }
          var up = e.delta > 0;
          out += '<div class="led"><div class="led-ic ' + (up ? 'up' : 'down') + '">' + (up ? '↑' : '☕') + '</div>' +
            '<div class="led-mid"><div class="led-t">' + esc(e.reason || (up ? 'Top-up' : 'Spent')) + '</div>' +
            '<div class="led-s">' + esc(String(e.createdAt || '').slice(11, 16)) +
              (e.staffName ? ' · ' + esc(e.staffName) : '') + '</div></div>' +
            '<div class="led-amt ' + (up ? 'up' : '') + '">' + (up ? '+' : '−') + money(Math.abs(e.delta)) + '</div></div>';
        });
        return out;
      })() : emptyState('💳', 'No credits yet', 'Top up at the counter to prepay your orders.');
    });

    /* Online top-up. Only appears once the owner has set qrPhUrl in settings — until then there is
       no bank QR to show and this whole section stays hidden. Submitting does NOT add credits: it
       files a request that staff verify against the bank first. */
    function renderOnline(r) {
      var host = $('#crOnline'); if (!host) return;
      if (!r.qrPhUrl || r.topUpsOn === false) { host.innerHTML = ''; return; }
      host.innerHTML = '<div class="section-title">Top up online</div><div class="card">' +
        '<div class="muted small">1. Scan this with your banking or e-wallet app and send the exact amount.' +
        (r.qrPhName ? '<br>Account name: <strong>' + esc(r.qrPhName) + '</strong>' : '') +
        (r.qrPhNote ? '<br>' + esc(r.qrPhNote) : '') + '</div>' +
        '<div style="display:flex;justify-content:center;margin:12px 0">' +
          '<img src="' + esc(r.qrPhUrl) + '" alt="Bank QR" style="width:min(260px,72vw);border-radius:12px"/></div>' +
        '<div class="muted small">2. Then tell us, so we can verify and load it:</div>' +
        '<label class="mt8">Amount sent (₱)</label><input class="field" id="crAmt" type="number" inputmode="numeric" min="' + (r.minTopup || 20) + '" max="' + (r.maxTopup || 50000) + '"/>' +
        '<label class="mt8">Reference number from your receipt</label><input class="field" id="crRef" placeholder="e.g. 1234567890"/>' +
        '<button class="btn primary block" id="crSend" style="margin-top:10px">Submit for verification</button>' +
        '<div class="muted small mt8">Credits appear once our staff match your reference in the bank — usually within store hours.</div></div>';
      var b = $('#crSend');
      if (b) b.addEventListener('click', function () {
        var amt = Math.round(Number(($('#crAmt') || {}).value || 0));
        var ref = String((($('#crRef') || {}).value || '')).trim();
        if (!amt) { toast('Enter the amount you sent.'); return; }
        if (ref.length < 4) { toast('Enter the reference number from your receipt.'); return; }
        b.disabled = true; b.textContent = 'Submitting…';
        api('requestTopUp', { amount: amt, reference: ref, method: 'bank' }, true).then(function (res) {
          b.disabled = false; b.textContent = 'Submit for verification';
          if (visitLockToast(res)) return;   // "come in once" reads better than a bare error toast
          if (!res || !res.ok) { toast((res && res.error) || 'Could not submit.'); return; }
          toast('Submitted ✓ we will verify it shortly');
          swrDrop('credits'); renderCurrent();
        });
      });
    }
    /* Every top-up request, INCLUDING rejected ones. A member who sent money and had it declined
       has to be able to see that, or the money looks like it vanished and the first they hear of it
       is an argument at the counter. Shows 10 at a time with Show more. */
    function renderPending(reqs, total) {
      var host = $('#crPending'); if (!host) return;
      if (!reqs.length) { host.innerHTML = ''; return; }
      var meta = { pending: { cls: 'soft', tag: 'Pending', label: 'Awaiting verification' },
                   approved: { cls: 'green', tag: 'Loaded', label: 'Added to your balance' },
                   rejected: { cls: 'red', tag: 'Declined', label: 'We could not match this in the bank' } };
      host.innerHTML = '<div class="section-title">Online top-ups</div>' + reqs.map(function (x) {
        var m = meta[x.status] || meta.pending;
        return '<div class="card" style="border-color:' + (x.status === 'rejected' ? 'var(--red)' : (x.status === 'approved' ? 'var(--line)' : 'var(--accent)')) + '">' +
          '<div class="spread"><span><strong>' + money(x.amount) + '</strong>' +
            '<div class="muted small">Ref ' + esc(x.reference) + ' · ' + esc(x.createdAt || '') + '</div></span>' +
            '<span class="badge ' + m.cls + '">' + m.tag + '</span></div>' +
          '<div class="muted small mt8">' + esc(m.label) +
            (x.status === 'rejected' && x.note ? ' — ' + esc(x.note) : '') +
            (x.status === 'rejected' ? '. Talk to us at the counter if you think this is wrong.' : '') +
          '</div></div>';
      }).join('') +
      (total > reqs.length
        ? '<button class="btn ghost block" id="crMore">Show more (' + (total - reqs.length) + ' older)</button>'
        : '');
      var mb = $('#crMore');
      if (mb) mb.addEventListener('click', function () {
        mb.disabled = true; mb.textContent = 'Loading…';
        // Ask for a bigger page of the same endpoint rather than adding a second one.
        _crLimit += 20;
        swrDrop('credits');
        renderCurrent();
      });
    }
  }
});

/* ---- Pay with credits: a one-time code the cashier keys in -----------------------------------
   This is the CONSENT step. A member QR only proves you were at the counter at some point — an
   advance order even tags you automatically. This code is generated by you, lives ~2 minutes and
   works exactly once, so it authorises one specific charge and nothing else.
   Big and monospaced on purpose: it gets read aloud or shown across a counter. */
function openPayCode() {
  modal('<h3>Pay with credits</h3>' +
    '<p class="muted small">Show this to the cashier. It works once and expires shortly.</p>' +
    '<div id="pcBody" class="center" style="padding:14px 0"><div class="muted">Getting your code…</div></div>' +
    '<div class="modal-actions"><button class="btn ghost" id="pcClose">Done</button></div>', { noX: true });
  var c = $('#pcClose');
  // Cancel on close, so a live code never lingers usable after the customer walks away.
  if (c) c.addEventListener('click', function () { api('cancelPayCode', {}, true); closeModal(); });

  api('createPayCode', {}, true).then(function (r) {
    var body = $('#pcBody'); if (!body) return;               // sheet already closed
    if (!r || !r.ok) { body.innerHTML = '<div class="muted small">' + esc((r && r.error) || 'Could not create a code.') + '</div>'; return; }
    var left = Number(r.expiresInSec) || 120;
    body.innerHTML =
      '<div style="font-size:42px;font-weight:800;letter-spacing:10px;color:var(--brand);font-family:monospace">' + esc(r.code) + '</div>' +
      '<div class="muted small mt8">Balance ' + money(r.balance) + '</div>' +
      '<div class="muted small" style="margin-top:10px">Expires in <strong id="pcLeft">' + left + '</strong>s</div>';
    var t = setInterval(function () {
      var el = $('#pcLeft');
      if (!el) { clearInterval(t); return; }                  // closed — stop counting
      left--;
      if (left > 0) { el.textContent = left; return; }
      clearInterval(t);
      var b2 = $('#pcBody');
      if (b2) b2.innerHTML = '<div class="muted">That code expired.</div>' +
        '<button class="btn primary block mt16" id="pcAgain">Get a new code</button>';
      var ag = $('#pcAgain');
      if (ag) ag.addEventListener('click', function () { closeModal(); openPayCode(); });
    }, 1000);
  });
}
