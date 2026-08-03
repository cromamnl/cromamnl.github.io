/* ============================================================================
   menu.js — the café menu, read live from the POS Sheet (Categories + Products).
   Shows product photos + calories (set in the POS), as a List or Tile layout.
   ========================================================================== */
function menuViewMode_() { try { return localStorage.getItem('croma_menu_view') === 'tile' ? 'tile' : 'list'; } catch (e) { return 'list'; } }
function menuRowHTML(it) {
  return '<div class="menu-item">' +
    (it.imageUrl ? '<img src="' + esc(it.imageUrl) + '" style="width:48px;height:48px;border-radius:8px;object-fit:cover;flex:none"/>' : '') +
    '<div class="mi-grow"><div class="mi-name">' + esc(it.name) + (it.temp ? ' <span class="badge soft">🧊/☕</span>' : '') + '</div>' +
    (it.desc ? '<div class="mi-desc">' + esc(it.desc) + '</div>' : '') +
    (it.calories ? '<div class="mi-desc" style="opacity:.8">🔥 ' + it.calories + ' kcal</div>' : '') + '</div>' +
    '<div class="mi-price">' + money(it.price) + '</div></div>';
}
function menuTileHTML(it) {
  return '<div class="card" style="margin:0;padding:0;overflow:hidden">' +
    (it.imageUrl ? '<img src="' + esc(it.imageUrl) + '" style="width:100%;height:112px;object-fit:cover;display:block"/>'
      : '<div style="width:100%;height:112px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:30px;opacity:.45">🍽️</div>') +
    '<div style="padding:10px 12px">' +
      '<div style="font-weight:700;font-size:14px;line-height:1.2">' + esc(it.name) + (it.temp ? ' <span class="badge soft">🧊/☕</span>' : '') + '</div>' +
      (it.calories ? '<div class="muted small" style="margin-top:2px">🔥 ' + it.calories + ' kcal</div>' : '') +
      '<div style="font-weight:800;color:var(--accent);margin-top:6px">' + money(it.price) + '</div>' +
    '</div></div>';
}

registerView('menu', {
  tab: 'menu',
  title: 'Menu',
  render: function (host) {
    var view = menuViewMode_();
    host.innerHTML = '<div class="muted small mb8">Fresh from the counter. Prices in ₱.</div>' +
      '<button class="btn primary block mb8" id="menuOrder">🛍️ Order in Advance</button>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' +
        '<input class="field" id="menuSearch" placeholder="Search the menu…" style="flex:1;margin:0"/>' +
        '<button class="btn ghost" id="menuViewToggle" title="Switch layout" style="flex:none;white-space:nowrap">' + (view === 'tile' ? '≣ List' : '▦ Tiles') + '</button></div>' +
      '<div id="menuList">' + skeletonList(4) + '</div>';
    $('#menuOrder').addEventListener('click', function () { go('order'); });
    var all = [];
    apiSWR('menu', {}, function (r) { all = (r && r.menu) || []; draw(cur()); }, { freshFor: 300000 });
    $('#menuSearch').addEventListener('input', function () { draw(cur()); });
    $('#menuViewToggle').addEventListener('click', function () {
      view = (view === 'tile' ? 'list' : 'tile'); try { localStorage.setItem('croma_menu_view', view); } catch (e) {}
      this.textContent = view === 'tile' ? '≣ List' : '▦ Tiles'; draw(cur());
    });
    function cur() { return $('#menuSearch') ? $('#menuSearch').value.trim().toLowerCase() : ''; }

    function draw(q) {
      var box = $('#menuList'), out = '';
      all.forEach(function (cat) {
        var items = (cat.items || []).filter(function (it) {
          return !q || it.name.toLowerCase().indexOf(q) >= 0 || (it.desc || '').toLowerCase().indexOf(q) >= 0;
        });
        if (!items.length) return;
        out += '<div class="menu-cat">' + esc(cat.category) + '</div>';
        if (view === 'tile') {
          out += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">' + items.map(menuTileHTML).join('') + '</div>';
        } else {
          out += '<div class="card" style="padding:4px 16px">' + items.map(menuRowHTML).join('') + '</div>';
        }
      });
      box.innerHTML = out || emptyState('🔍', 'Nothing found', 'Try another search.');
    }
  },
});
