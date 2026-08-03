/* ============================================================================
   inquiries.js — ask Croma MNL a question (popup), then a two-way thread.
   ========================================================================== */

// Render a conversation as chat bubbles (staff left, member right). Shared with the admin panel.
function inquiryThreadHTML(messages) {
  return (messages || []).map(function (m) {
    var staff = m.from === 'staff';
    return '<div style="display:flex;justify-content:' + (staff ? 'flex-start' : 'flex-end') + ';margin:6px 0">' +
      '<div style="max-width:82%;padding:8px 12px;border-radius:14px;font-size:14px;white-space:pre-wrap;word-break:break-word;' +
        (staff ? 'background:var(--surface2);border-bottom-left-radius:4px' : 'background:var(--brand);color:#faf6ee;border-bottom-right-radius:4px') + '">' +
        (staff ? '<div class="small" style="font-weight:700;color:var(--brand);margin-bottom:2px">Croma MNL</div>' : '') +
        esc(m.text) + '</div></div>';
  }).join('') || '<div class="muted small center">No messages yet.</div>';
}

// Compose a NEW inquiry in a popup (used from Home's ✉️/Ask tile and the list view).
function openAskModal(prefill) {
  prefill = prefill || {};
  modal('<h3>Ask Croma MNL</h3>' +
    '<label class="lbl">Subject</label><input class="field" id="inqSubj" maxlength="80" value="' + esc(prefill.subject || '') + '" placeholder="e.g. Do you have oat milk?"/>' +
    '<label class="lbl">Message</label><textarea class="field" id="inqMsg" maxlength="600" placeholder="How can we help?">' + esc(prefill.message || '') + '</textarea>' +
    '<a id="inqMine" class="small" style="display:inline-block;margin-top:10px;cursor:pointer">See my past inquiries ›</a>' +
    '<div class="modal-actions"><button class="btn ghost" id="inqX">Cancel</button><button class="btn primary" id="inqSend">Send</button></div>');
  $('#inqX').addEventListener('click', closeModal);
  $('#inqMine').addEventListener('click', function () { closeModal(); go('inquiries'); });
  $('#inqSend').addEventListener('click', function () {
    var subj = $('#inqSubj').value.trim(), msg = $('#inqMsg').value.trim(), btn = this;
    if (!subj || !msg) { toast('Add a subject and message.'); return; }
    btn.disabled = true;
    api('inquire', { subject: subj, message: msg }).then(function (r) {
      if (r && r.ok) { closeModal(); swrDrop('myInquiries'); toast('Sent! We\'ll get back to you. ✉️'); if (current().name === 'inquiries') renderCurrent(); }
      else { btn.disabled = false; toast((r && r.error) || 'Could not send.'); }
    });
  });
}

// Open one inquiry as a conversation the member can keep replying to.
function openInquiryThread(q) {
  modal('<h3 style="margin-bottom:2px">' + esc(q.subject) + '</h3>' +
    (q.eventTitle ? '<div class="chip soft" style="margin-bottom:6px">🎉 ' + esc(q.eventTitle) + '</div>' : '') +
    '<div id="inqThread" style="max-height:52vh;overflow-y:auto;margin:6px -2px 2px;padding:2px">' + inquiryThreadHTML(q.messages) + '</div>' +
    '<textarea class="field" id="inqReplyMsg" maxlength="600" placeholder="Write a reply…" style="margin-top:8px"></textarea>' +
    '<div class="modal-actions"><button class="btn ghost" id="inqTX">Close</button><button class="btn primary" id="inqTSend">Send reply</button></div>');
  $('#inqTX').addEventListener('click', closeModal);
  $('#inqTSend').addEventListener('click', function () {
    var text = $('#inqReplyMsg').value.trim(), btn = this;
    if (!text) { toast('Write a message.'); return; }
    btn.disabled = true;
    api('replyInquiry', { id: q.id, message: text }).then(function (r) {
      btn.disabled = false;
      if (r && r.ok) {
        q.messages = r.messages || q.messages;
        var box = $('#inqThread'); if (box) { box.innerHTML = inquiryThreadHTML(q.messages); box.scrollTop = box.scrollHeight; }
        $('#inqReplyMsg').value = ''; swrDrop('myInquiries'); toast('Sent ✉️');
      } else toast((r && r.error) || 'Could not send.');
    });
  });
  var box = $('#inqThread'); if (box) box.scrollTop = box.scrollHeight;
}

registerView('inquiries', {
  title: 'My inquiries',
  nav: false,
  render: function (host) {
    host.innerHTML =
      '<button class="btn primary block big mb8" id="inqNew">✉️ Ask a question</button>' +
      '<div id="inqList">' + skeletonList(2) + '</div>';
    $('#inqNew').addEventListener('click', function () { openAskModal(); });
    load();
    function load() {
      apiSWR('myInquiries', {}, function (r) {
        var list = (r && r.inquiries) || [];
        $('#inqList').innerHTML = list.length ? list.map(rowHTML).join('')
          : emptyState('✉️', 'No inquiries yet', 'Tap "Ask a question" to send your first one.');
        $$('#inqList [data-inq]').forEach(function (c) {
          c.addEventListener('click', function () { openInquiryThread(list.filter(function (x) { return x.id === c.dataset.inq; })[0]); });
        });
      });
    }
    function rowHTML(q) {
      var msgs = q.messages || [], last = msgs[msgs.length - 1] || {};
      var answered = q.status === 'answered';
      var preview = (last.from === 'staff' ? 'Croma MNL: ' : 'You: ') + String(last.text || q.message || '');
      return '<div class="card tap" data-inq="' + esc(q.id) + '"><div class="spread" style="gap:8px;align-items:flex-start"><div style="font-weight:700;min-width:0;word-break:break-word">' + esc(q.subject) + '</div>' +
        '<span class="badge ' + (answered ? 'green' : 'amber') + '" style="flex:none;white-space:nowrap">' + (answered ? 'Answered' : 'Open') + '</span></div>' +
        (q.eventTitle ? '<div style="margin-top:8px"><span class="chip soft">🎉 ' + esc(q.eventTitle) + '</span></div>' : '') +
        '<div class="muted small mt8" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(preview.slice(0, 90)) + '</div>' +
        '<div class="muted small mt8">' + esc(timeAgo(q.createdAt)) + ' · Tap to open ›</div></div>';
    }
  },
});
