/* ============================================================================
   chat.js — conversations list (Chat tab) + a live 1:1 conversation.
   Messages refresh by polling every few seconds (Apps Script has no push).
   ========================================================================== */
registerView('chat', {
  tab: 'chat',
  title: 'Messages',
  actions: function () { return '<button class="iconbtn" id="chNew" title="New chat">＋</button>'; },
  onAppbar: function () { var b = $('#chNew'); if (b) b.addEventListener('click', newChatFlow); },
  render: function (host) {
    var all = [];
    host.innerHTML = '<input class="field" id="chSearch" placeholder="Search chats…"/><div id="thList">' + skeletonList(3) + '</div>';
    $('#chSearch').addEventListener('input', function () { draw(this.value.trim().toLowerCase()); });
    function draw(q) {
      var list = q ? all.filter(function (t) {
        return String(t.name || '').toLowerCase().indexOf(q) >= 0 || String(t.lastText || '').toLowerCase().indexOf(q) >= 0;
      }) : all;
      $('#thList').innerHTML = list.length ? '<div class="list">' + list.map(threadRow).join('') + '</div>'
        : (q ? emptyState('🔍', 'No chats match', 'Try another name, or tap ＋ to start a new chat.')
             : emptyState('💬', 'No messages yet', 'Tap ＋ to start a chat, or connect with members in the Community tab.'));
      $$('#thList [data-thread]').forEach(function (row) {
        row.addEventListener('click', function () { go('conversation', { threadId: row.dataset.thread, name: row.dataset.name }); });
      });
    }
    apiSWR('threads', {}, function (r) {
      all = (r && r.threads) || [];
      S.unread = all.reduce(function (a, t) { return a + (t.unread || 0); }, 0); renderTabbar(Views.chat);
      draw($('#chSearch') ? $('#chSearch').value.trim().toLowerCase() : '');
    });
  },
});

// "+" → search members and start (or resume) a 1:1 chat.
function newChatFlow() {
  modal('<h3>New chat</h3>' +
    '<input class="field" id="ncQ" placeholder="Search members by name…" autocomplete="off"/>' +
    '<div id="ncList" style="max-height:300px;overflow:auto">' + skeletonList(2) + '</div>');
  var t = null;
  function search(q) {
    api('members', { q: q }, true).then(function (r) {
      var list = ((r && r.members) || []).slice(0, 20), box = $('#ncList');
      if (!box) return;
      box.innerHTML = list.length ? '<div class="list">' + list.map(function (m) {
        return '<div class="item" data-nc="' + esc(m.id) + '" data-name="' + esc(m.name) + '">' + avatarHTML(m, 'md') +
          '<div class="grow"><div class="t">' + esc(m.name) + (m.statusEmoji ? ' ' + esc(m.statusEmoji) : '') + '</div>' +
          '<div class="s">' + esc(m.city || '') + '</div></div><div class="chev">›</div></div>';
      }).join('') + '</div>' : '<div class="muted small center" style="padding:14px">No members found.</div>';
      $$('#ncList [data-nc]').forEach(function (row) {
        row.addEventListener('click', function () { closeModal(); openChatWith(row.dataset.nc); });
      });
    });
  }
  $('#ncQ').addEventListener('input', function () {
    var q = this.value.trim(); clearTimeout(t); t = setTimeout(function () { search(q); }, 250);
  });
  setTimeout(function () { var f = $('#ncQ'); if (f) f.focus(); }, 60);
  search('');
}
function threadRow(t) {
  return '<div class="item" data-thread="' + esc(t.id) + '" data-name="' + esc(t.name) + '">' + avatarHTML(t, 'md') +
    '<div class="grow"><div class="t">' + esc(t.name) + '</div><div class="s">' + esc(t.lastText || 'Say hello 👋') + '</div></div>' +
    '<div style="text-align:right"><div class="small muted">' + esc(timeAgo(t.lastMessageAt)) + '</div>' +
    (t.unread ? '<span class="badge red" style="margin-top:4px">' + t.unread + '</span>' : '') + '</div></div>';
}

// open (or create) a conversation with a member, then navigate to it
function openChatWith(memberId) {
  api('openThread', { memberId: memberId }).then(function (r) {
    if (visitLockToast(r)) return;
    if (!r || !r.ok) { toast((r && r.error) || 'Could not open chat.'); return; }
    go('conversation', { threadId: r.thread.id, name: r.thread.name });
  });
}

registerView('conversation', {
  nav: false,
  title: function (p) { return p.name || 'Chat'; },
  render: function (host, p) {
    host.className = '';           // edge-to-edge chat (no body padding)
    host.innerHTML =
      '<div class="chat-wrap"><div class="chat-scroll" id="chatScroll"></div>' +
      '<div class="chat-input"><input class="field" id="msgInput" placeholder="Message…" autocomplete="off"/>' +
      '<button class="btn accent" id="msgSend" style="border-radius:22px;padding:0 18px">➤</button></div></div>';
    var scroll = $('#chatScroll'), lastCount = -1;

    function draw(scrollDown) {
      api('messages', { threadId: p.threadId }, true).then(function (r) {   // silent: no loading overlay over the chat
        var msgs = (r && r.messages) || [];
        if (msgs.length === lastCount) return; lastCount = msgs.length;
        var out = '', lastDay = '';
        msgs.forEach(function (m) {
          var d = parseDT(m.createdAt), day = d ? fmtDate(d) : '';
          if (day && day !== lastDay) { out += '<div class="day-sep">' + esc(day) + '</div>'; lastDay = day; }
          var mine = m.senderId === (S.me && S.me.id) || m.senderId === 'me';
          out += '<div class="bubble ' + (mine ? 'me' : 'them') + '">' + esc(m.text) +
            '<div class="bt">' + esc(fmtTime(m.createdAt)) + '</div></div>';
        });
        scroll.innerHTML = out || '<div class="empty"><div class="msg muted">Say hello 👋</div></div>';
        if (scrollDown !== false) scroll.scrollTop = scroll.scrollHeight;
      });
    }
    draw();
    S._poll = setInterval(function () { if (document.hidden) return; draw(); }, 4000);   // pause while backgrounded; cleared by renderCurrent on nav

    function send() {
      var inp = $('#msgInput'), text = inp.value.trim(); if (!text) return;
      inp.value = '';
      // optimistic bubble
      scroll.insertAdjacentHTML('beforeend', '<div class="bubble me">' + esc(text) + '<div class="bt">now</div></div>');
      scroll.scrollTop = scroll.scrollHeight; lastCount = -1;
      api('sendMessage', { threadId: p.threadId, text: text }, true).then(function (r) { if (visitLockToast(r)) return; draw(); });
    }
    $('#msgSend').addEventListener('click', send);
    $('#msgInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  },
});
