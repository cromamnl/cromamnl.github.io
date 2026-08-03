/* ============================================================================
   reserve.js — schedule a café reservation + see your upcoming/past bookings.
   ========================================================================== */
registerView('reserve', {
  title: 'Reserve a table',
  render: function (host) {
    var isGold = tierAllows('Gold');
    var today = new Date(); var tmr = new Date(Date.now() + 86400000);
    var minD = ymd(today), defD = ymd(tmr);
    var times = []; for (var h = 8; h <= 20; h++) { times.push(two(h) + ':00'); if (h < 20) times.push(two(h) + ':30'); }
    host.innerHTML =
      '<div class="card">' +
        '<label class="lbl">Date</label><input class="field" id="rvDate" type="date" min="' + minD + '" value="' + defD + '"/>' +
        '<label class="lbl">Time</label><select class="field" id="rvTime">' + times.map(function (t) { return '<option value="' + t + '">' + fmt12h(t) + '</option>'; }).join('') + '</select>' +
        '<label class="lbl">Party size</label>' +
        '<div class="row-gap" id="rvParty" style="margin-bottom:' + (isGold ? '12px' : '4px') + '">' +
          [1, 2, 3, 4, 5, 6].map(function (n) { var lk = !isGold && n < 5; return '<span class="chip' + (n === (isGold ? 2 : 5) ? ' on' : '') + '" data-n="' + n + '"' + (lk ? ' data-locked="1" style="opacity:.4"' : '') + '>' + n + (lk ? ' 🔒' : '') + '</span>'; }).join('') +
          '<span class="chip" data-n="7">7+</span></div>' +
        (isGold ? '' : '<div class="small muted" style="margin-bottom:12px">Tables for fewer than 5 are a Gold perk — <a id="rvTierLink">see your tier ›</a></div>') +
        '<label class="lbl">Notes (optional)</label>' +
        '<textarea class="field" id="rvNotes" maxlength="200" placeholder="Window seat, high chair, celebration…"></textarea>' +
        '<button class="btn primary block big" id="rvSubmit">Request reservation</button>' +
        '<div class="small muted center mt8">You\'ll get a confirmation from the café. Walk-in seating is subject to availability.</div>' +
      '</div>' +
      '<div class="section-title">Your reservations</div><div id="rvList">' + skeletonList(2) + '</div>';

    var party = isGold ? 2 : 5;
    var tl = $('#rvTierLink'); if (tl) tl.addEventListener('click', function () { go('rewards'); });
    $$('#rvParty .chip').forEach(function (c) { c.addEventListener('click', function () {
      if (c.dataset.locked) { toast('Tables under 5 unlock at Gold tier.'); return; }
      $$('#rvParty .chip').forEach(function (x) { x.classList.remove('on'); }); c.classList.add('on'); party = parseInt(c.dataset.n, 10);
    }); });
    $('#rvSubmit').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      api('reserve', { date: $('#rvDate').value, time: $('#rvTime').value, partySize: party, notes: $('#rvNotes').value.trim() })
        .then(function (r) {
          btn.disabled = false;
          if (r && r.ok) { toast('Reservation requested! ✓'); $('#rvNotes').value = ''; loadList(); }
          else if (visitLockToast(r)) { /* offers the member QR, which is how they unlock it */ }
          else toast((r && r.error) || 'Could not submit.');
        });
    });
    loadList();
    function loadList() {
      api('myReservations', {}, true).then(function (r) {
        var list = (r && r.reservations) || [];
        $('#rvList').innerHTML = list.length ? list.map(rowHTML).join('') : emptyState('📅', 'No reservations yet');
        $$('#rvList [data-cancel]').forEach(function (b) { b.addEventListener('click', function () {
          api('cancelReservation', { id: b.dataset.cancel }).then(function () { toast('Cancelled.'); loadList(); });
        }); });
      });
    }
    function rowHTML(r) {
      var st = r.status || 'pending';
      var cls = st === 'confirmed' ? 'green' : st === 'cancelled' ? 'red' : 'amber';
      var canCancel = st !== 'cancelled';
      return '<div class="card"><div class="spread"><div>' +
        '<div style="font-weight:700;font-size:15px">' + esc(fmtDate(r.date)) + ' · ' + esc(fmt12h(r.time)) + '</div>' +
        '<div class="muted small mt8">Party of ' + esc(r.partySize) + (r.notes ? ' · ' + esc(r.notes) : '') + '</div></div>' +
        '<span class="badge ' + cls + '">' + esc(st) + '</span></div>' +
        (canCancel ? '<button class="btn ghost danger sm" style="margin-top:12px" data-cancel="' + esc(r.id) + '">Cancel</button>' : '') +
        '</div>';
    }
  },
});
function ymd(d) { return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()); }
