/* Module 7 (Orders and shipping): the clickable app.
   Real sarees, tags, prices and photos (copy of 11 Oct 2026); orders, customers and
   tracking numbers are sample. A small pretend backend applies the plan's rules: To ship
   oldest first, a tracking number on one order only, owners cancel before shipping in
   the same month, mark delivered by hand, unpaid checkouts for owners. */
(function () {
  'use strict';
  var NH = window.NH;
  var EMBED = /[?&]embed=1/.test(location.search);
  var DEMO_KEY = 'nh-m7-demo';
  var TODAY = '2026-10-11';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SITE = 'https://nandamhandlooms.com'; // sample: the real address is a server setting
  var DTDC = 'https://www.dtdc.com/track-your-shipment/';

  /* ================= Sample orders ================= */
  var SUBS = {};
  window.NH_CATALOG.categories.forEach(function (c) { c.subs.forEach(function (s) { SUBS[s.id] = s; }); });
  var POOL = window.NH_PRODUCTS.filter(function (p) { return p.img && p.sub !== 'b6b360c9'; });

  function freshDemo() {
    var k = 0;
    function take(n, online, f) {
      var out = [];
      for (var i = 0; i < n; i++) {
        var p = POOL[(k++ * 13) % POOL.length], s = SUBS[p.sub];
        var price = online ? s.online : Math.round(s.store * (f || 0.7) / 50) * 50;
        out.push({ pid: p.id, code: p.tags[0][0], name: s.name, img: p.img, slug: p.sku.toLowerCase(), price: price });
      }
      return out;
    }
    function o(id, ch, d, t, cust, extra) {
      return Object.assign({ id: id, no: 'NH' + String(40718000 + id.slice(1) * 4127).slice(0, 8), ch: ch, d: d, t: t, cust: cust, status: 'to_ship', events: [] }, extra);
    }
    var orders = [
      o('o1', 'whatsapp', '2026-10-09', '4:20 pm', { name: 'Padma', mobile: '9123456780', address: 'Flat 3B, Sai Residency\nLakshmipuram 4th Lane\nGuntur 522007' }, { pay: 'upi', invoice: 'INV-000014', lines: take(2), by: 'Ravi' }),
      o('o2', 'whatsapp', TODAY, '11:05 am', { name: 'Anitha', mobile: '9848022338', address: '12-4 Main Road\nTenali 522201' }, { pay: 'cash', invoice: null, lines: take(1), by: 'Lakshmi' }),
      o('o3', 'online', '2026-10-10', '9:40 pm', { name: 'Kavya Sri', mobile: '9989012345', email: 'kavya.sri@example.com', address: 'D.No 12-4, Brodipet 4th Lane\nGuntur, Andhra Pradesh 522002' }, { pay: 'online', invoice: 'INV-000016', lines: take(1, true) }),
      o('o4', 'online', TODAY, '2:15 pm', { name: 'Harika Reddy', mobile: '9000011122', email: 'harika.r@example.com', address: '8-2-293, Road No. 12, Banjara Hills\nHyderabad, Telangana 500034' }, { pay: 'online', invoice: 'INV-000018', lines: take(2, true) }),
      o('o5', 'whatsapp', '2026-10-10', '1:30 pm', { name: 'Lalitha', mobile: '9701234567', address: '5-87 Temple Street\nMangalagiri 522503' }, { pay: 'upi', invoice: 'INV-000012', lines: take(1), by: 'Ravi', status: 'shipped', carrier: 'DTDC', awb: 'H1001830812', shippedAt: '2026-10-10', shippedBy: 'Ravi' }),
      o('o6', 'whatsapp', '2026-09-29', '6:10 pm', { name: 'Sravani', mobile: '9876543210', address: '2-14 Gandhi Nagar\nVijayawada 520003' }, { pay: 'card', invoice: 'INV-000006', lines: take(2), by: 'Lakshmi', status: 'shipped', carrier: 'DTDC', awb: 'H1001830791', shippedAt: '2026-09-29', shippedBy: 'Lakshmi' }),
      o('o7', 'online', '2026-10-07', '8:05 pm', { name: 'Meena Iyer', mobile: '9445566778', email: 'meena.iyer@example.com', address: '14 Second Cross, Indiranagar\nBengaluru, Karnataka 560038' }, { pay: 'online', invoice: 'INV-000009', lines: take(1, true), status: 'shipped', carrier: 'DTDC', awb: 'H1001830799', shippedAt: '2026-10-08', shippedBy: 'Ravi' }),
      o('o8', 'whatsapp', '2026-10-01', '12:40 pm', { name: 'Rajeswari', mobile: '9441122334', address: '3-9 Market Road\nNarasaraopet 522601' }, { pay: 'cash', invoice: 'INV-000003', lines: take(1), by: 'Ravi', status: 'delivered', carrier: 'DTDC', awb: 'H1001830775', shippedAt: '2026-10-01', shippedBy: 'Ravi', deliveredAt: '2026-10-04', deliveredBy: 'Lakshmi' }),
      o('o9', 'whatsapp', '2026-10-06', '3:00 pm', { name: 'Bhanu', mobile: '9555123456', address: '7 Station Road\nOngole 523001' }, { pay: 'upi', invoice: 'INV-000008', lines: take(1), by: 'Lakshmi', status: 'cancelled', cancelled: { reason: 'Customer changed their mind', by: 'Lakshmi', at: '6 Oct' } })
    ];
    orders.forEach(function (x) {
      x.events.push({ at: dd(x.d) + ', ' + x.t, text: x.ch === 'online' ? 'Ordered and paid on the website' : 'WhatsApp order made by ' + x.by });
      if (x.shippedAt) x.events.push({ at: dd(x.shippedAt), text: 'Shipped by ' + x.shippedBy + ' · DTDC ' + x.awb });
      if (x.deliveredAt) x.events.push({ at: dd(x.deliveredAt), text: 'Marked delivered by ' + x.deliveredBy });
      if (x.cancelled) x.events.push({ at: x.cancelled.at, text: 'Cancelled by ' + x.cancelled.by + ': ' + x.cancelled.reason });
    });
    // Unpaid website checkouts: 4 customers, 18 tries (like the live data on 9–10 Oct).
    var unpaid = [
      { id: 'u1', name: 'Bhavani K', mobile: '9700011223', tries: 7, last: '10 Oct, 9:12 pm', amount: 18900, lines: take(3, true) },
      { id: 'u2', name: 'Swathi', mobile: '9849912345', tries: 6, last: '10 Oct, 6:45 pm', amount: 8400, lines: take(2, true) },
      { id: 'u3', name: 'Ramya N', mobile: '9666123987', tries: 3, last: '9 Oct, 8:30 pm', amount: 5600, lines: take(1, true) },
      { id: 'u4', name: 'Divya', mobile: '9502233445', tries: 2, last: '9 Oct, 11:10 am', amount: 2800, lines: take(1, true) }
    ];
    return { orders: orders, unpaid: unpaid };
  }
  var demo = load();
  function load() { try { var d = JSON.parse(sessionStorage.getItem(DEMO_KEY)); if (d && d.orders) return d; } catch (e) { } return freshDemo(); }
  function save() { try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch (e) { } }

  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function flags() { return NH.flags(); }
  function offline() { return !!flags().offline; }
  function owner() { return flags().viewAs !== 'staff'; }
  function me() { return owner() ? 'Lakshmi' : 'Ravi'; }
  function byId(id) { return demo.orders.filter(function (x) { return x.id === id; })[0] || null; }

  /* ================= Rules ================= */
  var INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  function rs(v) { return '₹' + INR.format(v); }
  function dd(d) { var p = d.split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1]; }
  function daysSince(d) { return Math.round((Date.parse(TODAY) - Date.parse(d)) / 86400000); }
  function total(x) { return x.lines.reduce(function (t, l) { return t + l.price; }, 0); }
  function town(x) { var lines = x.cust.address.split('\n'); return lines[lines.length - 1].replace(/,?\s*(Andhra Pradesh|Telangana|Karnataka)?\s*\d{6}$/, '').replace(/,\s*$/, '').trim(); }
  function tidyAwb(v) { return String(v || '').toUpperCase().replace(/[\s-]/g, ''); }
  var AWB = /^[A-Z0-9]{8,20}$/;
  function awbOwner(awb, notId) { return demo.orders.filter(function (x) { return x.awb === awb && x.id !== notId && x.status !== 'cancelled'; })[0] || null; }
  function waiting(x) { var n = daysSince(x.d); return n >= 1 ? 'waiting ' + (n === 1 ? '1 day' : n + ' days') : 'today'; }
  function lists() {
    var live = demo.orders.filter(function (x) { return x.status !== 'cancelled'; });
    return {
      to_ship: live.filter(function (x) { return x.status === 'to_ship'; }).sort(function (a, b) { return (a.d + a.t).localeCompare(b.d + b.t); }),
      shipped: live.filter(function (x) { return x.status === 'shipped'; }).sort(function (a, b) { return b.shippedAt.localeCompare(a.shippedAt); }),
      delivered: live.filter(function (x) { return x.status === 'delivered'; }).sort(function (a, b) { return b.deliveredAt.localeCompare(a.deliveredAt); })
    };
  }
  function search(q) {
    var t = q.trim().toUpperCase().replace(/\s+/g, '');
    if (!t) return [];
    return demo.orders.filter(function (x) {
      return x.no.indexOf(t) >= 0 || (x.awb || '').indexOf(t) >= 0 || x.cust.name.toUpperCase().replace(/\s+/g, '').indexOf(t) >= 0 || (t.length >= 5 && /^\d+$/.test(t) && x.cust.mobile.indexOf(t) >= 0) || x.lines.some(function (l) { return l.code === t; });
    });
  }
  function message(x) {
    var links = x.lines.map(function (l) { return l.name + '\n' + SITE + '/product/' + l.slug; });
    return 'Hi ' + x.cust.name + ', your Nandam Handlooms order ' + x.no + ' has shipped via ' + x.carrier + '.\n\n' +
      (x.carrier === 'DTDC' ? 'Tracking ID (AWB): ' + x.awb + '\nTrack it here: ' + DTDC + '\n' : 'Tracking number: ' + x.awb + '\n') +
      '\nYour order:\n' + links.join('\n\n') + '\n\nThank you for shopping with us!';
  }

  /* ================= Pretend backend ================= */
  var DROP = function () { return new Promise(function () { }); };
  function net() { if (offline()) { var e = new Error('offline'); e.code = 'offline'; throw e; } }
  var api = {
    ship: function (x, carrier, awb) {
      var d0 = demo;
      return wait(800).then(function () {
        if (demo !== d0) return DROP(); net();
        var other = awbOwner(awb, x.id);
        if (other) return { error: 'AWB_TAKEN', other: other };
        if (x.status !== 'to_ship') return { error: 'ALREADY_SHIPPED' };
        x.status = 'shipped'; x.carrier = carrier; x.awb = awb; x.shippedAt = TODAY; x.shippedBy = me();
        x.events.push({ at: 'Today', text: 'Shipped by ' + me() + ' · ' + carrier + ' ' + awb });
        save(); return { order: x };
      });
    },
    change: function (x, carrier, awb) {
      var d0 = demo;
      return wait(700).then(function () {
        if (demo !== d0) return DROP(); net();
        var other = awbOwner(awb, x.id);
        if (other) return { error: 'AWB_TAKEN', other: other };
        x.events.push({ at: 'Today', text: 'Tracking number changed by ' + me() + ': ' + x.awb + ' → ' + awb });
        x.carrier = carrier; x.awb = awb; save(); return { order: x };
      });
    },
    delivered: function (x) { var d0 = demo; return wait(600).then(function () { if (demo !== d0) return DROP(); net(); x.status = 'delivered'; x.deliveredAt = TODAY; x.deliveredBy = me(); x.events.push({ at: 'Today', text: 'Marked delivered by ' + me() }); save(); return x; }); },
    cancel: function (x, reason) { var d0 = demo; return wait(800).then(function () { if (demo !== d0) return DROP(); net(); x.status = 'cancelled'; x.cancelled = { reason: reason, by: me(), at: 'Today' }; x.events.push({ at: 'Today', text: 'Cancelled by ' + me() + ': ' + reason }); save(); return x; }); }
  };

  /* ================= Helpers ================= */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(n, c) { return NH.icon(n, c); }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function pthumb(img) { return '<span class="pthumb">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : icon('image')) + '</span>'; }
  function tagchip(code, cls) { return '<span class="tagchip ' + (cls || '') + '">' + icon('barcode') + esc(code) + '</span>'; }
  function alertBox(type, title, text, ic, extra) {
    var map = { info: 'info', success: 'check', warning: 'alert', error: 'alertc' };
    return '<div class="alert alert-' + type + '" role="' + (type === 'error' ? 'alert' : 'status') + '">' + icon(ic || map[type]) + '<div>' + (title ? '<strong>' + title + '</strong>' : '') + (text ? '<p>' + text + '</p>' : '') + (extra || '') + '</div></div>';
  }
  function topBar(title, back, right) { return '<div class="scr-top">' + (back ? '<button class="icon-btn" type="button" data-go="' + back + '" aria-label="Back">' + icon('back') + '</button>' : '<span style="width:12px"></span>') + '<h1>' + (title || '') + '</h1>' + (right || '') + '</div>'; }
  function flowTop(title, small, left, right) { return '<div class="flow-top">' + left + '<h1>' + title + (small ? '<small>' + small + '</small>' : '') + '</h1>' + (right || '') + '</div>'; }
  function iconBtn(ic, attr, label) { return '<button class="icon-btn" type="button" ' + attr + ' aria-label="' + label + '">' + icon(ic) + '</button>'; }
  function skelRows(n) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="skel-row"><div class="skeleton" style="width:42px;height:56px;border-radius:8px"></div><div style="flex:1"><div class="skeleton" style="height:14px;width:55%;margin-bottom:6px"></div><div class="skeleton" style="height:11px;width:35%"></div></div></div>'; return '<div class="list">' + h + '</div>'; }
  function emptyCard(ic, title, text) { return '<div class="ph-tile" style="min-height:150px;align-items:center;justify-content:center;text-align:center;gap:.4rem">' + icon(ic, 'icon-xl') + '<b>' + title + '</b><span>' + text + '</span></div>'; }
  function chBadge(ch) { return '<span class="badge badge-' + (ch === 'whatsapp' ? 'success' : 'info') + '">' + (ch === 'whatsapp' ? 'WhatsApp' : 'Online') + '</span>'; }
  function mockbar(btns) {
    return '<div class="mockbar inline" role="group" aria-label="Pretend scanner (mock-up control)"><div class="lbl"><span>Pretend scan · mock-up control</span></div><div class="btns">' +
      btns.map(function (b) { return '<button type="button" data-fake="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div></div>';
  }
  function viewfinder(hint) { return '<div class="viewfinder" role="img" aria-label="Camera, looking for a label"><div class="frame">' + icon('barcode') + '<span class="laser"></span></div><span class="hint">' + hint + '</span></div>'; }

  /* ================= Overlays ================= */
  var overlays, root, viewport, closers = [];
  function addOverlay(html) { var d = document.createElement('div'); d.innerHTML = html; var el = d.firstElementChild; overlays.appendChild(el); return el; }
  function toast(msg, ok) {
    var old = overlays.querySelector('.app-toast'); if (old) old.remove();
    var t = addOverlay('<div class="app-toast' + (ok ? ' ok' : '') + '" role="status">' + icon(ok ? 'check' : 'info') + esc(msg) + '</div>');
    setTimeout(function () { t.remove(); }, 2800);
  }
  function dialog(o) {
    var acts = (o.actions || []).map(function (a, i) { return '<button type="button" class="btn btn-block ' + (a.kind || '') + '" data-i="' + i + '">' + a.label + '</button>'; }).join('');
    var el = addOverlay('<div class="dlg-backdrop"><div class="dlg is-' + (o.tone || 'info') + '" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d">' +
      '<div class="dlg-ico">' + icon(o.icon || 'info') + '</div><h2 id="dlg-t">' + o.title + '</h2><div id="dlg-d">' + (o.html || '<p>' + o.text + '</p>') + '</div><div class="dlg-actions">' + acts + '</div></div></div>');
    function close() { el.remove(); closers = closers.filter(function (c) { return c !== close; }); }
    closers.push(close);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (b) { var a = o.actions[+b.dataset.i]; if (a.keep) { a.fn && a.fn(b, close); } else { close(); a.fn && a.fn(); } return; }
      if (e.target === el && !o.sticky) close();
    });
    var f = el.querySelector('[data-i]'); f && f.focus();
    return close;
  }
  function sheet(html, onMount) {
    var el = addOverlay('<div class="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div></div>');
    function close() { el.remove(); closers = closers.filter(function (c) { return c !== close; }); }
    closers.push(close);
    el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-close]')) close(); });
    onMount && onMount(el, close);
    return close;
  }

  /* ================= Router ================= */
  var current = { name: '', params: {} }, state = 'normal', ui = {}, timers = [], stack = [];
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), q = h.split('?'), p = {};
    (q[1] || '').split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); p[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
    return { name: q[0] || 'orders', params: p };
  }
  function go(route) { if (('#/' + route) === location.hash) render(); else location.hash = '#/' + route; }
  function back() { if (stack.length > 1) history.back(); else go('orders'); }
  function after(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function stripDemo() {
    var p = current.params; if (!p.demo) return;
    delete p.demo;
    var qs = Object.keys(p).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(p[k]); }).join('&');
    var h = '#/' + current.name + (qs ? '?' + qs : '');
    history.replaceState(null, '', h); stack[stack.length - 1] = h;
  }
  function onRoute() {
    var r = parse(), h = location.hash;
    if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop(); else if (stack[stack.length - 1] !== h) stack.push(h);
    if (r.name !== current.name || JSON.stringify(r.params) !== JSON.stringify(current.params)) { ui[r.name] = undefined; state = 'normal'; }
    current = r;
    var want = r.params.as === 'staff' ? 'staff' : (r.params.as === 'owner' ? 'owner' : null);
    if (want && flags().viewAs !== want) NH.setFlag('viewAs', want, true);
    var detail = { name: r.name, params: Object.assign({}, r.params) };
    render();
    document.dispatchEvent(new CustomEvent('nh:route', { detail: detail }));
  }

  /* ================= Shell ================= */
  var TABS = [['home', 'home', 'Home'], ['orders', 'orders', 'Orders'], ['scan', 'scan', 'Scan'], ['products', 'box', 'Products'], ['more', 'more', 'More']];
  function shell(inner) {
    var waitingCount = lists().to_ship.length;
    var tabs = TABS.map(function (t) {
      var cur = t[0] === 'orders' ? ' aria-current="page"' : '';
      if (t[0] === 'scan') return '<button type="button" class="scan-tab" data-tab="scan" aria-label="Scan"><span class="scan-ico">' + icon('scan') + '</span></button>';
      return '<button type="button" data-tab="' + t[0] + '"' + cur + '>' + (t[0] === 'orders' && waitingCount ? '<span class="tab-count" aria-label="' + waitingCount + ' to ship">' + waitingCount + '</span>' : '') + icon(t[1]) + t[2] + '</button>';
    }).join('');
    var rail = '<nav class="rail" aria-label="Main menu"><img src="assets/logo.png" alt="Nandam Handlooms">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '"' + (t[0] === 'orders' ? ' aria-current="page"' : '') + '>' + icon(t[1]) + t[2] + '</button>'; }).join('') + '</nav>';
    var bar = offline() ? '<div class="saved-bar">' + icon('wifioff') + 'Offline · shipping and changes need internet.</div>' : '';
    return '<div class="shell">' + rail + '<div class="shell-main">' + bar + inner + '</div><nav class="tabbar" aria-label="Main menu">' + tabs + '</nav></div>';
  }

  /* ================= Screens ================= */
  var S = {};
  function orderRow(x) {
    var sub = x.status === 'to_ship' ? '<span class="' + (daysSince(x.d) >= 1 ? 'wait-warn' : '') + '">' + waiting(x) + '</span>'
      : x.status === 'shipped' ? (daysSince(x.shippedAt) > 10 ? '<span class="wait-warn">Check delivery · shipped ' + dd(x.shippedAt) + '</span>' : 'Shipped ' + dd(x.shippedAt) + ' · ' + x.awb)
        : x.status === 'delivered' ? 'Delivered ' + dd(x.deliveredAt) : 'Cancelled';
    return '<button type="button" class="row ordrow" data-go="order?id=' + x.id + '">' + pthumb(x.lines[0].img) + '<span class="grow"><b>' + x.no + ' ' + chBadge(x.ch) + (x.status === 'cancelled' ? ' <span class="badge badge-danger">Cancelled</span>' : '') + '</b><span>' + esc(x.cust.name) + ' · ' + esc(town(x)) + ' · ' + plural(x.lines.length, 'saree') + '</span><span class="sub2">' + sub + '</span></span><span class="amt">' + rs(total(x)) + '</span></button>';
  }

  S.orders = function (p) {
    if (p.demo) stripDemo();
    var u = ui.orders || (ui.orders = { tab: p.tab || 'to_ship', q: p.q || '' });
    var L = lists(), B = NH.opts.tabs === 'b';
    var unpaidRow = owner() ? '<button type="button" class="row" data-go="unpaid"><span class="ord-ico">' + icon('clock') + '</span><span class="grow"><b>Unpaid checkouts</b><span>' + plural(demo.unpaid.length, 'customer') + ' tried to buy on the website and didn\'t pay</span></span>' + icon('right', 'icon-sm') + '</button>' : '';
    var body;
    if (state === 'loading') body = skelRows(4);
    else if (state === 'error') body = alertBox('error', 'Couldn\'t load the orders', 'Check the internet and try again.');
    else if (u.q.trim()) {
      var hits = search(u.q);
      body = '<p class="field-hint" style="margin:.2rem 0 .5rem">Searching every order.</p>' + (hits.length ? '<div class="list">' + hits.map(orderRow).join('') + '</div>' : emptyCard('search', 'No order matches "' + esc(u.q) + '"', 'Try the order number, the customer\'s name or mobile, or the tracking number.'));
    } else if (B) {
      var empty = state === 'empty';
      body = '<div class="list-title" style="margin-top:.2rem">To ship · ' + (empty ? 0 : L.to_ship.length) + '</div>' + (empty || !L.to_ship.length ? emptyCard('packagecheck', 'Nothing to ship', 'Paid online orders and WhatsApp orders show here.') : '<div class="list">' + L.to_ship.map(orderRow).join('') + '</div>') +
        '<div class="list-title">Shipped · ' + L.shipped.length + '</div><div class="list">' + L.shipped.map(orderRow).join('') + '</div>' +
        '<button type="button" class="btn btn-ghost btn-block" style="margin-top:.6rem" data-tabpick="delivered">Delivered (' + L.delivered.length + ') ›</button>';
    } else {
      var list = state === 'empty' ? [] : L[u.tab];
      body = '<div class="seg3" role="tablist">' + [['to_ship', 'To ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered']].map(function (t) { return '<button type="button" role="tab" data-tabpick="' + t[0] + '" aria-selected="' + (u.tab === t[0]) + '">' + t[1] + ' <span class="n">' + (state === 'empty' && t[0] === 'to_ship' ? 0 : L[t[0]].length) + '</span></button>'; }).join('') + '</div>' +
        (list.length ? '<div class="list">' + list.map(orderRow).join('') + '</div>' : emptyCard(u.tab === 'to_ship' ? 'packagecheck' : u.tab === 'shipped' ? 'truck' : 'check', u.tab === 'to_ship' ? 'Nothing to ship' : u.tab === 'shipped' ? 'Nothing on its way' : 'Nothing delivered yet', u.tab === 'to_ship' ? 'Paid online orders and WhatsApp orders show here.' : 'Shipped orders show here until they\'re marked delivered.'));
    }
    return {
      html: '<section class="scr">' + topBar('Orders') + '<div class="scr-body narrow">' +
        '<div class="search-row"><div class="search">' + icon('search') + '<input class="input" type="search" id="o-q" placeholder="Order, name, mobile or tracking number" autocomplete="off" value="' + esc(u.q) + '" aria-label="Search orders"></div></div><div style="height:.6rem"></div>' +
        (owner() && !u.q.trim() ? '<div class="list" style="margin-bottom:.7rem">' + unpaidRow + '</div>' : '') +
        (!owner() && !u.q.trim() ? '<div class="ro-note">' + icon('lock') + 'Ship, change tracking numbers and mark delivered. Cancelling is for owners.</div>' : '') +
        body + '</div></section>',
      mount: function (el) {
        var q = el.querySelector('#o-q'), timer;
        q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { u.q = q.value; render(); var n = viewport.querySelector('#o-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); });
        el.querySelectorAll('[data-tabpick]').forEach(function (b) { b.addEventListener('click', function () { if (NH.opts.tabs === 'b') NH.setOption('tabs', 'a'); u.tab = b.dataset.tabpick; render(); }); });
      }
    };
  };

  function shipSheet(x, opts) {
    opts = opts || {};
    var change = !!opts.change;
    var carrier = change ? (x.carrier === 'DTDC' ? 'DTDC' : 'other') : 'DTDC', other = change && x.carrier !== 'DTDC' ? x.carrier : '';
    sheet('<h2>' + (change ? 'Change tracking number' : 'Ship ' + x.no) + '</h2><p>' + (change ? 'The old number (' + x.awb + ') stays in the order\'s history.' : 'Put the courier label on the parcel, then scan its barcode or type the number.') + '</p>' +
      '<div class="choice" style="margin-bottom:.6rem"><b>Courier</b><div class="opts" style="--n:2"><button type="button" data-car="DTDC" aria-pressed="' + (carrier === 'DTDC') + '">' + icon('truck') + 'DTDC</button><button type="button" data-car="other" aria-pressed="' + (carrier === 'other') + '">' + icon('edit') + 'Another courier</button></div></div>' +
      '<div class="field" data-otherbox' + (carrier === 'other' ? '' : ' hidden') + '><label for="s-car">Courier name</label><input class="input" id="s-car" maxlength="40" placeholder="India Post, Professional…" value="' + esc(other) + '"></div>' +
      '<div class="field"><label for="s-awb">Tracking number (AWB)</label><div class="search-row"><input class="input" id="s-awb" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="H1001830820" value="' + esc(opts.prefill || '') + '"><button type="button" class="icon-btn" data-scanlbl aria-label="Scan the label">' + icon('barcode') + '</button></div><p class="field-error" data-err hidden></p></div>' +
      mockbar([['label', 'Scan a label'], ['used', 'Scan a label already used']]) +
      '<div class="sheet-acts"><button type="button" class="btn btn-primary btn-block" data-go-ship>' + (change ? 'Save the new number' : 'Mark shipped') + '</button><button type="button" class="btn btn-ghost btn-block" data-close>Cancel</button></div>', function (el, close) {
      var inp = el.querySelector('#s-awb'), err = el.querySelector('[data-err]');
      function setErr(t) { err.hidden = !t; err.innerHTML = t ? icon('alertc', 'icon-sm') + t : ''; inp.closest('.field').classList.toggle('has-error', !!t); }
      el.querySelectorAll('[data-car]').forEach(function (b) { b.addEventListener('click', function () { carrier = b.dataset.car; el.querySelectorAll('[data-car]').forEach(function (y) { y.setAttribute('aria-pressed', String(y === b)); }); el.querySelector('[data-otherbox]').hidden = carrier !== 'other'; }); });
      el.querySelectorAll('[data-fake]').forEach(function (b) { b.addEventListener('click', function () { inp.value = b.dataset.fake === 'used' ? 'H1001830791' : 'H10018308' + (20 + Math.floor(Math.random() * 70)); setErr(''); toast('Read ' + inp.value, true); }); });
      el.querySelector('[data-scanlbl]').addEventListener('click', function () { toast('Opens the camera to read the label (use the pretend bar)'); });
      el.querySelector('[data-go-ship]').addEventListener('click', function (ev) {
        var awb = tidyAwb(inp.value), cname = carrier === 'other' ? el.querySelector('#s-car').value.trim() : 'DTDC';
        if (carrier === 'other' && cname.length < 2) return setErr('Type the courier\'s name.');
        if (!AWB.test(awb)) return setErr('Scan the label, or type its number: 8 to 20 letters and digits.');
        if (change && awb === x.awb) return setErr('That is already this order\'s number.');
        var btn = ev.currentTarget; btn.classList.add('is-loading');
        (change ? api.change(x, cname, awb) : api.ship(x, cname, awb)).then(function (r) {
          btn.classList.remove('is-loading');
          if (r.error === 'AWB_TAKEN') return setErr(awb + ' is already on order ' + r.other.no + ' (' + esc(r.other.cust.name) + '). Check the label.');
          if (r.error) return setErr('This order was already shipped.');
          close(); render();
          if (change) toast('Tracking number changed to ' + awb, true);
          else { toast(x.no + ' shipped', true); after(function () { sendSheet(x); }, 400); }
        }, function () { btn.classList.remove('is-loading'); toast('No internet. Shipping needs internet.'); });
      });
      if (opts.submit) after(function () { el.querySelector('[data-go-ship]').click(); }, 200);
    });
  }
  function sendSheet(x) {
    var plat = flags().platform;
    sheet('<h2>Send tracking on WhatsApp</h2><p>' + (plat === 'android' ? 'Opens ' + esc(x.cust.name) + '\'s chat (+91 ' + x.cust.mobile.slice(0, 5) + ' ' + x.cust.mobile.slice(5) + ') with this message, then the invoice PDF.' : 'The share menu opens with this message and the invoice PDF.') + '</p>' +
      '<pre class="wa-msg">' + esc(message(x)) + '</pre>' + (x.invoice ? '<p class="field-hint">' + icon('pdf', 'icon-sm') + ' Then: Nandam-Invoice-' + x.invoice + '.pdf</p>' : '<p class="field-hint">This order has no invoice: only the message is sent.</p>') +
      '<div class="sheet-acts"><button type="button" class="btn btn-wa btn-block" data-send>' + icon('whatsapp') + (plat === 'android' ? 'Open WhatsApp' : 'Share') + '</button><button type="button" class="btn btn-ghost btn-block" data-close>Not now</button></div>', function (el, close) {
      el.querySelector('[data-send]').addEventListener('click', function () { close(); toast('WhatsApp opens with the message' + (x.invoice ? ' and the invoice' : '') + ' (pretend)', true); });
    });
  }

  S.order = function (p) {
    var x = byId(p.id), demoKind = p.demo;
    if (demoKind) stripDemo();
    if (!x) return { html: '<section class="flow">' + flowTop('Order', '', iconBtn('back', 'data-back', 'Back')) + '<div class="flow-body">' + alertBox('info', 'Not found', 'This order isn\'t here.') + '</div></section>' };
    if (state === 'loading') return { html: '<section class="flow">' + flowTop(x.no, '', iconBtn('back', 'data-back', 'Back')) + '<div class="flow-body">' + skelRows(3) + '</div></section>' };
    if (state === 'error') return { html: '<section class="flow">' + flowTop(x.no, '', iconBtn('back', 'data-back', 'Back')) + '<div class="flow-body">' + alertBox('error', 'Couldn\'t open the order', 'Check the internet and try again.') + '</div></section>' };
    var canCancel = owner() && x.status === 'to_ship' && x.d.slice(0, 7) === TODAY.slice(0, 7);
    var statusBox = x.status === 'to_ship' ? alertBox(daysSince(x.d) >= 1 ? 'warning' : 'info', 'To ship · ' + waiting(x), 'Pack the sarees, put the courier label on, then Ship.', 'packagecheck')
      : x.status === 'shipped' ? alertBox(daysSince(x.shippedAt) > 10 ? 'warning' : 'success', (daysSince(x.shippedAt) > 10 ? 'Check delivery · ' : 'Shipped · ') + x.carrier + ' ' + x.awb, 'Shipped ' + dd(x.shippedAt) + ' by ' + x.shippedBy + (daysSince(x.shippedAt) > 10 ? '. More than 10 days: ask the customer or check the courier\'s site, then mark it delivered.' : '.'), 'truck')
        : x.status === 'delivered' ? alertBox('success', 'Delivered · ' + dd(x.deliveredAt), 'Marked by ' + x.deliveredBy + '.', 'packagecheck')
          : alertBox('error', 'Cancelled', esc(x.cancelled.reason) + ' · ' + x.cancelled.by + '. The sarees are back in stock' + (x.invoice ? '; ' + x.invoice + ' is marked CANCELLED.' : '.'));
    var lines = '<div class="list">' + x.lines.map(function (l) { return '<div class="bline compact">' + pthumb(l.img) + '<span class="grow"><b>' + esc(l.name) + '</b>' + tagchip(l.code, x.status === 'cancelled' ? '' : 'sold') + '</span><b class="lp">' + rs(l.price) + '</b></div>'; }).join('') + '</div>';
    var shipTo = '<div class="list"><div class="row" style="align-items:flex-start"><span class="ord-ico">' + icon('pin') + '</span><span class="grow"><b>' + esc(x.cust.name) + '</b><span class="addr">' + esc(x.cust.address).replace(/\n/g, '<br>') + '</span><span>+91 ' + x.cust.mobile.slice(0, 5) + ' ' + x.cust.mobile.slice(5) + (x.cust.email ? ' · ' + esc(x.cust.email) : '') + '</span></span></div>' +
      '<div class="row ship-acts"><button type="button" class="btn btn-sm" data-call>' + icon('call', 'icon-sm') + 'Call</button><button type="button" class="btn btn-sm" data-copy>' + icon('copy', 'icon-sm') + 'Copy address</button><button type="button" class="btn btn-sm" data-chat>' + icon('whatsapp', 'icon-sm') + 'WhatsApp</button></div></div>';
    var facts = '<div class="list"><div class="row"><dl class="kv" style="width:100%"><dt>Total</dt><dd>' + rs(total(x)) + '</dd><dt>Paid</dt><dd>' + (x.ch === 'online' ? 'Online (Razorpay)' : ({ cash: 'Cash', upi: 'UPI', card: 'Card' })[x.pay]) + '</dd><dt>Invoice</dt><dd>' + (x.invoice ? '<a href="#" data-inv>' + x.invoice + '</a>' : 'Not wanted') + '</dd>' + (x.by ? '<dt>Order made by</dt><dd>' + x.by + '</dd>' : '') + '</dl></div></div>';
    var timeline = '<ol class="timeline">' + x.events.map(function (e) { return '<li><b>' + esc(e.text) + '</b><span>' + esc(e.at) + '</span></li>'; }).join('') + '</ol>';
    var foot = x.status === 'to_ship' ? '<button type="button" class="btn btn-primary btn-block" data-ship>' + icon('truck', 'icon-sm') + 'Ship</button>'
      : x.status === 'shipped' ? '<button type="button" class="btn btn-wa btn-block" data-send>' + icon('whatsapp', 'icon-sm') + 'Send tracking on WhatsApp</button><div class="share-row"><button type="button" class="btn" data-change>' + icon('edit', 'icon-sm') + 'Change number</button><button type="button" class="btn" data-deliv>' + icon('packagecheck', 'icon-sm') + 'Mark delivered</button></div>' : '';
    return {
      html: '<section class="flow">' + flowTop(x.no, (x.ch === 'online' ? 'Online' : 'WhatsApp') + ' · ' + dd(x.d) + ', ' + x.t, iconBtn('back', 'data-back', 'Back')) +
        '<div class="flow-body">' + statusBox + '<div class="list-title">Sarees</div>' + lines + '<div class="list-title">Ship to</div>' + shipTo + '<div class="list-title">Payment</div>' + facts + '<div class="list-title">What happened</div>' + timeline +
        (canCancel ? '<button type="button" class="btn btn-danger btn-block" style="margin-top:1rem" data-cancel>' + icon('xcircle', 'icon-sm') + 'Cancel order</button>' : '') +
        (!owner() && x.status === 'to_ship' ? '<div class="lock-note">' + icon('lock') + '<span>Ask an owner to cancel an order.</span></div>' : '') +
        '</div>' + (foot ? '<div class="flow-foot">' + foot + '</div>' : '') + '</section>',
      mount: function (el) {
        var on = function (sel, fn) { var b = el.querySelector(sel); b && b.addEventListener('click', fn); };
        on('[data-call]', function () { toast('Calls +91 ' + x.cust.mobile + ' (pretend)'); });
        on('[data-copy]', function () { toast('Address copied: ' + x.cust.name + ', ' + x.cust.address.replace(/\n/g, ', '), true); });
        on('[data-chat]', function () { toast('Opens WhatsApp chat with ' + x.cust.name + ' (pretend)'); });
        on('[data-inv]', function (e) { e.preventDefault(); toast('Opens ' + x.invoice + ' (Module 6)'); });
        on('[data-ship]', function () { if (NH.opts.ship === 'b') go('ship?id=' + x.id); else shipSheet(x); });
        on('[data-send]', function () { sendSheet(x); });
        on('[data-change]', function () { shipSheet(x, { change: true }); });
        on('[data-deliv]', function () {
          dialog({ icon: 'packagecheck', title: 'Mark ' + x.no + ' delivered?', text: 'Do this when the customer has the parcel (or the courier\'s site says delivered).', actions: [{ label: 'Mark delivered', kind: 'btn-primary', keep: true, fn: function (b, close) { b.classList.add('is-loading'); api.delivered(x).then(function () { close(); render(); toast(x.no + ' delivered', true); }, function () { close(); toast('No internet. This needs internet.'); }); } }, { label: 'Cancel' }] });
        });
        on('[data-cancel]', cancelSheet);
        if (demoKind === 'ship') after(function () { shipSheet(x); }, 300);
        if (demoKind === 'dup') after(function () { shipSheet(x, { prefill: 'H1001830791', submit: true }); }, 300);
        if (demoKind === 'sent' && x.status === 'to_ship') { x.status = 'shipped'; x.carrier = 'DTDC'; x.awb = 'H1001830820'; x.shippedAt = TODAY; x.shippedBy = me(); x.events.push({ at: 'Today', text: 'Shipped by ' + me() + ' · DTDC H1001830820' }); save(); after(function () { render(); sendSheet(x); }, 200); }
        if (demoKind === 'change') after(function () { shipSheet(x, { change: true }); }, 300);
        if (demoKind === 'cancel') after(function () { if (canCancel) cancelSheet(); else toast('Owners only, before shipping'); }, 300);
        function cancelSheet() {
          var reasons = ['Customer changed their mind', 'Saree damaged while packing', 'Couldn\'t deliver to this address', 'Ordered twice by mistake'], pick = null;
          sheet('<h2>Cancel ' + x.no + '?</h2><p>' + plural(x.lines.length, 'saree goes', 'sarees go') + ' back in stock' + (x.invoice ? ' and ' + x.invoice + ' is marked CANCELLED' : '') + '.</p>' +
            (x.ch === 'online' ? alertBox('warning', 'Refund ' + rs(total(x)) + ' in Razorpay', 'The app never moves money. Refund the customer from the Razorpay dashboard.', 'card') : '') +
            '<div class="reason-list">' + reasons.map(function (r, i) { return '<button type="button" data-r="' + i + '" aria-pressed="false">' + r + '</button>'; }).join('') + '</div>' +
            '<div class="sheet-acts"><button type="button" class="btn btn-danger-solid btn-block" data-yes disabled>Cancel order</button><button type="button" class="btn btn-ghost btn-block" data-close>Keep the order</button></div>', function (sh, close) {
            sh.querySelectorAll('[data-r]').forEach(function (b) { b.addEventListener('click', function () { pick = reasons[+b.dataset.r]; sh.querySelectorAll('[data-r]').forEach(function (y) { y.setAttribute('aria-pressed', String(y === b)); }); sh.querySelector('[data-yes]').disabled = false; }); });
            sh.querySelector('[data-yes]').addEventListener('click', function (ev) { ev.currentTarget.classList.add('is-loading'); api.cancel(x, pick).then(function () { close(); render(); toast(x.no + ' cancelled · sarees back in stock', true); }, function () { close(); toast('No internet. Cancelling needs internet.'); }); });
          });
        }
      }
    };
  };

  // Ship step B: the camera first, then confirm.
  S.ship = function (p) {
    var x = byId(p.id); if (!x) return S.orders({});
    var u = ui.ship || (ui.ship = { awb: null, err: null });
    var other = u.awb ? awbOwner(u.awb, x.id) : null;
    return {
      html: '<section class="flow">' + flowTop('Ship ' + x.no, esc(x.cust.name) + ' · ' + esc(town(x)), iconBtn('x', 'data-back', 'Close')) +
        '<div class="flow-body"><div class="sell-a" style="height:auto">' + viewfinder('Point at the courier label\'s barcode') + mockbar([['label', 'Scan a label'], ['used', 'Scan a label already used']]) + '</div>' +
        (u.awb ? (other ? alertBox('error', u.awb + ' is already on order ' + other.no, '(' + esc(other.cust.name) + '). Check the label and scan again.') : '<div class="list" style="margin-top:.8rem"><div class="row"><span class="ord-ico">' + icon('truck') + '</span><span class="grow"><b>DTDC · ' + u.awb + '</b><span>Read from the label</span></span></div></div>') : '<p class="field-hint" style="margin-top:.6rem">Or type it: <button type="button" class="btn btn-sm" data-type>Type the number</button></p>') +
        '</div><div class="flow-foot"><button type="button" class="btn btn-primary btn-block" data-ok' + (u.awb && !other ? '' : ' disabled') + '>Mark shipped</button></div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-fake]').forEach(function (b) { b.addEventListener('click', function () { u.awb = b.dataset.fake === 'used' ? 'H1001830791' : 'H1001830833'; render(); }); });
        var t = el.querySelector('[data-type]'); t && t.addEventListener('click', function () { back(); after(function () { shipSheet(x); }, 300); });
        el.querySelector('[data-ok]').addEventListener('click', function (ev) { ev.currentTarget.classList.add('is-loading'); api.ship(x, 'DTDC', u.awb).then(function (r) { if (r.error) { u.err = r.error; return render(); } ui.ship = undefined; go('order?id=' + x.id); setTimeout(function () { if (current.name === 'order') sendSheet(x); }, 600); }); });
      }
    };
  };

  S.unpaid = function () {
    if (!owner()) return { html: '<section class="scr">' + topBar('Unpaid checkouts', 'orders') + '<div class="scr-body narrow">' + emptyCard('lock', 'For owners', 'Unpaid website checkouts are for owners.') + '</div></section>' };
    var list = state === 'empty' ? [] : demo.unpaid;
    return {
      html: '<section class="scr">' + topBar('Unpaid checkouts', 'orders') + '<div class="scr-body narrow">' +
        '<p class="field-hint" style="margin:0 0 .7rem">Website checkouts that weren\'t paid (last 30 days). Nothing is held: the sarees are back on sale. Several tries can mean the payment step is failing.</p>' +
        (list.length ? '<div class="list">' + list.map(function (c) {
          return '<div class="row unp" style="align-items:flex-start">' + pthumb(c.lines[0].img) + '<span class="grow"><b>' + esc(c.name) + '</b><span>' + plural(c.lines.length, 'saree') + ' · ' + rs(c.amount) + ' · last ' + c.last + '</span>' + (c.tries > 2 ? '<span class="wait-warn">Tried ' + c.tries + ' times</span>' : '<span>Tried ' + c.tries + ' times</span>') +
            '<span class="ship-acts"><button type="button" class="btn btn-sm" data-call="' + c.mobile + '">' + icon('call', 'icon-sm') + 'Call</button><button type="button" class="btn btn-sm" data-wa="' + c.name + '">' + icon('whatsapp', 'icon-sm') + 'WhatsApp</button></span></span></div>';
        }).join('') + '</div>' : emptyCard('check', 'No unpaid checkouts', 'Every website checkout in the last 30 days was paid.')) + '</div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-call]').forEach(function (b) { b.addEventListener('click', function () { toast('Calls +91 ' + b.dataset.call + ' (pretend)'); }); });
        el.querySelectorAll('[data-wa]').forEach(function (b) { b.addEventListener('click', function () { toast('Opens WhatsApp with ' + b.dataset.wa + ' (pretend)'); }); });
      }
    };
  };

  /* ================= Render ================= */
  var FULL = { order: 1, ship: 1 };
  function bindGo(scope) {
    scope.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.go); }); });
    scope.querySelectorAll('[data-back]').forEach(function (b) { b.addEventListener('click', back); });
  }
  function render() {
    timers.forEach(function (t) { clearTimeout(t); }); timers = [];
    closers = [];
    Array.prototype.slice.call(overlays.children).forEach(function (c) { if (!c.classList.contains('app-toast')) c.remove(); });
    var name = current.name, fn = S[name] || S.orders;
    var scr = fn(current.params || {});
    viewport.innerHTML = FULL[name] ? scr.html : shell(scr.html);
    var el = viewport.querySelector('.scr, .flow') || viewport.firstElementChild;
    bindGo(viewport);
    viewport.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.tab === 'orders') go('orders'); else toast('This tab is another module'); }); });
    scr.mount && scr.mount(el);
    var spec = window.NH_SCREENS.filter(function (s) { return NH_ROUTE(s).split('?')[0] === name; });
    if (state !== 'normal' && spec.length && !spec.some(function (s) { return s.states.indexOf(state) >= 0; })) NH.toast('"' + state + '" isn\'t a state of this screen. Try: ' + (spec.map(function (s) { return s.states.join(', '); }).filter(Boolean).join(', ') || 'none'));
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && closers.length) { closers[closers.length - 1](); e.stopPropagation(); } });

  window.NHApp = {
    setState: function (s) { state = s; ui[current.name] = undefined; render(); },
    go: go,
    action: function (name) { if (name === 'reset') { demo = freshDemo(); save(); ui = {}; go('orders'); } }
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
    document.addEventListener('nh:flags', function () { syncPlatform(); if (current.name) render(); });
    window.addEventListener('hashchange', onRoute);
    onRoute();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
