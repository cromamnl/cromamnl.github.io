/* ============================================================================
   order.js — advanced/ahead ordering. Build a cart from the live menu, attach a
   loyalty voucher, place the order (pay at counter), and get a QR the POS scans
   to auto-load the cart. Views: order (builder), orderCode (QR), orders (list).
   ========================================================================== */
function orderCart() { return S.cache.orderCart || (S.cache.orderCart = {}); }
function cartCount() { var c = orderCart(), n = 0; Object.keys(c).forEach(function (k) { n += c[k].qty; }); return n; }
function cartSubtotal() { var c = orderCart(), t = 0; Object.keys(c).forEach(function (k) { t += c[k].price * c[k].qty; }); return t; }
// Peso value of a voucher against a cart — mirrors the POS's loadCommunityOrder math exactly, so
// the total the customer previews is the total the counter will charge.
function orderVoucherDiscount(dtype, dvalue, items, subtotal) {
  var d = 0;
  if (dtype === 'amount') d = Number(dvalue) || 0;
  else if (dtype === 'percent') d = Math.round(subtotal * (Number(dvalue) || 0) / 100 * 100) / 100;
  else if (dtype === 'freeCategory') {   // the cheapest item in the matching category rides free
    var cat = String(dvalue || '').trim().toLowerCase(), cheapest = null;
    (items || []).forEach(function (l) { if (String(l.category || '').trim().toLowerCase() === cat) { var pr = Number(l.price) || 0; if (cheapest === null || pr < cheapest) cheapest = pr; } });
    d = cheapest || 0;
  }
  return Math.min(Math.max(0, d), subtotal);
}
// short human label for a voucher's effect
function voucherEffectLabel(dtype, dvalue) {
  if (dtype === 'freeCategory') return 'Free ' + (dvalue || 'item');
  if (dtype === 'percent') return (Number(dvalue) || 0) + '% off';
  if (dtype === 'amount') return money(Number(dvalue) || 0) + ' off';
  return 'Voucher';
}
function renderQR(elm, text) {
  if (!elm) return;
  if (typeof qrcode === 'undefined') { elm.innerHTML = '<div class="muted small">QR unavailable — use the code below.</div>'; return; }
  try {
    var qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    elm.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    var svg = elm.querySelector('svg'); if (svg) { svg.setAttribute('width', '210'); svg.setAttribute('height', '210'); }
  } catch (e) { elm.innerHTML = '<div class="muted small">' + esc(text) + '</div>'; }
}

