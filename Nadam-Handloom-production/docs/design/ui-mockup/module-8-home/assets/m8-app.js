/* Module 8 (Home): the clickable app.
   Designs, prices and photos are real (copy of 11 Oct 2026); the day's sales and
   amounts are sample. The pretend data follows the plan's rules: which sales count,
   staff without money totals, Needs attention lines only when there is something,
   running low for owners, the monthly reminder from the 1st to the 7th. */
(function () {
  'use strict';
  var NH = window.NH;
  var EMBED = /[?&]embed=1/.test(location.search);
  var DEMO_KEY = 'nh-m8-demo';
  var HIDE_KEY = 'nh-m8-hide';

  /* ================= Sample data ================= */
  var SUBS = {}, CATS = {};
  window.NH_CATALOG.categories.forEach(function (c) { c.subs.forEach(function (s) { SUBS[s.id] = s; CATS[s.id] = c.name; }); });
  var POOL = window.NH_PRODUCTS.filter(function (p) { return p.img && p.sub !== 'b6b360c9'; });
  function pic(k) { return POOL[(k * 13) % POOL.length].img; }

  function freshDemo() {
    return {
      sales: [
        { id: 's0', time: '12:40 pm', ch: 'store', pay: 'cash', by: 'Lakshmi', sarees: 2, total: 6800, img: pic(1), cancelled: true },
        { id: 's1', time: '1:20 pm', ch: 'store', pay: 'cash', by: 'Lakshmi', sarees: 3, total: 18900, img: pic(2), inv: 'INV-000019' },
        { id: 's2', time: '3:05 pm', ch: 'store', pay: 'upi', by: 'Ravi', sarees: 2, total: 9850, img: pic(3), invPending: true },
        { id: 's3', time: '5:10 pm', ch: 'online', pay: 'online', by: null, cust: 'Harika Reddy', sarees: 1, total: 4500, img: pic(4), inv: 'INV-000020' },
        { id: 's4', time: '6:40 pm', ch: 'whatsapp', pay: 'upi', by: 'Ravi', sarees: 2, total: 7200, img: pic(5), inv: 'INV-000021' },
        { id: 's5', time: '7:55 pm', ch: 'store', pay: 'card', by: 'Lakshmi', sarees: 2, total: 11400, img: pic(6) }
      ],
      yesterday: { amount: 16000, bills: 5 },
      monthBefore: 223088,
      toShip: { count: 3, oldestDays: 2 },
      check: { count: 1, shipped: '29 Sep' },
      unpaid: { customers: 4, tries: 18 },
      stock: { inStock: 1436, limit: 5000 },
      noPhoto: 6,
      phone: { bill: 3, uploads: 2 },
      summarySeen: false,
      updated: 'just now',
      extra: 0
    };
  }
  // Running low: the real designs from the copy of 11 Oct (5 sold out, 2 with 1–3 left).
  var SOLD_OUT = [['c3bd8c1e', '10 Oct'], ['a5423792', '9 Oct'], ['0a909c2c', '8 Oct'], ['ea99a4ac', '7 Oct'], ['9f39ef94', '5 Oct']];
  var LOW = [['93e8d1e6', 2, 3], ['bd8448ec', 1, 1]];

  var demo = load();
  function load() { try { var d = JSON.parse(sessionStorage.getItem(DEMO_KEY)); if (d && d.sales) return d; } catch (e) { } return freshDemo(); }
  function save() { try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch (e) { } }
  function hidden() { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch (e) { return false; } }
  function setHidden(v) { try { localStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch (e) { } }

  function flags() { return NH.flags(); }
  function offline() { return !!flags().offline; }
  function owner() { return flags().viewAs !== 'staff'; }
  function me() { return owner() ? 'Lakshmi' : 'Ravi'; }

  /* ================= Rules ================= */
  var INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  function rs(v) { return '₹' + INR.format(v); }
  function money(v) { return hidden() ? '₹ ••••' : rs(v); }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function counted() { return demo.sales.filter(function (s) { return !s.cancelled; }); }
  function mine() { return counted().filter(function (s) { return s.by === 'Ravi'; }); }
  function sum(list) { return list.reduce(function (t, s) { return t + s.total; }, 0); }
  function today() {
    var live = counted();
    function ch(c) { var l = live.filter(function (s) { return s.ch === c; }); return { amount: sum(l), bills: l.length }; }
    return { amount: sum(live), bills: live.length, sarees: live.reduce(function (t, s) { return t + s.sarees; }, 0), store: ch('store'), whatsapp: ch('whatsapp'), online: ch('online') };
  }
  function dateInfo() {
    if (current.params.demo === 'month') return { label: 'Tue 3 Nov', month: 'November', last: 'October', reminder: true, monthBefore: 34900 };
    return { label: 'Mon 12 Oct', month: 'October', last: 'September', reminder: false, monthBefore: demo.monthBefore };
  }
  function greeting() { return 'Good evening'; }

  // The Needs attention lines, in order of urgency. Each only when there is something.
  function attention() {
    var d = demo, list = [], caught = current.params.demo === 'caught';
    if (caught) return list;
    var o = owner(), di = dateInfo();
    if (d.phone.bill) list.push({ key: 'bill', icon: 'receipt', tone: 'accent', title: 'Your bill has ' + plural(d.phone.bill, 'saree') + ', not finished', sub: 'On this phone · tap to finish it', toast: 'Opens your bill (Module 5)' });
    if (d.toShip.count) list.push({ key: 'toship', icon: 'truck', tone: d.toShip.oldestDays >= 1 ? 'warning' : 'primary', title: plural(d.toShip.count, 'order') + ' to ship', sub: d.toShip.oldestDays >= 1 ? 'Oldest waiting ' + plural(d.toShip.oldestDays, 'day') : 'All from today', warn: d.toShip.oldestDays >= 1, toast: 'Opens Orders · To ship (Module 7)', n: d.toShip.count });
    if (!o) list.push({ key: 'invoice', icon: 'receipt', tone: 'danger', title: 'Invoice not made', sub: 'Your 3:05 pm sale asked for one · tap to make it', toast: 'Opens the sale, with "Make the invoice" (Module 5)' });
    if (o && d.unpaid.customers) list.push({ key: 'unpaid', icon: 'clock', tone: 'info', title: plural(d.unpaid.customers, 'customer') + ' didn\'t finish paying', sub: 'This week on the website · ' + d.unpaid.tries + ' tries · call them back', toast: 'Opens Unpaid checkouts (Module 7)', n: d.unpaid.customers });
    if (d.check.count) list.push({ key: 'check', icon: 'packagecheck', tone: 'primary', title: plural(d.check.count, 'parcel') + ' to check', sub: 'Shipped ' + d.check.shipped + ', not marked delivered', toast: 'Opens Orders · Shipped (Module 7)', n: d.check.count });
    if (d.phone.uploads) list.push({ key: 'uploads', icon: 'upload', tone: 'primary', title: plural(d.phone.uploads, 'saree') + ' not uploaded yet', sub: 'On this phone · they upload when the internet is back', toast: 'Opens the upload list (Module 4)' });
    if (o && di.reminder && !d.summarySeen) list.push({ key: 'month', icon: 'calendar', tone: 'accent', title: 'Send ' + di.last + '\'s sales summary', sub: 'For your accountant (GST) · PDF or Excel', toast: 'Opens the sales summary for ' + di.last + ' (Module 6)' });
    if (o) list.push({ key: 'stock', icon: 'layers', tone: 'warning', title: SOLD_OUT.length + ' designs sold out, ' + LOW.length + ' running low', sub: 'What to order from the weavers', go: 'low', n: SOLD_OUT.length + LOW.length });
    if (d.noPhoto) list.push({ key: 'nophoto', icon: 'image', tone: 'primary', title: plural(d.noPhoto, 'saree') + ' without a photo', sub: 'The website shows a blank for them', toast: 'Opens Products · No photo (Module 4)' });
    return list;
  }

  /* ================= Helpers ================= */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(n, c) { return NH.icon(n, c); }
  function pthumb(img) { return '<span class="pthumb">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : icon('image')) + '</span>'; }
  function alertBox(type, title, text, ic, extra) {
    var map = { info: 'info', success: 'check', warning: 'alert', error: 'alertc' };
    return '<div class="alert alert-' + type + '" role="' + (type === 'error' ? 'alert' : 'status') + '">' + icon(ic || map[type]) + '<div>' + (title ? '<strong>' + title + '</strong>' : '') + (text ? '<p>' + text + '</p>' : '') + (extra || '') + '</div></div>';
  }
  function topBar(title, back, right) { return '<div class="scr-top">' + (back ? '<button class="icon-btn" type="button" data-go="' + back + '" aria-label="Back">' + icon('back') + '</button>' : '<span style="width:12px"></span>') + '<h1>' + (title || '') + '</h1>' + (right || '') + '</div>'; }
  function emptyCard(ic, title, text) { return '<div class="ph-tile" style="min-height:130px;align-items:center;justify-content:center;text-align:center;gap:.4rem">' + icon(ic, 'icon-xl') + '<b>' + title + '</b><span>' + text + '</span></div>'; }
  var CH = { store: 'Counter', whatsapp: 'WhatsApp', online: 'Online' };
  var PAY = { cash: 'Cash', upi: 'UPI', card: 'Card', online: 'Paid online' };
  function chBadge(ch) { return ch === 'store' ? '' : '<span class="badge badge-' + (ch === 'whatsapp' ? 'success' : 'info') + '">' + CH[ch] + '</span>'; }

  /* ================= Overlays ================= */
  var overlays, root, viewport;
  function addOverlay(html) { var d = document.createElement('div'); d.innerHTML = html; var el = d.firstElementChild; overlays.appendChild(el); return el; }
  function toast(msg, ok) {
    var old = overlays.querySelector('.app-toast'); if (old) old.remove();
    var t = addOverlay('<div class="app-toast' + (ok ? ' ok' : '') + '" role="status">' + icon(ok ? 'check' : 'info') + esc(msg) + '</div>');
    setTimeout(function () { t.remove(); }, 2800);
  }

  /* ================= Router ================= */
  var current = { name: '', params: {} }, state = 'normal', timers = [], stack = [];
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), q = h.split('?'), p = {};
    (q[1] || '').split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); p[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
    return { name: q[0] || 'home', params: p };
  }
  function go(route) { if (('#/' + route) === location.hash) render(); else location.hash = '#/' + route; }
  function after(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function onRoute() {
    var r = parse(), h = location.hash;
    if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop(); else if (stack[stack.length - 1] !== h) stack.push(h);
    if (r.name !== current.name || JSON.stringify(r.params) !== JSON.stringify(current.params)) state = 'normal';
    current = r;
    var want = r.params.as === 'staff' ? 'staff' : (r.params.as === 'owner' ? 'owner' : null);
    if (want && flags().viewAs !== want) NH.setFlag('viewAs', want, true);
    if (r.params.hide === '1' && !hidden()) setHidden(true);
    if (r.params.demo === 'offline' && !offline()) NH.setFlag('offline', true, true);
    if (r.params.demo === 'month') demo.summarySeen = false;
    var detail = { name: r.name, params: Object.assign({}, r.params) };
    render();
    document.dispatchEvent(new CustomEvent('nh:route', { detail: detail }));
  }

  /* ================= Shell ================= */
  var TABS = [['home', 'home', 'Home'], ['orders', 'orders', 'Orders'], ['scan', 'scan', 'Scan'], ['products', 'box', 'Products'], ['more', 'more', 'More']];
  function shell(inner) {
    var waiting = demo.toShip.count;
    var tabs = TABS.map(function (t) {
      var cur = t[0] === 'home' ? ' aria-current="page"' : '';
      if (t[0] === 'scan') return '<button type="button" class="scan-tab" data-tab="scan" aria-label="Scan"><span class="scan-ico">' + icon('scan') + '</span></button>';
      return '<button type="button" data-tab="' + t[0] + '"' + cur + '>' + (t[0] === 'orders' && waiting ? '<span class="tab-count" aria-label="' + waiting + ' to ship">' + waiting + '</span>' : '') + icon(t[1]) + t[2] + '</button>';
    }).join('');
    var rail = '<nav class="rail" aria-label="Main menu"><img src="assets/logo.png" alt="Nandam Handlooms">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '"' + (t[0] === 'home' ? ' aria-current="page"' : '') + '>' + icon(t[1]) + t[2] + '</button>'; }).join('') + '</nav>';
    var bar = offline() ? '<div class="saved-bar">' + icon('wifioff') + 'Offline · selling and changes need internet.</div>' : '';
    return '<div class="shell">' + rail + '<div class="shell-main">' + bar + inner + '</div><nav class="tabbar" aria-label="Main menu">' + tabs + '</nav></div>';
  }

  /* ================= Home pieces ================= */
  function head() {
    var di = dateInfo(), o = owner();
    var eye = o ? '<button class="icon-btn eye-btn" type="button" data-eye aria-pressed="' + hidden() + '" aria-label="' + (hidden() ? 'Show amounts' : 'Hide amounts') + '">' + icon(hidden() ? 'eyeoff' : 'eye') + '</button>' : '';
    var upd = offline() ? '<span class="upd warn">Updated 7:52 pm</span>' : '<span class="upd">Updated ' + demo.updated + '</span>';
    return '<div class="home-head"><span class="avatar">' + (o ? 'LD' : 'RK') + '</span><div style="flex:1;min-width:0"><h1>' + greeting() + ', ' + me() + '</h1><p>' + di.label + ' · ' + upd + '</p></div>' + eye + '</div>';
  }
  function salesCard() {
    var t = today(), di = dateInfo(), b = NH.opts.card === 'b';
    if (state === 'empty') t = { amount: 0, bills: 0, sarees: 0, store: { amount: 0, bills: 0 }, whatsapp: { amount: 0, bills: 0 }, online: { amount: 0, bills: 0 } };
    var monthSoFar = di.monthBefore + t.amount;
    var foot = '<div class="sc-foot">Yesterday ' + money(demo.yesterday.amount) + ' · ' + di.month + ' so far ' + money(monthSoFar) + '</div>';
    var chans = ['store', 'whatsapp', 'online'];
    var inner;
    if (!t.bills) inner = '<div class="sc-none">No sales yet today</div>';
    else if (b) {
      inner = '<div class="sc-chips">' + chans.map(function (c) { return '<span class="sc-chip c-' + c + '"><small>' + CH[c] + '</small><b>' + money(t[c].amount) + '</b><small>' + plural(t[c].bills, 'bill') + '</small></span>'; }).join('') + '</div>';
    } else {
      inner = '<div class="sc-bar" aria-hidden="true">' + chans.map(function (c) { return t[c].amount ? '<span class="c-' + c + '" style="flex:' + t[c].amount + '"></span>' : ''; }).join('') + '</div>' +
        '<div class="sc-legend">' + chans.map(function (c) { return '<span><i class="dot c-' + c + '"></i>' + CH[c] + ' <b>' + money(t[c].amount) + '</b></span>'; }).join('') + '</div>';
    }
    return '<button type="button" class="sales-card" data-go="today" aria-label="Today\'s sales, open the list"><div class="sc-top"><span class="sc-label">Today\'s sales</span><span class="sc-meta">' + plural(t.bills, 'bill') + ' · ' + plural(t.sarees, 'saree') + '</span></div>' +
      '<div class="sc-total">' + money(t.amount) + '</div>' + inner + foot + '</button>';
  }
  function staffCard() {
    var m = state === 'empty' ? [] : mine();
    var sarees = m.reduce(function (t, s) { return t + s.sarees; }, 0);
    return '<button type="button" class="sales-card" data-go="today" aria-label="Your sales today, open the list"><div class="sc-top"><span class="sc-label">Your sales today</span><span class="sc-meta">' + icon('lock', 'icon-sm') + 'No money totals</span></div>' +
      (m.length ? '<div class="sc-total">' + plural(sarees, 'saree') + ' <small>sold · ' + plural(m.length, 'bill') + '</small></div>' : '<div class="sc-none">No sales yet today</div>') + '<div class="sc-foot">Owners see the shop\'s totals.</div></button>';
  }
  function attRow(a) {
    return '<button type="button" class="row att-row" data-att="' + a.key + '"><span class="tile t-' + a.tone + '">' + icon(a.icon) + '</span><span class="grow"><b>' + a.title + '</b><span class="' + (a.warn ? 'wait-warn' : '') + '">' + a.sub + '</span></span>' + icon('right', 'chev') + '</button>';
  }
  function attentionBlock(list) {
    if (!list.length) return '<div class="caught">' + icon('check') + '<div><b>All caught up</b><span>Nothing waiting. New orders and anything unfinished show here.</span></div></div>';
    return '<div class="list">' + list.map(attRow).join('') + '</div>';
  }
  function tiles(list) {
    var o = owner(), by = {};
    list.forEach(function (a) { by[a.key] = a; });
    var T = [['toship', 'truck', 'To ship', 'orders']];
    if (o) T.push(['unpaid', 'clock', 'Unpaid', 'customers']);
    T.push(['check', 'packagecheck', 'To check', 'parcels']);
    if (o) T.push(['stock', 'layers', 'Running low', 'designs']);
    var h = '<div class="tile-grid">' + T.map(function (x) {
      var a = by[x[0]], n = a ? a.n : 0;
      return '<button type="button" class="ntile' + (n ? '' : ' zero') + (a && a.warn ? ' warn' : '') + '" data-att="' + x[0] + '"' + (n ? '' : ' disabled') + '><span class="nt-top">' + icon(x[1]) + x[2] + '</span><b>' + (n || '0') + '</b><small>' + (n ? (a.warn ? a.sub : x[3]) : 'None') + '</small></button>';
    }).join('') + '</div>';
    var rest = list.filter(function (a) { return ['toship', 'unpaid', 'check', 'stock'].indexOf(a.key) < 0; });
    if (rest.length) h += '<div class="list-title">Also</div><div class="list">' + rest.map(attRow).join('') + '</div>';
    else if (!list.length) h += '<div class="caught" style="margin-top:.8rem">' + icon('check') + '<div><b>All caught up</b><span>Nothing waiting.</span></div></div>';
    return h;
  }
  function shortcuts() {
    var S = [['sell', 'scan', 'Sell'], ['price', 'tag', 'Price check'], ['add', 'plus', 'Add sarees'], ['today', 'receipt', 'Today\'s sales']];
    return '<div class="shortcuts">' + S.map(function (s) { return '<button type="button" data-short="' + s[0] + '"><span>' + icon(s[1]) + '</span>' + s[2] + '</button>'; }).join('') + '</div>';
  }
  function recent() {
    var list = (owner() ? counted() : mine()).slice().reverse().slice(0, 3);
    if (state === 'empty') list = [];
    var h = '<div class="list-title row-title"><span>' + (owner() ? 'Recent sales' : 'Your recent sales') + '</span>' + (list.length ? '<button type="button" class="link-btn" data-go="today">See all</button>' : '') + '</div>';
    if (!list.length) return h + emptyCard('history', 'No sales yet today', owner() ? 'Sales from every phone show here.' : 'Your sales show here.');
    return h + '<div class="list">' + list.map(function (s) {
      return '<button type="button" class="row" data-sale="' + s.id + '">' + pthumb(s.img) + '<span class="grow"><b>' + s.time + ' · ' + plural(s.sarees, 'saree') + ' ' + chBadge(s.ch) + '</b><span>' + (s.ch === 'online' ? esc(s.cust) + ' · paid online' : PAY[s.pay] + (owner() ? ' · ' + s.by : '')) + '</span></span><span class="amt">' + money(s.total) + '</span></button>';
    }).join('') + '</div>';
  }
  function skeleton() {
    return '<div class="skeleton" style="height:150px;border-radius:18px;margin-bottom:14px"></div><div class="list">' + [1, 2, 3].map(function () { return '<div class="skel-row"><div class="skeleton" style="width:40px;height:40px;border-radius:10px"></div><div style="flex:1"><div class="skeleton" style="height:14px;width:60%;margin-bottom:6px"></div><div class="skeleton" style="height:11px;width:40%"></div></div></div>'; }).join('') + '</div>';
  }

  /* ================= Screens ================= */
  var S = {};
  S.home = function () {
    var o = owner(), list = attention(), B = NH.opts.layout === 'b';
    if (state === 'loading') return { html: '<section class="scr"><div class="scr-body">' + head() + skeleton() + '</div></section>' };
    if (state === 'error') {
      return { html: '<section class="scr"><div class="scr-body">' + head() + alertBox('error', 'Couldn\'t load Home', 'Check the internet and try again. Selling still needs internet.', null, '<button type="button" class="btn btn-sm" data-retry style="margin-top:.5rem">' + icon('refresh', 'icon-sm') + 'Retry</button>') + '<div class="list-title">Shortcuts</div>' + shortcuts() + '</div></section>', mount: mountHome };
    }
    var card = o ? salesCard() : staffCard();
    var left, right;
    if (B) {
      left = card + '<div class="list-title">Needs attention</div>' + tiles(list);
      right = '<div class="list-title">Shortcuts</div>' + shortcuts() + recent();
    } else {
      left = card + '<div class="list-title">Needs attention</div>' + attentionBlock(list);
      right = '<div class="list-title">Shortcuts</div>' + shortcuts() + recent();
    }
    var foot = o ? '<p class="stock-foot">' + INR.format(demo.stock.inStock) + ' sarees in stock · limit ' + INR.format(demo.stock.limit) + '</p>' : '';
    return { html: '<section class="scr"><div class="scr-body">' + head() + '<div class="home-cols"><div>' + left + '</div><div>' + right + foot + '</div></div></div></section>', mount: mountHome };
  };
  function mountHome(el) {
    var eye = el.querySelector('[data-eye]');
    eye && eye.addEventListener('click', function () { setHidden(!hidden()); toast(hidden() ? 'Amounts hidden on this phone' : 'Amounts shown'); render(); });
    var r = el.querySelector('[data-retry]'); r && r.addEventListener('click', function () { state = 'normal'; render(); });
    el.querySelectorAll('[data-att]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = attention().filter(function (x) { return x.key === b.dataset.att; })[0]; if (!a) return;
        if (a.key === 'month') { demo.summarySeen = true; save(); toast(a.toast); return render(); }
        if (a.go) return go(a.go);
        toast(a.toast);
      });
    });
    el.querySelectorAll('[data-short]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.short;
        if (k === 'today') return go('today');
        toast({ sell: 'Opens Scan to sell (Module 5)', price: 'Opens Price check (Module 5)', add: 'Opens Add sarees (Module 4)' }[k]);
      });
    });
    el.querySelectorAll('[data-sale]').forEach(function (b) { b.addEventListener('click', function () { var s = demo.sales.filter(function (x) { return x.id === b.dataset.sale; })[0]; toast(s.ch === 'online' ? 'Opens the order in Orders (Module 7)' : 'Opens the sale (Module 5)'); }); });
  }

  S.low = function () {
    if (!owner()) return { html: '<section class="scr">' + topBar('Running low', 'home') + '<div class="scr-body narrow">' + emptyCard('lock', 'For owners', 'Stock running low is for owners.') + '</div></section>' };
    var empty = state === 'empty';
    function row(id, sub) { var s = SUBS[id]; return '<button type="button" class="row" data-design="' + id + '">' + pthumb(s.img) + '<span class="grow"><b>' + esc(s.name) + '</b><span>' + esc(CATS[id]) + '</span><span class="sub2">' + sub + '</span></span>' + icon('right', 'chev') + '</button>'; }
    return {
      html: '<section class="scr">' + topBar('Running low', 'home') + '<div class="scr-body narrow">' +
        '<p class="field-hint" style="margin:0 0 .4rem">Designs (subcategories) to order again. Tap one to see its sarees.</p>' +
        (empty ? emptyCard('check', 'Nothing running low', 'Every design with sarees has more than 3 left.') :
          '<div class="list-title">Sold out · last 30 days (' + SOLD_OUT.length + ')</div><div class="list">' + SOLD_OUT.map(function (x) { return row(x[0], '<span class="wait-warn">Sold out</span> · last sold ' + x[1] + ' · 1 sold in 30 days'); }).join('') + '</div>' +
          '<div class="list-title">Running low · 1–3 left (' + LOW.length + ')</div><div class="list">' + LOW.map(function (x) { return row(x[0], '<b class="left-n">' + x[1] + ' left</b> · ' + x[2] + ' sold in 30 days'); }).join('') + '</div>' +
          '<p class="field-hint" style="margin-top:.8rem">"Test1" (₹10, Fabrics) looks like a test design. Delete it in Catalogue if it is.</p>') +
        '</div></section>',
      mount: function (el) { el.querySelectorAll('[data-design]').forEach(function (b) { b.addEventListener('click', function () { toast('Opens ' + SUBS[b.dataset.design].name + ' in Products (Module 4)'); }); }); }
    };
  };

  S.today = function () {
    var o = owner(), list = (o ? demo.sales : demo.sales.filter(function (s) { return s.by === 'Ravi'; })).slice().reverse();
    var t = today(), live = counted();
    function pay(m) { return sum(live.filter(function (s) { return s.pay === m; })); }
    var top = o ? '<div class="today-card"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:.5rem"><div><small>' + plural(t.bills, 'sale') + ' today · ' + plural(t.sarees, 'saree') + '</small><b>' + rs(t.amount) + '</b></div><small>1 cancelled, not counted</small></div><span class="tc-pay">Cash ' + rs(pay('cash')) + ' · UPI ' + rs(pay('upi')) + ' · Card ' + rs(pay('card')) + ' · Online ' + rs(pay('online')) + '</span></div>'
      : alertBox('info', '', 'Your sales today. Owners see everyone\'s sales and the day\'s total.', 'lock');
    return {
      html: '<section class="scr">' + topBar('Today\'s sales', 'home', '<span class="top-act field-hint">12 Oct 2026</span>') + '<div class="scr-body narrow">' + top +
        '<div class="list" style="margin-top:.8rem">' + list.map(function (s) {
          return '<button type="button" class="row" data-sale="' + s.id + '">' + pthumb(s.img) + '<span class="grow"><b>' + s.time + ' · ' + plural(s.sarees, 'saree') + ' ' + chBadge(s.ch) + (s.cancelled ? ' <span class="badge badge-danger">Cancelled</span>' : '') + '</b><span>' + (s.ch === 'online' ? esc(s.cust) + ' · paid online · ' + s.inv : PAY[s.pay] + ' · ' + s.by + ' · ' + (s.inv || (s.invPending ? 'invoice not made' : 'no invoice'))) + '</span></span><span class="amt' + (s.cancelled ? ' struck' : '') + '">' + rs(s.total) + '</span></button>';
        }).join('') + '</div>' + (o ? '<p class="field-hint" style="margin-top:.6rem">New: today\'s paid online orders are listed too, so the total matches Home.</p>' : '') + '</div></section>',
      mount: function (el) { el.querySelectorAll('[data-sale]').forEach(function (b) { b.addEventListener('click', function () { var s = demo.sales.filter(function (x) { return x.id === b.dataset.sale; })[0]; toast(s.ch === 'online' ? 'Opens the order in Orders (Module 7)' : 'Opens the sale (Module 5)'); }); }); }
    };
  };

  /* ================= Render ================= */
  var FULL = { low: 1, today: 1 };
  function render() {
    timers.forEach(function (t) { clearTimeout(t); }); timers = [];
    Array.prototype.slice.call(overlays.children).forEach(function (c) { if (!c.classList.contains('app-toast')) c.remove(); });
    var name = current.name, fn = S[name] || S.home;
    var scr = fn(current.params || {});
    viewport.innerHTML = FULL[name] ? scr.html : shell(scr.html);
    var el = viewport.querySelector('.scr') || viewport.firstElementChild;
    viewport.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.go); }); });
    viewport.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.tab === 'home') go('home'); else toast('This tab is another module'); }); });
    scr.mount && scr.mount(el);
    var spec = window.NH_SCREENS.filter(function (s) { return NH_ROUTE(s).split('?')[0] === name; });
    if (state !== 'normal' && spec.length && !spec.some(function (s) { return s.states.indexOf(state) >= 0; })) NH.toast('"' + state + '" isn\'t a state of this screen. Try: ' + (spec.map(function (s) { return s.states.join(', '); }).filter(Boolean).join(', ') || 'none'));
  }

  // "A sale on another phone": Home picks it up at the next minute's update (6.10).
  function pretendSale() {
    if (current.name !== 'home') go('home');
    if (offline()) return toast('Offline: Home updates when the internet is back');
    toast('A sale was made on Ravi\'s phone. Home updates within a minute…');
    after(function () {
      demo.extra += 1;
      demo.sales.push({ id: 'x' + demo.extra, time: '8:' + (10 + demo.extra * 5) + ' pm', ch: 'store', pay: 'cash', by: 'Ravi', sarees: 1, total: 3400, img: pic(7 + demo.extra) });
      demo.updated = 'just now'; save(); render(); toast('Home updated', true);
    }, 1600);
  }

  window.NHApp = {
    setState: function (s) { state = s; render(); },
    go: go,
    action: function (name) {
      if (name === 'reset') { demo = freshDemo(); save(); setHidden(false); state = 'normal'; go('home'); }
      if (name === 'sale') pretendSale();
    }
  };

  function boot() {
    root = document.getElementById('app-root'); viewport = document.getElementById('app'); overlays = document.getElementById('app-overlays');
    if (EMBED) { document.body.className = 'embed'; document.body.innerHTML = ''; document.body.appendChild(root); }
    function syncPlatform() { var f = flags(); root.dataset.platform = f.platform; var dev = document.getElementById('device'); if (dev) dev.classList.toggle('is-android', f.platform === 'android'); }
    syncPlatform();
    var size = '';
    function measure() { var s = root.clientWidth >= 700 ? 'tablet' : 'phone'; if (s !== size) { size = s; root.dataset.size = s; if (current.name) render(); } }
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(root); else window.addEventListener('resize', measure);
    measure();
    document.addEventListener('nh:options', function () { if (current.name) render(); });
    document.addEventListener('nh:flags', function () { syncPlatform(); if (!current.name) return; render(); document.dispatchEvent(new CustomEvent('nh:route', { detail: { name: current.name, params: Object.assign({}, current.params) } })); });
    window.addEventListener('storage', function (e) { if (e.key === HIDE_KEY && current.name) render(); });
    window.addEventListener('hashchange', onRoute);
    onRoute();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
