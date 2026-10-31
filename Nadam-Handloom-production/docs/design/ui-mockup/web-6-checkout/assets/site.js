/* W6 checkout mock-up (built on the W5 bag mock-up): the website screens (hash pages), with the live website's markup and
   styles. Real sarees from the live data of 16 Oct (assets/data.js). The server's bag check
   is simulated here; every "something changed" state is a sample and says so.
   Pages: #/shop · #/product/<slug> · #/bag · #/sign-in · #/checkout · #/order/<number> · #/shipping · #/refunds · #/contact
   States: add ?state=<name> (the "Design options" panel lists them for each page). */
(function () {
  'use strict';
  var D = window.W5DATA, ICONS = window.ICONS, O = window.W5Opts;
  var bySlug = {};
  D.sarees.forEach(function (s) { bySlug[s.slug] = s; });

  /* ---------- Small helpers ---------- */
  var INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  function rs(v) { return '₹' + INR.format(Math.round(Number(v) || 0)); }
  function num(v) { return INR.format(Number(v) || 0); }
  function pcs(n) { return num(n) + (n === 1 ? ' piece' : ' pieces'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name, size) { return '<svg class="ico' + (size === 'sm' ? ' ico-sm' : size === 'lg' ? ' ico-lg' : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || ICONS.info) + '</svg>'; }
  function W(cap) { return O.word(cap); }
  function mobile(m) { return m.slice(0, 5) + ' ' + m.slice(5); }
  var MOCK_WA = 'mock-wa';

  /* ---------- What this browser keeps (mock-up's own keys) ---------- */
  var K = { bag: 'w6mock.bag.v1', acct: 'w6mock.account.v1', who: 'w6mock.who.v1', seeded: 'w6mock.seeded.v1' };
  function load(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function keep(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }

  var SAMPLE = [['pure-pattu-350k-butta-saree-34', 1], ['150-50-plain-saree-7', 2], ['scallop-border-hand-painted-saree-31', 1]];
  var ACCOUNT_SAMPLE = [['50-50-digital-print-34', 2], ['150-50-plain-saree-7', 3]];
  var PRIYA = { name: 'Priya Sharma', first: 'Priya', initials: 'PS' };
  var MAX_LINES = 20;
  function line(slug, qty, extra) { var o = { slug: slug, qty: qty, priceSeen: bySlug[slug].price, addedAt: Date.now() }; for (var k in extra || {}) o[k] = extra[k]; return o; }
  function sample() { return SAMPLE.map(function (x) { return line(x[0], x[1]); }); }

  if (!load(K.seeded)) { keep(K.bag, sample()); keep(K.seeded, 1); }
  var bag = load(K.bag, []);
  var who = load(K.who, null);
  function saveBag() { keep(K.bag, bag); if (who) keep(K.acct, bag); }

  /* ---------- Screen state (reset when a state is picked) ---------- */
  var sim = {}; // simulated server answers per saree: { state: 'unavailable' | 'sold', available, note }
  var F = {};
  function resetFlags() { F = { offline: false, error: false, loading: false, nostore: false, sent: false, full: false, adding: false, notice: null, popupShown: false }; sim = {}; }
  resetFlags();
  var checkingUntil = 0, bumpUntil = 0, lastRemoved = null, drawer = null, modal = null, menuOpen = false;
  var shown = {}, shownNext = {}; // lines already on screen: only new ones fade in

  /* ---------- The bag check (the server's job in W5; simulated here) ---------- */
  function check() {
    var out = { lines: [], pieces: 0, amount: 0, counted: 0, out: 0, changes: { sold: 0, fewer: 0, price: 0, gone: 0 } };
    bag.forEach(function (b) {
      var s = bySlug[b.slug];
      if (!s) return;
      var o = sim[b.slug] || {};
      var avail = o.available != null ? o.available : s.available;
      var st = 'ok';
      if (o.state === 'unavailable') st = 'unavailable';
      else if (avail < 1) st = 'sold_out';
      else if (b.qty > avail) { b.fewerFrom = b.qty; b.qty = avail; }
      var priceWas = (st === 'ok' && b.priceSeen !== s.price) ? b.priceSeen : null;
      var L = { b: b, s: s, state: st, available: avail, price: s.price, priceWas: priceWas, note: o.note };
      if (st === 'ok') { out.pieces += b.qty; out.amount += b.qty * s.price; out.counted += 1; } else out.out += 1;
      if (st === 'sold_out') out.changes.sold += 1;
      if (st === 'unavailable') out.changes.gone += 1;
      if (st === 'ok' && b.fewerFrom) out.changes.fewer += 1;
      if (priceWas != null) out.changes.price += 1;
      out.lines.push(L);
    });
    out.problems = out.changes.sold + out.changes.gone + out.changes.fewer + out.changes.price;
    return out;
  }
  function piecesInBag() { return bag.reduce(function (n, b) { var s = bySlug[b.slug]; var o = sim[b.slug] || {}; var ok = s && o.state !== 'unavailable' && (o.available != null ? o.available : s.available) > 0; return n + (ok ? b.qty : 0); }, 0); }
  // A change by the customer: the notes about earlier changes have been seen.
  function touched() { bag.forEach(function (b) { var s = bySlug[b.slug]; if (s) b.priceSeen = s.price; delete b.fewerFrom; delete b.from; }); checkingUntil = Date.now() + 450; setTimeout(render, 470); }
  function find(slug) { for (var i = 0; i < bag.length; i++) if (bag[i].slug === slug) return bag[i]; return null; }

  /* ---------- Routing ---------- */
  function parse() {
    var h = location.hash.replace(/^#/, '') || '/shop';
    var q = h.indexOf('?'); var path = q < 0 ? h : h.slice(0, q);
    var params = new URLSearchParams(q < 0 ? '' : h.slice(q + 1));
    return { path: path, state: params.get('state'), next: params.get('next'), slug: (path.match(/^\/product\/([^/?]+)/) || [])[1] };
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  var lastKey = null;
  function setup(r) {
    resetFlags(); drawer = null; modal = null; lastRemoved = null; menuOpen = false;
    var st = r.state;
    if (r.path === '/bag') {
      if (st === 'normal' || st === 'loading' || st === 'offline' || st === 'error' || st === 'nostore' || st === 'whatsapp' || st === 'sent' || st === 'remove' || st === 'clear') bag = sample();
      if (st === 'empty') bag = [];
      if (st === 'loading') F.loading = true;
      if (st === 'offline') F.offline = true;
      if (st === 'error') F.error = true;
      if (st === 'nostore') F.nostore = true;
      if (st === 'sent' || st === 'clear') F.sent = true;
      if (st === 'whatsapp') modal = { kind: 'wa' };
      if (st === 'clear') modal = { kind: 'clear' };
      if (st === 'problems') {
        bag = [line('pure-pattu-350k-butta-saree-34', 1), line('real-tanjore-painting-sarees-11', 1), line('gap-border-embroidery-sarees-19', 4),
          line('scallop-border-hand-painted-saree-31', 1, { priceSeen: 2400 }), line('rainbow-checks-sarees-41', 1)];
        sim['real-tanjore-painting-sarees-11'] = { available: 0, note: 'It sold at our store.' };
        sim['gap-border-embroidery-sarees-19'] = { available: 2 };
        sim['rainbow-checks-sarees-41'] = { state: 'unavailable' };
        F.sampleChanges = true;
      }
      if (st === 'oldbag') {
        bag = sample().concat([line('kanchi-border-triple-check-saree-14', 1, { from: 'old' }), line('350k-butta-saree-3', 1, { from: 'old' })]);
        F.notice = { tone: 'ok', icon: 'refresh', title: 'We brought back 2 sarees from your earlier visit', text: 'They were in your bag on our old website. One has sold since then.' };
      }
      if (st === 'merged') {
        who = PRIYA; keep(K.who, who);
        bag = sample();
        joinAccount(ACCOUNT_SAMPLE.map(function (x) { return line(x[0], x[1]); }));
      }
      if (st === 'signedout') {
        who = null; keep(K.who, null); bag = [];
        F.notice = { tone: 'info', icon: 'logout', title: 'You signed out, so your ' + W() + ' was removed from this browser', text: 'It is saved in your account. Sign in again to see it.', action: ['#/sign-in', 'Sign in'] };
      }
      if (st === 'remove') { bag = sample(); removeLine('scallop-border-hand-painted-saree-31', true); }
      if (['merged', 'signedout'].indexOf(st) < 0 && st) { /* keep the signed-in state as it is */ }
      saveBag();
    }
    if (r.path === '/checkout') {
      CO = freshCO();
      if (!bag.length || ['address', 'newaddr', 'fixaddr', 'review', 'paying', 'confirming', 'failed', 'closed', 'expired', 'offline', 'inapp', 'signedout'].indexOf(st) >= 0) bag = sample();
      if (st === 'signedout') { who = null; keep(K.who, null); } else { who = PRIYA; keep(K.who, who); }
      if (st === 'newaddr') { CO.addrs = []; CO.form = { mode: 'new' }; }
      if (st === 'fixaddr') { CO.addrs.push(Object.assign({}, OLD_ADDR)); CO.sel = 'a3'; CO.form = { mode: 'fix' }; }
      if (['review', 'paying', 'confirming', 'failed', 'closed', 'changed', 'offline', 'inapp'].indexOf(st) >= 0) CO.step = 'review';
      if (['paying', 'confirming', 'failed', 'closed'].indexOf(st) >= 0) CO.order = makeOrder();
      if (st === 'paying') modal = { kind: 'rzp' };
      if (st === 'confirming') modal = { kind: 'confirming' };
      if (st === 'failed' || st === 'closed' || st === 'expired' || st === 'inapp') CO.notice = st;
      if (st === 'offline') { F.offline = true; CO.notice = 'offline'; }
      if (st === 'changed') {
        bag = [line('pure-pattu-350k-butta-saree-34', 1), line('150-50-plain-saree-7', 2, { priceSeen: 2500 }), line('real-tanjore-painting-sarees-11', 1)];
        sim['real-tanjore-painting-sarees-11'] = { available: 0, note: 'It sold at our store.' };
        CO.notice = 'changed';
      }
      if (st === 'empty') bag = [line('350k-butta-saree-3', 1)];
      saveBag();
    }
    if (r.path.indexOf('/product/') === 0) {
      var s = bySlug[r.slug];
      if (s && st === 'added') { bag = bag.filter(function (b) { return b.slug !== s.slug; }); saveBag(); setTimeout(function () { addToBag(s.slug, 1); }, 350); }
      if (s && st === 'inbag' && !find(s.slug)) { bag.push(line(s.slug, 1)); saveBag(); }
      if (s && st === 'setall') { var e = find(s.slug); if (e) e.qty = s.available; else bag.push(line(s.slug, s.available)); saveBag(); }
      if (st === 'adding') F.adding = true;
      if (st === 'bagfull') F.full = true;
      if (s && (st === 'default' || st === 'adding' || st === 'bagfull')) { bag = bag.filter(function (b) { return b.slug !== s.slug; }); saveBag(); }
    }
  }

  // Rule 9: the same saree in both bags = the larger number, capped by the stock; never the sum.
  function joinAccount(acct) {
    var added = 0, raised = 0;
    acct.forEach(function (a) {
      var s = bySlug[a.slug]; if (!s) return;
      var e = find(a.slug);
      if (!e) { if (bag.length < MAX_LINES) { bag.push(line(a.slug, Math.min(a.qty, Math.max(1, s.available)), { from: 'account' })); added += 1; } }
      else if (a.qty > e.qty) { e.qty = Math.min(a.qty, s.available); e.from = 'account'; raised += 1; }
    });
    var bits = [];
    if (added) bits.push(added + (added === 1 ? ' saree' : ' sarees') + ' from your account ' + (added === 1 ? 'was' : 'were') + ' added');
    if (raised) bits.push(raised + (raised === 1 ? ' saree now has' : ' sarees now have') + ' the larger number of pieces you chose before');
    F.notice = { tone: 'ok', icon: 'check', title: 'Welcome back, ' + PRIYA.first + '. Your bags are joined', text: (bits.join('; ') || 'Nothing new from your account') + '. Your ' + W() + ' is now saved in your account too.' };
  }

  /* ---------- Actions ---------- */
  function addToBag(slug, qty) {
    var s = bySlug[slug];
    var e = find(slug);
    if (!e && bag.length >= MAX_LINES) { toast('Your ' + W() + ' is full (20 sarees). Remove one to add another.', { tone: 'bad' }); return; }
    if (e) e.qty = Math.min(s.available, e.qty + qty); else bag.push(line(slug, Math.min(qty, s.available)));
    touched(); saveBag(); bumpUntil = Date.now() + 700;
    var after = O.get('after');
    if (after === 'c') { go('#/bag'); return; }
    if (after === 'b') { render(); toast('Added to your ' + W(), { action: ['open-bag', 'View ' + W()] }); return; }
    drawer = { added: slug }; render();
  }
  function removeLine(slug, quiet) {
    var i = -1; bag.forEach(function (b, n) { if (b.slug === slug) i = n; });
    if (i < 0) return;
    lastRemoved = { item: bag[i], index: i };
    var name = bySlug[slug].name;
    bag.splice(i, 1); saveBag();
    if (!quiet) touched();
    toast('Removed ' + name, { action: ['undo', 'Undo'], ms: quiet ? 600000 : 6000 });
    render();
  }
  function undo() { if (!lastRemoved) return; bag.splice(Math.min(lastRemoved.index, bag.length), 0, lastRemoved.item); lastRemoved = null; saveBag(); touched(); clearToasts(); toast('Back in your ' + W()); render(); }
  function setQty(slug, q) { var e = find(slug); var s = bySlug[slug]; if (!e) return; e.qty = Math.max(1, Math.min(s.available, q)); touched(); saveBag(); render(); }

  /* ---------- Toasts (the live website's toasts, with an action) ---------- */
  var toastsEl = null;
  function clearToasts() { if (toastsEl) toastsEl.innerHTML = ''; }
  function toast(text, o) {
    o = o || {};
    if (!toastsEl) return;
    var tone = o.tone || 'ok';
    var d = document.createElement('div');
    d.className = 'toast ' + tone; d.setAttribute('role', tone === 'bad' ? 'alert' : 'status');
    d.innerHTML = icon(tone === 'bad' ? 'alertc' : tone === 'info' ? 'info' : 'check') + '<span>' + esc(text) + '</span>' + (o.action ? '<button type="button" class="act" data-act="' + o.action[0] + '">' + esc(o.action[1]) + '</button>' : '') + '<button type="button" data-act="toast-x" aria-label="Close message">' + icon('x', 'sm') + '</button>';
    while (toastsEl.children.length > 2) toastsEl.removeChild(toastsEl.firstChild);
    toastsEl.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.remove(); }, o.ms || (tone === 'bad' ? 7000 : 4500));
  }

  /* ---------- Shared parts: header, menu, footer ---------- */
  function bagLink() {
    var n = piecesInBag(); var amt = check().amount;
    var label = W(true) + ', ' + pcs(n);
    return '<button type="button" class="bag-link' + (Date.now() < bumpUntil ? ' bump' : '') + '" data-act="open-bag" aria-label="' + esc(label) + '">' + icon('bag') +
      (n ? '<span class="bag-n" aria-hidden="true">' + n + '</span>' : '') + '<span class="bag-word" aria-hidden="true">' + W(true) + (n ? ' (' + n + ')' : '') + '</span><span class="bag-amt" aria-hidden="true">' + (n ? rs(amt) : '') + '</span></button>';
  }
  function header() {
    return '<div class="mock-strip" role="note"><span class="mock-tag">Mock-up</span> W6 checkout and payment<span class="long"> · real sarees and prices from the live data of 16 Oct · the customer, addresses and payment endings are samples · Razorpay\'s window is a stand-in</span> · <a href="index.html">Start page</a></div>' +
      '<div class="announce" role="region" aria-label="Announcements">' + icon('truck') + 'Free delivery across India on every order</div>' +
      '<header class="hdr"><div class="wrap hdr-in"><div class="left"><button type="button" class="menu-btn" data-act="menu" aria-haspopup="dialog" aria-label="Menu">' + icon('menu') + '<span class="hide-sm">Menu</span></button></div>' +
      '<a href="#/shop" class="logo" aria-label="Nandam Handlooms, home"><img src="img/logo-96.png" alt="" width="46" height="46"><span class="wm"><b>Nandam</b><small>Handlooms · Mangalagiri</small></span></a>' +
      '<div class="tools"><button type="button" class="btn btn-icon" data-act="search" aria-label="Search">' + icon('search') + '</button>' +
      (who ? '<a href="#/sign-in" class="acct-link" aria-label="My account (' + esc(who.name) + ')"><span class="avatar" style="width:32px;height:32px;font-size:12px" aria-hidden="true">' + who.initials + '</span><span class="hide-sm">' + esc(who.first) + '</span></a>'
        : '<a href="#/sign-in" class="acct-link" aria-label="Sign in">' + icon('user') + '<span class="hide-sm">Sign in</span></a>') +
      bagLink() + '</div></div></header>';
  }
  function fullMenu() {
    var n = piecesInBag();
    var links = D.categories.map(function (c) { return ['#/shop', c.name.replace(/^Mangalagiri Handloom Pattu Sarees$/i, 'Mangalagiri pattu sarees'), c.count]; })
      .concat([['#/shop', 'All collections', D.totals.collections], ['#/shop', 'New in'], ['#/bag', W(true), n || null], ['#/shop', 'Visit the store'], who ? ['#/sign-in', 'My account'] : ['#/sign-in', 'Sign in']]);
    return '<div class="fullmenu" role="dialog" aria-modal="true" aria-label="Menu"><div class="l"><button type="button" class="close" data-act="menu-x">' + icon('x') + 'Close</button><nav aria-label="Main">' +
      links.map(function (l, i) { return '<a href="' + l[0] + '" data-act="menu-go" style="animation-delay:' + (120 + i * 60) + 'ms">' + esc(l[1]) + (l[2] ? '<small>' + num(l[2]) + '</small>' : '') + '</a>'; }).join('') +
      '</nav><div class="meta"><div><b>Visit the store</b>' + esc(D.shop.address.replace(/, India$/, '')) + '<br>' + esc(D.store.hours) + '</div><div><b>Call or WhatsApp</b>+91 ' + mobile(D.shop.mobile) + '<br>WhatsApp +91 73829 68566</div></div></div>' +
      '<div class="r" aria-hidden="true"><img src="img/loom-800.jpg" alt=""></div></div>';
  }
  function footer() {
    var t = O.get('theme');
    return '<footer class="ftr"><div class="wrap"><div class="top"><div class="brand"><div class="row"><img src="img/logo-96.png" alt="" width="52" height="52" loading="lazy"><b>Nandam Handlooms</b></div><p>Mangalagiri handloom pattu sarees and dress materials, from our store in Old Mangalagiri to your door.</p><ul><li>' + (who ? '<a href="#/sign-in">My account</a>' : '<a href="#/sign-in">Sign in or create an account</a>') + '</li></ul></div>' +
      '<div><h4>Shop</h4><ul>' + D.categories.map(function (c) { return '<li><a href="#/shop">' + esc(c.name) + '</a></li>'; }).join('') + '<li><a href="#/shop">All collections</a></li><li><a href="#/shop">New in</a></li><li><a href="#/shop">Sets for the family</a></li><li><a href="#/bag">Your ' + W() + '</a></li></ul></div>' +
      '<div><h4>Help</h4><ul><li><a href="#' + MOCK_WA + '" data-act="wa-mock">WhatsApp us</a></li><li><a href="#/shop">Call +91 ' + mobile(D.shop.mobile) + '</a></li><li><a href="#/shipping">Shipping</a></li><li><a href="#/refunds">Cancellation and refunds</a></li><li><a href="#/contact">Contact us</a></li><li><a href="#/shop">Privacy</a></li><li><a href="#/shop">Terms</a></li></ul></div>' +
      '<div><h4>Visit the store</h4><ul><li>' + D.store.addressLines.map(function (l) { return '<span style="display:block">' + esc(l) + '</span>'; }).join('') + '</li><li>' + esc(D.store.hours) + '</li></ul></div></div>' +
      '<div class="wordmark" aria-hidden="true">Nandam</div><div class="ftr-theme"><span>Theme</span><div class="theme-seg" role="group" aria-label="Colour theme">' +
      [['auto', 'contrast', 'Auto'], ['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']].map(function (o) { return '<button type="button" data-act="theme" data-v="' + o[0] + '" aria-pressed="' + (t === o[0]) + '">' + icon(o[1], 'sm') + o[2] + '</button>'; }).join('') +
      '</div></div><div class="bottom"><span>© 2026 Nandam Handlooms, Mangalagiri. All prices include taxes.</span><span>GSTIN ' + esc(D.shop.gstin) + '</span></div></div></footer>';
  }
  function crumbs(items) { return '<nav aria-label="Breadcrumb"><ol class="crumbs">' + items.map(function (c) { return '<li>' + (c[1] ? '<a href="' + c[1] + '">' + esc(c[0]) + '</a>' : '<span aria-current="page">' + esc(c[0]) + '</span>') + '</li>'; }).join('') + '</ol></nav>'; }
  function card(s, i) {
    var sold = s.available < 1;
    return '<article class="pcard' + (sold ? ' soldout' : '') + '" style="--i:' + (i % 8) + '"><a class="ph" href="#/product/' + s.slug + '" aria-label="' + esc(s.name + ', ' + rs(s.price) + (s.available > 1 ? ', set of ' + s.available : '')) + '"><img src="' + s.photo + '" alt="' + esc(s.photoAlt) + '" loading="lazy" width="600" height="800">' +
      '<span class="tags">' + (s.isNew ? '<span class="badge">New</span>' : '') + (s.available > 1 ? '<span class="badge set">Set of ' + s.available + '</span>' : '') + (sold ? '<span class="badge">Sold out</span>' : '') + '</span></a>' +
      '<div class="info"><span class="col">' + esc(s.craftName || s.collection.name) + '</span><a class="name" href="#/product/' + s.slug + '">' + esc(s.name) + '</a><div class="row"><span class="price">' + rs(s.price) + '</span>' + (s.available > 1 ? '<span class="stock">' + s.available + ' in stock</span>' : '<span class="sku">' + esc(s.sku) + '</span>') + '</div></div></article>';
  }

  /* ---------- Quantity controls (5.4) ---------- */
  function qtyControl(slug, q, max, where, force) {
    var o = force || O.get('qty'); var s = bySlug[slug]; var sm = where === 'line' ? ' sm' : '';
    var lbl = 'Pieces of ' + s.name + ' (' + s.sku + ')';
    if (o === 'b') {
      var opts = ''; for (var i = 1; i <= max; i++) opts += '<option value="' + i + '"' + (i === q ? ' selected' : '') + '>' + (where === 'line' ? 'Qty ' : '') + i + '</option>';
      return '<select class="select qty-select' + sm + '" data-change="qty" data-slug="' + slug + '" data-where="' + where + '" aria-label="' + esc(lbl) + '">' + opts + '</select>';
    }
    if (o === 'c') {
      var b = ''; for (var j = 1; j <= max; j++) b += '<button type="button" data-act="qty-set" data-slug="' + slug + '" data-where="' + where + '" data-v="' + j + '" aria-pressed="' + (j === q) + '">' + j + '</button>';
      return '<div class="qty-chips' + sm + '" role="group" aria-label="' + esc(lbl) + '">' + b + '</div>';
    }
    return '<div class="qty' + sm + '" role="group" aria-label="' + esc(lbl) + '"><button type="button" data-act="qty-dec" data-slug="' + slug + '" data-where="' + where + '" aria-label="One piece fewer"' + (q <= 1 ? ' disabled' : '') + '>' + icon('minus', 'sm') + '</button><output aria-live="polite">' + q + '</output><button type="button" data-act="qty-inc" data-slug="' + slug + '" data-where="' + where + '" aria-label="One piece more"' + (q >= max ? ' disabled' : '') + '>' + icon('plus', 'sm') + '</button></div>';
  }

  /* ---------- One bag line ---------- */
  function lineHtml(L, opts) {
    opts = opts || {};
    var b = L.b, s = L.s, out = L.state !== 'ok';
    var note = '';
    if (L.state === 'sold_out') note = '<div class="lnote bad">' + icon('alertc') + '<span>Sold out. ' + esc(L.note || 'It sold since you added it.') + ' <a href="#' + MOCK_WA + '" data-act="wa-mock">Ask for a similar saree</a></span></div>';
    else if (L.state === 'unavailable') note = '<div class="lnote bad">' + icon('alertc') + '<span>No longer on the website. <a href="#' + MOCK_WA + '" data-act="wa-mock">Ask us on WhatsApp</a></span></div>';
    else if (b.fewerFrom) note = '<div class="lnote">' + icon('alert') + '<span>Only ' + L.available + ' left now. We changed it from ' + b.fewerFrom + ' to ' + b.qty + '.</span></div>';
    if (!out && L.priceWas != null) note += '<div class="lnote info">' + icon('info') + '<span>Price ' + (L.price > L.priceWas ? 'went up' : 'came down') + ' from ' + rs(L.priceWas) + ' to ' + rs(L.price) + ' since you added it.</span></div>';
    var from = b.from === 'old' ? '<span class="from">From your earlier visit</span>' : b.from === 'account' ? '<span class="from">From your account</span>' : '';
    var kind = s.available > 1 || L.available > 1 ? 'Set · ' + L.available + ' in stock' : (L.available === 1 ? 'Single piece' : '');
    var qty = out ? '' : (L.available > 1 && !opts.compact ? qtyControl(s.slug, b.qty, L.available, 'line') : '<span class="qty-fixed">' + pcs(b.qty) + '</span>');
    var priceCol = F.loading ? '<div class="skel" style="height:18px;width:80px"></div><div class="skel" style="height:12px;width:60px"></div>' :
      out ? '<span class="price">' + rs(L.price) + '</span><span class="each">Not counted</span>' :
        '<span class="price">' + rs(L.price * b.qty) + '</span>' + (b.qty > 1 ? '<span class="each">' + b.qty + ' × ' + rs(L.price) + '</span>' : '') + (L.priceWas != null ? '<s>' + rs(L.priceWas * b.qty) + '</s>' : '');
    var where = opts.compact ? 'd:' : 'p:'; shownNext[where + s.slug] = 1;
    return '<article class="bline' + (out ? ' is-out' : '') + (opts.added === s.slug ? ' is-new' : '') + (shown[where + s.slug] ? '' : ' is-enter') + '" data-slug="' + s.slug + '">' +
      '<a class="ph" href="#/product/' + s.slug + '" tabindex="-1" aria-hidden="true"><img src="' + s.photo + '" alt="" loading="lazy"></a>' +
      '<div class="main"><span class="col">' + esc(s.craftName || s.category.name) + '</span><a class="name" href="#/product/' + s.slug + '">' + esc(s.name) + '</a>' +
      '<span class="code"><span>Code <b>' + esc(s.sku) + '</b></span>' + (kind ? '<span class="kind">' + kind + '</span>' : '') + '</span>' + from + note +
      '<div class="acts">' + qty + '<button type="button" class="rm" data-act="remove" data-slug="' + s.slug + '" aria-label="Remove ' + esc(s.name + ' (' + s.sku + ')') + '">' + icon('trash', 'sm') + 'Remove</button></div></div>' +
      '<div class="lt">' + priceCol + '</div></article>';
  }

  /* ---------- Main buttons for the bag (5.8) ---------- */
  function bagButtons(c, where) {
    var o = O.get('bagbtn'); var off = F.offline || F.error || F.loading || !c.counted;
    var dis = off ? ' disabled aria-disabled="true"' : '';
    var co = '<button type="button" class="btn btn-primary btn-lg btn-block" data-act="checkout"' + dis + '>' + icon('lock', 'sm') + 'Checkout</button>';
    var wa = '<button type="button" class="btn btn-wa btn-lg btn-block" data-act="wa"' + dis + '>' + icon('whatsapp', 'sm') + 'Send bag on WhatsApp</button>';
    var cont = where === 'drawer' ? '' : '<a class="btn btn-block" href="#/shop">Continue shopping</a>';
    var secure = where === 'drawer' ? '' : '<p class="soon">Secure payment by Razorpay · UPI, cards, net banking, wallets</p>';
    if (o === 'b') return '<div class="two-eq">' + co + wa + '</div>' + secure + cont;
    if (o === 'c') return wa + '<button type="button" class="btn btn-lg btn-block" data-act="checkout"' + dis + '>' + icon('lock', 'sm') + 'Checkout and pay online</button>' + secure + cont;
    return co + secure + '<button type="button" class="link small wa-link" data-act="wa"' + dis + '>' + icon('whatsapp', 'sm') + 'Order on WhatsApp instead</button>' + cont;
  }
  function changesText(ch) {
    var bits = [];
    if (ch.sold) bits.push(ch.sold + ' sold out');
    if (ch.gone) bits.push(ch.gone + ' no longer on the website');
    if (ch.fewer) bits.push(ch.fewer + ' with fewer pieces left');
    if (ch.price) bits.push(ch.price + ' with a new price');
    return bits.join(' · ');
  }

  /* ---------- Pages ---------- */
  var PAGES = {};
  PAGES.shop = function () {
    var list = D.sarees;
    return { title: 'All sarees', states: [], html: '<div class="wrap"><div class="page-head">' + crumbs([['Home', '#/shop'], ['All sarees']]) + '<h1>All sarees</h1><p class="muted">' + num(D.totals.sarees) + ' on the website. <span class="mock-tag">Mock-up: 12 real sarees from the live list</span></p></div>' +
      '<div class="pgrid" style="--cols:4">' + list.map(card).join('') + '</div><div style="height:clamp(48px,6vw,90px)"></div></div>' };
  };

  PAGES.product = function (r) {
    var p = bySlug[r.slug];
    if (!p) return PAGES.shop();
    var inBag = find(p.slug), q = inBag ? inBag.qty : 0;
    var isSet = p.available > 1, sold = p.available < 1, room = p.available - q;
    var want = Math.max(1, Math.min(PSTATE.want[p.slug] || 1, room || 1));
    var stock = sold ? ['out', 'Sold out'] : isSet ? ['', num(p.available) + ' identical pieces in stock: a set for the family'] : ['low', 'Only one piece: once it sells, this design is gone'];
    var pdp = O.get('pdp');
    var add;
    if (sold) {
      add = '<div class="buy-row"><a class="btn btn-wa btn-lg btn-block" href="#' + MOCK_WA + '" data-act="wa-mock">' + icon('whatsapp', 'sm') + 'Ask for a similar saree</a><a class="btn btn-lg btn-block" href="#/shop">More from this collection</a></div>';
    } else {
      var full = !inBag && (F.full || bag.length >= MAX_LINES);
      var addBtn;
      if (inBag && room < 1) addBtn = '<button type="button" class="btn btn-inbag btn-lg btn-block" data-act="open-bag">' + icon('check', 'sm') + (isSet ? 'All ' + p.available + ' pieces are in your ' + W() : 'In your ' + W()) + ' · View</button>';
      else addBtn = '<button type="button" class="btn btn-primary btn-lg btn-block' + (F.adding ? ' is-loading' : '') + '" data-act="add" data-slug="' + p.slug + '"' + (full ? ' disabled aria-disabled="true"' : '') + (F.adding ? ' aria-busy="true"' : '') + '>' + icon('bag', 'sm') + (inBag ? 'Add ' + (want === 1 ? 'one more' : want + ' more') + ' to ' + W() : 'Add to ' + W()) + '</button>';
      var waBtn = '<a class="btn btn-lg btn-block" href="#' + MOCK_WA + '" data-act="wa-mock">' + icon('whatsapp', 'sm') + 'Order on WhatsApp</a>';
      var second = pdp === 'c' ? '<button type="button" class="btn btn-ink btn-lg btn-block" data-act="checkout">Buy now</button>' : waBtn;
      var qtyRow = isSet && room > 0 ? '<div class="buy-qty"><span class="label" id="pcs-l">Pieces</span>' + qtyControl(p.slug, want, room, 'pdp') + '<span class="left">' + (inBag ? q + ' in your ' + W() + ' · up to ' + room + ' more' : 'Up to ' + room) + '</span></div>' :
        (isSet && inBag ? '<div class="buy-qty"><span class="left">' + q + ' in your ' + W() + ' (the whole set)</span></div>' : '');
      add = (full ? '<div class="alert alert-warn">' + icon('alert') + '<div><b class="alert-title">Your ' + W() + ' is full</b>20 different sarees is the most it holds. Remove one to add this saree. <a class="link" href="#/bag">Open the ' + W() + '</a> <span class="mock-tag">Sample</span></div></div>' : '') +
        qtyRow + '<div class="buy-row' + (pdp === 'b' ? ' two' : '') + '">' + addBtn + second + '</div>' +
        (pdp === 'c' ? '<p class="call-line">Or <a href="#' + MOCK_WA + '" data-act="wa-mock">order on WhatsApp</a></p>' : '') +
        '<p class="call-line">' + icon('phone', 'sm') + 'Questions? Call <a href="#/shop">' + mobile(D.shop.mobile) + '</a></p>' +
        '<p class="hold-note">' + icon('clock', 'sm') + '<span>The ' + W() + ' doesn\'t hold the saree: our store sells it too. ' + (O.get('w6') === 'c' ? 'It is held for you while you pay.' : 'Send your ' + W() + ' on WhatsApp and we confirm it is still here.') + '</span></p>';
    }
    var others = D.sarees.filter(function (x) { return x.slug !== p.slug && x.available > 0; }).slice(0, 8);
    var html = '<div class="wrap"><div class="page-head">' + crumbs([['Home', '#/shop'], [p.category.name, '#/shop'], [p.collection.name, '#/shop'], [p.sku]]) + '</div>' +
      '<div class="pdp"><div class="gallery single"><button type="button" class="stage" aria-label="Open photo 1 of 1 full screen"><img src="' + p.photo + '" alt="' + esc(p.photoAlt) + '"></button></div>' +
      '<div class="buy"><a class="colname" href="#/shop">' + esc(p.collection.name.trim().toLowerCase() === p.name.trim().toLowerCase() ? p.category.name : p.collection.name) + '</a><h1>' + esc(p.name) + '</h1>' +
      '<div class="meta"><span>Code <b class="tnum">' + esc(p.sku) + '</b></span>' + (p.craftName ? '<span>· ' + esc(p.craftName) + '</span>' : '') + (p.isNew && !sold ? '<span class="badge badge-gold">New</span>' : '') + '</div>' +
      '<div class="pricebox"><span class="price">' + rs(p.price) + '</span><small>Free delivery across India</small></div>' +
      '<div class="stockline ' + stock[0] + '" role="status"><span class="dot" aria-hidden="true"></span>' + stock[1] + '</div>' + add +
      '<div class="perks">' + [['truck', 'Free delivery across India'], ['thread', 'Handwoven in Mangalagiri'], ['whatsapp', 'Order help on WhatsApp'], ['store', 'See it at our store']].map(function (x) { return '<div>' + icon(x[0], 'sm') + x[1] + '</div>'; }).join('') + '</div>' +
      (p.highlights.length ? '<ul class="highlights">' + p.highlights.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="acc"><details' + (p.highlights.length ? '' : ' open') + '><summary>About this saree' + icon('plus', 'sm') + '</summary><div class="body"><p>' + esc(p.description) + '</p><p>Colours can look a little different on screens. Ask us on WhatsApp for a video in daylight.</p></div></details>' +
      '<details><summary>Ordering and delivery' + icon('plus', 'sm') + '</summary><div class="body"><ul><li>Add the sarees you like to your ' + W() + '. ' + (isSet ? 'For a set, choose how many pieces.' : '') + '</li><li>' + (O.get('w6') === 'c' ? 'Pay online at checkout (UPI, cards, net banking).' : 'Send your ' + W() + ' on WhatsApp in one tap: the codes and prices are filled in. We confirm and share the payment details.') + '</li><li>Free delivery across India. We share the tracking number once it ships.</li></ul></div></details>' +
      '<details><summary>Care' + icon('plus', 'sm') + '</summary><div class="body"><ul><li>Dry clean the first few times; after that, a gentle cold hand wash.</li><li>Dry in the shade, and iron on the reverse at low heat.</li></ul></div></details></div>' +
      '</div></div>' +
      '<section class="section tight" aria-labelledby="h-like"><div class="sec-head"><div><span class="eyebrow">' + esc(p.craftName || 'You may also like') + '</span><h2 id="h-like">You may also like</h2></div></div><div class="rail four">' + others.map(card).join('') + '</div></section>' +
      '<div style="height:clamp(32px,5vw,64px)"></div>' +
      (sold ? '' : '<div class="buybar" data-buybar><img src="' + p.photo + '" alt=""><span class="t"><b>' + esc(p.name) + '</b><span class="muted small">' + rs(p.price) + ' · ' + esc(p.sku) + '</span></span>' +
        (inBag && room < 1 ? '<button type="button" class="btn btn-inbag btn-sm" data-act="open-bag">' + icon('check', 'sm') + 'In ' + W() + '</button>' : '<button type="button" class="btn btn-primary btn-sm" data-act="add" data-slug="' + p.slug + '"' + (!inBag && (F.full || bag.length >= MAX_LINES) ? ' disabled' : '') + '>' + icon('bag', 'sm') + 'Add</button>') + '</div>') +
      '</div>';
    var states = [['default', 'As it is'], ['added', 'Just added'], ['inbag', 'Already in the ' + W()], ['adding', 'Adding…'], ['bagfull', W(true) + ' full']];
    if (isSet) states.splice(3, 0, ['setall', 'Whole set in the ' + W()]);
    states.push(['@sold', 'Sold-out saree']); states.push(['@set', 'A set of 5']); states.push(['@single', 'One piece']);
    return { title: p.name, states: states, html: html, fab: false };
  };
  var PSTATE = { want: {} };

  PAGES.bag = function (r) {
    var c = check(); var lay = O.get('layout'); var prob = O.get('problems');
    var head = '<div class="page-head">' + crumbs([['Home', '#/shop'], ['Your ' + W()]]) + '<h1>Your ' + W() + '</h1>' +
      (bag.length ? '<p class="muted">' + pcs(c.pieces) + (c.out ? ' · ' + c.out + (c.out === 1 ? ' saree' : ' sarees') + ' can\'t be bought now' : '') + '</p>' : '') + '</div>';
    var notes = '';
    if (F.offline) notes += '<div class="alert alert-warn">' + icon('wifioff') + '<div><b class="alert-title">You\'re offline</b>This is your ' + W() + ' as saved on this phone. We\'ll check prices and stock when you\'re back online.</div></div>';
    if (F.error) notes += '<div class="alert alert-bad">' + icon('alertc') + '<div><b class="alert-title">We couldn\'t check your ' + W() + ' just now</b>Your sarees are safe here. Prices and stock will update once we can check.<div class="acts"><button type="button" class="btn btn-sm" data-act="retry">' + icon('refresh', 'sm') + 'Try again</button></div></div></div>';
    if (F.notice) notes += '<div class="alert alert-' + F.notice.tone + '">' + icon(F.notice.icon) + '<div><b class="alert-title">' + esc(F.notice.title) + '</b>' + esc(F.notice.text) + (F.notice.action ? '<div class="acts"><a class="btn btn-sm btn-primary" href="' + F.notice.action[0] + '">' + esc(F.notice.action[1]) + '</a></div>' : '') + ' <span class="mock-tag">Sample</span></div></div>';
    if (c.problems && prob !== 'b' && !F.loading) notes += '<div class="alert alert-warn">' + icon('alert') + '<div><b class="alert-title">Some sarees changed since you added them</b>' + changesText(c.changes) + '. The total uses today\'s prices and stock.' + (F.sampleChanges ? ' <span class="mock-tag">Sample: made-up changes</span>' : '') + '</div></div>';
    if (F.sent) notes += '<div class="alert">' + icon('whatsapp') + '<div><b class="alert-title">Sent on WhatsApp?</b>We reply with the payment details. Once your order is confirmed, you can clear the ' + W() + '.<div class="acts"><button type="button" class="btn btn-sm" data-act="clear-ask">Clear the ' + W() + '</button><button type="button" class="btn btn-sm btn-ghost" data-act="sent-x">Keep it</button></div></div></div>';

    var body;
    if (!bag.length) {
      body = '<div class="empty"><div class="ico-wrap">' + icon('bag') + '</div><h3>Your ' + W() + ' is empty</h3><p>Every piece is handwoven in Mangalagiri. Start with what\'s new, or a set for the family.</p><div class="row-wrap" style="justify-content:center"><a class="btn btn-primary" href="#/shop">New in</a><a class="btn" href="#/shop">All collections</a><a class="btn" href="#/shop">Sets for the family</a></div></div>';
      return { title: 'Your ' + W(), states: bagStates(), html: '<div class="wrap">' + head + (notes ? '<div class="notes-top" style="display:grid;gap:.6rem">' + notes + '</div>' : '') + body + '</div>', fab: false };
    }
    var lines;
    if (prob === 'b' && c.problems && !F.loading) {
      var bad = c.lines.filter(function (L) { return L.state !== 'ok' || L.b.fewerFrom || L.priceWas != null; });
      var good = c.lines.filter(function (L) { return bad.indexOf(L) < 0; });
      lines = '<div class="bgroup-h warn">' + icon('alert', 'sm') + 'Needs your attention <span class="n">' + bad.length + '</span>' + (F.sampleChanges ? ' <span class="mock-tag">Sample</span>' : '') + '</div><div class="blines">' + bad.map(function (L) { return lineHtml(L); }).join('') + '</div>' +
        (good.length ? '<div class="bgroup-h">Ready to order <span class="n">' + good.length + '</span></div><div class="blines">' + good.map(function (L) { return lineHtml(L); }).join('') + '</div>' : '');
    } else lines = '<div class="blines">' + c.lines.map(function (L) { return lineHtml(L); }).join('') + '</div>';
    var checking = F.loading || Date.now() < checkingUntil ? '<span class="checking"><i></i>Checking prices and stock…</span>' : F.offline ? '<span class="checking">Last checked before you went offline</span>' : '<span class="checking">' + icon('check', 'sm') + 'Prices and stock checked just now</span>';
    var sum = '<aside class="sum card" aria-labelledby="sum-h"><h2 id="sum-h">Order summary</h2>' +
      '<div class="sumrow"><span>Subtotal (' + pcs(c.pieces) + ')</span><span class="v">' + (F.loading ? '…' : rs(c.amount)) + '</span></div>' +
      '<div class="sumrow"><span>Delivery</span><span class="free">Free</span></div>' +
      '<div class="sumrow total"><span>Total</span><span class="v">' + (F.loading ? '…' : rs(c.amount)) + '</span></div><p class="tax">Includes all taxes</p>' +
      (c.out ? '<p class="left-out">' + c.out + (c.out === 1 ? ' saree that can\'t be bought now is' : ' sarees that can\'t be bought now are') + ' not counted.</p>' : '') +
      '<div class="acts">' + bagButtons(c, 'page') + '</div>' +
      '<div class="notes"><div>' + icon('truck', 'sm') + 'Free delivery across India</div><div>' + icon('clock', 'sm') + 'Sarees in your ' + W() + ' aren\'t held for you: our store sells them too.</div><div>' + icon('thread', 'sm') + 'Handwoven in Mangalagiri</div>' +
      (F.nostore ? '<div style="color:var(--warn)">' + icon('alert', 'sm') + '<span>Your browser isn\'t saving your ' + W() + ' (private browsing?). <a class="link" href="#/sign-in">Sign in</a> to keep it. <span class="mock-tag">Sample</span></span></div>' : '') +
      (who ? '<div>' + icon('user', 'sm') + 'Saved in your account, ' + esc(who.first) + '</div>' : '') + '</div></aside>';
    var others = D.sarees.filter(function (x) { return !find(x.slug) && x.available > 0; }).slice(0, 8);
    var html = '<div class="wrap bag-page">' + head + '<div class="bagp"><div>' + (notes ? '<div class="notes-top">' + notes + '</div>' : '') + '<div class="lead-row">' + checking + '<a class="link small" href="#/shop">Continue shopping</a></div>' + lines + '</div>' + sum + '</div>' +
      (others.length ? '<section class="section tight" aria-labelledby="h-also"><div class="sec-head"><div><span class="eyebrow">Before you order</span><h2 id="h-also">You may also like</h2></div></div><div class="rail four">' + others.map(card).join('') + '</div></section>' : '') + '</div>' +
      '<div class="bag-bar"><span class="t"><b>' + (F.loading ? '…' : rs(c.amount)) + '</b><span>' + pcs(c.pieces) + ' · free delivery</span></span>' + (O.get('w6') === 'c' ? '<button type="button" class="btn btn-primary" data-act="checkout"' + (c.counted && !F.offline && !F.error ? '' : ' disabled') + '>Checkout</button>' : '<button type="button" class="btn btn-wa" data-act="wa"' + (c.counted && !F.offline && !F.error && !F.loading ? '' : ' disabled') + '>' + icon('whatsapp', 'sm') + 'Send</button>') + '</div>';
    if (prob === 'c' && c.problems && !F.popupShown && !F.loading && !modal) { F.popupShown = true; modal = { kind: 'changes' }; }
    return { title: 'Your ' + W(), states: bagStates(), html: html, fab: false };
  };
  function bagStates() {
    return [['normal', 'Sample ' + W()], ['empty', 'Empty'], ['loading', 'Checking'], ['problems', 'Things changed'], ['offline', 'Offline'], ['error', 'Couldn\'t check'], ['whatsapp', 'WhatsApp pop-up'], ['sent', 'After sending'], ['clear', 'Clear pop-up'], ['remove', 'Removed + Undo'], ['oldbag', 'Old site\'s ' + W()], ['merged', 'Joined at sign-in'], ['signedout', 'Signed out'], ['nostore', 'Won\'t save']];
  }

  PAGES['sign-in'] = function (r) {
    var html;
    if (!who) {
      html = '<div class="wrap narrow"><div class="page-head">' + crumbs([['Home', '#/shop'], ['Sign in']]) + '<h1>Sign in</h1>' + (r && r.next === 'checkout' ? '<p class="lead">Sign in to check out. Your bag stays, and you come straight back.</p>' : '') + '</div><div class="card stack" style="max-width:560px">' +
        '<p><span class="mock-tag">Mock-up shortcut</span></p><p>Sign-in is already live (W1): your mobile number, then a 6-digit code by SMS. Here it is skipped, to show what happens to the ' + W() + '.</p>' +
        '<div class="field"><label for="m">Mobile number</label><div class="input-group"><span class="pre">+91</span><input id="m" class="input" value="98765 43210" disabled></div><span class="field-hint">Sample number</span></div>' +
        '<button type="button" class="btn btn-primary btn-lg btn-block" data-act="signin">Sign in as Priya (sample)</button>' +
        '<p class="muted small">Your ' + W() + ' on this browser is joined with the one saved in your account (the same saree: the larger number of pieces, never more than in stock).</p></div><div style="height:80px"></div></div>';
    } else {
      html = '<div class="wrap narrow"><div class="page-head">' + crumbs([['Home', '#/shop'], ['My account']]) + '<h1>My account</h1></div><div class="card stack" style="max-width:560px"><div class="hello"><span class="avatar" style="width:64px;height:64px;font-size:24px" aria-hidden="true">' + who.initials + '</span><div><b>' + esc(who.name) + '</b><span class="muted small">+91 98765 43210 · sample customer</span></div></div>' +
        '<p>Your ' + W() + ' is saved in your account, so it shows on your other phone too.</p><div class="row-wrap"><a class="btn btn-primary" href="#/bag">Open your ' + W() + '</a><button type="button" class="btn" data-act="signout">' + icon('logout', 'sm') + 'Sign out</button></div>' +
        '<p class="muted small">Signing out removes the ' + W() + ' from this browser (useful on a shared phone). It stays in your account.</p></div><div style="height:80px"></div></div>';
    }
    return { title: who ? 'My account' : 'Sign in', states: [], html: html, fab: false };
  };

  /* ================= W6: checkout and payment ================= */
  // Sample customer data (marked as samples on screen). The sarees and prices are real.
  var ADDRS0 = [
    { id: 'a1', label: 'Home', fullName: 'Priya Sharma', mobile: '98765 43210', line1: 'Flat 302, Sri Sai Residency', line2: 'Road No. 12, Banjara Hills', landmark: 'Near the water tank', city: 'Hyderabad', state: 'Telangana', pincode: '500034', isDefault: true },
    { id: 'a2', label: 'Office', fullName: 'Priya Sharma', mobile: '98765 43210', line1: '4th floor, Lakshmi Towers', line2: 'MG Road', landmark: '', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520010', isDefault: false },
  ];
  var OLD_ADDR = { id: 'a3', label: 'Other', fullName: 'Priya', mobile: '98765 43210', line1: 'Main road', line2: '', landmark: '', city: 'Mangalagiri', state: 'Ap', pincode: '522503', isDefault: false, bad: true };
  var SHOP_STATE = 'Andhra Pradesh';
  var HOLD_MIN = 15;
  var CO = null;
  function freshCO() { return { addrs: ADDRS0.map(function (a) { return Object.assign({}, a); }), sel: 'a1', step: 'address', form: null, order: null, notice: null, rzpTab: 'upi', rzpFailed: false, inline: false }; }
  CO = freshCO();
  var holdTimer = null;
  function hhmm(d) { var h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm'); }
  function newNumber() { return 'NH' + String(Math.floor(10000000 + Math.random() * 89999999)); }
  function selAddr() { for (var i = 0; i < CO.addrs.length; i++) if (CO.addrs[i].id === CO.sel) return CO.addrs[i]; return null; }
  function gstOf(total, state) {
    var taxable = Math.round(total / 1.05 * 100) / 100, gst = Math.round((total - taxable) * 100) / 100;
    return { gst: gst, igst: state && state !== SHOP_STATE };
  }
  function buyLines() { return check().lines.filter(function (L) { return L.state === 'ok'; }); }
  function addrText(a) { return [a.line1, a.line2, a.landmark ? 'Near: ' + a.landmark.replace(/^Near /i, '') : '', a.city + ', ' + a.state + ' ' + a.pincode].filter(Boolean).join(', '); }
  function addrBlock(a) {
    return '<span class="ad-name"><b>' + esc(a.fullName) + '</b>' + (a.label ? ' <span class="badge">' + esc(a.label) + '</span>' : '') + (a.isDefault ? ' <span class="badge badge-gold">Default</span>' : '') + '</span>' +
      '<span class="ad-lines">' + esc(addrText(a)) + '</span><span class="ad-phone">' + icon('phone', 'sm') + '+91 ' + esc(a.mobile) + '</span>';
  }
  function holdLine(o) {
    if (!o || O.get('hold') === 'c') return '';
    if (O.get('hold') === 'b') return '<p class="hold-line" role="status">' + icon('clock', 'sm') + '<span>Your sarees are held for you: <b class="tnum" data-countdown="' + o.holdUntil.getTime() + '">' + countdownText(o.holdUntil) + '</b> left</span></p>';
    return '<p class="hold-line" role="status">' + icon('clock', 'sm') + '<span>Your sarees are held for you until <b>' + hhmm(o.holdUntil) + '</b>.</span></p>';
  }
  function countdownText(until) { var s = Math.max(0, Math.round((until.getTime() - Date.now()) / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function tickCountdowns() { document.querySelectorAll('[data-countdown]').forEach(function (el) { el.textContent = countdownText(new Date(Number(el.getAttribute('data-countdown')))); }); }

  function makeOrder() {
    var lines = buyLines();
    var total = lines.reduce(function (n, L) { return n + L.price * L.b.qty; }, 0);
    var pieces = lines.reduce(function (n, L) { return n + L.b.qty; }, 0);
    return { number: newNumber(), lines: lines.map(function (L) { return { slug: L.s.slug, name: L.s.name, sku: L.s.sku, photo: L.s.photo, qty: L.b.qty, price: L.price }; }), total: total, pieces: pieces, address: Object.assign({}, selAddr()), holdUntil: new Date(Date.now() + HOLD_MIN * 60000), method: 'UPI', paidAt: new Date() };
  }
  var ORDERS = {}; // orders made in this visit (mock-up)

  /* ---------- Checkout: the parts ---------- */
  function signInStep() {
    return '<section class="co-step card" aria-labelledby="co-si"><div class="co-head"><span class="co-n">1</span><h2 id="co-si">Sign in</h2></div>' +
      '<p class="muted">Sign in with your mobile number and a code by SMS. Your bag stays.</p>' +
      '<div class="field"><label for="co-m">Mobile number</label><div class="input-group"><span class="pre">+91</span><input id="co-m" class="input" value="98765 43210" inputmode="numeric" disabled></div><span class="field-hint">Sample number <span class="mock-tag">Mock-up shortcut</span></span></div>' +
      '<button type="button" class="btn btn-primary btn-lg" data-act="co-signin-inline">Send code and sign in (sample)</button></section>';
  }
  function addressChoice() {
    var o = O.get('addr');
    if (!CO.addrs.length) return '';
    if (o === 'c') {
      var a = selAddr() || CO.addrs[0];
      return '<div class="field"><label for="co-addr-sel">Deliver to</label><select id="co-addr-sel" class="select" data-change="co-addr">' + CO.addrs.map(function (x) { return '<option value="' + x.id + '"' + (x.id === CO.sel ? ' selected' : '') + '>' + esc(x.label + ': ' + x.fullName + ', ' + x.city) + (x.bad ? ' (needs checking)' : '') + '</option>'; }).join('') + '</select></div><div class="ad-card is-on">' + addrBlock(a) + '</div>';
    }
    return '<div class="ad-list' + (o === 'b' ? ' compact' : '') + '" role="radiogroup" aria-label="Delivery address">' + CO.addrs.map(function (x) {
      var on = x.id === CO.sel;
      return '<label class="ad-card' + (on ? ' is-on' : '') + (x.bad ? ' is-bad' : '') + '"><input type="radio" name="co-addr" value="' + x.id + '"' + (on ? ' checked' : '') + ' data-change="co-addr">' +
        '<span class="ad-body">' + addrBlock(x) + (x.bad ? '<span class="ad-warn">' + icon('alert', 'sm') + 'Needs checking before use</span>' : '') + '</span></label>';
    }).join('') + '</div>';
  }
  function addressForm() {
    var f = CO.form, a = f.mode === 'fix' ? OLD_ADDR : {};
    var st = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Maharashtra', 'Kerala', 'Odisha', 'Delhi'];
    return '<form class="ad-form stack" data-form="co-addr" novalidate>' +
      (f.mode === 'fix' ? '<div class="alert alert-warn">' + icon('alert') + '<div><b class="alert-title">Please check this address</b>It was saved on our old website, and the state "' + esc(OLD_ADDR.state) + '" isn\'t one we know. Choose the state and check the rest. <span class="mock-tag">Sample</span></div></div>' : '') +
      '<div class="grid-2"><div class="field"><label for="af-n">Full name</label><input id="af-n" class="input" autocomplete="name" value="' + esc(a.fullName || 'Priya Sharma') + '"></div>' +
      '<div class="field"><label for="af-m">Mobile for delivery</label><div class="input-group"><span class="pre">+91</span><input id="af-m" class="input" inputmode="numeric" value="' + esc(a.mobile || '98765 43210') + '"></div></div></div>' +
      '<div class="field"><label for="af-1">House, flat, building</label><input id="af-1" class="input" autocomplete="address-line1" value="' + esc(a.line1 || '') + '" placeholder="Flat 302, Sri Sai Residency"></div>' +
      '<div class="grid-2"><div class="field"><label for="af-2">Area, street <span class="muted small">(optional)</span></label><input id="af-2" class="input" value="' + esc(a.line2 || '') + '"></div>' +
      '<div class="field"><label for="af-l">Landmark <span class="muted small">(optional)</span></label><input id="af-l" class="input" value="' + esc(a.landmark || '') + '" placeholder="Near the temple"></div></div>' +
      '<div class="grid-2"><div class="field"><label for="af-p">Pincode</label><input id="af-p" class="input" inputmode="numeric" value="' + esc(a.pincode || '') + '"><span class="field-hint ok">' + icon('check', 'sm') + 'Mangalagiri, Guntur, Andhra Pradesh</span></div>' +
      '<div class="field' + (f.mode === 'fix' ? ' has-error' : '') + '"><label for="af-s">State</label><select id="af-s" class="select">' + (f.mode === 'fix' ? '<option value="">Choose the state</option>' : '') + st.map(function (x) { return '<option' + (f.mode !== 'fix' && x === 'Andhra Pradesh' ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>' + (f.mode === 'fix' ? '<span class="field-error">' + icon('alertc', 'sm') + 'Choose the state</span>' : '') + '</div></div>' +
      '<fieldset class="plain"><legend class="label">Save as</legend><div class="chips"><label class="chip"><input type="radio" name="af-lab" checked>Home</label><label class="chip"><input type="radio" name="af-lab">Office</label><label class="chip"><input type="radio" name="af-lab">Other</label></div></fieldset>' +
      '<label class="check"><input type="checkbox"' + (CO.addrs.length ? '' : ' checked') + '>Make this my default address</label>' +
      '<div class="row-wrap"><button type="button" class="btn btn-primary btn-lg" data-act="co-save-addr">Save and deliver here</button>' + (CO.addrs.length ? '<button type="button" class="btn btn-ghost" data-act="co-cancel-form">Cancel</button>' : '') + '</div></form>';
  }
  function addressStep(done) {
    var a = selAddr();
    var inner;
    if (done && a) inner = '<div class="co-done"><div class="ad-card is-on">' + addrBlock(a) + '</div><button type="button" class="link small" data-act="co-change-addr">Change</button></div>';
    else if (CO.form) inner = addressForm();
    else inner = addressChoice() + '<div class="row-wrap co-actions"><button type="button" class="btn btn-ghost" data-act="co-add-new">' + icon('plus', 'sm') + 'Add a new address</button>' +
      (O.get('colayout') === 'c' ? '' : '<button type="button" class="btn btn-primary btn-lg" data-act="co-deliver"' + (a && !a.bad ? '' : ' disabled') + '>Deliver here</button>') + '</div>';
    return '<section class="co-step card' + (done ? ' is-done' : '') + '" aria-labelledby="co-ad"><div class="co-head"><span class="co-n">' + (done ? icon('check', 'sm') : (O.get('signin') === 'b' && CO.inline ? '2' : '1')) + '</span><h2 id="co-ad">Delivery address</h2></div>' + inner + '</section>';
  }
  function linesBlock() {
    var lines = buyLines();
    return '<ul class="co-lines">' + lines.map(function (L) {
      return '<li><img src="' + L.s.photo + '" alt=""><span class="t"><b>' + esc(L.s.name) + '</b><span class="muted small">Code ' + esc(L.s.sku) + ' · ' + pcs(L.b.qty) + (L.priceWas != null ? ' · <span class="chg">price changed from ' + rs(L.priceWas) + '</span>' : '') + (L.b.fewerFrom ? ' · <span class="chg">only ' + L.available + ' left: changed from ' + L.b.fewerFrom + '</span>' : '') + '</span></span><span class="price tnum">' + rs(L.price * L.b.qty) + '</span></li>';
    }).join('') + '</ul>';
  }
  function reviewStep(active) {
    var n = O.get('signin') === 'b' && CO.inline ? '3' : '2';
    if (!active) return '<section class="co-step card is-later" aria-labelledby="co-rv"><div class="co-head"><span class="co-n">' + n + '</span><h2 id="co-rv">Review and pay</h2></div><p class="muted small">After you choose the address.</p></section>';
    return '<section class="co-step card" aria-labelledby="co-rv"><div class="co-head"><span class="co-n">' + n + '</span><h2 id="co-rv">Review and pay</h2><a class="link small" href="#/bag">Change my bag</a></div>' + linesBlock() + '</section>';
  }
  function summary(c, canPay) {
    var a = selAddr(), total = c.amount, g = gstOf(total, a && a.state);
    var gstText = g.igst ? 'Includes IGST 5% (' + rs(g.gst) + '): delivered to ' + esc(a.state) : 'Includes GST 5% (' + rs(g.gst) + '): CGST 2.5% + SGST 2.5%';
    return '<aside class="sum card co-sum" aria-labelledby="co-sum-h"><h2 id="co-sum-h">Order summary</h2>' +
      '<div class="sumrow"><span>Subtotal (' + pcs(c.pieces) + ')</span><span class="v">' + rs(total) + '</span></div>' +
      '<div class="sumrow"><span>Delivery</span><span class="free">Free</span></div>' +
      '<div class="sumrow total"><span>Total</span><span class="v">' + rs(total) + '</span></div><p class="tax">' + gstText + ' <span class="mock-tag">6.12 A</span></p>' +
      holdLine(CO.order) +
      '<div class="acts"><button type="button" class="btn btn-primary btn-lg btn-block" data-act="co-pay"' + (canPay && !F.offline ? '' : ' disabled aria-disabled="true"') + '>' + icon('lock', 'sm') + 'Pay ' + rs(total) + '</button>' +
      '<p class="soon pay-methods">' + icon('shield', 'sm') + 'Secure payment by Razorpay · UPI, cards, net banking, wallets</p></div>' +
      '<p class="muted small agree">By paying you agree to our <a class="link" href="#/shop">Terms</a>, <a class="link" href="#/shipping">Shipping</a> and <a class="link" href="#/refunds">Cancellation and refunds</a> policies.</p>' +
      '<div class="notes"><div>' + icon('truck', 'sm') + 'Free delivery across India by DTDC</div><div>' + icon('thread', 'sm') + 'Handwoven in Mangalagiri</div></div></aside>';
  }
  function coNotice() {
    var n = CO.notice, o = CO.order;
    if (n === 'failed') return '<div class="alert alert-bad" role="alert">' + icon('alertc') + '<div><b class="alert-title">Payment didn\'t go through. Nothing was taken.</b>' + (o ? 'Your sarees are still held until ' + hhmm(o.holdUntil) + '.' : '') + '<div class="acts"><button type="button" class="btn btn-sm btn-primary" data-act="co-pay">Try again</button></div> <span class="mock-tag">Sample</span></div></div>';
    if (n === 'closed') return '<div class="alert alert-warn" role="alert">' + icon('alert') + '<div><b class="alert-title">Payment not completed</b>' + (o ? 'Your sarees are held for you until ' + hhmm(o.holdUntil) + '.' : '') + '<div class="acts"><button type="button" class="btn btn-sm btn-primary" data-act="co-pay">Pay now</button><button type="button" class="btn btn-sm" data-act="co-change-bag">Change my bag</button></div></div></div>';
    if (n === 'expired') return '<div class="alert alert-warn" role="alert">' + icon('clock') + '<div><b class="alert-title">The 15 minutes are over</b>Your sarees were released, so others could buy them. Check your bag again: most are usually still there. <span class="mock-tag">Sample</span><div class="acts"><button type="button" class="btn btn-sm btn-primary" data-act="co-check-again">Check my bag again</button></div></div></div>';
    if (n === 'changed') return '<div class="alert alert-warn" role="alert">' + icon('alert') + '<div><b class="alert-title">Something changed before you paid</b>A saree sold at our store and one collection\'s price changed. Nothing was charged. Check the order below, then pay. <span class="mock-tag">Sample</span></div></div>';
    if (n === 'offline') return '<div class="alert alert-warn" role="alert">' + icon('wifioff') + '<div><b class="alert-title">You\'re offline</b>Nothing was charged. Pay works again when you\'re back online. <span class="mock-tag">Sample</span></div></div>';
    if (n === 'inapp') return '<div class="alert" role="alert">' + icon('info') + '<div><b class="alert-title">Payments don\'t open inside Instagram</b>Open the website in Chrome or Safari to pay: tap ⋯ at the top, then "Open in browser". Your bag is saved in your account. <span class="mock-tag">Sample</span><div class="acts"><button type="button" class="btn btn-sm" data-act="co-copy-link">' + icon('copy', 'sm') + 'Copy the link</button></div></div></div>';
    return '';
  }

  PAGES.checkout = function (r) {
    var st = r.state || '';
    var layout = O.get('colayout');
    var head = '<div class="page-head">' + crumbs([['Home', '#/shop'], ['Your bag', '#/bag'], ['Checkout']]) + '<h1>Checkout</h1></div>';
    var states = [['signedout', 'Not signed in'], ['address', 'Address'], ['newaddr', 'First address'], ['fixaddr', 'Old address'], ['review', 'Review'], ['paying', 'Razorpay open'], ['confirming', 'Confirming'], ['failed', 'Failed'], ['closed', 'Window closed'], ['expired', 'Hold ended'], ['changed', 'Changed at Pay'], ['offline', 'Offline'], ['inapp', 'In-app browser'], ['empty', 'Nothing to buy']];
    if (!who && !(O.get('signin') === 'b')) {
      return { title: 'Checkout', states: states, fab: false, html: '<div class="wrap narrow">' + head + '<div class="card stack co-gate"><span class="ico-wrap">' + icon('lock') + '</span><h2>Sign in to check out</h2><p>Your bag stays as it is. Sign in with your mobile number and a code by SMS, and you come straight back here.</p><div class="row-wrap"><a class="btn btn-primary btn-lg" href="#/sign-in?next=checkout">Sign in</a><a class="btn btn-lg" href="#/bag">Back to the bag</a></div></div><div style="height:80px"></div></div>' };
    }
    var c = check();
    if (!c.counted) {
      return { title: 'Checkout', states: states, fab: false, html: '<div class="wrap narrow">' + head + '<div class="empty"><div class="ico-wrap">' + icon('bag') + '</div><h3>Your bag has nothing that can be bought now</h3><p>The sarees in it sold or left the website. Have a look at what\'s new.</p><div class="row-wrap" style="justify-content:center"><a class="btn btn-primary" href="#/bag">Open the bag</a><a class="btn" href="#/shop">New in</a></div></div></div>' };
    }
    var signinB = !who && O.get('signin') === 'b';
    var addrDone = CO.step !== 'address' && !CO.form;
    var canPay = !signinB && addrDone && selAddr() && !selAddr().bad;
    var left, prog = '';
    if (layout === 'b') {
      var stepIdx = signinB ? 0 : CO.step === 'address' ? 1 : CO.step === 'review' ? 2 : 3;
      prog = '<ol class="co-prog" aria-label="Checkout steps">' + ['Address', 'Review', 'Pay'].map(function (t, i) { var n = i + 1; return '<li class="' + (stepIdx > n ? 'done' : stepIdx === n ? 'on' : '') + '"' + (stepIdx === n ? ' aria-current="step"' : '') + '><span>' + (stepIdx > n ? icon('check', 'sm') : n) + '</span>' + t + '</li>'; }).join('') + '</ol>';
      if (signinB) left = signInStep();
      else if (CO.step === 'address' || CO.form) left = addressStep(false);
      else if (CO.step === 'review') left = addressStep(true) + reviewStep(true) + '<div class="row-wrap co-actions"><button type="button" class="btn btn-primary btn-lg" data-act="co-to-pay">Continue to payment</button></div>';
      else left = addressStep(true) + reviewStep(true);
      canPay = canPay && CO.step === 'pay';
    } else if (layout === 'c') {
      if (signinB) left = signInStep();
      else { if (CO.step === 'address' && selAddr() && !selAddr().bad && !CO.form) CO.step = 'review'; left = addressStep(false) + reviewStep(true); canPay = selAddr() && !selAddr().bad && !CO.form; }
    } else {
      left = (signinB ? signInStep() : '') + (signinB ? '' : addressStep(addrDone)) + reviewStep(addrDone && !signinB);
    }
    var html = '<div class="wrap co-page">' + head + prog + '<div class="co-notes">' + coNotice() + '</div><div class="co-grid">' + '<div class="co-main">' + left + '</div>' + summary(c, canPay) + '</div>' +
      (O.get('paybar') === 'a' ? '<div class="pay-bar"><span class="t"><b>' + rs(c.amount) + '</b><span>' + pcs(c.pieces) + ' · free delivery</span></span><button type="button" class="btn btn-primary" data-act="co-pay"' + (canPay && !F.offline ? '' : ' disabled') + '>' + icon('lock', 'sm') + 'Pay</button></div>' : '') + '</div>';
    return { title: 'Checkout', states: states, fab: false, html: html };
  };

  /* ---------- After paying: the order page ---------- */
  function sampleOrder(number) {
    if (ORDERS[number]) return ORDERS[number];
    var lines = sample().map(function (b) { var s = bySlug[b.slug]; return { slug: s.slug, name: s.name, sku: s.sku, photo: s.photo, qty: b.qty, price: s.price }; });
    var o = { number: number, lines: lines, total: lines.reduce(function (n, l) { return n + l.price * l.qty; }, 0), pieces: lines.reduce(function (n, l) { return n + l.qty; }, 0), address: ADDRS0[0], method: 'UPI', paidAt: new Date(), holdUntil: new Date(Date.now() + 9 * 60000) };
    ORDERS[number] = o;
    return o;
  }
  function orderLines(o) {
    return '<ul class="co-lines">' + o.lines.map(function (l) { return '<li><img src="' + l.photo + '" alt=""><span class="t"><b>' + esc(l.name) + '</b><span class="muted small">Code ' + esc(l.sku) + ' · ' + pcs(l.qty) + '</span></span><span class="price tnum">' + rs(l.price * l.qty) + '</span></li>'; }).join('') + '</ul>';
  }
  PAGES.order = function (r) {
    var number = r.path.split('/')[2] || 'NH48213097';
    var o = sampleOrder(number), st = r.state || 'paid';
    var first = (who || PRIYA).first;
    var states = [['paid', 'Paid'], ['bankslow', 'Bank slow'], ['refunded', 'Paid late, refunded']];
    var g = gstOf(o.total, o.address.state);
    var details = '<div class="ord-grid"><section class="card"><h2 class="h-sm">Your sarees</h2>' + orderLines(o) + '<div class="sumrow total"><span>Total paid</span><span class="v">' + rs(o.total) + '</span></div><p class="tax">' + (g.igst ? 'Includes IGST 5% (' + rs(g.gst) + ')' : 'Includes GST 5% (' + rs(g.gst) + ')') + ' · Free delivery</p></section>' +
      '<section class="card"><h2 class="h-sm">Delivering to</h2><div class="ad-card">' + addrBlock(o.address) + '</div><h2 class="h-sm" style="margin-top:1.2rem">Payment</h2><p>' + icon('check', 'sm') + ' Paid ' + rs(o.total) + ' by ' + o.method + ' (Razorpay) · ' + hhmm(o.paidAt) + '</p><p class="muted small">Your GST invoice will be in My orders <span class="mock-tag">Planned: W7</span></p></section></div>';
    var html;
    if (st === 'bankslow') {
      html = '<div class="ord-hero"><span class="ord-ic slow" aria-hidden="true"><i></i></span><h1>Payment received, confirming with your bank</h1><p class="lead">Order <b class="tnum">' + number + '</b> · ' + rs(o.total) + '. Your bank is taking a little longer than usual. Your sarees stay held while we wait.</p><p class="muted">You can close this page. We\'ll update you here, in My orders and with a notification if you turned them on. If the bank doesn\'t confirm, nothing is taken. <span class="mock-tag">Sample</span></p><div class="row-wrap" style="justify-content:center"><button type="button" class="btn btn-primary" data-act="ord-check">Check again</button><a class="btn" href="#/shop">Continue shopping</a></div></div>';
    } else if (st === 'refunded') {
      html = '<div class="ord-hero"><span class="ord-ic bad" aria-hidden="true">' + icon('alertc', 'lg') + '</span><h1>We couldn\'t keep your order</h1><p class="lead">Your payment for order <b class="tnum">' + number + '</b> arrived after the 15 minutes, and by then the <b>' + esc(o.lines[0].name) + '</b> (' + esc(o.lines[0].sku) + ') had sold at our store.</p><div class="alert alert-ok" style="text-align:left;max-width:620px;margin-inline:auto">' + icon('refresh') + '<div><b class="alert-title">Your ' + rs(o.total) + ' is being refunded</b>To the same account you paid from, usually in 5 to 7 working days. You don\'t need to do anything. <span class="mock-tag">Sample</span></div></div><div class="row-wrap" style="justify-content:center"><a class="btn btn-primary" href="#/shop">See what\'s new</a><a class="btn btn-wa" href="#' + MOCK_WA + '" data-act="wa-mock">' + icon('whatsapp', 'sm') + 'Ask us for a similar saree</a></div></div>';
    } else if (O.get('confirm') === 'b') {
      html = '<div class="ord-receipt card"><div class="row-between"><div><span class="eyebrow">Order confirmed</span><h1 class="h-md">Thank you, ' + esc(first) + '</h1></div><span class="ord-ic ok small" aria-hidden="true">' + icon('check') + '</span></div>' +
        '<dl class="rc"><dt>Order</dt><dd class="tnum">' + number + '</dd><dt>Paid</dt><dd>' + rs(o.total) + ' · ' + o.method + '</dd><dt>Delivering to</dt><dd>' + esc(o.address.fullName + ', ' + o.address.city) + '</dd><dt>Next</dt><dd>We pack within 2 working days; DTDC delivers in 3 to 7 days <span class="mock-tag">Owner to confirm</span></dd></dl>' + orderLines(o) +
        '<div class="row-wrap"><a class="btn btn-primary" href="#/shop">Continue shopping</a><a class="btn" href="#/shop">My orders</a></div></div>';
    } else {
      html = '<div class="ord-hero"><span class="ord-ic ok" aria-hidden="true">' + icon('check', 'lg') + '</span><span class="eyebrow">Order confirmed</span><h1>Thank you, ' + esc(first) + '</h1><p class="lead">Your order <b class="tnum">' + number + '</b> is confirmed and paid: ' + rs(o.total) + ' by ' + o.method + '.</p>' +
        '<ol class="ord-next" aria-label="What happens next"><li class="on"><span>' + icon('check', 'sm') + '</span><b>Paid</b><small>Just now</small></li><li><span>' + icon('box', 'sm') + '</span><b>Packed</b><small>Within 2 working days</small></li><li><span>' + icon('truck', 'sm') + '</span><b>Shipped by DTDC</b><small>Tracking number in My orders</small></li><li><span>' + icon('home', 'sm') + '</span><b>Delivered</b><small>Usually 3 to 7 days</small></li></ol><p class="muted small">Times are drafts for the owner to confirm. <span class="mock-tag">Owner to confirm</span></p>' +
        '<div class="row-wrap" style="justify-content:center"><a class="btn btn-primary" href="#/shop">Continue shopping</a><a class="btn" href="#/shop">My orders <span class="mock-tag">W7</span></a></div></div>' + details;
    }
    return { title: st === 'refunded' ? 'Order not kept' : st === 'bankslow' ? 'Confirming payment' : 'Order confirmed', states: states, fab: false, html: '<div class="wrap ord-page">' + html + '<div style="height:clamp(40px,6vw,80px)"></div></div>' };
  };

  /* ---------- Pages Razorpay asks for (drafts) ---------- */
  function policyPage(title, intro, sections) {
    return { title: title, states: [], html: '<div class="wrap narrow"><div class="page-head">' + crumbs([['Home', '#/shop'], [title]]) + '<h1>' + title + '</h1><span class="draft-note">' + icon('edit', 'sm') + 'Draft for the owner: not the shop\'s final text</span></div><div class="prose"><p>' + intro + '</p>' +
      sections.map(function (s) { return '<h2>' + s[0] + '</h2>' + (Array.isArray(s[1]) ? '<ul>' + s[1].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '<p>' + s[1] + '</p>'); }).join('') + '</div><div style="height:80px"></div></div>' };
  }
  PAGES.shipping = function () {
    return policyPage('Shipping policy', 'Every order from nandamhandlooms.com is packed at our store in Old Mangalagiri and sent by courier. Delivery is free across India.', [
      ['When we ship', ['We pack and hand your order to DTDC within 2 working days of payment.', 'Orders paid on a Sunday or a festival holiday are packed the next working day.']],
      ['How long it takes', ['Usually 3 to 7 days after shipping, depending on your pincode.', 'We send the tracking number as soon as it ships: you can follow it in My orders.']],
      ['Delivery charges', 'None. Delivery is free on every order, anywhere in India.'],
      ['Your address', ['Please check your address and mobile number at checkout. To change it after paying, message us on WhatsApp before the order ships.', 'If the courier can\'t deliver after several tries, the parcel comes back to us and we contact you.']],
      ['Outside India', 'We don\'t ship outside India yet.'],
    ]);
  };
  PAGES.refunds = function () {
    return policyPage('Cancellation and refunds', 'Each saree is handwoven, and many are the only piece of their design. Here is how cancelling and refunds work.', [
      ['Cancelling an order', ['Before it ships: message us on WhatsApp with your order number and we cancel it with a full refund.', 'After it ships: it can\'t be cancelled, but see returns below.']],
      ['Damaged or wrong saree', ['Tell us on WhatsApp within 48 hours of delivery, with photos and an unboxing video.', 'We arrange a replacement if the same design is available, or a full refund.']],
      ['What isn\'t a defect', 'Small differences in weave, colour or motif are part of a handloom. Colours can also look a little different on screens.'],
      ['How refunds are paid', ['To the same account or card you paid from, through Razorpay.', 'Usually 5 to 7 working days after we start it; your bank may take a little longer to show it.']],
      ['A payment we couldn\'t use', 'If your payment reaches us after the 15 minutes your sarees were held, and one has sold meanwhile, we refund the whole amount automatically.'],
    ]);
  };
  PAGES.contact = function () {
    return policyPage('Contact us', 'Nandam Handlooms, a handloom store in Old Mangalagiri. We reply on WhatsApp the same day.', [
      ['Store', D.store.addressLines.join(', ') + '. ' + esc(D.store.hours) + '.'],
      ['Phone and WhatsApp', ['Call +91 ' + mobile(D.shop.mobile), 'WhatsApp +91 73829 68566']],
      ['Business details', 'Nandam Handlooms · GSTIN ' + esc(D.shop.gstin)],
    ]);
  };

  /* ---------- Razorpay's window (a stand-in drawn by us) ---------- */
  function rzpHtml() {
    var o = CO.order, t = CO.rzpTab;
    var tabs = [['upi', 'UPI'], ['card', 'Cards'], ['nb', 'Net banking'], ['wallet', 'Wallets']];
    var body = t === 'card'
      ? '<div class="field"><label for="rz-c">Card number</label><input id="rz-c" class="input" inputmode="numeric" placeholder="4111 1111 1111 1111"></div><div class="grid-2"><div class="field"><label for="rz-e">Expiry</label><input id="rz-e" class="input" placeholder="MM / YY"></div><div class="field"><label for="rz-v">CVV</label><input id="rz-v" class="input" inputmode="numeric" placeholder="123"></div></div>'
      : t === 'nb' ? '<div class="rz-grid">' + ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'Union'].map(function (b) { return '<button type="button" class="rz-opt">' + b + '</button>'; }).join('') + '</div>'
        : t === 'wallet' ? '<div class="rz-grid">' + ['PhonePe', 'Paytm', 'Amazon Pay', 'Mobikwik'].map(function (b) { return '<button type="button" class="rz-opt">' + b + '</button>'; }).join('') + '</div>'
          : '<div class="field"><label for="rz-u">UPI ID</label><input id="rz-u" class="input" value="priya@okicici"></div><p class="muted small">Or scan the QR / choose your UPI app on a phone.</p>';
    return '<div class="scrim" aria-hidden="true"></div><div class="modal"><div class="modal-box rzp" role="dialog" aria-modal="true" aria-labelledby="rz-h" tabindex="-1">' +
      '<div class="rz-top"><div><b id="rz-h">Nandam Handlooms</b><span class="tnum">' + rs(o.total) + '</span></div><button type="button" class="btn btn-icon" data-act="rzp-close" aria-label="Close the payment window">' + icon('x') + '</button></div>' +
      '<p class="rz-stand"><span class="mock-tag">Stand-in</span> The real window is Razorpay\'s own; this one only shows where it opens.</p>' +
      (CO.rzpFailed ? '<div class="alert alert-bad">' + icon('alertc') + '<div><b class="alert-title">Payment failed</b>Your bank declined it. Nothing was taken. Try again or another method.</div></div>' : '') +
      '<div class="rz-tabs" role="tablist">' + tabs.map(function (x) { return '<button type="button" role="tab" aria-selected="' + (t === x[0]) + '" data-act="rzp-tab" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div><div class="rz-body">' + body + '</div>' +
      '<div class="rz-mock"><span>Mock-up: choose what happens</span><div class="row-wrap"><button type="button" class="btn btn-sm btn-primary" data-act="rzp-success">' + icon('check', 'sm') + 'Payment succeeds</button><button type="button" class="btn btn-sm" data-act="rzp-fail">Payment fails</button><button type="button" class="btn btn-sm" data-act="rzp-slow">Bank is slow</button><button type="button" class="btn btn-sm" data-act="rzp-close">Close the window</button></div></div></div></div>';
  }
  function confirmingHtml() {
    return '<div class="scrim" aria-hidden="true"></div><div class="modal"><div class="modal-box conf" role="dialog" aria-modal="true" aria-labelledby="cf-h" tabindex="-1"><span class="spin" aria-hidden="true"></span><h3 id="cf-h">Confirming your payment</h3><p class="muted">Checking with Razorpay that the money arrived. Please don\'t close this page.</p></div></div>';
  }
  function startPay() {
    if (F.offline) { CO.notice = 'offline'; render(); return; }
    if (!CO.order || CO.order.holdUntil.getTime() < Date.now()) CO.order = makeOrder();
    CO.rzpTab = 'upi'; CO.rzpFailed = false; CO.notice = null;
    modal = { kind: 'rzp' }; render();
  }
  function paid() {
    var o = CO.order || makeOrder(); o.paidAt = new Date(); ORDERS[o.number] = o;
    var paidSlugs = o.lines.map(function (l) { return l.slug; });
    bag = bag.filter(function (b) { return paidSlugs.indexOf(b.slug) < 0; }); saveBag();
    CO = freshCO();
    lastKey = null; go('#/order/' + o.number + '?state=paid');
  }

  /* ---------- Overlays: side panel, pop-ups, menu ---------- */
  function drawerHtml() {
    var c = check(); var added = drawer && drawer.added;
    var lines = c.lines.slice().sort(function (a, b) { return (b.s.slug === added) - (a.s.slug === added); });
    return '<div class="scrim" data-act="ov-x" aria-hidden="true"></div><div class="drawer right" role="dialog" aria-modal="true" aria-labelledby="dr-h" tabindex="-1"><div class="drawer-head">' +
      (added ? '<span class="added" id="dr-h">' + icon('check') + 'Added to your ' + W() + '</span>' : '<h2 id="dr-h">Your ' + W() + '</h2>') +
      '<button type="button" class="btn btn-icon" data-act="ov-x" aria-label="Close">' + icon('x') + '</button></div><div class="drawer-body">' +
      (bag.length ? '<div class="blines">' + lines.map(function (L) { return lineHtml(L, { compact: true, added: added }); }).join('') + '</div>' : '<div class="empty"><div class="ico-wrap">' + icon('bag') + '</div><h3>Your ' + W() + ' is empty</h3><a class="btn btn-primary" href="#/shop" data-act="ov-x">New in</a></div>') +
      '</div>' + (bag.length ? '<div class="drawer-foot"><div class="sumrow total"><span>Total · ' + pcs(c.pieces) + '</span><span class="v">' + rs(c.amount) + '</span></div><p class="muted small" style="margin-top:-.4rem">Free delivery across India · includes all taxes</p>' +
        '<div class="two"><a class="btn btn-block" href="#/bag" data-act="ov-x">View ' + W() + '</a><button type="button" class="btn btn-block" data-act="ov-x">Keep shopping</button></div>' + bagButtons(c, 'drawer') + '</div>' : '') + '</div>';
  }
  function waText() {
    var c = check(); var n = 0;
    var rows = c.lines.filter(function (L) { return L.state === 'ok'; }).map(function (L) {
      n += 1;
      return n + '. ' + L.s.name + '\n   Code ' + L.s.sku + ' · ' + (L.b.qty > 1 ? L.b.qty + ' pieces × ' + rs(L.price) + ' = ' + rs(L.price * L.b.qty) : '1 piece · ' + rs(L.price));
    });
    return 'Hello Nandam Handlooms, I\'d like to order these sarees from my ' + W() + ':\n\n' + rows.join('\n') + '\n\nTotal: ' + rs(c.amount) + ' (' + pcs(c.pieces) + ', free delivery)';
  }
  function modalHtml() {
    var m = modal, inner = '';
    if (m.kind === 'rzp') return rzpHtml();
    if (m.kind === 'confirming') return confirmingHtml();
    if (m.kind === 'wa') {
      inner = '<div class="head"><span class="tone" style="color:#1FA855">' + icon('whatsapp') + '</span><div style="display:grid;gap:.35rem"><h3 id="md-h">Send your ' + W() + ' on WhatsApp</h3><p class="muted">WhatsApp opens with this message. Check it and press send: we reply with the payment details.</p></div></div>' +
        '<div class="wa-preview" tabindex="0" aria-label="The message">' + esc(waText()) + '</div>' + (m.noted ? '<p class="note">' + icon('info', 'sm') + '<span><span class="mock-tag">Mock-up</span> WhatsApp doesn\'t open from the mock-up. On the website this button opens WhatsApp with the message ready.</span></p>' : '') +
        '<div class="acts"><button type="button" class="btn" data-act="wa-copy">' + icon('copy', 'sm') + 'Copy text</button><button type="button" class="btn btn-wa" data-act="wa-open">' + icon('whatsapp', 'sm') + 'Open WhatsApp</button></div>';
    } else if (m.kind === 'clear') {
      inner = '<div class="head"><span class="tone warn">' + icon('trash') + '</span><div style="display:grid;gap:.35rem"><h3 id="md-h">Clear your ' + W() + '?</h3><p class="muted">This removes all ' + bag.length + ' sarees from your ' + W() + (who ? ', on this browser and in your account' : '') + '.</p></div></div>' +
        '<div class="acts"><button type="button" class="btn" data-act="ov-x">Keep them</button><button type="button" class="btn btn-danger" data-act="clear">Clear the ' + W() + '</button></div>';
    } else if (m.kind === 'changes') {
      var c = check();
      inner = '<div class="head"><span class="tone warn">' + icon('alert') + '</span><div style="display:grid;gap:.35rem"><h3 id="md-h">Some sarees changed since you added them</h3><p class="muted">The ' + W() + ' now uses today\'s prices and stock. <span class="mock-tag">Sample</span></p></div></div><ul class="chg-list">' +
        c.lines.filter(function (L) { return L.state !== 'ok' || L.b.fewerFrom || L.priceWas != null; }).map(function (L) {
          var t = L.state === 'sold_out' ? 'is sold out' : L.state === 'unavailable' ? 'is no longer on the website' : L.b.fewerFrom ? 'has only ' + L.available + ' left: changed to ' + L.b.qty : 'is now ' + rs(L.price) + ' (was ' + rs(L.priceWas) + ')';
          return '<li class="' + (L.state !== 'ok' ? 'bad' : '') + '">' + icon(L.state !== 'ok' ? 'alertc' : 'alert', 'sm') + '<span><b>' + esc(L.s.name) + '</b> (' + esc(L.s.sku) + ') ' + t + '</span></li>';
        }).join('') + '</ul><div class="acts"><button type="button" class="btn btn-primary" data-act="ov-x">OK, show my ' + W() + '</button></div>';
    }
    return '<div class="scrim" data-act="ov-x" aria-hidden="true"></div><div class="modal"><div class="modal-box' + (m.kind === 'wa' ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="md-h" tabindex="-1">' + inner + '</div></div>';
  }

  /* ---------- Render ---------- */
  var app, ov, lastFocusOv = null, lastOvHtml = '', lastOvKind = '';
  function render() {
    var r = parse();
    var key = r.path + '?' + (r.state || '');
    if (key !== lastKey) {
      lastKey = key;
      if (r.state && r.state.charAt(0) !== '@') setup(r); else { resetFlags(); drawer = null; modal = null; menuOpen = false; }
      window.scrollTo(0, 0);
    }
    var name = r.path === '/bag' ? 'bag' : r.path === '/sign-in' ? 'sign-in' : r.path === '/checkout' ? 'checkout' : r.path.indexOf('/order/') === 0 ? 'order' : ['/shipping', '/refunds', '/contact'].indexOf(r.path) >= 0 ? r.path.slice(1) : r.slug ? 'product' : 'shop';
    var page = PAGES[name](r);
    document.title = page.title + ' · Nandam Handlooms (W6 mock-up)';
    var y = window.scrollY;
    app.innerHTML = (F.offline ? '<div class="net-banner" role="status">' + icon('wifioff') + 'You are offline. Your ' + W() + ' is kept on this phone; we\'ll check it when you\'re back. <span class="mock-tag">Sample</span></div>' : '') +
      header() + '<main id="main" tabindex="-1">' + page.html + '</main>' + footer() +
      (page.fab === false ? '' : '<a class="wa-fab" href="#' + MOCK_WA + '" data-act="wa-mock" aria-label="Message Nandam Handlooms on WhatsApp">' + icon('whatsapp') + '</a>');
    window.scrollTo(0, y);
    var hadOverlay = ov.innerHTML !== '';
    var kind = menuOpen ? 'menu' : modal ? 'modal:' + modal.kind : drawer ? 'drawer' : '';
    var html = menuOpen ? fullMenu() : modal ? modalHtml() : drawer ? drawerHtml() : '';
    if (html !== lastOvHtml) { ov.innerHTML = html; ov.classList.toggle('stay', !!kind && kind === lastOvKind); lastOvHtml = html; }
    lastOvKind = kind;
    shown = shownNext; shownNext = {};
    document.body.style.overflow = ov.innerHTML ? 'hidden' : '';
    if (ov.innerHTML && !hadOverlay) {
      lastFocusOv = document.activeElement;
      var f = ov.querySelector('.drawer, .modal-box, .fullmenu nav a');
      if (f) f.focus({ preventScroll: true });
    }
    if (!ov.innerHTML && hadOverlay && lastFocusOv && document.contains(lastFocusOv)) lastFocusOv.focus({ preventScroll: true });
    O.setStates(page.states, r.state, function (st) {
      if (st === '@sold') return go('#/product/350k-butta-saree-3');
      if (st === '@set') return go('#/product/150-50-plain-saree-7');
      if (st === '@single') return go('#/product/pure-pattu-350k-butta-saree-34');
      if (st === 'setall' && !bySlug[r.slug].available) return;
      lastKey = null; go('#' + r.path + '?state=' + st);
    });
    buybar();
  }
  function buybar() {
    if (!app) return;
    var bar = app.querySelector('[data-buybar]'); var row = app.querySelector('.buy-row');
    if (bar && row) bar.classList.toggle('on', row.getBoundingClientRect().bottom < 0);
  }

  function closeOverlay() { drawer = null; modal = null; menuOpen = false; render(); }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t || !app) return;
    var act = t.getAttribute('data-act'), slug = t.getAttribute('data-slug');
    if (act === 'co-signin-inline') { who = PRIYA; keep(K.who, who); CO.inline = true; render(); return; }
    if (act === 'co-add-new') { CO.form = { mode: 'new' }; render(); var f1 = document.getElementById('af-1'); if (f1) f1.focus(); return; }
    if (act === 'co-cancel-form') { CO.form = null; render(); return; }
    if (act === 'co-save-addr') {
      var l1 = (document.getElementById('af-1') || {}).value || '', stv = (document.getElementById('af-s') || {}).value || '';
      if (l1.trim().length < 3) { toast('Enter the house, flat or building.', { tone: 'bad' }); var e1 = document.getElementById('af-1'); if (e1) e1.focus(); return; }
      if (!stv) { toast('Choose the state.', { tone: 'bad' }); var es = document.getElementById('af-s'); if (es) es.focus(); return; }
      var na = { id: CO.form.mode === 'fix' ? 'a3' : 'n' + Date.now(), label: CO.form.mode === 'fix' ? 'Other' : 'Home', fullName: (document.getElementById('af-n') || {}).value || 'Priya Sharma', mobile: (document.getElementById('af-m') || {}).value || '98765 43210', line1: l1.trim(), line2: ((document.getElementById('af-2') || {}).value || '').trim(), landmark: ((document.getElementById('af-l') || {}).value || '').trim(), city: 'Mangalagiri', state: stv, pincode: (document.getElementById('af-p') || {}).value || '522503', isDefault: !CO.addrs.length };
      CO.addrs = CO.addrs.filter(function (x) { return x.id !== na.id; }).concat([na]); CO.sel = na.id; CO.form = null; CO.step = 'review';
      toast(CO.addrs.length === 1 ? 'Address saved' : 'Address saved. Delivering here.'); render(); return;
    }
    if (act === 'co-deliver') { var sa = selAddr(); if (sa && sa.bad) { CO.form = { mode: 'fix' }; } else { CO.step = 'review'; } render(); return; }
    if (act === 'co-change-addr') { CO.step = 'address'; render(); return; }
    if (act === 'co-to-pay') { CO.step = 'pay'; render(); return; }
    if (act === 'co-pay') { if (t.disabled) return; startPay(); return; }
    if (act === 'rzp-tab') { CO.rzpTab = t.getAttribute('data-v'); render(); return; }
    if (act === 'rzp-success') { modal = { kind: 'confirming' }; render(); setTimeout(function () { modal = null; paid(); }, 1200); return; }
    if (act === 'rzp-fail') { CO.rzpFailed = true; render(); return; }
    if (act === 'rzp-slow') { modal = null; var so = CO.order || makeOrder(); ORDERS[so.number] = so; lastKey = null; go('#/order/' + so.number + '?state=bankslow'); return; }
    if (act === 'rzp-close') { CO.notice = CO.rzpFailed ? 'failed' : 'closed'; modal = null; render(); return; }
    if (act === 'co-change-bag') { CO.order = null; CO.notice = null; go('#/bag'); toast('Your sarees were released. Change your bag, then check out again.', { tone: 'info' }); return; }
    if (act === 'co-check-again') { CO.order = null; CO.notice = null; render(); toast('Your bag was checked again: everything is still here.'); return; }
    if (act === 'co-copy-link') { toast('Link copied. Paste it in Chrome or Safari.'); return; }
    if (act === 'ord-check') { toast('Still confirming with your bank. We\'ll update you here.', { tone: 'info' }); return; }
    if (act === 'skip') { e.preventDefault(); var m = document.getElementById('main'); if (m) m.focus(); return; }
    if (act === 'wa-mock') { e.preventDefault(); toast('Mock-up: WhatsApp doesn\'t open here. On the website this opens a chat with the shop.', { tone: 'info' }); return; }
    if (act === 'add') {
      if (t.disabled) return;
      var want = PSTATE.want[slug] || 1;
      t.classList.add('is-loading'); t.setAttribute('aria-busy', 'true');
      setTimeout(function () { PSTATE.want[slug] = 1; addToBag(slug, want); }, 420);
      return;
    }
    if (act === 'open-bag') { e.preventDefault(); clearToasts(); if (O.get('after') === 'c') { drawer = null; go('#/bag'); } else { drawer = { added: null }; modal = null; render(); } return; }
    if (act === 'ov-x') { var href = t.getAttribute('href'); closeOverlay(); if (href) { e.preventDefault(); go(href); } return; }
    if (act === 'remove') { var el = t.closest('.bline'); if (el) el.classList.add('leaving'); setTimeout(function () { removeLine(slug); }, 220); return; }
    if (act === 'undo') { undo(); return; }
    if (act === 'toast-x') { var d = t.closest('.toast'); if (d) d.remove(); return; }
    if (act === 'qty-dec' || act === 'qty-inc' || act === 'qty-set') {
      var where = t.getAttribute('data-where');
      var cur = where === 'pdp' ? (PSTATE.want[slug] || 1) : find(slug).qty;
      var v = act === 'qty-set' ? Number(t.getAttribute('data-v')) : cur + (act === 'qty-inc' ? 1 : -1);
      if (where === 'pdp') { PSTATE.want[slug] = Math.max(1, v); render(); } else setQty(slug, v);
      var again = app.querySelector('[data-act="' + act + '"][data-slug="' + slug + '"][data-where="' + where + '"]' + (act === 'qty-set' ? '[data-v="' + v + '"]' : ''));
      if (again && !again.disabled) again.focus({ preventScroll: true });
      return;
    }
    if (act === 'wa') { if (t.disabled) return; drawer = null; modal = { kind: 'wa' }; render(); return; }
    if (act === 'wa-open') { modal.noted = true; F.sent = true; render(); return; }
    if (act === 'wa-copy') {
      var text = waText();
      var done = function (ok) { toast(ok ? 'Message copied' : 'Couldn\'t copy. Select the text instead.', { tone: ok ? 'ok' : 'bad' }); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); }); else done(false);
      return;
    }
    if (act === 'clear-ask') { modal = { kind: 'clear' }; render(); return; }
    if (act === 'clear') { bag = []; saveBag(); F.sent = false; modal = null; toast('Your ' + W() + ' is empty now'); render(); return; }
    if (act === 'sent-x') { F.sent = false; render(); return; }
    if (act === 'retry') { F.error = false; F.loading = true; render(); setTimeout(function () { F.loading = false; render(); toast('Your ' + W() + ' is up to date'); }, 900); return; }
    if (act === 'checkout') { drawer = null; go('#/checkout'); return; }
    if (act === 'signin') {
      who = PRIYA; keep(K.who, who);
      var acct = load(K.acct, null) || ACCOUNT_SAMPLE.map(function (x) { return line(x[0], x[1]); });
      resetFlags(); joinAccount(acct); saveBag();
      if (parse().next === 'checkout') { F.notice = null; lastKey = '/checkout?'; go('#/checkout'); } else { lastKey = '/bag?'; go('#/bag'); }
      return;
    }
    if (act === 'signout') {
      keep(K.acct, bag); who = null; keep(K.who, null); bag = []; saveBag();
      resetFlags(); F.notice = { tone: 'info', icon: 'logout', title: 'You signed out, so your ' + W() + ' was removed from this browser', text: 'It is saved in your account. Sign in again to see it.', action: ['#/sign-in', 'Sign in'] };
      lastKey = '/bag?'; go('#/bag');
      return;
    }
    if (act === 'menu') { menuOpen = true; render(); return; }
    if (act === 'menu-x') { closeOverlay(); return; }
    if (act === 'menu-go') { menuOpen = false; document.body.style.overflow = ''; if (t.getAttribute('href') === location.hash) { e.preventDefault(); render(); } return; }
    if (act === 'search') { toast('Search works as on the live website; it isn\'t part of this mock-up.', { tone: 'info' }); return; }
    if (act === 'theme') { O.set('theme', t.getAttribute('data-v')); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!app) return;
    if (t.getAttribute('data-change') === 'co-addr') { CO.sel = t.value; CO.form = null; render(); var back = app.querySelector('[data-change="co-addr"][value="' + t.value + '"], select[data-change="co-addr"]'); if (back) back.focus({ preventScroll: true }); return; }
    if (t.getAttribute('data-change') === 'qty') {
      var slug = t.getAttribute('data-slug'), v = Number(t.value);
      if (t.getAttribute('data-where') === 'pdp') { PSTATE.want[slug] = v; render(); } else setQty(slug, v);
      var again = app.querySelector('select[data-slug="' + slug + '"][data-where="' + t.getAttribute('data-where') + '"]'); if (again) again.focus({ preventScroll: true });
    }
  });
  document.addEventListener('keydown', function (e) {
    if (!app) return;
    if (e.key === 'Escape' && ov && ov.innerHTML) { e.preventDefault(); closeOverlay(); return; }
    if (e.key === 'Tab' && ov && ov.innerHTML) {
      var items = Array.prototype.slice.call(ov.querySelectorAll('a[href], button:not([disabled]), select, [tabindex]:not([tabindex="-1"])')).filter(function (n) { return n.offsetParent !== null; });
      if (!items.length) return;
      var a = items[0], z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      else if (!ov.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
    }
  });
  window.addEventListener('scroll', buybar, { passive: true });
  window.addEventListener('hashchange', function () { if (!app) return; if (location.hash === '#' + MOCK_WA) { history.replaceState(null, '', location.pathname + '#/shop'); return; } drawer = null; modal = null; menuOpen = false; clearToasts(); render(); });
  // Another tab changed the bag: show it here at once (rule 12).
  window.addEventListener('storage', function (e) { if (app && (e.key === K.bag || e.key === K.who)) { bag = load(K.bag, []); who = load(K.who, null); render(); } });
  document.addEventListener('w5opts', function () { if (app) render(); });
  // For the design kit: the same parts, drawn without the website around them.
  setInterval(tickCountdowns, 1000);
  window.W6Parts = { addrBlock: function (a) { return addrBlock(a); }, ADDRS0: ADDRS0, OLD_ADDR: OLD_ADDR, orderLines: function (o) { return orderLines(o); }, sampleOrder: function (n) { return sampleOrder(n); } };
  window.W5Parts = { icon: icon, rs: rs, pcs: pcs, esc: esc, line: line, lineHtml: lineHtml, qtyControl: qtyControl, bySlug: bySlug, card: card, bagLink: bagLink };

  function start() {
    if (!document.getElementById('app')) return;
    app = document.getElementById('app');
    ov = document.createElement('div'); ov.id = 'ov'; document.body.appendChild(ov);
    toastsEl = document.createElement('div'); toastsEl.className = 'toasts'; toastsEl.setAttribute('aria-live', 'polite'); document.body.appendChild(toastsEl);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
