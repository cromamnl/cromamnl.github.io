/* ============================================================================
   history.js — the member's purchase history, matched from the POS Sales tab.
   ========================================================================== */
registerView('history', {
  title: 'My orders',
  render: function (host) {
    host.innerHTML = '<div id="hStats"></div><div id="hList">' + skeletonList(3) + '</div>';
    apiSWR('history', {}, function (r) {
      var list = (r && r.purchases) || [];
      $('#hStats').innerHTML =
        '<div class="stat-row"><div class="stat"><div class="v">' + esc(r && r.visits || list.length) + '</div><div class="l">Transactions</div></div>' +
        '<div class="stat"><div class="v">' + money(r && r.totalSpent || 0) + '</div><div class="l">Total spent</div></div></div>';
      if (!list.length) { $('#hList').innerHTML = emptyState('🧾', 'No orders yet',
        'Orders you make at the counter show up here. Give your name at checkout so we can match them.'); return; }
      $('#hList').innerHTML = list.map(function (s) {
        return '<div class="card"><div class="spread"><div style="font-weight:700">' + esc(fmtDateTime(s.datetime)) + '</div>' +
          '<div style="color:var(--accent);font-weight:700">' + money(s.total) + '</div></div>' +
          '<div style="margin-top:10px">' + (s.items || []).map(function (it) {
            return '<div class="spread" style="font-size:13.5px;padding:3px 0"><span>' + esc(it.qty) + '× ' + esc(it.name) + '</span>' +
              '<span class="muted">' + money(it.lineTotal) + '</span></div>';
          }).join('') + '</div></div>';
      }).join('');
    });
  },
});
