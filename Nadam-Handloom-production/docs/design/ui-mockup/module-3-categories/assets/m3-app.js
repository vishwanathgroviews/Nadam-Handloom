/* Module 3 (Categories and subcategories): the clickable app.
   Uses the shop's real catalogue (copied 11 Oct 2026) and a small pretend backend
   that applies the agreed rules: delete = inactive (never erased), no delete while
   sarees are in stock, MRP above the website price, the price check, and more. */
(function () {
  'use strict';
  var NH = window.NH;
  var EMBED = /[?&]embed=1/.test(location.search);
  var DEMO_KEY = 'nh-m3-demo';
  var MAX_PRICE = 1000000;

  /* ================= Pretend backend ================= */
  function freshDemo() {
    var cats = JSON.parse(JSON.stringify(window.NH_CATALOG.categories));
    cats.forEach(function (c, i) { c.n = i + 1; c.status = 'active'; c.subs.forEach(function (s) { s.status = 'active'; }); });
    var rainbow = findSubIn(cats, 'rainbow');
    var history = {};
    if (rainbow) history[rainbow.id] = [
      { at: '2 Oct 2026, 11:20 am', by: 'Lakshmi', changes: [['Store', 3200, 3400], ['Website', 2600, 2800]] },
      { at: '14 Sep 2026, 6:05 pm', by: 'Lakshmi', changes: [['MRP', 14999, 16999]] }
    ];
    return { categories: cats, history: history, savedAt: '10:42 am' };
  }
  function findSubIn(cats, key) {
    var all = []; cats.forEach(function (c) { c.subs.forEach(function (s) { all.push(s); }); });
    if (key === 'rainbow') return all.filter(function (s) { return s.name.toLowerCase() === 'rainbow checks sarees'; })[0];
    if (key === 'empty') return cats[0].subs.filter(function (s) { return s.status !== 'inactive' && !s.instock && !s.products; })[0];
    return all.filter(function (s) { return s.id === key; })[0];
  }
  var demo = load();
  function load() { try { var d = JSON.parse(sessionStorage.getItem(DEMO_KEY)); if (d && d.categories) return d; } catch (e) { } return freshDemo(); }
  function save() { try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch (e) { } }

  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function flags() { return NH.flags(); }
  function owner() { return flags().viewAs !== 'staff'; }
  function me() { return owner() ? 'Lakshmi' : 'Ravi'; }
  function call(fn, ms) {
    return wait(ms || 600).then(function () {
      if (flags().offline) { var e = new Error('offline'); e.code = 'offline'; throw e; }
      var r = fn(); save(); return r;
    });
  }
  // Active = not deleted. Deleted items appear nowhere (decision 5.0).
  function cats() { return demo.categories.filter(function (c) { return c.status !== 'inactive'; }); }
  function subsOf(c) { return c.subs.filter(function (s) { return s.status !== 'inactive'; }); }
  function allSubs() { var a = []; cats().forEach(function (c) { subsOf(c).forEach(function (s) { a.push({ s: s, c: c }); }); }); return a; }
  function catBy(id) { var n = +id; return demo.categories.filter(function (c) { return (n ? c.n === n : c.id === id) && c.status !== 'inactive'; })[0]; }
  function subBy(id) { var s = findSubIn(demo.categories, id); if (!s || s.status === 'inactive') return null; var c = demo.categories.filter(function (x) { return x.subs.indexOf(s) >= 0; })[0]; return { s: s, c: c }; }
  function norm(v) { return String(v || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function productsIn(c) { return subsOf(c).reduce(function (t, s) { return t + s.products; }, 0); }

  var api = {
    saveCategory: function (id, f) {
      return call(function () {
        var taken = cats().some(function (c) { return c.id !== id && norm(c.name) === norm(f.name); });
        if (taken) return { error: 'NAME_TAKEN' };
        if (id) { var c = catBy(id); c.name = f.name; c.desc = f.desc; if (f.img) c.img = f.img; return { c: c }; }
        var slug = norm(f.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        var nc = { id: 'n' + Date.now().toString(36), n: demo.categories.length + 1, name: f.name, slug: slug, desc: f.desc, img: f.img || null, subs: [], status: 'active' };
        demo.categories.push(nc); return { c: nc };
      }, 700);
    },
    saveSub: function (catId, id, f) {
      return call(function () {
        var c = catBy(catId);
        var taken = subsOf(c).some(function (s) { return s.id !== id && norm(s.name) === norm(f.name); });
        if (taken) return { error: 'NAME_TAKEN' };
        if (id) {
          var s = subBy(id).s, changes = [];
          [['Store', 'store'], ['Website', 'online'], ['MRP', 'mrp']].forEach(function (k) { if ((s[k[1]] || null) !== (f[k[1]] || null)) changes.push([k[0], s[k[1]], f[k[1]]]); });
          if (changes.length) (demo.history[s.id] = demo.history[s.id] || []).unshift({ at: 'Just now', by: me(), changes: changes });
          s.name = f.name; s.desc = f.desc; s.store = f.store; s.online = f.online; s.mrp = f.mrp; if (f.img) s.img = f.img;
          return { s: s, priceChanged: changes.length > 0 };
        }
        var ns = { id: 'n' + Date.now().toString(36), name: f.name, desc: f.desc, img: f.img || null, web: true, store: f.store, online: f.online, mrp: f.mrp, products: 0, instock: 0, pdfready: 0, pdf: null, status: 'active' };
        c.subs.push(ns); return { s: ns };
      }, 800);
    },
    setWeb: function (id, on) { return call(function () { var s = subBy(id).s; s.web = on; return { s: s }; }); },
    deleteSub: function (id) {
      return call(function () {
        var s = subBy(id).s;
        if (s.instock > 0) return { error: 'HAS_STOCK', count: s.instock };
        s.status = 'inactive'; s.web = false; return { ok: true };   // never erased
      }, 700);
    },
    deleteCat: function (id) {
      return call(function () {
        var c = catBy(id), n = subsOf(c).length;
        if (n) return { error: 'HAS_SUBCATEGORIES', count: n };
        c.status = 'inactive'; return { ok: true };
      }, 700);
    },
    saveOrder: function (catId, ids) {
      return call(function () {
        var list = catId ? catBy(catId).subs : demo.categories;
        list.sort(function (a, b) { var ia = ids.indexOf(a.id), ib = ids.indexOf(b.id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
        return { ok: true };
      }, 600);
    },
    makePdf: function (id) {
      return call(function () {
        var s = subBy(id).s;
        if (!s.pdfready) return { error: 'NOTHING_TO_SHOW' };
        s.pdf = { at: 'Today', n: s.pdfready }; return { pdf: s.pdf };
      }, 1600);
    }
  };

  /* ================= Helpers ================= */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  function rs(v) { return v == null || v === '' ? '—' : '₹' + INR.format(v); }
  // Same as the website (customer-web utils/format.js).
  function off(mrp, price) { var m = Number(mrp), p = Number(price); if (!m || m <= p) return 0; return Math.round(((m - p) / m) * 100); }
  function icon(n, c) { return NH.icon(n, c); }
  function day(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : v; }
  function alertBox(type, title, text, ic, extra) {
    var map = { info: 'info', success: 'check', warning: 'alert', error: 'alertc' };
    return '<div class="alert alert-' + type + '" role="' + (type === 'error' ? 'alert' : 'status') + '">' + icon(ic || map[type]) + '<div>' + (title ? '<strong>' + title + '</strong>' : '') + (text ? '<p>' + text + '</p>' : '') + (extra || '') + '</div></div>';
  }
  function topBar(title, back, right) { return '<div class="scr-top">' + (back ? '<button class="icon-btn" type="button" data-go="' + back + '" aria-label="Back">' + icon('back') + '</button>' : '<span style="width:12px"></span>') + '<h1>' + (title || '') + '</h1>' + (right || '') + '</div>'; }
  function thumb(img, lg) { return '<span class="thumb' + (lg ? ' lg' : '') + '">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : icon('image')) + '</span>'; }
  function skelRows(n) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="skel-row"><div class="skeleton" style="width:52px;height:40px;border-radius:8px"></div><div style="flex:1"><div class="skeleton" style="height:14px;width:55%;margin-bottom:6px"></div><div class="skeleton" style="height:11px;width:35%"></div></div></div>'; return '<div class="list">' + h + '</div>'; }
  function netToast() { return 'You\'re offline. Changes need internet.'; }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function roNote() { return owner() ? '' : '<div class="ro-note">' + icon('lock') + 'Only owners can change the catalogue. You can search, view prices and share PDFs.</div>'; }
  function savedBar() { return flags().offline ? '<div class="saved-bar">' + icon('wifioff') + 'Offline · showing the copy saved today at ' + demo.savedAt + '. Changes need internet.</div>' : ''; }
  function counts(list) {
    return {
      all: list.length,
      hidden: list.filter(function (x) { return !x.s.web; }).length,
      nophoto: list.filter(function (x) { return !x.s.img; }).length,
      empty: list.filter(function (x) { return !x.s.products; }).length
    };
  }
  var FILTERS = [['all', 'All'], ['hidden', 'Hidden'], ['nophoto', 'Needs photo'], ['empty', 'No products']];
  function applyFilter(list, f) {
    if (f === 'hidden') return list.filter(function (x) { return !x.s.web; });
    if (f === 'nophoto') return list.filter(function (x) { return !x.s.img; });
    if (f === 'empty') return list.filter(function (x) { return !x.s.products; });
    return list;
  }
  function chips(cur, cnt) {
    return '<div class="chips-row" role="group" aria-label="Filter">' + FILTERS.map(function (f) { return '<button type="button" class="fchip" data-filter="' + f[0] + '" aria-pressed="' + (cur === f[0]) + '">' + f[1] + ' <span class="n">' + cnt[f[0]] + '</span></button>'; }).join('') + '</div>';
  }
  function badges(s) { return (s.web ? '' : '<span class="badge badge-warning">Hidden</span>') + (s.img ? '' : '<span class="badge">Needs photo</span>'); }
  function subRow(x, showCat) {
    var s = x.s;
    return '<button type="button" class="row srow" data-go="subcategory?id=' + s.id + '">' + thumb(s.img) + '<span class="grow">' + (showCat ? '<span class="res-cat">' + esc(x.c.name) + '</span>' : '') + '<b>' + esc(s.name) + '</b><span>' + plural(s.products, 'product') + (s.instock ? ' · ' + s.instock + ' in stock' : '') + '</span>' + (badges(s) ? '<span class="badges">' + badges(s) + '</span>' : '') + '</span>' +
      '<span class="prices"><b>' + rs(s.store) + '</b><span>Web ' + rs(s.online) + '</span></span></button>';
  }
  function subCell(x) {
    var s = x.s;
    return '<button type="button" class="scell" data-go="subcategory?id=' + s.id + '"><span class="ph">' + (s.img ? '<img src="' + esc(s.img) + '" alt="" loading="lazy">' : icon('image', 'icon-xl')) + (s.web ? '' : '<span class="badge badge-warning">Hidden</span>') + '</span>' +
      '<span class="bd"><b>' + esc(s.name) + '</b><span class="p">' + rs(s.store) + ' <span style="font-weight:500;color:var(--muted)">· Web ' + rs(s.online) + '</span></span><span>' + plural(s.products, 'product') + '</span></span></button>';
  }
  function subList(items, showCat) {
    if (NH.opts.subList === 'b' && !showCat) return '<div class="sgrid">' + items.map(subCell).join('') + '</div>';
    return '<div class="list">' + items.map(function (x) { return subRow(x, showCat); }).join('') + '</div>';
  }
  function emptyCard(ic, title, text, extra) { return '<div class="ph-tile" style="min-height:150px;align-items:center;justify-content:center;text-align:center;gap:.4rem">' + icon(ic, 'icon-xl') + '<b>' + title + '</b><span>' + text + '</span>' + (extra || '') + '</div>'; }

  /* ================= Overlays ================= */
  var overlays, root, viewport, closers = [];
  function addOverlay(html) { var d = document.createElement('div'); d.innerHTML = html; var el = d.firstElementChild; overlays.appendChild(el); return el; }
  function toast(msg, ok) {
    var old = overlays.querySelector('.app-toast'); if (old) old.remove();
    var t = addOverlay('<div class="app-toast' + (ok ? ' ok' : '') + '" role="status">' + icon(ok ? 'check' : 'info') + esc(msg) + '</div>');
    setTimeout(function () { t.remove(); }, 3000);
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
      if (e.target === el) close();
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

  /* Photo: choose (pretend) → crop to the website tile shape */
  var SAMPLE_PHOTO = 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/subcategories/16f342fd-30af-4dce-869d-f03336faf20d.jpg';
  function pickPhoto(onDone) {
    sheet('<h2>Add a photo</h2><p>Customers see it as a landscape tile on the website.</p><div class="photo-src" style="margin-top:.75rem">' +
      '<button type="button" class="btn" data-src="camera">' + icon('camera', 'icon-sm') + 'Take photo</button><button type="button" class="btn" data-src="library">' + icon('image', 'icon-sm') + 'Choose from library</button></div>' +
      '<div class="acts"><button type="button" class="btn btn-ghost btn-block" data-close>Cancel</button></div>', function (el, close) {
      el.querySelectorAll('[data-src]').forEach(function (b) { b.addEventListener('click', function () { close(); cropPhoto(SAMPLE_PHOTO, onDone); }); });
    });
  }
  function cropPhoto(src, onDone) {
    var el = addOverlay('<div class="scr" style="z-index:6;background:var(--bg)">' + topBar('Crop photo', null, '<button type="button" class="btn btn-sm btn-ghost top-act" data-cancel>Cancel</button>') +
      '<div class="scr-body narrow"><p class="scr-lead" style="margin-top:0">Drag the photo so the important part sits inside the frame.</p><div class="crop" data-crop><img src="' + esc(src) + '" alt="Photo to crop" draggable="false"><div class="frame"></div></div>' +
      '<p class="field-hint" style="margin-top:.6rem">Saved small (80 KB or less) with location data removed. Uploads when you press Save.</p></div>' +
      '<div class="scr-foot" style="padding-bottom:104px"><button type="button" class="btn btn-primary btn-block" data-use>' + icon('check') + 'Use photo</button></div></div>');
    function close() { el.remove(); closers = closers.filter(function (c) { return c !== close; }); }
    closers.push(close);
    var img = el.querySelector('[data-crop] img'), y = 0, sy = 0, start = null;
    el.querySelector('[data-crop]').addEventListener('pointerdown', function (e) { start = e.clientY; sy = y; e.currentTarget.setPointerCapture(e.pointerId); });
    el.querySelector('[data-crop]').addEventListener('pointermove', function (e) { if (start == null) return; y = Math.max(-120, Math.min(120, sy + e.clientY - start)); img.style.transform = 'translate(-50%, calc(-50% + ' + y + 'px))'; });
    el.querySelector('[data-crop]').addEventListener('pointerup', function () { start = null; });
    el.querySelector('[data-cancel]').addEventListener('click', close);
    el.querySelector('[data-use]').addEventListener('click', function () { close(); onDone(src); });
  }

  /* ================= Router ================= */
  var current = { name: '', params: {} }, state = 'normal', ui = {}, timers = [];
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), q = h.split('?'), p = {};
    (q[1] || '').split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); p[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
    return { name: q[0] || 'catalogue', params: p };
  }
  function go(route) { if (('#/' + route) === location.hash) render(); else location.hash = '#/' + route; }
  function back() { history.length > 1 ? history.back() : go('catalogue'); }
  function after(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function afterNav(fn, ms) { return setTimeout(fn, ms); }
  var EDIT_ONLY = { catform: 1, subform: 1, reorder: 1 };
  function onRoute() {
    var r = parse();
    if (r.name !== current.name || JSON.stringify(r.params) !== JSON.stringify(current.params)) { ui[r.name] = undefined; state = 'normal'; }
    current = r;
    var want = r.params.as === 'staff' ? 'staff' : (r.params.as === 'owner' ? 'owner' : null);
    if (want && flags().viewAs !== want) NH.setFlag('viewAs', want, true);
    render();
    document.dispatchEvent(new CustomEvent('nh:route', { detail: r }));
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
    return '<div class="shell">' + rail + '<div class="shell-main">' + savedBar() + inner + '</div><nav class="tabbar" aria-label="Main menu">' + tabs + '</nav></div>';
  }

  /* ================= Screens ================= */
  var S = {};

  S.more = function () {
    return {
      html: '<section class="scr"><div class="scr-top" style="padding:0 20px"><h1>More</h1></div><div class="scr-body narrow">' +
        '<div class="list"><div class="profile-card"><span class="avatar lg">' + (owner() ? 'L' : 'R') + '</span><div><b>' + (owner() ? 'Lakshmi Devi' : 'Ravi Kumar') + '</b><span>' + (owner() ? 'Owner · Main owner' : 'Staff') + '</span></div></div></div>' +
        '<div class="list-title">Shop</div><div class="list"><button type="button" class="row" data-go="catalogue"><span class="tile">' + icon('folder') + '</span><span class="grow"><b>Catalogue</b><span>' + plural(cats().length, 'category', 'categories') + ' · ' + allSubs().length + ' subcategories</span></span><span class="badge badge-new">New</span>' + icon('right', 'chev') + '</button>' +
        (owner() ? '<button type="button" class="row" data-m2><span class="tile">' + icon('users') + '</span><span class="grow"><b>Team</b><span>Module 2</span></span>' + icon('right', 'chev') + '</button>' : '') + '</div>' +
        '<div class="list-title">Sign-in and security</div><div class="list"><button type="button" class="row" data-m1><span class="tile">' + icon('key') + '</span><span class="grow"><b>Change PIN</b><span>Module 1</span></span>' + icon('right', 'chev') + '</button></div></div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-m1],[data-m2]').forEach(function (b) { b.addEventListener('click', function () { toast('Built in an earlier module'); }); });
      }
    };
  };

  S.catalogue = function (p) {
    var u = ui.catalogue || (ui.catalogue = { q: p.q || '', filter: 'all' });
    var list = cats(), subs = allSubs(), cnt = counts(subs);
    function body() {
      if (state === 'loading') return skelRows(5);
      if (state === 'error') return alertBox('error', 'Couldn\'t load the catalogue', 'Check your connection and try again.') + '<button type="button" class="btn btn-sm" style="margin-top:.6rem" data-retry>' + icon('refresh', 'icon-sm') + 'Retry</button>';
      if (state === 'empty' || !list.length) return emptyCard('folder', 'No categories yet', owner() ? 'Add your first category to start the catalogue.' : 'The owner hasn\'t added any categories yet.', owner() ? '<button type="button" class="btn btn-sm btn-primary" data-go="catform">' + icon('plus', 'icon-sm') + 'New category</button>' : '');
      var q = norm(u.q);
      if (q) {
        var num = Number(q.replace(/[₹,\s]/g, ''));
        var hits = subs.filter(function (x) { return norm(x.s.name).indexOf(q) >= 0 || (num && (x.s.store === num || x.s.online === num || x.s.mrp === num)); });
        return '<p class="team-summary">' + plural(hits.length, 'subcategory', 'subcategories') + ' match "' + esc(u.q.trim()) + '"</p>' + (hits.length ? subList(hits, true) : emptyCard('search', 'No subcategories match', 'Try part of the name, like "checks", or a price like 2800.'));
      }
      if (u.filter !== 'all') {
        var f = applyFilter(subs, u.filter);
        return f.length ? subList(f, true) : emptyCard('check', 'Nothing here', 'No subcategories in this filter.');
      }
      return '<div class="list">' + list.map(function (c) {
        return '<button type="button" class="row crow" data-go="category?id=' + c.n + '">' + thumb(c.img, true) + '<span class="grow"><b>' + esc(c.name) + '</b><span>' + plural(subsOf(c).length, 'subcategory', 'subcategories') + ' · ' + plural(productsIn(c), 'product') + '</span></span>' + icon('right', 'chev') + '</button>';
      }).join('') + '</div>';
    }
    return {
      html: '<section class="scr">' + topBar('Catalogue', 'more', owner() ? '<button type="button" class="btn btn-sm btn-primary top-act" data-go="catform">' + icon('plus', 'icon-sm') + 'New</button>' : '') +
        '<div class="scr-body narrow">' + roNote() +
        '<div class="search">' + icon('search') + '<input class="input" type="search" id="cat-q" placeholder="Search all subcategories or a price" autocomplete="off" value="' + esc(u.q) + '" aria-label="Search all subcategories"></div>' +
        (u.q ? '' : chips(u.filter, cnt)) +
        '<div id="cat-body">' + body() + '</div>' +
        (owner() && !u.q && u.filter === 'all' && list.length > 1 ? '<button type="button" class="btn btn-sm" style="margin-top:.9rem" data-go="reorder">' + icon('grip', 'icon-sm') + 'Reorder categories</button>' : '') +
        '</div></section>',
      mount: function (el) {
        var q = el.querySelector('#cat-q'), box = el.querySelector('#cat-body');
        q.addEventListener('input', function () { var had = !!u.q; u.q = q.value; if (had !== !!u.q) { render(); var n = viewport.querySelector('#cat-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); } else { box.innerHTML = body(); bindGo(box); } });
        el.querySelectorAll('[data-filter]').forEach(function (b) { b.addEventListener('click', function () { u.filter = b.dataset.filter; render(); }); });
        var r = el.querySelector('[data-retry]'); r && r.addEventListener('click', function () { state = 'normal'; render(); });
      }
    };
  };

  S.category = function (p) {
    var c = catBy(p.id);
    if (!c) return gone('This category isn\'t in the catalogue any more.');
    var u = ui.category || (ui.category = { q: '', filter: 'all' });
    var items = subsOf(c).map(function (s) { return { s: s, c: c }; }), cnt = counts(items);
    function body() {
      if (state === 'loading') return skelRows(5);
      if (state === 'error') return alertBox('error', 'Couldn\'t load the subcategories', 'Check your connection and try again.');
      if (state === 'empty' || !items.length) return emptyCard('tag', 'No subcategories yet', owner() ? 'Add the first one: name, prices and a photo.' : 'Nothing in this category yet.', owner() ? '<button type="button" class="btn btn-sm btn-primary" data-go="subform?cat=' + c.n + '">' + icon('plus', 'icon-sm') + 'New subcategory</button>' : '');
      var q = norm(u.q), f = applyFilter(items, u.filter).filter(function (x) { return !q || norm(x.s.name).indexOf(q) >= 0; });
      return f.length ? subList(f, false) : emptyCard('search', 'No subcategories match', 'Try another word or filter.');
    }
    return {
      html: '<section class="scr">' + topBar(esc(c.name), 'catalogue', owner() ? '<button type="button" class="btn btn-sm top-act" data-go="catform?id=' + c.n + '">' + icon('edit', 'icon-sm') + 'Edit</button>' : '') +
        '<div class="scr-body narrow" style="padding-bottom:110px">' + roNote() +
        '<div class="hero-photo">' + (c.img ? '<img src="' + esc(c.img) + '" alt="">' : icon('image', 'icon-xl')) + '</div>' +
        '<p class="desc clamp">' + esc(c.desc) + '</p>' +
        '<div class="list-title" style="display:flex;align-items:center;justify-content:space-between;margin-right:.25rem">Subcategories · ' + items.length + (owner() ? '<button type="button" class="btn btn-sm btn-primary" style="text-transform:none;letter-spacing:0;font-family:var(--font-body)" data-go="subform?cat=' + c.n + '">' + icon('plus', 'icon-sm') + 'New</button>' : '') + '</div>' +
        (items.length > 6 ? '<div class="search">' + icon('search') + '<input class="input" type="search" id="sub-q" placeholder="Search in ' + esc(c.name.toLowerCase()) + '" autocomplete="off" value="' + esc(u.q) + '" aria-label="Search this category"></div>' : '') +
        (items.length ? chips(u.filter, cnt) : '') +
        '<div id="sub-body">' + body() + '</div>' +
        (owner() ? '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1rem">' + (items.length > 1 ? '<button type="button" class="btn btn-sm" data-go="reorder?cat=' + c.n + '">' + icon('grip', 'icon-sm') + 'Reorder</button>' : '') + '</div>' +
          '<div style="height:1.25rem"></div><button type="button" class="btn btn-danger btn-block" data-delcat>' + icon('trash') + 'Delete category</button>' : '') +
        '</div></section>',
      mount: function (el) {
        var q = el.querySelector('#sub-q'), box = el.querySelector('#sub-body');
        q && q.addEventListener('input', function () { u.q = q.value; box.innerHTML = body(); bindGo(box); });
        el.querySelectorAll('[data-filter]').forEach(function (b) { b.addEventListener('click', function () { u.filter = b.dataset.filter; render(); }); });
        var d = el.querySelector('[data-delcat]'); d && d.addEventListener('click', delCat);
        if (p.demo === 'delete') after(delCat, 300);
        function delCat() {
          var n = subsOf(c).length;
          if (n) return dialog({ tone: 'warning', icon: 'alert', title: 'Can\'t delete yet', text: esc(c.name) + ' still has ' + plural(n, 'subcategory', 'subcategories') + '. Delete them first, then the category.', actions: [{ label: 'OK', kind: 'btn-primary' }] });
          dialog({ tone: 'danger', icon: 'trash', title: 'Delete ' + esc(c.name) + '?', text: 'It disappears from the app and the website. It isn\'t erased: old bills and history keep its name.',
            actions: [{ label: 'Delete', kind: 'btn-danger-solid', keep: true, fn: function (b, close) { b.classList.add('is-loading'); api.deleteCat(c.n).then(function (r) { close(); if (r.error) return toast('Delete its subcategories first'); go('catalogue'); afterNav(function () { toast(c.name + ' deleted', true); }, 300); }, function () { close(); toast(netToast()); }); } }, { label: 'Cancel' }] });
        }
      }
    };
  };

  function gone(text) { return { html: '<section class="scr">' + topBar('', 'catalogue') + '<div class="scr-body narrow">' + alertBox('info', 'Not in the catalogue', text) + '</div></section>' }; }

  S.subcategory = function (p) {
    var x = subBy(p.id);
    if (!x) return gone('This subcategory was deleted. Old bills still show its name.');
    var s = x.s, c = x.c, hist = demo.history[s.id] || [], pc = off(s.mrp, s.online);
    if (state === 'loading') return { html: '<section class="scr">' + topBar('', 'category?id=' + c.n) + '<div class="scr-body narrow"><div class="skeleton" style="aspect-ratio:16/9;border-radius:var(--r-lg)"></div><div style="height:1rem"></div>' + skelRows(3) + '</div></section>' };
    if (state === 'error') return { html: '<section class="scr">' + topBar('', 'category?id=' + c.n) + '<div class="scr-body narrow">' + alertBox('error', 'Couldn\'t load this subcategory', 'Check your connection and try again.') + '</div></section>' };
    return {
      html: '<section class="scr">' + topBar(esc(s.name), 'category?id=' + c.n, owner() ? '<button type="button" class="btn btn-sm top-act" data-go="subform?id=' + s.id + '">' + icon('edit', 'icon-sm') + 'Edit</button>' : '') +
        '<div class="scr-body narrow" style="padding-bottom:110px">' + roNote() +
        '<div class="hero-photo">' + (s.img ? '<img src="' + esc(s.img) + '" alt="">' : icon('image', 'icon-xl')) + (s.web ? '' : '<span class="badge badge-warning">Hidden from website</span>') + '</div>' +
        '<span class="res-cat">' + esc(c.name) + '</span><h2 class="scr-title" style="font-size:var(--fs-22);margin:.15rem 0 0">' + esc(s.name) + '</h2>' +
        '<p class="desc">' + esc(s.desc) + '</p>' +
        '<div class="list-title">Prices</div><div class="price-grid"><div><small>Store</small><b>' + rs(s.store) + '</b></div><div><small>Website</small><b>' + rs(s.online) + '</b></div><div><small>MRP</small>' + (s.mrp ? '<b class="strike">' + rs(s.mrp) + '</b>' + (pc ? '<span class="off">' + pc + '% off</span>' : '') : '<b style="color:var(--muted)">—</b>') + '</div></div>' +
        '<div class="web-preview">On the website: <span class="p">' + rs(s.online) + '</span>' + (pc ? '<span class="m">' + rs(s.mrp) + '</span><span class="o">' + pc + '% off</span>' : '') + '</div>' +
        '<div class="list-title">Website</div><div class="list">' +
        (owner() ? '<label class="row" style="cursor:pointer"><span class="tile">' + icon('eye2') + '</span><span class="grow"><b>Show on website</b><span>' + (s.web ? 'Customers can see it and its products' : 'Hidden: customers can\'t see it or its products') + '</span></span><span class="switch"><input type="checkbox" data-web ' + (s.web ? 'checked' : '') + ' aria-label="Show on website"><span></span></span></label>'
          : '<div class="row"><span class="tile">' + icon('eye2') + '</span><span class="grow"><b>' + (s.web ? 'Shown on the website' : 'Hidden from the website') + '</b></span></div>') +
        '<button type="button" class="row" data-products><span class="tile">' + icon('box') + '</span><span class="grow"><b>' + plural(s.products, 'product') + '</b><span>' + s.instock + ' in stock · opens in Products (Module 4)</span></span>' + icon('right', 'chev') + '</button></div>' +
        '<div class="list-title">Catalogue PDF</div><div class="list"><button type="button" class="pdf-card row" data-go="pdf?id=' + s.id + '" style="border:0"><span class="doc">' + icon('pdf') + '</span><span class="grow"><b>' + (s.pdf ? 'Made ' + esc(day(s.pdf.at)) + ' · ' + plural(s.pdf.n, 'saree') : 'No PDF yet') + '</b><span>' + (s.pdfready ? plural(s.pdfready, 'saree') + ' in stock with a photo' : 'No sarees in stock with a photo') + '</span></span>' + icon('right', 'chev') + '</button></div>' +
        '<div class="list-title">Price history</div>' + (hist.length ? '<div class="list hist">' + hist.slice(0, 5).map(function (h) {
          return '<div class="row"><span class="tile">' + icon('history') + '</span><span class="grow"><b class="chg">' + h.changes.map(function (ch) { return ch[0] + ' ' + rs(ch[1]) + ' → ' + rs(ch[2]); }).join(' · ') + '</b><span>' + esc(h.at) + ' · ' + esc(h.by) + '</span></span></div>';
        }).join('') + '</div><p class="field-hint" style="margin:.4rem 0 0 .25rem">Sample entries; the real app reads them from the activity trail, including changes made in the old app.</p>' : '<p class="field-hint" style="margin-left:.25rem">No price changes recorded yet.</p>') +
        (owner() ? '<div style="height:1.5rem"></div><button type="button" class="btn btn-danger btn-block" data-del>' + icon('trash') + 'Delete subcategory</button>' : '') +
        '</div></section>',
      mount: function (el) {
        var w = el.querySelector('[data-web]');
        w && w.addEventListener('change', function () { var on = w.checked; w.checked = !on; webDialog(on); });
        el.querySelector('[data-products]').addEventListener('click', function () { toast('Products are Module 4'); });
        var d = el.querySelector('[data-del]'); d && d.addEventListener('click', delSub);
        if (p.demo === 'hide') after(function () { webDialog(!s.web); }, 300);
        if (p.demo === 'delete' || state === 'popup') after(delSub, 300);
        function webDialog(on) {
          dialog({ tone: on ? 'info' : 'warning', icon: 'eye2', title: on ? 'Show on the website?' : 'Hide from the website?',
            text: on ? esc(s.name) + ' and its ' + plural(s.products, 'product') + ' appear on the website again straight away.' : esc(s.name) + ' and its ' + plural(s.products, 'product') + ' disappear from the website straight away. You still see them in the app, and can show them again any time.',
            actions: [{ label: on ? 'Show on website' : 'Hide from website', kind: 'btn-primary', keep: true, fn: function (b, close) { b.classList.add('is-loading'); api.setWeb(s.id, on).then(function () { close(); render(); toast(on ? 'Shown on the website' : 'Hidden from the website', true); }, function () { close(); toast(netToast()); }); } }, { label: 'Cancel' }] });
        }
        function delSub() {
          if (s.instock > 0) return dialog({ tone: 'warning', icon: 'alert', title: 'Can\'t delete yet', text: plural(s.instock, 'saree is', 'sarees are') + ' from ' + esc(s.name) + ' still in stock. Sell or move them first. You can hide it from the website instead.',
            actions: (s.web ? [{ label: 'Hide from website instead', kind: 'btn-primary', fn: function () { webDialog(false); } }] : []).concat([{ label: 'OK', kind: s.web ? '' : 'btn-primary' }]) });
          dialog({ tone: 'danger', icon: 'trash', title: 'Delete ' + esc(s.name) + '?', text: 'It disappears from the app and the website. It isn\'t erased: old bills and history keep its name, and you can use the name again later.',
            actions: [{ label: 'Delete', kind: 'btn-danger-solid', keep: true, fn: function (b, close) { b.classList.add('is-loading'); api.deleteSub(s.id).then(function (r) { close(); if (r.error) return toast(r.count + ' still in stock'); go('category?id=' + c.n); afterNav(function () { toast(s.name + ' deleted', true); }, 300); }, function () { close(); toast(netToast()); }); } }, { label: 'Cancel' }] });
        }
      }
    };
  };

  S.catform = function (p) {
    var c = p.id ? catBy(p.id) : null;
    if (p.id && !c) return gone('This category isn\'t in the catalogue any more.');
    var u = ui.catform || (ui.catform = { name: c ? c.name : '', desc: c ? c.desc : '', img: c ? c.img : null, staged: null, errs: {} });
    if (state === 'error' && !u.errs.name) u.errs = { name: 'Enter a name of at least 2 letters.', desc: 'Add a short description: the website shows it.' };
    var e = u.errs, img = u.staged || u.img;
    return {
      html: '<section class="scr">' + topBar(c ? 'Edit category' : 'New category', c ? 'category?id=' + c.n : 'catalogue') + '<div class="scr-body narrow">' +
        (u.net ? alertBox('warning', 'You\'re offline', 'Saving needs internet. Nothing was changed.', 'wifioff') + '<div style="height:.75rem"></div>' : '') +
        field('cf-name', 'Name', '<input class="input" id="cf-name" maxlength="100" autocapitalize="words" placeholder="e.g. Handloom Silk Sarees" value="' + esc(u.name) + '">', e.name, c ? 'Web address stays /category/' + esc(c.slug) + ' even if you rename it.' : '') +
        field('cf-desc', 'Description', '<textarea class="input" id="cf-desc" rows="4" maxlength="2000" placeholder="What customers should know about this category">' + esc(u.desc) + '</textarea>', e.desc, 'The website shows this.') +
        photoField(img, !!u.staged) +
        '</div><div class="scr-foot" style="padding-bottom:104px"><button type="button" class="btn btn-primary btn-block' + (state === 'loading' ? ' is-loading' : '') + '" data-save>' + (c ? 'Save' : 'Add category') + '</button></div></section>',
      mount: function (el) {
        bindInput(el, '#cf-name', u, 'name'); bindInput(el, '#cf-desc', u, 'desc');
        bindPhoto(el, u);
        el.querySelector('[data-save]').addEventListener('click', function (ev) {
          var n = u.name.trim().replace(/\s+/g, ' '), d = u.desc.trim();
          u.errs = { name: n.length < 2 ? 'Enter a name of at least 2 letters.' : n.length > 100 ? 'Keep it under 100 characters.' : null, desc: !d ? 'Add a short description: the website shows it.' : null };
          u.net = false;
          if (u.errs.name || u.errs.desc) return render();
          ev.currentTarget.classList.add('is-loading');
          api.saveCategory(c ? c.n : null, { name: n, desc: d, img: u.staged }).then(function (r) {
            if (r.error === 'NAME_TAKEN') { u.errs = { name: 'There\'s already a category called "' + n + '".' }; return render(); }
            ui.catform = undefined; go('category?id=' + r.c.n);
            afterNav(function () { toast(c ? 'Saved' : n + ' added', true); }, 300);
          }, function () { u.net = true; render(); });
        });
      }
    };
  };

  function field(id, label, control, err, hint) {
    return '<div class="field' + (err ? ' has-error' : '') + '"><label for="' + id + '">' + label + '</label>' + control + (err ? '<p class="field-error">' + icon('alertc', 'icon-sm') + esc(err) + '</p>' : hint ? '<p class="field-hint">' + hint + '</p>' : '') + '</div>';
  }
  function photoField(img, staged) {
    return '<div class="field"><span class="field-label">Photo</span><div class="list"><div class="row">' + thumb(img, true) + '<span class="grow"><b>' + (img ? (staged ? 'New photo ready' : 'Current photo') : 'No photo yet') + '</b><span>' + (staged ? 'Uploads when you press Save' : img ? 'Customers see it as a landscape tile' : 'The website shows an empty box without one') + '</span></span><button type="button" class="btn btn-sm" data-photo>' + icon('camera', 'icon-sm') + (img ? 'Change' : 'Add') + '</button></div></div></div>';
  }
  function bindInput(el, sel, u, key) { var i = el.querySelector(sel); i && i.addEventListener('input', function () { u[key] = i.value; }); }
  function bindPhoto(el, u) { var b = el.querySelector('[data-photo]'); b && b.addEventListener('click', function () { pickPhoto(function (src) { u.staged = src; render(); toast('Photo ready. It uploads when you press Save.'); }); }); }

  function moneyField(id, label, val, err, hint) {
    return field(id, label, '<div class="money"><span>₹</span><input class="input" id="' + id + '" inputmode="decimal" autocomplete="off" placeholder="0" value="' + (val == null ? '' : esc(val)) + '"></div>', err, hint);
  }
  function parseMoney(v) { v = String(v == null ? '' : v).replace(/[₹,\s]/g, ''); if (v === '') return null; var n = Number(v); return isFinite(n) ? Math.round(n * 100) / 100 : NaN; }

  // Warnings for one price change (plan 5.4): more than doubles, drops by more than half, or under ₹100.
  function priceWarnings(oldV, newV) {
    if (newV == null || oldV == null || oldV === newV) return null;
    if (newV > oldV * 2) return 'More than double the old price (' + (Math.round(newV / oldV * 10) / 10) + '×). Is this a typo?';
    if (newV < oldV / 2) return 'Less than half the old price. Is this a typo?';
    if (newV < 100) return 'Under ₹100.';
    return null;
  }

  S.subform = function (p) {
    var x = p.id ? subBy(p.id) : null;
    var c = x ? x.c : catBy(p.cat);
    if (!c || (p.id && !x)) return gone('This subcategory isn\'t in the catalogue any more.');
    var s = x ? x.s : null;
    var u = ui.subform || (ui.subform = { name: s ? s.name : '', desc: s ? s.desc : '', store: s ? s.store : null, online: s ? s.online : null, mrp: s ? s.mrp : null, img: s ? s.img : null, staged: null, errs: {} });
    if (p.demo === 'price' && !u.demoDone) { u.store = 54310; }
    var e = u.errs, img = u.staged || u.img, pc = off(u.mrp, u.online);
    return {
      html: '<section class="scr">' + topBar(s ? 'Edit subcategory' : 'New subcategory', s ? 'subcategory?id=' + s.id : 'category?id=' + c.n) + '<div class="scr-body narrow">' +
        '<p class="field-hint" style="margin:-.25rem 0 .9rem">In ' + esc(c.name) + '</p>' +
        (u.net ? alertBox('warning', 'You\'re offline', 'Saving needs internet. Nothing was changed.', 'wifioff') + '<div style="height:.75rem"></div>' : '') +
        field('sf-name', 'Name', '<input class="input" id="sf-name" maxlength="150" placeholder="e.g. 300k Ikkath Border Checks" value="' + esc(u.name) + '">', e.name) +
        field('sf-desc', 'Description', '<textarea class="input" id="sf-desc" rows="4" maxlength="2000" placeholder="Material, border, pallu, blouse…">' + esc(u.desc) + '</textarea>', e.desc, 'The website shows this.') +
        '<div class="price-fields">' + moneyField('sf-store', 'Store price', u.store, e.store) + moneyField('sf-online', 'Website price', u.online, e.online) +
        moneyField('sf-mrp', 'MRP (optional)', u.mrp, e.mrp, 'The struck-through price on the website.') + '</div>' +
        '<div class="web-preview" id="sf-preview" style="margin:-.25rem 0 1rem">' + preview(u) + '</div>' +
        photoField(img, !!u.staged) +
        '</div><div class="scr-foot" style="padding-bottom:104px"><button type="button" class="btn btn-primary btn-block' + (state === 'loading' ? ' is-loading' : '') + '" data-save>' + (s ? 'Save' : 'Add subcategory') + '</button></div></section>',
      mount: function (el) {
        bindInput(el, '#sf-name', u, 'name'); bindInput(el, '#sf-desc', u, 'desc');
        ['store', 'online', 'mrp'].forEach(function (k) {
          var i = el.querySelector('#sf-' + k);
          i.addEventListener('input', function () { u[k] = parseMoney(i.value); el.querySelector('#sf-preview').innerHTML = preview(u); });
        });
        bindPhoto(el, u);
        var saveBtn = el.querySelector('[data-save]');
        saveBtn.addEventListener('click', submit);
        if (p.demo === 'price' && !u.demoDone) { u.demoDone = true; after(submit, 350); }
        if (p.demo === 'photo' && !u.demoDone) { u.demoDone = true; after(function () { pickPhoto(function (src) { u.staged = src; render(); toast('Photo ready. It uploads when you press Save.'); }); }, 350); }
        function submit() {
          var n = u.name.trim().replace(/\s+/g, ' '), d = u.desc.trim(), er = {};
          if (n.length < 2) er.name = 'Enter a name of at least 2 letters.'; else if (n.length > 150) er.name = 'Keep it under 150 characters.';
          if (!d) er.desc = 'Add a short description: the website shows it.';
          [['store', 'Store price'], ['online', 'Website price']].forEach(function (k) {
            var v = u[k[0]];
            if (v == null) er[k[0]] = 'Enter the ' + k[1].toLowerCase() + '.'; else if (isNaN(v) || v <= 0) er[k[0]] = 'Must be more than ₹0.'; else if (v > MAX_PRICE) er[k[0]] = 'At most ₹10,00,000.';
          });
          if (u.mrp != null) { if (isNaN(u.mrp) || u.mrp <= 0) er.mrp = 'Must be more than ₹0, or leave it empty.'; else if (u.online && u.mrp <= u.online) er.mrp = 'MRP must be higher than the website price (' + rs(u.online) + '), or leave it empty.'; }
          u.errs = er; u.net = false;
          if (Object.keys(er).length) return render();
          var f = { name: n, desc: d, store: u.store, online: u.online, mrp: u.mrp, img: u.staged };
          var changes = s ? [['Store price', s.store, u.store], ['Website price', s.online, u.online], ['MRP', s.mrp, u.mrp]].filter(function (r) { return (r[1] || null) !== (r[2] || null); }) : [];
          if (!changes.length) return doSave(f);
          var anyWarn = false;
          var rows = changes.map(function (r) {
            var w = r[0] === 'MRP' ? null : priceWarnings(r[1], r[2]); if (w) anyWarn = true;
            return '<div class="diff-row' + (w ? ' warn' : '') + '"><small>' + r[0] + '</small><span class="v"><s>' + rs(r[1]) + '</s>' + icon('right', 'icon-sm') + rs(r[2]) + '</span>' + (w ? '<span class="why">' + icon('alert', 'icon-sm') + ' ' + w + '</span>' : '') + '</div>';
          }).join('');
          var npc = off(u.mrp, u.online);
          dialog({ tone: anyWarn ? 'warning' : 'info', icon: anyWarn ? 'alert' : 'tag', title: anyWarn ? 'Check these prices' : 'Change prices?',
            html: '<p>These go live on the website as soon as you save.</p><div class="diff">' + rows + '</div><p style="margin-top:.5rem">Customers will see <b>' + rs(u.online) + '</b>' + (npc ? ', MRP ' + rs(u.mrp) + ' (' + npc + '% off)' : '') + '.</p>',
            // With a warning, the safe choice comes first (and gets the focus).
            actions: anyWarn ? [{ label: 'Go back and fix', kind: 'btn-primary' }, { label: 'Prices are right, save', kind: 'btn-danger', fn: function () { doSave(f); } }]
              : [{ label: 'Save and go live', kind: 'btn-primary', fn: function () { doSave(f); } }, { label: 'Go back and fix' }] });
        }
        function doSave(f) {
          saveBtn.classList.add('is-loading');
          api.saveSub(c.n, s ? s.id : null, f).then(function (r) {
            if (r.error === 'NAME_TAKEN') { u.errs = { name: 'There\'s already a subcategory called "' + f.name + '" in ' + c.name + '.' }; return render(); }
            ui.subform = undefined; go('subcategory?id=' + r.s.id);
            afterNav(function () { toast(s ? (r.priceChanged ? 'Saved · new prices are live on the website' : 'Saved') : f.name + ' added', true); }, 300);
          }, function () { u.net = true; render(); });
        }
      }
    };
  };
  function preview(u) {
    var pc = off(u.mrp, u.online);
    if (!u.online) return '<span style="color:var(--muted)">On the website: enter a website price to preview.</span>';
    return 'On the website: <span class="p">' + rs(u.online) + '</span>' + (pc ? '<span class="m">' + rs(u.mrp) + '</span><span class="o">' + pc + '% off</span>' : '');
  }

  S.reorder = function (p) {
    var c = p.cat ? catBy(p.cat) : null;
    var u = ui.reorder || (ui.reorder = { ids: (c ? subsOf(c) : cats()).map(function (x) { return x.id; }) });
    var byId = {}; (c ? subsOf(c) : cats()).forEach(function (x) { byId[x.id] = x; });
    return {
      html: '<section class="scr">' + topBar(c ? 'Reorder subcategories' : 'Reorder categories', c ? 'category?id=' + c.n : 'catalogue', '<button type="button" class="btn btn-sm btn-ghost top-act" data-cancel>Cancel</button>') +
        '<div class="scr-body narrow"><p class="scr-lead" style="margin-top:0">Drag by the handle, or use ▲ ▼. Customers see this order on the website.</p>' +
        '<div class="list rlist" id="rlist">' + u.ids.map(function (id, i) {
          var it = byId[id];
          return '<div class="row" data-id="' + id + '"><span class="handle" data-handle aria-label="Drag to move ' + esc(it.name) + '">' + icon('grip') + '</span><span class="pos">' + (i + 1) + '</span>' + thumb(it.img) + '<span class="grow"><b>' + esc(it.name) + '</b></span><span class="updown"><button type="button" data-up aria-label="Move up"' + (i ? '' : ' disabled') + '>' + icon('up') + '</button><button type="button" data-down aria-label="Move down"' + (i < u.ids.length - 1 ? '' : ' disabled') + '>' + icon('down') + '</button></span></div>';
        }).join('') + '</div></div>' +
        '<div class="scr-foot" style="padding-bottom:104px"><button type="button" class="btn btn-primary btn-block" data-save>Save order</button></div></section>',
      mount: function (el) {
        var listEl = el.querySelector('#rlist');
        el.querySelector('[data-cancel]').addEventListener('click', function () { ui.reorder = undefined; back(); });
        listEl.querySelectorAll('.row').forEach(function (row, i) {
          var up = row.querySelector('[data-up]'), dn = row.querySelector('[data-down]');
          up.addEventListener('click', function () { move(i, i - 1); });
          dn.addEventListener('click', function () { move(i, i + 1); });
          var h = row.querySelector('[data-handle]');
          h.addEventListener('pointerdown', function (e) {
            e.preventDefault(); h.setPointerCapture(e.pointerId);
            var startY = e.clientY, rowH = row.offsetHeight, from = i, to = i;
            row.classList.add('dragging');
            function mv(ev) { var dy = ev.clientY - startY; row.style.transform = 'translateY(' + dy + 'px)'; to = Math.max(0, Math.min(u.ids.length - 1, from + Math.round(dy / rowH))); }
            function upFn() { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', upFn); h.removeEventListener('pointercancel', upFn); row.classList.remove('dragging'); row.style.transform = ''; if (to !== from) move(from, to); }
            h.addEventListener('pointermove', mv); h.addEventListener('pointerup', upFn); h.addEventListener('pointercancel', upFn);
          });
        });
        function move(a, b) { if (b < 0 || b >= u.ids.length) return; var id = u.ids.splice(a, 1)[0]; u.ids.splice(b, 0, id); render(); }
        el.querySelector('[data-save]').addEventListener('click', function (ev) {
          ev.currentTarget.classList.add('is-loading');
          api.saveOrder(c ? c.n : null, u.ids).then(function () { ui.reorder = undefined; back(); afterNav(function () { toast('New order saved · the website shows it now', true); }, 300); }, function () { toast(netToast()); render(); });
        });
      }
    };
  };

  S.pdf = function (p) {
    var x = subBy(p.id); if (!x) return gone('This subcategory was deleted.');
    var s = x.s, plat = flags().platform, u = ui.pdf || (ui.pdf = { mobile: '' });
    var ready = state === 'empty' ? 0 : s.pdfready;
    var status = state === 'loading' ? '<div class="list">' + skelRows(1) + '</div>' : state === 'error' ? alertBox('error', 'Couldn\'t make the PDF', 'The server didn\'t respond. Nothing was changed; try again.') :
      '<div class="list"><div class="pdf-card"><span class="doc">' + icon('pdf') + '</span><span class="grow" style="flex:1"><b style="display:block">' + (s.pdf ? 'Made ' + esc(day(s.pdf.at)) + ' · ' + plural(s.pdf.n, 'page') : 'No PDF made yet') + '</b><span style="color:var(--muted);font-size:var(--fs-13)">' + esc(s.name) + '</span></span>' + (s.pdf ? '<button type="button" class="btn btn-sm" data-go="pdfpage?id=' + s.id + '">View a page</button>' : '') + '</div></div>';
    return {
      html: '<section class="scr">' + topBar('Catalogue PDF', 'subcategory?id=' + s.id) + '<div class="scr-body narrow">' +
        '<p class="scr-lead" style="margin-top:0">One page per saree that is <b>in stock and has a photo</b>, with its tag ID. No prices or shop name.</p>' +
        (s.web ? '' : alertBox('info', 'Hidden from the website', 'You can still send this PDF to customers.') + '<div style="height:.75rem"></div>') +
        status +
        '<div class="facts" style="margin-top:.9rem"><div>' + icon(ready ? 'check' : 'alert') + (ready ? plural(ready, 'saree') + ' will be included' : 'No sarees are in stock with a photo, so a PDF can\'t be made') + '</div>' +
        (s.products - ready > 0 && ready ? '<div>' + icon('info') + (s.products - ready) + ' other products are left out (sold, or no photo)</div>' : '') + '</div>' +
        '<div style="height:1rem"></div><button type="button" class="btn btn-block' + (s.pdf ? '' : ' btn-primary') + '" data-make' + (ready ? '' : ' disabled') + '>' + icon('refresh', 'icon-sm') + (s.pdf ? 'Make a new PDF' : 'Make PDF') + '</button>' +
        (s.pdf ? '<div class="list-title">Send to a customer</div>' + (plat === 'android'
          ? '<div class="field"><label for="pdf-mobile">Customer\'s WhatsApp number</label><div class="input-group"><span class="prefix">+91</span><input class="input" id="pdf-mobile" type="tel" inputmode="numeric" maxlength="11" placeholder="98765 43210" value="' + esc(u.mobile) + '"></div><p class="field-hint">Not saved anywhere.</p></div><button type="button" class="btn btn-wa btn-block" data-wa>' + icon('whatsapp') + 'Share on WhatsApp</button>'
          : '<button type="button" class="btn btn-wa btn-block" data-share>' + icon('share') + 'Share PDF</button><p class="field-hint" style="margin-top:.5rem">iPhone: choose WhatsApp and the customer in the share menu.</p>') : '') +
        '</div><div style="height:96px"></div></section>',
      mount: function (el) {
        var mk = el.querySelector('[data-make]');
        mk && mk.addEventListener('click', function () {
          mk.classList.add('is-loading');
          api.makePdf(s.id).then(function (r) { if (r.error) { toast('No sarees in stock with a photo'); return render(); } render(); toast('PDF ready · ' + plural(r.pdf.n, 'page'), true); }, function () { render(); toast(netToast()); });
        });
        var mob = el.querySelector('#pdf-mobile');
        mob && mob.addEventListener('input', function () { var d = mob.value.replace(/\D/g, '').slice(0, 10); u.mobile = d; mob.value = d.length > 5 ? d.slice(0, 5) + ' ' + d.slice(5) : d; });
        var wa = el.querySelector('[data-wa]');
        wa && wa.addEventListener('click', function () {
          if (!/^[6-9]\d{9}$/.test(u.mobile)) return toast('Enter the customer\'s 10-digit mobile number');
          go('wapdf?id=' + s.id + '&m=' + u.mobile);
        });
        var sh = el.querySelector('[data-share]');
        sh && sh.addEventListener('click', function () {
          sheet('<h2>Share PDF</h2><p>' + esc(s.name) + ' catalogue · with the caption</p><div class="share-grid">' +
            '<button type="button" data-app="wa"><span class="app-ico" style="background:#25D366">' + icon('whatsapp') + '</span>WhatsApp</button><button type="button" data-app="x"><span class="app-ico" style="background:#34C759">' + icon('message') + '</span>Messages</button>' +
            '<button type="button" data-app="x"><span class="app-ico" style="background:#1A73E8">' + icon('mail') + '</span>Mail</button><button type="button" data-app="x"><span class="app-ico" style="background:#6B7280">' + icon('folder') + '</span>Files</button></div>' +
            '<div class="acts"><button type="button" class="btn btn-block" data-close>Cancel</button></div>', function (sel, close) {
            sel.querySelectorAll('[data-app]').forEach(function (b) { b.addEventListener('click', function () { close(); if (b.dataset.app === 'wa') go('wapdf?id=' + s.id); else toast('Opens with the PDF and caption (pretend)', true); }); });
          });
        });
      }
    };
  };

  S.pdfpage = function (p) {
    var x = subBy(p.id); if (!x) return gone('This subcategory was deleted.');
    var s = x.s;
    return {
      html: '<section class="scr">' + topBar('PDF page', 'pdf?id=' + s.id) + '<div class="scr-body narrow"><p class="scr-lead" style="margin-top:0">Page 1 of ' + (s.pdf ? s.pdf.n : s.pdfready) + ' · the same design as today\'s PDFs. Sample photo and tag numbers.</p>' +
        '<div class="a4"><div class="card"><h3>' + esc(s.name) + '</h3><div class="div">◆</div><div class="id">ID: 3136, 3137</div><div class="img">' + (s.img ? '<img src="' + esc(s.img) + '" alt="Sample saree photo">' : icon('image', 'icon-xl')) + '</div></div></div></div></section>'
    };
  };

  S.wapdf = function (p) {
    var x = subBy(p.id); if (!x) return gone('This subcategory was deleted.');
    var s = x.s, m = p.m || '', u = ui.wapdf || (ui.wapdf = { sent: false });
    var caption = 'Nandam Handlooms – ' + s.name + ' catalogue. Please tell us the ID number of the piece you like.';
    var doc = '<div style="display:flex;gap:.6rem;align-items:center;background:rgba(0,0,0,.06);border-radius:6px;padding:.5rem .6rem;margin-bottom:.4rem"><span class="doc" style="width:30px;height:38px;border-radius:4px;background:#fff;border:2px solid #C9A227;color:#7A1F2B;display:flex;align-items:center;justify-content:center">' + icon('pdf', 'icon-sm') + '</span><span><b style="display:block;font-size:13px">Nandam-' + esc(s.name.replace(/\s+/g, '-')) + '-catalogue.pdf</b><small style="font-size:11px;opacity:.7">' + (s.pdf ? s.pdf.n : s.pdfready) + ' pages · PDF</small></span></div>';
    return {
      html: '<section class="wa" aria-label="WhatsApp (picture of another app)"><div class="wa-top"><button type="button" data-back aria-label="Back to Nandam Admin">' + icon('back') + '</button><span class="wa-av">C</span><div style="flex:1;min-width:0"><b>' + (m ? '+91 ' + m.slice(0, 5) + ' ' + m.slice(5) : 'Customer') + '</b><small>WhatsApp · picture for the mock-up</small></div></div>' +
        '<div class="wa-chat"><div class="wa-note">This is a picture of WhatsApp, not part of our app.</div>' +
        (u.sent ? '<div class="wa-bubble">' + doc + esc(caption) + '<small>' + new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) + ' ✓✓</small></div><button type="button" class="btn btn-sm wa-back" data-back>' + icon('back', 'icon-sm') + 'Back to Nandam Admin</button>' : '') + '</div>' +
        (u.sent ? '' : '<div class="wa-compose"><div class="wa-input">' + doc + esc(caption) + '</div><button type="button" class="wa-send" data-send aria-label="Send">' + icon('send') + '</button></div>') + '</section>',
      mount: function (el) {
        el.querySelectorAll('[data-back]').forEach(function (b) { b.addEventListener('click', function () { ui.wapdf = undefined; back(); }); });
        var sd = el.querySelector('[data-send]'); sd && sd.addEventListener('click', function () { u.sent = true; render(); });
      }
    };
  };

  /* ================= Render ================= */
  function bindGo(scope) { scope.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.go); }); }); }
  function render() {
    timers.forEach(function (t) { clearTimeout(t); }); timers = [];
    closers = [];
    Array.prototype.slice.call(overlays.children).forEach(function (c) { if (!c.classList.contains('app-toast')) c.remove(); });
    var name = current.name, fn = S[name] || S.catalogue;
    if (EDIT_ONLY[name] && !owner()) fn = function () { return { html: '<section class="scr">' + topBar('', 'catalogue') + '<div class="scr-body narrow center-col"><div class="msg-icon">' + icon('lock') + '</div><h2 class="scr-title">Only owners can change the catalogue</h2><p class="scr-lead">You can search, view prices and share PDFs.</p></div></section>' }; };
    var scr = fn(current.params || {});
    var full = name === 'wapdf';
    viewport.innerHTML = full ? scr.html : shell(scr.html);
    var el = viewport.querySelector('.scr, .wa') || viewport.firstElementChild;
    bindGo(viewport);
    viewport.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.tab === 'more') go('more'); else toast('This tab is a later module'); }); });
    scr.mount && scr.mount(el);
    var spec = window.NH_SCREENS.filter(function (s) { return NH_ROUTE(s).split('?')[0] === name; });
    if (state !== 'normal' && spec.length && !spec.some(function (s) { return s.states.indexOf(state) >= 0; })) NH.toast('"' + state + '" isn\'t a state of this screen. Try: ' + (spec[0].states.join(', ') || 'none'));
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && closers.length) { closers[closers.length - 1](); e.stopPropagation(); } });

  window.NHApp = {
    setState: function (s) { state = s; if (s === 'normal') ui[current.name] = undefined; render(); },
    go: go,
    action: function (name) { if (name === 'reset') { demo = freshDemo(); save(); ui = {}; go('catalogue'); } }
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