registerView('order', {
  title: 'Order ahead',
  render: function (host) {
    if (!tierAllows('Silver')) { tierGate(host, 'Advance ordering', 'Silver', 'Reach Silver tier to order ahead and skip the queue. You’re currently ' + myTier() + '.'); return; }
    var menu = [];
    host.innerHTML =
      '<div class="muted small mb8">Tap a product to add it — adjust quantities in your order below. Show the QR at the counter to skip the queue; pay when you arrive.</div>' +
      '<input class="field" id="ordSearch" placeholder="Search the menu…"/>' +
      '<div class="ord-tabs" id="ordTabs"></div>' +
      '<div id="ordMenu">' + skeletonList(3) + '</div>' +
      '<div id="ordSum"></div>' +
      '<div style="height:92px"></div>' +
      '<div id="ordBar" style="display:none"></div>';
    apiSWR('menu', {}, function (r) {
      menu = (r && r.menu) || [];
      if (!catById(S.cache.ordCat) && menu.length) S.cache.ordCat = menu[0].categoryId;   // default to the first category
      drawAll();
    }, { freshFor: 300000,
         // Cold start reads the menu from the Firestore replica (~100ms) instead of waiting on the
         // ~1.8s Apps Script call; the authoritative response still lands and corrects it.
         fsDoc: 'public/menu',
         fsShape: function (d) { return (d && d.menu && d.menu.length) ? { ok: true, menu: d.menu } : null; } });
    $('#ordSearch').addEventListener('input', function () { drawAll(); });
    function cur() { return $('#ordSearch') ? $('#ordSearch').value.trim().toLowerCase() : ''; }
    function catById(id) { for (var i = 0; i < menu.length; i++) if (menu[i].categoryId === id) return menu[i]; return null; }
    function drawAll() { drawTabs(); drawGrid(); drawSummary(); drawBar(); }

    // Category tabs (mirrors the POS) — hidden while searching, since results span categories.
    function drawTabs() {
      var box = $('#ordTabs'); if (!box) return;
      if (cur() || menu.length < 2) { box.innerHTML = ''; box.style.display = 'none'; return; }
      box.style.display = '';
      box.innerHTML = menu.map(function (c) {
        return '<button class="' + (c.categoryId === S.cache.ordCat ? 'active' : '') + '" data-cat="' + esc(c.categoryId) + '">' + esc(c.category) + '</button>';
      }).join('');
      $$('#ordTabs button').forEach(function (b) {
        b.addEventListener('click', function () { S.cache.ordCat = b.dataset.cat; drawTabs(); drawGrid(); });
      });
    }
    // Product tiles for the active category (or every matching category while searching).
    function tileHTML(it) {
      var c = orderCart(), qty = 0;
      if (it.temp) ['Iced', 'Hot'].forEach(function (t) { var l = c[it.id + '|' + t]; if (l) qty += l.qty; });
      else qty = (c[it.id] && c[it.id].qty) || 0;
      return '<div class="ord-tile' + (qty ? ' on' : '') + '" data-add="' + esc(it.id) + '">' +
        (qty ? '<span class="ot-qty">' + qty + '</span>' : '') +
        (it.temp ? '<span class="ot-temp">🧊/☕</span>' : '') +
        '<div class="ot-name">' + esc(it.name) + '</div><div class="ot-price">' + money(it.price) + '</div></div>';
    }
    function drawGrid() {
      var box = $('#ordMenu'), q = cur(), out = '';
      if (!box) return;
      if (q) {
        menu.forEach(function (cat) {
          var items = cat.items.filter(function (it) { return it.name.toLowerCase().indexOf(q) >= 0; });
          if (!items.length) return;
          out += '<div class="menu-cat">' + esc(cat.category) + '</div><div class="ord-grid">' + items.map(tileHTML).join('') + '</div>';
        });
      } else {
        var cat = catById(S.cache.ordCat) || menu[0];
        if (cat) out = '<div class="ord-grid">' + cat.items.map(tileHTML).join('') + '</div>';
      }
      box.innerHTML = out || emptyState('🔍', 'Nothing found');
      $$('#ordMenu [data-add]').forEach(function (el) {
        el.addEventListener('click', function () {
          var it = findItem(el.dataset.add); if (!it) return;
          if (it.temp) chooseTemp(function (t) { addTempVariant(it, t, 1); drawGrid(); drawSummary(); drawBar(); });
          else { addToCart(it, 1); drawGrid(); drawSummary(); drawBar(); }
        });
      });
    }
    // Order summary — everything added, with steppers, right on the page (like the POS cart panel).
    function drawSummary() {
      var box = $('#ordSum'), c = orderCart(), keys = Object.keys(c); if (!box) return;
      if (!keys.length) {
        box.innerHTML = '<div class="section-title">Your order</div>' +
          '<div class="card muted small center" style="padding:16px">Nothing added yet — tap a product above.</div>';
        return;
      }
      box.innerHTML = '<div class="section-title">Your order <span class="badge soft">' + cartCount() + ' item' + (cartCount() > 1 ? 's' : '') + '</span></div>' +
        '<div class="card">' +
        keys.map(function (k) {
          var l = c[k];
          return '<div class="ord-sum-line">' +
            '<button class="ord-step" data-dec="' + esc(k) + '">−</button>' +
            '<span style="font-weight:800;min-width:14px;text-align:center">' + l.qty + '</span>' +
            '<button class="ord-step plus" data-inc="' + esc(k) + '">+</button>' +
            '<div class="osl-n">' + esc(l.name) + '<div class="muted small">' + money(l.price) + ' each</div></div>' +
            '<div style="font-weight:700;white-space:nowrap">' + money(l.price * l.qty) + '</div></div>';
        }).join('') +
        '<div class="spread" style="border-top:1px solid var(--line);margin-top:8px;padding-top:10px;font-weight:800"><span>Subtotal</span><span>' + money(cartSubtotal()) + '</span></div>' +
        '<div class="muted small mt8">Apply a voucher at review — tap Review below.</div></div>' +
        '<button class="btn ghost block" id="ordClear">Clear order</button>';
      $$('#ordSum [data-inc]').forEach(function (b) { b.addEventListener('click', function () { bumpKey(b.dataset.inc, 1); drawGrid(); drawSummary(); drawBar(); }); });
      $$('#ordSum [data-dec]').forEach(function (b) { b.addEventListener('click', function () { bumpKey(b.dataset.dec, -1); drawGrid(); drawSummary(); drawBar(); }); });
      var cb = $('#ordClear'); if (cb) cb.addEventListener('click', function () { S.cache.orderCart = {}; drawGrid(); drawSummary(); drawBar(); });
    }
    function findItem(id) { for (var i = 0; i < menu.length; i++) for (var j = 0; j < menu[i].items.length; j++) if (menu[i].items[j].id === id) return menu[i].items[j]; return null; }
    function addToCart(item, d) {
      if (!item) return; var c = orderCart(), q = ((c[item.id] && c[item.id].qty) || 0) + d;
      if (q <= 0) delete c[item.id]; else c[item.id] = { id: item.id, name: item.name, price: item.price, category: item.category, qty: q, temp: '' };
    }
    // Iced/Hot chooser (mirrors the POS) → each choice is its own cart line, keyed by id|temp.
    function chooseTemp(cb) {
      modal('<h3 style="text-align:center">Iced or Hot?</h3>' +
        '<div style="display:flex;gap:10px;margin-top:12px">' +
          '<button class="btn ghost block big" id="tIced">🧊 Iced</button>' +
          '<button class="btn ghost block big" id="tHot">☕ Hot</button></div>' +
        '<div class="modal-actions"><button class="btn ghost" id="tCancel">Cancel</button></div>');
      $('#tCancel').addEventListener('click', closeModal);
      $('#tIced').addEventListener('click', function () { closeModal(); cb('Iced'); });
      $('#tHot').addEventListener('click', function () { closeModal(); cb('Hot'); });
    }
    function addTempVariant(item, temp, d) {
      if (!item) return; var c = orderCart(), key = item.id + '|' + temp, q = ((c[key] && c[key].qty) || 0) + d;
      if (q <= 0) delete c[key]; else c[key] = { id: item.id, name: item.name + ' (' + temp + ')', price: item.price, category: item.category, qty: q, temp: temp };
    }
    // Adjust an existing cart line by its key (plain `id`, or `id|Iced`/`id|Hot` for temp products).
    function bumpKey(key, d) {
      var c = orderCart(), ln = c[key]; if (!ln) return; ln.qty += d; if (ln.qty <= 0) delete c[key];
    }
    function drawBar() {
      var bar = $('#ordBar'), n = cartCount(); if (!bar) return;
      if (n === 0) { bar.style.display = 'none'; return; }
      bar.setAttribute('style', 'position:fixed;left:12px;right:12px;bottom:calc(var(--bar-h) + var(--safe-bottom) + 10px);z-index:15;background:var(--brand);color:#faf6ee;border-radius:14px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--shadow-lg);cursor:pointer;max-width:520px;margin:0 auto');
      bar.innerHTML = '<span style="font-weight:700">' + n + ' item' + (n > 1 ? 's' : '') + ' · ' + money(cartSubtotal()) + '</span><span style="font-weight:700">Review ›</span>';
      bar.onclick = reviewOrder;
    }
    function reviewOrder() {
      var c = orderCart(), lines = Object.keys(c).map(function (k) { return c[k]; });
      if (!lines.length) return;
      var subtotal = cartSubtotal();
      api('activeVouchers').then(function (vr) {
        var vouchers = (vr && vr.vouchers) || [];
        var vById = {}; vouchers.forEach(function (v) { vById[v.id] = v; });
        modal('<h3>Review your order</h3>' +
          '<div style="border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:8px 0">' +
          lines.map(function (l) { return '<div class="spread" style="padding:9px 12px;font-size:14px;border-bottom:1px solid var(--line)"><span>' + l.qty + '× ' + esc(l.name) + '</span><span class="muted">' + money(l.price * l.qty) + '</span></div>'; }).join('') +
          '<div class="spread" style="padding:10px 12px;font-weight:700"><span>Subtotal</span><span>' + money(subtotal) + '</span></div></div>' +
          (vouchers.length ? '<label class="lbl">Apply a voucher</label><select class="field" id="ordVoucher"><option value="">No voucher</option>' +
            vouchers.map(function (v) { return '<option value="' + esc(v.id) + '">' + esc(v.title) + ' — ' + esc(voucherEffectLabel(v.discountType, v.discountValue)) + '</option>'; }).join('') + '</select>' :
            '<div class="muted small">Redeem rewards in the Rewards screen to use them as vouchers here.</div>') +
          '<div id="ordSummary"></div>' +
          '<div class="muted small mt8">Pay at the counter — the barista scans your QR to load this order.</div>' +
          '<div class="modal-actions"><button class="btn ghost" id="ordCancel">Keep editing</button><button class="btn primary" id="ordPlace">Place order</button></div>');
        $('#ordCancel').addEventListener('click', closeModal);
        // live: recompute the discount + total the moment a voucher is chosen
        function renderSummary() {
          var box = $('#ordSummary'); if (!box) return;
          var vid = $('#ordVoucher') ? $('#ordVoucher').value : '', v = vid ? vById[vid] : null;
          var disc = v ? orderVoucherDiscount(v.discountType, v.discountValue, lines, subtotal) : 0;
          if (!v || disc <= 0) { box.innerHTML = ''; return; }
          box.innerHTML = '<div style="border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:10px 0">' +
            '<div class="spread" style="padding:9px 12px;font-size:14px;color:var(--accent)"><span>🎁 ' + esc(voucherEffectLabel(v.discountType, v.discountValue)) + '</span><span>−' + money(disc) + '</span></div>' +
            '<div class="spread" style="padding:10px 12px;font-weight:800;border-top:1px solid var(--line)"><span>Total to pay</span><span>' + money(Math.max(0, subtotal - disc)) + '</span></div></div>';
        }
        var sel = $('#ordVoucher'); if (sel) sel.addEventListener('change', renderSummary);
        renderSummary();
        $('#ordPlace').addEventListener('click', function () {
          var voucherId = $('#ordVoucher') ? $('#ordVoucher').value : '';
          this.disabled = true;
          api('placeOrder', { items: lines.map(function (l) { return { id: l.id, qty: l.qty, temp: l.temp || '' }; }), voucherId: voucherId }).then(function (r) {
            if (r && r.ok) { closeModal(); S.cache.orderCart = {}; swrDrop('myOrders'); go('orderCode', { order: r.order }); }
            else { toast((r && r.error) || 'Could not place order.'); }
          });
        });
      });
    }
  },
  actions: function () { return '<button class="iconbtn" id="ordMyBtn" title="My orders">🧾</button>'; },
  onAppbar: function () { var b = $('#ordMyBtn'); if (b) b.addEventListener('click', function () { go('orders'); }); }
});

