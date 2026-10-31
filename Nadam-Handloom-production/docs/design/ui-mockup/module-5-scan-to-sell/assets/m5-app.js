/* Module 5 (Scan to sell): the clickable app.
   Real sarees, tags, prices and photos (copy of 11 Oct 2026) with a small pretend
   backend that applies the agreed rules: all-or-nothing bills, the store price unless
   a price is agreed, the under-half check, Cash / UPI / Card required, invoice yes / no,
   held sarees (owners only), Online only and damaged refused, cancel = owners, same day,
   no selling without internet, and a repeated "Complete sale" never sells twice. */
(function () {
  'use strict';
  var NH = window.NH;
  var EMBED = /[?&]embed=1/.test(location.search);
  var DEMO_KEY = 'nh-m5-demo';
  var GST = 5;

  /* ================= Catalogue and sarees ================= */
  var SUBS = {};
  window.NH_CATALOG.categories.forEach(function (c) { c.subs.forEach(function (s) { SUBS[s.id] = { s: s, c: c }; }); });
  function sub(id) { return SUBS[id] || null; }

  function freshDemo() {
    var products = window.NH_PRODUCTS.map(function (p) {
      return { id: p.id, sku: p.sku, sub: p.sub, img: p.img, ch: p.ch, tags: p.tags.map(function (t) { return { code: t[0], st: t[1], soldAt: t[2] || null }; }) };
    });
    function byId(id) { return products.filter(function (x) { return x.id === id; })[0]; }
    // Sample states for the demo screens.
    var held = byId('67d2f4e6'); if (held) { held.tags[0].st = 'reserved'; held.holdUntil = '4:15 pm'; }
    var dmg = byId('3c96367f'); if (dmg) dmg.tags[0].st = 'damaged';
    var d = { products: products, bill: { ref: ref(), lines: [] }, sales: [], nextInv: 16, last: null };
    // Today's sales (sample): real sarees, marked sold for the demo.
    function sold(id, price) { var p = byId(id); var t = p.tags.filter(function (x) { return x.st === 'in_stock'; })[0]; t.st = 'sold_offline'; t.soldAt = 'today'; return { pid: p.id, code: t.code, store: storeOf(p), agreed: price }; }
    d.sales.push({ id: 's0', day: 'yesterday', time: '6:30 pm', by: 'Ravi', channel: 'store', pay: 'card', invoice: 'INV-000013', lines: [sold('e1ba460d', null)], customer: {} });
    d.sales.push({ id: 's1', day: 'today', time: '10:42 am', by: 'Lakshmi', channel: 'store', pay: 'cash', invoice: 'INV-000014', order: 'NH40718325', lines: [sold('10b361f9', 2600), sold('33a23529', null)], customer: { name: 'Sravani', mobile: '9876543210' } });
    d.sales.push({ id: 's2', day: 'today', time: '11:20 am', by: 'Ravi', channel: 'store', pay: 'upi', invoice: null, order: 'NH40718902', lines: [sold('8cae3c3a', 1800)], customer: {} });
    d.sales.push({ id: 's3', day: 'today', time: '12:05 pm', by: 'Lakshmi', channel: 'whatsapp', pay: 'upi', invoice: 'INV-000015', order: 'NH40719377', lines: [sold('b76198bb', 2200)], customer: { name: 'Padma', mobile: '9123456780', address: 'Flat 3B, Sai Residency, Guntur 522002' } });
    return d;
  }
  function ref() { return 'b-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function storeOf(p) { var x = sub(p.sub); return x ? x.s.store : 0; }
  var demo = load();
  function load() { try { var d = JSON.parse(sessionStorage.getItem(DEMO_KEY)); if (d && d.products) return d; } catch (e) { } return freshDemo(); }
  function save() { try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch (e) { } }

  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function flags() { return NH.flags(); }
  function offline() { return !!flags().offline; }
  function owner() { return flags().viewAs !== 'staff'; }
  function me() { return owner() ? 'Lakshmi' : 'Ravi'; }
  function prod(id) { return demo.products.filter(function (p) { return p.id === id; })[0] || null; }
  function normTag(v) { var s = String(v || '').toUpperCase().replace(/\s+/g, ''); if (/^\d{1,6}$/.test(s)) s = 'NH' + s; return s; }
  function findTag(code) {
    for (var i = 0; i < demo.products.length; i++) for (var j = 0; j < demo.products[i].tags.length; j++) if (demo.products[i].tags[j].code === code) return { p: demo.products[i], t: demo.products[i].tags[j] };
    return null;
  }
  // What the server says about a scanned tag.
  function lookup(code) {
    var f = findTag(code);
    if (!f) return { error: 'TAG_UNKNOWN', code: code };
    var p = f.p, t = f.t, base = { p: p, t: t, code: code, store: storeOf(p) };
    if (demo.bill.lines.some(function (l) { return l.code === code; })) return Object.assign(base, { error: 'ON_THIS_BILL' });
    if (/^sold/.test(t.st)) return Object.assign(base, { error: 'ALREADY_SOLD' });
    if (t.st === 'damaged') return Object.assign(base, { error: 'DAMAGED' });
    if (p.ch === 'online_only') return Object.assign(base, { error: 'ONLINE_ONLY' });
    if (t.st === 'reserved') return Object.assign(base, { error: 'HELD_ONLINE' });
    return Object.assign(base, { ok: true });
  }
  function nextFreeInStock() {
    for (var i = 0; i < demo.products.length; i++) {
      var p = demo.products[i];
      if (p.ch === 'online_only' || !p.img) continue;
      var t = p.tags.filter(function (x) { return x.st === 'in_stock' && !demo.bill.lines.some(function (l) { return l.code === x.code; }); })[0];
      if (t && i % 3 === 0) return t.code;
    }
    return 'NH13';
  }
  function addLine(r, held) { demo.bill.lines.push({ pid: r.p.id, code: r.code, store: r.store, agreed: null, held: !!held }); save(); }
  function lineTotal(l) { return l.agreed != null ? l.agreed : l.store; }
  function billTotals() {
    var total = 0, store = 0;
    demo.bill.lines.forEach(function (l) { total += lineTotal(l); store += l.store; });
    return { total: total, store: store, off: store - total, n: demo.bill.lines.length };
  }
  // A ready-made bill for the demo screens: real sarees with photos, from different subcategories.
  function demoBill(n) {
    demo.bill = { ref: ref(), lines: [] };
    var seen = {};
    var pool = demo.products.filter(function (p) { return p.img && p.ch === 'both' && p.tags.some(function (t) { return t.st === 'in_stock'; }); });
    pool.sort(function (a, b) { return (b.id === '630692a8') - (a.id === '630692a8'); });
    for (var i = 0; i < pool.length && demo.bill.lines.length < n; i++) {
      var p = pool[i];
      if (seen[p.sub]) continue;
      seen[p.sub] = 1;
      var t = p.tags.filter(function (x) { return x.st === 'in_stock'; })[0];
      demo.bill.lines.push({ pid: p.id, code: t.code, store: storeOf(p), agreed: null, held: false });
    }
    save();
  }

  // A reply that arrives after "Reset demo" (or a newer demo) is dropped, so it can't touch the new data.
  var DROP = function () { return new Promise(function () { }); };
  var api = {
    complete: function (o) {
      var d0 = demo;
      return wait(900).then(function () {
        if (demo !== d0) return DROP();
        if (offline()) { var e = new Error('offline'); e.code = 'offline'; throw e; }
        // The same bill sent again returns the same sale.
        var done = demo.sales.filter(function (s) { return s.ref === demo.bill.ref; })[0];
        if (done) return { sale: done, repeated: true };
        // All or nothing: every saree must still be sellable.
        for (var i = 0; i < demo.bill.lines.length; i++) {
          var l = demo.bill.lines[i], f = findTag(l.code);
          if (!f || f.t.st !== (l.held ? 'reserved' : 'in_stock') || o.forceChanged === i) return { error: 'LINE_CHANGED', index: i, code: l.code };
        }
        demo.bill.lines.forEach(function (l) { var f = findTag(l.code); f.t.st = 'sold_offline'; f.t.soldAt = 'today'; });
        var now = new Date();
        var sale = { id: 's' + Date.now().toString(36), ref: demo.bill.ref, day: 'today', time: now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }), by: me(), channel: o.channel, pay: o.pay,
          invoice: o.invoice && !o.failInvoice ? 'INV-' + String(demo.nextInv++).padStart(6, '0') : null, invoiceWanted: o.invoice, order: 'NH4' + Math.floor(Math.random() * 9e6 + 1e6), lines: demo.bill.lines.slice(), customer: o.customer || {}, held: demo.bill.lines.some(function (l) { return l.held; }) };
        demo.sales.push(sale);
        demo.last = sale.id;
        save();
        return { sale: sale };
      });
    },
    remakeInvoice: function (s) { var d0 = demo; return wait(700).then(function () { if (demo !== d0) return DROP(); if (!s.invoice) s.invoice = 'INV-' + String(demo.nextInv++).padStart(6, '0'); save(); return s; }); },
    cancel: function (s, reason) {
      var d0 = demo;
      return wait(800).then(function () {
        if (demo !== d0) return DROP();
        if (offline()) { var e = new Error('offline'); e.code = 'offline'; throw e; }
        s.cancelled = { reason: reason, by: me(), time: new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) };
        s.lines.forEach(function (l) { var f = findTag(l.code); if (f) { f.t.st = 'in_stock'; f.t.soldAt = null; } });
        save(); return s;
      });
    }
  };

  /* ================= Helpers ================= */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  function rs(v) { return v == null || v === '' ? '—' : '₹' + INR.format(v); }
  function icon(n, c) { return NH.icon(n, c); }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function pname(p) { var x = sub(p.sub); return x ? x.s.name : p.sku; }
  function pthumb(img, cls) { return '<span class="pthumb ' + (cls || '') + '">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : icon('image')) + '</span>'; }
  function tagchip(code, cls) { return '<span class="tagchip ' + (cls || '') + '">' + icon('barcode') + esc(code) + '</span>'; }
  function alertBox(type, title, text, ic, extra) {
    var map = { info: 'info', success: 'check', warning: 'alert', error: 'alertc' };
    return '<div class="alert alert-' + type + '" role="' + (type === 'error' ? 'alert' : 'status') + '">' + icon(ic || map[type]) + '<div>' + (title ? '<strong>' + title + '</strong>' : '') + (text ? '<p>' + text + '</p>' : '') + (extra || '') + '</div></div>';
  }
  function topBar(title, back, right) { return '<div class="scr-top">' + (back ? '<button class="icon-btn" type="button" data-go="' + back + '" aria-label="Back">' + icon('back') + '</button>' : '<span style="width:12px"></span>') + '<h1>' + (title || '') + '</h1>' + (right || '') + '</div>'; }
  function flowTop(title, small, left, right) { return '<div class="flow-top">' + left + '<h1>' + title + (small ? '<small>' + small + '</small>' : '') + '</h1>' + (right || '') + '</div>'; }
  function iconBtn(ic, attr, label) { return '<button class="icon-btn" type="button" ' + attr + ' aria-label="' + label + '">' + icon(ic) + '</button>'; }
  function viewfinder(hint) { return '<div class="viewfinder" role="img" aria-label="Camera, looking for a tag"><div class="frame">' + icon('barcode') + '<span class="laser"></span></div><span class="hint">' + hint + '</span></div>'; }
  function mockbar(btns) {
    return '<div class="mockbar inline" role="group" aria-label="Pretend scanner (mock-up control)"><div class="lbl"><span>Pretend scan · mock-up control</span></div><div class="btns">' +
      btns.map(function (b) { return '<button type="button" data-fake="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div></div>';
  }
  function skelRows(n) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="skel-row"><div class="skeleton" style="width:42px;height:56px;border-radius:8px"></div><div style="flex:1"><div class="skeleton" style="height:14px;width:55%;margin-bottom:6px"></div><div class="skeleton" style="height:11px;width:35%"></div></div></div>'; return '<div class="list">' + h + '</div>'; }
  var PAY = { cash: ['Cash', 'cash'], upi: ['UPI', 'upi'], card: ['Card', 'card'] };
  function saleTotal(s) { return s.lines.reduce(function (t, l) { return t + lineTotal(l); }, 0); }
  function gstSplit(amount) { var taxable = Math.round(amount / (1 + GST / 100) * 100) / 100; var g = Math.round((amount - taxable) * 100) / 100; var cg = Math.round(g / 2 * 100) / 100; return { taxable: taxable, cgst: cg, sgst: Math.round((g - cg) * 100) / 100 }; }

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
  function typeSheet(title, onCode) {
    sheet('<h2>' + title + '</h2><p>The number printed on the tag. Typing only digits adds NH (3302 → NH3302). A Bluetooth tag scanner types here by itself.</p>' +
      '<form class="type-box" data-type style="margin-top:.75rem"><input class="input" id="type-tag" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="NH3302" aria-label="Tag number" maxlength="64"><button class="btn btn-primary" type="submit">Use</button></form>' +
      '<div class="acts"><button type="button" class="btn btn-ghost btn-block" data-close>Cancel</button></div>', function (el, close) {
      var f = el.querySelector('[data-type]'), inp = el.querySelector('#type-tag');
      setTimeout(function () { inp.focus(); }, 60);
      f.addEventListener('submit', function (e) { e.preventDefault(); var c = normTag(inp.value); if (c.length < 3) return; close(); onCode(c); });
    });
  }

  /* "Can't be sold" card: says why, with the saree's photo. */
  function cantCard(r, onSellAnyway) {
    var p = r.p, t = r.t;
    var why = {
      ALREADY_SOLD: [r.code + ' is already sold', 'Sold at the counter' + (t && t.soldAt && t.soldAt !== 'today' ? ' on ' + new Date(t.soldAt + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ' today') + '. A sold saree can\'t be sold again.', 'alert'],
      DAMAGED: ['Saree damaged: not for sale', 'It was marked damaged. "Back in stock" on the saree page makes it sellable again.', 'alertc'],
      ONLINE_ONLY: ['Set to Online only', 'This saree sells only on the website. To sell it here, change it to Online + store on the saree page.', 'eye'],
      HELD_ONLINE: ['A customer is paying for it online', 'Their checkout holds it until ' + esc(p && p.holdUntil || 'soon') + '.' + (owner() ? ' You can sell it anyway: their checkout is cancelled.' : ' Ask an owner, or wait until then.'), 'clock'],
      TAG_UNKNOWN: ['No saree has ' + r.code, 'It\'s not in the shop yet. It can be added as a new saree (Products).', 'barcode']
    }[r.error];
    var acts = [];
    if (r.error === 'HELD_ONLINE' && owner()) acts.push('<button type="button" class="btn btn-danger btn-block" data-a="sell">Sell anyway</button>');
    if (r.error === 'ONLINE_ONLY' || r.error === 'DAMAGED') acts.push('<button type="button" class="btn btn-block" data-a="open">Open the saree page</button>');
    if (r.error === 'TAG_UNKNOWN') acts.push('<button type="button" class="btn btn-block" data-a="new">Add as a new saree</button>');
    sheet('<div class="cant"><div class="top">' + (p ? pthumb(p.img) : '<span class="pthumb">' + icon('barcode') + '</span>') + '<div><b>' + why[0] + '</b>' + (p ? '<small>' + esc(pname(p)) + ' · ' + esc(p.sku) + '</small>' : '') + (t ? tagchip(t.code, /^sold/.test(t.st) ? 'sold' : '') : '') + '</div></div><p style="margin:0">' + why[1] + '</p>' +
      (r.error === 'HELD_ONLINE' && !owner() ? '<div class="lock-note">' + icon('lock') + '<span>Only owners can sell a saree an online checkout is holding.</span></div>' : '') +
      '</div><div class="sheet-acts">' + acts.join('') + '<button type="button" class="btn btn-primary btn-block" data-close>' + (demo.bill.lines.length ? 'Back to the bill' : 'Scan again') + '</button></div>', function (el, close) {
      var s = el.querySelector('[data-a="sell"]');
      s && s.addEventListener('click', function () {
        close();
        dialog({ tone: 'warning', icon: 'clock', title: 'Sell it anyway?', text: 'The online customer\'s checkout is cancelled and they can\'t pay for it. It goes on this bill at ' + rs(r.store) + '.',
          actions: [{ label: 'Sell anyway', kind: 'btn-danger-solid', fn: onSellAnyway }, { label: 'Cancel' }] });
      });
      var o = el.querySelector('[data-a="open"]'); o && o.addEventListener('click', function () { close(); toast('Opens the saree page (Module 4)'); });
      var n = el.querySelector('[data-a="new"]'); n && n.addEventListener('click', function () { close(); toast('Opens Add a new saree with ' + r.code + ' (Module 4)'); });
    });
  }

  /* ================= Router ================= */
  var current = { name: '', params: {} }, state = 'normal', ui = {}, timers = [], stack = [];
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), q = h.split('?'), p = {};
    (q[1] || '').split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); p[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
    return { name: q[0] || 'scan', params: p };
  }
  function go(route) { if (('#/' + route) === location.hash) render(); else location.hash = '#/' + route; }
  function back() { if (stack.length > 1) history.back(); else go('scan'); }
  function after(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function afterNav(fn, ms) { return setTimeout(fn, ms); }
  // Demo links set up their example once, then drop the flag so edits aren't undone.
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
    var tab = 'scan';
    var tabs = TABS.map(function (t) {
      var cur = t[0] === tab ? ' aria-current="page"' : '';
      if (t[0] === 'scan') return '<button type="button" class="scan-tab" data-tab="scan"' + cur + ' aria-label="Scan"><span class="scan-ico">' + icon('scan') + '</span></button>';
      return '<button type="button" data-tab="' + t[0] + '"' + cur + '>' + icon(t[1]) + t[2] + '</button>';
    }).join('');
    var rail = '<nav class="rail" aria-label="Main menu"><img src="assets/logo.png" alt="Nandam Handlooms">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + icon(t[1]) + t[2] + '</button>'; }).join('') + '</nav>';
    var bar = offline() ? '<div class="saved-bar">' + icon('wifioff') + 'Offline · you can scan and build the bill; completing a sale needs internet.</div>' : '';
    return '<div class="shell">' + rail + '<div class="shell-main">' + bar + inner + '</div><nav class="tabbar" aria-label="Main menu">' + tabs + '</nav></div>';
  }

  /* ================= Screens ================= */
  var S = {};

  function billStrip() {
    var t = billTotals();
    if (!t.n) return '<div class="billstrip empty">' + icon('receipt') + '<span><b style="color:var(--text)">Scan the first saree</b><span>Its store price comes from its subcategory.</span></span></div>';
    return '<button type="button" class="billstrip" data-go="bill">' + icon('receipt') + '<span><b>Bill · ' + plural(t.n, 'saree') + ' · ' + rs(t.total) + '</b><span>' + (t.off > 0 ? rs(t.off) + ' off · ' : '') + 'tap to see the bill</span></span><span class="go">View bill ›</span></button>';
  }
  function billLines(compact) {
    return demo.bill.lines.map(function (l, i) {
      var p = prod(l.pid);
      return '<div class="bline' + (compact ? ' compact' : '') + (ui.changedIndex === i ? ' changed' : '') + '" data-line="' + i + '">' + pthumb(p.img) + '<span class="grow"><b>' + esc(pname(p)) + '</b>' + tagchip(l.code) +
        '<small>' + (ui.changedIndex === i ? '<span class="why">Just sold on another phone</span>' : 'Store ' + (l.agreed != null && l.agreed !== l.store ? '<span class="was">' + rs(l.store) + '</span>' : rs(l.store)) + (l.held ? ' · sold anyway (was held online)' : '')) + '</small></span>' +
        '<span class="price"><label for="ap-' + i + '">Agreed price</label><span class="money"><span>₹</span><input class="input" id="ap-' + i + '" data-ap="' + i + '" inputmode="decimal" autocomplete="off" placeholder="' + l.store + '" value="' + (l.agreed != null ? l.agreed : '') + '"></span></span>' +
        '<button type="button" class="rm" data-rm="' + i + '" aria-label="Remove ' + esc(l.code) + '">' + icon('x') + '</button></div>';
    }).join('');
  }
  function totBar() {
    var t = billTotals();
    return '<div class="totbar" id="totbar"><span><small>' + plural(t.n, 'saree') + '</small><br><b>' + rs(t.total) + '</b></span>' + (t.off > 0 ? '<span class="off">' + rs(t.off) + ' off the store price</span>' : '<small>At store prices</small>') + '</div>';
  }
  // Agreed-price boxes: totals update while typing; the under-half check runs when you leave the box.
  function bindPrices(el) {
    el.querySelectorAll('[data-ap]').forEach(function (inp) {
      var i = +inp.dataset.ap;
      inp.addEventListener('input', function () {
        var v = inp.value.replace(/[₹,\s]/g, ''), l = demo.bill.lines[i];
        l.agreed = v === '' ? null : Number(v);
        save();
        var tb = viewport.querySelector('#totbar'); if (tb) tb.outerHTML = totBar();
        var strip = viewport.querySelector('.billstrip'); if (strip) strip.outerHTML = billStrip();
      });
      inp.addEventListener('change', function () { checkLow(i); });
    });
    el.querySelectorAll('[data-rm]').forEach(function (b) { b.addEventListener('click', function () {
      var l = demo.bill.lines[+b.dataset.rm];
      demo.bill.lines.splice(+b.dataset.rm, 1); ui.changedIndex = undefined; save(); render(); toast(l.code + ' taken off the bill');
    }); });
  }
  function checkLow(i) {
    var l = demo.bill.lines[i];
    if (!l || l.agreed == null) return;
    if (!(l.agreed > 0)) { l.agreed = null; save(); render(); return toast('Enter a price above ₹0, or leave it empty for the store price'); }
    if (l.agreed < l.store / 2) {
      var v = l.agreed;
      dialog({ tone: 'warning', icon: 'percent', title: 'Is this price right?', sticky: true,
        html: '<p><b>' + rs(v) + '</b> is under half the store price (' + rs(l.store) + ') for ' + esc(l.code) + '.</p>',
        actions: [{ label: 'Change it', kind: 'btn-primary', fn: function () { l.agreed = null; save(); render(); var f = viewport.querySelector('#ap-' + i); f && f.focus(); } }, { label: 'Yes, sell at ' + rs(v) }] });
    }
  }

  function fakeScan(kind, onCode) {
    if (kind === 'free') return onCode(nextFreeInStock());
    if (kind === 'again') { var l = demo.bill.lines[demo.bill.lines.length - 1]; return onCode(l ? l.code : nextFreeInStock()); }
    if (kind === 'sold') return onCode('NH6');
    if (kind === 'damaged') return onCode('NH5');
    if (kind === 'online') return onCode('NH542');
    if (kind === 'held') return onCode('NH4');
    if (kind === 'unknown') return onCode('NH999999');
  }
  var FAKES = [['free', 'Saree in stock'], ['again', 'Same saree again'], ['sold', 'Sold saree'], ['damaged', 'Damaged'], ['online', 'Online only'], ['held', 'Held online'], ['unknown', 'Unknown tag']];

  S.scan = function (p) {
    var demoKind = p.demo;
    if (demoKind) {
      if (demoKind === 'empty') demoBill(0); else demoBill(2);
      stripDemo();
    }
    if (state === 'empty') demoBill(0);
    var lay = NH.opts.scanLayout;
    var right = '<button type="button" class="btn btn-sm btn-ghost top-act" data-go="pricecheck">' + icon('tag', 'icon-sm') + 'Price check</button><button type="button" class="icon-btn" data-go="today" aria-label="Today\'s sales" style="margin-right:4px">' + icon('history') + '</button>';
    var tools = '<div class="scan-tools"><button type="button" class="btn" data-type>' + icon('keyboard', 'icon-sm') + 'Type</button><button type="button" class="btn" data-torch>' + icon('flash', 'icon-sm') + 'Torch</button><button type="button" class="btn" data-zoom>' + icon('zoom', 'icon-sm') + 'Zoom</button></div>';
    var t = billTotals();
    var body = state === 'loading' ? '<div class="skeleton" style="height:60%;border-radius:var(--r-lg)"></div>' : lay === 'b'
      ? '<div class="sell-b">' + viewfinder('Point at the saree\'s tag') + tools + '<div class="billbox">' + (t.n ? billLines(true) : '<div style="padding:1rem;color:var(--muted);text-align:center">Scan the first saree</div>') + '</div>' +
        '<div style="display:grid;gap:.45rem">' + (t.n ? totBar() + '<button type="button" class="btn btn-primary btn-block" data-go="complete">Complete sale · ' + rs(t.total) + '</button>' : '') + '</div>' + mockbar(FAKES) + '</div>'
      : '<div class="sell-a">' + viewfinder('Point at the saree\'s tag') + tools + mockbar(FAKES) + billStrip() + '</div>';
    return {
      html: '<section class="scr">' + topBar('Sell', null, right) + '<div class="scr-body narrow" style="display:flex;flex-direction:column;padding-bottom:104px">' +
        (demoKind === 'draft' ? alertBox('info', 'Your bill is back', 'The app was closed in the middle of a bill. Nothing was lost.', 'layers') + '<div style="height:.5rem"></div>' : '') +
        '<div style="flex:1;min-height:0">' + body + '</div></div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-fake]').forEach(function (b) { b.addEventListener('click', function () { fakeScan(b.dataset.fake, onCode); }); });
        el.querySelector('[data-type]') && el.querySelector('[data-type]').addEventListener('click', function () { typeSheet('Type the tag number', onCode); });
        el.querySelector('[data-torch]') && el.querySelector('[data-torch]').addEventListener('click', function () { toast('Torch on (pretend)'); });
        el.querySelector('[data-zoom]') && el.querySelector('[data-zoom]').addEventListener('click', function () { toast('Zoomed in for small tags (pretend)'); });
        bindPrices(el);
        var kinds = { sold: 'sold', onbill: 'again', damaged: 'damaged', online: 'online', held: 'held', unknown: 'unknown' };
        if (kinds[demoKind]) after(function () { fakeScan(kinds[demoKind], onCode); }, 350);
      }
    };
    function onCode(code) {
      var r = lookup(code);
      if (r.ok) { addLine(r); render(); toast('Added ' + code + ' · ' + rs(r.store), true); return; }
      if (r.error === 'ON_THIS_BILL') return toast(code + ' is on this bill already. Scan the next saree.');
      cantCard(r, function () { addLine(r, true); render(); toast('Added ' + code + ' · the online checkout will be cancelled', true); });
    }
  };

  S.bill = function (p) {
    var demoKind = p.demo; if (demoKind) { demoBill(3); if (demoKind === 'low') demo.bill.lines[0].agreed = Math.round(demo.bill.lines[0].store * 0.35); save(); stripDemo(); }
    if (state === 'empty') demoBill(0);
    var t = billTotals();
    return {
      html: '<section class="flow">' + flowTop('Bill', plural(t.n, 'saree'), iconBtn('back', 'data-go="scan"', 'Back to scanning'), t.n ? '<button type="button" class="btn btn-sm btn-ghost" data-clear style="margin-right:6px">Clear</button>' : '') +
        '<div class="flow-body">' + (t.n ? '<p class="field-hint" style="margin:0 0 .6rem">Leave a price empty to sell at the store price. Type the agreed price for a bargain: the catalogue price doesn\'t change.</p><div class="list">' + billLines(false) + '</div><div style="height:.7rem"></div>' + totBar()
          : '<div class="ph-tile" style="min-height:180px;align-items:center;justify-content:center;text-align:center">' + icon('receipt', 'icon-xl') + '<b>The bill is empty</b><span>Scan a saree to start.</span></div>') + '</div>' +
        '<div class="flow-foot"><button type="button" class="btn btn-primary btn-block" data-go="complete"' + (t.n ? '' : ' disabled') + '>Complete sale</button><button type="button" class="btn btn-block" data-go="scan">' + icon('scan', 'icon-sm') + 'Add more</button></div></section>',
      mount: function (el) {
        bindPrices(el);
        var c = el.querySelector('[data-clear]');
        c && c.addEventListener('click', function () { dialog({ tone: 'danger', icon: 'trash', title: 'Clear the bill?', text: 'All ' + plural(t.n, 'saree') + ' come off the bill. Nothing is sold.', actions: [{ label: 'Clear the bill', kind: 'btn-danger-solid', fn: function () { demo.bill = { ref: ref(), lines: [] }; save(); render(); } }, { label: 'Keep it' }] }); });
        if (demoKind === 'low') after(function () { checkLow(0); }, 350);
      }
    };
  };

  function choice(key, label, opts, val, missing, n) {
    return '<div class="choice' + (missing ? ' missing' : '') + '" role="group" aria-label="' + label + '"><b>' + label + '</b><div class="opts" style="--n:' + (n || opts.length) + '">' +
      opts.map(function (o) { return '<button type="button" data-c="' + key + '" data-v="' + o[0] + '" aria-pressed="' + (val === o[0]) + '">' + icon(o[2]) + o[1] + '</button>'; }).join('') + '</div>' + (missing ? '<span class="err">' + missing + '</span>' : '') + '</div>';
  }
  function field(id, label, control, err, hint) {
    return '<div class="field' + (err ? ' has-error' : '') + '"><label for="' + id + '">' + label + '</label>' + control + (err ? '<p class="field-error">' + icon('alertc', 'icon-sm') + esc(err) + '</p>' : hint ? '<p class="field-hint">' + hint + '</p>' : '') + '</div>';
  }

  S.complete = function (p) {
    var demoKind = p.demo;
    if (demoKind) {
      demoBill(demoKind === 'changed' ? 3 : 2);
      ui.complete = { where: demoKind === 'wa' ? 'whatsapp' : 'store', pay: demoKind === 'wa' ? 'upi' : 'cash', invoice: demoKind === 'wa' ? 'yes' : null, name: '', mobile: '', address: '', step: 1, miss: {}, forceChanged: demoKind === 'changed' ? 1 : undefined };
      if (demoKind === 'offline') NH.setFlag('offline', true, true);
      if (demoKind === 'changed' || demoKind === 'offline') { ui.complete.invoice = 'no'; }
      stripDemo();
    }
    var u = ui.complete || (ui.complete = { where: null, pay: null, invoice: null, name: '', mobile: '', address: '', step: 1, miss: {} });
    var t = billTotals(), wa = u.where === 'whatsapp', B = NH.opts.complete === 'b';
    var parts = {
      where: choice('where', 'Where', [['store', 'At the counter', 'store'], ['whatsapp', 'WhatsApp order', 'whatsapp']], u.where, u.miss.where),
      pay: choice('pay', 'Paid by', [['cash', 'Cash', 'cash'], ['upi', 'UPI', 'upi'], ['card', 'Card', 'card']], u.pay, u.miss.pay),
      invoice: choice('invoice', 'Invoice', [['yes', 'Yes', 'receipt'], ['no', 'No', 'xcircle']], u.invoice, u.miss.invoice),
      customer: '<div class="list-title" style="margin-top:.2rem">Customer' + (wa ? '' : ' · optional') + '</div>' +
        field('c-name', wa ? 'Name' : 'Name (optional)', '<input class="input" id="c-name" value="' + esc(u.name) + '" autocomplete="off">', u.miss.name) +
        field('c-mobile', wa ? 'Mobile' : 'Mobile (optional)', '<div class="input-group"><span class="prefix">+91</span><input class="input" id="c-mobile" type="tel" inputmode="numeric" maxlength="10" value="' + esc(u.mobile) + '" placeholder="98765 43210"></div>', u.miss.mobile, wa ? null : 'Goes on the invoice and is used to send it on WhatsApp.') +
        (wa ? field('c-address', 'Delivery address', '<textarea class="input" id="c-address" rows="3" placeholder="House, street, town, PIN">' + esc(u.address) + '</textarea>', u.miss.address) : '')
    };
    var body;
    if (B) {
      var st = u.step;
      body = '<div class="steps3"><i class="on"></i><i class="' + (st >= 2 ? 'on' : '') + '"></i><i class="' + (st >= 3 ? 'on' : '') + '"></i></div>' +
        (st === 1 ? parts.where : st === 2 ? parts.pay + parts.invoice : parts.customer + '<div class="kv" style="margin-top:.5rem"><dt>Where</dt><dd>' + (wa ? 'WhatsApp order' : 'At the counter') + '</dd><dt>Paid by</dt><dd>' + (PAY[u.pay] ? PAY[u.pay][0] : '—') + '</dd><dt>Invoice</dt><dd>' + (u.invoice === 'yes' ? 'Yes' : 'No') + '</dd></div>');
    } else body = parts.where + parts.pay + parts.invoice + parts.customer;
    var changed = ui.changedIndex != null ? alertBox('error', 'Nothing was sold', demo.bill.lines[ui.changedIndex].code + ' was just sold on another phone. Remove it to continue.', null, '<button type="button" class="btn btn-sm btn-primary" style="margin-top:.5rem" data-rmchanged>Remove it and complete</button>') + '<div class="list" style="margin-top:.6rem">' + billLines(true) + '</div><div style="height:.8rem"></div>' : '';
    var off = offline() ? alertBox('warning', 'No internet', 'The bill is kept on this phone. Complete sale works as soon as the internet is back.', 'wifioff') + '<div style="height:.6rem"></div>' : '';
    var foot = B && u.step < 3
      ? '<button type="button" class="btn btn-primary btn-block" data-next>Next</button>' + (u.step > 1 ? '<button type="button" class="btn btn-block" data-prev>Back</button>' : '')
      : '<button type="button" class="btn btn-primary btn-block' + (state === 'loading' ? ' is-loading' : '') + '" data-done>' + (wa ? 'Create WhatsApp order' : 'Complete sale') + ' · ' + rs(t.total) + '</button>' + (B ? '<button type="button" class="btn btn-block" data-prev>Back</button>' : '');
    return {
      html: '<section class="flow">' + flowTop(wa ? 'WhatsApp order' : 'Complete sale', plural(t.n, 'saree') + ' · ' + rs(t.total), iconBtn('back', 'data-go="bill"', 'Back to the bill')) +
        '<div class="flow-body">' + (state === 'error' ? alertBox('error', 'Couldn\'t complete the sale', 'The server didn\'t answer. Nothing was sold; try again.') + '<div style="height:.6rem"></div>' : '') + off + changed + body + '</div>' +
        '<div class="flow-foot">' + foot + '</div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-c]').forEach(function (b) { b.addEventListener('click', function () { u[b.dataset.c] = b.dataset.v; u.miss[b.dataset.c] = null; render(); }); });
        [['c-name', 'name'], ['c-mobile', 'mobile'], ['c-address', 'address']].forEach(function (k) { var i = el.querySelector('#' + k[0]); i && i.addEventListener('input', function () { u[k[1]] = k[1] === 'mobile' ? i.value.replace(/\D/g, '').slice(0, 10) : i.value; }); });
        var nx = el.querySelector('[data-next]'); nx && nx.addEventListener('click', function () {
          if (u.step === 1 && !u.where) { u.miss.where = 'Choose where the sale happened.'; return render(); }
          if (u.step === 2 && (!u.pay || !u.invoice)) { u.miss.pay = u.pay ? null : 'Choose how it was paid.'; u.miss.invoice = u.invoice ? null : 'Choose whether the customer needs an invoice.'; return render(); }
          u.step += 1; render();
        });
        var pv = el.querySelector('[data-prev]'); pv && pv.addEventListener('click', function () { u.step = Math.max(1, u.step - 1); render(); });
        var rc = el.querySelector('[data-rmchanged]'); rc && rc.addEventListener('click', function () { demo.bill.lines.splice(ui.changedIndex, 1); ui.changedIndex = undefined; u.forceChanged = undefined; save(); submit(); });
        var dn = el.querySelector('[data-done]'); dn && dn.addEventListener('click', submit);
        function submit() {
          u.miss = {};
          if (!u.where) u.miss.where = 'Choose where the sale happened.';
          if (!u.pay) u.miss.pay = 'Choose how it was paid.';
          if (!u.invoice) u.miss.invoice = 'Choose whether the customer needs an invoice.';
          if (u.where === 'whatsapp') {
            if (u.name.trim().length < 2) u.miss.name = 'Enter the customer\'s name.';
            if (!/^[6-9]\d{9}$/.test(u.mobile)) u.miss.mobile = 'Enter the customer\'s 10-digit mobile number.';
            if (u.address.trim().length < 10) u.miss.address = 'Enter the full delivery address.';
          } else if (u.mobile && !/^[6-9]\d{9}$/.test(u.mobile)) u.miss.mobile = 'Enter a 10-digit mobile number, or leave it empty.';
          if (Object.keys(u.miss).some(function (k) { return u.miss[k]; })) { if (B) u.step = u.miss.where ? 1 : (u.miss.pay || u.miss.invoice) ? 2 : 3; return render(); }
          var btn = viewport.querySelector('[data-done]'); btn && btn.classList.add('is-loading');
          api.complete({ channel: u.where, pay: u.pay, invoice: u.invoice === 'yes', customer: { name: u.name.trim(), mobile: u.mobile, address: u.address.trim() }, forceChanged: u.forceChanged }).then(function (r) {
            if (r.error === 'LINE_CHANGED') { ui.changedIndex = r.index; return render(); }
            ui.changedIndex = undefined; ui.complete = undefined;
            demo.bill = { ref: ref(), lines: [] }; save(); // sold: the next customer starts a new bill
            go('sold?id=' + r.sale.id);
          }, function () { render(); toast('No internet. The bill is kept on this phone.'); });
        }
      }
    };
  };

  function lastSale(id) { return demo.sales.filter(function (s) { return s.id === (id || demo.last); })[0] || null; }

  S.sold = function (p) {
    var demoKind = p.demo;
    if (demoKind) {
      demoBill(2);
      demo.bill.lines[0].agreed = demo.bill.lines[0].store - 400;
      var o = { channel: 'store', pay: 'cash', invoice: true, failInvoice: demoKind === 'fail', customer: { name: 'Sravani', mobile: '9876543210' } };
      stripDemo();
      api.complete(o).then(function (r) {
        if (current.name !== 'sold') return;
        ui.sold = { id: r.sale.id, twice: demoKind === 'twice' };
        // The same bill sent again returns the same sale; then the bill is cleared.
        if (demoKind === 'twice') api.complete(o).then(function (r2) { if (current.name !== 'sold' || !ui.sold) return; ui.sold.repeated = r2.repeated; demo.bill = { ref: ref(), lines: [] }; save(); render(); });
        else { demo.bill = { ref: ref(), lines: [] }; save(); }
        render();
      });
      return { html: '<section class="flow">' + flowTop('Completing…', '', '') + '<div class="flow-body">' + skelRows(2) + '</div></section>' };
    }
    var u = ui.sold || {};
    var s = lastSale(p.id || u.id);
    if (!s) return { html: '<section class="flow">' + flowTop('Sold', '', iconBtn('x', 'data-go="scan"', 'Close')) + '<div class="flow-body">' + alertBox('info', 'No sale yet', 'Complete a bill first.') + '</div></section>' };
    var total = saleTotal(s), wa = s.channel === 'whatsapp', plat = flags().platform;
    return {
      html: '<section class="flow">' + flowTop(wa ? 'WhatsApp order created' : 'Sold', esc(s.order), iconBtn('x', 'data-next', 'Next customer')) +
        '<div class="flow-body"><div class="soldbox"><div class="success-mark"><svg viewBox="0 0 112 112" aria-hidden="true"><circle cx="56" cy="56" r="50"/><path d="M34 58l15 15 30-32"/></svg></div>' +
        '<div class="amt">' + rs(total) + '</div><div class="meta">' + plural(s.lines.length, 'saree') + ' · ' + PAY[s.pay][0] + ' · Order ' + esc(s.order) + '</div>' +
        '<div class="meta">' + (s.invoice ? 'Invoice ' + s.invoice : s.invoiceWanted ? '' : 'Recorded without an invoice') + '</div></div>' +
        (u.repeated ? '<div style="height:.6rem"></div>' + alertBox('info', 'Already saved', 'Complete sale was sent twice (a slow network or a double tap). It\'s the same sale: nothing was sold twice.') : '') +
        (s.invoiceWanted && !s.invoice ? '<div style="height:.6rem"></div>' + alertBox('warning', 'The invoice couldn\'t be made just now', 'The sale is saved. Make the invoice again now, or later from Today\'s sales.', null, '<button type="button" class="btn btn-sm btn-primary" style="margin-top:.5rem" data-remake>' + icon('refresh', 'icon-sm') + 'Make the invoice again</button>') : '') +
        (wa ? '<div style="height:.6rem"></div>' + alertBox('info', 'It\'s in Orders → To ship', 'Add the courier details there when it\'s packed (Module 7).', 'orders') : '') +
        (s.invoice ? '<div class="list-title">Invoice</div><div style="display:grid;gap:.5rem">' +
          (plat === 'android' ? '<button type="button" class="btn btn-wa btn-block" data-wa>' + icon('whatsapp') + 'Share on WhatsApp' + (s.customer.mobile ? ' · +91 ' + s.customer.mobile.slice(0, 5) + ' ' + s.customer.mobile.slice(5) : '') + '</button>' : '<button type="button" class="btn btn-wa btn-block" data-share>' + icon('share') + 'Share invoice</button>') +
          '<div class="share-row"><button type="button" class="btn" data-print>' + icon('print', 'icon-sm') + 'Print</button><button type="button" class="btn" data-go="invoice?id=' + s.id + '">' + icon('receipt', 'icon-sm') + 'View invoice</button></div></div>' : '') +
        '</div><div class="flow-foot"><button type="button" class="btn btn-primary btn-block" data-next>Next customer</button></div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-next]').forEach(function (b) { b.addEventListener('click', function () { demo.bill = { ref: ref(), lines: [] }; save(); ui.sold = undefined; go('scan'); }); });
        var rm = el.querySelector('[data-remake]'); rm && rm.addEventListener('click', function () { rm.classList.add('is-loading'); api.remakeInvoice(s).then(function () { render(); toast('Invoice ' + s.invoice + ' made', true); }); });
        var w = el.querySelector('[data-wa]'); w && w.addEventListener('click', function () {
          if (s.customer.mobile) return toast('Opens WhatsApp in the customer\'s chat with the invoice and a thank-you message (pretend)', true);
          sheet('<h2>Customer\'s WhatsApp number</h2><p>Not saved anywhere.</p><div class="field"><div class="input-group"><span class="prefix">+91</span><input class="input" id="wa-m" type="tel" inputmode="numeric" maxlength="10" placeholder="98765 43210"></div></div><div class="acts"><button type="button" class="btn btn-wa btn-block" data-send>' + icon('whatsapp') + 'Open WhatsApp</button><button type="button" class="btn btn-ghost btn-block" data-close>Cancel</button></div>', function (sh, close) {
            sh.querySelector('[data-send]').addEventListener('click', function () { var m = sh.querySelector('#wa-m').value.replace(/\D/g, ''); if (!/^[6-9]\d{9}$/.test(m)) return toast('Enter the 10-digit mobile number'); close(); toast('Opens WhatsApp in +91 ' + m + ' with the invoice (pretend)', true); });
          });
        });
        var sh = el.querySelector('[data-share]'); sh && sh.addEventListener('click', function () { toast('The share menu opens with the invoice PDF (pretend)', true); });
        var pr = el.querySelector('[data-print]'); pr && pr.addEventListener('click', function () { toast('The phone\'s print screen opens (pretend)', true); });
      }
    };
  };

  S.invoice = function (p) {
    if (p.demo) { stripDemo(); }
    var s = lastSale(p.id) || demo.sales.filter(function (x) { return x.invoice; }).slice(-1)[0];
    var rows = s.lines.map(function (l, i) { var pr = prod(l.pid), amt = lineTotal(l), g = gstSplit(amt); return '<tr><td>' + (i + 1) + '</td><td>' + esc(pname(pr)) + '</td><td>' + esc(l.code) + '</td><td class="n">1</td><td class="n">' + INR.format(g.taxable) + '</td><td class="n">' + INR.format(g.taxable) + '</td></tr>'; }).join('');
    var tot = s.lines.reduce(function (a, l) { var g = gstSplit(lineTotal(l)); return { taxable: a.taxable + g.taxable, cgst: a.cgst + g.cgst, sgst: a.sgst + g.sgst }; }, { taxable: 0, cgst: 0, sgst: 0 });
    var r2 = function (v) { return INR.format(Math.round(v * 100) / 100); };
    return {
      html: '<section class="flow">' + flowTop('Invoice ' + esc(s.invoice || ''), 'As the customer gets it (PDF, A4)', iconBtn('back', 'data-back', 'Back')) +
        '<div class="flow-body"><div class="a4inv' + (s.cancelled ? ' cancelled' : '') + '"><div class="head"><img src="assets/logo.png" alt=""><div><b>Nandam Handlooms</b>Hussain Katta, Mangalagiri, Andhra Pradesh, 522503, India<br>GSTIN 37CCWPN2487C1Z2</div></div>' +
        '<div class="row2"><div><h4>Invoice ' + esc(s.invoice) + '</h4>Date: ' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + '<br>Paid by: ' + PAY[s.pay][0] + '</div><div style="text-align:right">' + (s.customer.name ? '<h4>Customer</h4>' + esc(s.customer.name) + '<br>' + (s.customer.mobile ? '+91 ' + esc(s.customer.mobile) : '') : '') + '</div></div>' +
        '<table><thead><tr><th>#</th><th>Product</th><th>Tag</th><th class="n">Qty</th><th class="n">Price</th><th class="n">Subtotal</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div class="foot"><div><span>Taxable value</span><span>₹' + r2(tot.taxable) + '</span></div><div><span>CGST @ 2.5%</span><span>₹' + r2(tot.cgst) + '</span></div><div><span>SGST @ 2.5%</span><span>₹' + r2(tot.sgst) + '</span></div><div class="tot"><span>Total (GST included)</span><span>₹' + r2(saleTotal(s)) + '</span></div></div>' +
        '<div class="stamp">Thank you for shopping at Nandam Handlooms</div></div>' +
        '<p class="field-hint" style="text-align:center;margin-top:.7rem">Prices on the invoice are shown without GST; the GST lines add it back to the total paid. Same layout and sums as today\'s invoices.</p></div></section>'
    };
  };

  S.pricecheck = function () {
    var u = ui.pricecheck || (ui.pricecheck = { r: null });
    var r = u.r, p = r && r.p, x = p && sub(p.sub);
    var status = !r ? '' : r.ok ? '<span class="badge badge-success">In stock · can be sold</span>' : '<span class="badge badge-' + ({ ALREADY_SOLD: 'info', DAMAGED: 'danger', HELD_ONLINE: 'warning', ONLINE_ONLY: 'info', ON_THIS_BILL: 'info', TAG_UNKNOWN: 'warning' }[r.error]) + '">' + ({ ALREADY_SOLD: 'Already sold', DAMAGED: 'Damaged', HELD_ONLINE: 'Held online', ONLINE_ONLY: 'Online only', ON_THIS_BILL: 'On your bill', TAG_UNKNOWN: 'Unknown tag' }[r.error]) + '</span>';
    return {
      html: '<section class="flow">' + flowTop('Price check', 'Your bill stays as it is (' + plural(billTotals().n, 'saree') + ')', iconBtn('back', 'data-back', 'Back')) +
        '<div class="flow-body"><div class="sell-a" style="height:auto">' + viewfinder('Point at the saree\'s tag') +
        '<div class="scan-tools" style="grid-template-columns:1fr 1fr"><button type="button" class="btn" data-type>' + icon('keyboard', 'icon-sm') + 'Type</button><button type="button" class="btn" data-torch>' + icon('flash', 'icon-sm') + 'Torch</button></div>' + mockbar(FAKES.filter(function (f) { return f[0] !== 'again'; })) + '</div>' +
        (r ? '<div style="height:.8rem"></div><div class="list"><div class="row" style="align-items:flex-start">' + (p ? pthumb(p.img) : '<span class="pthumb">' + icon('barcode') + '</span>') + '<span class="grow"><b>' + (p ? esc(pname(p)) : 'No saree has ' + esc(r.code)) + '</b><span>' + (p ? esc(p.sku) + ' · ' : '') + esc(r.code) + '</span>' + status + '</span></div>' +
          (x ? '<div class="row"><dl class="kv" style="width:100%"><dt>Store price</dt><dd>' + rs(x.s.store) + '</dd><dt>Website price</dt><dd>' + rs(x.s.online) + '</dd><dt>MRP</dt><dd>' + rs(x.s.mrp) + '</dd></dl></div>' : '') + '</div>' : '') +
        '</div></section>',
      mount: function (el) {
        function onCode(code) { u.r = lookup(code); render(); }
        el.querySelectorAll('[data-fake]').forEach(function (b) { b.addEventListener('click', function () { fakeScan(b.dataset.fake, onCode); }); });
        el.querySelector('[data-type]').addEventListener('click', function () { typeSheet('Type the tag number', onCode); });
        el.querySelector('[data-torch]').addEventListener('click', function () { toast('Torch on (pretend)'); });
      }
    };
  };

  // Staff see only their own sales and no day total (money totals are owners only, Module 2).
  function visibleSales() { return demo.sales.filter(function (s) { return s.day === 'today' && (owner() || s.by === me()); }).slice().reverse(); }

  S.today = function () {
    var list = visibleSales();
    var dayTotal = list.filter(function (s) { return !s.cancelled; }).reduce(function (t, s) { return t + saleTotal(s); }, 0);
    var body = state === 'loading' ? skelRows(4) : (state === 'empty' || !list.length) ? '<div class="ph-tile" style="min-height:160px;align-items:center;justify-content:center;text-align:center">' + icon('history', 'icon-xl') + '<b>No sales yet today</b><span>' + (owner() ? 'Sales from every phone show here.' : 'Your sales show here.') + '</span></div>'
      : '<div class="list">' + list.map(function (s) {
        return '<button type="button" class="row salerow' + (s.cancelled ? ' cancelled' : '') + '" data-go="sale?id=' + s.id + '">' + pthumb(prod(s.lines[0].pid).img) + '<span class="grow"><b>' + esc(s.time) + ' · ' + plural(s.lines.length, 'saree') + (s.channel === 'whatsapp' ? ' <span class="badge badge-info">WhatsApp</span>' : '') + (s.cancelled ? ' <span class="badge badge-danger">Cancelled</span>' : '') + '</b><span>' + PAY[s.pay][0] + ' · ' + esc(s.by) + (s.invoice ? ' · ' + s.invoice : ' · no invoice') + '</span></span><span class="amt">' + rs(saleTotal(s)) + '</span></button>';
      }).join('') + '</div>';
    return {
      html: '<section class="scr">' + topBar('Today\'s sales', 'scan') + '<div class="scr-body narrow">' +
        (owner() ? (state === 'loading' ? '' : '<div class="totbar" style="margin-bottom:.8rem"><span><small>' + plural(list.filter(function (s) { return !s.cancelled; }).length, 'sale') + ' today</small><br><b>' + rs(dayTotal) + '</b></span><small>Cancelled sales not counted</small></div>')
          : '<div class="ro-note">' + icon('lock') + 'Your sales today. Owners see everyone\'s sales and the day\'s total.</div>') + body + '</div></section>'
    };
  };

  S.sale = function (p) {
    var demoKind = p.demo; if (demoKind) stripDemo();
    var s = demo.sales.filter(function (x) { return x.id === p.id; })[0];
    if (!s) return { html: '<section class="scr">' + topBar('', 'today') + '<div class="scr-body narrow">' + alertBox('info', 'Not found', 'This sale isn\'t here.') + '</div></section>' };
    var canCancel = owner() && s.day === 'today' && !s.cancelled;
    return {
      html: '<section class="flow">' + flowTop('Sale ' + esc(s.order || ''), esc(s.day === 'today' ? 'Today' : 'Yesterday') + ' ' + esc(s.time) + ' · ' + esc(s.by), iconBtn('back', 'data-back', 'Back')) +
        '<div class="flow-body">' + (s.cancelled ? alertBox('error', 'Cancelled', s.cancelled.reason + ' · ' + s.cancelled.by + ', ' + s.cancelled.time + '. The sarees are back in stock' + (s.invoice ? '; invoice ' + s.invoice + ' is marked CANCELLED.' : '.')) + '<div style="height:.6rem"></div>' : '') +
        '<div class="list">' + s.lines.map(function (l) { var pr = prod(l.pid); return '<div class="bline compact">' + pthumb(pr.img) + '<span class="grow"><b>' + esc(pname(pr)) + '</b>' + tagchip(l.code, s.cancelled ? '' : 'sold') + '<small>Store ' + rs(l.store) + (l.agreed != null && l.agreed !== l.store ? ' · agreed ' + rs(l.agreed) : '') + '</small></span><b>' + rs(lineTotal(l)) + '</b></div>'; }).join('') + '</div>' +
        '<div style="height:.7rem"></div><div class="list"><div class="row"><dl class="kv" style="width:100%"><dt>Total</dt><dd>' + rs(saleTotal(s)) + '</dd><dt>Paid by</dt><dd>' + PAY[s.pay][0] + '</dd><dt>Where</dt><dd>' + (s.channel === 'whatsapp' ? 'WhatsApp order' : 'At the counter') + '</dd><dt>Invoice</dt><dd>' + (s.invoice || 'Not wanted') + '</dd>' + (s.customer.name ? '<dt>Customer</dt><dd>' + esc(s.customer.name) + '</dd>' : '') + '</dl></div></div>' +
        (s.invoice ? '<div class="share-row" style="margin-top:.7rem"><button type="button" class="btn" data-go="invoice?id=' + s.id + '">' + icon('receipt', 'icon-sm') + 'View invoice</button><button type="button" class="btn" data-sharei>' + icon('share', 'icon-sm') + 'Share</button></div>' : '') +
        (canCancel ? '<div style="height:1.3rem"></div><button type="button" class="btn btn-danger btn-block" data-cancel>' + icon('xcircle') + 'Cancel sale</button>' : '') +
        (!owner() && !s.cancelled ? '<div class="lock-note" style="margin-top:1rem">' + icon('lock') + '<span>Ask an owner to cancel this sale.</span></div>' : '') +
        (owner() && s.day !== 'today' && !s.cancelled ? '<div class="lock-note" style="margin-top:1rem">' + icon('clock') + '<span>Sales can be cancelled only on the day they were made.</span></div>' : '') +
        '</div></section>',
      mount: function (el) {
        var sh = el.querySelector('[data-sharei]'); sh && sh.addEventListener('click', function () { toast('Share menu with the invoice PDF (pretend)', true); });
        var c = el.querySelector('[data-cancel]'); c && c.addEventListener('click', cancelSheet);
        if (demoKind === 'cancel' && canCancel) after(cancelSheet, 350);
        function cancelSheet() {
          var reasons = ['Customer changed their mind', 'Wrong saree', 'Wrong price', 'Billed twice by mistake'];
          var pick = null;
          sheet('<h2>Cancel this sale?</h2><p>' + plural(s.lines.length, 'saree goes', 'sarees go') + ' back in stock' + (s.invoice ? ' and invoice ' + s.invoice + ' is marked CANCELLED (kept, never deleted)' : '') + '. Why?</p><div class="reason-list">' + reasons.map(function (r, i) { return '<button type="button" data-r="' + i + '" aria-pressed="false">' + r + '</button>'; }).join('') + '</div>' +
            '<div class="sheet-acts"><button type="button" class="btn btn-danger-solid btn-block" data-yes disabled>Cancel sale</button><button type="button" class="btn btn-ghost btn-block" data-close>Keep the sale</button></div>', function (shEl, close) {
            shEl.querySelectorAll('[data-r]').forEach(function (b) { b.addEventListener('click', function () { pick = reasons[+b.dataset.r]; shEl.querySelectorAll('[data-r]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); shEl.querySelector('[data-yes]').disabled = false; }); });
            shEl.querySelector('[data-yes]').addEventListener('click', function (ev) {
              ev.currentTarget.classList.add('is-loading');
              api.cancel(s, pick).then(function () { close(); render(); toast('Sale cancelled · ' + plural(s.lines.length, 'saree') + ' back in stock', true); }, function () { close(); toast('No internet. Cancelling needs internet.'); });
            });
          });
        }
      }
    };
  };

  /* ================= Render ================= */
  var FULL = { bill: 1, complete: 1, sold: 1, invoice: 1, pricecheck: 1, sale: 1 };
  function bindGo(scope) {
    scope.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.go); }); });
    scope.querySelectorAll('[data-back]').forEach(function (b) { b.addEventListener('click', back); });
  }
  function render() {
    timers.forEach(function (t) { clearTimeout(t); }); timers = [];
    closers = [];
    Array.prototype.slice.call(overlays.children).forEach(function (c) { if (!c.classList.contains('app-toast')) c.remove(); });
    var name = current.name, fn = S[name] || S.scan;
    var scr = fn(current.params || {});
    viewport.innerHTML = FULL[name] ? scr.html : shell(scr.html);
    var el = viewport.querySelector('.scr, .flow') || viewport.firstElementChild;
    bindGo(viewport);
    viewport.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { var t = b.dataset.tab; if (t === 'scan') go('scan'); else if (t === 'products') toast('Products was built in Module 4'); else toast('This tab is another module'); }); });
    scr.mount && scr.mount(el);
    var spec = window.NH_SCREENS.filter(function (s) { return NH_ROUTE(s).split('?')[0] === name; });
    if (state !== 'normal' && spec.length && !spec.some(function (s) { return s.states.indexOf(state) >= 0; })) NH.toast('"' + state + '" isn\'t a state of this screen. Try: ' + (spec.map(function (s) { return s.states.join(', '); }).filter(Boolean).join(', ') || 'none'));
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && closers.length) { closers[closers.length - 1](); e.stopPropagation(); } });

  window.NHApp = {
    setState: function (s) { state = s; ui[current.name] = undefined; render(); },
    go: go,
    action: function (name) { if (name === 'reset') { demo = freshDemo(); save(); ui = {}; go('scan'); } }
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
