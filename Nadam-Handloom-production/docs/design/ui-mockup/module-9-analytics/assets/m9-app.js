/* Module 9 (Analytics): the clickable app.
   Designs, prices and photos are real (copy of 11 Oct 2026); the sales history is
   sample, made up the same way every time (the shop's real history starts 5 Oct).
   The pretend figures follow the plan's rules: which sales count, the period before,
   bars per hour / day / week, bargains against the store price when sold, people,
   payment, busiest hours, slow designs. */
(function () {
  'use strict';
  var NH = window.NH;
  var EMBED = /[?&]embed=1/.test(location.search);
  var VIEW_KEY = 'nh-m9-view';
  var TODAY = '2026-10-12';
  var START = '2026-07-30';
  var REAL_START = '2026-10-05';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /* ================= Dates ================= */
  function addDays(ymd, n) { var d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function days(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1; }
  function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function ym(ymd) { return [+ymd.slice(0, 4), +ymd.slice(5, 7)]; }
  function monthBack(y, m) { return m === 1 ? [y - 1, 12] : [y, m - 1]; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dowOf(ymd) { return new Date(ymd + 'T00:00:00Z').getUTCDay(); }
  function dd(ymd) { return +ymd.slice(8) + ' ' + MONTHS[+ymd.slice(5, 7) - 1]; }
  function rangeText(r) {
    if (r.from === r.to) return DOW[dowOf(r.from)] + ' ' + dd(r.from) + ' ' + r.from.slice(0, 4);
    if (r.from.slice(0, 7) === r.to.slice(0, 7)) return +r.from.slice(8) + '–' + dd(r.to) + ' ' + r.to.slice(0, 4);
    return dd(r.from) + ' – ' + dd(r.to) + ' ' + r.to.slice(0, 4);
  }
  // The period (6.2) and the one before it (6.3).
  function periodOf(p, custom) {
    var t = TODAY, c = ym(t);
    if (p === 'today') return { from: t, to: t };
    if (p === '7d') return { from: addDays(t, -6), to: t };
    if (p === '30d') return { from: addDays(t, -29), to: t };
    if (p === 'last') { var l = monthBack(c[0], c[1]); return { from: l[0] + '-' + pad(l[1]) + '-01', to: l[0] + '-' + pad(l[1]) + '-' + pad(lastDay(l[0], l[1])) }; }
    if (p === 'custom' && custom) return { from: custom.from, to: custom.to };
    return { from: t.slice(0, 8) + '01', to: t };
  }
  function beforeOf(p, r) {
    var c = ym(r.from), b = monthBack(c[0], c[1]), bm = b[0] + '-' + pad(b[1]);
    if (p === 'month') return { from: bm + '-01', to: bm + '-' + pad(Math.min(+r.to.slice(8), lastDay(b[0], b[1]))), label: rangeText({ from: bm + '-01', to: bm + '-' + pad(Math.min(+r.to.slice(8), lastDay(b[0], b[1]))) }) };
    if (p === 'last') return { from: bm + '-01', to: bm + '-' + pad(lastDay(b[0], b[1])), label: MONTHS_LONG[b[1] - 1] };
    var n = days(r.from, r.to), to = addDays(r.from, -1);
    return { from: addDays(to, -(n - 1)), to: to, label: p === 'today' ? 'yesterday' : 'the ' + n + ' days before' };
  }

  /* ================= Sample history ================= */
  var SUBS = [];
  window.NH_CATALOG.categories.forEach(function (c) { c.subs.forEach(function (s) { if (s.img && s.store >= 1500 && s.store < 20000 && s.products > 5) SUBS.push(Object.assign({ cat: c.name }, s)); }); });
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var HOURS = [11, 12, 13, 14, 15, 16, 16, 17, 18, 18, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 22];
  var PEOPLE = { lakshmi: { id: 'lakshmi', name: 'Lakshmi', role: 'Owner' }, ravi: { id: 'ravi', name: 'Ravi', role: 'Staff' }, anil: { id: 'anil', name: 'Anil', role: 'Staff' } };
  var BILLS = (function () {
    var r = rng(20261012), out = [], k = 0;
    for (var d = START; d <= TODAY; d = addDays(d, 1)) {
      var dow = dowOf(d), weekend = dow === 0 || dow === 6;
      var n = 1 + Math.floor(r() * 4) + (weekend ? 2 : 0) + (d >= '2026-09-28' && d <= '2026-10-03' ? 2 : 0);
      if (d === TODAY) n = 5;
      for (var i = 0; i < n; i++) {
        var x = r(), ch = x < 0.8 ? 'store' : x < 0.94 ? 'whatsapp' : 'online';
        var y = r(), count = y < 0.5 ? 1 : y < 0.8 ? 2 : y < 0.93 ? 3 : 4 + Math.floor(r() * 6);
        var lines = [];
        for (var j = 0; j < count; j++) {
          var w = r(), s = SUBS[Math.floor((w * w * w) * SUBS.length)];
          var sold = ch === 'online' ? s.online : (r() < 0.15 ? s.store : Math.round(s.store * (0.38 + r() * 0.42) / 50) * 50);
          lines.push({ sub: s.id, store: s.store, sold: sold });
        }
        var old = d < REAL_START && r() < 0.12;
        var p = r(), pay = ch === 'online' ? 'online' : old ? 'none' : p < 0.35 ? 'cash' : p < 0.85 ? 'upi' : 'card';
        var q = r(), by = ch === 'online' ? null : old ? 'none' : q < 0.35 ? 'lakshmi' : q < 0.75 ? 'ravi' : 'anil';
        var hour = d === TODAY ? [11, 13, 16, 18, 19][i] : HOURS[Math.floor(r() * HOURS.length)];
        out.push({ id: 'b' + (k++), d: d, h: hour, ch: ch, pay: pay, by: by, lines: lines, total: lines.reduce(function (t, l) { return t + l.sold; }, 0), cancelled: r() < 0.03 });
      }
    }
    return out;
  })();
  var SUB = {}; SUBS.forEach(function (s) { SUB[s.id] = s; });
  var SLOW = SUBS.slice(-6).map(function (s, i) { return { sub: s, left: 3 + (i * 5) % 11, lastSold: ['14 Jul', '2 Jul', '28 Jun', '19 Jun', '6 Jun', 'never'][i] }; });

  /* ================= Figures ================= */
  function early() { return current.params.demo === 'early'; }
  function figures(r, ch) {
    var list = BILLS.filter(function (b) { return b.d >= r.from && b.d <= r.to && (ch === 'all' || b.ch === ch) && (!early() || b.d >= REAL_START); });
    var live = list.filter(function (b) { return !b.cancelled; }), dead = list.filter(function (b) { return b.cancelled; });
    var f = { amount: 0, bills: live.length, sarees: 0, cancelled: { bills: dead.length, amount: sum(dead) }, designs: {}, people: {}, pay: {}, hours: {}, dow: {}, store: 0, sold: 0, lines: 0, bargained: 0, byDay: {}, list: live };
    live.forEach(function (b) {
      f.amount += b.total; f.sarees += b.lines.length;
      f.pay[b.pay] = f.pay[b.pay] || { amount: 0, bills: 0 }; f.pay[b.pay].amount += b.total; f.pay[b.pay].bills++;
      f.hours[b.h] = (f.hours[b.h] || 0) + b.total;
      f.dow[dowOf(b.d)] = (f.dow[dowOf(b.d)] || 0) + b.total;
      f.byDay[b.d] = f.byDay[b.d] || { amount: 0, bills: 0, hours: {} }; f.byDay[b.d].amount += b.total; f.byDay[b.d].bills++; f.byDay[b.d].hours[b.h] = (f.byDay[b.d].hours[b.h] || 0) + b.total;
      var who = b.by || null;
      if (who) { f.people[who] = f.people[who] || { bills: 0, sarees: 0, amount: 0, store: 0, sold: 0 }; f.people[who].bills++; f.people[who].amount += b.total; }
      b.lines.forEach(function (l) {
        var dsn = f.designs[l.sub] = f.designs[l.sub] || { sarees: 0, amount: 0, store: 0, sold: 0 };
        dsn.sarees++; dsn.amount += l.sold;
        if (who) f.people[who].sarees++;
        if (b.ch !== 'online') {
          f.store += l.store; f.sold += l.sold; f.lines++; if (l.sold < l.store) f.bargained++;
          dsn.store += l.store; dsn.sold += l.sold;
          if (who) { f.people[who].store += l.store; f.people[who].sold += l.sold; }
        }
      });
    });
    f.avg = f.bills ? Math.round(f.amount / f.bills) : 0;
    return f;
  }
  function sum(list) { return list.reduce(function (t, b) { return t + b.total; }, 0); }
  function series(r, f) {
    var n = days(r.from, r.to), out = [];
    if (n === 1) { for (var h = 10; h <= 22; h++) out.push({ key: h, label: (h % 12 || 12) + (h < 12 ? 'a' : 'p'), amount: (f.byDay[r.from] || { hours: {} }).hours[h] || 0, title: (h % 12 || 12) + ' ' + (h < 12 ? 'am' : 'pm') }); return { unit: 'hour', bars: out }; }
    if (n > 92) {
      for (var w = r.from; w <= r.to; w = addDays(w, 7)) {
        var a = 0, bl = 0, end = addDays(w, 6) > r.to ? r.to : addDays(w, 6);
        for (var x = w; x <= end; x = addDays(x, 1)) { var dy = f.byDay[x]; if (dy) { a += dy.amount; bl += dy.bills; } }
        out.push({ key: w, label: dd(w), amount: a, bills: bl, title: 'Week of ' + dd(w) });
      }
      return { unit: 'week', bars: out };
    }
    for (var d = r.from; d <= r.to; d = addDays(d, 1)) { var v = f.byDay[d] || { amount: 0, bills: 0 }; out.push({ key: d, label: +d.slice(8) + '', amount: v.amount, bills: v.bills, title: DOW[dowOf(d)] + ' ' + dd(d) }); }
    return { unit: 'day', bars: out };
  }

  /* ================= Helpers ================= */
  var INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  function rs(v) { return '₹' + INR.format(v); }
  function lakh(v) { return v >= 100000 ? '₹' + (v / 100000).toFixed(2) + ' lakh' : rs(v); }
  function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(n, c) { return NH.icon(n, c); }
  function plural(n, a, b) { return INR.format(n) + ' ' + (n === 1 ? a : (b || a + 's')); }
  function pthumb(img) { return '<span class="pthumb">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : icon('image')) + '</span>'; }
  function topBar(title, back, right) { return '<div class="scr-top">' + (back ? '<button class="icon-btn" type="button" data-go="' + back + '" aria-label="Back">' + icon('back') + '</button>' : '<span style="width:12px"></span>') + '<h1>' + (title || '') + '</h1>' + (right || '') + '</div>'; }
  function alertBox(type, title, text, ic, extra) { var map = { info: 'info', success: 'check', warning: 'alert', error: 'alertc' }; return '<div class="alert alert-' + type + '" role="' + (type === 'error' ? 'alert' : 'status') + '">' + icon(ic || map[type]) + '<div>' + (title ? '<strong>' + title + '</strong>' : '') + (text ? '<p>' + text + '</p>' : '') + (extra || '') + '</div></div>'; }
  function emptyCard(ic, title, text) { return '<div class="ph-tile" style="min-height:130px;align-items:center;justify-content:center;text-align:center;gap:.4rem">' + icon(ic, 'icon-xl') + '<b>' + title + '</b><span>' + text + '</span></div>'; }
  function delta(cur, prev, label) {
    if (!prev) return '<small class="dl none">' + (early() ? 'Nothing to compare yet' : 'No sales ' + esc(label)) + '</small>';
    var p = Math.round(100 * (cur - prev) / prev);
    if (p === 0) return '<small class="dl">Same as ' + esc(label) + '</small>';
    return '<small class="dl ' + (p > 0 ? 'up' : 'down') + '">' + (p > 0 ? '↑ ' : '↓ ') + Math.abs(p) + '% vs ' + esc(label) + '</small>';
  }
  function card(title, body, extra) { return '<section class="an-card"' + (extra || '') + '><h2>' + title + '</h2>' + body + '</section>'; }

  /* ================= State ================= */
  var view = (function () { try { return JSON.parse(sessionStorage.getItem(VIEW_KEY)) || {}; } catch (e) { return {}; } })();
  if (!view.p) view = { p: 'month', ch: 'all', custom: null, sort: 'sarees', tab: 'sales' };
  function saveView() { try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch (e) { } }
  function flags() { return NH.flags(); }
  function owner() { return flags().viewAs !== 'staff'; }

  /* ================= Overlays ================= */
  var overlays, root, viewport, closers = [];
  function addOverlay(html) { var d = document.createElement('div'); d.innerHTML = html; var el = d.firstElementChild; overlays.appendChild(el); return el; }
  function toast(msg, ok) { var old = overlays.querySelector('.app-toast'); if (old) old.remove(); var t = addOverlay('<div class="app-toast' + (ok ? ' ok' : '') + '" role="status">' + icon(ok ? 'check' : 'info') + esc(msg) + '</div>'); setTimeout(function () { t.remove(); }, 2800); }
  function sheet(html, onMount) {
    var el = addOverlay('<div class="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div></div>');
    function close() { el.remove(); closers = closers.filter(function (c) { return c !== close; }); }
    closers.push(close);
    el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-close]')) close(); });
    onMount && onMount(el, close);
    return close;
  }

  /* ================= Router ================= */
  var current = { name: '', params: {} }, state = 'normal', stack = [];
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), q = h.split('?'), p = {};
    (q[1] || '').split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); p[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
    return { name: q[0] || 'analytics', params: p };
  }
  function go(route) { if (('#/' + route) === location.hash) render(); else location.hash = '#/' + route; }
  function onRoute() {
    var r = parse(), h = location.hash;
    if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop(); else if (stack[stack.length - 1] !== h) stack.push(h);
    if (r.name !== current.name || JSON.stringify(r.params) !== JSON.stringify(current.params)) state = 'normal';
    current = r;
    var want = r.params.as === 'staff' ? 'staff' : (r.params.as === 'owner' ? 'owner' : null);
    if (want && flags().viewAs !== want) NH.setFlag('viewAs', want, true);
    if (r.name === 'analytics') {
      if (r.params.p) { view.p = r.params.p; view.custom = null; }
      if (r.params.demo === '1' || r.params.demo === 'early') { view.p = 'month'; view.ch = 'all'; }
      if (r.params.ch) view.ch = r.params.ch;
      if (r.params.focus === 'stock') view.tab = 'stock';
      saveView();
    }
    render();
    if (r.params.demo === 'custom') openCalendar();
    if (r.params.focus === 'stock') setTimeout(function () { var s = viewport.querySelector('[data-card="stock"]'); s && s.scrollIntoView({ block: 'start' }); }, 50);
    document.dispatchEvent(new CustomEvent('nh:route', { detail: { name: r.name, params: Object.assign({}, r.params) } }));
  }

  /* ================= Shell ================= */
  var TABS = [['home', 'home', 'Home'], ['orders', 'orders', 'Orders'], ['scan', 'scan', 'Scan'], ['products', 'box', 'Products'], ['more', 'more', 'More']];
  function shell(inner) {
    var tabs = TABS.map(function (t) {
      var cur = t[0] === 'more' ? ' aria-current="page"' : '';
      if (t[0] === 'scan') return '<button type="button" class="scan-tab" data-tab="scan" aria-label="Scan"><span class="scan-ico">' + icon('scan') + '</span></button>';
      return '<button type="button" data-tab="' + t[0] + '"' + cur + '>' + icon(t[1]) + t[2] + '</button>';
    }).join('');
    var rail = '<nav class="rail" aria-label="Main menu"><img src="assets/logo.png" alt="Nandam Handlooms">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '"' + (t[0] === 'more' ? ' aria-current="page"' : '') + '>' + icon(t[1]) + t[2] + '</button>'; }).join('') + '</nav>';
    var bar = flags().offline ? '<div class="saved-bar">' + icon('wifioff') + 'Offline · Analytics needs internet.</div>' : '';
    return '<div class="shell">' + rail + '<div class="shell-main">' + bar + inner + '</div><nav class="tabbar" aria-label="Main menu">' + tabs + '</nav></div>';
  }

  /* ================= Cards ================= */
  var PERIODS = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['month', 'This month'], ['last', 'Last month'], ['custom', 'Any dates']];
  var CHS = [['all', 'All'], ['store', 'Counter'], ['whatsapp', 'WhatsApp'], ['online', 'Online']];
  function filters(r, b) {
    return '<div class="an-filters"><div class="an-chips" role="group" aria-label="Period">' + PERIODS.map(function (p) { return '<button type="button" class="an-chip" data-p="' + p[0] + '" aria-pressed="' + (view.p === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div>' +
      '<div class="an-chips" role="group" aria-label="Channel">' + CHS.map(function (c) { return '<button type="button" class="an-chip sm" data-ch="' + c[0] + '" aria-pressed="' + (view.ch === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      '<p class="an-range"><b>' + rangeText(r) + '</b> · compared with ' + esc(b.label) + '</p></div>';
  }
  function headline(f, g, b) {
    var cells = [['Sales', rs(f.amount), f.amount, g.amount], ['Bills', INR.format(f.bills), f.bills, g.bills], ['Sarees', INR.format(f.sarees), f.sarees, g.sarees], ['Average bill', rs(f.avg), f.avg, g.avg]];
    return '<div class="an-head">' + cells.map(function (c) { return '<div class="kpi"><small>' + c[0] + '</small><b>' + c[1] + '</b>' + delta(c[2], c[3], b.label) + '</div>'; }).join('') + '</div>' +
      (f.cancelled.bills ? '<p class="an-note">' + plural(f.cancelled.bills, 'sale') + ' cancelled (' + rs(f.cancelled.amount) + '), not counted</p>' : '');
  }
  function chart(r, f) {
    var s = series(r, f), max = Math.max.apply(null, s.bars.map(function (x) { return x.amount; }).concat([1]));
    var title = s.unit === 'hour' ? 'Sales by hour' : s.unit === 'week' ? 'Sales by week' : 'Sales by day';
    var labelEvery = s.bars.length > 16 ? Math.ceil(s.bars.length / 6) : 1;
    var body;
    if (NH.opts.chart === 'b') {
      var W = 320, H = 120, n = s.bars.length, step = n > 1 ? W / (n - 1) : W;
      var pts = s.bars.map(function (x, i) { return [Math.round(i * step), Math.round(H - (x.amount / max) * (H - 8))]; });
      body = '<div class="an-line"><svg viewBox="0 0 ' + W + ' ' + (H + 2) + '" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,' + H + ' ' + pts.map(function (p) { return p.join(','); }).join(' ') + ' ' + W + ',' + H + '" class="area"/><polyline points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '" class="ln"/></svg>' +
        '<div class="an-hits">' + s.bars.map(function (x, i) { return '<button type="button" data-bar="' + i + '" aria-label="' + esc(x.title) + ', ' + rs(x.amount) + '"></button>'; }).join('') + '</div></div>';
    } else {
      body = '<div class="an-bars' + (s.bars.length > 20 ? ' thin' : '') + '">' + s.bars.map(function (x, i) { return '<button type="button" data-bar="' + i + '" aria-label="' + esc(x.title) + ', ' + rs(x.amount) + '"><span style="height:' + Math.max(x.amount ? 4 : 0, Math.round(100 * x.amount / max)) + '%"></span></button>'; }).join('') + '</div>';
    }
    body += '<div class="an-axis">' + s.bars.map(function (x, i) { return '<span>' + (i % labelEvery === 0 || i === s.bars.length - 1 ? esc(x.label) : '') + '</span>'; }).join('') + '</div>';
    body += '<p class="an-tip" data-tip>' + (ui.tip != null && s.bars[ui.tip] ? '<b>' + esc(s.bars[ui.tip].title) + '</b>: ' + rs(s.bars[ui.tip].amount) + (s.bars[ui.tip].bills != null ? ' · ' + plural(s.bars[ui.tip].bills, 'bill') : '') : 'Tap a bar for its figures.') + '</p>';
    return card(title, body);
  }
  function bestSellers(f, limit) {
    var list = Object.keys(f.designs).map(function (k) { return Object.assign({ sub: SUB[k] }, f.designs[k]); }).sort(function (a, b) { return view.sort === 'amount' ? b.amount - a.amount : b.sarees - a.sarees || b.amount - a.amount; });
    var top = list.slice(0, limit || 10), max = top.length ? top[0][view.sort === 'amount' ? 'amount' : 'sarees'] : 1;
    var sw = '<div class="seg2" role="tablist"><button type="button" role="tab" data-sort="sarees" aria-selected="' + (view.sort !== 'amount') + '">By sarees</button><button type="button" role="tab" data-sort="amount" aria-selected="' + (view.sort === 'amount') + '">By ₹</button></div>';
    if (!top.length) return { html: sw + emptyCard('layers', 'Nothing sold', 'No designs sold in this period.'), count: 0 };
    return {
      count: list.length,
      html: sw + '<div class="list">' + top.map(function (d, i) {
        var v = view.sort === 'amount' ? d.amount : d.sarees;
        return '<button type="button" class="row dsn" data-design="' + d.sub.id + '"><span class="rank">' + (i + 1) + '</span>' + pthumb(d.sub.img) + '<span class="grow"><b>' + esc(d.sub.name) + '</b><span>' + plural(d.sarees, 'saree') + ' · ' + rs(d.amount) + '</span><i class="mini"><i style="width:' + Math.round(100 * v / max) + '%"></i></i></span></button>';
      }).join('') + '</div>'
    };
  }
  function bargains(f) {
    if (view.ch === 'online') return card('Bargains', '<p class="an-note">Online orders use website prices: no bargains.</p>');
    if (!f.lines) return card('Bargains', '<p class="an-note">No counter or WhatsApp sales in this period.</p>');
    var most = Object.keys(f.designs).map(function (k) { var d = f.designs[k]; return { sub: SUB[k], pct: pct(d.sold, d.store), n: d.sarees, store: d.store }; }).filter(function (d) { return d.store && d.n >= 2; }).sort(function (a, b) { return a.pct - b.pct; }).slice(0, 3);
    return card('Bargains <small>counter and WhatsApp</small>', '<div class="bargain"><b>' + pct(f.sold, f.store) + '%</b><span>of store prices paid on average</span></div>' +
      '<p class="an-sub">' + lakh(f.store - f.sold) + ' below store prices · ' + f.bargained + ' of ' + plural(f.lines, 'saree') + ' bargained</p>' +
      (most.length ? '<div class="list-title">Bargained most</div><div class="list">' + most.map(function (d) { return '<div class="row">' + pthumb(d.sub.img) + '<span class="grow"><b>' + esc(d.sub.name) + '</b><span>' + plural(d.n, 'saree') + ' · store ' + rs(d.sub.store) + '</span></span><span class="amt">' + d.pct + '%</span></div>'; }).join('') + '</div>' : ''));
  }
  function people(f) {
    var ids = Object.keys(f.people).filter(function (k) { return k !== 'none'; }).sort(function (a, b) { return f.people[b].amount - f.people[a].amount; });
    var none = f.people.none;
    if (view.ch === 'online') return card('By person', '<p class="an-note">Online orders are placed by customers on the website.</p>');
    if (!ids.length && !none) return card('By person', '<p class="an-note">No counter or WhatsApp sales in this period.</p>');
    return card('By person', '<div class="list">' + ids.map(function (k) {
      var p = f.people[k], who = PEOPLE[k];
      return '<button type="button" class="row" data-person="' + k + '"><span class="avatar sm">' + who.name[0] + '</span><span class="grow"><b>' + who.name + ' <span class="badge badge-' + (who.role === 'Owner' ? 'owner' : 'staff') + '">' + who.role + '</span></b><span>' + plural(p.bills, 'bill') + ' · ' + plural(p.sarees, 'saree') + ' · ' + pct(p.sold, p.store) + '% of store price</span></span><span class="amt">' + rs(p.amount) + '</span></button>';
    }).join('') + (none ? '<div class="row muted-row"><span class="avatar sm muted">?</span><span class="grow"><b>Not recorded</b><span>Old-app sales: ' + plural(none.bills, 'bill') + '</span></span><span class="amt">' + rs(none.amount) + '</span></div>' : '') + '</div>');
  }
  function payments(f) {
    var order = [['cash', 'Cash', 'cash'], ['upi', 'UPI', 'upi'], ['card', 'Card', 'card'], ['online', 'Online', 'cloud'], ['none', 'Not recorded', 'info']];
    var rows = order.filter(function (o) { return f.pay[o[0]]; });
    if (!rows.length) return card('Payment', '<p class="an-note">No sales in this period.</p>');
    return card('Payment', '<div class="paylist">' + rows.map(function (o) { var v = f.pay[o[0]]; return '<div class="payrow"><span class="lbl">' + icon(o[2], 'icon-sm') + o[1] + '</span><i class="mini"><i style="width:' + pct(v.amount, f.amount) + '%"></i></i><span class="amt">' + rs(v.amount) + '<small>' + plural(v.bills, 'bill') + '</small></span></div>'; }).join('') + '</div>');
  }
  function busiest(f, r) {
    var hrs = []; for (var h = 10; h <= 22; h++) hrs.push(h);
    var mx = Math.max.apply(null, hrs.map(function (h) { return f.hours[h] || 0; }).concat([1]));
    var top = hrs.slice().sort(function (a, b) { return (f.hours[b] || 0) - (f.hours[a] || 0); })[0];
    var body = '<div class="an-bars mini-bars">' + hrs.map(function (h) { return '<span title="' + h + '"><span style="height:' + Math.round(100 * (f.hours[h] || 0) / mx) + '%"></span></span>'; }).join('') + '</div><div class="an-axis">' + hrs.map(function (h) { return '<span>' + ([10, 13, 16, 19, 22].indexOf(h) >= 0 ? (h % 12 || 12) + (h < 12 ? 'a' : 'p') : '') + '</span>'; }).join('') + '</div>' +
      (f.bills ? '<p class="an-sub">Busiest around ' + (top % 12 || 12) + ' ' + (top < 12 ? 'am' : 'pm') + '</p>' : '');
    var have = early() ? days(REAL_START, TODAY) : days(START, TODAY);
    if (have >= 28 && days(r.from, r.to) >= 28) {
      var dmx = Math.max.apply(null, [0, 1, 2, 3, 4, 5, 6].map(function (d) { return f.dow[d] || 0; }).concat([1]));
      body += '<div class="list-title">Days of the week</div><div class="dowlist">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) { return '<div class="payrow"><span class="lbl">' + DOW[d] + '</span><i class="mini"><i style="width:' + Math.round(100 * (f.dow[d] || 0) / dmx) + '%"></i></i><span class="amt">' + rs(f.dow[d] || 0) + '</span></div>'; }).join('') + '</div>';
    } else body += '<p class="an-note">Days of the week appear once a period covers 4 weeks of sales.</p>';
    return card('Busiest hours', body);
  }
  function stockCard() {
    var body = '<div class="an-head two"><div class="kpi"><small>Sarees in stock</small><b>1,535</b></div><div class="kpi"><small>Value at store prices</small><b>₹64.46 lakh</b></div></div>' +
      '<p class="an-note warn">' + icon('alert', 'icon-sm') + '"Gap Border bramini sarees" (44 in stock) has the store price ₹54,310, likely a typo; left out of the value. Fix it in Catalogue.</p>';
    if (early()) body += '<div class="list-title">Not selling</div><p class="an-note">Designs not sold for 60 days appear from early December (sarees were first tagged on 5 Oct).</p>';
    else body += '<div class="list-title">Not sold for 60 days (' + SLOW.length + ')</div><div class="list">' + SLOW.map(function (x) { return '<button type="button" class="row" data-design="' + x.sub.id + '">' + pthumb(x.sub.img) + '<span class="grow"><b>' + esc(x.sub.name) + '</b><span>' + x.left + ' in stock · ' + (x.lastSold === 'never' ? 'none sold yet' : 'last sold ' + x.lastSold) + '</span></span><span class="amt">' + lakh(x.left * x.sub.store) + '</span></button>'; }).join('') + '</div>';
    return card('Stock', body, ' data-card="stock"');
  }

  /* ================= Screens ================= */
  var S = {}, ui = {};
  function locked(title) { return { html: '<section class="scr">' + topBar(title, null) + '<div class="scr-body narrow">' + emptyCard('lock', 'For owners', 'Analytics shows money totals and each person\'s sales, so it is for owners.') + '</div></section>' }; }
  S.analytics = function () {
    if (!owner()) return locked('Analytics');
    var r = periodOf(view.p, view.custom), b = beforeOf(view.p === 'custom' ? 'x' : view.p, r);
    if (state === 'loading') return { html: '<section class="scr">' + topBar('Analytics', 'more') + '<div class="scr-body">' + filters(r, b) + '<div class="skeleton" style="height:120px;border-radius:18px;margin:12px 0"></div><div class="skeleton" style="height:200px;border-radius:18px"></div></div></section>', mount: mountMain };
    if (state === 'error') return { html: '<section class="scr">' + topBar('Analytics', 'more') + '<div class="scr-body">' + filters(r, b) + alertBox('error', 'Couldn\'t load Analytics', 'Check the internet and try again.', null, '<button type="button" class="btn btn-sm" data-retry style="margin-top:.5rem">' + icon('refresh', 'icon-sm') + 'Retry</button>') + '</div></section>', mount: mountMain };
    var f = figures(r, view.ch), g = figures(b, view.ch);
    var best = bestSellers(f), bs = card('Best-selling designs', best.html + (best.count > 10 ? '<button type="button" class="btn btn-block btn-sm" data-go="designs" style="margin-top:.6rem">See all ' + best.count + ' designs</button>' : ''));
    var note = early() ? alertBox('info', 'Sales recorded from 5 Oct 2026', 'Sarees were first tagged then, so the charts and comparisons fill in over the coming weeks.') : '';
    var cards;
    if (NH.opts.layout === 'b') {
      var T = [['sales', 'Sales'], ['designs', 'Designs'], ['people', 'People'], ['stock', 'Stock']];
      var tabs = '<div class="seg4" role="tablist">' + T.map(function (t) { return '<button type="button" role="tab" data-tab4="' + t[0] + '" aria-selected="' + (view.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
      var pane = view.tab === 'designs' ? bs + bargains(f) : view.tab === 'people' ? people(f) : view.tab === 'stock' ? stockCard() : card('Sales', headline(f, g, b)) + chart(r, f) + payments(f) + busiest(f, r);
      cards = tabs + '<div class="an-grid">' + pane + '</div>';
    } else {
      cards = '<div class="an-grid">' + card('Sales', headline(f, g, b)) + chart(r, f) + bs + bargains(f) + people(f) + payments(f) + busiest(f, r) + stockCard() + '</div>';
    }
    return { html: '<section class="scr">' + topBar('Analytics', 'more') + '<div class="scr-body">' + note + filters(r, b) + cards + '</div></section>', mount: mountMain };
  };
  function mountMain(el) {
    el.querySelectorAll('[data-p]').forEach(function (x) { x.addEventListener('click', function () { if (x.dataset.p === 'custom') return openCalendar(); view.p = x.dataset.p; view.custom = null; ui.tip = null; saveView(); render(); }); });
    el.querySelectorAll('[data-ch]').forEach(function (x) { x.addEventListener('click', function () { view.ch = x.dataset.ch; ui.tip = null; saveView(); render(); }); });
    el.querySelectorAll('[data-sort]').forEach(function (x) { x.addEventListener('click', function () { view.sort = x.dataset.sort; saveView(); render(); }); });
    el.querySelectorAll('[data-tab4]').forEach(function (x) { x.addEventListener('click', function () { view.tab = x.dataset.tab4; saveView(); render(); }); });
    el.querySelectorAll('[data-bar]').forEach(function (x) { x.addEventListener('click', function () { ui.tip = +x.dataset.bar; render(); }); });
    el.querySelectorAll('[data-design]').forEach(function (x) { x.addEventListener('click', function () { toast('Opens ' + SUB[x.dataset.design].name + ' in Products (Module 4)'); }); });
    el.querySelectorAll('[data-person]').forEach(function (x) { x.addEventListener('click', function () { go('person?id=' + x.dataset.person); }); });
    var rt = el.querySelector('[data-retry]'); rt && rt.addEventListener('click', function () { state = 'normal'; render(); });
  }
  function openCalendar() {
    var r = view.custom || { from: '2026-09-01', to: TODAY };
    sheet('<h2 class="sheet-title">Any dates</h2><p class="field-hint">Whole days, India time, up to today.</p><div class="row2"><label class="field">First day<input class="input" type="date" data-from min="' + START + '" max="' + TODAY + '" value="' + r.from + '"></label><label class="field">Last day<input class="input" type="date" data-to min="' + START + '" max="' + TODAY + '" value="' + r.to + '"></label></div><p class="field-error" data-err hidden></p><div class="sheet-actions"><button type="button" class="btn btn-primary btn-block" data-apply>Show</button><button type="button" class="btn btn-block" data-close>Cancel</button></div>', function (el, close) {
      el.querySelector('[data-apply]').addEventListener('click', function () {
        var a = el.querySelector('[data-from]').value, b = el.querySelector('[data-to]').value, err = el.querySelector('[data-err]');
        if (!a || !b || a > b) { err.hidden = false; err.textContent = 'The first day must be on or before the last day.'; return; }
        if (b > TODAY) { err.hidden = false; err.textContent = 'Up to today.'; return; }
        view.p = 'custom'; view.custom = { from: a, to: b }; ui.tip = null; saveView(); close(); render();
      });
    });
  }
  S.designs = function () {
    if (!owner()) return locked('All designs');
    var r = periodOf(view.p, view.custom), f = figures(r, view.ch);
    if (state === 'empty') f.designs = {};
    var best = bestSellers(f, 999);
    return { html: '<section class="scr">' + topBar('All designs', 'analytics') + '<div class="scr-body narrow"><p class="an-range"><b>' + rangeText(r) + '</b> · ' + (CHS.filter(function (c) { return c[0] === view.ch; })[0][1]) + ' · ' + plural(best.count, 'design') + '</p>' + best.html + '</div></section>', mount: mountMain };
  };
  S.person = function (p) {
    if (!owner()) return locked('Person');
    var who = PEOPLE[p.id] || PEOPLE.ravi, r = periodOf(view.p, view.custom), f = figures(r, view.ch === 'online' ? 'all' : view.ch);
    var mine = { list: f.list.filter(function (b) { return b.by === who.id; }) };
    var pf = f.people[who.id] || { bills: 0, sarees: 0, amount: 0, store: 0, sold: 0 };
    var ds = {}; mine.list.forEach(function (b) { b.lines.forEach(function (l) { ds[l.sub] = ds[l.sub] || { n: 0, a: 0 }; ds[l.sub].n++; ds[l.sub].a += l.sold; }); });
    var topD = Object.keys(ds).sort(function (a, b) { return ds[b].n - ds[a].n; }).slice(0, 5);
    var recent = mine.list.slice(-5).reverse();
    return {
      html: '<section class="scr">' + topBar(who.name, 'analytics', '<span class="top-act badge badge-' + (who.role === 'Owner' ? 'owner' : 'staff') + '">' + who.role + '</span>') + '<div class="scr-body narrow"><p class="an-range"><b>' + rangeText(r) + '</b></p>' +
        '<div class="an-head">' + [['Sales', rs(pf.amount)], ['Bills', INR.format(pf.bills)], ['Sarees', INR.format(pf.sarees)], ['Of store price', pf.store ? pct(pf.sold, pf.store) + '%' : '—']].map(function (c) { return '<div class="kpi"><small>' + c[0] + '</small><b>' + c[1] + '</b></div>'; }).join('') + '</div>' +
        '<div class="list-title">Designs they sold most</div>' + (topD.length ? '<div class="list">' + topD.map(function (k) { return '<div class="row">' + pthumb(SUB[k].img) + '<span class="grow"><b>' + esc(SUB[k].name) + '</b><span>' + plural(ds[k].n, 'saree') + ' · ' + rs(ds[k].a) + '</span></span></div>'; }).join('') + '</div>' : emptyCard('layers', 'No sales', 'Nothing sold by ' + who.name + ' in this period.')) +
        '<div class="list-title">Last bills</div>' + (recent.length ? '<div class="list">' + recent.map(function (b) { return '<div class="row"><span class="grow"><b>' + dd(b.d) + ', ' + (b.h % 12 || 12) + ' ' + (b.h < 12 ? 'am' : 'pm') + ' · ' + plural(b.lines.length, 'saree') + '</b><span>' + ({ cash: 'Cash', upi: 'UPI', card: 'Card' }[b.pay] || 'Not recorded') + ' · ' + pct(b.total, b.lines.reduce(function (t, l) { return t + l.store; }, 0)) + '% of store price</span></span><span class="amt">' + rs(b.total) + '</span></div>'; }).join('') + '</div>' : '') +
        '</div></section>'
    };
  };

  /* ================= Render ================= */
  var FULL = { designs: 1, person: 1 };
  function render() {
    closers = [];
    Array.prototype.slice.call(overlays.children).forEach(function (c) { if (!c.classList.contains('app-toast')) c.remove(); });
    var name = current.name, fn = S[name] || S.analytics;
    var scr = fn(current.params || {});
    viewport.innerHTML = FULL[name] ? scr.html : shell(scr.html);
    var el = viewport.querySelector('.scr') || viewport.firstElementChild;
    viewport.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.go === 'more' ? 'analytics' : b.dataset.go); if (b.dataset.go === 'more') toast('Back to More (Module 2)'); }); });
    viewport.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { toast('This tab is another module'); }); });
    scr.mount && scr.mount(el);
    var spec = window.NH_SCREENS.filter(function (s) { return NH_ROUTE(s).split('?')[0] === name; });
    if (state !== 'normal' && spec.length && !spec.some(function (s) { return s.states.indexOf(state) >= 0; })) NH.toast('"' + state + '" isn\'t a state of this screen. Try: ' + (spec.map(function (s) { return s.states.join(', '); }).filter(Boolean).join(', ') || 'none'));
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && closers.length) { closers[closers.length - 1](); e.stopPropagation(); } });

  window.NHApp = {
    setState: function (s) { state = s; render(); },
    go: go,
    action: function (name) { if (name === 'reset') { view = { p: 'month', ch: 'all', custom: null, sort: 'sarees', tab: 'sales' }; saveView(); ui = {}; state = 'normal'; go('analytics'); } },
    figures: function (from, to, ch) { return figures({ from: from, to: to }, ch || 'all'); },
    periodOf: periodOf, beforeOf: beforeOf
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
    window.addEventListener('hashchange', onRoute);
    onRoute();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