registerView('orderCode', {
  title: 'Your order',
  nav: false,
  render: function (host, p) {
    var o = p.order; if (!o) { host.innerHTML = emptyState('❓', 'Order not found'); return; }
    var oDisc = orderVoucherDiscount(o.discountType, o.discountValue, o.items, o.subtotal);
    host.innerHTML =
      '<div class="card center">' +
        '<div id="ordStatus" style="margin-bottom:8px"></div>' +
        '<div id="ordQR" style="display:flex;justify-content:center;margin:14px 0"></div>' +
        '<div style="font-size:30px;font-weight:800;letter-spacing:5px;color:var(--brand);font-family:\'Courier New\',monospace">' + esc(o.code) + '</div>' +
        (o.voucherTitle ? '<div class="chip soft" style="margin-top:12px">🎁 ' + esc(o.voucherTitle) + '</div>' : '') +
      '</div>' +
      '<div class="section-title">Order</div><div class="card">' +
      (o.items || []).map(function (l) { return '<div class="spread" style="padding:5px 0;font-size:14px"><span>' + l.qty + '× ' + esc(l.name) + '</span><span class="muted">' + money(l.price * l.qty) + '</span></div>'; }).join('') +
      '<div class="spread" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px;' + (oDisc > 0 ? '' : 'font-weight:700') + '"><span' + (oDisc > 0 ? ' class="muted"' : '') + '>Subtotal</span><span' + (oDisc > 0 ? ' class="muted"' : '') + '>' + money(o.subtotal) + '</span></div>' +
      (oDisc > 0 ? '<div class="spread" style="padding-top:4px;color:var(--accent)"><span>🎁 ' + esc(voucherEffectLabel(o.discountType, o.discountValue)) + '</span><span>−' + money(oDisc) + '</span></div>' +
        '<div class="spread" style="margin-top:4px;font-weight:800"><span>Total to pay</span><span>' + money(Math.max(0, o.subtotal - oDisc)) + '</span></div>' : '') +
      '<div class="muted small mt8">Any voucher discount is applied automatically when scanned.</div></div>' +
      '<div id="ordPay"></div>' +
      '<div id="ordCancelWrap"></div>' +
      '<button class="btn primary block big" id="ordNew">Order something else</button>';
    renderQR($('#ordQR'), 'CROMAORD:' + o.code);
    $('#ordNew').addEventListener('click', function () { go('order'); });
    paintPay();

    /* Prepayment is OPTIONAL — an unpaid order is perfectly valid and settles at the counter, so
       this section only ever offers, never blocks. */
    function paintPay() {
      var box = $('#ordPay'); if (!box) return;
      var due = (o.due != null) ? o.due : Math.max(0, o.subtotal - oDisc);
      if (o.paidWith) {
        box.innerHTML = '<div class="card center" style="border-color:var(--green)">' +
          '<div class="badge green">✅ Prepaid · ' + money(o.paidAmount || due) + '</div>' +
          '<div class="muted small mt8">Already settled — just collect at the counter.</div></div>';
        return;
      }
      if (!due || o.status !== 'pending') { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="section-title">Pay now <span class="muted small">(optional)</span></div>' +
        '<div class="card"><div class="spread"><span>Store credits</span><span id="ordCrBal" class="muted">…</span></div>' +
        '<button class="btn primary block" id="ordPayCr" style="margin-top:10px" disabled>Pay ' + money(due) + ' with credits</button>' +
        '<div class="muted small mt8">Or pay at the counter — cash, or scan our QR Ph there.</div></div>';
      apiSWR('credits', {}, function (r) {
        var bal = (r && r.balance) || 0, el = $('#ordCrBal'), btn = $('#ordPayCr');
        if (el) el.textContent = money(bal);
        if (!btn) return;
        if (bal >= due) { btn.disabled = false; }
        else { btn.textContent = 'Not enough credits — top up at the counter'; btn.disabled = true; }
      });
      var b = $('#ordPayCr');
      if (b) b.addEventListener('click', function () {
        b.disabled = true; b.textContent = 'Paying…';
        api('payOrderWithCredits', { code: o.code }, true).then(function (r) {
          if (!r || !r.ok) { b.disabled = false; b.textContent = 'Pay ' + money(due) + ' with credits'; toast((r && r.error) || 'Could not pay.'); return; }
          o.paidWith = 'credits'; o.paidAmount = r.paid || due;
          swrDrop('credits', 'myOrders', 'home');
          paintPay(); toast('Paid ✓ enjoy!');
        });
      });
    }

    var cur = null;
    function paint(status, silent) {
      if (status === cur) return; cur = status;
      var m = orderStatusMeta(status);
      var sb = $('#ordStatus'); if (sb) sb.innerHTML = m.label ? '<div class="badge ' + m.badge + '">' + m.label + '</div>' : '<div class="muted small">' + esc(m.hint) + '</div>';
      var qr = $('#ordQR'); if (qr) qr.style.opacity = m.dim ? '.35' : '1';
      var cw = $('#ordCancelWrap');
      if (cw) {
        if (status === 'pending') {
          cw.innerHTML = '<button class="btn ghost danger block" id="ordCancelBtn">Cancel this order</button>';
          $('#ordCancelBtn').addEventListener('click', function () {
            api('cancelOrder', { id: o.id }).then(function (r) { if (r && r.ok) { swrDrop('myOrders'); toast('Order cancelled.'); go('orders'); } else toast((r && r.error) || 'Error'); });
          });
        } else cw.innerHTML = '';
      }
      if (!silent) {
        swrDrop('myOrders');
        if (status === 'loaded') celebrateOrder('scanned');
        else if (status === 'completed') celebrateOrder('completed');
      }
    }
    paint(o.status || 'pending', true);

    // Poll live so the customer sees pending → scanned → completed without refreshing.
    if (!orderStatusMeta(o.status).done) {
      S._poll = setInterval(function () {
        if (document.hidden) return;   // pause polling while the app is backgrounded
        api('orderStatus', { id: o.id }, true).then(function (r) {
          if (!r || !r.ok) return;
          paint(r.status);
          if (orderStatusMeta(r.status).done && S._poll) { clearInterval(S._poll); S._poll = null; }
        });
      }, 6000);
    }
  }
});

registerView('orders', {
  title: 'My advance orders',
  nav: false,
  render: function (host) {
    host.innerHTML = '<div id="ordList">' + skeletonList(2) + '</div>';
    apiSWR('myOrders', {}, function (r) {
      var list = (r && r.orders) || [];
      $('#ordList').innerHTML = list.length ? list.map(orderRow).join('') : emptyState('🧾', 'No advance orders yet', 'Tap "Order ahead" on Home to make one.');
      $$('#ordList [data-order]').forEach(function (row) { row.addEventListener('click', function () { go('orderCode', { order: list.filter(function (x) { return x.id === row.dataset.order; })[0] }); }); });
    });
  }
});
// Shared status → badge/label/QR-dim/terminal mapping for advance orders.
function orderStatusMeta(status) {
  if (status === 'completed') return { badge: 'green', label: 'Order complete — enjoy! ✓', hint: '', dim: true, done: true };
  if (status === 'loaded') return { badge: 'green', label: 'Scanned — being prepared ☕', hint: '', dim: true, done: false };
  if (status === 'cancelled') return { badge: 'red', label: 'Cancelled', hint: '', dim: true, done: true };
  return { badge: '', label: '', hint: 'Show this QR at the counter', dim: false, done: false };
}

/* ---- celebration moments: fancy full-screen success when an order is scanned/completed ---- */
function ensureCelebrateCSS() {
  if (document.getElementById('celebrateCSS')) return;
  var s = document.createElement('style'); s.id = 'celebrateCSS';
  s.textContent = [
    '@keyframes celeIn{from{opacity:0}to{opacity:1}}',
    '@keyframes celePop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}',
    '@keyframes celeDraw{to{stroke-dashoffset:0}}',
    '@keyframes celeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes celeRing{0%{transform:scale(.55);opacity:.75}100%{transform:scale(2.3);opacity:0}}',
    '@keyframes celeFall{0%{transform:translate(0,-14vh) rotate(0);opacity:1}100%{transform:translate(var(--dx,0),90vh) rotate(var(--rot,540deg));opacity:.85}}',
    '.cele-ov{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;-webkit-tap-highlight-color:transparent;animation:celeIn .3s ease both;background:radial-gradient(circle at 50% 40%,rgba(233,227,214,.97),rgba(58,43,32,.94))}',
    '.cele-badge{position:relative;width:130px;height:130px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,var(--accent,#b07a4a),var(--brand,#5b3f2c));box-shadow:0 18px 48px rgba(50,34,22,.5);animation:celePop .55s cubic-bezier(.2,1.35,.35,1) both}',
    '.cele-ring{position:absolute;inset:0;border-radius:50%;border:3px solid rgba(255,255,255,.65);animation:celeRing 1.15s ease-out infinite}',
    '.cele-check{width:64px;height:64px;fill:none;stroke:#fff;stroke-width:7;stroke-linecap:round;stroke-linejoin:round}',
    '.cele-check path{stroke-dasharray:80;stroke-dashoffset:80;animation:celeDraw .5s .35s ease forwards}',
    '.cele-title{color:#fff;font-size:27px;font-weight:800;margin-top:26px;text-align:center;padding:0 26px;animation:celeUp .5s .32s both;text-shadow:0 2px 12px rgba(0,0,0,.25)}',
    '.cele-sub{color:rgba(255,255,255,.92);font-size:15px;margin-top:8px;text-align:center;animation:celeUp .5s .46s both}',
    '.cele-hint{position:absolute;bottom:calc(40px + var(--safe-bottom,0px));color:rgba(255,255,255,.65);font-size:12px;animation:celeUp .6s .9s both}',
    '.cele-cf{position:absolute;top:0;border-radius:2px;will-change:transform}'
  ].join('');
  document.head.appendChild(s);
}
function celebrateChime() {
  try {
    var Ac = window.AudioContext || window.webkitAudioContext; if (!Ac) return;
    var ctx = new Ac(); if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    [[659.25, 0], [880, .12], [1174.7, .24]].forEach(function (n) {   // a gentle rising 3-note chime
      var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + n[1];
      o.type = 'sine'; o.frequency.value = n[0];
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.15, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .55);
    });
    setTimeout(function () { try { ctx.close(); } catch (e) {} }, 1300);
  } catch (e) {}
}
function celebrateOrder(kind) {
  ensureCelebrateCSS();
  var done = kind === 'completed';
  var ov = document.createElement('div'); ov.className = 'cele-ov';
  var html = '';
  if (done) {
    var cols = ['#b07a4a', '#d9c4a0', '#5b3f2c', '#e9e3d6', '#c9a15e', '#8a5a3b'];
    for (var i = 0; i < 36; i++) {
      var w = 8 + Math.floor(Math.random() * 6);
      html += '<span class="cele-cf" style="left:' + Math.floor(Math.random() * 100) + '%;width:' + w + 'px;height:' + (w + 4) +
        'px;background:' + cols[i % cols.length] + ';--dx:' + (Math.floor(Math.random() * 90) - 45) + 'px;--rot:' +
        ((Math.random() > .5 ? 1 : -1) * (360 + Math.floor(Math.random() * 540))) + 'deg;animation:celeFall ' +
        (2000 + Math.floor(Math.random() * 1500)) + 'ms ' + Math.floor(Math.random() * 500) + 'ms cubic-bezier(.2,.6,.5,1) forwards"></span>';
    }
  }
  html += '<div class="cele-badge">' + (done ? '' : '<span class="cele-ring"></span><span class="cele-ring" style="animation-delay:.55s"></span>') +
    '<svg class="cele-check" viewBox="0 0 52 52"><path d="M14 27l8 8 16-18"/></svg></div>' +
    '<div class="cele-title">' + (done ? 'Order complete!' : 'Order received!') + '</div>' +
    '<div class="cele-sub">' + (done ? 'Enjoy your coffee ☕' : 'The barista is preparing it ☕') + '</div>' +
    '<div class="cele-hint">tap to dismiss</div>';
  ov.innerHTML = html;
  document.body.appendChild(ov);
  try { if (navigator.vibrate) navigator.vibrate(done ? [0, 45, 40, 65] : [0, 35]); } catch (e) {}
  if (done) celebrateChime();
  var closed = false;
  function close() { if (closed) return; closed = true; ov.style.transition = 'opacity .35s'; ov.style.opacity = '0'; setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 360); }
  ov.addEventListener('click', close);
  setTimeout(close, done ? 3600 : 2200);
}
function orderRow(o) {
  var badge = o.status === 'cancelled' ? 'red' : (o.status === 'loaded' || o.status === 'completed') ? 'green' : 'amber';
  var label = o.status === 'completed' ? 'Completed' : o.status === 'loaded' ? 'Scanned' : o.status === 'cancelled' ? 'Cancelled' : 'Ready — show at counter';
  // What was actually paid, and how. A voucher name on its own doesn't tell you what it took off,
  // and "paid" doesn't tell you whether credits or cash covered it.
  var paidLine = [];
  if (o.voucherTitle) paidLine.push('🎁 ' + esc(o.voucherTitle) + (o.discountAmount > 0 ? ' (−' + money(o.discountAmount) + ')' : ''));
  if (o.paidWith === 'credits') paidLine.push('💳 Credits ' + money(o.paidAmount || o.due));
  else if (o.status === 'completed') paidLine.push('💵 Paid at the counter');
  else if (o.status !== 'cancelled') paidLine.push('Pay at the counter');
  var showDue = o.due != null && o.due !== o.subtotal;
  return '<div class="card tap" data-order="' + esc(o.id) + '"><div class="spread"><div style="font-weight:700">Code ' + esc(o.code) + '</div><span class="badge ' + badge + '">' + label + '</span></div>' +
    '<div class="muted small mt8">' + (o.items || []).map(function (l) { return l.qty + '× ' + esc(l.name); }).join(', ') + '</div>' +
    '<div class="muted small mt8">' + paidLine.join(' · ') + '</div>' +
    '<div class="spread mt8" style="font-size:13px"><span class="muted">' + esc(fmtDateTime(o.createdAt)) + '</span><span style="font-weight:700">' +
      (showDue ? '<span class="muted" style="text-decoration:line-through;font-weight:400;margin-right:6px">' + money(o.subtotal) + '</span>' + money(o.due) : money(o.subtotal)) +
    '</span></div></div>';
}
