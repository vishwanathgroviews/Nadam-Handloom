/* Website mock-up: the core. Live catalogue data (NH_DATA), the visitor's bag, wishlist and
   sample account (kept in this browser), the page router, header, footer, drawers, search,
   carousels and scroll animations. Pages are added by site-shop.js, site-account.js and
   site-info.js through Site.page(name, fn). */
(function () {
  'use strict';
  var NH = window.NH, D = window.NH_DATA;
  var Site = window.Site = {};
  var icon = NH.icon;
  var EMBED = /[?&]embed=1/.test(location.search);

  /* ---------- Catalogue helpers (real data) ---------- */
  var COL = {}, CAT = {}, PROD = {}, CRAFT = {};
  D.collections.forEach(function (c) { COL[c.id] = c; });
  D.categories.forEach(function (c) { CAT[c.slug] = c; });
  D.products.forEach(function (p) { PROD[p.slug] = p; });
  D.crafts.forEach(function (c) { CRAFT[c.key] = c; });
  Site.D = D; Site.col = function (id) { return COL[id]; }; Site.cat = function (s) { return CAT[s]; };
  Site.prod = function (slug) { return PROD[slug]; }; Site.craft = function (k) { return CRAFT[k]; };
  Site.colOf = function (p) { return COL[p.col]; };
  Site.priceOf = function (p) { return COL[p.col].price; };
  Site.shownCats = D.categories.filter(function (c) { return c.shown; });
  // Newest first; a listing whose photo is the shop logo goes last (data fix on the start page).
  Site.byNewest = D.products.slice().sort(function (a, b) { return (a.logo ? 1 : 0) - (b.logo ? 1 : 0) || (a.at < b.at ? 1 : a.at > b.at ? -1 : 0); });
  Site.label = function (c) { return c.craft ? CRAFT[c.craft].name : CAT[c.cat].name; };
  var INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  Site.rs = function (v) { return '₹' + INR.format(Math.round(v)); };
  Site.num = function (v) { return INR.format(v); };
  Site.esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  Site.plural = function (n, a, b) { return Site.num(n) + ' ' + (n === 1 ? a : (b || a + 's')); };
  var esc = Site.esc, rs = Site.rs;

  /* ---------- The visitor's state (this browser only) ---------- */
  var KEY = 'nh-web-state';
  function sampleState() {
    var pick = function (i) { return Site.byNewest[i % Site.byNewest.length].slug; };
    var addresses = [
      { id: 'a1', name: 'Priya Sharma', phone: '98765 43210', line1: 'Flat 302, Sri Sai Residency', line2: 'Road No. 12, Banjara Hills', city: 'Hyderabad', state: 'Telangana', pin: '500034', tag: 'Home' },
      { id: 'a2', name: 'Priya Sharma', phone: '98765 43210', line1: 'Plot 18, Cyber Towers Lane', line2: 'HITEC City, Madhapur', city: 'Hyderabad', state: 'Telangana', pin: '500081', tag: 'Office' }
    ];
    var orders = [
      { no: 'NH51204488', date: '2026-10-14', status: 'processing', items: [{ slug: pick(2), qty: 1 }], addr: 'a1', awb: null, pay: 'UPI' },
      { no: 'NH50937716', date: '2026-10-09', status: 'shipped', items: [{ slug: pick(5), qty: 1 }, { slug: pick(9), qty: 1 }], addr: 'a2', awb: 'D58291746', pay: 'Card' },
      { no: 'NH48213097', date: '2026-09-28', status: 'delivered', items: [{ slug: pick(14), qty: 2 }], addr: 'a1', awb: 'D57730415', pay: 'UPI' }
    ];
    return { bag: [], wish: [pick(3), pick(7)], recent: [], addresses: addresses, orders: orders, user: { first: 'Priya', last: 'Sharma', phone: '98765 43210', state: 'Telangana', pin: '500034' } };
  }
  var S = NH.store.read(KEY, null) || sampleState();
  function save() { NH.store.write(KEY, S); }
  Site.S = function () { return S; };
  Site.save = save;
  Site.signedIn = function () { return !!NH.flags().signedIn; };
  Site.reset = function () { S = sampleState(); save(); NH.setFlag('signedIn', false); state = 'normal'; render(); };
  Site.bagCount = function () { return S.bag.reduce(function (n, l) { return n + l.qty; }, 0); };
  Site.bagLines = function () { return S.bag.map(function (l) { var p = PROD[l.slug]; return p ? { p: p, qty: l.qty, price: Site.priceOf(p) } : null; }).filter(Boolean); };
  Site.bagTotal = function () { return Site.bagLines().reduce(function (n, l) { return n + l.qty * l.price; }, 0); };
  Site.addToBag = function (slug, qty, quiet) {
    var p = PROD[slug]; if (!p) return;
    var l = S.bag.filter(function (x) { return x.slug === slug; })[0];
    var max = p.avail;
    if (l) l.qty = Math.min(max, l.qty + (qty || 1)); else S.bag.push({ slug: slug, qty: Math.min(max, qty || 1) });
    save(); paintCount(true);
    if (!quiet) Site.toast('<img src="' + p.img + '" alt="">' + '<span>Added to your bag</span><a href="#/bag" data-open-bag>View bag</a>');
  };
  Site.setQty = function (slug, qty) { var l = S.bag.filter(function (x) { return x.slug === slug; })[0]; if (!l) return; if (qty <= 0) S.bag = S.bag.filter(function (x) { return x !== l; }); else l.qty = Math.min(PROD[slug].avail, qty); save(); paintCount(); };
  Site.toggleWish = function (slug) { var i = S.wish.indexOf(slug); if (i >= 0) S.wish.splice(i, 1); else S.wish.push(slug); save(); return i < 0; };
  Site.seen = function (slug) { S.recent = [slug].concat(S.recent.filter(function (s) { return s !== slug; })).slice(0, 12); save(); };

  /* ---------- Small UI pieces ---------- */
  Site.toast = function (html, ms) {
    var box = document.querySelector('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    var t = document.createElement('div'); t.className = 'toast'; t.innerHTML = /</.test(html) ? html : icon('check') + '<span>' + esc(html) + '</span>';
    box.appendChild(t); setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, ms || 3200);
  };
  var closers = [];
  function closeTop() { var c = closers.pop(); if (c) c(); }
  Site.closeAll = function () { while (closers.length) closeTop(); };
  function layer(html, cls, onMount) {
    var scrim = document.createElement('div'); scrim.className = 'scrim';
    var el = document.createElement('div'); el.innerHTML = html; el = el.firstElementChild; if (cls) el.classList.add(cls);
    document.body.appendChild(scrim); document.body.appendChild(el); document.body.style.overflow = 'hidden';
    var prev = document.activeElement;
    function close() { scrim.remove(); el.remove(); closers = closers.filter(function (c) { return c !== close; }); if (!closers.length) document.body.style.overflow = ''; prev && prev.focus && prev.focus(); }
    closers.push(close);
    scrim.addEventListener('click', close);
    el.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); if (e.target.closest('a[href^="#/"]')) close(); });
    var f = el.querySelector('input, button:not([data-close]), a'); setTimeout(function () { f && f.focus({ preventScroll: true }); }, 60);
    onMount && onMount(el, close);
    return close;
  }
  Site.drawer = function (title, body, foot, side, onMount) {
    return layer('<aside class="drawer' + (side === 'left' ? ' left' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="drawer-head"><h3>' + title + '</h3><button type="button" class="btn btn-icon" data-close aria-label="Close">' + icon('x') + '</button></div><div class="drawer-body">' + body + '</div>' + (foot ? '<div class="drawer-foot">' + foot + '</div>' : '') + '</aside>', null, onMount);
  };
  Site.modal = function (html, wide, onMount) {
    return layer('<div class="modal" role="dialog" aria-modal="true"><div class="modal-box' + (wide ? ' wide' : '') + '">' + html + '</div></div>', null, onMount);
  };
  Site.confirm = function (o) {
    var acts = o.actions.map(function (a, i) { return '<button type="button" class="btn ' + (a.kind || '') + '" data-i="' + i + '">' + a.label + '</button>'; }).join('');
    Site.modal('<div style="display:grid;gap:1rem">' + (o.icon ? '<div style="color:var(--' + (o.tone || 'gold') + ')">' + icon(o.icon, 'ico-lg') + '</div>' : '') + '<h3>' + o.title + '</h3><p class="muted">' + o.text + '</p><div style="display:flex;gap:.6rem;flex-wrap:wrap;justify-content:flex-end">' + acts + '</div></div>', false, function (el, close) {
      el.querySelectorAll('[data-i]').forEach(function (b) { b.addEventListener('click', function () { close(); var a = o.actions[+b.dataset.i]; a.fn && a.fn(); }); });
    });
  };
  Site.empty = function (ic, title, text, extra) { return '<div class="empty"><div class="ico-wrap">' + icon(ic) + '</div><h3>' + title + '</h3><p>' + text + '</p>' + (extra || '') + '</div>'; };
  Site.crumbs = function (list) { return '<nav class="crumbs" aria-label="Breadcrumb">' + list.map(function (c, i) { return (i ? '<span aria-hidden="true">/</span>' : '') + (c[1] ? '<a href="#/' + c[1] + '">' + esc(c[0]) + '</a>' : '<span aria-current="page">' + esc(c[0]) + '</span>'); }).join('') + '</nav>'; };
  Site.sample = function (t) { return '<span class="badge badge-sample">' + (t || 'Sample') + '</span>'; };

  /* ---------- Saree card ---------- */
  Site.stockText = function (p) { return p.avail > 1 ? 'Only ' + p.avail + ' left' : p.avail === 1 ? '' : 'Sold out'; };
  Site.card = function (p, i) {
    var c = COL[p.col], wish = S.wish.indexOf(p.slug) >= 0, isNew = Site.byNewest.indexOf(p) < 24;
    return '<article class="pcard reveal" style="--i:' + ((i || 0) % 8) + '"><div class="phbox">' +
      '<a class="ph" href="#/p/' + p.slug + '" aria-label="' + esc(p.name) + ', ' + rs(c.price) + '"><img src="' + p.img + '" alt="' + esc(p.name) + '" loading="lazy"><span class="zoomed" style="background-image:url(' + p.img + ')"></span>' +
      '<span class="tags">' + (isNew ? '<span class="badge badge-accent">New</span>' : '') + (p.avail > 1 ? '<span class="badge badge-gold">Set of ' + p.avail + '</span>' : '') + '</span></a>' +
      '<button type="button" class="wish" data-wish="' + p.slug + '" aria-pressed="' + wish + '" aria-label="' + (wish ? 'Remove from wishlist' : 'Save to wishlist') + '">' + icon('heart', 'ico-sm') + '</button>' +
      '<div class="quick"><button type="button" class="btn btn-sm" data-add="' + p.slug + '">' + icon('bag', 'ico-sm') + 'Add to bag</button></div></div>' +
      '<div class="info"><span class="col">' + esc(Site.label(c)) + '</span><a class="name" href="#/p/' + p.slug + '">' + esc(p.name) + '</a><div class="row"><span class="price">' + rs(c.price) + '</span>' + (p.avail > 1 ? '<span class="stock">' + p.avail + ' in stock</span>' : '<span class="sku">' + esc(p.sku) + '</span>') + '</div></div></article>';
  };
  Site.cardSkel = function (n) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="pcard"><div class="ph skel"></div><div class="skel" style="height:12px;width:60%"></div><div class="skel" style="height:18px;width:85%"></div><div class="skel" style="height:14px;width:30%"></div></div>'; return h; };

  /* A sliding row with arrows, drag and a progress line. */
  Site.rail = function (items, cls, label) {
    return '<div class="rail-wrap"><div class="rail ' + (cls || '') + '" tabindex="0" aria-label="' + esc(label || 'Sarees') + '">' + items.join('') + '</div><div class="rail-bar"><i></i></div></div>';
  };
  Site.railNav = function () { return '<div class="rail-nav"><button type="button" data-rail="-1" aria-label="Previous">' + icon('left') + '</button><button type="button" data-rail="1" aria-label="Next">' + icon('right') + '</button></div>'; };
  function bindRails(scope) {
    scope.querySelectorAll('.rail').forEach(function (r) {
      var sec = r.closest('section') || scope, bar = r.parentNode.querySelector('.rail-bar i');
      function paint() {
        var max = r.scrollWidth - r.clientWidth, w = r.clientWidth / r.scrollWidth * 100;
        if (bar) { bar.style.width = w + '%'; bar.style.left = (max > 0 ? r.scrollLeft / max * (100 - w) : 0) + '%'; }
        sec.querySelectorAll('[data-rail]').forEach(function (b) { b.disabled = b.dataset.rail === '-1' ? r.scrollLeft < 4 : r.scrollLeft > max - 4; });
      }
      r.addEventListener('scroll', paint, { passive: true }); setTimeout(paint, 60);
      sec.querySelectorAll('[data-rail]').forEach(function (b) { b.addEventListener('click', function () { r.scrollBy({ left: +b.dataset.rail * r.clientWidth * .85, behavior: 'smooth' }); }); });
      // drag to scroll with a mouse
      var down = false, sx = 0, sl = 0, moved = false;
      r.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.button) return; down = true; moved = false; sx = e.clientX; sl = r.scrollLeft; });
      r.addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 5 && !moved) { moved = true; r.classList.add('dragging'); try { r.setPointerCapture(e.pointerId); } catch (x) { } } if (moved) r.scrollLeft = sl - dx; });
      function up() { if (!down) return; down = false; setTimeout(function () { r.classList.remove('dragging'); }, 0); }
      r.addEventListener('pointerup', up); r.addEventListener('pointercancel', up);
      r.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    });
  }

  /* ---------- Header, menus, footer ---------- */
  var ANN = [['truck', 'Free delivery across India on every order'], ['store', 'Visit our store in Old Mangalagiri · open every day'], ['spark', Site.num(D.totals.shown) + ' handloom pieces online now']];
  function header() {
    var cats = Site.shownCats, pattu = cats[0];
    var crafts = D.crafts.filter(function (c) { return c.count; });
    var mega = '<div class="mega"><div class="wrap mega-in"><div><h4>Shop by craft</h4><ul>' + crafts.map(function (c) { return '<li><a href="#/shop?craft=' + c.key + '">' + esc(c.name) + '<span>' + Site.num(c.count) + '</span></a></li>'; }).join('') + '</ul></div>' +
      '<div><h4>Largest collections</h4><ul>' + D.collections.slice(0, 8).map(function (c) { return '<li><a href="#/shop?col=' + c.id + '">' + esc(c.name) + '<span>' + c.count + '</span></a></li>'; }).join('') + '<li><a href="#/collections"><b>All ' + D.collections.length + ' collections</b></a></li></ul></div>' +
      '<a class="feature" href="#/c/' + pattu.slug + '"><img src="' + (D.site['hero-pattu-zari-border'] || pattu.img) + '" alt=""><span>' + esc(pattu.name) + '</span></a></div></div>';
    var navItems = '<div class="nav-item"><a class="top" href="#/c/' + pattu.slug + '" data-nav="c">Sarees ' + icon('down', 'ico-sm') + '</a>' + mega + '</div>' +
      cats.slice(1).map(function (c) { return '<div class="nav-item"><a class="top" href="#/c/' + c.slug + '">' + esc(c.name.replace(/^Handloom /, '')) + '</a></div>'; }).join('') +
      '<div class="nav-item"><a class="top" href="#/collections" data-nav="collections">Collections</a></div><div class="nav-item"><a class="top" href="#/shop?sort=new" data-nav="new">New in</a></div><div class="nav-item"><a class="top" href="#/story" data-nav="story">Our story</a></div><div class="nav-item"><a class="top" href="#/store" data-nav="store">Visit us</a></div>';
    var n = Site.bagCount(), wl = S.wish.length;
    return '<div class="announce" role="region" aria-label="Announcements"><div class="track">' + ANN.concat([ANN[0]]).map(function (a) { return '<div class="msg">' + icon(a[0]) + esc(a[1]) + '</div>'; }).join('') + '</div></div>' +
      '<header class="hdr" id="hdr"><div class="wrap"><div class="hdr-in">' +
      '<div class="left"><button type="button" class="btn btn-icon menu-btn" data-menu aria-label="Menu">' + icon('menu') + '</button><button type="button" class="btn btn-icon btn-search" data-search aria-label="Search">' + icon('search') + '</button></div>' +
      '<a class="logo" href="#/home" aria-label="Nandam Handlooms, home"><img src="' + (D.site['brand-logo'] || 'img/site/brand-logo.png') + '" alt=""><span class="wm"><b>Nandam Handlooms</b><small>Old Mangalagiri</small></span></a>' +
      '<nav class="inline-nav nav" aria-label="Main menu">' + navItems + '</nav>' +
      '<div class="tools"><button type="button" class="search-pill" data-search>' + icon('search', 'ico-sm') + 'Search sarees, crafts, SKU</button>' +
      '<button type="button" class="btn btn-icon hide-sm" data-theme-cycle aria-label="Theme: ' + Site.themeName() + '. Change theme" title="Theme: ' + Site.themeName() + '">' + icon(Site.themeIcon()) + '</button>' +
      '<a class="btn btn-icon hide-sm" href="#/' + (Site.signedIn() ? 'account' : 'signin') + '" aria-label="' + (Site.signedIn() ? 'My account' : 'Sign in') + '">' + icon('user') + '</a>' +
      '<a class="btn btn-icon hide-sm" href="#/wishlist" aria-label="Wishlist">' + icon('heart') + (wl ? '<span class="count">' + wl + '</span>' : '') + '</a>' +
      '<button type="button" class="btn btn-icon" data-bag aria-label="Bag, ' + n + ' items">' + icon('bag') + '<span class="count" data-count' + (n ? '' : ' hidden') + '>' + n + '</span></button></div>' +
      '</div></div><nav class="nav nav-row" aria-label="Main menu"><div class="wrap" style="display:flex;justify-content:center;gap:clamp(1rem,2.4vw,2.2rem);position:relative">' + navItems + '</div></nav></header>';
  }
  // Dark, Light or Auto (follows the device), chosen by the visitor (owner, 15 Oct).
  var THEMES = ['auto', 'light', 'dark'];
  Site.themeName = function () { return { auto: 'Auto', light: 'Light', dark: 'Dark' }[NH.opts.theme] || 'Auto'; };
  Site.themeIcon = function () { return { auto: 'contrast', light: 'sun', dark: 'moon' }[NH.opts.theme] || 'contrast'; };
  Site.themeSwitch = function () { return '<div class="theme-seg" role="group" aria-label="Theme">' + [['auto', 'contrast', 'Auto'], ['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']].map(function (t) { return '<button type="button" data-theme-set="' + t[0] + '" aria-pressed="' + (NH.opts.theme === t[0]) + '">' + icon(t[1], 'ico-sm') + t[2] + '</button>'; }).join('') + '</div>'; };
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-theme-cycle]'); if (c) { var n = THEMES[(THEMES.indexOf(NH.opts.theme) + 1) % 3]; NH.setOption('theme', n); Site.toast('Theme: ' + Site.themeName() + (n === 'auto' ? ' (follows your device)' : '')); return; }
    var t = e.target.closest('[data-theme-set]'); if (t) { NH.setOption('theme', t.dataset.themeSet); Site.toast('Theme: ' + Site.themeName() + (t.dataset.themeSet === 'auto' ? ' (follows your device)' : '')); }
  });
  function paintCount(bump) {
    var n = Site.bagCount();
    document.querySelectorAll('[data-count]').forEach(function (c) { c.textContent = n; c.hidden = !n; if (bump) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } });
  }
  Site.paintCount = paintCount;
  function footer() {
    var st = D.store;
    return '<footer class="ftr"><div class="wrap"><div class="top">' +
      '<div class="brand"><div class="row"><img src="' + (D.site['brand-logo'] || '') + '" alt=""><b>Nandam Handlooms</b></div><p>Mangalagiri handloom pattu sarees and dress materials, from our shop in Old Mangalagiri to your door.</p>' +
      '<form class="news" data-news><label class="sr-only" for="news-in">Email for new arrivals</label><input class="input" id="news-in" type="email" placeholder="Email for new arrivals" autocomplete="email"><button class="btn btn-gold" type="submit">Join</button></form><span class="badge badge-sample" style="justify-self:start">Planned: no newsletter today</span></div>' +
      '<div><h4>Shop</h4><ul>' + Site.shownCats.map(function (c) { return '<li><a href="#/c/' + c.slug + '">' + esc(c.name) + '</a></li>'; }).join('') + '<li><a href="#/collections">All collections</a></li><li><a href="#/shop?sort=new">New in</a></li></ul></div>' +
      '<div><h4>Help</h4><ul><li><a href="#/help">Delivery</a></li><li><a href="#/help?t=returns">Returns and exchanges</a></li><li><a href="#/help?t=pay">Payments</a></li><li><a href="#/help?t=care">Saree care</a></li><li><a href="#/orders">Track my order</a></li><li><a href="#/help?t=faq">FAQs</a></li></ul></div>' +
      '<div><h4>Visit the store</h4><ul><li>' + st.lines.map(esc).join('<br>') + '</li><li>' + esc(st.hours) + '</li><li><a href="#/store">' + esc(st.phone) + ' · Call or WhatsApp</a></li><li><a href="' + st.map + '" target="_blank" rel="noopener">Directions on Google Maps ' + icon('external', 'ico-sm') + '</a></li></ul></div>' +
      '</div><div class="ftr-theme"><span>Theme</span>' + Site.themeSwitch() + '</div><div class="wordmark" aria-hidden="true">Nandam Handlooms</div><div class="bottom"><span>© 2026 Nandam Handlooms, Mangalagiri. All prices include taxes.</span><div class="pay"><span>UPI</span><span>Cards</span><span>Net banking</span><span>Razorpay secure</span></div></div></div></footer>' +
      '<a class="wa-fab" href="#/store" aria-label="Chat on WhatsApp">' + icon('whatsapp') + '</a>';
  }
  function fullMenu() {
    var links = [['Mangalagiri pattu sarees', 'c/mangalagiri-handloom-pattu-sarees', Site.shownCats[0] && Site.shownCats[0].count]].concat(Site.shownCats.slice(1).map(function (c) { return [c.name, 'c/' + c.slug, c.count]; }))
      .concat([['All collections', 'collections', D.collections.length], ['New in', 'shop?sort=new'], ['Our story', 'story'], ['Visit the store', 'store']]);
    var pics = [D.site['brand-handloom_banner'], D.site['hero-pattu-zari-border'], D.site['craft-texture-mint-border'], D.site['hero-kalamkari-border']].filter(Boolean);
    var el = document.createElement('div'); el.className = 'fullmenu'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Menu');
    el.innerHTML = '<div class="l"><button type="button" class="close" data-x>' + icon('x', 'ico-sm') + 'Close</button><nav>' + links.map(function (l, i) { return '<a href="#/' + l[1] + '" style="animation-delay:' + (.15 + i * .06) + 's" data-pic="' + (i % pics.length) + '">' + esc(l[0]) + (l[2] ? '<small>' + num(l[2]) + '</small>' : '') + '</a>'; }).join('') + '</nav>' +
      '<div class="meta"><span>' + D.store.lines.map(esc).join('<br>') + '</span><span>' + esc(D.store.hours) + '<br>' + esc(D.store.phone) + '</span><a href="#/' + (Site.signedIn() ? 'account' : 'signin') + '">' + (Site.signedIn() ? 'My account' : 'Sign in') + '</a></div></div><div class="r">' + pics.map(function (p, i) { return '<img src="' + p + '" alt="" style="opacity:' + (i ? 0 : 1) + '" data-mp="' + i + '">'; }).join('') + '</div>';
    document.body.appendChild(el); document.body.style.overflow = 'hidden';
    function close() { el.remove(); document.body.style.overflow = ''; closers = closers.filter(function (c) { return c !== close; }); }
    closers.push(close);
    el.querySelector('[data-x]').addEventListener('click', close);
    el.querySelectorAll('nav a').forEach(function (a) { a.addEventListener('click', close); a.addEventListener('mouseenter', function () { el.querySelectorAll('[data-mp]').forEach(function (im) { im.style.opacity = im.dataset.mp === a.dataset.pic ? 1 : 0; }); }); });
    el.querySelector('nav a').focus();
  }
  function menuDrawer() {
    if (NH.opts.header === 'c' && innerWidth > 860) return fullMenu();
    var b = '<nav class="mnav" aria-label="Menu">' + Site.shownCats.map(function (c) { return '<a href="#/c/' + c.slug + '">' + esc(c.name) + icon('right', 'ico-sm') + '</a>'; }).join('') +
      '<div class="sub">' + D.crafts.filter(function (c) { return c.count; }).map(function (c) { return '<a href="#/shop?craft=' + c.key + '">' + esc(c.name) + '</a>'; }).join('') + '</div>' +
      '<a href="#/collections">All collections' + icon('right', 'ico-sm') + '</a><a href="#/shop?sort=new">New in' + icon('right', 'ico-sm') + '</a><a href="#/story">Our story' + icon('right', 'ico-sm') + '</a><a href="#/store">Visit the store' + icon('right', 'ico-sm') + '</a><a href="#/help">Help' + icon('right', 'ico-sm') + '</a>' +
      '<a href="#/' + (Site.signedIn() ? 'account' : 'signin') + '">' + (Site.signedIn() ? 'My account' : 'Sign in') + icon('user', 'ico-sm') + '</a><a href="#/wishlist">Wishlist' + icon('heart', 'ico-sm') + '</a></nav>';
    Site.drawer('Menu', b, Site.themeSwitch() + '<a class="btn btn-block" href="#/store">' + icon('whatsapp') + 'WhatsApp ' + esc(D.store.phone) + '</a>', 'left');
  }

  /* Bag side panel */
  Site.openBag = function () {
    var lines = Site.bagLines();
    function body() {
      if (!lines.length) return Site.empty('bag', 'Your bag is empty', 'Sarees you add show here.', '<a class="btn btn-primary" href="#/shop">Shop sarees</a>');
      return lines.map(function (l) { return Site.lineHtml(l); }).join('');
    }
    var foot = lines.length ? '<div class="sumrow"><span>Subtotal</span><b class="price">' + rs(Site.bagTotal()) + '</b></div><div class="sumrow muted" style="font-size:.86rem"><span>Delivery</span><span>Free</span></div><a class="btn btn-primary btn-lg btn-block" href="#/checkout">' + icon('lock', 'ico-sm') + 'Checkout</a><a class="btn btn-block" href="#/bag">View bag</a>' : '';
    Site.drawer('Your bag (' + Site.bagCount() + ')', body(), foot, 'right', function (el, close) { bindLines(el, function () { close(); Site.openBag(); }); });
  };
  Site.lineHtml = function (l) {
    var c = COL[l.p.col];
    return '<div class="line"><a href="#/p/' + l.p.slug + '"><img src="' + l.p.img + '" alt=""></a><div class="t"><b>' + esc(l.p.name) + '</b><small>' + esc(c.name) + ' · ' + esc(l.p.sku) + '</small>' +
      '<div class="acts">' + (l.p.avail > 1 ? '<div class="qty" role="group" aria-label="Quantity"><button type="button" data-q="' + l.p.slug + '" data-d="-1" aria-label="One fewer">−</button><output>' + l.qty + '</output><button type="button" data-q="' + l.p.slug + '" data-d="1" aria-label="One more"' + (l.qty >= l.p.avail ? ' disabled' : '') + '>+</button></div><small>' + l.p.avail + ' in stock</small>' : '<small>One of a kind</small>') +
      '<button type="button" class="rm" data-rm="' + l.p.slug + '">Remove</button></div></div><b class="price">' + rs(l.qty * l.price) + '</b></div>';
  };
  function bindLines(el, redraw) {
    el.querySelectorAll('[data-q]').forEach(function (b) { b.addEventListener('click', function () { var l = S.bag.filter(function (x) { return x.slug === b.dataset.q; })[0]; Site.setQty(b.dataset.q, l.qty + (+b.dataset.d)); redraw(); }); });
    el.querySelectorAll('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { Site.setQty(b.dataset.rm, 0); redraw(); Site.toast('Removed from your bag'); }); });
  }
  Site.bindLines = bindLines;

  /* Search: a panel from the top with instant results */
  Site.search = function (q) {
    q = (q || '').trim().toLowerCase(); if (!q) return { cols: [], prods: [] };
    var words = q.split(/\s+/);
    function hit(t) { t = t.toLowerCase(); return words.every(function (w) { return t.indexOf(w) >= 0; }); }
    var cols = D.collections.filter(function (c) { return hit(c.name + ' ' + (c.craft ? CRAFT[c.craft].name : '') + ' ' + CAT[c.cat].name); });
    var prods = D.products.filter(function (p) { var c = COL[p.col]; return hit(p.name + ' ' + p.sku + ' ' + c.name + ' ' + (c.craft ? CRAFT[c.craft].name : '')); });
    return { cols: cols, prods: prods };
  };
  Site.mark = function (text, q) { var t = esc(text); (q || '').trim().split(/\s+/).filter(Boolean).forEach(function (w) { t = t.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); }); return t; };
  function openSearch() {
    var popular = ['Applique', 'Kalamkari', 'Pure Pattu', 'Digital Print', 'Checks', 'Embroidery'];
    var close = layer('<div class="search-ov" role="dialog" aria-modal="true" aria-label="Search"><div class="wrap"><form class="bar" data-sform>' + icon('search', 'ico-lg') + '<label class="sr-only" for="s-in">Search</label><input id="s-in" type="search" placeholder="Search sarees, crafts or SKU" autocomplete="off"><button type="button" class="btn btn-icon" data-close aria-label="Close search">' + icon('x') + '</button></form><div class="res" data-res></div></div></div>', null, function (el) {
      var inp = el.querySelector('#s-in'), res = el.querySelector('[data-res]');
      function paint() {
        var q = inp.value, r = Site.search(q);
        if (!q.trim()) {
          res.innerHTML = '<div><h4>Popular searches</h4><div class="sug">' + popular.map(function (w) { return '<a href="#/search?q=' + encodeURIComponent(w) + '">' + icon('search', 'ico-sm') + w + '</a>'; }).join('') + '</div></div><div><h4>New in</h4><div class="mini-grid">' + Site.byNewest.slice(0, 4).map(function (p, i) { return Site.card(p, i); }).join('') + '</div></div>';
        } else if (!r.cols.length && !r.prods.length) {
          res.innerHTML = '<div><h4>No match</h4><p class="muted">Nothing found for “' + esc(q) + '”. Try a craft like applique or kalamkari, or a SKU like NH-MHPS-516.</p></div><div><h4>Popular searches</h4><div class="sug">' + popular.map(function (w) { return '<a href="#/search?q=' + encodeURIComponent(w) + '">' + w + '</a>'; }).join('') + '</div></div>';
        } else {
          res.innerHTML = '<div><h4>Collections</h4><div class="sug">' + (r.cols.slice(0, 7).map(function (c) { return '<a href="#/shop?col=' + c.id + '">' + icon('right', 'ico-sm') + Site.mark(c.name, q) + ' <span class="muted">(' + c.count + ')</span></a>'; }).join('') || '<span class="muted">None</span>') + '</div><a class="link" style="margin-top:1rem" href="#/search?q=' + encodeURIComponent(q) + '">See all results ' + icon('arrow', 'ico-sm') + '</a></div><div><h4>Sarees</h4><div class="mini-grid">' + r.prods.slice(0, 4).map(function (p, i) { return Site.card(p, i); }).join('') + '</div></div>';
        }
        res.querySelectorAll('.reveal').forEach(function (x) { x.classList.add('in'); });
      }
      inp.addEventListener('input', paint); paint();
      el.querySelector('[data-sform]').addEventListener('submit', function (e) { e.preventDefault(); if (inp.value.trim()) { location.hash = '#/search?q=' + encodeURIComponent(inp.value.trim()); } });
    });
    return close;
  }
  Site.openSearch = openSearch;

  /* Card actions (anywhere) */
  function bindCards(scope) {
    scope.addEventListener('click', function (e) {
      var w = e.target.closest('[data-wish]'); if (w) { e.preventDefault(); var on = Site.toggleWish(w.dataset.wish); w.setAttribute('aria-pressed', on); Site.toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist'); paintHeader(); return; }
      var a = e.target.closest('[data-add]'); if (a) { e.preventDefault(); a.classList.add('is-loading'); setTimeout(function () { a.classList.remove('is-loading'); Site.addToBag(a.dataset.add, 1); }, 380); }
    });
  }
  Site.bindCards = bindCards;

  /* ---------- Scroll animations ---------- */
  var wio = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { (en.target._wipes || []).forEach(function (w) { w.classList.add('in'); }); wio.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: .05 }) : null;
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -6% 0px', threshold: .06 }) : null;
  function revealAll(scope) {
    var list = scope.querySelectorAll('.reveal:not(.in), .lines:not(.in)'), wipes = scope.querySelectorAll('.wipe:not(.in)');
    if (!io || NH.opts.motion === 'off') { list.forEach(function (x) { x.classList.add('in'); }); wipes.forEach(function (x) { x.classList.add('in'); }); return; }
    list.forEach(function (x) { var r = x.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) x.classList.add('in'); else io.observe(x); });
    // A masked image counts as off-screen to the browser, so its parent starts the wipe.
    wipes.forEach(function (x) {
      var host = x.parentElement; host._wipes = (host._wipes || []).concat([x]);
      if (!host._watched) { host._watched = true; wio.observe(host); }
    });
  }
  Site.revealAll = revealAll;
  var scrollers = [];
  Site.onScroll = function (fn) { scrollers.push(fn); };
  var lastY = 0, ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false; var y = scrollY, h = document.getElementById('hdr');
      if (h) { h.classList.toggle('is-solid', y > 40); h.classList.toggle('is-hidden', y > 420 && y > lastY + 4 && !document.body.classList.contains('lock-hdr')); if (y < lastY - 4) h.classList.remove('is-hidden'); }
      document.body.classList.toggle('scrolled', y > 500);
      lastY = y; if (NH.opts.motion !== 'off') scrollers.forEach(function (f) { f(y); });
    });
  }, { passive: true });
  Site.countUp = function (scope) {
    scope.querySelectorAll('[data-count-to]').forEach(function (el) {
      var to = +el.dataset.countTo, done = false;
      function run() { if (done) return; done = true; if (NH.opts.motion === 'off') { el.textContent = Site.num(to); return; } var t0 = performance.now(); (function f(t) { var k = Math.min(1, (t - t0) / 1400); el.textContent = Site.num(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(f); })(t0); }
      if (io) { var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { run(); o.disconnect(); } }, { threshold: .4 }); o.observe(el); } else run();
    });
  };
  function ripple(e) {
    var b = e.target.closest('.btn'); if (!b || NH.opts.motion === 'off') return;
    var r = b.getBoundingClientRect(), s = document.createElement('span'), d = Math.max(r.width, r.height);
    s.className = 'ripple'; s.style.width = s.style.height = d + 'px'; s.style.left = (e.clientX - r.left - d / 2) + 'px'; s.style.top = (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(s); setTimeout(function () { s.remove(); }, 600);
  }

  /* ---------- Router ---------- */
  var PAGES = {}, state = 'normal', timers = [];
  Site.page = function (name, fn) { PAGES[name] = fn; };
  Site.state = function () { return state; };
  Site.after = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
  Site.go = function (r) { location.hash = '#/' + r; };
  Site.parse = function () {
    var h = location.hash.replace(/^#\/?/, ''), q = h.split('?'), p = {};
    (q[1] || '').split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); p[decodeURIComponent(a[0])] = decodeURIComponent((a[1] || '').replace(/\+/g, ' ')); });
    var parts = (q[0] || 'home').split('/').filter(Boolean);
    return { path: parts, name: parts[0] || 'home', arg: parts.slice(1).join('/'), q: p, raw: h };
  };
  var current = null, main, chrome;
  function routeName(r) {
    var map = { '': 'home', home: 'home', collections: 'collections', c: 'category', shop: 'shop', search: 'search', p: 'product', bag: 'bag', checkout: 'checkout', confirmed: 'confirmed', signin: 'signin', register: 'register', otp: 'otp', pin: 'pin', forgot: 'forgot', account: 'account', orders: 'orders', order: 'order', story: 'story', store: 'store', help: 'help', wishlist: 'wishlist', maintenance: 'maintenance' };
    return map[r.name] || 'notfound';
  }
  function paintHeader() { var c = chrome.querySelector('[data-hdr]'); c.innerHTML = header(); bindHeader(c); markNav(); }
  Site.paintHeader = paintHeader;
  function bindHeader(c) {
    c.querySelectorAll('[data-search]').forEach(function (b) { b.addEventListener('click', openSearch); });
    c.querySelector('[data-menu]').addEventListener('click', menuDrawer);
    c.querySelector('[data-bag]').addEventListener('click', Site.openBag);
    var tr = c.querySelector('.announce .track'), i = 0;
    clearInterval(Site._ann); Site._ann = setInterval(function () { i++; tr.style.transition = ''; tr.style.transform = 'translateY(-' + (i * 36) + 'px)'; if (i === ANN.length) setTimeout(function () { tr.style.transition = 'none'; tr.style.transform = 'none'; i = 0; }, 800); }, 4200);
  }
  function markNav() {
    if (!current) return;
    chrome.querySelectorAll('.nav a.top').forEach(function (a) {
      var h = a.getAttribute('href').replace('#/', '');
      a.setAttribute('aria-current', (current.raw && (current.raw === h || (current.name === 'c' && h === 'c/' + current.arg))) ? 'page' : 'false');
    });
  }
  function render() {
    timers.forEach(clearTimeout); timers = []; scrollers = []; Site.closeAll();
    var r = Site.parse(); current = r;
    var name = routeName(r), fn = PAGES[name] || PAGES.notfound;
    var out = fn(r, state) || {};
    // Screens without their own version of a state get the standard one.
    if (!out.handles && !out.bare) {
      if (state === 'loading') out = { title: out.title, handles: true, html: '<div class="wrap" style="padding-block:clamp(32px,5vw,64px);display:grid;gap:18px"><div class="skel" style="height:14px;width:220px"></div><div class="skel" style="height:44px;width:min(520px,80%)"></div><div class="pgrid">' + Site.cardSkel(4) + '</div></div>' };
      else if (state === 'error') out = { title: out.title, handles: true, html: '<div class="wrap">' + Site.empty('wifioff', 'Couldn’t load this page', 'Check your internet connection and try again.', '<button type="button" class="btn btn-primary" onclick="NHSite.setState(\'normal\')">Try again</button>') + '</div>' };
      else if (state === 'warning') out.html = '<div class="wrap" style="padding-top:1rem"><div class="alert alert-warn">' + icon('wifioff') + '<div><b>You are offline</b>Showing what was saved on this device. Prices and stock may have changed.</div></div></div>' + (out.html || '');
      else if (state === 'empty') setTimeout(function () { NH.toast('This screen has no empty version. Try Shop, Search, Bag, Wishlist or My orders.'); }, 50);
    }
    var bare = !!out.bare;
    document.body.classList.toggle('at-home', name === 'home');
    chrome.querySelector('[data-hdr]').hidden = bare; chrome.querySelector('[data-ftr]').hidden = bare;
    if (!bare && !chrome.querySelector('[data-hdr]').innerHTML) { paintHeader(); chrome.querySelector('[data-ftr]').innerHTML = footer(); }
    markNav();
    main.innerHTML = '<div class="page-enter">' + (out.html || '') + '</div>';
    document.title = (out.title ? out.title + ' · ' : '') + 'Nandam Handlooms';
    bindRails(main); revealAll(main); Site.countUp(main);
    out.mount && out.mount(main);
    if (state === 'success' && !out.handles) Site.toast('Done. Everything saved.');
    if (state === 'popup' && !out.handles) Site.openBag();
    document.dispatchEvent(new CustomEvent('nh:route', { detail: { name: name, r: r } }));
  }
  Site.render = render;
  window.addEventListener('hashchange', function () { state = 'normal'; render(); window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); });
  window.NHSite = { setState: function (s) { state = s; render(); }, reset: function () { Site.reset(); }, go: Site.go };

  function boot() {
    if (EMBED) document.body.classList.add('embed');
    document.documentElement.classList.add('js-reveal');
    chrome = document.getElementById('site');
    main = chrome.querySelector('main');
    document.addEventListener('click', ripple);
    // A round "View / Shop / Drag" cursor over imagery (mouse only)
    var cur = document.createElement('div'); cur.className = 'lux-cursor'; cur.setAttribute('aria-hidden', 'true'); document.body.appendChild(cur);
    document.addEventListener('mousemove', function (e) {
      var t = e.target.closest && e.target.closest('[data-cur]');
      if (t && NH.opts.motion !== 'off' && !e.target.closest('button, .btn, .wish, .quick')) { cur.textContent = t.dataset.cur; cur.classList.add('on'); cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }
      else cur.classList.remove('on');
    }, { passive: true });
    bindCards(document);
    document.addEventListener('click', function (e) { var a = e.target.closest('[data-open-bag]'); if (a) { e.preventDefault(); Site.closeAll(); Site.openBag(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && closers.length) { closeTop(); e.stopPropagation(); } });
    document.addEventListener('nh:options', function () { if (current) { chrome.querySelector('[data-hdr]').innerHTML = ''; render(); } });
    document.addEventListener('nh:flags', function () { if (current) { paintHeader(); render(); } });
    if (!location.hash) history.replaceState(null, '', '#/home');
    render();
  }
  Site.boot = boot;
})();
