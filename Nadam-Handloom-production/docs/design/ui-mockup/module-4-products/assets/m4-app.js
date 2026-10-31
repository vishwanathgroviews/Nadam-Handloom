/* Module 4 (Products and barcodes): the clickable app.
   Uses real listings (copy of 11 Oct 2026) and a small pretend backend that applies
   the agreed rules: one saree = one tag, "already used" alerts the moment a tag is
   scanned, change a wrong tag (its number is freed), replace a damaged tag (its
   number is retired), delete = inactive (unsold tag freed), name and price always
   from the subcategory, and the 5,000 limit counts only sarees in stock. */
(function () {
  'use strict';
  var NH = window.NH;
  var EMBED = /[?&]embed=1/.test(location.search);
  var DEMO_KEY = 'nh-m4-demo';
  var MAX_BATCH = 50, MAX_PHOTOS = 5;
  var RAINBOW = '34f68ec3';
  var SKU_HIGH = { MHPS: 1416, HPS: 358, HPDM: 99, F: 2 };   // highest SKU number issued per prefix (live copy)

  /* ================= Catalogue (Module 3 data) ================= */
  var SUBS = {}, SUB_LIST = [];
  window.NH_CATALOG.categories.forEach(function (c) { c.subs.forEach(function (s) { SUBS[s.id] = { s: s, c: c }; SUB_LIST.push({ s: s, c: c }); }); });
  function sub(id) { return SUBS[id === 'rainbow' ? RAINBOW : id] || null; }
  function subId(id) { return id === 'rainbow' ? RAINBOW : id; }
  function catCode(c) { return c.slug.split('-').filter(Boolean).map(function (w) { return w[0].toUpperCase(); }).join(''); }

  /* ================= Pretend backend ================= */
  function freshDemo() {
    var products = window.NH_PRODUCTS.map(function (p) {
      return {
        id: p.id, sku: p.sku, old: p.old, sub: p.sub, imgs: p.img ? [p.img] : [], ch: p.ch, feat: p.feat, at: p.at, by: p.by, status: 'active', details: {},
        tags: p.tags.map(function (t) { return { code: t[0], st: t[1], soldAt: t[2] || null }; }),
        log: [{ at: dayText(p.at), by: p.by, text: 'Added with tag ' + p.tags.map(function (t) { return t[0]; }).join(', ') }]
      };
    });
    // Sample: a customer is paying for this one on the website right now.
    var held = products.filter(function (x) { return x.id === '67d2f4e6'; })[0];
    if (held) { held.tags[0].st = 'reserved'; held.holdUntil = '4:15 pm'; held.order = 'NH-WEB-1042'; }
    var d = { products: products, freeIdx: 0, skuHigh: JSON.parse(JSON.stringify(SKU_HIGH)), recent: [RAINBOW, 'b6b360c9', 'd93b3115'], ch: 'both', batch: null, queue: null, savedAt: '10:42 am' };
    d.baseStock = sampleStock(products);
    return d;
  }
  var demo = load();
  function load() { try { var d = JSON.parse(sessionStorage.getItem(DEMO_KEY)); if (d && d.products) return d; } catch (e) { } return freshDemo(); }
  function save() { try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch (e) { } }

  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function flags() { return NH.flags(); }
  function offline() { return !!flags().offline; }
  function owner() { return flags().viewAs !== 'staff'; }
  function me() { return owner() ? 'Lakshmi' : 'Ravi'; }
  function call(fn, ms) {
    return wait(ms || 500).then(function () {
      if (offline()) { var e = new Error('offline'); e.code = 'offline'; throw e; }
      var r = fn(); save(); return r;
    });
  }

  // Newest first: just added, then by date added, then by SKU number.
  function skuNo(p) { return +(p.sku.split('-').pop()) || 0; }
  function active() { return demo.products.filter(function (p) { return p.status === 'active'; }).sort(function (a, b) { return (b.fresh ? 1 : 0) - (a.fresh ? 1 : 0) || (a.at < b.at ? 1 : a.at > b.at ? -1 : 0) || skuNo(b) - skuNo(a); }); }
  function prod(id) { return demo.products.filter(function (p) { return p.id === id; })[0] || null; }
  function shownTags(p) { return p.tags.filter(function (t) { return t.st !== 'removed' && !t.freed; }); }
  function inStock(p) { return p.status === 'active' && p.tags.some(function (t) { return t.st === 'in_stock'; }); }
  function sampleStock(list) { return list.filter(inStock).length; }
  function shopStock() { return window.NH_TOTALS.inStock + (sampleStock(demo.products) - demo.baseStock); }
  function shopListings() { return window.NH_TOTALS.listings + (active().length - window.NH_PRODUCTS.length); }
  function pname(p) { var x = sub(p.sub); return x ? x.s.name : p.old; }   // decision 6.2

  // Tags: spaces removed, capitals; digits only means an NH tag (3302 → NH3302).
  function normTag(v) { var s = String(v || '').toUpperCase().replace(/\s+/g, ''); if (/^\d{1,6}$/.test(s)) s = 'NH' + s; return s; }
  function validTag(s) { return s.length >= 3 && s.length <= 64 && /^[A-Z0-9-]+$/.test(s); }
  function tagNum(code) { return code.replace(/^[A-Z]+/, ''); }
  function findTag(code) {
    for (var i = 0; i < demo.products.length; i++) {
      var p = demo.products[i];
      for (var j = 0; j < p.tags.length; j++) { var t = p.tags[j]; if (t.code === code && !t.freed && t.st !== 'removed') return { p: p, t: t }; }
    }
    return null;
  }
  function inQueue(code) { return demo.queue && !demo.queue.done && demo.queue.items.some(function (q) { return q.tag === code && q.st !== 'saved' && q.st !== 'fail'; }); }
  // What the server would say about a tag. Offline: only this batch can be checked.
  function checkTag(code, skipBatchIdx, ignoreTag) {
    if (!validTag(code)) return { kind: 'invalid' };
    var b = demo.batch;
    if (b && skipBatchIdx !== undefined) {
      for (var i = 0; i < b.items.length; i++) if (i !== skipBatchIdx && b.items[i].tag === code) return { kind: 'batch', idx: i };
    }
    if (offline()) return { ok: true, unchecked: true };
    if (inQueue(code)) return { kind: 'queue' };
    var f = findTag(code);
    if (f && f.t !== ignoreTag) {
      if (f.t.st === 'retired') return { kind: 'retired', p: f.p, t: f.t };
      if (f.t.st === 'sold_offline' || f.t.st === 'sold_online') return { kind: 'sold', p: f.p, t: f.t };
      return { kind: 'other', p: f.p, t: f.t };
    }
    return { ok: true };
  }
  function nextFree() {
    while (demo.freeIdx < window.NH_FREE_TAGS.length) {
      var c = 'NH' + window.NH_FREE_TAGS[demo.freeIdx++];
      var b = demo.batch, inB = b && b.items.some(function (x) { return x.tag === c; });
      if (!findTag(c) && !inB && !inQueue(c)) { save(); return c; }
    }
    return 'NH9' + Math.floor(Math.random() * 90000 + 10000);
  }
  function nextSku(x) {
    var code = catCode(x.c);
    demo.skuHigh[code] = (demo.skuHigh[code] || 0) + 1;
    var n = String(demo.skuHigh[code]); while (n.length < 3) n = '0' + n;
    return 'NH-' + code + '-' + n;
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addLog(p, text) { p.log.unshift({ at: 'Just now', by: me(), text: text }); }

  var api = {
    changeTag: function (p, t, code) { return call(function () { var old = t.code; t.code = code; addLog(p, 'Tag changed ' + old + ' → ' + code + ' (wrong tag)'); return { old: old }; }); },
    replaceTag: function (p, t, code) {
      return call(function () {
        var old = t.code; t.st = 'retired'; t.retiredAt = 'Today';
        p.tags.push({ code: code, st: 'in_stock', soldAt: null });
        addLog(p, 'Tag ' + old + ' damaged → replaced with ' + code + '. ' + old + ' retired.'); return { old: old };
      });
    },
    removeTag: function (p, t) { return call(function () { t.st = 'removed'; addLog(p, 'Tag ' + t.code + ' removed (extra tag)'); }); },
    damaged: function (p, t, on) { return call(function () { t.st = on ? 'damaged' : 'in_stock'; addLog(p, on ? 'Marked damaged, not for sale (' + t.code + ')' : 'Back in stock (' + t.code + ')'); }); },
    setCh: function (p, ch) { return call(function () { p.ch = ch; addLog(p, 'Where it sells: ' + CH[ch]); }); },
    setFeat: function (p, on) { return call(function () { p.feat = on; addLog(p, on ? 'Marked Best Seller' : 'Best Seller removed'); }); },
    move: function (p, to) { return call(function () { var from = pname(p); p.sub = to; addLog(p, 'Moved from ' + from + ' to ' + pname(p)); }, 700); },
    details: function (p, d) { return call(function () { p.details = d; addLog(p, 'Details updated'); }); },
    photos: function (p, imgs) { return call(function () { p.imgs = imgs; addLog(p, 'Photos updated (' + imgs.length + ')'); }, 700); },
    remove: function (p) {
      return call(function () {
        if (p.tags.some(function (t) { return t.st === 'reserved'; })) return { error: 'HELD_BY_ORDER' };
        p.status = 'inactive';                                             // never erased
        var freed = [];
        p.tags.forEach(function (t) { if (t.st === 'in_stock' || t.st === 'damaged') { t.freed = true; freed.push(t.code); } });
        return { freed: freed };
      }, 700);
    }
  };

  /* Saving queue: each saree saved on its own, in the background. */
  function startQueue(b, items) {
    demo.queue = { sub: b.sub, ch: b.ch, done: false, items: items.map(function (it) { return { img: it.img, tag: it.tag, st: 'wait' }; }) };
    save();
  }
  function commit(q, item) {
    var f = findTag(item.tag);
    if (f || item.forceFail) { item.st = 'fail'; item.why = item.forceFail ? item.tag + ' was put on another saree on another phone a moment ago.' : item.tag + ' is already on ' + pname(f.p) + ' (' + f.p.sku + ').'; item.forceFail = false; return; }
    var x = sub(q.sub);
    var p = { id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1000), sku: nextSku(x), old: x.s.name, sub: q.sub, imgs: [item.img], ch: q.ch, feat: false, at: today(), by: me(), status: 'active', details: {},
      tags: [{ code: item.tag, st: 'in_stock', soldAt: null }], log: [{ at: 'Just now', by: me(), text: 'Added with tag ' + item.tag }], fresh: true };
    demo.products.unshift(p);
    item.st = 'saved'; item.sku = p.sku; item.pid = p.id;
    demo.recent = [q.sub].concat(demo.recent.filter(function (r) { return r !== q.sub; })).slice(0, 4);
  }
  function tick() {
    var q = demo.queue; if (!q || q.done || offline()) return;
    var busy = q.items.filter(function (i) { return i.st === 'busy'; })[0];
    if (busy) commit(q, busy);
    else { var w = q.items.filter(function (i) { return i.st === 'wait'; })[0]; if (w) w.st = 'busy'; }
    if (!q.items.some(function (i) { return i.st === 'wait' || i.st === 'busy'; })) {
      q.done = true; save();
      var ok = q.items.filter(function (i) { return i.st === 'saved'; }).length;
      if (current.name !== 'saving') { var pl = viewport && viewport.querySelector('.queue-pill'); if (pl) pl.remove(); toast(plural(ok, 'saree') + ' added to ' + sub(q.sub).s.name, true); }
      else render();
      return;
    }
    save();
    if (current.name === 'saving') refreshSaving();
    else { var pill = viewport && viewport.querySelector('[data-qtext]'); if (pill) pill.textContent = queueText(); }
  }
  function queueText() {
    var q = demo.queue, n = q.items.length, ok = q.items.filter(function (i) { return i.st === 'saved'; }).length;
    return offline() ? 'Waiting for internet · ' + ok + ' of ' + n + ' saved' : 'Saving ' + ok + ' of ' + n + ' sarees…';
  }

  /* ================= Helpers ================= */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  function rs(v) { return v == null || v === '' ? '—' : '₹' + INR.format(v); }
  function num(v) { return INR.format(v); }
  function off(mrp, price) { var m = Number(mrp), p = Number(price); if (!m || m <= p) return 0; return Math.round(((m - p) / m) * 100); }
  function icon(n, c) { return NH.icon(n, c); }
  function dayText(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? new Date(v + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : (v || ''); }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  function alertBox(type, title, text, ic, extra) {
    var map = { info: 'info', success: 'check', warning: 'alert', error: 'alertc' };
    return '<div class="alert alert-' + type + '" role="' + (type === 'error' ? 'alert' : 'status') + '">' + icon(ic || map[type]) + '<div>' + (title ? '<strong>' + title + '</strong>' : '') + (text ? '<p>' + text + '</p>' : '') + (extra || '') + '</div></div>';
  }
  function topBar(title, back, right) { return '<div class="scr-top">' + (back ? '<button class="icon-btn" type="button" ' + (back === 'history' ? 'data-back' : 'data-go="' + back + '"') + ' aria-label="Back">' + icon('back') + '</button>' : '<span style="width:12px"></span>') + '<h1>' + (title || '') + '</h1>' + (right || '') + '</div>'; }
  function flowTop(title, small, left, right) { return '<div class="flow-top">' + left + '<h1>' + title + (small ? '<small>' + small + '</small>' : '') + '</h1>' + (right || '') + '</div>'; }
  function iconBtn(ic, attr, label) { return '<button class="icon-btn" type="button" ' + attr + ' aria-label="' + label + '">' + icon(ic) + '</button>'; }
  function pthumb(img) { return '<span class="pthumb">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : icon('image')) + '</span>'; }
  function thumb(img) { return '<span class="thumb">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : icon('image')) + '</span>'; }
  function tagchip(code, cls) { return '<span class="tagchip ' + (cls || '') + '">' + icon('barcode') + esc(code) + '</span>'; }
  function skelRows(n) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="skel-row"><div class="skeleton" style="width:42px;height:56px;border-radius:8px"></div><div style="flex:1"><div class="skeleton" style="height:14px;width:55%;margin-bottom:6px"></div><div class="skeleton" style="height:11px;width:35%"></div></div></div>'; return '<div class="list">' + h + '</div>'; }
  function emptyCard(ic, title, text, extra) { return '<div class="ph-tile" style="min-height:150px;align-items:center;justify-content:center;text-align:center;gap:.4rem">' + icon(ic, 'icon-xl') + '<b>' + title + '</b><span>' + text + '</span>' + (extra || '') + '</div>'; }
  function netToast() { return 'You\'re offline. This change needs internet.'; }
  function savedBar() { return offline() ? '<div class="saved-bar">' + icon('wifioff') + 'Offline · showing the copy saved today at ' + demo.savedAt + '. Adding still works: it uploads later.</div>' : ''; }
  var CH = { both: 'Online + store', online_only: 'Online only', store_only: 'Store only' };
  function field(id, label, control, err, hint) {
    return '<div class="field' + (err ? ' has-error' : '') + '"><label for="' + id + '">' + label + '</label>' + control + (err ? '<p class="field-error">' + icon('alertc', 'icon-sm') + esc(err) + '</p>' : hint ? '<p class="field-hint">' + hint + '</p>' : '') + '</div>';
  }
  function viewfinder(hint) { return '<div class="viewfinder" role="img" aria-label="Camera, looking for a tag"><div class="frame">' + icon('barcode') + '<span class="laser"></span></div><span class="hint">' + hint + '</span></div>'; }
  function mockbar(btns, note) {
    return '<div class="mockbar" role="group" aria-label="Pretend scanner (mock-up control)"><div class="lbl"><span>Pretend scan · mock-up control</span>' + (note ? '<span style="text-transform:none;letter-spacing:0;font-weight:600">' + note + '</span>' : '') + '</div><div class="btns">' +
      btns.map(function (b) { return '<button type="button" data-fake="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div></div>';
  }
  function tagState(p, t) {
    switch (t.st) {
      case 'in_stock': return ['In stock', 'badge-success'];
      case 'reserved': return ['Held by an online order' + (p.holdUntil ? ' until ' + p.holdUntil : ''), 'badge-warning'];
      case 'sold_offline': return ['Sold at the counter' + (t.soldAt ? ' · ' + dayText(t.soldAt) : ''), 'badge-info'];
      case 'sold_online': return ['Sold online' + (t.soldAt ? ' · ' + dayText(t.soldAt) : ''), 'badge-info'];
      case 'damaged': return ['Saree damaged · not for sale', 'badge-danger'];
      case 'retired': return ['Retired · damaged tag' + (t.retiredAt ? ' · ' + t.retiredAt : ''), ''];
      default: return [t.st, ''];
    }
  }
  function stockBadge(p) {
    var ts = shownTags(p);
    if (ts.some(function (t) { return t.st === 'in_stock'; })) return '<span class="badge badge-success">In stock</span>';
    if (ts.some(function (t) { return t.st === 'reserved'; })) return '<span class="badge badge-warning">Held</span>';
    if (ts.some(function (t) { return t.st === 'damaged'; })) return '<span class="badge badge-danger">Damaged</span>';
    return '<span class="badge">Sold out</span>';
  }
  function webState(p) {
    var x = sub(p.sub);
    if (p.ch === 'store_only') return [false, 'Not on the website: set to Store only.'];
    if (x && !x.s.web) return [false, 'Not on the website: its subcategory is hidden.'];
    if (!inStock(p)) return [false, 'Not on the website: nothing in stock.'];
    return [true, p.ch === 'online_only' ? 'On the website now. Not sold at the counter (Online only).' : 'On the website and at the counter now.'];
  }

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
    sheet('<h2>' + title + '</h2><p>The number printed on the tag. Typing only digits adds NH (3302 → NH3302).</p>' +
      '<form class="type-box" data-type style="margin-top:.75rem"><input class="input" id="type-tag" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="NH3302" aria-label="Tag number" maxlength="64"><button class="btn btn-primary" type="submit">Use</button></form>' +
      '<p class="field-error" data-err hidden style="margin-top:.4rem"></p><p class="field-hint" style="margin-top:.5rem">' + icon('bluetooth', 'icon-sm') + ' A Bluetooth tag scanner types into this box by itself.</p>' +
      '<div class="acts"><button type="button" class="btn btn-ghost btn-block" data-close>Cancel</button></div>', function (el, close) {
      var f = el.querySelector('[data-type]'), inp = el.querySelector('#type-tag'), err = el.querySelector('[data-err]');
      setTimeout(function () { inp.focus(); }, 60);
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var c = normTag(inp.value);
        if (!validTag(c)) { err.hidden = false; err.textContent = 'Enter the tag number, like NH3302 or 3302.'; return; }
        close(); onCode(c);
      });
    });
  }
  function sareeSheet(p) {
    var t = shownTags(p);
    sheet('<div style="display:flex;gap:.8rem;align-items:flex-start">' + pthumb(p.imgs[0]).replace('pthumb', 'pthumb" style="width:84px;height:112px') + '<div style="min-width:0"><h2>' + esc(pname(p)) + '</h2><p style="margin:0;font-family:var(--font-mono);font-size:13px">' + esc(p.sku) + '</p>' +
      '<p style="margin:.3rem 0 0">' + t.map(function (x) { return tagchip(x.code) + ' <span class="badge ' + tagState(p, x)[1] + '">' + tagState(p, x)[0] + '</span>'; }).join('<br>') + '</p><p class="field-hint" style="margin-top:.35rem">Added ' + esc(dayText(p.at)) + ' by ' + esc(p.by) + '</p></div></div>' +
      '<div class="acts"><button type="button" class="btn btn-primary btn-block" data-close>Back to scanning</button></div>');
  }

  /* Tag problems: shown the moment a tag is scanned or typed (rule T2). */
  function tagProblem(r, code, photo, onRetry, extra) {
    if (r.kind === 'invalid') return toast('That doesn\'t look like a tag. Scan again or type it.');
    if (r.kind === 'queue') return dialog({ tone: 'warning', icon: 'alert', title: code + ' is being saved', text: code + ' is on a saree that is uploading right now. Use a different tag.', actions: [{ label: 'Scan a different tag', kind: 'btn-primary', fn: onRetry }] });
    if (r.kind === 'sold') return dialog({ tone: 'warning', icon: 'alert', title: code + ' was sold on ' + dayText(r.t.soldAt || ''), html: '<p>A sold saree\'s tag can\'t be used again. Put a new tag on this saree.</p>' + cmp(photo, r.p, 'Sold: '), actions: [{ label: 'Scan a different tag', kind: 'btn-primary', fn: onRetry }] });
    if (r.kind === 'retired') return dialog({ tone: 'warning', icon: 'broken', title: code + ' was retired', text: code + ' was a damaged tag and was replaced on ' + esc(r.t.retiredAt || 'an earlier day') + '. It can\'t be used again.', actions: [{ label: 'Scan a different tag', kind: 'btn-primary', fn: onRetry }] });
    if (r.kind === 'other') return dialog({ tone: 'warning', icon: 'alert', title: code + ' is already used', html: '<p>Each tag can be on only one saree. Is this the right tag for this saree?</p>' + cmp(photo, r.p, 'Already on: '),
      actions: [{ label: 'Scan a different tag', kind: 'btn-primary', fn: onRetry }, { label: 'Open that saree', fn: function () { sareeSheet(r.p); } }] });
    if (r.kind === 'batch' && extra) return extra(r);
  }
  function cmp(photo, p, lead) {
    var st = p ? tagState(p, shownTags(p)[0] || { st: 'in_stock' })[0] : '';
    return '<div class="cmp">' + (photo ? '<figure><div class="ph"><img src="' + esc(photo) + '" alt=""></div><figcaption><b>This photo</b>The saree you\'re tagging</figcaption></figure>' : '') +
      (p ? '<figure><div class="ph">' + (p.imgs[0] ? '<img src="' + esc(p.imgs[0]) + '" alt="">' : '') + '</div><figcaption><b>' + lead + esc(pname(p)) + '</b>' + esc(p.sku) + ' · ' + esc(st) + '</figcaption></figure>' : '') + '</div>';
  }

  /* Photo: take or choose (pretend), for the saree page */
  var galleryPos = 0;
  function nextGalleryPhoto() { var g = window.NH_GALLERY; var src = g[(galleryPos++ + 17) % g.length]; return src; }

  /* ================= Router ================= */
  var current = { name: '', params: {} }, state = 'normal', ui = {}, timers = [];
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), q = h.split('?'), p = {};
    (q[1] || '').split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); p[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
    return { name: q[0] || 'products', params: p };
  }
  function go(route) { if (('#/' + route) === location.hash) render(); else location.hash = '#/' + route; }
  // Back stays inside the app: our own stack of visited screens, with a sensible parent otherwise.
  var stack = [];
  function parentRoute() {
    var n = current.name, id = current.params.id;
    return { subproducts: 'products', addpick: 'products', addstart: id ? 'subproducts?id=' + id : 'addpick', gallery: 'addstart?id=' + id, crop: 'review?id=' + id, scanfind: 'products', product: 'products', move: 'product?id=' + id, details: 'product?id=' + id, photos: 'product?id=' + id }[n] || 'products';
  }
  function back() { if (stack.length > 1) history.back(); else go(parentRoute()); }
  // After saving a sub-screen: return to its parent screen (the saree, the review), never somewhere else.
  function done() {
    var to = '#/' + parentRoute();
    if (stack.length > 1 && stack[stack.length - 2] === to) return history.back();
    stack.pop(); location.replace(to);
  }
  // Demo links (…&demo=x) set up their example once, then drop the flag so edits aren't undone.
  function stripDemo() {
    var p = current.params; if (!p.demo) return;
    delete p.demo;
    var qs = Object.keys(p).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(p[k]); }).join('&');
    var h = '#/' + current.name + (qs ? '?' + qs : '');
    history.replaceState(null, '', h); stack[stack.length - 1] = h;
  }
  function after(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function afterNav(fn, ms) { return setTimeout(fn, ms); }
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
    var tab = 'products';
    var tabs = TABS.map(function (t) {
      var cur = t[0] === tab ? ' aria-current="page"' : '';
      if (t[0] === 'scan') return '<button type="button" class="scan-tab" data-tab="scan"' + cur + ' aria-label="Scan"><span class="scan-ico">' + icon('scan') + '</span></button>';
      return '<button type="button" data-tab="' + t[0] + '"' + cur + '>' + icon(t[1]) + t[2] + '</button>';
    }).join('');
    var rail = '<nav class="rail" aria-label="Main menu"><img src="assets/logo.png" alt="Nandam Handlooms">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + icon(t[1]) + t[2] + '</button>'; }).join('') + '</nav>';
    var q = demo.queue && !demo.queue.done ? '<button type="button" class="queue-pill" data-go="saving?id=' + demo.queue.sub + '"><span class="qst ' + (offline() ? 'offline' : 'busy') + '">' + (offline() ? icon('wifioff') : '') + '</span><span data-qtext style="flex:1">' + queueText() + '</span>' + icon('right') + '</button>' : '';
    return '<div class="shell">' + rail + '<div class="shell-main">' + q + savedBar() + inner + '</div><nav class="tabbar" aria-label="Main menu">' + tabs + '</nav></div>';
  }

  /* ================= Screens ================= */
  var S = {};

  var FILTERS = [['all', 'All'], ['instock', 'In stock'], ['soldout', 'Sold out'], ['nophoto', 'No photo'], ['online', 'Online only'], ['store', 'Store only']];
  function applyFilter(list, f) {
    if (f === 'instock') return list.filter(inStock);
    if (f === 'soldout') return list.filter(function (p) { var t = shownTags(p); return !t.some(function (x) { return x.st === 'in_stock' || x.st === 'reserved' || x.st === 'damaged'; }); });
    if (f === 'nophoto') return list.filter(function (p) { return !p.imgs.length; });
    if (f === 'online') return list.filter(function (p) { return p.ch === 'online_only'; });
    if (f === 'store') return list.filter(function (p) { return p.ch === 'store_only'; });
    return list;
  }
  function searchList(list, q) {
    var s = q.trim(); if (!s) return list;
    var digits = /^\d+$/.test(s), norm = normTag(s), low = s.toLowerCase();
    var exact = [], rest = [];
    list.forEach(function (p) {
      var ts = shownTags(p);
      if (digits ? ts.some(function (t) { return tagNum(t.code) === s; }) : ts.some(function (t) { return t.code === norm; })) exact.push(p);
      else if (p.sku.toLowerCase().indexOf(low) >= 0 || (!digits && pname(p).toLowerCase().indexOf(low) >= 0)) rest.push(p);
    });
    return exact.concat(rest);
  }
  function prodRow(p) {
    var x = sub(p.sub), ts = shownTags(p), live = ts.filter(function (t) { return t.st !== 'retired'; });
    var chips = live.slice(0, 2).map(function (t) { return tagchip(t.code, /^sold/.test(t.st) ? 'sold' : ''); }).join('') + (live.length > 2 ? '<span class="tagchip">+' + (live.length - 2) + '</span>' : '');
    var badges = stockBadge(p) + (p.ch !== 'both' ? '<span class="badge badge-info">' + CH[p.ch] + '</span>' : '') + (p.feat ? '<span class="badge badge-new">Best Seller</span>' : '') + (p.imgs.length ? '' : '<span class="badge badge-warning">No photo</span>') + (p.fresh ? '<span class="badge badge-owner">New</span>' : '');
    return '<button type="button" class="row prow" data-go="product?id=' + p.id + '">' + pthumb(p.imgs[0]) + '<span class="grow"><b>' + esc(pname(p)) + '</b><span class="sub">' + esc(p.sku) + '</span><span class="chips">' + chips + badges + '</span></span>' +
      '<span class="prices"><b>' + rs(x && x.s.store) + '</b><span>Web ' + rs(x && x.s.online) + '</span></span></button>';
  }
  function prodCell(p) {
    var x = sub(p.sub), t = shownTags(p).filter(function (t) { return t.st !== 'retired'; })[0];
    return '<button type="button" class="pcell" data-go="product?id=' + p.id + '"><span class="ph">' + (p.imgs[0] ? '<img src="' + esc(p.imgs[0]) + '" alt="" loading="lazy">' : icon('image', 'icon-xl')) + stockBadge(p) + '</span>' +
      '<span class="bd"><b>' + esc(pname(p)) + '</b><span>' + (t ? esc(t.code) + ' · ' : '') + rs(x && x.s.store) + '</span></span></button>';
  }
  // Rows with photo by default; the switch above the list changes it, remembered on this phone (owner's pick, 11 Oct).
  function listView() { try { return localStorage.getItem('nh-m4-listview') === 'grid' ? 'grid' : 'rows'; } catch (e) { return 'rows'; } }
  function viewSwitch() {
    var v = listView();
    return '<div class="view-switch" role="group" aria-label="List style"><button type="button" data-view="rows" aria-pressed="' + (v === 'rows') + '" aria-label="Rows with photo" title="Rows with photo">' + icon('list') + '</button><button type="button" data-view="grid" aria-pressed="' + (v === 'grid') + '" aria-label="Photo grid" title="Photo grid">' + icon('grid') + '</button></div>';
  }
  function bindViewSwitch(el) {
    el.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () {
      try { localStorage.setItem('nh-m4-listview', b.dataset.view); } catch (e) { }
      var sc = el.querySelector('.scr-body'), top = sc ? sc.scrollTop : 0; render(); var n = viewport.querySelector('.scr-body'); if (n) n.scrollTop = top;
    }); });
  }
  function listHead(label) { return '<div class="list-head"><span>' + label + '</span>' + viewSwitch() + '</div>'; }
  function prodList(items) {
    if (listView() === 'grid') return '<div class="pgrid">' + items.map(prodCell).join('') + '</div>';
    return '<div class="list">' + items.map(prodRow).join('') + '</div>';
  }
  function draftBanner() {
    var b = demo.batch; if (!b || !b.items.length) return '';
    var n = b.items.length, t = b.items.filter(function (i) { return i.tag; }).length, x = sub(b.sub);
    return alertBox('info', 'Draft on this phone: ' + t + ' of ' + plural(n, 'photo') + ' tagged', esc(x.s.name) + '. Nothing is lost if the app closes.', 'layers', '<button type="button" class="btn btn-sm btn-primary" style="margin-top:.5rem" data-go="scan?id=' + b.sub + '">Continue</button>') + '<div style="height:.7rem"></div>';
  }

  S.products = function (p) {
    var u = ui.products || (ui.products = { q: p.q || '', filter: 'all', shown: 40 });
    var all = active();
    function body() {
      if (state === 'loading') return skelRows(6);
      if (state === 'error') return alertBox('error', 'Couldn\'t load the sarees', 'Check your connection and try again.') + '<button type="button" class="btn btn-sm" style="margin-top:.6rem" data-retry>' + icon('refresh', 'icon-sm') + 'Retry</button>';
      if (state === 'empty' || !all.length) return emptyCard('box', 'No sarees yet', 'Add the first ones: choose a subcategory, pick the photos, scan the tags.', '<button type="button" class="btn btn-sm btn-primary" data-go="addpick">' + icon('plus', 'icon-sm') + 'Add sarees</button>');
      if (u.q.trim()) {
        var hits = searchList(all, u.q);
        return listHead(plural(hits.length, 'saree') + ' match "' + esc(u.q.trim()) + '"' + (/^\d+$/.test(u.q.trim()) ? ' · tag NH' + esc(u.q.trim()) + ' first' : '')) +
          (hits.length ? prodList(hits.slice(0, 40)) : emptyCard('search', 'No saree has that', 'Try the number on the tag (like 2264), a SKU, or a name.', '<button type="button" class="btn btn-sm" data-go="scanfind">' + icon('scan', 'icon-sm') + 'Scan the tag instead</button>'));
      }
      var f = applyFilter(all, u.filter);
      if (!f.length) return emptyCard('check', 'Nothing here', 'No sarees in this filter.');
      return listHead(plural(f.length, 'saree') + (u.filter === 'all' ? '' : ' · ' + FILTERS.filter(function (x) { return x[0] === u.filter; })[0][1].toLowerCase())) + prodList(f.slice(0, u.shown)) + (f.length > u.shown ? '<button type="button" class="btn btn-sm btn-block more-btn" data-more>Show more (' + (f.length - u.shown) + ')</button>' : '');
    }
    var cnt = {}; FILTERS.forEach(function (f) { cnt[f[0]] = applyFilter(all, f[0]).length; });
    var stock = shopStock(), pct = Math.min(100, stock / window.NH_TOTALS.cap * 100);
    return {
      html: '<section class="scr">' + topBar('Products', null, '<button type="button" class="btn btn-sm btn-primary top-act" data-go="addpick">' + icon('plus', 'icon-sm') + 'Add</button>') +
        '<div class="scr-body narrow">' + draftBanner() +
        (state === 'loading' ? '' : '<div class="limit-card"><div class="big"><b>' + num(stock) + '</b><span>sarees in stock · ' + num(shopListings()) + ' listings</span></div><div class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></div><small>' + num(stock) + ' of the 5,000 limit. Sold-out listings don\'t count.</small></div>') +
        '<div class="search-row"><div class="search">' + icon('search') + '<input class="input" type="search" id="p-q" placeholder="Name, SKU or tag number" autocomplete="off" inputmode="search" value="' + esc(u.q) + '" aria-label="Search sarees"></div>' + iconBtn('scan', 'data-go="scanfind"', 'Scan a tag to find its saree') + '</div>' +
        (u.q ? '' : '<div class="chips-row" role="group" aria-label="Filter">' + FILTERS.map(function (f) { return '<button type="button" class="fchip" data-filter="' + f[0] + '" aria-pressed="' + (u.filter === f[0]) + '">' + f[1] + ' <span class="n">' + cnt[f[0]] + '</span></button>'; }).join('') + '</div>') +
        '<div id="p-body">' + body() + '</div>' +
        '<p class="field-hint" style="margin:.8rem .25rem 0">Sample: ' + all.length + ' of the shop\'s ' + num(shopListings()) + ' listings (6 subcategories and the 6 without a photo). The counts at the top are the whole shop.</p>' +
        '</div></section>',
      mount: function (el) {
        var q = el.querySelector('#p-q'), box = el.querySelector('#p-body');
        q.addEventListener('input', function () { var had = !!u.q; u.q = q.value; if (had !== !!u.q) { render(); var n = viewport.querySelector('#p-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); } else { box.innerHTML = body(); bindGo(box); bindViewSwitch(box); } });
        bindViewSwitch(el);
        el.querySelectorAll('[data-filter]').forEach(function (b) { b.addEventListener('click', function () { u.filter = b.dataset.filter; u.shown = 40; render(); }); });
        el.addEventListener('click', function (e) { if (e.target.closest('[data-more]')) { u.shown += 40; render(); } if (e.target.closest('[data-retry]')) { state = 'normal'; render(); } });
      }
    };
  };

  S.subproducts = function (p) {
    var x = sub(p.id); if (!x) return gone();
    var list = active().filter(function (q) { return q.sub === x.s.id; }), ins = list.filter(inStock).length;
    var body = state === 'loading' ? skelRows(5) : (state === 'empty' || !list.length) ? emptyCard('box', 'No sarees here yet', 'Add them: pick the photos, then scan each saree\'s tag.') : prodList(list);
    return {
      html: '<section class="scr">' + topBar(esc(x.s.name), 'history') + '<div class="scr-body narrow">' +
        '<div class="sub-card">' + (x.s.img ? '<span class="thumb lg"><img src="' + esc(x.s.img) + '" alt=""></span>' : '<span class="thumb lg">' + icon('image') + '</span>') + '<span class="grow"><span class="res-cat">' + esc(x.c.name) + '</span><b>' + esc(x.s.name) + '</b><span>Store ' + rs(x.s.store) + ' · Web ' + rs(x.s.online) + (x.s.mrp ? ' · MRP ' + rs(x.s.mrp) : '') + '</span></span></div>' +
        '<p class="field-hint" style="margin:.5rem .25rem .8rem">Every saree here gets this name, price and description. Change them in the Catalogue.</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem"><button type="button" class="btn btn-primary" data-go="addstart?id=' + x.s.id + '">' + icon('image', 'icon-sm') + 'Add products</button><button type="button" class="btn" data-go="quick?id=' + x.s.id + '">' + icon('camera', 'icon-sm') + 'Quick add</button></div>' +
        '<div style="height:.9rem"></div>' + listHead(plural(list.length, 'saree') + ' · ' + ins + ' in stock') + body + '</div></section>',
      mount: bindViewSwitch
    };
  };

  S.addpick = function (p) {
    var u = ui.addpick || (ui.addpick = { q: '' });
    var tag = p.tag ? normTag(p.tag) : '';
    function rowFor(y) { return '<button type="button" class="row srow" data-pick="' + y.s.id + '">' + thumb(y.s.img) + '<span class="grow"><span class="res-cat">' + esc(y.c.name) + '</span><b>' + esc(y.s.name) + '</b><span>' + plural(active().filter(function (q) { return q.sub === y.s.id; }).length || y.s.products, 'saree') + '</span></span><span class="prices"><b>' + rs(y.s.store) + '</b><span>Web ' + rs(y.s.online) + '</span></span></button>'; }
    function body() {
      var q = u.q.trim().toLowerCase();
      var list = SUB_LIST.filter(function (y) { return !q || y.s.name.toLowerCase().indexOf(q) >= 0 || y.c.name.toLowerCase().indexOf(q) >= 0; });
      return (q ? '' : '<div class="list-title">Recent</div><div class="list">' + demo.recent.map(sub).filter(Boolean).map(rowFor).join('') + '</div><div class="list-title">All subcategories · ' + SUB_LIST.length + '</div>') +
        (list.length ? '<div class="list">' + list.slice(0, 40).map(rowFor).join('') + '</div>' + (list.length > 40 ? '<p class="field-hint" style="margin:.5rem .25rem 0">Showing 40 of ' + list.length + '. Search to find the others.</p>' : '') : emptyCard('search', 'No subcategory matches', 'Try part of the name, like "checks".'));
    }
    return {
      html: '<section class="scr">' + topBar('Add sarees', 'history') + '<div class="scr-body narrow">' +
        (tag ? alertBox('info', 'New saree with tag ' + esc(tag), 'Choose its subcategory. Then take its photo.', 'barcode') + '<div style="height:.7rem"></div>' : '<p class="scr-lead" style="margin-top:0">Which subcategory are these sarees from? You choose it <b>once</b> for the whole batch.</p>') +
        '<div class="search">' + icon('search') + '<input class="input" type="search" id="ap-q" placeholder="Search subcategories" autocomplete="off" value="' + esc(u.q) + '" aria-label="Search subcategories"></div>' +
        '<div id="ap-body">' + body() + '</div></div></section>',
      mount: function (el) {
        var q = el.querySelector('#ap-q'), box = el.querySelector('#ap-body');
        q.addEventListener('input', function () { u.q = q.value; box.innerHTML = body(); });
        box.addEventListener('click', function (e) { var b = e.target.closest('[data-pick]'); if (!b) return; go(tag ? 'quick?id=' + b.dataset.pick + '&tag=' + tag : 'addstart?id=' + b.dataset.pick); });
      }
    };
  };

  S.addstart = function (p) {
    var x = sub(p.id); if (!x) return gone();
    var near = state === 'warning';
    return {
      html: '<section class="scr">' + topBar('Add sarees', 'history') + '<div class="scr-body narrow">' +
        (near ? alertBox('warning', 'Nearly at the limit', '4,990 of 5,000 sarees in stock: you can add 10 more. Sold-out listings don\'t count, so selling frees up space.') + '<div style="height:.8rem"></div>' : '') +
        '<div class="sub-card">' + (x.s.img ? '<span class="thumb lg"><img src="' + esc(x.s.img) + '" alt=""></span>' : '<span class="thumb lg">' + icon('image') + '</span>') + '<span class="grow"><span class="res-cat">' + esc(x.c.name) + '</span><b>' + esc(x.s.name) + '</b><span>Store ' + rs(x.s.store) + ' · Web ' + rs(x.s.online) + '</span></span><button type="button" class="btn btn-sm btn-ghost" data-go="addpick">Change</button></div>' +
        '<p class="field-hint" style="margin:.45rem .25rem 0">Name, price and description come from this subcategory, for every saree.</p>' +
        '<div class="list-title">Where they sell</div><div class="seg3" role="group" aria-label="Where they sell">' + Object.keys(CH).map(function (k) { return '<button type="button" data-ch="' + k + '" aria-pressed="' + (demo.ch === k) + '">' + CH[k] + '</button>'; }).join('') + '</div>' +
        '<p class="field-hint" style="margin:.45rem .25rem 0">For the whole batch. You can change one saree later.</p>' +
        '<div class="list-title">How do you want to add?</div><div class="optcards">' +
        '<button type="button" class="optcard main" data-go="gallery?id=' + x.s.id + '"><span class="tile">' + icon('image') + '</span><span><b>Choose photos from the gallery</b><span>Best for 5 or more. Up to 50 at a time.</span><ol class="steps-mini"><li>Pick the photos</li><li>Each photo shows big: scan that saree\'s tag</li><li>Check, then Save all</li></ol><span class="badge badge-new">Main way</span></span></button>' +
        '<button type="button" class="optcard" data-go="quick?id=' + x.s.id + '"><span class="tile">' + icon('camera') + '</span><span><b>Quick add with the camera</b><span>For 1–3 sarees: photo → scan → next.</span></span></button></div>' +
        '<div class="facts">' + '<div>' + icon('camera') + 'Take the photos first, in good light, one saree per photo.</div><div>' + icon('layers') + 'Keep the sarees close, in the same order as the photos: each one is quicker to find.</div><div>' + icon('wifioff') + 'Works without internet: it uploads later.</div></div>' +
        '</div></section>',
      mount: function (el) { el.querySelectorAll('[data-ch]').forEach(function (b) { b.addEventListener('click', function () { demo.ch = b.dataset.ch; save(); render(); }); }); }
    };
  };

  S.gallery = function (p) {
    var x = sub(p.id); if (!x) return gone();
    var u = ui.gallery || (ui.gallery = { sel: [] });
    var g = window.NH_GALLERY;
    return {
      html: '<section class="flow">' + flowTop('Choose photos', u.sel.length ? u.sel.length + ' selected · up to ' + MAX_BATCH : 'Up to ' + MAX_BATCH + ' · tap in any order', iconBtn('back', 'data-back', 'Back'), u.sel.length ? '<button type="button" class="btn btn-sm btn-ghost" data-clear style="margin-right:6px">Clear</button>' : '') +
        '<div class="flow-body"><p class="gal-note">Sample: website photos stand in for your phone\'s gallery. The number on a photo is the order you\'ll scan in.</p><div class="ggrid">' +
        g.map(function (src, i) { var k = u.sel.indexOf(i); return '<button type="button" data-g="' + i + '" aria-pressed="' + (k >= 0) + '" aria-label="Photo ' + (i + 1) + (k >= 0 ? ', selected ' + (k + 1) : '') + '"><img src="' + esc(src) + '" alt="" loading="lazy"><span class="sel">' + (k >= 0 ? k + 1 : '') + '</span></button>'; }).join('') +
        '</div></div><div class="flow-foot"><button type="button" class="btn btn-primary btn-block" data-next' + (u.sel.length ? '' : ' disabled') + '>' + (u.sel.length ? 'Next: scan ' + plural(u.sel.length, 'tag') : 'Select photos') + '</button></div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-g]').forEach(function (b) { b.addEventListener('click', function () {
          var i = +b.dataset.g, k = u.sel.indexOf(i);
          if (k >= 0) u.sel.splice(k, 1); else if (u.sel.length >= MAX_BATCH) return toast('Up to 50 photos at a time. Save these, then start a new batch.'); else u.sel.push(i);
          var top = el.querySelector('.flow-body').scrollTop; render(); viewport.querySelector('.flow-body').scrollTop = top;
        }); });
        var c = el.querySelector('[data-clear]'); c && c.addEventListener('click', function () { u.sel = []; render(); });
        el.querySelector('[data-next]').addEventListener('click', function () {
          if (demo.batch && demo.batch.items.some(function (i) { return i.tag; })) {
            return dialog({ tone: 'warning', icon: 'layers', title: 'Replace your draft?', text: 'You have a draft with ' + demo.batch.items.filter(function (i) { return i.tag; }).length + ' tagged photos. Start a new batch instead?',
              actions: [{ label: 'Continue the draft', kind: 'btn-primary', fn: function () { go('scan?id=' + demo.batch.sub); } }, { label: 'Start new (draft is dropped)', kind: 'btn-danger', fn: start }] });
          }
          start();
        });
        function start() {
          demo.batch = { sub: x.s.id, ch: demo.ch, cur: 0, undo: [], items: u.sel.map(function (i) { return { img: g[i], tag: null }; }) };
          save(); ui.gallery = undefined; go('scan?id=' + x.s.id);
        }
      }
    };
  };

  // A ready-made batch for the demo screens (8 photos; 2 already tagged).
  function demoBatch(id, kind) {
    var g = window.NH_GALLERY, items = [];
    for (var i = 0; i < 8; i++) items.push({ img: g[i + 2], tag: null });
    var b = { sub: subId(id), ch: 'both', cur: 2, undo: [], items: items, demo: kind };
    demo.batch = b;
    b.items[0].tag = nextFree(); b.items[1].tag = nextFree(); b.undo = [0, 1];
    if (kind === 'review') { for (var j = 2; j < 8; j++) if (j !== 4) { b.items[j].tag = nextFree(); b.undo.push(j); } b.items[4].skipped = true; b.cur = 4; }
    save(); return b;
  }
  function ensureBatch(p, kind) {
    if (p.demo) { var b = demoBatch(p.id || RAINBOW, kind); stripDemo(); return b; }
    return demo.batch || demoBatch(p.id || RAINBOW, kind);
  }
  function nextIndex(b, from) {
    var n = b.items.length, i;
    for (i = 1; i <= n; i++) { var k = (from + i) % n; if (!b.items[k].tag && !b.items[k].skipped) return k; }
    for (i = 1; i <= n; i++) { var s = (from + i) % n; if (!b.items[s].tag) return s; }
    return -1;
  }

  S.scan = function (p) {
    var demoKind = p.demo;
    var b = ensureBatch(p, 'scan'), x = sub(b.sub);
    if (demoKind === 'again') b.cur = 1;
    var u = ui.scan || (ui.scan = { hint: state === 'warning', flash: null });
    if (b.cur >= b.items.length) b.cur = 0;
    var it = b.items[b.cur], n = b.items.length, tagged = b.items.filter(function (i) { return i.tag; }).length;
    var strip = '<div class="strip" role="list" aria-label="All photos">' + b.items.map(function (q, i) {
      return '<button type="button" role="listitem" data-strip="' + i + '" aria-current="' + (i === b.cur) + '" aria-label="Photo ' + (i + 1) + (q.tag ? ', tag ' + q.tag : q.skipped ? ', skipped' : ', no tag yet') + '"><img src="' + esc(q.img) + '" alt="">' + (q.tag ? '<span class="st ok">' + icon('check') + '</span>' : q.skipped ? '<span class="st skip">' + icon('skip') + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    var flash = u.flash ? '<div class="flash-ok"><span>' + icon('check') + esc(u.flash) + '</span></div>' : '';
    var ctrls = '<div class="scan-ctrls"><button type="button" class="btn" data-undo' + (b.undo.length ? '' : ' disabled') + '>' + icon('undo', 'icon-sm') + 'Undo last</button><button type="button" class="btn" data-type>' + icon('keyboard', 'icon-sm') + 'Type</button><button type="button" class="btn" data-skip>' + icon('skip', 'icon-sm') + 'Skip</button></div>';
    var hint = u.hint ? '<div class="hint-card">' + icon('alert') + '<span>Can\'t read this tag? Wipe the lens, hold the phone a hand\'s width away, or type the number.</span><button type="button" class="btn btn-sm" data-type>Type</button></div>' : '';
    var mb = mockbar([['free', 'Free tag'], ['used', 'Used tag'], ['sold', 'Sold tag'], ['dup', 'Tag from photo 1'], ['bad', 'Unreadable']], 'Bluetooth scanners work the same');
    var vfHint = it.tag ? 'Scan again only to replace ' + it.tag : 'Point at the tag of this saree';
    // Camera fills the screen; the photo being tagged sits in a card (owner's pick B, 11 Oct).
    var main = '<div class="scan-b"><div class="viewfinder" role="img" aria-label="Camera"><div class="card-photo"><img src="' + esc(it.img) + '" alt="Photo ' + (b.cur + 1) + ' of ' + n + '"><span class="num">Photo ' + (b.cur + 1) + ' of ' + n + '</span>' + flash + '</div>' +
      '<div class="frame">' + icon('barcode') + '<span class="laser"></span></div><span class="hint">' + vfHint + '</span></div>' +
      '<div class="bottom">' + (it.tag ? '<div style="display:flex;justify-content:center">' + tagchip(it.tag + (it.unchecked ? ' · check when online' : ''), it.unchecked ? 'wait' : 'ok') + '</div>' : '') + hint + ctrls + strip + mb + '</div></div>';
    return {
      html: '<section class="flow">' + flowTop(esc(x.s.name), 'Photo ' + (b.cur + 1) + ' of ' + n + ' · ' + tagged + ' tagged' + (offline() ? ' · offline' : ''), iconBtn('x', 'data-stop', 'Stop'), '<button type="button" class="btn btn-sm btn-ghost" data-go="review?id=' + b.sub + '" style="margin-right:6px">Review</button>') +
        '<div class="flow-prog"><i style="width:' + (tagged / n * 100).toFixed(0) + '%"></i></div><div class="flow-body wide" style="padding-top:8px">' + main + '</div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-strip]').forEach(function (s) { s.addEventListener('click', function () { b.cur = +s.dataset.strip; u.hint = false; save(); render(); }); });
        el.querySelector('[data-undo]').addEventListener('click', undo);
        el.querySelectorAll('[data-type]').forEach(function (t) { t.addEventListener('click', function () { typeSheet('Type the tag number', onScan); }); });
        el.querySelector('[data-skip]').addEventListener('click', skip);
        el.querySelector('[data-stop]').addEventListener('click', stop);
        el.querySelectorAll('[data-fake]').forEach(function (f) { f.addEventListener('click', function () { fake(f.dataset.fake); }); });
        if (demoKind === 'used') after(function () { fake('used'); }, 350);
        if (demoKind === 'dup') after(function () { fake('dup'); }, 350);
        if (demoKind === 'again') after(function () { fake('free'); }, 450);
        if (demoKind === 'type') after(function () { typeSheet('Type the tag number', onScan); }, 350);
        if (state === 'popup' && !u.demoed) { u.demoed = true; after(function () { fake('used'); }, 300); }
      }
    };
    function fake(kind) {
      u.hint = false;
      if (kind === 'free') return onScan(nextFree());
      if (kind === 'used') { var f = active().filter(function (q) { return q.id === '630692a8'; })[0]; return onScan(f && shownTags(f)[0] && shownTags(f)[0].st === 'in_stock' ? shownTags(f)[0].code : 'NH4'); }
      if (kind === 'sold') return onScan('NH6');
      if (kind === 'dup') { var t0 = b.items[0].tag; if (!t0 || b.cur === 0) return toast('Photo 1 needs a tag first, and pick another photo.'); return onScan(t0); }
      if (kind === 'bad') { u.hint = true; render(); }
    }
    function onScan(code) {
      var cur = b.items[b.cur];
      if (cur.tag === code) return toast(code + ' is already this saree\'s tag');
      var r = checkTag(code, b.cur);
      if (!r.ok) return tagProblem(r, code, cur.img, null, function (rb) {
        dialog({ tone: 'warning', icon: 'copy', title: 'Already used in this batch', html: '<p>You already gave <b>' + code + '</b> to photo ' + (rb.idx + 1) + '. Each saree needs its own tag.</p>' + '<div class="cmp"><figure><div class="ph"><img src="' + esc(cur.img) + '" alt=""></div><figcaption><b>This photo</b>Photo ' + (b.cur + 1) + '</figcaption></figure><figure><div class="ph"><img src="' + esc(b.items[rb.idx].img) + '" alt=""></div><figcaption><b>Photo ' + (rb.idx + 1) + '</b>Has ' + code + '</figcaption></figure></div>',
          actions: [{ label: 'Scan a different tag', kind: 'btn-primary' }, { label: 'Give it to this photo instead', fn: function () {
            var j = rb.idx; b.items[j].tag = null; b.undo = b.undo.filter(function (k) { return k !== j; });
            assign(code, false); afterNav(function () { toast('Photo ' + (j + 1) + ' now needs a tag'); }, 900);
          } }] });
      });
      if (cur.tag) {
        var acts = [{ label: 'Replace with ' + code, kind: 'btn-primary', fn: function () { assign(code, r.unchecked); } }, { label: 'Keep ' + cur.tag }];
        return dialog({ tone: 'info', icon: 'barcode', title: 'This saree already has a tag', html: '<div class="swap">' + tagchip(cur.tag) + icon('right') + tagchip(code, 'ok') + '</div><p>Each saree keeps <b>one</b> tag. Replace ' + cur.tag + ' with ' + code + '?</p>', actions: acts });
      }
      assign(code, r.unchecked);
    }
    function assign(code, unchecked) {
      var i = b.cur, cur = b.items[i];
      cur.tag = code; cur.unchecked = !!unchecked; cur.skipped = false;
      b.undo = b.undo.filter(function (k) { return k !== i; }); b.undo.push(i);
      save(); u.flash = code; render();
      after(function () {
        u.flash = null;
        var k = nextIndex(b, i);
        if (k < 0) { save(); go('review?id=' + b.sub); afterNav(function () { toast('All ' + b.items.length + ' photos tagged. Check them, then save.', true); }, 300); return; }
        if (b.items[k].skipped && !b.items.some(function (q) { return !q.tag && !q.skipped; })) toast('Back to the skipped photos');
        b.cur = k; save(); render();
      }, 700);
    }
    function undo() {
      var i = b.undo.pop(); if (i === undefined) return;
      var code = b.items[i].tag; b.items[i].tag = null; b.items[i].unchecked = false; b.cur = i; save(); render();
      toast(code + ' taken off photo ' + (i + 1) + '. Scan the right tag.');
    }
    function skip() {
      var i = b.cur; b.items[i].skipped = true;
      var k = nextIndex(b, i);
      if (k < 0 || k === i) { save(); render(); return toast('This is the only photo left without a tag'); }
      b.cur = k; save(); render(); toast('Skipped. It comes back at the end.');
    }
    function stop() {
      var t = b.items.filter(function (q) { return q.tag; }).length;
      dialog({ tone: 'info', icon: 'layers', title: 'Stop for now?', text: t ? t + ' of ' + plural(b.items.length, 'photo') + ' are tagged. They stay as a draft on this phone; continue any time from Products.' : 'Nothing is tagged yet. Close this batch?',
        actions: t ? [{ label: 'Continue scanning', kind: 'btn-primary' }, { label: 'Keep as draft and close', fn: function () { go('products'); } }, { label: 'Discard this batch', kind: 'btn-danger', fn: function () { demo.batch = null; save(); go('products'); } }]
          : [{ label: 'Continue scanning', kind: 'btn-primary' }, { label: 'Close', fn: function () { demo.batch = null; save(); go('products'); } }] });
    }
  };

  S.review = function (p) {
    var b = ensureBatch(p, 'review'), x = sub(b.sub);
    var n = b.items.length, tagged = b.items.filter(function (i) { return i.tag; }), missing = n - tagged.length, unchecked = tagged.filter(function (i) { return i.unchecked; }).length;
    return {
      html: '<section class="flow">' + flowTop('Check before saving', esc(x.s.name), iconBtn('back', 'data-go="scan?id=' + b.sub + '"', 'Back to scanning')) +
        '<div class="flow-body"><div class="review-sum"><span class="badge">' + plural(n, 'photo') + '</span><span class="badge badge-success">' + tagged.length + ' tagged</span>' + (missing ? '<span class="badge badge-danger">' + missing + ' need' + (missing === 1 ? 's' : '') + ' a tag</span>' : '') + (unchecked ? '<span class="badge badge-warning">' + unchecked + ' checked when online</span>' : '') + '<span class="badge badge-info">' + CH[b.ch] + '</span></div>' +
        '<p class="field-hint" style="margin:0 0 .6rem">Tap a photo to change its tag, fix the photo, or take it out. Nothing is saved yet.</p>' +
        '<div class="rgrid">' + b.items.map(function (it, i) {
          return '<button type="button" class="rcell' + (it.tag ? (it.unchecked ? ' unchecked' : '') : ' missing') + '" data-r="' + i + '" aria-label="Photo ' + (i + 1) + ', ' + (it.tag ? 'tag ' + it.tag : 'no tag') + '"><span class="ph"><img src="' + esc(it.img) + '" alt=""></span><span class="n">' + (i + 1) + '</span><span class="t">' + (it.tag ? tagchip(it.tag, it.unchecked ? 'wait' : 'ok') : tagchip('No tag', 'bad')) + '</span></button>';
        }).join('') + '</div></div>' +
        '<div class="flow-foot"><button type="button" class="btn btn-primary btn-block" data-save' + (tagged.length ? '' : ' disabled') + '>' + icon('upload', 'icon-sm') + 'Save ' + plural(tagged.length, 'saree') + '</button><button type="button" class="btn btn-block" data-go="scan?id=' + b.sub + '">' + icon('barcode', 'icon-sm') + (missing ? 'Scan the missing tag' + (missing > 1 ? 's' : '') : 'Back to scanning') + '</button></div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-r]').forEach(function (c) { c.addEventListener('click', function () { cellSheet(+c.dataset.r); }); });
        el.querySelector('[data-save]').addEventListener('click', saveAll);
        if (state === 'warning') after(saveAll, 300);
      }
    };
    function cellSheet(i) {
      var it = b.items[i];
      sheet('<div style="display:flex;gap:.9rem;align-items:flex-start"><span class="pthumb" style="width:96px;height:128px"><img src="' + esc(it.img) + '" alt=""></span><div><h2>Photo ' + (i + 1) + '</h2>' + (it.tag ? tagchip(it.tag, it.unchecked ? 'wait' : 'ok') + (it.unchecked ? '<p class="field-hint" style="margin-top:.35rem">Scanned offline: checked against the shop when the internet is back.</p>' : '') : tagchip('No tag yet', 'bad')) + '</div></div>' +
        '<div class="sheet-acts">' +
        '<button type="button" class="act-row" data-a="scan"><span class="tile">' + icon('barcode') + '</span><span><b>' + (it.tag ? 'Change tag' : 'Scan its tag') + '</b><span>' + (it.tag ? 'Wrong saree? Scan the right tag.' : 'Opens the scanner on this photo.') + '</span></span></button>' +
        '<button type="button" class="act-row" data-a="type"><span class="tile">' + icon('keyboard') + '</span><span><b>Type the number</b><span>For a tag that won\'t scan.</span></span></button>' +
        '<button type="button" class="act-row" data-a="crop"><span class="tile">' + icon('crop') + '</span><span><b>Adjust photo</b><span>Fitted to the website card automatically.</span></span></button>' +
        '<button type="button" class="act-row danger" data-a="remove"><span class="tile">' + icon('trash') + '</span><span><b>Take out of this batch</b><span>The photo stays in your gallery.</span></span></button>' +
        '</div><div class="acts"><button type="button" class="btn btn-ghost btn-block" data-close>Close</button></div>', function (el, close) {
        el.querySelectorAll('[data-a]').forEach(function (a) { a.addEventListener('click', function () {
          close();
          var k = a.dataset.a;
          if (k === 'scan') { b.cur = i; save(); go('scan?id=' + b.sub); }
          if (k === 'crop') go('crop?id=' + b.sub + '&i=' + i);
          if (k === 'type') typeSheet('Tag for photo ' + (i + 1), function (code) {
            if (it.tag === code) return;
            var r = checkTag(code, i);
            if (!r.ok) return tagProblem(r, code, it.img, null, function (rb) { dialog({ tone: 'warning', icon: 'copy', title: 'Already used in this batch', text: code + ' is on photo ' + (rb.idx + 1) + '. Each saree needs its own tag.', actions: [{ label: 'OK', kind: 'btn-primary' }] }); });
            var old = it.tag; it.tag = code; it.unchecked = !!r.unchecked; it.skipped = false; b.undo.push(i); save(); render(); toast(old ? 'Photo ' + (i + 1) + ': ' + old + ' → ' + code : 'Photo ' + (i + 1) + ' tagged ' + code, true);
          });
          if (k === 'remove') dialog({ tone: 'danger', icon: 'trash', title: 'Take photo ' + (i + 1) + ' out?', text: it.tag ? 'Its tag ' + it.tag + ' stays free for another saree.' : 'It won\'t be saved.', actions: [{ label: 'Take it out', kind: 'btn-danger-solid', fn: function () {
            b.items.splice(i, 1); b.undo = b.undo.filter(function (q) { return q !== i; }).map(function (q) { return q > i ? q - 1 : q; }); if (b.cur >= b.items.length) b.cur = 0;
            if (!b.items.length) { demo.batch = null; save(); go('products'); return; }
            save(); render(); toast('Taken out');
          } }, { label: 'Cancel' }] });
        }); });
      });
    }
    function saveAll() {
      var ok = b.items.filter(function (i) { return i.tag; }), left = b.items.filter(function (i) { return !i.tag; });
      if (!ok.length) return;
      if (left.length) return dialog({ tone: 'warning', icon: 'alert', title: plural(left.length, 'photo has', 'photos have') + ' no tag', text: 'Save the ' + plural(ok.length, 'tagged saree') + ' now? The other' + (left.length > 1 ? 's stay' : ' stays') + ' here as a draft, to scan later.',
        actions: [{ label: 'Go back and scan', kind: 'btn-primary', fn: function () { b.cur = b.items.indexOf(left[0]); save(); go('scan?id=' + b.sub); } }, { label: 'Save ' + ok.length + ', keep ' + left.length + ' as draft', fn: function () { go2(ok, left); } }] });
      go2(ok, []);
    }
    function go2(ok, left) {
      if (demo.queue && !demo.queue.done) { demo.queue.items = demo.queue.items.concat(ok.map(function (it) { return { img: it.img, tag: it.tag, st: 'wait' }; })); }
      else startQueue(b, ok);
      demo.batch = left.length ? { sub: b.sub, ch: b.ch, cur: 0, undo: [], items: left.map(function (it) { return { img: it.img, tag: null }; }) } : null;
      save(); go('saving?id=' + b.sub);
    }
  };

  S.crop = function (p) {
    var b = ensureBatch(p, 'scan'), i = Math.min(+p.i || 0, b.items.length - 1), it = b.items[i];
    return {
      html: '<section class="flow">' + flowTop('Adjust photo ' + (i + 1), 'Website product card shape (3:4)', iconBtn('back', 'data-back', 'Back')) +
        '<div class="flow-body"><p class="scr-lead" style="margin-top:0">Drag the photo so the saree sits inside the frame. Customers see this shape on the website.</p><div class="crop34" data-crop><img src="' + esc(it.img) + '" alt="Photo to adjust" draggable="false"><div class="frame"></div></div>' +
        '<p class="field-hint" style="margin-top:.6rem;text-align:center">Saved small (80 KB or less) with location removed.</p></div>' +
        '<div class="flow-foot"><button type="button" class="btn btn-primary btn-block" data-use>' + icon('check') + 'Use photo</button></div></section>',
      mount: function (el) {
        var img = el.querySelector('[data-crop] img'), box = el.querySelector('[data-crop]'), y = 0, sy = 0, start = null;
        box.addEventListener('pointerdown', function (e) { start = e.clientY; sy = y; box.setPointerCapture(e.pointerId); });
        box.addEventListener('pointermove', function (e) { if (start == null) return; y = Math.max(-60, Math.min(60, sy + e.clientY - start)); img.style.transform = 'translate(-50%, calc(-50% + ' + y + 'px))'; });
        box.addEventListener('pointerup', function () { start = null; });
        el.querySelector('[data-use]').addEventListener('click', function () { done(); afterNav(function () { toast('Photo ' + (i + 1) + ' adjusted', true); }, 300); });
      }
    };
  };

  function savingBody() {
    var q = demo.queue, x = sub(q.sub);
    var n = q.items.length, ok = q.items.filter(function (i) { return i.st === 'saved'; }).length, fails = q.items.filter(function (i) { return i.st === 'fail'; });
    var head;
    if (q.done) {
      head = '<div class="center-col">' + (fails.length ? '<div class="msg-icon is-warning">' + icon('alert') + '</div>' : '<div class="success-mark"><svg viewBox="0 0 112 112" aria-hidden="true"><circle cx="56" cy="56" r="50"/><path d="M34 58l15 15 30-32"/></svg></div>') +
        '<h2 class="scr-title">' + plural(ok, 'saree') + ' added</h2><p class="scr-lead">' + esc(x.s.name) + (fails.length ? ' · ' + fails.length + ' need' + (fails.length === 1 ? 's' : '') + ' a different tag' : '') + '</p>' +
        '<div class="facts"><div>' + icon('check') + 'On the website now' + (q.ch === 'store_only' ? ': no, Store only' : '') + '</div><div>' + icon('check') + 'Ready to sell at the counter' + (q.ch === 'online_only' ? ': no, Online only' : '') + '</div><div>' + icon('check') + 'SKUs ' + esc(q.items.filter(function (i) { return i.sku; }).map(function (i) { return i.sku; }).slice(0, 1).join('')) + (ok > 1 ? ' to ' + esc(q.items.filter(function (i) { return i.sku; }).slice(-1)[0].sku) : '') + '</div></div></div>';
    } else {
      head = '<div class="big-prog"><b>' + ok + ' of ' + n + ' saved</b><div class="bar"><i style="width:' + (ok / n * 100).toFixed(0) + '%"></i></div><span class="field-hint" style="margin:0">' + (offline() ? icon('wifioff', 'icon-sm') + ' Waiting for internet. Everything is kept on this phone and continues by itself.' : 'You can leave this screen: saving carries on, and a bar at the top shows it.') + '</span></div>';
    }
    var rows = '<div class="list qlist">' + q.items.map(function (it, i) {
      var st = it.st === 'wait' && offline() ? 'offline' : it.st;
      var label = { saved: 'Saved · ' + esc(it.sku || ''), busy: 'Saving…', wait: 'Waiting', offline: 'Waiting for internet', fail: esc(it.why || 'Couldn\'t save') }[st];
      var ic = { saved: icon('check'), busy: '', wait: icon('clock'), offline: icon('wifioff'), fail: icon('alertc') }[st];
      return '<div class="row">' + pthumb(it.img) + '<span class="grow">' + tagchip(it.tag, st === 'fail' ? 'bad' : st === 'saved' ? 'ok' : '') + '<span style="margin-top:.2rem">' + label + '</span></span>' + (st === 'fail' ? '<button type="button" class="btn btn-sm" data-fix="' + i + '">Fix</button>' : '<span class="qst ' + st + '">' + ic + '</span>') + '</div>';
    }).join('') + '</div>';
    return head + '<div class="list-title">' + plural(n, 'saree') + '</div>' + rows;
  }
  function refreshSaving() {
    var b = viewport.querySelector('#q-body'); if (!b) return render();
    b.innerHTML = savingBody(); bindFix(b);
    var t = viewport.querySelector('[data-qsmall]'); if (t) t.textContent = demo.queue.done ? 'Done' : queueText();
  }
  function bindFix(scope) {
    scope.querySelectorAll('[data-fix]').forEach(function (f) { f.addEventListener('click', function () {
      var it = demo.queue.items[+f.dataset.fix];
      dialog({ tone: 'warning', icon: 'barcode', title: 'Use a different tag', html: '<p>' + esc(it.why) + '</p>' + '<div class="cmp"><figure><div class="ph"><img src="' + esc(it.img) + '" alt=""></div><figcaption><b>This saree</b>Needs its own tag</figcaption></figure></div>',
        actions: [{ label: 'Scan a new tag (pretend)', kind: 'btn-primary', fn: function () { fixWith(it, nextFree()); } }, { label: 'Type the number', fn: function () { typeSheet('New tag for this saree', function (c) { var r = checkTag(c); if (!r.ok) return tagProblem(r, c, it.img, null); fixWith(it, c); }); } }, { label: 'Not now' }] });
    }); });
  }
  function fixWith(it, code) { it.tag = code; it.st = 'wait'; it.why = null; demo.queue.done = false; save(); render(); toast('Saving with ' + code, true); }

  S.saving = function (p) {
    function demoQueue() { var b = demoBatch(p.id || RAINBOW, 'review'); b.items[4].tag = nextFree(); startQueue(b, b.items); demo.batch = null; save(); }
    if (p.demo || !demo.queue) { demoQueue(); stripDemo(); }
    if (state === 'error' && !ui.failMade) {
      ui.failMade = true;
      if (demo.queue.done) demoQueue();
      demo.queue.items[demo.queue.items.length - 1].forceFail = true; save();
    }
    if (state === 'success' && !demo.queue.done) { while (!demo.queue.done) { demo.queue.items.forEach(function (i) { if (i.st === 'wait' || i.st === 'busy') commit(demo.queue, i); }); demo.queue.done = true; } save(); }
    var q = demo.queue, x = sub(q.sub);
    return {
      html: '<section class="flow">' + flowTop(q.done ? 'Saved' : 'Saving', '<span data-qsmall>' + (q.done ? esc(x.s.name) : queueText()) + '</span>', iconBtn('x', 'data-go="products"', 'Close'), q.done ? '' : '<button type="button" class="btn btn-sm btn-ghost" data-go="products" style="margin-right:6px">Hide</button>') +
        '<div class="flow-body" id="q-body">' + savingBody() + '</div>' +
        (q.done ? '<div class="flow-foot"><button type="button" class="btn btn-primary btn-block" data-go="subproducts?id=' + q.sub + '">See them in ' + esc(x.s.name) + '</button><button type="button" class="btn btn-block" data-new>' + icon('plus', 'icon-sm') + 'Add more</button></div>' : '') + '</section>',
      mount: function (el) {
        bindFix(el);
        var nw = el.querySelector('[data-new]'); nw && nw.addEventListener('click', function () { var s = q.sub; demo.queue = null; save(); go('addstart?id=' + s); });
      }
    };
  };

  S.quick = function (p) {
    var x = sub(p.id); if (!x) return gone();
    var u = ui.quick || (ui.quick = { step: 'photo', img: null, count: 0, tag: p.tag ? normTag(p.tag) : null, flash: null });
    var shot = u.step === 'photo' ? '<div class="frame34">Point at the whole saree</div>' : '<img src="' + esc(u.img) + '" alt="The photo just taken">' + (u.flash ? '<div class="flash-ok"><span>' + icon('check') + esc(u.flash) + '</span></div>' : '');
    var bottom = u.step === 'photo'
      ? '<button type="button" class="shutter" data-shutter aria-label="Take photo"></button><p style="text-align:center;font-size:12.5px;margin:.1rem 0 0;opacity:.8">' + (u.tag ? 'Tag ' + esc(u.tag) + ' is ready: take the saree\'s photo.' : 'Step 1: take the saree\'s photo') + '</p>'
      : viewfinder('Step 2: scan this saree\'s tag') + '<div class="scan-ctrls" style="grid-template-columns:1fr 1fr"><button type="button" class="btn" data-retake style="--btn-bg:rgba(255,255,255,.14);--btn-fg:#fff;--btn-bd:rgba(255,255,255,.3)">' + icon('camera', 'icon-sm') + 'Retake</button><button type="button" class="btn" data-type style="--btn-bg:rgba(255,255,255,.14);--btn-fg:#fff;--btn-bd:rgba(255,255,255,.3)">' + icon('keyboard', 'icon-sm') + 'Type</button></div>' + mockbar([['free', 'Free tag'], ['used', 'Used tag'], ['sold', 'Sold tag']]);
    return {
      html: '<section class="flow">' + flowTop('Quick add', esc(x.s.name) + ' · ' + CH[demo.ch], iconBtn('x', 'data-done', 'Done'), '<button type="button" class="btn btn-sm btn-ghost" data-done style="margin-right:6px">Done</button>') +
        '<div class="flow-body" style="padding-top:6px"><div class="qcam"><div class="stepline"><span' + (u.step === 'photo' ? ' class="on"' : '') + '>1 Photo</span><span' + (u.step === 'tag' ? ' class="on"' : '') + '>2 Tag</span></div><div class="shot">' + shot + '<span class="count">' + plural(u.count, 'saree') + ' added</span></div><div class="bottom">' + bottom + '</div></div></div></section>',
      mount: function (el) {
        var sh = el.querySelector('[data-shutter]');
        sh && sh.addEventListener('click', function () {
          u.img = nextGalleryPhoto();
          if (u.tag) { var t = u.tag; u.tag = null; u.step = 'tag'; render(); return accept(t); }
          u.step = 'tag'; render();
        });
        var rt = el.querySelector('[data-retake]'); rt && rt.addEventListener('click', function () { u.step = 'photo'; render(); });
        var ty = el.querySelector('[data-type]'); ty && ty.addEventListener('click', function () { typeSheet('Type the tag number', accept); });
        el.querySelectorAll('[data-done]').forEach(function (d) { d.addEventListener('click', function () { ui.quick = undefined; go('subproducts?id=' + x.s.id); if (u.count) afterNav(function () { toast(plural(u.count, 'saree') + ' added to ' + x.s.name, true); }, 300); }); });
        el.querySelectorAll('[data-fake]').forEach(function (f) { f.addEventListener('click', function () {
          var k = f.dataset.fake;
          accept(k === 'free' ? nextFree() : k === 'sold' ? 'NH6' : (function () { var a = active().filter(function (q) { return q.id === '630692a8'; })[0]; return a && shownTags(a)[0].st === 'in_stock' ? shownTags(a)[0].code : 'NH4'; })());
        }); });
      }
    };
    function accept(code) {
      var r = checkTag(code);
      if (!r.ok) return tagProblem(r, code, u.img, null);
      // Saved in the background: the camera is ready for the next saree at once.
      var b = { sub: x.s.id, ch: demo.ch };
      if (demo.queue && !demo.queue.done) demo.queue.items.push({ img: u.img, tag: code, st: 'wait' }); else startQueue(b, [{ img: u.img, tag: code }]);
      u.count++; u.flash = code; save(); render();
      after(function () { u.flash = null; u.step = 'photo'; render(); toast(offline() ? 'Kept on this phone · uploads when online' : 'Saving · ' + code, true); }, 750);
    }
  };

  S.scanfind = function () {
    return {
      html: '<section class="flow">' + flowTop('Scan to find', 'Scan any saree\'s tag', iconBtn('back', 'data-back', 'Back')) +
        '<div class="flow-body"><div class="scan-a"><div class="viewfinder" style="flex:1;height:auto;min-height:260px"><div class="frame" style="height:34%">' + icon('barcode') + '<span class="laser"></span></div><span class="hint">Point at the tag</span></div>' +
        '<div class="scan-ctrls" style="grid-template-columns:1fr 1fr"><button type="button" class="btn" data-type>' + icon('keyboard', 'icon-sm') + 'Type the number</button><button type="button" class="btn" data-torch>' + icon('flash', 'icon-sm') + 'Torch</button></div>' +
        mockbar([['known', 'Tag on a saree'], ['sold', 'Sold saree\'s tag'], ['unknown', 'Unknown tag']]) + '</div></div></section>',
      mount: function (el) {
        el.querySelector('[data-type]').addEventListener('click', function () { typeSheet('Find a saree by tag', find); });
        el.querySelector('[data-torch]').addEventListener('click', function () { toast('Torch on (pretend)'); });
        el.querySelectorAll('[data-fake]').forEach(function (f) { f.addEventListener('click', function () { var k = f.dataset.fake; find(k === 'known' ? 'NH2264' : k === 'sold' ? 'NH6' : nextFree()); }); });
      }
    };
    function find(code) {
      if (offline()) return toast(netToast());
      var f = findTag(code);
      if (f && f.p.status === 'active') return go('product?id=' + f.p.id);
      sheet('<div class="dlg-ico" style="width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--info-soft);color:var(--info);margin-bottom:.6rem">' + icon('barcode') + '</div><h2>No saree has ' + esc(code) + '</h2><p>It\'s a new tag. Add a new saree with it?</p>' +
        '<div class="acts"><button type="button" class="btn btn-primary btn-block" data-addnew>' + icon('plus', 'icon-sm') + 'Add a new saree with ' + esc(code) + '</button><button type="button" class="btn btn-ghost btn-block" data-close>Scan another</button></div>', function (el, close) {
        el.querySelector('[data-addnew]').addEventListener('click', function () { close(); go('addpick?tag=' + code); });
      });
    }
  };

  function gone() { return { html: '<section class="scr">' + topBar('', 'products') + '<div class="scr-body narrow">' + alertBox('info', 'Not here any more', 'This saree was deleted. Bills and reports still show it.') + '</div></section>' }; }

  /* ===== Saree page ===== */
  S.product = function (p) {
    var demoKind = p.demo; stripDemo();
    var pr = prod(p.id);
    if (!pr || pr.status !== 'active') return gone();
    var x = sub(pr.sub), ts = shownTags(pr), pc = off(x.s.mrp, x.s.online), web = webState(pr);
    if (state === 'loading') return { html: '<section class="scr">' + topBar('', 'history') + '<div class="scr-body narrow"><div class="pphoto"><div class="main skeleton"></div></div>' + skelRows(3) + '</div></section>' };
    if (state === 'error') return { html: '<section class="scr">' + topBar('', 'history') + '<div class="scr-body narrow">' + alertBox('error', 'Couldn\'t load this saree', 'Check your connection and try again.') + '</div></section>' };
    var extra = pr.imgs.slice(1);
    var tagRows = ts.map(function (t) {
      var s = tagState(pr, t);
      return '<button type="button" class="row tagrow' + (t.st === 'retired' ? ' retired' : '') + '" data-tag="' + esc(t.code) + '"><span class="bc">' + icon(t.st === 'retired' ? 'broken' : 'barcode') + '</span><span class="grow"><span class="code">' + esc(t.code) + '</span><span class="st-line"><span class="badge ' + s[1] + '">' + esc(s[0]) + '</span></span></span>' + icon('right', 'chev') + '</button>';
    }).join('');
    var live = ts.filter(function (t) { return t.st !== 'retired'; }).length;
    var d = pr.details || {}, dsum = Object.keys(d).filter(function (k) { return d[k] && (!Array.isArray(d[k]) || d[k].length); }).map(function (k) { return Array.isArray(d[k]) ? d[k].join(', ') : d[k]; }).join(' · ');
    return {
      html: '<section class="scr">' + topBar('Saree', 'history') + '<div class="scr-body narrow">' +
        '<div class="pphoto"><div class="main">' + (pr.imgs[0] ? '<img src="' + esc(pr.imgs[0]) + '" alt="Main photo">' : icon('image', 'icon-xl')) + '</div><div class="side">' +
        extra.map(function (src) { return '<button type="button" class="mini" data-go="photos?id=' + pr.id + '" style="border-style:solid"><img src="' + esc(src) + '" alt="Extra photo"></button>'; }).join('') +
        (pr.imgs.length < MAX_PHOTOS ? '<button type="button" class="mini" data-go="photos?id=' + pr.id + '" aria-label="Add photos">' + icon('plus') + '</button>' : '') +
        (pr.imgs.length ? '' : '<span class="badge badge-warning">No photo: add one</span>') + '</div></div>' +
        '<div class="pmeta"><span class="res-cat">' + esc(x.c.name) + '</span><h2>' + esc(pname(pr)) + '</h2><span class="sku">' + esc(pr.sku) + '</span><span class="by">Added ' + esc(dayText(pr.at)) + ' by ' + esc(pr.by) + '</span></div>' +
        '<div class="pbadges">' + stockBadge(pr) + '<span class="badge badge-info">' + CH[pr.ch] + '</span>' + (pr.feat ? '<span class="badge badge-new">Best Seller</span>' : '') + '</div>' +
        '<div class="web-line">' + icon(web[0] ? 'check' : 'eyeoff') + '<span>' + web[1] + '</span></div>' +
        (pr.old !== pname(pr) ? '<p class="field-hint" style="margin:.45rem .25rem 0">The old app showed it as "' + esc(pr.old) + '". The name now follows its subcategory.</p>' : '') +
        '<div class="list-title">' + (ts.length > 1 ? 'Tags · ' + live : 'Tag') + '</div><div class="list">' + tagRows + '</div>' +
        (ts.length > 1 && live > 1 ? '<p class="field-hint" style="margin:.4rem .25rem 0">From the old app: this listing has ' + live + ' tags. New sarees get one tag each.</p>' : '') +
        '<div class="list-title">Price · from the subcategory</div><div class="price-grid"><div><small>Store</small><b>' + rs(x.s.store) + '</b></div><div><small>Website</small><b>' + rs(x.s.online) + '</b></div><div><small>MRP</small>' + (x.s.mrp ? '<b class="strike">' + rs(x.s.mrp) + '</b>' + (pc ? '<span class="off">' + pc + '% off</span>' : '') : '<b style="color:var(--muted)">—</b>') + '</div></div>' +
        '<p class="field-hint" style="margin:.4rem .25rem 0">' + (owner() ? 'Change prices for all ' + esc(x.s.name) + ' in Catalogue.' : 'Prices are set by owners in the Catalogue.') + '</p>' +
        '<div class="list-title">Selling</div><div class="list">' +
        '<button type="button" class="row" data-ch><span class="tile">' + icon('eye2') + '</span><span class="grow"><b>Where it sells</b><span>' + CH[pr.ch] + '</span></span>' + icon('right', 'chev') + '</button>' +
        '<label class="row" style="cursor:pointer"><span class="tile">' + icon('star') + '</span><span class="grow"><b>Best Seller</b><span>Shown in the website\'s Best Sellers</span></span><span class="switch"><input type="checkbox" data-feat ' + (pr.feat ? 'checked' : '') + ' aria-label="Best Seller"><span></span></span></label></div>' +
        '<div class="list-title">More</div><div class="list">' +
        '<button type="button" class="row" data-go="details?id=' + pr.id + '"><span class="tile">' + icon('sliders') + '</span><span class="grow"><b>Details</b><span>' + (dsum ? esc(dsum) : 'Optional: colour, fabric, border, occasion…') + '</span></span>' + icon('right', 'chev') + '</button>' +
        '<button type="button" class="row" data-go="photos?id=' + pr.id + '"><span class="tile">' + icon('image') + '</span><span class="grow"><b>Photos</b><span>' + pr.imgs.length + ' of ' + MAX_PHOTOS + '</span></span>' + icon('right', 'chev') + '</button>' +
        '<button type="button" class="row" data-go="move?id=' + pr.id + '"><span class="tile">' + icon('move') + '</span><span class="grow"><b>Move to another subcategory</b><span>Name and price change with it</span></span>' + icon('right', 'chev') + '</button></div>' +
        '<div class="list-title">History</div><div class="list hist">' + pr.log.slice(0, 5).map(function (h) { return '<div class="row"><span class="tile">' + icon('history') + '</span><span class="grow"><b class="chg">' + esc(h.text) + '</b><span>' + esc(h.at) + ' · ' + esc(h.by) + '</span></span></div>'; }).join('') + '</div>' +
        '<div style="height:1.4rem"></div><button type="button" class="btn btn-danger btn-block" data-del>' + icon('trash') + 'Delete saree</button>' +
        '</div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-tag]').forEach(function (b) { b.addEventListener('click', function () { tagSheet(pr, ts.filter(function (t) { return t.code === b.dataset.tag; })[0]); }); });
        el.querySelector('[data-ch]').addEventListener('click', function () { chSheet(pr); });
        var f = el.querySelector('[data-feat]'); f.addEventListener('change', function () { var on = f.checked; api.setFeat(pr, on).then(function () { render(); toast(on ? 'Best Seller on' : 'Best Seller off', true); }, function () { f.checked = !on; toast(netToast()); }); });
        el.querySelector('[data-del]').addEventListener('click', function () { delSaree(pr); });
        var first = ts.filter(function (t) { return t.st !== 'retired'; })[0];
        if (demoKind === 'change' && first) after(function () { changeFlow(pr, first); }, 350);
        if (demoKind === 'damaged' && first) after(function () { replaceFlow(pr, first); }, 350);
        if (demoKind === 'saree' && first) after(function () { damagedFlow(pr, first); }, 350);
        if (demoKind === 'delete' || demoKind === 'held') after(function () { delSaree(pr); }, 350);
        if (state === 'popup' && first) after(function () { tagSheet(pr, first); }, 300);
      }
    };
  };

  function tagSheet(pr, t) {
    var s = tagState(pr, t), sold = /^sold/.test(t.st), held = t.st === 'reserved', retired = t.st === 'retired', dmg = t.st === 'damaged';
    var live = shownTags(pr).filter(function (x) { return x.st !== 'retired'; }).length;
    var lock = sold ? 'Sold' + (t.soldAt ? ' on ' + dayText(t.soldAt) : '') + '. A sold saree\'s tag can\'t be changed.' : held ? 'A customer is paying for it online (order ' + esc(pr.order || '') + ') until ' + esc(pr.holdUntil || 'soon') + '. Try again after that.' : retired ? 'This tag was damaged and replaced' + (t.retiredAt ? ' (' + t.retiredAt + ')' : '') + '. Its number can\'t be used again.' : '';
    function act(k, ic, title, text, dis, danger) { return '<button type="button" class="act-row' + (danger ? ' danger' : '') + '" data-a="' + k + '"' + (dis ? ' disabled' : '') + '><span class="tile">' + icon(ic) + '</span><span><b>' + title + '</b><span>' + text + '</span></span></button>'; }
    var locked = sold || held || retired;
    sheet('<div class="bigtag">' + esc(t.code) + '</div><p style="text-align:center;margin:0"><span class="badge ' + s[1] + '">' + esc(s[0]) + '</span></p>' +
      (lock ? '<div class="lock-note">' + icon('lock') + '<span>' + lock + '</span></div>' : '') +
      (retired ? '' : '<div class="sheet-acts">' +
        (dmg ? act('back', 'refresh', 'Back in stock', 'The saree is fine again: it sells again.') :
          act('change', 'edit', 'Change tag', 'Wrong tag on this saree? Scan the right one.', locked) +
          act('replace', 'broken', 'Tag damaged', 'Torn, faded or won\'t scan? Put on a new tag.', locked) +
          act('saree', 'alertc', 'Saree damaged', 'Not for sale: off the website and the counter.', locked, true) +
          (live > 1 ? act('remove', 'trash', 'Remove this tag', 'Only if it was added by mistake and never sold.', locked, true) : '')) + '</div>') +
      '<div class="acts"><button type="button" class="btn btn-ghost btn-block" data-close>Close</button></div>', function (el, close) {
      el.querySelectorAll('[data-a]').forEach(function (b) { b.addEventListener('click', function () {
        close(); var k = b.dataset.a;
        if (k === 'change') changeFlow(pr, t);
        if (k === 'replace') replaceFlow(pr, t);
        if (k === 'saree') damagedFlow(pr, t);
        if (k === 'back') api.damaged(pr, t, false).then(function () { render(); toast('Back in stock · selling again', true); }, function () { toast(netToast()); });
        if (k === 'remove') dialog({ tone: 'danger', icon: 'trash', title: 'Remove ' + t.code + '?', text: 'Use this only if the tag was added to this listing by mistake. ' + t.code + ' becomes free to use on another saree.', actions: [{ label: 'Remove tag', kind: 'btn-danger-solid', fn: function () { api.removeTag(pr, t).then(function () { render(); toast(t.code + ' removed', true); }, function () { toast(netToast()); }); } }, { label: 'Cancel' }] });
      }); });
    });
  }
  // A small scanner in a sheet, for changing or replacing a tag.
  function scanSheet(title, text, onCode, ignoreTag, note) {
    sheet('<h2>' + title + '</h2><p>' + text + '</p>' + (note ? '<div class="lock-note" style="margin-top:.4rem">' + icon('info') + '<span>' + note + '</span></div>' : '') +
      '<div style="margin-top:.75rem">' + viewfinder('Point at the new tag') + '</div><div data-msg></div>' +
      '<div style="margin-top:.6rem">' + mockbar([['free', 'Free tag'], ['used', 'Used tag'], ['sold', 'Sold tag']]) + '</div>' +
      '<div class="acts"><button type="button" class="btn btn-block" data-typeit>' + icon('keyboard', 'icon-sm') + 'Type the number</button><button type="button" class="btn btn-ghost btn-block" data-close>Cancel</button></div>', function (el, close) {
      function tryCode(code) {
        var r = checkTag(code, undefined, ignoreTag), msg = el.querySelector('[data-msg]');
        if (!r.ok) {
          var why = r.kind === 'other' ? code + ' is already on ' + esc(pname(r.p)) + ' (' + esc(r.p.sku) + '). Each tag can be on one saree only.' : r.kind === 'sold' ? code + ' was sold on ' + dayText(r.t.soldAt) + '. It can\'t be used again.' : r.kind === 'retired' ? code + ' was retired (damaged tag).' : r.kind === 'queue' ? code + ' is on a saree being saved right now.' : 'That doesn\'t look like a tag.';
          msg.innerHTML = '<div style="margin-top:.6rem">' + alertBox('error', code + ' can\'t be used', why) + '</div>'; return;
        }
        close(); onCode(code, r);
      }
      el.querySelectorAll('[data-fake]').forEach(function (f) { f.addEventListener('click', function () {
        var k = f.dataset.fake;
        tryCode(k === 'free' ? nextFree() : k === 'sold' ? 'NH6' : 'NH4');
      }); });
      el.querySelector('[data-typeit]').addEventListener('click', function () { close(); typeSheet(title, function (c) { var r = checkTag(c, undefined, ignoreTag); if (!r.ok) { return tagProblem(r, c, null, null); } onCode(c, r); }); });
    });
  }
  function changeFlow(pr, t) {
    if (offline()) return toast(netToast());
    scanSheet('Change tag ' + t.code, 'Scan the right tag for this saree.', function (code) {
      dialog({ tone: 'info', icon: 'edit', title: 'Change the tag?', html: '<div class="swap">' + tagchip(t.code, 'sold') + icon('right') + tagchip(code, 'ok') + '</div><p>' + t.code + ' becomes free, so it can go on its real saree.</p>',
        actions: [{ label: 'Change to ' + code, kind: 'btn-primary', keep: true, fn: function (b, close) { b.classList.add('is-loading'); api.changeTag(pr, t, code).then(function (r) { close(); render(); toast('Tag changed · ' + r.old + ' is free again', true); }, function () { close(); toast(netToast()); }); } }, { label: 'Cancel' }] });
    }, t);
  }
  function replaceFlow(pr, t) {
    if (offline()) return toast(netToast());
    scanSheet('Replace damaged tag ' + t.code, 'Stick a new tag on the saree, then scan it.', function (code) {
      dialog({ tone: 'warning', icon: 'broken', title: 'Replace the tag?', html: '<div class="swap">' + tagchip(t.code, 'sold') + icon('right') + tagchip(code, 'ok') + '</div><p>' + t.code + ' is <b>retired</b>: it can never be used again, so an old torn sticker can\'t be mixed up with another saree.</p>',
        actions: [{ label: 'Replace with ' + code, kind: 'btn-primary', keep: true, fn: function (b, close) { b.classList.add('is-loading'); api.replaceTag(pr, t, code).then(function (r) { close(); render(); toast('New tag ' + code + ' · ' + r.old + ' retired', true); }, function () { close(); toast(netToast()); }); } }, { label: 'Cancel' }] });
    }, null, 'Same number printed again? Just stick it on: nothing to change here.');
  }
  function damagedFlow(pr, t) {
    dialog({ tone: 'danger', icon: 'alertc', title: 'Saree damaged?', text: 'It stops selling: off the website and the counter. Its tag ' + t.code + ' stays with it. You can undo this with Back in stock.',
      actions: [{ label: 'Mark damaged', kind: 'btn-danger-solid', keep: true, fn: function (b, close) { b.classList.add('is-loading'); api.damaged(pr, t, true).then(function () { close(); render(); toast('Marked damaged · not for sale', true); }, function () { close(); toast(netToast()); }); } }, { label: 'Cancel' }] });
  }
  function chSheet(pr) {
    sheet('<h2>Where it sells</h2><p>Only this saree. New batches choose it on the Start screen.</p><div class="sheet-acts">' + Object.keys(CH).map(function (k) {
      return '<button type="button" class="act-row" data-ch="' + k + '"' + (pr.ch === k ? ' style="border-color:var(--primary)"' : '') + '><span class="tile">' + icon(k === 'both' ? 'layers' : k === 'online_only' ? 'cloud' : 'home') + '</span><span><b>' + CH[k] + (pr.ch === k ? ' ✓' : '') + '</b><span>' + { both: 'Website and the counter', online_only: 'Website only, not sold at the counter', store_only: 'Counter only, not on the website' }[k] + '</span></span></button>';
    }).join('') + '</div><div class="acts"><button type="button" class="btn btn-ghost btn-block" data-close>Cancel</button></div>', function (el, close) {
      el.querySelectorAll('[data-ch]').forEach(function (b) { b.addEventListener('click', function () { close(); var k = b.dataset.ch; if (k === pr.ch) return; api.setCh(pr, k).then(function () { render(); toast('Now: ' + CH[k], true); }, function () { toast(netToast()); }); }); });
    });
  }
  function delSaree(pr) {
    var held = pr.tags.some(function (t) { return t.st === 'reserved'; });
    if (held) return dialog({ tone: 'warning', icon: 'clock', title: 'Can\'t delete right now', text: 'A customer is paying for this saree online (order ' + esc(pr.order || '') + ') until ' + esc(pr.holdUntil || 'soon') + '. Try again after the checkout ends.', actions: [{ label: 'OK', kind: 'btn-primary' }] });
    var unsold = shownTags(pr).filter(function (t) { return t.st === 'in_stock' || t.st === 'damaged'; }).map(function (t) { return t.code; });
    var sold = shownTags(pr).some(function (t) { return /^sold/.test(t.st); });
    dialog({ tone: 'danger', icon: 'trash', title: 'Delete this saree?', html: '<p>It disappears from the app, the website and the counter. It isn\'t erased' + (sold ? ': its sale stays in the bills and reports' : '') + '.</p>' + (unsold.length ? '<p>' + unsold.join(', ') + (unsold.length > 1 ? ' become' : ' becomes') + ' free to use on another saree.</p>' : ''),
      actions: [{ label: 'Delete', kind: 'btn-danger-solid', keep: true, fn: function (b, close) { b.classList.add('is-loading'); api.remove(pr).then(function (r) { close(); if (r.error) return toast('Held by an online order'); go('products'); afterNav(function () { toast('Deleted' + (r.freed.length ? ' · ' + r.freed.join(', ') + ' free again' : ''), true); }, 300); }, function () { close(); toast(netToast()); }); } }, { label: 'Cancel' }] });
  }

  S.move = function (p) {
    var pr = prod(p.id); if (!pr || pr.status !== 'active') return gone();
    var x = sub(pr.sub), u = ui.move || (ui.move = { q: '' });
    function body() {
      var q = u.q.trim().toLowerCase();
      var list = SUB_LIST.filter(function (y) { return y.s.id !== pr.sub && (!q || y.s.name.toLowerCase().indexOf(q) >= 0); });
      return list.length ? '<div class="list">' + list.slice(0, 40).map(function (y) { return '<button type="button" class="row srow" data-to="' + y.s.id + '">' + thumb(y.s.img) + '<span class="grow"><span class="res-cat">' + esc(y.c.name) + '</span><b>' + esc(y.s.name) + '</b></span><span class="prices"><b>' + rs(y.s.store) + '</b><span>Web ' + rs(y.s.online) + '</span></span></button>'; }).join('') + '</div>' : emptyCard('search', 'No subcategory matches', 'Try another word.');
    }
    return {
      html: '<section class="scr">' + topBar('Move saree', 'history') + '<div class="scr-body narrow">' +
        '<div class="sub-card">' + pthumb(pr.imgs[0]) + '<span class="grow"><span class="res-cat">Now in</span><b>' + esc(x.s.name) + '</b><span>' + esc(pr.sku) + ' · ' + rs(x.s.store) + '</span></span></div>' +
        '<p class="field-hint" style="margin:.5rem .25rem .8rem">Its name and price change to the new subcategory\'s. Its SKU, tag and web address stay the same.</p>' +
        '<div class="search">' + icon('search') + '<input class="input" type="search" id="mv-q" placeholder="Search subcategories" autocomplete="off" value="' + esc(u.q) + '" aria-label="Search subcategories"></div>' +
        '<div id="mv-body">' + body() + '</div></div></section>',
      mount: function (el) {
        var q = el.querySelector('#mv-q'), box = el.querySelector('#mv-body');
        q.addEventListener('input', function () { u.q = q.value; box.innerHTML = body(); });
        box.addEventListener('click', function (e) {
          var b = e.target.closest('[data-to]'); if (!b) return;
          var y = sub(b.dataset.to);
          dialog({ tone: 'info', icon: 'move', title: 'Move to ' + esc(y.s.name) + '?', html: '<div class="diff"><div class="diff-row"><small>Name</small><span class="v" style="font-size:13px">' + esc(y.s.name) + '</span></div><div class="diff-row"><small>Store price</small><span class="v"><s>' + rs(x.s.store) + '</s>' + icon('right', 'icon-sm') + rs(y.s.store) + '</span></div><div class="diff-row"><small>Website price</small><span class="v"><s>' + rs(x.s.online) + '</s>' + icon('right', 'icon-sm') + rs(y.s.online) + '</span></div></div><p>Customers see the new name and price straight away.</p>',
            actions: [{ label: 'Move', kind: 'btn-primary', keep: true, fn: function (bt, close) { bt.classList.add('is-loading'); api.move(pr, y.s.id).then(function () { close(); ui.move = undefined; done(); afterNav(function () { toast('Moved to ' + y.s.name, true); }, 300); }, function () { close(); toast(netToast()); }); } }, { label: 'Cancel' }] });
        });
      }
    };
  };

  // Choices are sample values; the real list follows the website's filters.
  var DETAILS = [
    ['color', 'Colour', ['Red', 'Maroon', 'Pink', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Black', 'White', 'Cream', 'Multi']],
    ['fabric', 'Fabric', ['Pattu', 'Pattu by cotton', 'Cotton', 'Silk cotton']],
    ['borderStyle', 'Border', ['Gap border', 'Temple', 'Rangoli', 'Ikkath', 'Zari', 'Plain']],
    ['technique', 'Technique', ['Handloom', 'Screen print', 'Digital print', 'Bandini', 'Applique', 'Embroidery', 'Kalamkari']],
    ['blouseType', 'Blouse', ['Contrast', 'Running', 'Embroidered', 'None']],
    ['zariTier', 'Zari', ['None', 'Tested', 'Silver', 'Gold']],
    ['occasion', 'Occasion (pick any)', ['Daily', 'Office', 'Festive', 'Wedding', 'Party'], true]
  ];
  S.details = function (p) {
    var pr = prod(p.id); if (!pr || pr.status !== 'active') return gone();
    var u = ui.details || (ui.details = { d: JSON.parse(JSON.stringify(pr.details || {})) });
    return {
      html: '<section class="scr">' + topBar('Details', 'history') + '<div class="scr-body narrow"><p class="scr-lead" style="margin-top:0">All optional. The website\'s filters use them. Never asked while adding sarees.</p>' +
        DETAILS.map(function (g) {
          var v = u.d[g[0]];
          return '<div class="field"><span class="field-label">' + g[1] + '</span><div class="chipsel" role="group" aria-label="' + g[1] + '">' + g[2].map(function (c) { var on = g[3] ? (v || []).indexOf(c) >= 0 : v === c; return '<button type="button" data-k="' + g[0] + '" data-v="' + c + '" aria-pressed="' + on + '">' + c + '</button>'; }).join('') + '</div></div>';
        }).join('') + '<p class="field-hint">Sample choices: the real lists follow the website\'s filters.</p>' +
        '</div><div class="scr-foot" style="padding-bottom:104px"><button type="button" class="btn btn-primary btn-block" data-save>Save details</button></div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-k]').forEach(function (b) { b.addEventListener('click', function () {
          var k = b.dataset.k, v = b.dataset.v, multi = k === 'occasion';
          if (multi) { var a = u.d[k] || []; var i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); u.d[k] = a; } else u.d[k] = u.d[k] === v ? null : v;
          var top = el.querySelector('.scr-body').scrollTop; render(); viewport.querySelector('.scr-body').scrollTop = top;
        }); });
        el.querySelector('[data-save]').addEventListener('click', function (e) { e.currentTarget.classList.add('is-loading'); api.details(pr, u.d).then(function () { ui.details = undefined; done(); afterNav(function () { toast('Details saved', true); }, 300); }, function () { render(); toast(netToast()); }); });
      }
    };
  };

  S.photos = function (p) {
    var pr = prod(p.id); if (!pr || pr.status !== 'active') return gone();
    var u = ui.photos || (ui.photos = { imgs: pr.imgs.slice() });
    return {
      html: '<section class="scr">' + topBar('Photos', 'history') + '<div class="scr-body narrow"><p class="scr-lead" style="margin-top:0">Up to ' + MAX_PHOTOS + '. The first is the main photo: the list, the website card and the PDF use it. The website shows the others on the saree\'s page.</p><div class="phgrid">' +
        u.imgs.map(function (src, i) { return '<div class="phcell"><div class="ph"><img src="' + esc(src) + '" alt="Photo ' + (i + 1) + '"></div>' + (i === 0 ? '<span class="lbl badge badge-new">Main</span>' : '') + '<div class="acts"><button type="button" data-main="' + i + '" aria-label="Make photo ' + (i + 1) + ' the main one"' + (i === 0 ? ' disabled style="opacity:.3"' : '') + '>' + icon('star') + '</button><button type="button" data-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">' + icon('trash') + '</button></div></div>'; }).join('') +
        (u.imgs.length < MAX_PHOTOS ? '<button type="button" class="phadd" data-add>' + icon('plus') + 'Add photo</button>' : '') + '</div>' +
        '<p class="field-hint" style="margin-top:.8rem">Each photo is stored small (80 KB or less) with location removed.</p>' +
        '</div><div class="scr-foot" style="padding-bottom:104px"><button type="button" class="btn btn-primary btn-block" data-save>Save photos</button></div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-main]').forEach(function (b) { b.addEventListener('click', function () { var i = +b.dataset.main; var s = u.imgs.splice(i, 1)[0]; u.imgs.unshift(s); render(); }); });
        el.querySelectorAll('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { if (u.imgs.length === 1) return toast('A saree needs at least one photo. Add another first.'); u.imgs.splice(+b.dataset.rm, 1); render(); }); });
        var a = el.querySelector('[data-add]');
        a && a.addEventListener('click', function () {
          sheet('<h2>Add a photo</h2><p>Border, pallu or blouse close-ups help customers.</p><div class="photo-src" style="margin-top:.75rem"><button type="button" class="btn" data-src>' + icon('camera', 'icon-sm') + 'Take photo</button><button type="button" class="btn" data-src>' + icon('image', 'icon-sm') + 'Choose from gallery</button></div><div class="acts"><button type="button" class="btn btn-ghost btn-block" data-close>Cancel</button></div>', function (sh, close) {
            sh.querySelectorAll('[data-src]').forEach(function (s) { s.addEventListener('click', function () { close(); u.imgs.push(nextGalleryPhoto()); render(); toast('Photo added (sample). Press Save.'); }); });
          });
        });
        el.querySelector('[data-save]').addEventListener('click', function (e) { e.currentTarget.classList.add('is-loading'); api.photos(pr, u.imgs.slice()).then(function () { ui.photos = undefined; done(); afterNav(function () { toast('Photos saved', true); }, 300); }, function () { render(); toast(netToast()); }); });
      }
    };
  };

  /* ================= Render ================= */
  var FULL = { gallery: 1, scan: 1, review: 1, crop: 1, saving: 1, quick: 1, scanfind: 1 };
  function bindGo(scope) {
    scope.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.go); }); });
    scope.querySelectorAll('[data-back]').forEach(function (b) { b.addEventListener('click', back); });
  }
  function render() {
    timers.forEach(function (t) { clearTimeout(t); }); timers = [];
    closers = [];
    Array.prototype.slice.call(overlays.children).forEach(function (c) { if (!c.classList.contains('app-toast')) c.remove(); });
    var name = current.name, fn = S[name] || S.products;
    var scr = fn(current.params || {});
    var full = FULL[name];
    viewport.innerHTML = full ? scr.html : shell(scr.html);
    var el = viewport.querySelector('.scr, .flow') || viewport.firstElementChild;
    bindGo(viewport);
    viewport.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { var t = b.dataset.tab; if (t === 'products') go('products'); else if (t === 'scan') toast('Scan to sell is Module 5'); else if (t === 'more') toast('More was built in Modules 1–3'); else toast('This tab is a later module'); }); });
    scr.mount && scr.mount(el);
    var spec = window.NH_SCREENS.filter(function (s) { return NH_ROUTE(s).split('?')[0] === name; });
    if (state !== 'normal' && spec.length && !spec.some(function (s) { return s.states.indexOf(state) >= 0; })) NH.toast('"' + state + '" isn\'t a state of this screen. Try: ' + (spec.map(function (s) { return s.states.join(', '); }).filter(Boolean).join(', ') || 'none'));
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && closers.length) { closers[closers.length - 1](); e.stopPropagation(); } });

  window.NHApp = {
    setState: function (s) { state = s; ui[current.name] = undefined; ui.failMade = false; render(); },
    go: go,
    action: function (name) { if (name === 'reset') { demo = freshDemo(); save(); ui = {}; go('products'); } }
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
    setInterval(tick, 550);
    onRoute();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
