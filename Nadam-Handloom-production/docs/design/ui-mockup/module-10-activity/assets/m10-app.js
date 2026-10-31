/* Module 10 (Activity log): the clickable app.
   Designs, tags, photos and the ₹3,800 → ₹54,310 price change are real (copy of 11 Oct
   2026); the other entries are sample. The pretend list follows the plan's rules:
   plain sentences, kinds, important marks, grouped repeats, filters and search. */
(function () {
  'use strict';
  var NH = window.NH;
  var EMBED = /[?&]embed=1/.test(location.search);
  var VIEW_KEY = 'nh-m10-view';

  /* ================= Sample entries ================= */
  var SUBS = {}; window.NH_CATALOG.categories.forEach(function (c) { c.subs.forEach(function (s) { SUBS[s.id] = s; }); });
  var RAINBOW = SUBS['34f68ec3'], BRAMINI = SUBS.b6b360c9;
  var RAINBOW_ITEMS = window.NH_PRODUCTS.filter(function (p) { return p.sub === '34f68ec3'; }).concat(window.NH_PRODUCTS.filter(function (p) { return p.img; })).slice(0, 48);
  var KINDS = [['all', 'All'], ['sales', 'Sales'], ['orders', 'Orders'], ['prices', 'Prices and catalogue'], ['products', 'Products and tags'], ['team', 'Team'], ['signin', 'Sign-in']];
  var KIND_ICON = { sales: 'receipt', orders: 'truck', prices: 'tag', products: 'box', team: 'users', signin: 'shield' };
  var PEOPLE = ['Lakshmi', 'Ravi', 'Anil', 'System Admin', 'Admin 8565'];
  var PHONES = { Lakshmi: 'Lakshmi\'s iPhone', Ravi: 'Ravi\'s Redmi', Anil: 'Anil\'s Galaxy', 'System Admin': 'Shop iPad', 'Admin 8565': 'Owner\'s phone' };
  function E(id, day, time, who, kind, text, o) { return Object.assign({ id: id, day: day, time: time, who: who, kind: kind, text: text, important: false, details: [], link: null }, o || {}); }
  var ENTRIES = [
    E('a1', 'Today', '7:55 pm', 'Lakshmi', 'sales', 'Lakshmi sold 2 sarees for ₹11,400 (card)', { details: [['Bill', 'NH40718920'], ['Sarees', 'NH1022 · NH1177'], ['Paid by', 'Card']], link: 'the sale' }),
    E('a2', 'Today', '7:12 pm', 'Ravi', 'sales', 'Ravi sold Rainbow checks sarees NH2264 for ₹1,500, below half its store price ₹3,600', { important: true, details: [['Bill', 'NH40718915'], ['Tag', 'NH2264'], ['Store price', '₹3,600'], ['Sold for', '₹1,500 (42%)']], link: 'the sale' }),
    E('a3', 'Today', '6:40 pm', 'Ravi', 'sales', 'Ravi made a WhatsApp order for Padma: 2 sarees, ₹7,200', { details: [['Order', 'NH40718001'], ['Paid by', 'UPI']], link: 'the order' }),
    E('a4', 'Today', '5:30 pm', 'Anil', 'orders', 'Anil shipped order NH40718001 by DTDC, H1001830833', { details: [['Order', 'NH40718001 (Padma)'], ['Tracking number', 'H1001830833']], link: 'the order' }),
    E('a5', 'Today', '3:05 pm', 'Lakshmi', 'sales', 'Lakshmi cancelled sale NH33234657 (₹3,600): "Customer changed her mind"', { important: true, details: [['Sale', 'NH33234657, 6:59 am by Anil'], ['Sarees back in stock', 'NH10'], ['Invoice', 'none']], link: 'the sale' }),
    E('a6', 'Today', '2:10 pm', 'Lakshmi', 'team', 'Lakshmi invited Anil as Staff', { details: [['Mobile', '+91 90000 00006'], ['Role', 'Staff']], link: 'Anil' }),
    E('a7', 'Today', '1:20 pm', 'Ravi', 'products', 'Ravi replaced the damaged tag NH2231 with NH9934 on 250k Baguru Printed Dress Material', { important: true, details: [['Saree', 'NH-HPDM-019'], ['Old tag', 'NH2231 (retired)'], ['New tag', 'NH9934']], link: 'the saree' }),
    E('a8', 'Today', '11:02 am', 'Ravi', 'signin', 'Ravi signed in on a new phone: Ravi\'s Redmi Note 12', { important: true, details: [['Phone', 'Ravi\'s Redmi Note 12 (Android)'], ['Checked with', 'SMS code']], link: 'Ravi' }),
    E('a9', 'Today', '10:15 am', 'Ravi', 'signin', 'Ravi\'s PIN was locked for 15 minutes after 5 wrong tries', { important: true, details: [['Phone', 'Ravi\'s Redmi'], ['Locked until', '10:30 am']], link: 'Ravi' }),
    E('a10', 'Today', '9:58 am', 'Lakshmi', 'signin', 'Lakshmi signed in', { details: [['Phone', 'Lakshmi\'s iPhone'], ['With', 'Face ID']] }),
    E('b1', 'Yesterday', '9:51 pm', 'Anil', 'sales', 'Anil sold 1 saree for ₹3,600 (cash)', { details: [['Bill', 'NH40718880'], ['Tag', 'NH16']], link: 'the sale' }),
    E('b2', 'Yesterday', '6:15 pm', 'Lakshmi', 'sales', 'Lakshmi chose "Sell anyway": sold NH1177, which a website checkout was holding', { important: true, details: [['Saree', 'Scallop Kollam & Design Printed Saree · NH1177'], ['Website checkout', 'cancelled; its other sarees back on sale']], link: 'the sale' }),
    E('b3', 'Yesterday', '4:00 pm', 'Ravi', 'orders', 'Ravi changed the tracking number of order NH40718012: H1001830812 → H1001830815', { details: [['Order', 'NH40718012 (Lalitha)'], ['Before', 'H1001830812'], ['After', 'H1001830815']], link: 'the order' }),
    E('b4', 'Yesterday', '12:30 pm', 'System Admin', 'products', 'System Admin deleted 50/50 Plain Dress Materials NH-HCDM-001 (tag NANDAM2271 freed)', { important: true, details: [['Saree', 'NH-HCDM-001'], ['Tag', 'NANDAM2271, freed for reuse']] }),
    E('b5', 'Yesterday', '11:00 am', 'Lakshmi', 'prices', 'Lakshmi changed the store price of Rainbow checks sarees: ₹3,400 → ₹3,600', { important: true, details: [['Design', 'Rainbow checks sarees'], ['Store price', '₹3,400 → ₹3,600'], ['Website price', '₹3,000 (same)']], link: 'the design' }),
    E('e3', 'Sat 10 Oct', '4:31 pm', 'System Admin', 'prices', 'System Admin changed the store price of Gap Border bramini sarees: ₹3,800 → ₹54,310', { important: true, real: true, details: [['Design', 'Gap Border bramini sarees'], ['Store price', '₹3,800 → ₹54,310'], ['Website price', '₹25,888'], ['MRP', '₹16,999'], ['Note', 'Above the MRP: probably a typo (Analytics → Prices to check)']], link: 'the design' }),
    E('g2', 'Sat 10 Oct', '1:30–2:10 pm', 'Admin 8565', 'orders', 'Admin 8565 shipped 6 WhatsApp orders by DTDC', { group: ['NH40718101 · H1001830791', 'NH40718102 · H1001830792', 'NH40718103 · H1001830793', 'NH40718104 · H1001830794', 'NH40718105 · H1001830795', 'NH40718106 · H1001830796'] }),
    E('g1', 'Sat 10 Oct', '10:02–10:41 am', 'System Admin', 'products', 'System Admin added 48 sarees to Rainbow checks sarees', { group: 'rainbow' }),
    E('c1', 'Sat 10 Oct', '9:40 am', 'System Admin', 'prices', 'System Admin made the catalogue PDF for Rainbow checks sarees (36 sarees)', { details: [['Design', 'Rainbow checks sarees'], ['Sarees in the PDF', '36']], link: 'the design' }),
    E('d1', 'Fri 9 Oct', '7:20 pm', 'System Admin', 'sales', 'System Admin sold 9 sarees for ₹16,000 (3 below half the store price)', { important: true, details: [['Bill', 'NH12562468'], ['Store prices', '₹38,700'], ['Sold for', '₹16,000 (41%)']], link: 'the sale' }),
    E('d2', 'Fri 9 Oct', '11:05 am', 'Lakshmi', 'team', 'Lakshmi changed Ravi\'s role: Owner → Staff', { important: true, details: [['Person', 'Ravi'], ['Role', 'Owner → Staff']], link: 'Ravi' })
  ];
  function byId(id) { return ENTRIES.filter(function (e) { return e.id === id; })[0]; }

  /* ================= State ================= */
  var view = (function () { try { return JSON.parse(sessionStorage.getItem(VIEW_KEY)) || {}; } catch (e) { return {}; } })();
  if (!view.kind) view = { kind: 'all', person: 'all', period: '30d', important: false, q: '' };
  function saveView() { try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch (e) { } }
  function flags() { return NH.flags(); }
  function owner() { return flags().viewAs !== 'staff'; }
  function filtered() {
    var q = (view.q || '').trim().toLowerCase();
    return ENTRIES.filter(function (e) {
      if (view.kind !== 'all' && e.kind !== view.kind) return false;
      if (view.person !== 'all' && e.who !== view.person) return false;
      if (view.important && !e.important) return false;
      if (view.period === 'today' && e.day !== 'Today') return false;
      if (view.period === '7d' && e.day === 'Fri 2 Oct') return false;
      if (q && (e.text + ' ' + e.who + ' ' + e.details.map(function (d) { return d.join(' '); }).join(' ') + ' ' + (Array.isArray(e.group) ? e.group.join(' ') : '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  /* ================= Helpers ================= */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(n, c) { return NH.icon(n, c); }
  function topBar(title, back, right) { return '<div class="scr-top">' + (back ? '<button class="icon-btn" type="button" data-go="' + back + '" aria-label="Back">' + icon('back') + '</button>' : '<span style="width:12px"></span>') + '<h1>' + (title || '') + '</h1>' + (right || '') + '</div>'; }
  function alertBox(type, title, text, ic, extra) { var map = { info: 'info', success: 'check', warning: 'alert', error: 'alertc' }; return '<div class="alert alert-' + type + '" role="' + (type === 'error' ? 'alert' : 'status') + '">' + icon(ic || map[type]) + '<div>' + (title ? '<strong>' + title + '</strong>' : '') + (text ? '<p>' + text + '</p>' : '') + (extra || '') + '</div></div>'; }
  function emptyCard(ic, title, text) { return '<div class="ph-tile" style="min-height:130px;align-items:center;justify-content:center;text-align:center;gap:.4rem">' + icon(ic, 'icon-xl') + '<b>' + title + '</b><span>' + text + '</span></div>'; }
  function pthumb(img) { return '<span class="pthumb">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : icon('image')) + '</span>'; }

  /* ================= Overlays ================= */
  var overlays, root, viewport, closers = [];
  function addOverlay(html) { var d = document.createElement('div'); d.innerHTML = html; var el = d.firstElementChild; overlays.appendChild(el); return el; }
  function toast(msg) { var old = overlays.querySelector('.app-toast'); if (old) old.remove(); var t = addOverlay('<div class="app-toast" role="status">' + icon('info') + esc(msg) + '</div>'); setTimeout(function () { t.remove(); }, 2800); }
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
    return { name: q[0] || 'activity', params: p };
  }
  function go(route) { if (('#/' + route) === location.hash) render(); else location.hash = '#/' + route; }
  function onRoute() {
    var r = parse(), h = location.hash;
    if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop(); else if (stack[stack.length - 1] !== h) stack.push(h);
    if (r.name !== current.name || JSON.stringify(r.params) !== JSON.stringify(current.params)) state = 'normal';
    current = r;
    var want = r.params.as === 'staff' ? 'staff' : (r.params.as === 'owner' ? 'owner' : null);
    if (want && flags().viewAs !== want) NH.setFlag('viewAs', want, true);
    if (r.name === 'activity') {
      if (r.params.demo === '1') view = { kind: 'all', person: 'all', period: '30d', important: false, q: '' };
      if (r.params.kind) view.kind = r.params.kind;
      if (r.params.important) view.important = true;
      if (r.params.q != null) view.q = r.params.q;
      saveView();
    }
    render();
    if (r.params.demo === 'filters') openFilters();
    document.dispatchEvent(new CustomEvent('nh:route', { detail: { name: r.name, params: Object.assign({}, r.params) } }));
  }

  /* ================= Shell ================= */
  var TABS = [['home', 'home', 'Home'], ['orders', 'orders', 'Orders'], ['scan', 'scan', 'Scan'], ['products', 'box', 'Products'], ['more', 'more', 'More']];
  function shell(inner, cur) {
    cur = cur || 'more';
    var tabs = TABS.map(function (t) {
      if (t[0] === 'scan') return '<button type="button" class="scan-tab" data-tab="scan" aria-label="Scan"><span class="scan-ico">' + icon('scan') + '</span></button>';
      return '<button type="button" data-tab="' + t[0] + '"' + (t[0] === cur ? ' aria-current="page"' : '') + '>' + icon(t[1]) + t[2] + '</button>';
    }).join('');
    var rail = '<nav class="rail" aria-label="Main menu"><img src="assets/logo.png" alt="Nandam Handlooms">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '"' + (t[0] === cur ? ' aria-current="page"' : '') + '>' + icon(t[1]) + t[2] + '</button>'; }).join('') + '</nav>';
    var bar = flags().offline ? '<div class="saved-bar">' + icon('wifioff') + 'Offline · Activity needs internet.</div>' : '';
    return '<div class="shell">' + rail + '<div class="shell-main">' + bar + inner + '</div><nav class="tabbar" aria-label="Main menu">' + tabs + '</nav></div>';
  }

  /* ================= Screens ================= */
  var S = {};
  var PERIOD_TEXT = { today: 'Today', '7d': '7 days', '30d': '30 days', any: 'Any dates' };
  function activeFilters() {
    var bits = [];
    if (NH.opts.filters === 'b' && view.kind !== 'all') bits.push(KINDS.filter(function (k) { return k[0] === view.kind; })[0][1]);
    if (view.person !== 'all') bits.push(view.person);
    if (view.period !== '30d') bits.push(PERIOD_TEXT[view.period]);
    if (view.important) bits.push('Important only');
    return bits;
  }
  function row(e) {
    var t = NH.opts.list === 'b';
    return '<button type="button" class="act-row' + (t ? ' tl' : '') + (e.important ? ' imp' : '') + '" data-entry="' + e.id + '">' +
      (t ? '<span class="dot k-' + e.kind + '"></span>' : '<span class="tile k-' + e.kind + '">' + icon(KIND_ICON[e.kind]) + '</span>') +
      '<span class="grow"><b>' + esc(e.text) + '</b><span>' + e.time + ' · ' + esc(PHONES[e.who] || e.who) + (e.group ? ' · <u>' + (Array.isArray(e.group) ? e.group.length : 48) + ' entries</u>' : '') + '</span></span>' +
      (e.important ? '<span class="imp-mark" aria-label="Important">' + icon('alert', 'icon-sm') + '</span>' : '') + '</button>';
  }
  S.activity = function () {
    if (!owner()) return { html: '<section class="scr">' + topBar('Activity', 'more') + '<div class="scr-body narrow">' + emptyCard('lock', 'For owners', 'Activity shows everyone\'s actions, so it is for owners.') + '</div></section>' };
    var B = NH.opts.filters === 'b', list = filtered(), bits = activeFilters();
    var head = '<div class="act-search"><span class="search-ico">' + icon('search', 'icon-sm') + '</span><input type="search" class="input" data-q placeholder="Tag, order, design or person" value="' + esc(view.q) + '" aria-label="Search activity"></div>';
    head += B ? '<div class="act-filterbar"><button type="button" class="btn btn-sm" data-filters>' + icon('filter', 'icon-sm') + 'Filter' + (bits.length ? ' (' + bits.length + ')' : '') + '</button>' + (bits.length ? '<span class="act-bits">' + bits.join(' · ') + '</span>' : '<span class="act-bits muted">Everything, last 30 days</span>') + '</div>'
      : '<div class="act-chips" role="group" aria-label="Kind">' + KINDS.map(function (k) { return '<button type="button" class="an-chip sm" data-kind="' + k[0] + '" aria-pressed="' + (view.kind === k[0]) + '">' + k[1] + '</button>'; }).join('') + '</div>' +
        '<div class="act-filterbar"><button type="button" class="btn btn-sm" data-filters>' + icon('filter', 'icon-sm') + 'Filters' + (bits.length ? ' (' + bits.length + ')' : '') + '</button>' + (bits.length ? '<span class="act-bits">' + bits.join(' · ') + '</span>' : '<span class="act-bits muted">Everyone · last 30 days</span>') + '</div>';
    var body;
    if (state === 'loading') body = '<div class="skeleton" style="height:60px;border-radius:14px;margin-bottom:8px"></div><div class="skeleton" style="height:60px;border-radius:14px;margin-bottom:8px"></div><div class="skeleton" style="height:60px;border-radius:14px"></div>';
    else if (state === 'error') body = alertBox('error', 'Couldn\'t load Activity', 'Check the internet and try again.', null, '<button type="button" class="btn btn-sm" data-retry style="margin-top:.5rem">' + icon('refresh', 'icon-sm') + 'Retry</button>');
    else if (state === 'empty' || !list.length) body = emptyCard(view.q ? 'search' : 'history', view.q ? 'Nothing matches "' + esc(view.q) + '"' : 'Nothing here', view.q ? 'Try a tag like NH2264, an order number or a name.' : 'No activity for these filters.');
    else {
      var days = []; list.forEach(function (e) { if (days.indexOf(e.day) < 0) days.push(e.day); });
      body = days.map(function (d) { return '<div class="list-title">' + d + '</div><div class="list act-list' + (NH.opts.list === 'b' ? ' timeline-list' : '') + '">' + list.filter(function (e) { return e.day === d; }).map(row).join('') + '</div>'; }).join('') +
        '<p class="act-foot">Kept for years: sales, prices, stock, orders and team records are never deleted; sign-ins are kept 1 year.</p>';
    }
    return { html: '<section class="scr">' + topBar('Activity', 'more') + '<div class="scr-body narrow">' + head + body + '</div></section>', mount: mountList };
  };
  function mountList(el) {
    var q = el.querySelector('[data-q]');
    if (q) { q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { view.q = q.value; saveView(); render(); } }); q.addEventListener('search', function () { view.q = q.value; saveView(); render(); }); }
    el.querySelectorAll('[data-kind]').forEach(function (b) { b.addEventListener('click', function () { view.kind = b.dataset.kind; saveView(); render(); }); });
    var f = el.querySelector('[data-filters]'); f && f.addEventListener('click', openFilters);
    el.querySelectorAll('[data-entry]').forEach(function (b) { b.addEventListener('click', function () { var e = byId(b.dataset.entry); if (e.group) go('entry?id=' + e.id); else openEntry(e); }); });
    var r = el.querySelector('[data-retry]'); r && r.addEventListener('click', function () { state = 'normal'; render(); });
  }
  function openFilters() {
    var B = NH.opts.filters === 'b', d = { kind: view.kind, person: view.person, period: view.period, important: view.important };
    function chips(key, items) { return '<div class="act-chips wrap" role="group">' + items.map(function (i) { return '<button type="button" class="an-chip sm" data-f="' + key + '" data-v="' + i[0] + '" aria-pressed="' + (String(d[key]) === String(i[0])) + '">' + i[1] + '</button>'; }).join('') + '</div>'; }
    sheet('<h2 class="sheet-title">' + (B ? 'Filter' : 'Filters') + '</h2>' +
      (B ? '<div class="field-label">Kind</div>' + chips('kind', KINDS) : '') +
      '<div class="field-label">Person</div>' + chips('person', [['all', 'Everyone']].concat(PEOPLE.map(function (p) { return [p, p]; }))) +
      '<div class="field-label">Period</div>' + chips('period', [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['any', 'Any dates']]) +
      '<label class="act-toggle"><input type="checkbox" data-imp' + (d.important ? ' checked' : '') + '> Important only</label>' +
      '<div class="sheet-actions"><button type="button" class="btn btn-primary btn-block" data-apply>Show</button><button type="button" class="btn btn-block" data-clear>Clear filters</button></div>', function (el, close) {
      el.querySelectorAll('[data-f]').forEach(function (b) { b.addEventListener('click', function () { d[b.dataset.f] = b.dataset.v; el.querySelectorAll('[data-f="' + b.dataset.f + '"]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }); });
      el.querySelector('[data-imp]').addEventListener('change', function (e) { d.important = e.target.checked; });
      el.querySelector('[data-apply]').addEventListener('click', function () { Object.assign(view, d); saveView(); close(); render(); });
      el.querySelector('[data-clear]').addEventListener('click', function () { view = { kind: 'all', person: 'all', period: '30d', important: false, q: view.q }; saveView(); close(); render(); });
    });
  }
  function openEntry(e) {
    sheet('<div class="entry-head"><span class="tile k-' + e.kind + '">' + icon(KIND_ICON[e.kind]) + '</span>' + (e.important ? '<span class="badge badge-warning">Important</span>' : '') + (e.real ? '<span class="badge badge-info">Real entry, 10 Oct</span>' : '') + '</div>' +
      '<h2 class="sheet-title">' + esc(e.text) + '</h2>' +
      '<dl class="entry-facts"><div><dt>Who</dt><dd>' + esc(e.who) + '</dd></div><div><dt>When</dt><dd>' + (e.day === 'Today' ? '12 Oct 2026' : e.day === 'Yesterday' ? '11 Oct 2026' : e.day.replace(/^\w+ /, '') + ' 2026') + ', ' + e.time + '</dd></div><div><dt>Phone</dt><dd>' + esc(PHONES[e.who] || '—') + '</dd></div>' +
      e.details.map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="sheet-actions">' + (e.link ? '<button type="button" class="btn btn-primary btn-block" data-open>Open ' + e.link + '</button>' : '') + '<button type="button" class="btn btn-block" data-close>Close</button></div>', function (el) {
      var o = el.querySelector('[data-open]'); o && o.addEventListener('click', function () { toast('Opens ' + e.link + ' (pretend)'); });
    });
  }
  S.entry = function (p) {
    var e = byId(p.id) || byId('g1');
    if (!owner()) return S.activity();
    if (!e.group) { setTimeout(function () { openEntry(e); }, 0); return S.activity(); }
    var items = e.group === 'rainbow' ? RAINBOW_ITEMS.map(function (x, i) { return { img: x.img, title: (RAINBOW ? RAINBOW.name : 'Rainbow checks sarees') + ' · ' + x.tags[0][0], sub: x.sku + ' · ' + (10 + Math.floor(i * 39 / 48)) + ':' + String((2 + i * 49) % 60).padStart(2, '0') + ' am' }; }) : e.group.map(function (g) { return { title: 'Order ' + g.split(' · ')[0], sub: 'DTDC ' + g.split(' · ')[1] }; });
    return {
      html: '<section class="scr">' + topBar(Array.isArray(e.group) ? '6 orders shipped' : '48 sarees added', 'activity') + '<div class="scr-body narrow"><p class="field-hint" style="margin:0 0 .6rem">' + esc(e.text) + ' · ' + e.day + ', ' + e.time + '</p>' +
        '<div class="list">' + items.map(function (x) { return '<button type="button" class="row" data-item>' + (x.img !== undefined ? pthumb(x.img) : '<span class="tile k-orders">' + icon('truck') + '</span>') + '<span class="grow"><b>' + esc(x.title) + '</b><span>' + esc(x.sub) + '</span></span>' + icon('right', 'chev') + '</button>'; }).join('') + '</div></div></section>',
      full: true,
      mount: function (el) { el.querySelectorAll('[data-item]').forEach(function (b) { b.addEventListener('click', function () { toast('Opens it (pretend)'); }); }); }
    };
  };
  S['home-alert'] = function () {
    return {
      html: '<section class="scr"><div class="scr-body"><div class="home-head"><span class="avatar">LD</span><div style="flex:1"><h1>Good morning, Lakshmi</h1><p>Mon 12 Oct · Updated just now</p></div></div>' +
        '<div class="list-title">Needs attention</div><div class="list"><button type="button" class="row" data-alert><span class="tile k-signin">' + icon('shield') + '</span><span class="grow"><b>1 security alert</b><span>Ravi\'s PIN was locked after 5 wrong tries · 10:15 am</span></span>' + icon('right', 'chev') + '</button>' +
        '<button type="button" class="row"><span class="tile k-orders">' + icon('orders') + '</span><span class="grow"><b>2 orders to ship</b><span>Oldest waiting 2 days</span></span>' + icon('right', 'chev') + '</button></div>' +
        '<p class="field-hint" style="margin-top:.8rem">Shown for 24 hours after a locked PIN or a blocked stolen sign-in (owners only). Tap it: Activity on Sign-in.</p></div></section>',
      cur: 'home',
      mount: function (el) { el.querySelector('[data-alert]').addEventListener('click', function () { view = { kind: 'signin', person: 'all', period: 'today', important: false, q: '' }; saveView(); go('activity'); }); }
    };
  };

  /* ================= Render ================= */
  function render() {
    closers = [];
    Array.prototype.slice.call(overlays.children).forEach(function (c) { if (!c.classList.contains('app-toast')) c.remove(); });
    var name = current.name, fn = S[name] || S.activity;
    var scr = fn(current.params || {});
    viewport.innerHTML = scr.full ? scr.html : shell(scr.html, scr.cur);
    var el = viewport.querySelector('.scr') || viewport.firstElementChild;
    viewport.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.go === 'more') return toast('Back to More (Module 2)'); go(b.dataset.go); }); });
    viewport.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { toast('This tab is another module'); }); });
    scr.mount && scr.mount(el);
    var spec = window.NH_SCREENS.filter(function (s) { return NH_ROUTE(s).split('?')[0] === name; });
    if (state !== 'normal' && spec.length && !spec.some(function (s) { return s.states.indexOf(state) >= 0; })) NH.toast('"' + state + '" isn\'t a state of this screen. Try: ' + (spec.map(function (s) { return s.states.join(', '); }).filter(Boolean).join(', ') || 'none'));
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && closers.length) { closers[closers.length - 1](); e.stopPropagation(); } });

  window.NHApp = {
    setState: function (s) { state = s; render(); },
    go: go,
    action: function (name) { if (name === 'reset') { view = { kind: 'all', person: 'all', period: '30d', important: false, q: '' }; saveView(); state = 'normal'; go('activity'); } },
    count: function () { return filtered().length; }
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
