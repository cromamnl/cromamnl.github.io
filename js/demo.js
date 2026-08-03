/* ============================================================================
   demo.js — in-memory sample backend used ONLY when CROMA.API_URL is blank.
   Lets the whole app be clicked through with no server. Mutations persist for
   the session (in memory). The real backend (Apps Script) returns the same
   {ok:true,...} / {ok:false,error} shapes, so views don't change.
   ========================================================================== */
var DEMO = (function () {
  function now() { return new Date(); }
  function iso(d) { var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function ago(mins) { return iso(new Date(Date.now() - mins * 60000)); }
  function ahead(mins) { return new Date(Date.now() + mins * 60000); }
  function id(p) { return p + Math.random().toString(36).slice(2, 8); }

  var me = { id: 'me', name: 'Maya Santos', email: 'maya@example.com', phone: '', avatarUrl: '',
    hobbies: ['Specialty coffee', 'Photography', 'Books'], bio: 'Latte art in progress ☕ · always down for a slow morning.',
    city: 'Manila', role: 'member', onboarded: true };

  var members = [
    { id: 'u1', name: 'Diego Cruz', avatarUrl: '', city: 'Makati', hobbies: ['Cycling', 'Espresso'], bio: 'Weekend rider, flat white loyalist.', status: 'none' },
    { id: 'u2', name: 'Bea Reyes', avatarUrl: '', city: 'Manila', hobbies: ['Baking', 'Books'], bio: 'Sourdough + cold brew.', status: 'connected' },
    { id: 'u3', name: 'Kenji Tan', avatarUrl: '', city: 'Pasig', hobbies: ['Board games', 'Matcha'], bio: 'Catan on Fridays at Croma.', status: 'connected' },
    { id: 'u4', name: 'Nadia Lim', avatarUrl: '', city: 'Quezon City', hobbies: ['Photography', 'Coffee'], bio: '35mm & single origins.', status: 'incoming' },
    { id: 'u5', name: 'Marco Dela Peña', avatarUrl: '', city: 'Taguig', hobbies: ['Running', 'Pour-over'], bio: 'Run club → coffee club.', status: 'none' },
  ];
  function member(uid) { return uid === 'me' ? me : members.filter(function (m) { return m.id === uid; })[0]; }

  var menu = [
    { category: 'Coffee', items: [
      { name: 'Caffè Latte', desc: 'House espresso + steamed milk', price: 150, temp: true },
      { name: 'Cappuccino', desc: 'Equal parts espresso, milk, foam', price: 150, temp: true },
      { name: 'Spanish Latte', desc: 'Sweet, creamy, condensed milk', price: 165, temp: true },
      { name: 'Americano', desc: 'Espresso + hot water', price: 120, temp: true },
      { name: 'Cold Brew', desc: '18-hour steep, smooth & low-acid', price: 170, temp: false } ] },
    { category: 'Non-Coffee', items: [
      { name: 'Matcha Latte', desc: 'Ceremonial matcha + milk', price: 180, temp: true },
      { name: 'Hot Chocolate', desc: 'Dark tablea', price: 150, temp: true } ] },
    { category: 'Silog', items: [
      { name: 'Tapsilog', desc: 'Beef tapa, garlic rice, egg', price: 180, temp: false },
      { name: 'Tocilog', desc: 'Sweet tocino, garlic rice, egg', price: 170, temp: false },
      { name: 'Longsilog', desc: 'Longganisa, garlic rice, egg', price: 170, temp: false } ] },
    { category: 'Snacks', items: [
      { name: 'Butter Croissant', desc: 'Baked fresh daily', price: 110, temp: false },
      { name: 'Banana Bread', desc: 'Brown-butter loaf', price: 95, temp: false } ] },
  ];

  var events = [
    { id: 'e1', title: 'Latte Art Throwdown', description: 'Friendly free-pour competition — sign up to compete or come cheer. Winner gets a month of free coffee.', startAt: ahead(60 * 26), location: 'Croma MNL Café', capacity: 24, rsvp: false, going: 12 },
    { id: 'e2', title: 'Sunday Slow Morning: Filter Tasting', description: 'Guided cupping of three new single-origin beans. Limited seats.', startAt: ahead(60 * 24 * 5), location: 'Croma MNL Café', capacity: 12, rsvp: true, going: 8 },
    { id: 'e3', title: 'Board Game Night', description: 'Catan, Wingspan, and a special espresso-martini menu after 7pm.', startAt: ahead(60 * 24 * 9), location: 'Croma MNL Café', capacity: 30, rsvp: false, going: 19 },
  ];

  var posts = [
    { id: 'p1', memberId: 'u3', name: 'Kenji Tan', text: 'Board game night this Friday — who’s in? Bringing Wingspan 🐦', imageUrl: '', createdAt: ago(90), likeCount: 6, liked: false, commentCount: 2 },
    { id: 'p2', memberId: 'u2', name: 'Bea Reyes', text: 'The new Ethiopia single origin is unreal. Blueberry and jasmine all day. ☕', imageUrl: '', createdAt: ago(300), likeCount: 11, liked: true, commentCount: 3 },
    { id: 'p3', memberId: 'u1', name: 'Diego Cruz', text: 'Sunday ride ended here as usual. Flat white repaired everything.', imageUrl: '', createdAt: ago(60 * 22), likeCount: 8, liked: false, commentCount: 1 },
  ];

  var threads = [
    { id: 't1', otherId: 'u2', name: 'Bea Reyes', lastText: 'See you Saturday!', lastMessageAt: ago(40), unread: 1 },
    { id: 't2', otherId: 'u3', name: 'Kenji Tan', lastText: 'I’ll save you a seat 🎲', lastMessageAt: ago(60 * 5), unread: 0 },
  ];
  var messages = {
    t1: [ { id: 'm1', senderId: 'u2', text: 'Hey! Are you coming to the tasting?', createdAt: ago(120) },
          { id: 'm2', senderId: 'me', text: 'Yes! Booked already 🙌', createdAt: ago(90) },
          { id: 'm3', senderId: 'u2', text: 'See you Saturday!', createdAt: ago(40) } ],
    t2: [ { id: 'm4', senderId: 'me', text: 'Board game night — save me a spot?', createdAt: ago(60 * 6) },
          { id: 'm5', senderId: 'u3', text: 'I’ll save you a seat 🎲', createdAt: ago(60 * 5) } ],
  };

  var reservations = [
    { id: 'r1', date: iso(ahead(60 * 24 * 2)).slice(0, 10), time: '10:30', partySize: 2, status: 'confirmed', notes: 'Window seat if possible' },
  ];
  var inquiries = [
    { id: 'q1', subject: 'Do you have oat milk?', message: 'Planning to drop by — do you offer oat milk and is there a surcharge?', status: 'answered', reply: 'Yes! Oat milk is available, +₱30 per drink. See you soon 🌿', createdAt: ago(60 * 30) },
  ];
  var history = [
    { saleId: 's1', datetime: ago(60 * 20), total: 320, items: [ { name: 'Spanish Latte (Iced)', qty: 1, lineTotal: 165 }, { name: 'Butter Croissant', qty: 1, lineTotal: 110 }, { name: 'Americano', qty: 1, lineTotal: 45 } ] },
    { saleId: 's2', datetime: ago(60 * 24 * 4), total: 180, items: [ { name: 'Tapsilog', qty: 1, lineTotal: 180 } ] },
    { saleId: 's3', datetime: ago(60 * 24 * 11), total: 260, items: [ { name: 'Cold Brew', qty: 1, lineTotal: 170 }, { name: 'Banana Bread', qty: 1, lineTotal: 95 } ] },
  ];

  var rewards = [
    { id: 'rw1', title: 'Free brewed coffee', description: 'Any hot or iced brewed coffee.', cost: 80 },
    { id: 'rw2', title: '₱50 off your order', description: 'Discount on any single transaction.', cost: 60 },
    { id: 'rw3', title: 'Free pastry', description: 'Croissant, banana bread, or the day\'s bake.', cost: 100 },
    { id: 'rw4', title: 'Free specialty drink', description: 'Latte, Spanish latte, matcha & more.', cost: 150 },
    { id: 'rw5', title: 'Free silog meal', description: 'Any silog on the menu.', cost: 200 }
  ];
  var redemptions = [];
  var orders = [];
  function lifeSpent() { return history.reduce(function (a, b) { return a + b.total; }, 0); }
  function earnedPts() { return Math.floor(lifeSpent() / 10); }
  function spentPts() { return redemptions.reduce(function (a, r) { return a + (r.status === 'cancelled' ? 0 : r.cost); }, 0); }
  function balancePts() { return Math.max(0, earnedPts() - spentPts()); }
  function tierInfo() {
    var s = lifeSpent(), tier = s >= 10000 ? 'Gold' : s >= 2000 ? 'Silver' : 'Bronze';
    var next = tier === 'Gold' ? null : (tier === 'Silver' ? 'Gold' : 'Silver');
    var nextMin = next === 'Gold' ? 10000 : next === 'Silver' ? 2000 : 0, curMin = tier === 'Gold' ? 10000 : tier === 'Silver' ? 2000 : 0;
    return { tier: tier, next: next, toNext: next ? Math.max(0, nextMin - s) : 0, progress: next ? Math.min(1, (s - curMin) / (nextMin - curMin)) : 1 };
  }

  var H = {
    register: function (p) { me.name = p.name || me.name; me.email = p.email || ''; me.phone = p.phone || ''; me.onboarded = false; return { ok: true, token: 'demo', member: me }; },
    login: function () { return { ok: true, token: 'demo', member: me }; },
    googleLogin: function (p) { if (p.name) me.name = p.name; me.onboarded = me.onboarded; return { ok: true, token: 'demo', member: me }; },
    logout: function () { return { ok: true }; },
    me: function () { return { ok: true, member: me }; },
    completeOnboarding: function (p) { me.hobbies = p.hobbies || me.hobbies; me.bio = p.bio || me.bio; me.city = p.city || me.city; if (p.avatarUrl) me.avatarUrl = p.avatarUrl; me.onboarded = true; return { ok: true, member: me }; },
    updateProfile: function (p) { ['name', 'bio', 'city', 'phone'].forEach(function (k) { if (p[k] != null) me[k] = p[k]; }); if (p.hobbies) me.hobbies = p.hobbies; return { ok: true, member: me }; },
    uploadAvatar: function (p) { me.avatarUrl = p.dataUrl; return { ok: true, avatarUrl: p.dataUrl, member: me }; },
    home: function () { return { ok: true, member: me,
      nextEvent: events[0], unreadChat: 1, connections: members.filter(function (m) { return m.status === 'connected'; }).length,
      requests: members.filter(function (m) { return m.status === 'incoming'; }).length,
      points: balancePts(), tier: tierInfo().tier,
      feed: posts.slice(0, 3) }; },
    menu: function () { return { ok: true, menu: menu.map(function (cat) { return { category: cat.category, categoryId: cat.category, items: cat.items.map(function (it, i) { return { id: cat.category + '-' + i, categoryId: cat.category, category: cat.category, name: it.name, desc: it.desc, price: it.price, temp: it.temp }; }) }; }) }; },
    activeVouchers: function () { return { ok: true, vouchers: redemptions.filter(function (r) { return r.status === 'active'; }).map(function (r) { var amt = r.title.indexOf('₱') >= 0; return { id: r.id, title: r.title, code: r.code, discountType: amt ? 'amount' : 'freeCategory', discountValue: amt ? 50 : 'Coffee' }; }) }; },
    placeOrder: function (p) {
      var prods = {}; menu.forEach(function (cat) { cat.items.forEach(function (it, i) { prods[cat.category + '-' + i] = { name: it.name, price: it.price, category: cat.category }; }); });
      var clean = [], sub = 0; (p.items || []).forEach(function (it) { var pr = prods[it.id]; if (pr) { clean.push({ id: it.id, name: pr.name, price: pr.price, qty: it.qty, category: pr.category }); sub += pr.price * it.qty; } });
      if (!clean.length) return { ok: false, error: 'Your order is empty.' };
      var v = p.voucherId ? redemptions.filter(function (r) { return r.id === p.voucherId; })[0] : null;
      var o = { id: id('o'), code: Math.random().toString(36).slice(2, 8).toUpperCase(), items: clean, subtotal: sub, voucherTitle: v ? v.title : '', status: 'pending', createdAt: iso(now()) };
      orders.unshift(o); return { ok: true, order: o };
    },
    myOrders: function () { return { ok: true, orders: orders }; },
    cancelOrder: function (p) { orders.forEach(function (o) { if (o.id === p.id) o.status = 'cancelled'; }); return { ok: true }; },
    feed: function () { return { ok: true, posts: posts }; },
    createPost: function (p) { var np = { id: id('p'), memberId: 'me', name: me.name, avatarUrl: me.avatarUrl, text: p.text, imageUrl: p.imageUrl || '', createdAt: iso(now()), likeCount: 0, liked: false, commentCount: 0 }; posts.unshift(np); return { ok: true, post: np }; },
    likePost: function (p) { posts.forEach(function (x) { if (x.id === p.postId) { x.liked = !x.liked; x.likeCount += x.liked ? 1 : -1; } }); return { ok: true }; },
    listComments: function (p) { return { ok: true, comments: (H._comments[p.postId] || []) }; },
    commentPost: function (p) { H._comments[p.postId] = H._comments[p.postId] || []; var c = { id: id('c'), memberId: 'me', name: me.name, text: p.text, createdAt: iso(now()) }; H._comments[p.postId].push(c); posts.forEach(function (x) { if (x.id === p.postId) x.commentCount++; }); return { ok: true, comment: c }; },
    _comments: { p1: [{ name: 'Bea Reyes', text: 'In! 🎲', createdAt: ago(80) }], p2: [{ name: 'Maya Santos', text: 'Need to try this', createdAt: ago(200) }] },
    members: function (p) { var q = (p.q || '').toLowerCase(); return { ok: true, members: members.filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) >= 0 || (m.hobbies || []).join(' ').toLowerCase().indexOf(q) >= 0; }) }; },
    memberProfile: function (p) { return { ok: true, member: member(p.memberId) }; },
    connect: function (p) { var m = member(p.memberId); if (m) m.status = 'pending'; return { ok: true }; },
    respondConnection: function (p) { var m = member(p.memberId); if (m) m.status = p.accept ? 'connected' : 'none'; return { ok: true }; },
    myConnections: function () { return { ok: true, connections: members.filter(function (m) { return m.status === 'connected'; }), requests: members.filter(function (m) { return m.status === 'incoming'; }) }; },
    threads: function () { return { ok: true, threads: threads }; },
    openThread: function (p) { var t = threads.filter(function (x) { return x.otherId === p.memberId; })[0]; if (!t) { t = { id: id('t'), otherId: p.memberId, name: (member(p.memberId) || {}).name, lastText: '', lastMessageAt: iso(now()), unread: 0 }; threads.unshift(t); messages[t.id] = []; } return { ok: true, thread: t }; },
    messages: function (p) { return { ok: true, messages: messages[p.threadId] || [], other: member((threads.filter(function (x) { return x.id === p.threadId; })[0] || {}).otherId) }; },
    sendMessage: function (p) { messages[p.threadId] = messages[p.threadId] || []; var m = { id: id('m'), senderId: 'me', text: p.text, createdAt: iso(now()) }; messages[p.threadId].push(m); threads.forEach(function (t) { if (t.id === p.threadId) { t.lastText = p.text; t.lastMessageAt = m.createdAt; } }); return { ok: true, message: m }; },
    events: function () { return { ok: true, events: events }; },
    eventDetail: function (p) { return { ok: true, event: events.filter(function (e) { return e.id === p.eventId; })[0] }; },
    rsvp: function (p) { events.forEach(function (e) { if (e.id === p.eventId) { e.rsvp = p.going; e.going += p.going ? 1 : -1; } }); return { ok: true }; },
    myEvents: function () { return { ok: true, events: events.filter(function (e) { return e.rsvp; }) }; },
    reserve: function (p) { var r = { id: id('r'), date: p.date, time: p.time, partySize: p.partySize, notes: p.notes || '', status: 'pending', createdAt: iso(now()) }; reservations.unshift(r); return { ok: true, reservation: r }; },
    myReservations: function () { return { ok: true, reservations: reservations }; },
    cancelReservation: function (p) { reservations.forEach(function (r) { if (r.id === p.id) r.status = 'cancelled'; }); return { ok: true }; },
    inquire: function (p) { var q = { id: id('q'), subject: p.subject, message: p.message, status: 'open', reply: '', createdAt: iso(now()) }; inquiries.unshift(q); return { ok: true, inquiry: q }; },
    myInquiries: function () { return { ok: true, inquiries: inquiries }; },
    history: function () { return { ok: true, purchases: history, totalSpent: history.reduce(function (a, b) { return a + b.total; }, 0), visits: history.length }; },
    loyalty: function () { var t = tierInfo(); return { ok: true, points: balancePts(), earned: earnedPts(), redeemed: spentPts(), lifetimeSpent: lifeSpent(), visits: history.length, tier: t.tier, nextTier: t.next, toNextTier: t.toNext, progress: t.progress, pesoPerPoint: 10 }; },
    rewards: function () { var bal = balancePts(); return { ok: true, balance: bal, rewards: rewards.map(function (r) { return { id: r.id, title: r.title, description: r.description, cost: r.cost, canRedeem: bal >= r.cost }; }) }; },
    redeemReward: function (p) { var rw = rewards.filter(function (r) { return r.id === p.rewardId; })[0]; if (!rw) return { ok: false, error: 'That reward is not available.' }; if (balancePts() < rw.cost) return { ok: false, error: 'You need ' + (rw.cost - balancePts()) + ' more points.' }; var rd = { id: id('rd'), title: rw.title, cost: rw.cost, code: Math.random().toString(36).slice(2, 8).toUpperCase(), status: 'active', createdAt: iso(now()) }; redemptions.unshift(rd); return { ok: true, redemption: rd, balance: balancePts() }; },
    myRedemptions: function () { return { ok: true, redemptions: redemptions }; },
    // ---- admin (demo) ----
    adminSummary: function () { return { ok: true, isAdmin: true, pendingReservations: reservations.filter(function (r) { return r.status === 'pending'; }).length, openInquiries: inquiries.filter(function (q) { return q.status !== 'answered'; }).length, members: members.length + 1, posts: posts.length }; },
    adminMembers: function (p) { var q = (p.q || '').toLowerCase(); var all = [{ id: 'me', name: me.name, email: me.email, role: 'admin', active: true }].concat(members.map(function (m) { return { id: m.id, name: m.name, email: m.name.toLowerCase().replace(/\s+/g, '.') + '@example.com', role: 'member', active: true, city: m.city }; })); return { ok: true, members: all.filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) >= 0 || m.email.indexOf(q) >= 0; }) }; },
    adminMemberAction: function () { return { ok: true }; },
    adminEvents: function () { return { ok: true, events: events.map(function (e) { return { id: e.id, title: e.title, description: e.description, startAt: e.startAt, location: e.location, capacity: e.capacity, active: e.active !== false, going: e.going }; }) }; },
    adminSaveEvent: function (p) { var e = p.event; if (e.id) { events.forEach(function (x) { if (x.id === e.id) { x.title = e.title; x.description = e.description; x.startAt = e.startAt; x.location = e.location; x.capacity = e.capacity; x.active = e.active; } }); } else { events.push({ id: id('e'), title: e.title, description: e.description, startAt: e.startAt, location: e.location, capacity: e.capacity, active: true, going: 0, rsvp: false }); } return { ok: true }; },
    adminDeleteEvent: function (p) { events = events.filter(function (x) { return x.id !== p.id; }); return { ok: true }; },
    adminPosts: function () { return { ok: true, posts: posts.map(function (p) { return { id: p.id, name: p.name, text: p.text, imageUrl: p.imageUrl, createdAt: p.createdAt, likeCount: p.likeCount, commentCount: p.commentCount, active: p.active !== false }; }) }; },
    adminHidePost: function (p) { posts.forEach(function (x) { if (x.id === p.postId) x.active = !p.hide; }); return { ok: true }; },
    adminDeletePost: function (p) { posts = posts.filter(function (x) { return x.id !== p.postId; }); return { ok: true }; },
    adminReservations: function () { return { ok: true, reservations: reservations.map(function (r) { return { id: r.id, name: me.name, phone: '', partySize: r.partySize, date: r.date, time: r.time, notes: r.notes, status: r.status }; }) }; },
    adminReservationStatus: function (p) { reservations.forEach(function (r) { if (r.id === p.id) r.status = p.status; }); return { ok: true }; },
    adminInquiries: function () { return { ok: true, inquiries: inquiries.map(function (q) { return { id: q.id, name: me.name, email: me.email, subject: q.subject, message: q.message, status: q.status, reply: q.reply, createdAt: q.createdAt }; }) }; },
    adminReplyInquiry: function (p) { inquiries.forEach(function (q) { if (q.id === p.id) { q.reply = p.reply; q.status = 'answered'; } }); return { ok: true }; },
    adminRewards: function () { return { ok: true, rewards: rewards.map(function (r, i) { return { id: r.id, title: r.title, description: r.description, cost: r.cost, active: r.active !== false, sortOrder: i }; }) }; },
    adminSaveReward: function (p) { var r = p.reward; if (r.id) { rewards.forEach(function (x) { if (x.id === r.id) { x.title = r.title; x.cost = r.cost; x.description = r.description; x.active = r.active; } }); } else { rewards.push({ id: id('rw'), title: r.title, cost: r.cost, description: r.description, active: true }); } return { ok: true }; },
    adminDeleteReward: function (p) { rewards = rewards.filter(function (x) { return x.id !== p.id; }); return { ok: true }; },
    adminResetData: function (p) { if ((p && p.confirm) !== 'RESET') return { ok: false, error: 'Type RESET to confirm.' }; [members, posts, events, reservations, inquiries, redemptions].forEach(function (a) { a.length = 0; }); return { ok: true }; },
  };

  return {
    handle: function (action, payload) {
      var fn = H[action];
      var res = fn ? fn(payload) : { ok: false, error: 'Unknown demo action: ' + action };
      return new Promise(function (resolve) { setTimeout(function () { resolve(res); }, 160); });
    },
  };
})();
