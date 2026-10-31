/* Module 6 (Invoices and the sales summary): the clickable app.
   Real sarees, tags, prices and photos (copy of 11 Oct 2026); the invoices, customers
   and dates are sample. A small pretend backend applies the plan's rules: invoice date
   in India time for both the list and the summary, cancelled invoices listed but not
   counted, Staff without totals or summary, "make an invoice later" only in the sale's
   month, "correct the customer" only in the invoice's month (owners). */
(function () {
  'use strict';
  var NH = window.NH;
  var EMBED = /[?&]embed=1/.test(location.search);
  var DEMO_KEY = 'nh-m6-demo';
  var GST = 5;
  var TODAY = '2026-10-11';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ================= Catalogue and sample invoices ================= */
  var SUBS = {};
  window.NH_CATALOG.categories.forEach(function (c) { c.subs.forEach(function (s) { SUBS[s.id] = s; }); });
  // Real sarees with photos; "Gap Border" is left out (its ₹54,310 price is a known typo).
  var POOL = window.NH_PRODUCTS.filter(function (p) { return p.img && p.sub !== 'b6b360c9'; });

  function freshDemo() {
    var k = 0;
    function take(n, factors, online) {
      var out = [];
      for (var i = 0; i < n; i++) {
        // Each saree is sold once: 13 shares no factor with the pool size, so no repeats.
        var p = POOL[(k++ * 13) % POOL.length], s = SUBS[p.sub];
        var store = online ? s.online : s.store, f = factors && factors[i];
        out.push({ pid: p.id, code: p.tags[0][0], name: s.name, img: p.img, store: store, price: f ? Math.round(store * f / 50) * 50 : store });
      }
      return out;
    }
    var inv = [], sales = [], n = 0;
    function add(d, t, ch, o) {
      n += 1;
      var x = { id: 'i' + String(n).padStart(2, '0'), no: 'INV-' + String(n).padStart(6, '0'), d: d, t: t, ch: ch, pay: o.pay || null, cust: o.cust || {}, lines: o.lines, by: o.by || 'Lakshmi',
        order: 'NH' + String(40718000 + n * 377).slice(0, 8), cancelled: o.cancelled || null, sale: 's' + n, late: o.late || null };
      inv.push(x); return x;
    }
    // September (made by the old app: payment mode not recorded, no names at the counter).
    add('2026-09-06', '11:20 am', 'store', { lines: take(3, [0.6, 0.55]) });
    add('2026-09-09', '5:05 pm', 'whatsapp', { cust: { mobile: '9848012345' }, lines: take(1, [0.7]), by: 'Ravi' });
    add('2026-09-14', '12:40 pm', 'store', { lines: take(6, [0.5, 0.5, 0.6, 0.6]) });
    add('2026-09-18', '7:15 pm', 'online', { cust: { name: 'Harika Reddy', mobile: '9000011122', address: '8-2-293, Road No. 12, Banjara Hills, Hyderabad 500034' }, lines: take(1, null, true), by: null });
    add('2026-09-23', '3:30 pm', 'whatsapp', { cust: { mobile: '9701234567' }, lines: take(2, [0.65, 0.65]), by: 'Ravi' });
    add('2026-09-28', '6:10 pm', 'store', { lines: take(4, [0.55, 0.55, 0.5]) });
    // October, old app.
    add('2026-10-02', '11:05 am', 'store', { lines: take(12, [0.5, 0.5, 0.55, 0.55, 0.6, 0.45, 0.5, 0.5]) });
    add('2026-10-04', '4:45 pm', 'whatsapp', { cust: { mobile: '9866011223' }, lines: take(1, [0.8]), by: 'Ravi' });
    add('2026-10-05', '10:30 am', 'whatsapp', { cust: { mobile: '9440155667' }, lines: take(2, [0.6, 0.7]) });
    [['2026-10-06', '2:15 pm', 'store', 2], ['2026-10-06', '6:40 pm', 'whatsapp', 1], ['2026-10-07', '12:10 pm', 'store', 5], ['2026-10-08', '11:45 am', 'store', 3], ['2026-10-08', '5:20 pm', 'whatsapp', 2],
      ['2026-10-09', '1:05 pm', 'store', 1], ['2026-10-09', '7:30 pm', 'whatsapp', 3], ['2026-10-10', '10:15 am', 'store', 4], ['2026-10-10', '3:50 pm', 'whatsapp', 1], ['2026-10-10', '6:05 pm', 'store', 2]].forEach(function (r, i) {
      add(r[0], r[1], r[2], { cust: r[2] === 'whatsapp' ? { mobile: '98' + String(48100000 + i * 1371).slice(0, 8) } : {}, lines: take(r[3], [0.6, 0.55, 0.7]), by: i % 2 ? 'Ravi' : 'Lakshmi' });
    });
    add('2026-10-10', '9:12 pm', 'online', { cust: { name: 'Kavya Sri', mobile: '9989012345', address: 'D.No 12-4, Brodipet 4th Lane, Guntur 522002' }, lines: take(1, null, true), by: null });
    // Today, the new app (payment mode, names, cancel).
    add(TODAY, '10:42 am', 'store', { pay: 'cash', cust: { name: 'Sita Devi' }, lines: take(2, [0.7]), cancelled: { reason: 'Wrong saree', by: 'Lakshmi', time: '11:05 am' } });
    add(TODAY, '12:05 pm', 'store', { pay: 'upi', lines: take(1, [0.6]), by: 'Ravi' });
    add(TODAY, '2:30 pm', 'whatsapp', { pay: 'upi', cust: { name: 'Padma', mobile: '9123456780', address: 'Flat 3B, Sai Residency, Lakshmipuram, Guntur 522007' }, lines: take(2, [0.65]) });
    add(TODAY, '4:12 pm', 'store', { pay: 'cash', cust: { name: 'Sravani', mobile: '9876543210' }, lines: take(3, [0.75, null, 0.6]) });
    // Sales recorded without an invoice (decision 6.3 shows them; 6.5 makes one later).
    function sale(id, d, t, ch, pay, nl, by) { sales.push({ id: id, d: d, t: t, ch: ch, pay: pay, lines: take(nl, [0.6, 0.55]), by: by, order: 'NH' + String(51230000 + sales.length * 911).slice(0, 8), invoice: null }); }
    sale('n1', '2026-09-28', '7:40 pm', 'store', null, 2, 'Ravi');
    sale('n2', '2026-10-03', '1:15 pm', 'store', null, 3, 'Lakshmi');
    sale('n4', '2026-10-07', '5:35 pm', 'whatsapp', null, 1, 'Ravi');
    sale('n5', '2026-10-09', '11:50 am', 'store', null, 4, 'Lakshmi');
    sale('n6', '2026-10-10', '4:25 pm', 'store', null, 2, 'Ravi');
    sale('n3', TODAY, '1:20 pm', 'store', 'card', 2, 'Ravi');
    return { inv: inv, sales: sales, next: n + 1 };
  }
  var demo = load();
  function load() { try { var d = JSON.parse(sessionStorage.getItem(DEMO_KEY)); if (d && d.inv) return d; } catch (e) { } return freshDemo(); }
  function save() { try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch (e) { } }

  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function flags() { return NH.flags(); }
  function offline() { return !!flags().offline; }
  function owner() { return flags().viewAs !== 'staff'; }
  function me() { return owner() ? 'Lakshmi' : 'Ravi'; }
  function invById(id) { return demo.inv.filter(function (x) { return x.id === id; })[0] || null; }
  function saleById(id) { return demo.sales.filter(function (x) { return x.id === id; })[0] || null; }

  /* ================= Money, dates, GST ================= */
  var INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  var INR2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function rs(v) { return v == null || v === '' ? '—' : '₹' + INR.format(v); }
  function rs2(v) { return '₹' + INR2.format(v); }
  function paise(v) { return Math.round(v * 100); }
  function total(x) { return x.lines.reduce(function (t, l) { return t + l.price; }, 0); }
  function split(a) { var tx = Math.round(a / (1 + GST / 100) * 100) / 100, g = Math.round((a - tx) * 100) / 100, c = Math.round(g / 2 * 100) / 100; return { taxable: tx, cgst: c, sgst: Math.round((g - c) * 100) / 100 }; }
  function gstOf(lines) { var o = { taxable: 0, cgst: 0, sgst: 0 }; lines.forEach(function (l) { var s = split(l.price); o.taxable += paise(s.taxable); o.cgst += paise(s.cgst); o.sgst += paise(s.sgst); }); return { taxable: o.taxable / 100, cgst: o.cgst / 100, sgst: o.sgst / 100 }; }
  function dd(d) { var p = d.split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function ddShort(d) { if (d === TODAY) return 'Today'; if (d === '2026-10-10') return 'Yesterday'; var p = d.split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1]; }
  function monthOf(d) { return d.slice(0, 7); }
  function sameMonthAsToday(d) { return monthOf(d) === monthOf(TODAY); }
  var PERIODS = { today: ['Today', TODAY, TODAY], month: ['This month', '2026-10-01', TODAY], last: ['Last month', '2026-09-01', '2026-09-30'], all: ['All', '2000-01-01', TODAY] };
  var CH = { store: ['Counter', 'store'], whatsapp: ['WhatsApp', 'whatsapp'], online: ['Online', 'cloud'] };
  var PAY = { cash: 'Cash', upi: 'UPI', card: 'Card' };
  function custName(x) { return x.cust.name || (x.ch === 'whatsapp' ? 'WhatsApp customer' : x.ch === 'online' ? 'Online customer' : 'Walk-in customer'); }
  function fmtMobile(m) { return m ? '+91 ' + m.slice(0, 5) + ' ' + m.slice(5) : ''; }

  // The same query for the list and the summary: invoice date, India time.
  function inPeriod(x, from, to) { return x.d >= from && x.d <= to; }
  function filterInv(f) {
    var q = (f.q || '').trim().toUpperCase().replace(/\s+/g, '');
    return demo.inv.filter(function (x) {
      if (q) {
        var digits = /^\d+$/.test(q);
        // Short numbers are invoice numbers (17 → INV-000017); 5+ digits also match a mobile or an order number.
        var hit = (digits && (+x.no.slice(4) === +q || (q.length >= 5 && ((x.cust.mobile || '').indexOf(q) >= 0 || x.order.indexOf(q) >= 0)))) ||
          x.no === q || x.order === q || (custName(x).toUpperCase().replace(/\s+/g, '').indexOf(q) >= 0 && !!x.cust.name) ||
          x.lines.some(function (l) { return l.code === q || (digits && l.code === 'NH' + q); });
        if (!hit) return false;
      } else if (!inPeriod(x, f.from, f.to)) return false;
      if (f.ch && f.ch !== 'all' && x.ch !== f.ch) return false;
      if (f.cancelled && !x.cancelled) return false;
      return true;
    }).sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : b.no.localeCompare(a.no); });
  }
  function totalsOf(list) {
    var live = list.filter(function (x) { return !x.cancelled; });
    var g = gstOf([].concat.apply([], live.map(function (x) { return x.lines; })));
    var t = live.reduce(function (s, x) { return s + paise(total(x)); }, 0) / 100;
    var byCh = {}, byPay = { cash: 0, upi: 0, card: 0, none: 0 };
    live.forEach(function (x) { byCh[x.ch] = (byCh[x.ch] || 0) + total(x); byPay[x.pay || 'none'] += total(x); });
    return { count: live.length, cancelled: list.length - live.length, total: t, gst: g, byCh: byCh, byPay: byPay, sarees: live.reduce(function (s, x) { return s + x.lines.length; }, 0) };
  }
  function noInvoiceIn(from, to, chs) {
    var list = demo.sales.filter(function (s) { return !s.invoice && s.d >= from && s.d <= to && (!chs || chs.indexOf(s.ch) >= 0); });
    return { count: list.length, total: list.reduce(function (t, s) { return t + total(s); }, 0) };
  }

  /* ================= Pretend backend ================= */
  var DROP = function () { return new Promise(function () { }); };
  function net() { if (offline()) { var e = new Error('offline'); e.code = 'offline'; throw e; } }
  var api = {
    correct: function (x, name, mobile) { var d0 = demo; return wait(800).then(function () { if (demo !== d0) return DROP(); net(); x.cust = Object.assign({}, x.cust, { name: name || undefined, mobile: mobile || undefined }); x.corrected = true; save(); return x; }); },
    makeLater: function (s) {
      var d0 = demo;
      return wait(900).then(function () {
        if (demo !== d0) return DROP(); net();
        var n = demo.next++;
        var x = { id: 'i' + String(n).padStart(2, '0'), no: 'INV-' + String(n).padStart(6, '0'), d: TODAY, t: new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }), ch: s.ch, pay: s.pay, cust: {}, lines: s.lines, by: s.by, order: s.order, cancelled: null, sale: s.id, late: { saleDate: s.d } };
        demo.inv.push(x); s.invoice = x.id; save(); return x;
      });
    },
    summary: function () { return wait(1000).then(function () { net(); return true; }); }
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
  function skelRows(n) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="skel-row"><div class="skeleton" style="width:40px;height:40px;border-radius:10px"></div><div style="flex:1"><div class="skeleton" style="height:14px;width:55%;margin-bottom:6px"></div><div class="skeleton" style="height:11px;width:35%"></div></div></div>'; return '<div class="list">' + h + '</div>'; }
  function emptyCard(ic, title, text, extra) { return '<div class="ph-tile" style="min-height:150px;align-items:center;justify-content:center;text-align:center;gap:.4rem">' + icon(ic, 'icon-xl') + '<b>' + title + '</b><span>' + text + '</span>' + (extra || '') + '</div>'; }
  function chBadge(ch) { return '<span class="badge badge-' + (ch === 'whatsapp' ? 'success' : ch === 'online' ? 'info' : 'neutral') + '">' + CH[ch][0] + '</span>'; }

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

  // Calendar for custom dates: tap the first day, then the last. No future days.
  function calendarSheet(start, onPick) {
    var view = (start && start.from ? start.from : TODAY).slice(0, 7), from = start ? start.from : null, to = start ? start.to : null;
    function days() {
      var y = +view.slice(0, 4), m = +view.slice(5, 7), first = new Date(y, m - 1, 1).getDay(), count = new Date(y, m, 0).getDate();
      var h = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (d) { return '<span class="cal-h">' + d + '</span>'; }).join('');
      for (var i = 0; i < (first + 6) % 7; i++) h += '<span></span>';
      for (var d = 1; d <= count; d++) {
        var iso = view + '-' + String(d).padStart(2, '0');
        var cls = (iso === from || iso === to) ? ' sel' : (from && to && iso > from && iso < to) ? ' mid' : '';
        h += '<button type="button" class="cal-d' + cls + (iso === TODAY ? ' today' : '') + '" data-day="' + iso + '"' + (iso > TODAY ? ' disabled' : '') + '>' + d + '</button>';
      }
      return h;
    }
    function label() { return from ? (to && to !== from ? dd(from) + ' – ' + dd(to) : dd(from) + (to ? '' : ' – tap the last day')) : 'Tap the first day'; }
    sheet('<h2>Custom dates</h2><p class="cal-sel" data-lbl>' + label() + '</p><div class="cal-nav"><button type="button" class="icon-btn" data-m="-1" aria-label="Previous month">' + icon('left') + '</button><b data-mon></b><button type="button" class="icon-btn" data-m="1" aria-label="Next month">' + icon('right') + '</button></div>' +
      '<div class="cal" data-cal></div><p class="field-hint">Whole days in India time: from 00:00 on the first day to 23:59 on the last.</p><div class="sheet-acts"><button type="button" class="btn btn-primary btn-block" data-use disabled>Use these dates</button><button type="button" class="btn btn-ghost btn-block" data-close>Cancel</button></div>', function (el, close) {
      function draw() {
        el.querySelector('[data-cal]').innerHTML = days();
        el.querySelector('[data-mon]').textContent = MONTHS_LONG[+view.slice(5, 7) - 1] + ' ' + view.slice(0, 4);
        el.querySelector('[data-lbl]').textContent = label();
        el.querySelector('[data-use]').disabled = !from;
        el.querySelector('[data-m="1"]').disabled = view >= TODAY.slice(0, 7);
      }
      el.addEventListener('click', function (e) {
        var m = e.target.closest('[data-m]');
        if (m) { var y = +view.slice(0, 4), mo = +view.slice(5, 7) + +m.dataset.m; if (mo < 1) { mo = 12; y--; } if (mo > 12) { mo = 1; y++; } view = y + '-' + String(mo).padStart(2, '0'); draw(); return; }
        var d = e.target.closest('[data-day]');
        if (d) { var iso = d.dataset.day; if (!from || (from && to)) { from = iso; to = null; } else if (iso < from) { to = from; from = iso; } else to = iso; draw(); return; }
        if (e.target.closest('[data-use]')) { close(); onPick({ from: from, to: to || from }); }
      });
      draw();
    });
  }

  /* ================= Router ================= */
  var current = { name: '', params: {} }, state = 'normal', ui = {}, timers = [], stack = [];
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), q = h.split('?'), p = {};
    (q[1] || '').split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); p[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
    return { name: q[0] || 'invoices', params: p };
  }
  function go(route) { if (('#/' + route) === location.hash) render(); else location.hash = '#/' + route; }
  function back() { if (stack.length > 1) history.back(); else go('invoices'); }
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
    var tab = 'more';
    var tabs = TABS.map(function (t) {
      var cur = t[0] === tab ? ' aria-current="page"' : '';
      if (t[0] === 'scan') return '<button type="button" class="scan-tab" data-tab="scan"' + cur + ' aria-label="Scan"><span class="scan-ico">' + icon('scan') + '</span></button>';
      return '<button type="button" data-tab="' + t[0] + '"' + cur + '>' + icon(t[1]) + t[2] + '</button>';
    }).join('');
    var rail = '<nav class="rail" aria-label="Main menu"><img src="assets/logo.png" alt="Nandam Handlooms">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + icon(t[1]) + t[2] + '</button>'; }).join('') + '</nav>';
    var bar = offline() ? '<div class="saved-bar">' + icon('wifioff') + 'Offline · invoices need internet to load, share or change.</div>' : '';
    return '<div class="shell">' + rail + '<div class="shell-main">' + bar + inner + '</div><nav class="tabbar" aria-label="Main menu">' + tabs + '</nav></div>';
  }

  /* ================= Screens ================= */
  var S = {};

  function invRow(x) {
    return '<button type="button" class="row invrow' + (x.cancelled ? ' cancelled' : '') + '" data-go="invoice?id=' + x.id + '"><span class="inv-ico">' + icon(CH[x.ch][1]) + '</span><span class="grow"><b>' + x.no + ' ' + chBadge(x.ch) + (x.cancelled ? ' <span class="badge badge-danger">Cancelled</span>' : '') + '</b><span>' + esc(custName(x)) + ' · ' + ddShort(x.d) + ', ' + x.t + '</span></span><span class="amt">' + rs(total(x)) + '</span></button>';
  }

  S.invoices = function (p) {
    if (p.demo === 'calendar') { ui.invoices = { period: 'custom', from: '2026-10-01', to: '2026-10-05', ch: 'all' }; stripDemo(); after(function () { openCal(); }, 300); }
    if (p.demo) stripDemo();
    var u = ui.invoices || (ui.invoices = { period: 'month', ch: 'all', q: p.q || '', cancelled: false });
    var per = u.period === 'custom' ? ['Custom', u.from, u.to] : PERIODS[u.period];
    var list = state === 'empty' ? [] : filterInv({ q: u.q, from: per[1], to: per[2], ch: u.ch, cancelled: u.cancelled });
    var t = totalsOf(list);
    var periodLabel = u.q ? 'All dates' : u.period === 'custom' ? dd(u.from) + (u.to !== u.from ? ' – ' + dd(u.to) : '') : per[0];
    var head = owner()
      ? '<div class="inv-total"><span><small>' + periodLabel + ' · ' + plural(t.count, 'invoice') + '</small><b>' + rs(t.total) + '</b></span><small>' + (t.cancelled ? plural(t.cancelled, 'cancelled invoice') + ', not counted' : 'Cancelled invoices never counted') + '</small></div>'
      : '<div class="ro-note">' + icon('lock') + 'Open, share and print any invoice. Money totals and the sales summary are for owners.</div>';
    var rows;
    if (state === 'loading') rows = skelRows(5);
    else if (state === 'error') rows = alertBox('error', 'Couldn\'t load the invoices', 'Check the internet and try again.', null, '<button type="button" class="btn btn-sm" style="margin-top:.5rem" data-retry>' + icon('refresh', 'icon-sm') + 'Try again</button>');
    else if (!list.length) rows = u.q ? emptyCard('search', 'No invoice matches "' + esc(u.q) + '"', 'Try the invoice number (like 17), the mobile, the customer\'s name or a saree\'s tag.') : emptyCard('receipt', 'No invoices ' + (u.period === 'today' ? 'today yet' : 'in this period'), 'Invoices made at the counter, for WhatsApp orders and online show here.');
    else if (NH.opts.listStyle === 'b') {
      var days = {}, order = [];
      list.forEach(function (x) { if (!days[x.d]) { days[x.d] = []; order.push(x.d); } days[x.d].push(x); });
      rows = order.map(function (d) { var dt = totalsOf(days[d]); return '<div class="day-head"><b>' + ddShort(d) + (d !== TODAY && d !== '2026-10-10' ? '' : ' · ' + dd(d)) + '</b>' + (owner() ? '<span>' + plural(dt.count, 'invoice') + ' · ' + rs(dt.total) + '</span>' : '') + '</div><div class="list">' + days[d].map(invRow).join('') + '</div>'; }).join('');
    } else rows = '<div class="list">' + list.map(invRow).join('') + '</div>';
    var chip = function (k, v, label) { return '<button type="button" class="fchip" data-' + k + '="' + v + '" aria-pressed="' + (u[k === 'per' ? 'period' : k] === v) + '">' + label + '</button>'; };
    return {
      html: '<section class="scr">' + topBar('Invoices', 'more', owner() ? '<button type="button" class="btn btn-sm btn-ghost top-act" data-go="summary">' + icon('chart', 'icon-sm') + 'Summary</button>' : '') +
        '<div class="scr-body narrow">' +
        '<div class="search-row"><div class="search">' + icon('search') + '<input class="input" type="search" id="i-q" placeholder="Number, name, mobile or tag" autocomplete="off" value="' + esc(u.q) + '" aria-label="Search invoices"></div></div>' +
        (u.q ? '<p class="field-hint" style="margin:.4rem 0 .2rem">Searching every date.</p>' : '<div class="chips-row" style="margin-top:.6rem">' + chip('per', 'today', 'Today') + chip('per', 'month', 'This month') + chip('per', 'last', 'Last month') + '<button type="button" class="fchip" data-cal aria-pressed="' + (u.period === 'custom') + '">' + icon('calendar', 'icon-sm') + (u.period === 'custom' ? periodLabel : 'Custom') + '</button>' + chip('per', 'all', 'All') + '</div>') +
        '<div class="chips-row">' + chip('ch', 'all', 'All channels') + chip('ch', 'store', 'Counter') + chip('ch', 'whatsapp', 'WhatsApp') + chip('ch', 'online', 'Online') + '<button type="button" class="fchip" data-canc aria-pressed="' + u.cancelled + '">Cancelled</button></div>' +
        (state === 'loading' ? '' : head) + rows +
        (list.length ? '<p class="list-end">' + (list.length >= 30 ? '<button type="button" class="btn btn-sm">Show more</button>' : 'That\'s all ' + plural(list.length, 'invoice') + '.') + '</p>' : '') + '</div></section>',
      mount: function (el) {
        var q = el.querySelector('#i-q'), timer;
        q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { u.q = q.value; render(); var n = viewport.querySelector('#i-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); });
        el.querySelectorAll('[data-per]').forEach(function (b) { b.addEventListener('click', function () { u.period = b.dataset.per; render(); }); });
        el.querySelectorAll('[data-ch]').forEach(function (b) { b.addEventListener('click', function () { u.ch = b.dataset.ch; render(); }); });
        var c = el.querySelector('[data-canc]'); c && c.addEventListener('click', function () { u.cancelled = !u.cancelled; render(); });
        var cal = el.querySelector('[data-cal]'); cal && cal.addEventListener('click', openCal);
        var r = el.querySelector('[data-retry]'); r && r.addEventListener('click', function () { state = 'normal'; render(); });
      }
    };
    function openCal() { calendarSheet(u.period === 'custom' ? { from: u.from, to: u.to } : null, function (v) { u.period = 'custom'; u.from = v.from; u.to = v.to; render(); }); }
  };

  function lineRow(l, cancelled) {
    return '<div class="bline compact">' + pthumb(l.img) + '<span class="grow"><b>' + esc(l.name) + '</b>' + tagchip(l.code, cancelled ? '' : 'sold') + '<small>' + (l.price !== l.store ? 'Store ' + rs(l.store) + ' · agreed ' + rs(l.price) : 'At the store price') + '</small></span><b class="lp">' + rs(l.price) + '</b></div>';
  }
  function canCorrect(x) { return owner() && !x.cancelled && sameMonthAsToday(x.d); }

  S.invoice = function (p) {
    var x = invById(p.id);
    var demoCorrect = p.demo === 'correct';
    if (p.demo) stripDemo();
    if (!x) return { html: '<section class="flow">' + flowTop('Invoice', '', iconBtn('back', 'data-back', 'Back')) + '<div class="flow-body">' + alertBox('info', 'Not found', 'This invoice isn\'t here.') + '</div></section>' };
    if (state === 'loading') return { html: '<section class="flow">' + flowTop(x.no, '', iconBtn('back', 'data-back', 'Back')) + '<div class="flow-body">' + skelRows(4) + '</div></section>' };
    if (state === 'error') return { html: '<section class="flow">' + flowTop(x.no, '', iconBtn('back', 'data-back', 'Back')) + '<div class="flow-body">' + alertBox('error', 'Couldn\'t open the invoice', 'Check the internet and try again.') + '</div></section>' };
    var g = gstOf(x.lines), t = total(x), plat = flags().platform, wa = x.ch === 'whatsapp';
    var cust = '<div class="list"><div class="row"><span class="inv-ico">' + icon('user') + '</span><span class="grow"><b>' + esc(custName(x)) + (x.corrected ? ' <span class="badge badge-neutral">corrected</span>' : '') + '</b><span>' + (x.cust.mobile ? fmtMobile(x.cust.mobile) : 'No mobile') + (x.cust.address ? '<br>' + esc(x.cust.address) : '') + '</span></span></div></div>';
    var facts = '<div class="list"><div class="row"><dl class="kv" style="width:100%">' +
      '<dt>Taxable value</dt><dd>' + rs2(g.taxable) + '</dd><dt>CGST @ 2.5%</dt><dd>' + rs2(g.cgst) + '</dd><dt>SGST @ 2.5%</dt><dd>' + rs2(g.sgst) + '</dd><dt><b>Total (GST included)</b></dt><dd><b>' + rs2(t) + '</b></dd></dl></div>' +
      '<div class="row"><dl class="kv" style="width:100%"><dt>Paid by</dt><dd>' + (x.pay ? PAY[x.pay] : x.ch === 'online' ? 'Online payment' : 'Not recorded (old app)') + '</dd><dt>Where</dt><dd>' + (x.ch === 'store' ? 'At the counter' : x.ch === 'whatsapp' ? 'WhatsApp order' : 'Website') + '</dd><dt>Order</dt><dd>' + x.order + '</dd>' + (x.by ? '<dt>Sold by</dt><dd>' + x.by + '</dd>' : '') + (x.late ? '<dt>Sale date</dt><dd>' + dd(x.late.saleDate) + '</dd>' : '') + '</dl></div></div>';
    var share = x.cancelled ? '' : '<div class="list-title">Send or print</div><div style="display:grid;gap:.5rem">' +
      (plat === 'android' ? '<button type="button" class="btn btn-wa btn-block" data-wa>' + icon('whatsapp') + 'Share on WhatsApp' + (x.cust.mobile ? ' · ' + fmtMobile(x.cust.mobile) : '') + '</button>' : '<button type="button" class="btn btn-wa btn-block" data-share>' + icon('share') + 'Share invoice</button>') +
      '<div class="share-row"><button type="button" class="btn" data-print>' + icon('print', 'icon-sm') + 'Print</button>' + (plat === 'android' ? '<button type="button" class="btn" data-share>' + icon('share', 'icon-sm') + 'Share another way</button>' : '<button type="button" class="btn" data-go="pdf?id=' + x.id + '">' + icon('pdf', 'icon-sm') + 'View the PDF</button>') + '</div></div>';
    var more = '<div class="list" style="margin-top:.9rem">' +
      '<button type="button" class="row" data-go="pdf?id=' + x.id + '"><span class="inv-ico">' + icon('pdf') + '</span><span class="grow"><b>View the PDF</b><span>As the customer gets it' + (x.cancelled ? ', stamped CANCELLED' : '') + '</span></span>' + icon('right', 'icon-sm') + '</button>' +
      (x.ch === 'online' ? '<button type="button" class="row" data-tab-msg="Opens the order in Orders (Module 7)"><span class="inv-ico">' + icon('orders') + '</span><span class="grow"><b>Open the order</b><span>Shipping and tracking (Module 7)</span></span>' + icon('right', 'icon-sm') + '</button>'
        : '<button type="button" class="row" data-tab-msg="Opens the sale (Module 5): cancel is there for owners, the same day"><span class="inv-ico">' + icon('receipt') + '</span><span class="grow"><b>Open the sale</b><span>Cancel is there (owners, the same day)</span></span>' + icon('right', 'icon-sm') + '</button>') +
      (canCorrect(x) ? '<button type="button" class="row" data-correct><span class="inv-ico">' + icon('edit') + '</span><span class="grow"><b>Correct the customer</b><span>Name or mobile; same number and amounts</span></span>' + icon('right', 'icon-sm') + '</button>' : '') + '</div>' +
      (owner() && !x.cancelled && !sameMonthAsToday(x.d) ? '<div class="lock-note">' + icon('clock') + '<span>The customer can be corrected only in the invoice\'s own month (' + MONTHS_LONG[+x.d.slice(5, 7) - 1] + ').</span></div>' : '');
    return {
      html: '<section class="flow">' + flowTop(x.no, ddShort(x.d) + ', ' + x.t + ' · ' + CH[x.ch][0], iconBtn('back', 'data-back', 'Back')) +
        '<div class="flow-body">' +
        (x.cancelled ? alertBox('error', 'Cancelled', esc(x.cancelled.reason) + ' · ' + x.cancelled.by + ', ' + x.cancelled.time + '. Kept with its number; never counted in totals.') + '<div style="height:.6rem"></div>' : '') +
        (x.late ? alertBox('info', 'Made later', 'For a sale on ' + dd(x.late.saleDate) + ' recorded without an invoice.') + '<div style="height:.6rem"></div>' : '') +
        '<div class="inv-hero"><b>' + rs(t) + '</b><span>' + plural(x.lines.length, 'saree') + (x.lines.some(function (l) { return l.price !== l.store; }) ? ' · ' + rs(x.lines.reduce(function (s, l) { return s + Math.max(0, l.store - l.price); }, 0)) + ' off the store price' : '') + '</span></div>' +
        '<div class="list-title">Customer</div>' + cust +
        '<div class="list-title">Sarees</div><div class="list">' + x.lines.map(function (l) { return lineRow(l, !!x.cancelled); }).join('') + '</div>' +
        '<div class="list-title">GST and payment</div>' + facts + share + more + '</div></section>',
      mount: function (el) {
        var w = el.querySelector('[data-wa]'); w && w.addEventListener('click', function () {
          if (x.cust.mobile) return toast('Opens WhatsApp in ' + fmtMobile(x.cust.mobile) + '\'s chat with ' + x.no + ' attached (pretend)', true);
          sheet('<h2>Customer\'s WhatsApp number</h2><p>The invoice opens in their chat. The number isn\'t saved anywhere.</p><div class="field"><div class="input-group"><span class="prefix">+91</span><input class="input" id="wa-m" type="tel" inputmode="numeric" maxlength="10" placeholder="98765 43210"></div></div><div class="acts"><button type="button" class="btn btn-wa btn-block" data-send>' + icon('whatsapp') + 'Open WhatsApp</button><button type="button" class="btn btn-ghost btn-block" data-close>Cancel</button></div>', function (sh, close) {
            sh.querySelector('[data-send]').addEventListener('click', function () { var m = sh.querySelector('#wa-m').value.replace(/\D/g, ''); if (!/^[6-9]\d{9}$/.test(m)) return toast('Enter the 10-digit mobile number'); close(); toast('Opens WhatsApp in ' + fmtMobile(m) + ' with the invoice (pretend)', true); });
          });
        });
        el.querySelectorAll('[data-share]').forEach(function (b) { b.addEventListener('click', function () { toast('The share menu opens with Nandam-Invoice-' + x.no + '.pdf (pretend)', true); }); });
        var pr = el.querySelector('[data-print]'); pr && pr.addEventListener('click', function () { toast('The phone\'s print screen opens with the invoice (pretend)', true); });
        el.querySelectorAll('[data-tab-msg]').forEach(function (b) { b.addEventListener('click', function () { toast(b.dataset.tabMsg); }); });
        var c = el.querySelector('[data-correct]'); c && c.addEventListener('click', correctSheet);
        if (demoCorrect) after(function () { if (canCorrect(x)) correctSheet(); else toast('Only in the invoice\'s own month, by owners'); }, 300);
        function correctSheet() {
          sheet('<h2>Correct the customer</h2><p>' + x.no + ' keeps its number, date and amounts. The PDF is made again and the change is recorded in the activity log.</p>' +
            '<div class="field"><label for="c-n">Name</label><input class="input" id="c-n" maxlength="60" value="' + esc(x.cust.name || '') + '" placeholder="Customer\'s name"></div>' +
            '<div class="field"><label for="c-m">Mobile</label><div class="input-group"><span class="prefix">+91</span><input class="input" id="c-m" type="tel" inputmode="numeric" maxlength="10" value="' + esc(x.cust.mobile || '') + '" placeholder="98765 43210"></div><p class="field-hint">Leave empty if the customer gave none.</p></div>' +
            '<div class="sheet-acts"><button type="button" class="btn btn-primary btn-block" data-save>Save and make the PDF again</button><button type="button" class="btn btn-ghost btn-block" data-close>Cancel</button></div>', function (sh, close) {
            sh.querySelector('[data-save]').addEventListener('click', function (ev) {
              var name = sh.querySelector('#c-n').value.trim(), m = sh.querySelector('#c-m').value.replace(/\D/g, '');
              if (m && !/^[6-9]\d{9}$/.test(m)) return toast('Enter a 10-digit mobile number, or leave it empty');
              ev.currentTarget.classList.add('is-loading');
              api.correct(x, name, m).then(function () { close(); render(); toast('Saved. ' + x.no + ' was made again with the same number.', true); }, function () { ev.target.classList.remove('is-loading'); toast('No internet. Saving needs internet.'); });
            });
          });
        }
      }
    };
  };

  function a4Head(title, sub) {
    return '<div class="head"><img src="assets/logo.png" alt=""><div><b>Nandam Handlooms</b>Hussain Katta, Mangalagiri, Andhra Pradesh, 522503, India<br>Mobile: +919494170180 · GSTIN 37CCWPN2487C1Z2</div></div><div class="row2"><div><h4>' + title + '</h4>' + sub + '</div></div>';
  }
  S.pdf = function (p) {
    var x = invById(p.id); if (!x) return S.invoices({});
    var g = gstOf(x.lines);
    var rows = x.lines.map(function (l, i) { var ex = split(l.price).taxable; return '<tr><td>' + (i + 1) + '</td><td>' + esc(l.name) + '</td><td>' + l.code + '</td><td class="n">1</td><td class="n">' + INR2.format(ex) + '</td><td class="n">' + INR2.format(ex) + '</td></tr>'; }).join('');
    return {
      html: '<section class="flow">' + flowTop('Invoice PDF', x.no, iconBtn('back', 'data-back', 'Back')) + '<div class="flow-body"><div class="a4inv' + (x.cancelled ? ' cancelled' : '') + '">' +
        a4Head('Invoice ' + x.no, 'Date: ' + dd(x.d) + '<br>Order: ' + x.order + (x.pay ? '<br>Paid by: ' + PAY[x.pay] : '') + (x.late ? '<br>Sale date: ' + dd(x.late.saleDate) : '')) +
        (x.cust.name || x.cust.mobile ? '<div><h4>Customer</h4>' + esc(x.cust.name || '') + (x.cust.mobile ? '<br>Mobile: ' + x.cust.mobile : '') + '</div>' : '') +
        '<table><thead><tr><th>#</th><th>Product</th><th>Tag</th><th class="n">Qty</th><th class="n">Price</th><th class="n">Subtotal</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div class="foot"><div><span>Taxable value</span><span>Rs. ' + INR2.format(g.taxable) + '</span></div><div><span>CGST @ 2.5%</span><span>Rs. ' + INR2.format(g.cgst) + '</span></div><div><span>SGST @ 2.5%</span><span>Rs. ' + INR2.format(g.sgst) + '</span></div><div class="tot"><span>Total (GST included)</span><span>Rs. ' + INR2.format(total(x)) + '</span></div></div>' +
        '<div class="stamp">Thank you for shopping at Nandam Handlooms</div></div>' +
        '<p class="field-hint" style="text-align:center;margin-top:.7rem">The same PDF as Module 5. Prices without GST; the GST lines add it back.</p></div></section>'
    };
  };

  /* ---------- Sales summary (owners) ---------- */
  function sumPeriod(u) { return u.period === 'custom' ? [u.from, u.to] : u.period === 'last' ? ['2026-09-01', '2026-09-30'] : ['2026-10-01', TODAY]; }
  function sumLabel(u) { var r = sumPeriod(u); return u.period === 'last' ? 'September 2026' : u.period === 'month' ? 'October 2026 (so far)' : dd(r[0]) + (r[1] !== r[0] ? ' – ' + dd(r[1]) : ''); }
  function sumData(u) {
    var r = sumPeriod(u);
    var list = demo.inv.filter(function (x) { return inPeriod(x, r[0], r[1]) && u.chs.indexOf(x.ch) >= 0; }).sort(function (a, b) { return a.no.localeCompare(b.no); });
    return { range: r, list: list, t: totalsOf(list), none: noInvoiceIn(r[0], r[1], u.chs) };
  }
  // The figures shown on screen and on page 1 of the PDF, per decision 6.3.
  function figures(d) {
    var t = d.t, withNone = NH.opts.noinv === 'c' && d.none.count;
    if (!withNone) return { count: t.count, sarees: t.sarees, total: t.total, gst: t.gst, withNone: false };
    var lines = [].concat.apply([], demo.sales.filter(function (s) { return !s.invoice && s.d >= d.range[0] && s.d <= d.range[1]; }).map(function (s) { return s.lines; }));
    var ng = gstOf(lines);
    return { count: t.count, sarees: t.sarees + lines.length, total: t.total + d.none.total, gst: { taxable: t.gst.taxable + ng.taxable, cgst: t.gst.cgst + ng.cgst, sgst: t.gst.sgst + ng.sgst }, withNone: true };
  }
  function totalsCard(d) {
    var t = d.t, mode = NH.opts.noinv, f = figures(d), withNone = f.withNone, grand = f.total, g = f.gst;
    return '<div class="sum-card"><div class="sum-big"><small>' + plural(t.count, 'invoice') + (withNone ? ' + ' + plural(d.none.count, 'sale') + ' without one' : '') + ' · ' + plural(f.sarees, 'saree') + '</small><b>' + rs2(grand) + '</b></div>' +
      '<dl class="kv"><dt>Taxable value</dt><dd>' + rs2(g.taxable) + '</dd><dt>CGST @ 2.5%</dt><dd>' + rs2(g.cgst) + '</dd><dt>SGST @ 2.5%</dt><dd>' + rs2(g.sgst) + '</dd></dl>' +
      '<div class="sum-split">' + Object.keys(CH).filter(function (c) { return d.t.byCh[c]; }).map(function (c) { return '<span>' + CH[c][0] + ' <b>' + rs(d.t.byCh[c]) + '</b></span>'; }).join('') + '</div>' +
      '<div class="sum-split">' + [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card'], ['none', 'Not recorded']].filter(function (k) { return d.t.byPay[k[0]]; }).map(function (k) { return '<span>' + k[1] + ' <b>' + rs(d.t.byPay[k[0]]) + '</b></span>'; }).join('') + '</div>' +
      (t.cancelled ? '<p class="sum-note">' + icon('xcircle', 'icon-sm') + plural(t.cancelled, 'cancelled invoice') + ' listed, not counted.</p>' : '') +
      (d.none.count && mode === 'b' ? '<p class="sum-note warn">' + icon('info', 'icon-sm') + '<span><b>' + plural(d.none.count, 'sale') + ' without an invoice: ' + rs(d.none.total) + '</b>. Not in the GST figures above.</span></p>' : '') +
      (withNone ? '<p class="sum-note warn">' + icon('info', 'icon-sm') + '<span>Includes ' + plural(d.none.count, 'sale') + ' without an invoice (' + rs(d.none.total) + ').</span></p>' : '') + '</div>';
  }

  S.summary = function (p) {
    if (!owner()) {
      return { html: '<section class="scr">' + topBar('Sales summary', 'invoices') + '<div class="scr-body narrow">' + emptyCard('lock', 'For owners', 'Money totals and the sales summary are for owners (Module 2). You can still open, share and print any invoice.', '<button type="button" class="btn btn-sm" data-go="invoices">Go to Invoices</button>') + '</div></section>' };
    }
    var demoKind = p.demo; if (demoKind) stripDemo();
    var u = ui.summary || (ui.summary = { period: 'month', chs: ['store', 'whatsapp', 'online'], made: false, from: '2026-10-01', to: '2026-10-05' });
    if (demoKind === 'result') { u.made = true; }
    if (demoKind === 'none') { u.period = 'custom'; u.from = '2026-09-01'; u.to = '2026-09-04'; u.made = true; }
    var d = sumData(u), B = NH.opts.summaryStyle === 'b';
    var chBoxes = '<div class="choice"><b>Channels</b><div class="opts" style="--n:3">' + Object.keys(CH).map(function (c) { return '<button type="button" data-chx="' + c + '" aria-pressed="' + (u.chs.indexOf(c) >= 0) + '">' + icon(CH[c][1]) + CH[c][0] + '</button>'; }).join('') + '</div>' + (u.chs.length ? '' : '<span class="err">Choose at least one channel.</span>') + '</div>';
    var pick;
    if (B) {
      var months = [['month', 'October 2026', 'so far', '2026-10-01', TODAY], ['last', 'September 2026', 'whole month', '2026-09-01', '2026-09-30']];
      pick = '<div class="list-title" style="margin-top:0">Choose a month</div><div class="month-cards">' + months.map(function (m) {
        var md = sumData({ period: m[0], chs: u.chs });
        return '<button type="button" class="month-card" data-month="' + m[0] + '" aria-pressed="' + (u.period === m[0]) + '"><span><b>' + m[1] + '</b><small>' + m[2] + ' · ' + plural(md.t.count, 'invoice') + '</small></span><b class="amt">' + rs(md.t.total) + '</b></button>';
      }).join('') + '<button type="button" class="month-card" data-cal aria-pressed="' + (u.period === 'custom') + '"><span><b>' + icon('calendar', 'icon-sm') + ' Custom dates</b><small>' + (u.period === 'custom' ? sumLabel(u) : 'Any days, up to a year') + '</small></span>' + icon('right', 'icon-sm') + '</button></div>' + chBoxes;
    } else {
      pick = '<div class="choice"><b>Period</b><div class="opts" style="--n:3"><button type="button" data-per="month" aria-pressed="' + (u.period === 'month') + '">' + icon('calendar') + 'This month</button><button type="button" data-per="last" aria-pressed="' + (u.period === 'last') + '">' + icon('history') + 'Last month</button><button type="button" data-cal aria-pressed="' + (u.period === 'custom') + '">' + icon('sliders') + 'Custom</button></div>' +
        '<span class="field-hint">' + sumLabel(u) + '</span></div>' + chBoxes;
    }
    var result = '';
    if (u.made && state !== 'loading') {
      if (state === 'error') result = alertBox('error', 'Couldn\'t make the summary', 'The server didn\'t answer. Try again.');
      else if (!d.t.count && !d.t.cancelled) result = alertBox('info', 'No invoices from ' + dd(d.range[0]) + ' to ' + dd(d.range[1]), d.none.count && NH.opts.noinv !== 'a' ? plural(d.none.count, 'sale') + ' without an invoice in these days: ' + rs(d.none.total) + '.' : 'Try another period.');
      else result = '<div class="list-title">' + sumLabel(u) + ' · ' + u.chs.map(function (c) { return CH[c][0]; }).join(', ') + '</div>' + totalsCard(d) +
        '<div style="display:grid;gap:.5rem;margin-top:.8rem"><button type="button" class="btn btn-primary btn-block" data-sharepdf>' + icon('share') + 'Share PDF</button><div class="share-row"><button type="button" class="btn" data-print>' + icon('print', 'icon-sm') + 'Print</button><button type="button" class="btn" data-csv>' + icon('sheet', 'icon-sm') + 'Excel file</button></div><button type="button" class="btn btn-ghost btn-block" data-go="summarypdf">' + icon('pdf', 'icon-sm') + 'View the PDF</button></div>';
    }
    return {
      html: '<section class="flow">' + flowTop('Sales summary', 'For the owner and the accountant', iconBtn('back', 'data-back', 'Back')) +
        '<div class="flow-body">' + pick + (state === 'loading' ? skelRows(2) : result) + '</div>' +
        '<div class="flow-foot"><button type="button" class="btn btn-primary btn-block" data-make' + (u.chs.length ? '' : ' disabled') + '>' + (u.made ? 'Make it again' : 'Make the summary') + '</button></div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-per]').forEach(function (b) { b.addEventListener('click', function () { u.period = b.dataset.per; u.made = false; render(); }); });
        el.querySelectorAll('[data-month]').forEach(function (b) { b.addEventListener('click', function () { u.period = b.dataset.month; make(); }); });
        el.querySelectorAll('[data-chx]').forEach(function (b) { b.addEventListener('click', function () { var c = b.dataset.chx, i = u.chs.indexOf(c); if (i >= 0) u.chs.splice(i, 1); else u.chs.push(c); u.made = false; render(); }); });
        el.querySelectorAll('[data-cal]').forEach(function (b) { b.addEventListener('click', function () { calendarSheet(u.period === 'custom' ? { from: u.from, to: u.to } : null, function (v) { u.period = 'custom'; u.from = v.from; u.to = v.to; u.made = false; render(); }); }); });
        var mk = el.querySelector('[data-make]'); mk && mk.addEventListener('click', make);
        var sp = el.querySelector('[data-sharepdf]'); sp && sp.addEventListener('click', function () { toast('The share menu opens with Nandam-Sales-summary-' + (u.period === 'last' ? 'Sep-2026' : 'Oct-2026') + '.pdf (pretend)', true); });
        var pr = el.querySelector('[data-print]'); pr && pr.addEventListener('click', function () { toast('The phone\'s print screen opens with the summary (pretend)', true); });
        var cv = el.querySelector('[data-csv]'); cv && cv.addEventListener('click', csvSheet);
        if (demoKind === 'custom') after(function () { el.querySelector('[data-cal]').click(); }, 300);
        function make() {
          if (!u.chs.length) return;
          var b = viewport.querySelector('[data-make]'); b && b.classList.add('is-loading');
          api.summary().then(function () { u.made = true; render(); }, function () { b && b.classList.remove('is-loading'); toast('No internet. The summary needs internet.'); });
        }
        function csvSheet() {
          var rows = d.list.slice(0, 6).map(function (x) { var g = gstOf(x.lines); return '<tr><td>' + x.no + '</td><td>' + dd(x.d) + '</td><td>' + esc(custName(x)) + '</td><td>' + (x.cancelled ? 'Cancelled' : INR2.format(g.taxable)) + '</td><td>' + (x.cancelled ? '' : INR2.format(total(x))) + '</td></tr>'; }).join('');
          sheet('<h2>Excel file</h2><p>One row per invoice, ready for Excel or Google Sheets: number, date, customer, mobile, channel, paid by, taxable value, CGST, SGST, total, status.</p><div class="table-wrap csv-prev"><table class="table"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Taxable</th><th>Total</th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="field-hint">…and ' + Math.max(0, d.list.length - 6) + ' more rows. File: Nandam-Invoices-' + (u.period === 'last' ? 'Sep-2026' : 'Oct-2026') + '.csv</p><div class="sheet-acts"><button type="button" class="btn btn-primary btn-block" data-close>' + icon('share', 'icon-sm') + 'Share the file</button><button type="button" class="btn btn-ghost btn-block" data-close>Close</button></div>');
        }
      }
    };
  };

  S.summarypdf = function (p) {
    if (p.demo) { ui.summary = ui.summary || { period: 'month', chs: ['store', 'whatsapp', 'online'], made: true }; stripDemo(); }
    var u = ui.summary || { period: 'month', chs: ['store', 'whatsapp', 'online'] };
    var d = sumData(u), mode = NH.opts.pdf, t = d.t, f = figures(d);
    var page1 = '<div class="a4inv">' + a4Head('Sales summary', sumLabel(u) + '<br>' + u.chs.map(function (c) { return CH[c][0]; }).join(' + ') + ' · made ' + dd(TODAY)) +
      '<table><tbody><tr><td>Invoices</td><td class="n">' + t.count + (f.withNone ? ' + ' + d.none.count + ' sales without one' : '') + '</td></tr><tr><td>Sarees</td><td class="n">' + f.sarees + '</td></tr><tr><td>Taxable value</td><td class="n">Rs. ' + INR2.format(f.gst.taxable) + '</td></tr><tr><td>CGST @ 2.5%</td><td class="n">Rs. ' + INR2.format(f.gst.cgst) + '</td></tr><tr><td>SGST @ 2.5%</td><td class="n">Rs. ' + INR2.format(f.gst.sgst) + '</td></tr><tr><td><b>Total (GST included)</b></td><td class="n"><b>Rs. ' + INR2.format(f.total) + '</b></td></tr></tbody></table>' +
      '<h4>By channel</h4><table><tbody>' + Object.keys(CH).filter(function (c) { return t.byCh[c]; }).map(function (c) { return '<tr><td>' + CH[c][0] + '</td><td class="n">Rs. ' + INR2.format(t.byCh[c]) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<h4>By payment</h4><table><tbody>' + [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card'], ['none', 'Not recorded']].filter(function (k) { return t.byPay[k[0]]; }).map(function (k) { return '<tr><td>' + k[1] + '</td><td class="n">Rs. ' + INR2.format(t.byPay[k[0]]) + '</td></tr>'; }).join('') + '</tbody></table>' +
      (t.cancelled ? '<p>' + plural(t.cancelled, 'cancelled invoice') + ' listed, not counted.</p>' : '') +
      (d.none.count && NH.opts.noinv === 'b' ? '<p><b>Sales without an invoice:</b> ' + d.none.count + ' sales, Rs. ' + INR2.format(d.none.total) + ' (not in the figures above).</p>' : '') +
      (f.withNone ? '<p>The figures above include ' + d.none.count + ' sales without an invoice (Rs. ' + INR2.format(d.none.total) + ').</p>' : '') +
      '<div class="stamp">Page 1</div></div>';
    var page2 = '<div class="a4inv"><h4>Invoices</h4><table><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th class="n">Taxable</th><th class="n">GST</th><th class="n">Total</th></tr></thead><tbody>' +
      d.list.map(function (x) { var g = gstOf(x.lines); return '<tr' + (x.cancelled ? ' class="strike"' : '') + '><td>' + x.no + '</td><td>' + ddShort(x.d).replace('Today', dd(x.d)).replace('Yesterday', dd(x.d)) + '</td><td>' + esc(custName(x)) + (x.cancelled ? ' · CANCELLED' : '') + '</td><td class="n">' + INR2.format(g.taxable) + '</td><td class="n">' + INR2.format(g.cgst + g.sgst) + '</td><td class="n">' + INR2.format(total(x)) + '</td></tr>'; }).join('') +
      '</tbody></table><div class="stamp">Page 2</div></div>';
    var byName = {};
    d.list.filter(function (x) { return !x.cancelled; }).forEach(function (x) { x.lines.forEach(function (l) { var e = byName[l.name] || (byName[l.name] = { q: 0, r: 0 }); e.q++; e.r += l.price; }); });
    var page3 = '<div class="a4inv"><h4>Sarees by name</h4><table><thead><tr><th>Product</th><th class="n">Qty</th><th class="n">Avg price</th><th class="n">Total</th></tr></thead><tbody>' +
      Object.keys(byName).sort(function (a, b) { return byName[b].r - byName[a].r; }).map(function (n) { var e = byName[n]; return '<tr><td>' + esc(n) + '</td><td class="n">' + e.q + '</td><td class="n">' + INR2.format(e.r / e.q) + '</td><td class="n">' + INR2.format(e.r) + '</td></tr>'; }).join('') +
      '</tbody></table><div class="stamp">Page 3</div></div>';
    var pages = mode === 'a' ? page1 + page3 : mode === 'b' ? page1 + page2 : page1 + page2 + page3;
    return {
      html: '<section class="flow">' + flowTop('Summary PDF', sumLabel(u), iconBtn('back', 'data-back', 'Back')) + '<div class="flow-body"><div class="pdf-pages">' + pages + '</div>' +
        '<p class="field-hint" style="text-align:center;margin-top:.7rem">Decision 6.2 option ' + mode.toUpperCase() + ' (switch it in Design options). Real sarees and prices; sample invoices.</p></div></section>'
    };
  };

  /* ---------- A sale recorded without an invoice (Module 5 page, with Make an invoice) ---------- */
  S.sale = function (p) {
    var s = saleById(p.id); var demoMake = p.demo === 'make'; if (p.demo) stripDemo();
    if (!s) return { html: '<section class="flow">' + flowTop('Sale', '', iconBtn('back', 'data-back', 'Back')) + '<div class="flow-body">' + alertBox('info', 'Not found', 'This sale isn\'t here.') + '</div></section>' };
    var t = total(s), x = s.invoice ? invById(s.invoice) : null, can = !x && sameMonthAsToday(s.d);
    return {
      html: '<section class="flow">' + flowTop('Sale ' + s.order, ddShort(s.d) + ', ' + s.t + ' · ' + s.by, iconBtn('back', 'data-back', 'Back')) +
        '<div class="flow-body"><div class="list">' + s.lines.map(function (l) { return lineRow(l, false); }).join('') + '</div><div style="height:.7rem"></div>' +
        '<div class="list"><div class="row"><dl class="kv" style="width:100%"><dt>Total</dt><dd>' + rs(t) + '</dd><dt>Paid by</dt><dd>' + (s.pay ? PAY[s.pay] : 'Not recorded (old app)') + '</dd><dt>Where</dt><dd>' + (s.ch === 'store' ? 'At the counter' : 'WhatsApp order') + '</dd><dt>Invoice</dt><dd>' + (x ? x.no : 'Recorded without one') + '</dd></dl></div></div>' +
        (x ? '<button type="button" class="btn btn-block" style="margin-top:.9rem" data-go="invoice?id=' + x.id + '">' + icon('receipt', 'icon-sm') + 'Open ' + x.no + '</button>'
          : can ? '<button type="button" class="btn btn-primary btn-block" style="margin-top:.9rem" data-make>' + icon('plus', 'icon-sm') + 'Make an invoice</button><p class="field-hint" style="margin-top:.4rem">For a customer who comes back for one. Possible until the end of ' + MONTHS_LONG[+s.d.slice(5, 7) - 1] + '.</p>'
            : '<div class="lock-note">' + icon('clock') + '<span>An invoice can be made only in the month of the sale (' + MONTHS_LONG[+s.d.slice(5, 7) - 1] + '), so a month that may be filed for GST never changes.</span></div>') +
        '</div></section>',
      mount: function (el) {
        var m = el.querySelector('[data-make]'); m && m.addEventListener('click', ask);
        if (demoMake && m) after(ask, 300);
        function ask() {
          dialog({ tone: 'info', icon: 'receipt', title: 'Make an invoice for this sale?', text: 'It gets the next number (INV-' + String(demo.next).padStart(6, '0') + ') and today\'s date; the sale date (' + dd(s.d) + ') is printed on it too.',
            actions: [{ label: 'Make the invoice', kind: 'btn-primary', keep: true, fn: function (b, close) { b.classList.add('is-loading'); api.makeLater(s).then(function (x) { close(); toast(x.no + ' made', true); go('invoice?id=' + x.id); }, function () { close(); toast('No internet. Making an invoice needs internet.'); }); } }, { label: 'Cancel' }] });
        }
      }
    };
  };

  S.more = function () {
    return {
      html: '<section class="scr">' + topBar('More') + '<div class="scr-body narrow"><div class="list">' +
        '<button type="button" class="row" data-go="invoices"><span class="inv-ico">' + icon('receipt') + '</span><span class="grow"><b>Invoices</b><span>Find, share and print' + (owner() ? '; sales summary' : '') + '</span></span>' + icon('right', 'icon-sm') + '</button>' +
        '<button type="button" class="row" data-msg><span class="inv-ico">' + icon('folder') + '</span><span class="grow"><b>Catalogue</b><span>Module 3</span></span>' + icon('right', 'icon-sm') + '</button>' +
        '<button type="button" class="row" data-msg><span class="inv-ico">' + icon('users') + '</span><span class="grow"><b>Team</b><span>Module 2</span></span>' + icon('right', 'icon-sm') + '</button></div></div></section>',
      mount: function (el) { el.querySelectorAll('[data-msg]').forEach(function (b) { b.addEventListener('click', function () { toast('Built in an earlier module'); }); }); }
    };
  };

  /* ================= Render ================= */
  var FULL = { invoice: 1, pdf: 1, summary: 1, summarypdf: 1, sale: 1 };
  function bindGo(scope) {
    scope.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.go); }); });
    scope.querySelectorAll('[data-back]').forEach(function (b) { b.addEventListener('click', back); });
  }
  function render() {
    timers.forEach(function (t) { clearTimeout(t); }); timers = [];
    closers = [];
    Array.prototype.slice.call(overlays.children).forEach(function (c) { if (!c.classList.contains('app-toast')) c.remove(); });
    var name = current.name, fn = S[name] || S.invoices;
    var scr = fn(current.params || {});
    viewport.innerHTML = FULL[name] && !(name === 'summary' && !owner()) ? scr.html : shell(scr.html);
    var el = viewport.querySelector('.scr, .flow') || viewport.firstElementChild;
    bindGo(viewport);
    viewport.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { var t = b.dataset.tab; if (t === 'more') go('more'); else toast('This tab is another module'); }); });
    scr.mount && scr.mount(el);
    var spec = window.NH_SCREENS.filter(function (s) { return NH_ROUTE(s).split('?')[0] === name; });
    if (state !== 'normal' && spec.length && !spec.some(function (s) { return s.states.indexOf(state) >= 0; })) NH.toast('"' + state + '" isn\'t a state of this screen. Try: ' + (spec.map(function (s) { return s.states.join(', '); }).filter(Boolean).join(', ') || 'none'));
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && closers.length) { closers[closers.length - 1](); e.stopPropagation(); } });

  window.NHApp = {
    setState: function (s) { state = s; ui[current.name] = ui[current.name] && current.name === 'summary' ? Object.assign(ui.summary, { made: true }) : undefined; render(); },
    go: go,
    action: function (name) { if (name === 'reset') { demo = freshDemo(); save(); ui = {}; go('invoices'); } }
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
