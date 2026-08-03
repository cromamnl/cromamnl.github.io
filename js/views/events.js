/* ============================================================================
   events.js — upcoming Croma MNL events + RSVP. Also exposes Events.cardHTML /
   wireCards so the Home dashboard can show the next event.
   ========================================================================== */
var Events = (function () {
  function cardHTML(e) {
    return '<div class="event-card" data-event="' + esc(e.id) + '">' +
      '<div class="banner" style="' + (e.imageUrl ? "background-image:url('" + esc(e.imageUrl) + "');background-size:cover;background-position:center" : '') + '">' +
        '<span class="badge" style="background:rgba(255,255,255,.9);color:var(--brand)">' + esc(fmtEventWhen(e.startAt)) + '</span></div>' +
      '<div class="ebody"><div class="edate">📅 ' + esc(fmtEventWhen(e.startAt)) + '</div>' +
        '<div class="etitle">' + esc(e.title) + '</div>' +
        '<div class="edesc">' + esc((e.description || '').slice(0, 110)) + ((e.description || '').length > 110 ? '…' : '') + '</div>' +
        '<div class="efoot"><span class="muted small">📍 ' + esc(e.location || 'Croma MNL') + ' · 👥 ' + (e.going || 0) + ' going</span>' +
        (e.rsvp ? '<span class="badge green">Going ✓</span>' : '<span class="badge soft">RSVP ›</span>') + '</div>' +
      '</div></div>';
  }
  function wireCards(scope) {
    $$('.event-card', scope).forEach(function (c) {
      c.addEventListener('click', function () { go('eventDetail', { eventId: c.dataset.event }); });
    });
  }
  return { cardHTML: cardHTML, wireCards: wireCards };
})();

registerView('events', {
  title: 'Events',
  render: function (host) {
    host.innerHTML = '<div class="section-title" style="margin-top:4px">Upcoming events ' + refreshBtn('evRefresh') + '</div>' +
      '<div id="evList">' + skeletonList(3) + '</div>';
    load();
    wireRefresh('evRefresh', load);
    function load(force) {
      if (force) swrDrop('events');
      return apiSWR('events', {}, function (r) {
        var evs = (r && r.events) || [];
        // "Check back soon" tells a first-time visitor nothing about what they'd be coming back FOR.
        // Say what actually happens here and give them something to do instead of a dead end.
        $('#evList').innerHTML = evs.length ? evs.map(Events.cardHTML).join('')
          : (emptyState('🎉', 'Nothing scheduled right now',
              'Latte art throwdowns, coffee cuppings and game nights get posted here first.') +
             '<div class="card" style="text-align:center">' +
               '<div class="muted small">Drop in and we will tell you what is coming up — or have a look at what we are pouring.</div>' +
               '<button class="btn primary block" id="evMenu" style="margin-top:12px">☕ Browse the menu</button>' +
               '<button class="btn ghost block" id="evAsk" style="margin-top:8px">💬 Ask us about events</button>' +
             '</div>');
        Events.wireCards($('#evList'));
        var m = $('#evMenu'); if (m) m.addEventListener('click', function () { go('menu'); });
        var a = $('#evAsk'); if (a) a.addEventListener('click', function () { go('inquiries'); });
      }, { freshFor: 300000 });   // relaxed — refresh with the button
    }
  },
});

registerView('eventDetail', {
  title: 'Event',
  nav: false,
  render: function (host, p) {
    host.innerHTML = skeletonList(2);
    api('eventDetail', { eventId: p.eventId }, true).then(function (r) {   // silent: the skeleton above is the section loader
      var e = r && r.event;
      if (!e) { host.innerHTML = emptyState('❓', 'Event not found'); return; }
      host.innerHTML =
        '<div class="event-card"><div class="banner" style="height:150px;' +
          (e.imageUrl ? "background-image:url('" + esc(e.imageUrl) + "');background-size:cover;background-position:center" : '') + '"></div>' +
        '<div class="ebody">' +
          '<div class="edate">' + esc(fmtEventWhen(e.startAt)) + '</div>' +
          '<div class="etitle" style="font-size:22px">' + esc(e.title) + '</div>' +
          '<div class="edesc" style="font-size:14.5px;white-space:pre-wrap">' + esc(e.description || '') + '</div>' +
          '<div class="mt16 row-gap"><span class="chip soft">📍 ' + esc(e.location || 'Croma MNL') + '</span>' +
          '<span class="chip soft">👥 ' + (e.going || 0) + (e.capacity ? ' / ' + e.capacity : '') + ' going</span>' +
          (e.clubName ? '<span class="chip on" id="evClub" style="cursor:pointer">' + esc(e.clubName) + ' ›</span>' : '') + '</div>' +
        '</div></div>' +
        ((e.images && e.images.length > 1) ? '<div style="display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px">' + e.images.slice(1).map(function (src) { return '<img src="' + esc(src) + '" style="height:96px;border-radius:10px;object-fit:cover;flex:none"/>'; }).join('') + '</div>' : '') +
        '<button class="btn ' + (e.rsvp ? 'ghost danger' : 'primary') + ' block big" id="rsvpBtn">' +
          (e.rsvp ? 'Cancel RSVP' : 'I\'m going 🎉') + '</button>' +
        '<button class="btn ghost block" id="evAsk">✉️ Ask about this event</button>';
      var cb = $('#evClub'); if (cb) cb.addEventListener('click', function () { go('clubDetail', { clubId: e.clubId }); });
      $('#evAsk').addEventListener('click', function () {
        modal('<h3>Ask about this event</h3>' +
          '<div class="chip soft" style="margin-bottom:10px">🎉 ' + esc(e.title) + ' · ' + esc(fmtEventWhen(e.startAt)) + '</div>' +
          '<label class="lbl">Your question</label><textarea class="field" id="evAskMsg" maxlength="600" placeholder="e.g. Can I still join? Is there a fee?"></textarea>' +
          '<div class="modal-actions"><button class="btn ghost" id="evAskX">Cancel</button><button class="btn primary" id="evAskGo">Send to Croma MNL</button></div>');
        $('#evAskX').addEventListener('click', closeModal);
        $('#evAskGo').addEventListener('click', function () {
          var msg = $('#evAskMsg').value.trim(); if (!msg) { toast('Write your question.'); return; }
          this.disabled = true;
          api('inquire', { subject: 'About: ' + e.title, message: msg, eventId: e.id }).then(function (r) {
            closeModal();
            if (r && r.ok) { swrDrop('myInquiries'); toast('Sent! Check "My inquiries" for the reply. ✉️'); }
            else toast((r && r.error) || 'Could not send.');
          });
        });
      });
      $('#rsvpBtn').addEventListener('click', function () {
        var going = !e.rsvp; this.disabled = true;
        api('rsvp', { eventId: e.id, going: going }).then(function (rr) {
          if (rr && rr.ok) { swrDrop('events', 'home', 'myEvents'); toast(going ? 'You\'re on the list! ✓' : 'RSVP cancelled.'); renderCurrent(); }
          else { toast((rr && rr.error) || 'Could not update RSVP.'); }
        });
      });
    });
  },
});
