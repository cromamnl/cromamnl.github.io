/* ============================================================================
   admin.js — in-app admin panel (owner/admin only; role auto-granted from the
   shared POS Employees). Sections: Overview, Events, Reservations, Inquiries,
   Members, Posts (moderation), Rewards.
   ========================================================================== */
function toLocalInput(s) {
  var d = parseDT(s); if (!d) return '';
  function p(n) { return ('0' + n).slice(-2); }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}

registerView('admin', {
  title: 'Admin',
  nav: false,
  render: function (host) {
    var SECTIONS = [
      { id: 'dash', label: 'Overview' }, { id: 'events', label: 'Events' },
      { id: 'reservations', label: 'Reservations' }, { id: 'inquiries', label: 'Inquiries' },
      { id: 'members', label: 'Members' }, { id: 'posts', label: 'Posts' },
      { id: 'rewards', label: 'Rewards & points' }, { id: 'clubs', label: 'Clubs' }
    ];
    var active = S.cache.adminSection || 'dash';
    host.innerHTML =
      '<div class="chips" style="overflow-x:auto;flex-wrap:nowrap;padding-bottom:6px;margin-bottom:14px" id="admTabs">' +
      SECTIONS.map(function (s) { return '<span class="chip' + (s.id === active ? ' on' : '') + '" data-sec="' + s.id + '" style="white-space:nowrap">' + s.label + '</span>'; }).join('') +
      '</div><div id="admBody"></div>';
    $$('#admTabs .chip').forEach(function (c) { c.addEventListener('click', function () {
      S.cache.adminSection = c.dataset.sec;
      $$('#admTabs .chip').forEach(function (x) { x.classList.remove('on'); }); c.classList.add('on');
      renderSection(c.dataset.sec);
    }); });
    renderSection(active);

    function renderSection(sec) {
      var body = $('#admBody'); body.innerHTML = skeletonList(3);
      ({ dash: dash, events: events, reservations: reservations, inquiries: inquiries, members: members, posts: posts, rewards: rewardsAndPoints, loyalty: rewardsAndPoints, clubs: clubsSec }[sec] || dash)(body);
    }

    // ---- clubs / groups ----
    function clubsSec(body) {
      apiSWR('adminClubs', {}, function (r) {
        var list = (r && r.clubs) || [];
        body.innerHTML = '<button class="btn primary block" id="clAdd">＋ New club</button><div style="height:10px"></div>' +
          (list.length ? list.map(function (c) {
            return '<div class="card tap" data-cl="' + esc(c.id) + '" style="display:flex;gap:12px;align-items:center">' +
              clubLogoHTML(c, 40) + '<div style="flex:1"><div style="font-weight:700">' + esc(c.name) +
              (c.active ? '' : ' <span class="badge red">Hidden</span>') + '</div>' +
              '<div class="muted small">👥 ' + c.members + ' · ' + esc((c.description || '').slice(0, 60)) + '</div></div><div class="chev">›</div></div>';
          }).join('') : emptyState('👥', 'No clubs yet', 'Create one — members can join from the Community tab.'));
        $('#clAdd').addEventListener('click', function () { editClub(null); });
        $$('#admBody [data-cl]').forEach(function (row) { row.addEventListener('click', function () { editClub(list.filter(function (x) { return x.id === row.dataset.cl; })[0]); }); });
      });
    }
    function editClub(c) {
      c = c || {};
      var clubLogo = c.logoUrl || '';
      modal('<h3>' + (c.id ? 'Edit club' : 'New club') + '</h3>' +
        '<label class="lbl">Logo</label>' +
        '<div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">' +
          '<div id="clLogoPrev"></div>' +
          '<div style="display:flex;flex-direction:column;gap:6px">' +
            '<button class="btn ghost sm" id="clLogoBtn" type="button">📷 Upload logo</button>' +
            '<button class="btn ghost sm danger" id="clLogoRm" type="button" style="display:none">Remove</button></div></div>' +
        '<label class="lbl">Emoji &amp; name <span class="muted">(emoji shows when there\'s no logo)</span></label>' +
        '<div style="display:flex;gap:8px"><input class="field" id="clE" maxlength="4" value="' + esc(c.emoji || '') + '" placeholder="👥" style="width:64px;text-align:center;font-size:22px"/>' +
        '<input class="field" id="clN" value="' + esc(c.name || '') + '" placeholder="Club name" style="flex:1"/></div>' +
        '<label class="lbl">Description</label><textarea class="field" id="clD" maxlength="200">' + esc(c.description || '') + '</textarea>' +
        (c.id ? '<label class="lbl" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="clA" style="width:auto" ' + (c.active !== false ? 'checked' : '') + '/> Visible — members can join</label>' : '') +
        '<div class="modal-actions">' + (c.id ? '<button class="btn ghost danger" id="clDel">Delete</button>' : '') +
        '<button class="btn ghost" id="clX">Cancel</button><button class="btn primary" id="clSave">Save</button></div>');
      $('#clX').addEventListener('click', closeModal);
      function drawLogo() {
        var p = $('#clLogoPrev'); if (p) p.innerHTML = clubLogoHTML({ logoUrl: clubLogo, emoji: ($('#clE') || {}).value || c.emoji }, 56);
        var rm = $('#clLogoRm'); if (rm) rm.style.display = clubLogo ? '' : 'none';
      }
      drawLogo();
      $('#clLogoBtn').addEventListener('click', function () { pickImage(function (d) { clubLogo = d; drawLogo(); }); });
      $('#clLogoRm').addEventListener('click', function () { clubLogo = ''; drawLogo(); });
      var del = $('#clDel'); if (del) del.addEventListener('click', function () {
        api('adminDeleteClub', { id: c.id }).then(function (r) { if (r && r.ok) { closeModal(); swrDrop('clubs', 'adminClubs'); toast('Deleted.'); renderSection('clubs'); } else toast((r && r.error) || 'Error'); });
      });
      $('#clSave').addEventListener('click', function () {
        var payload = { id: c.id || '', name: $('#clN').value.trim(), emoji: $('#clE').value.trim() || '👥', description: $('#clD').value.trim(), logoUrl: clubLogo };
        if (c.id) payload.active = $('#clA') ? $('#clA').checked : true;
        if (!payload.name) { toast('Give the club a name.'); return; }
        this.disabled = true;
        api('adminSaveClub', { club: payload }).then(function (r) { if (r && r.ok) { closeModal(); swrDrop('clubs', 'adminClubs'); toast('Saved.'); renderSection('clubs'); } else { this.disabled = false; toast((r && r.error) || 'Error'); } }.bind(this));
      });
    }

    // ---- Rewards & points: economy settings + tier perks + reward catalog (one section) ----
    function rewardsAndPoints(body) {
      body.innerHTML =
        '<div id="rpSettings">' + skeletonList(1) + '</div>' +
        '<div class="section-title">Reward catalog</div>' +
        '<div id="rpQrPh"></div>' +
        '<div id="rpCatalog">' + skeletonList(2) + '</div>';
      rpSettings($('#rpSettings'));
      rpQrPh($('#rpQrPh'));
      rewards($('#rpCatalog'));   // the voucher catalog (list + add/edit), now nested here
    }
    /* Bank QR for online credit top-ups. Swappable here so replacing the current personal QR with a
       Croma MNL merchant QR Ph later is an upload, not a deploy. Clearing it switches the whole
       online top-up flow off in the app. */
    function rpQrPh(box) {
      if (!box) return;
      apiSWR('adminQrPh', {}, function (r) {
        if (!r || !r.ok) { box.innerHTML = ''; return; }
        box.innerHTML = '<div class="card"><div class="section-title" style="margin-top:0">Bank QR — online top-ups</div>' +
          '<div class="muted small mb8">Members scan this to send money, then submit the reference for staff to verify. ' +
          'Clear the image to switch online top-ups off.</div>' +
          (r.url ? '<div style="display:flex;justify-content:center;margin:10px 0"><img src="' + esc(r.url) + '" alt="Bank QR" style="width:170px;border-radius:10px"/></div>'
                 : '<div class="muted small center" style="padding:12px">No QR set — online top-ups are off.</div>') +
          '<label class="lbl">Account name shown to members</label><input class="field" id="qpName" value="' + esc(r.name || '') + '"/>' +
          '<label class="lbl">Note (fees, instructions)</label><input class="field" id="qpNote" value="' + esc(r.note || '') + '"/>' +
          '<label class="lbl mt8">Replace the QR image</label><input class="field" id="qpFile" type="file" accept="image/*"/>' +
          '<button class="btn primary block mt16" id="qpSave">Save</button>' +
          (r.url ? '<button class="btn ghost danger block" id="qpClear" style="margin-top:8px">Remove QR (turn off online top-ups)</button>' : '') +
          '</div>';
        var pending = null;
        var f = $('#qpFile');
        if (f) f.addEventListener('change', function () {
          var file = this.files && this.files[0]; if (!file) return;
          var fr = new FileReader();
          fr.onload = function () { pending = fr.result; toast('Image ready — tap Save.'); };
          fr.readAsDataURL(file);
        });
        var s = $('#qpSave');
        if (s) s.addEventListener('click', function () {
          var btn = this; btn.disabled = true; btn.textContent = 'Saving…';
          var body = { name: $('#qpName').value, note: $('#qpNote').value };
          if (pending) body.image = pending;
          api('adminSaveQrPh', body).then(function (rr) {
            btn.disabled = false; btn.textContent = 'Save';
            if (!rr || !rr.ok) { toast((rr && rr.error) || 'Could not save.'); return; }
            swrDrop('adminQrPh', 'credits'); toast('Saved ✓'); rpQrPh(box);
          });
        });
        var c = $('#qpClear');
        if (c) c.addEventListener('click', function () {
          confirmModal('Turn off online top-ups?', 'Members will only be able to top up at the counter. You can add a QR again anytime.', 'Remove', function () {
            api('adminSaveQrPh', { image: '' }).then(function () { swrDrop('adminQrPh', 'credits'); toast('Online top-ups off.'); rpQrPh(box); });
          });
        });
      });
    }
    function rpSettings(box) {
      apiSWR('adminLoyaltySettings', {}, function (r) {
        if (!r || !r.ok) { box.innerHTML = emptyState('🔒', 'Admins only'); return; }
        var ppp = Number(r.pesoPerPoint) || 10, silver = Number(r.tierSilver) || 0, gold = Number(r.tierGold) || 0;
        box.innerHTML =
          '<div class="card"><div class="section-title" style="margin-top:0">Points & tiers</div>' +
            '<div class="muted small mb8">Applies across the app and POS. Points are lifetime; tier is by the last 12 months of spend.</div>' +
            '<label class="lbl">₱ spent per point earned</label><input class="field" id="loPeso" type="number" min="1" value="' + ppp + '"/>' +
            '<label class="lbl">Silver tier — ₱ spent in last 12 months</label><input class="field" id="loSilver" type="number" min="0" value="' + silver + '"/>' +
            '<label class="lbl">Gold tier — ₱ spent in last 12 months</label><input class="field" id="loGold" type="number" min="0" value="' + gold + '"/>' +
            '<button class="btn primary block big mt16" id="loSave">Save settings</button>' +
          '</div>' +
          '<div class="card" style="background:var(--surface2);box-shadow:none"><div class="section-title" style="margin-top:0">Tier perks</div>' +
            tierPerkRow('🥉', 'Bronze', 'Everyone starts here', 'Earns 1 point per ₱' + ppp + ' spent') +
            tierPerkRow('🥈', 'Silver', '₱' + silver.toLocaleString() + ' spent in 12 months', 'Unlocks advance ordering') +
            tierPerkRow('🥇', 'Gold', '₱' + gold.toLocaleString() + ' spent in 12 months', 'Unlocks reservations for fewer than 5 people') +
          '</div>';
        $('#loSave').addEventListener('click', function () {
          var btn = this; btn.disabled = true;
          api('adminSaveLoyaltySettings', { pesoPerPoint: $('#loPeso').value, tierSilver: $('#loSilver').value, tierGold: $('#loGold').value }).then(function (rr) {
            btn.disabled = false;
            if (rr && rr.ok) { swrDrop('adminLoyaltySettings'); toast('Saved ✓'); rpSettings(box); }   // refresh perks with new thresholds
            else toast((rr && rr.error) || 'Could not save.');
          });
        });
      });
    }
    function tierPerkRow(medal, name, threshold, perk) {
      return '<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)">' +
        '<div style="font-size:22px">' + medal + '</div><div style="flex:1">' +
        '<div style="font-weight:700">' + esc(name) + ' <span class="muted small" style="font-weight:400">· ' + esc(threshold) + '</span></div>' +
        '<div class="muted small mt8">' + esc(perk) + '</div></div></div>';
    }

    // ---- overview ----
    function dash(body) {
      apiSWR('adminSummary', {}, function (r) {
        if (!r || !r.ok) { body.innerHTML = emptyState('🔒', (r && r.error) || 'Admins only'); return; }
        body.innerHTML =
          '<div class="stat-row"><div class="stat"><div class="v">' + r.pendingReservations + '</div><div class="l">Pending bookings</div></div>' +
          '<div class="stat"><div class="v">' + r.openInquiries + '</div><div class="l">Open inquiries</div></div></div>' +
          '<div class="stat-row"><div class="stat"><div class="v">' + r.members + '</div><div class="l">Members</div></div>' +
          '<div class="stat"><div class="v">' + r.posts + '</div><div class="l">Posts</div></div></div>' +
          '<div class="muted small center mt16">You\'re an admin because your email matches a POS owner/admin. Use the tabs above to manage the community.</div>' +
          '<div class="section-title" style="color:var(--red);margin-top:26px">Danger zone</div>' +
          '<div class="card"><div class="muted small mb8">Clear all test data — members, posts, events, bookings, inquiries, advance orders, store credits and notifications — for a clean launch. Admin accounts and the reward catalog are kept, and this can\'t be undone.</div>' +
          '<button class="btn ghost danger block" id="admReset">Reset all community data</button></div>';
        $('#admReset').addEventListener('click', resetModal);
      });
    }
    function resetModal() {
      modal('<h3 style="color:var(--red)">Reset all data?</h3><p class="muted small">Permanently removes every member (except admins), post, event, booking, inquiry, redemption, advance order, store-credit entry and notification. The reward catalog stays. Type <strong>RESET</strong> to confirm.</p>' +
        '<p class="muted small">Store-credit balances are wiped too — make sure nobody is holding credit they paid for.</p>' +
        '<input class="field" id="rstC" placeholder="RESET" autocomplete="off" autocapitalize="characters"/>' +
        '<div class="modal-actions"><button class="btn ghost" id="rstX">Cancel</button><button class="btn danger" id="rstGo">Reset everything</button></div>');
      $('#rstX').addEventListener('click', closeModal);
      $('#rstGo').addEventListener('click', function () {
        if ($('#rstC').value.trim() !== 'RESET') { toast('Type RESET to confirm.'); return; }
        this.disabled = true;
        api('adminResetData', { confirm: 'RESET' }).then(function (r) {
          if (r && r.ok) { closeModal(); Object.keys(_swr).forEach(function (k) { delete _swr[k]; }); toast('All test data cleared ✓'); renderSection('dash'); }
          else { toast((r && r.error) || 'Could not reset.'); }
        });
      });
    }

    // ---- events ----
    function events(body) {
      apiSWR('adminEvents', {}, function (r) {
        var evs = (r && r.events) || [];
        body.innerHTML = '<button class="btn primary block big mb8" id="admAddEvent">+ Add event</button>' +
          (evs.length ? '<div class="list">' + evs.map(function (e) {
            return '<div class="item" data-ev="' + esc(e.id) + '"><div class="grow"><div class="t">' + esc(e.title) + (e.active ? '' : ' <span class="badge red">Hidden</span>') + '</div>' +
              '<div class="s">' + esc(fmtEventWhen(e.startAt)) + ' · ' + e.going + ' going</div></div><div class="chev">›</div></div>';
          }).join('') + '</div>' : emptyState('🎉', 'No events yet'));
        $('#admAddEvent').addEventListener('click', function () { editEvent(null); });
        $$('#admBody [data-ev]').forEach(function (row) { row.addEventListener('click', function () { editEvent(evs.filter(function (x) { return x.id === row.dataset.ev; })[0]); }); });
      });
    }
    function editEvent(ev) {
      ev = ev || {};
      modal('<h3>' + (ev.id ? 'Edit event' : 'Add event') + '</h3>' +
        '<label class="lbl">Title</label><input class="field" id="evT" value="' + esc(ev.title || '') + '"/>' +
        '<label class="lbl">Date &amp; time</label><input class="field" id="evS" type="datetime-local" value="' + esc(toLocalInput(ev.startAt)) + '"/>' +
        '<label class="lbl">Location</label><input class="field" id="evL" value="' + esc(ev.location || 'Croma MNL Café') + '"/>' +
        '<label class="lbl">Capacity (0 = no limit)</label><input class="field" id="evC" type="number" min="0" value="' + (ev.capacity || 0) + '"/>' +
        '<label class="lbl">Description</label><textarea class="field" id="evD">' + esc(ev.description || '') + '</textarea>' +
        '<label class="lbl">Club <span class="muted">(optional — links this event to a club)</span></label>' +
        '<select class="field" id="evClubSel"><option value="">No club</option></select>' +
        '<label class="lbl">Images <span class="muted">(1st = banner; up to 6, shown on the dashboard)</span></label>' +
        '<div id="evImgStrip" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"></div>' +
        '<button class="btn ghost block" id="evAddImg" type="button" style="margin-bottom:6px">📷 Add image</button>' +
        (ev.id ? '<label class="lbl" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="evA" style="width:auto" ' + (ev.active !== false ? 'checked' : '') + '/> Visible in the app</label>' : '') +
        '<div class="modal-actions">' + (ev.id ? '<button class="btn ghost danger" id="evDel">Delete</button>' : '') +
        '<button class="btn ghost" id="evX">Cancel</button><button class="btn primary" id="evSave">Save</button></div>');
      $('#evX').addEventListener('click', closeModal);
      api('adminClubs', {}, true).then(function (r) {   // populate the club picker
        var sel = $('#evClubSel'); if (!sel) return;
        ((r && r.clubs) || []).forEach(function (c) {
          var o = document.createElement('option'); o.value = c.id; o.textContent = c.emoji + ' ' + c.name;
          if (ev.clubId === c.id) o.selected = true;
          sel.appendChild(o);
        });
      });
      var evImgs = (ev.images || []).slice();
      function drawEvImgs() {
        var strip = $('#evImgStrip'); if (!strip) return;
        strip.innerHTML = evImgs.map(function (src, i) {
          return '<div style="position:relative;width:64px;height:64px;border-radius:8px;overflow:hidden;border:1px solid var(--line)">' +
            '<img src="' + esc(src) + '" style="width:100%;height:100%;object-fit:cover"/>' +
            '<button type="button" data-rmimg="' + i + '" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1">✕</button>' +
            (i === 0 ? '<span style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.5);color:#fff;font-size:9px;text-align:center">banner</span>' : '') + '</div>';
        }).join('');
        $$('#evImgStrip [data-rmimg]').forEach(function (b) { b.addEventListener('click', function () { evImgs.splice(parseInt(b.dataset.rmimg, 10), 1); drawEvImgs(); }); });
      }
      drawEvImgs();
      $('#evAddImg').addEventListener('click', function () { if (evImgs.length >= 6) { toast('Up to 6 images.'); return; } pickImage(function (d) { evImgs.push(d); drawEvImgs(); }); });
      var del = $('#evDel'); if (del) del.addEventListener('click', function () {
        api('adminDeleteEvent', { id: ev.id }).then(function (r) { if (r && r.ok) { closeModal(); swrDrop('events', 'adminEvents', 'home', 'myEvents'); toast('Deleted.'); renderSection('events'); } else toast((r && r.error) || 'Error'); });
      });
      $('#evSave').addEventListener('click', function () {
        var payload = { id: ev.id || '', title: $('#evT').value.trim(), startAt: $('#evS').value, location: $('#evL').value.trim(), capacity: Number($('#evC').value) || 0, description: $('#evD').value.trim(), images: evImgs, clubId: ($('#evClubSel') || {}).value || '' };
        if (ev.id) payload.active = $('#evA') ? $('#evA').checked : true;
        if (!payload.title || !payload.startAt) { toast('Title and date/time are required.'); return; }
        this.disabled = true;
        api('adminSaveEvent', { event: payload }).then(function (r) { if (r && r.ok) { closeModal(); swrDrop('events', 'adminEvents', 'home', 'myEvents'); toast('Saved.'); renderSection('events'); } else { toast((r && r.error) || 'Error'); } });
      });
    }

    // ---- reservations ----
    function reservations(body) {
      apiSWR('adminReservations', {}, function (r) {
        var list = (r && r.reservations) || [];
        body.innerHTML = list.length ? list.map(function (v) {
          var badge = v.status === 'confirmed' ? 'green' : v.status === 'cancelled' ? 'red' : 'amber';
          var acts = v.status === 'cancelled' ? '' : '<button class="btn primary sm" data-conf="' + esc(v.id) + '">Confirm</button> <button class="btn ghost danger sm" data-canc="' + esc(v.id) + '">Cancel</button>';
          return '<div class="card"><div class="spread"><div><div style="font-weight:700">' + esc(fmtDate(v.date)) + ' · ' + esc(v.time) + '</div>' +
            '<div class="muted small mt8">' + esc(v.name) + ' · party of ' + esc(v.partySize) + (v.phone ? ' · ' + esc(v.phone) : '') + (v.notes ? ' · ' + esc(v.notes) : '') + '</div></div>' +
            '<span class="badge ' + badge + '">' + esc(v.status) + '</span></div>' + (acts ? '<div class="row-gap" style="margin-top:12px">' + acts + '</div>' : '') + '</div>';
        }).join('') : emptyState('📅', 'No reservations');
        $$('#admBody [data-conf]').forEach(function (b) { b.addEventListener('click', function () { resStatus(b.dataset.conf, 'confirmed'); }); });
        $$('#admBody [data-canc]').forEach(function (b) { b.addEventListener('click', function () { resStatus(b.dataset.canc, 'cancelled'); }); });
      });
    }
    function resStatus(id, status) { api('adminReservationStatus', { id: id, status: status }).then(function (r) { if (r && r.ok) { swrDrop('adminReservations'); toast('Reservation ' + status + '.'); renderSection('reservations'); } else toast((r && r.error) || 'Error'); }); }

    // ---- inquiries ----
    function inquiries(body) {
      apiSWR('adminInquiries', {}, function (r) {
        var list = (r && r.inquiries) || [];
        body.innerHTML = list.length ? list.map(function (q) {
          var msgs = q.messages || [], last = msgs[msgs.length - 1] || {};
          var needsReply = (q.status !== 'answered') || last.from === 'member';
          var preview = (last.from === 'staff' ? 'Croma MNL: ' : (esc(q.name || 'Member') + ': ')) + esc(String(last.text || q.message || '').slice(0, 90));
          return '<div class="card"><div class="spread" style="gap:8px;align-items:flex-start"><div style="font-weight:700;min-width:0;word-break:break-word">' + esc(q.subject) + '</div><span class="badge ' + (needsReply ? 'amber' : 'green') + '" style="flex:none;white-space:nowrap">' + (needsReply ? 'Needs reply' : 'Answered') + '</span></div>' +
            (q.eventTitle ? '<div style="margin-top:8px"><span class="chip soft">🎉 ' + esc(q.eventTitle) + '</span></div>' : '') +
            '<div class="muted small mt8">' + esc(q.name || '') + (q.email ? ' · ' + esc(q.email) : '') + ' · ' + esc(timeAgo(q.createdAt)) + '</div>' +
            '<div class="muted small mt8" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + preview + '</div>' +
            '<button class="btn ' + (needsReply ? 'primary' : 'ghost') + ' sm" style="margin-top:10px" data-reply="' + esc(q.id) + '">Open &amp; reply</button></div>';
        }).join('') : emptyState('✉️', 'No inquiries');
        $$('#admBody [data-reply]').forEach(function (b) { b.addEventListener('click', function () { replyInq(list.filter(function (x) { return x.id === b.dataset.reply; })[0]); }); });
      });
    }
    function replyInq(q) {
      modal('<h3 style="margin-bottom:2px">' + esc(q.subject) + '</h3><div class="muted small mb8">From ' + esc(q.name || 'member') + (q.email ? ' · ' + esc(q.email) : '') + '</div>' +
        '<div id="inqThread" style="max-height:46vh;overflow-y:auto;margin:4px -2px;padding:2px">' + inquiryThreadHTML(q.messages) + '</div>' +
        '<label class="lbl">Your reply' + (q.email ? ' (also emailed to the member)' : '') + '</label><textarea class="field" id="inqR" placeholder="Type your reply…"></textarea>' +
        '<div class="modal-actions"><button class="btn ghost" id="inqX">Close</button><button class="btn primary" id="inqSend">Send reply</button></div>');
      $('#inqX').addEventListener('click', closeModal);
      var box = $('#inqThread'); if (box) box.scrollTop = box.scrollHeight;
      $('#inqSend').addEventListener('click', function () { var reply = $('#inqR').value.trim(); if (!reply) { toast('Write a reply.'); return; } this.disabled = true;
        api('adminReplyInquiry', { id: q.id, reply: reply }).then(function (r) { if (r && r.ok) { closeModal(); swrDrop('adminInquiries'); toast('Reply sent.'); renderSection('inquiries'); } else { toast((r && r.error) || 'Error'); } }); });
    }

    // ---- members (open + moderate) ----
    function members(body) {
      body.innerHTML = '<input class="field" id="admMemQ" placeholder="Search members by name or email…"/><div id="admMemList">' + skeletonList(3) + '</div>';
      var t; $('#admMemQ').addEventListener('input', function () { var q = this.value.trim(); clearTimeout(t); t = setTimeout(function () { loadMembers(q); }, 250); });
      loadMembers('');
      function loadMembers(q) {
        api('adminMembers', { q: q }, true).then(function (r) {
          var list = (r && r.members) || [];
          $('#admMemList').innerHTML = list.length ? '<div class="list">' + list.map(function (m) {
            var tag = m.role === 'admin' ? ' <span class="badge soft">admin</span>' : (m.active ? '' : ' <span class="badge red">banned</span>');
            if (m.verified && m.role !== 'admin') tag += ' <span class="badge green">verified</span>';
            return '<div class="item">' + avatarHTML(m, 'sm') + '<div class="grow"><div class="t">' + esc(m.name) + tag + '</div><div class="s">' + esc(m.email || m.phone || '') + '</div></div>' +
              (m.id === (S.me && S.me.id) ? '<span class="muted small">you</span>' : '<button class="btn ghost small" data-mem="' + esc(m.id) + '">Manage</button>') + '</div>';
          }).join('') + '</div>' : emptyState('👥', 'No members found');
          $$('#admMemList [data-mem]').forEach(function (b) { b.addEventListener('click', function () { manageMember(list.filter(function (x) { return x.id === b.dataset.mem; })[0], loadMembers, q); }); });
        });
      }
      function manageMember(m, reload, q) {
        modal('<h3>' + esc(m.name) + '</h3><div class="muted small mb8">' + esc(m.email || m.phone || '') + (m.role === 'admin' ? ' · admin' : '') + '</div>' +
          '<div class="modal-actions" style="flex-direction:column">' +
          // The first-visit gate normally lifts on a member's first purchase. This is the manual
          // override — needed for a Play Store reviewer, who has to see the whole app without
          // being able to buy anything.
          (m.role === 'admin' ? '' :
            (m.verified
              ? '<button class="btn ghost block" id="memUnver">✓ Verified — tap to remove</button>'
              : '<button class="btn ghost block" id="memVer">Verify (skip the first-visit gate)</button>')) +
          (m.active ? '<button class="btn ghost danger block" id="memBan">Ban (block sign-in)</button>' : '<button class="btn ghost block" id="memUnban">Un-ban</button>') +
          '<button class="btn ghost danger block" id="memDel">Remove permanently</button>' +
          '<button class="btn ghost block" id="memX">Close</button></div>');
        $('#memX').addEventListener('click', closeModal);
        // `op`, not `action`: the payload key `action` is the transport's route name, so sending
        // one here used to rewrite the route and break every one of these buttons.
        function act(op, msg) { api('adminMemberAction', { memberId: m.id, op: op }).then(function (r) { if (r && r.ok) { closeModal(); swrDrop('members', 'myConnections', 'home'); toast(msg); reload(q); } else toast((r && r.error) || 'Error'); }); }
        function setVer(on) {
          api('adminSetVerified', { memberId: m.id, verified: on }).then(function (r) {
            if (r && r.ok) { closeModal(); swrDrop('members', 'home'); toast(on ? 'Verified — the community is open to them.' : 'Verification removed.'); reload(q); }
            else toast((r && r.error) || 'Error');
          });
        }
        var b; if ((b = $('#memVer'))) b.addEventListener('click', function () { setVer(true); });
        if ((b = $('#memUnver'))) b.addEventListener('click', function () { setVer(false); });
        if ((b = $('#memBan'))) b.addEventListener('click', function () { act('ban', 'Member banned.'); });
        if ((b = $('#memUnban'))) b.addEventListener('click', function () { act('unban', 'Member un-banned.'); });
        $('#memDel').addEventListener('click', function () { if (this.dataset.armed) act('delete', 'Member removed.'); else { this.dataset.armed = '1'; this.textContent = 'Tap again to confirm removal'; } });
      }
    }

    // ---- feed moderation ----
    function posts(body) {
      apiSWR('adminPosts', {}, function (r) {
        var list = (r && r.posts) || [];
        body.innerHTML = list.length ? list.map(function (p) {
          return '<div class="card"><div class="spread"><div style="font-weight:600">' + esc(p.name) + (p.active ? '' : ' <span class="badge red">Hidden</span>') + '</div><div class="muted small">' + esc(timeAgo(p.createdAt)) + '</div></div>' +
            '<div style="margin-top:6px;font-size:14px;white-space:pre-wrap;word-break:break-word">' + esc(p.text) + '</div>' +
            (p.imageUrl ? '<img src="' + esc(p.imageUrl) + '" style="width:100%;border-radius:10px;margin-top:8px"/>' : '') +
            '<div class="row-gap" style="margin-top:10px">' +
            (p.active ? '<button class="btn ghost small" data-hide="' + esc(p.id) + '">Hide</button>' : '<button class="btn ghost small" data-show="' + esc(p.id) + '">Un-hide</button>') +
            '<button class="btn ghost small danger" data-delp="' + esc(p.id) + '">Delete</button></div></div>';
        }).join('') : emptyState('📝', 'No posts');
        $$('#admBody [data-hide]').forEach(function (b) { b.addEventListener('click', function () { hidePost(b.dataset.hide, true); }); });
        $$('#admBody [data-show]').forEach(function (b) { b.addEventListener('click', function () { hidePost(b.dataset.show, false); }); });
        $$('#admBody [data-delp]').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.armed) delPost(b.dataset.delp); else { b.dataset.armed = '1'; b.textContent = 'Confirm delete'; } }); });
      });
    }
    function hidePost(id, hide) { api('adminHidePost', { postId: id, hide: hide }).then(function (r) { if (r && r.ok) { swrDrop('home', 'feed', 'adminPosts'); toast(hide ? 'Post hidden.' : 'Post visible.'); renderSection('posts'); } else toast((r && r.error) || 'Error'); }); }
    function delPost(id) { api('adminDeletePost', { postId: id }).then(function (r) { if (r && r.ok) { swrDrop('home', 'feed', 'adminPosts'); toast('Post deleted.'); renderSection('posts'); } else toast((r && r.error) || 'Error'); }); }

    // ---- rewards catalog ----
    function rewards(body) {
      apiSWR('adminRewards', {}, function (r) {
        var list = (r && r.rewards) || [];
        body.innerHTML = '<button class="btn primary block big mb8" id="admAddRw">+ Add reward</button>' +
          (list.length ? '<div class="list">' + list.map(function (rw) {
            return '<div class="item" data-rw="' + esc(rw.id) + '"><div class="grow"><div class="t">' + esc(rw.title) + (rw.active ? '' : ' <span class="badge red">Off</span>') + '</div><div class="s">★ ' + rw.cost + ' pts · ' + esc(rewardKindLabel(rw)) + (rw.description ? ' · ' + esc(rw.description) : '') + '</div></div><div class="chev">›</div></div>';
          }).join('') + '</div>' : emptyState('★', 'No rewards'));
        $('#admAddRw').addEventListener('click', function () { editReward(null); });
        $$('#admBody [data-rw]').forEach(function (row) { row.addEventListener('click', function () { editReward(list.filter(function (x) { return x.id === row.dataset.rw; })[0]); }); });
      });
    }
    // human label for a reward's discount config, shown in the admin list
    function rewardKindLabel(rw) {
      var t = rw.discountType, v = rw.discountValue;
      if (t === 'freeCategory') return 'Free ' + (v || 'item');
      if (t === 'amount') return money(Number(v) || 0) + ' off';
      if (t === 'percent') return (Number(v) || 0) + '% off';
      return 'Perk';
    }
    function editReward(rw) {
      rw = rw || {};
      var kind = rw.discountType === 'amount' ? 'amount' : rw.discountType === 'percent' ? 'percent' : 'freeCategory';
      var curVal = rw.discountValue;
      modal('<h3>' + (rw.id ? 'Edit reward' : 'Add reward') + '</h3>' +
        '<label class="lbl">Title</label><input class="field" id="rwT" value="' + esc(rw.title || '') + '" placeholder="e.g. Free Coffee"/>' +
        '<label class="lbl">Points cost</label><input class="field" id="rwC" type="number" min="1" value="' + (rw.cost || 50) + '"/>' +
        '<label class="lbl">Description <span class="muted">(optional)</span></label><input class="field" id="rwD" value="' + esc(rw.description || '') + '"/>' +
        '<label class="lbl">Reward type</label>' +
        '<select class="field" id="rwKind">' +
          '<option value="freeCategory"' + (kind === 'freeCategory' ? ' selected' : '') + '>🎁 Free item — pick a category</option>' +
          '<option value="amount"' + (kind === 'amount' ? ' selected' : '') + '>₱ Peso off the order</option>' +
          '<option value="percent"' + (kind === 'percent' ? ' selected' : '') + '>% Percent off the order</option>' +
        '</select><div id="rwKindBox"></div>' +
        '<label class="lbl">Minimum tier to redeem</label><select class="field" id="rwTier">' + ['Bronze', 'Silver', 'Gold'].map(function (t) { return '<option' + ((rw.minTier || 'Bronze') === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
        (rw.id ? '<label class="lbl" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="rwA" style="width:auto" ' + (rw.active !== false ? 'checked' : '') + '/> Available to redeem</label>' : '') +
        '<div class="modal-actions">' + (rw.id ? '<button class="btn ghost danger" id="rwDel">Delete</button>' : '') +
        '<button class="btn ghost" id="rwX">Cancel</button><button class="btn primary" id="rwSave">Save</button></div>');
      $('#rwX').addEventListener('click', closeModal);
      // swap the value field to match the chosen reward type
      function drawKind() {
        var k = $('#rwKind').value, box = $('#rwKindBox');
        if (k === 'freeCategory') {
          box.innerHTML = '<label class="lbl">Free item from…</label><select class="field" id="rwCat"><option value="">Loading categories…</option></select>' +
            '<div class="muted small mt8">When the voucher is used on an advance order, the cheapest item in this category is free.</div>';
          apiSWR('menu', {}, function (r) {
            var sel = $('#rwCat'); if (!sel) return;
            var cats = ((r && r.menu) || []).map(function (m) { return m.category; });
            sel.innerHTML = cats.length ? cats.map(function (c) { return '<option' + (String(curVal) === String(c) ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') : '<option value="">No menu categories yet</option>';
            if (curVal && cats.map(String).indexOf(String(curVal)) < 0) { var o = document.createElement('option'); o.value = curVal; o.textContent = curVal + ' (custom)'; o.selected = true; sel.appendChild(o); }
          });
        } else if (k === 'amount') {
          box.innerHTML = '<label class="lbl">Peso off (₱)</label><input class="field" id="rwVal" type="number" min="1" value="' + (rw.discountType === 'amount' ? (Number(curVal) || 50) : 50) + '"/>' +
            '<div class="muted small mt8">Flat ₱ discount applied to the order total.</div>';
        } else {
          box.innerHTML = '<label class="lbl">Percent off (%)</label><input class="field" id="rwVal" type="number" min="1" max="100" value="' + (rw.discountType === 'percent' ? (Number(curVal) || 10) : 10) + '"/>' +
            '<div class="muted small mt8">Percentage taken off the order total.</div>';
        }
      }
      $('#rwKind').addEventListener('change', drawKind);
      drawKind();
      var del = $('#rwDel'); if (del) del.addEventListener('click', function () { api('adminDeleteReward', { id: rw.id }).then(function (r) { if (r && r.ok) { closeModal(); swrDrop('adminRewards', 'rewards'); toast('Deleted.'); renderSection('rewards'); } else toast((r && r.error) || 'Error'); }); });
      $('#rwSave').addEventListener('click', function () {
        var k = $('#rwKind').value;
        var dVal = k === 'freeCategory' ? (($('#rwCat') || {}).value || '') : (Number(($('#rwVal') || {}).value) || 0);
        var payload = { id: rw.id || '', title: $('#rwT').value.trim(), cost: Number($('#rwC').value) || 0, description: $('#rwD').value.trim(),
          minTier: ($('#rwTier') || {}).value || 'Bronze', discountType: k, discountValue: dVal };
        if (rw.id) payload.active = $('#rwA') ? $('#rwA').checked : true;
        if (!payload.title || payload.cost <= 0) { toast('Title and a points cost are required.'); return; }
        if (k === 'freeCategory' && !dVal) { toast('Pick which category is free.'); return; }
        if (k !== 'freeCategory' && !(dVal > 0)) { toast('Enter a discount amount.'); return; }
        this.disabled = true;
        api('adminSaveReward', { reward: payload }).then(function (r) { if (r && r.ok) { closeModal(); swrDrop('adminRewards', 'rewards'); toast('Saved.'); renderSection('rewards'); } else { toast((r && r.error) || 'Error'); } });
      });
    }
  }
});
