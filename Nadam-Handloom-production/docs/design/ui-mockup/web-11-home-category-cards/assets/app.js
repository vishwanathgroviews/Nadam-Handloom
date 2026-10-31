/* Home page mock-up, 27 Oct 2026: the live website (the client's "products first" design) with
   ONE change on the home page: a "Shop by category" section at the top with all 6 categories as
   cards, 3 in a row (2 rows). Card styles A/B/C, phones 2 or 1 in a row, crafts row kept or not
   (Design options). Everything else is as live: the latest collections, then every saree with
   filters. A category shows all of its collections (subcategories) with
   photos; a collection shows all of its sarees. Then the saree page, bag, sign in, checkout, orders.
   Hash routes: #/ home · #/all · #/c/<category> · #/collection/<id> · #/new · #/sets ·
   #/search?q= · #/p/<saree> · #/bag · #/signin · #/checkout · #/order/<no> · #/orders(/<no>).
   Filters live in the address (cat, craft, price, col, sets, sort, page), so Back works.
   Every category, collection and saree is real (assets/data.js, 1,730 sarees on 25 Oct);
   the customer, addresses, orders, tracking numbers and the payment window are samples.
   Data: assets/data.js, live on 27 Oct 2026 (1,873 sarees). */
(() => {
  'use strict';
  const NH = window.NH;
  const ICONS = window.ICONS;
  const app = document.getElementById('app');
  const opt = (k) => (window.W10Opts ? window.W10Opts.get(k) : null);
  // Every saree carries its collection's id; the saree page's words come from its collection.
  if (!NH.products[0] || typeof NH.products[0].collection === 'string') {
    const cols = new Map(NH.collections.map((c) => [c.id, c]));
    const crafts = new Map(NH.crafts.map((k) => [k.key, k.name]));
    NH.products = NH.products.map((p) => {
      const c = cols.get(p.collection) || {};
      return { ...p, collection: { id: p.collection, name: c.name || '' }, craftName: crafts.get(p.craft) || '', photos: [{ src: p.photo, alt: p.alt }], description: c.description || '', highlights: c.highlights || [], details: [] };
    });
  }

  /* ---------- Helpers ---------- */
  const fmt = new Intl.NumberFormat('en-IN');
  const n = (v) => fmt.format(v);
  const rs = (v) => `₹${fmt.format(v)}`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const icon = (name, cls = '') => `<svg class="ico${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.info}</svg>`;
  const count = (v, one, many) => `${n(v)} ${v === 1 ? one : many}`;
  const first = (name) => String(name || '').trim().split(/\s+/)[0] || '';
  const mobileText = (m) => `+91 ${m.slice(0, 5)} ${m.slice(5)}`;
  const noMotion = () => document.documentElement.classList.contains('no-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = () => window.innerWidth <= 900;
  const tag = (t) => `<span class="mock-tag">${esc(t)}</span>`;

  const CATS = NH.categories;
  const catBy = new Map(CATS.map((c) => [c.slug, c]));
  const colBy = new Map(NH.collections.map((c) => [c.id, c]));
  const craftBy = new Map(NH.crafts.map((c) => [c.key, c]));
  const bySlug = new Map(NH.products.map((p) => [p.slug, p]));
  const BANDS = NH.priceBands;
  const bandOf = (price) => (price < 2500 ? 'u25' : price <= 3500 ? '25-35' : price <= 5000 ? '35-50' : 'o50');
  const PAGE = 24;
  const WA = NH.store.whatsapp;
  const newest = [...NH.products].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const waLink = (text) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
  const productUrl = (p) => `https://nandamhandlooms.com/product/${p.slug}`;

  /* ---------- What the visitor keeps (this browser only) ---------- */
  const read = (store, k, def) => { try { const v = JSON.parse(store.getItem(`w11mock.${k}`)); return v ?? def; } catch { return def; } };
  const write = (store, k, v) => { try { if (v === null) store.removeItem(`w11mock.${k}`); else store.setItem(`w11mock.${k}`, JSON.stringify(v)); } catch { /* private mode: this visit only */ } };
  let bag = read(localStorage, 'bag', []).filter((l) => bySlug.has(l.slug));
  let me = read(sessionStorage, 'me', null);
  let placed = read(localStorage, 'orders', []);
  const saveBag = () => write(localStorage, 'bag', bag);
  const bagCount = () => bag.reduce((s, l) => s + l.qty, 0);
  const bagLines = () => bag.map((l) => ({ ...l, p: bySlug.get(l.slug) })).filter((l) => l.p);
  const bagTotal = () => bagLines().reduce((s, l) => s + l.p.price * l.qty, 0);

  // The sample returning customer (any other number is a new customer).
  const PRIYA = {
    mobile: '9876543210', name: 'Priya Sharma', email: 'priya@example.com',
    addresses: [
      { id: 'a1', label: 'Home', fullName: 'Priya Sharma', phone: '9876543210', line1: 'Flat 302, Sai Residency, Road No. 12', line2: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034' },
      { id: 'a2', label: 'Office', fullName: 'Priya Sharma', phone: '9876543210', line1: '4th floor, Cyber Towers', line2: 'HITEC City, Madhapur', city: 'Hyderabad', state: 'Telangana', pincode: '500081' },
    ],
  };
  const PINS = { 522503: ['Mangalagiri', 'Andhra Pradesh'], 500034: ['Hyderabad', 'Telangana'], 500081: ['Hyderabad', 'Telangana'], 560001: ['Bengaluru', 'Karnataka'], 600001: ['Chennai', 'Tamil Nadu'], 400001: ['Mumbai', 'Maharashtra'], 110001: ['New Delhi', 'Delhi'], 520001: ['Vijayawada', 'Andhra Pradesh'] };
  const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];

  // Two sample past orders for My orders.
  const SAMPLE_ORDERS = (() => {
    const pick = (i) => newest[i] || NH.products[i];
    const mk = (no, days, status, lines, extra) => {
      const items = lines.map(([p, qty]) => ({ slug: p.slug, sku: p.sku, name: p.name, price: p.price, qty, photo: p.photos[0].src }));
      return { no, at: new Date(Date.now() - days * 86400000).toISOString(), status, items, total: items.reduce((s, i) => s + i.price * i.qty, 0), address: PRIYA.addresses[0], pay: 'UPI', sample: true, ...extra };
    };
    return [
      mk('NH25104471', 3, 'shipped', [[pick(5), 1], [pick(9), 1]], { courier: 'DTDC', awb: 'D84512039', shippedAt: new Date(Date.now() - 1 * 86400000).toISOString() }),
      mk('NH24987310', 16, 'delivered', [[pick(14), 1]], { courier: 'DTDC', awb: 'D83977102', shippedAt: new Date(Date.now() - 14 * 86400000).toISOString(), deliveredAt: new Date(Date.now() - 11 * 86400000).toISOString() }),
    ];
  })();
  const allOrders = () => [...placed, ...SAMPLE_ORDERS];
  const dateText = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  /* ---------- Routes ---------- */
  function route() {
    const h = location.hash.slice(1) || '/';
    const [path, qs] = h.split('?');
    return { path: path || '/', parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
  }
  const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
  const withQ = (path, q) => { const s = q.toString(); return `#${path}${s ? `?${s}` : ''}`; };
  const list = (q, k) => (q.get(k) || '').split(',').filter(Boolean);

  /* ---------- Filters and sorting ---------- */
  const filtersOf = (q) => ({ cat: list(q, 'cat'), craft: list(q, 'craft'), price: list(q, 'price'), col: list(q, 'col'), sets: q.get('sets') === '1', sort: q.get('sort') || 'new', q: (q.get('q') || '').trim() });
  const words = (s) => s.toLowerCase().split(/\s+/).filter(Boolean);
  function matches(p, query) {
    if (!query) return true;
    const hay = `${p.name} ${p.sku} ${p.collection.name} ${catBy.get(p.category)?.name || ''} ${catBy.get(p.category)?.short || ''} ${p.craftName || ''} ${craftBy.get(p.craft)?.name || ''}`.toLowerCase();
    return words(query).every((w) => hay.includes(w) || (w.length >= 5 && hay.includes(w.slice(0, -1))));
  }
  function apply(scope, f, skip) {
    return scope.filter((p) => (skip === 'cat' || !f.cat.length || f.cat.includes(p.category))
      && (skip === 'craft' || !f.craft.length || f.craft.includes(p.craft))
      && (skip === 'price' || !f.price.length || f.price.includes(bandOf(p.price)))
      && (skip === 'col' || !f.col.length || f.col.includes(p.collection.id))
      && (skip === 'sets' || !f.sets || p.available > 1)
      && matches(p, f.q));
  }
  const SORTS = { new: ['Newest first', (a, b) => b.addedAt.localeCompare(a.addedAt)], 'price-asc': ['Price: low to high', (a, b) => a.price - b.price || b.addedAt.localeCompare(a.addedAt)], 'price-desc': ['Price: high to low', (a, b) => b.price - a.price || b.addedAt.localeCompare(a.addedAt)] };
  const sorted = (items, sort) => [...items].sort((SORTS[sort] || SORTS.new)[1]);
  function facets(scope, f) {
    const tally = (skip, keyOf) => { const m = new Map(); apply(scope, f, skip).forEach((p) => m.set(keyOf(p), (m.get(keyOf(p)) || 0) + 1)); return m; };
    return { cat: tally('cat', (p) => p.category), craft: tally('craft', (p) => p.craft), price: tally('price', (p) => bandOf(p.price)), col: tally('col', (p) => p.collection.id), sets: apply(scope, f, 'sets').filter((p) => p.available > 1).length };
  }
  const appliedCount = (f) => f.cat.length + f.craft.length + f.price.length + f.col.length + (f.sets ? 1 : 0);

  /* ---------- Shared parts ---------- */
  function card(p, i = 0) {
    const inBag = bag.some((l) => l.slug === p.slug);
    const col = colBy.get(p.collection.id);
    const set = p.available > 1;
    return `<article class="card${inBag ? ' added' : ''}" style="--i:${i % 12}">
      <div class="ph-wrap"><a class="ph" href="#/p/${p.slug}" aria-label="${esc(`${p.name}, ${rs(p.price)}`)}"><img src="${p.photos[0].src}" alt="${esc(p.photos[0].alt)}" loading="lazy" decoding="async" width="600" height="800">
        <span class="tags">${p.isNew ? '<span class="badge new">New</span>' : ''}${set ? `<span class="badge set">Set of ${p.available}</span>` : ''}</span></a>
      <button type="button" class="quick" data-add="${p.slug}" aria-label="${inBag ? 'In your bag' : 'Add to bag'}: ${esc(p.name)}">${icon(inBag ? 'check' : 'plus')}</button></div>
      <div class="info">
        <span class="col">${esc(p.craftName || col?.name || '')}</span>
        <a class="nm" href="#/p/${p.slug}">${esc(p.name)}</a>
        <div class="pr"><span class="price">${rs(p.price)}</span><small>${esc(p.sku)}</small></div>
        <span class="stock ${set ? 'set' : 'one'}">${set ? `${p.available} in stock` : 'Only 1 left'}</span>
      </div>
      <div class="acts">
        <button type="button" class="btn ${inBag ? '' : 'btn-primary'}" data-add="${p.slug}">${icon(inBag ? 'check' : 'bag', 'ico-sm')}${inBag ? 'In your bag' : 'Add to bag'}</button>
        <a class="btn-icon wa-mini" href="${waLink(`Hello, I'd like to order this saree:\n${p.name}\nCode: ${p.sku}\nPrice: ${rs(p.price)}\n${productUrl(p)}`)}" aria-label="Order ${esc(p.name)} on WhatsApp">${icon('whatsapp')}</a>
      </div>
    </article>`;
  }
  const skelCard = () => '<div class="card sk" aria-hidden="true"><span class="ph"><span class="skel" style="position:absolute;inset:0"></span></span><span class="skel" style="height:12px;width:50%"></span><span class="skel" style="height:14px;width:90%"></span><span class="skel" style="height:16px;width:35%"></span></div>';
  const crumbs = (items) => `<nav class="crumbs" aria-label="You are here">${items.map(([label, href], i) => (i < items.length - 1 ? `<a href="${href}">${esc(label)}</a>${icon('right')}` : `<span aria-current="page">${esc(label)}</span>`)).join('')}</nav>`;

  function searchBox(id) {
    const q = route().q.get('q') || '';
    return `<form class="search" role="search" data-search="${id}" autocomplete="off"><label class="sr-only" for="q-${id}">Search the shop</label>${icon('search')}<input id="q-${id}" name="q" type="search" value="${esc(q)}" placeholder="Search sarees, crafts, codes…" enterkeyhint="search"><button class="go" type="submit">Search</button></form>`;
  }
  let searchOpen = false;
  const soonText = 'Coming soon';
  function mega(c) {
    if (c.soon) return `<div class="mega" role="region" aria-label="${esc(c.short)}"><div><h4>${soonText}</h4><ul>${c.upcoming.slice(0, 8).map((x) => `<li><span class="muted">${esc(x)}</span></li>`).join('') || '<li class="muted small">New pieces on the way</li>'}</ul></div><div></div>
      <a class="promo" href="#/c/${c.slug}"><img src="${c.image}" alt="" loading="lazy"><b>${esc(c.short)}</b><span>${soonText}</span></a></div>`;
    const cols = NH.collections.filter((x) => x.category === c.slug).slice(0, 8);
    const crafts = [...new Set(NH.collections.filter((x) => x.category === c.slug).map((x) => x.craft))].map((k) => craftBy.get(k)).filter(Boolean).slice(0, 8);
    return `<div class="mega" role="region" aria-label="${esc(c.short)}"><div><h4>Collections</h4><ul>${cols.map((x) => `<li><a href="#/collection/${x.id}">${esc(x.name)} <small>${n(x.count)}</small></a></li>`).join('')}</ul></div>
      <div><h4>Crafts</h4><ul>${crafts.map((k) => `<li><a href="#/c/${c.slug}?craft=${k.key}">${esc(k.name)}</a></li>`).join('') || '<li class="muted small">One collection</li>'}</ul></div>
      <a class="promo" href="#/c/${c.slug}"><img src="${c.image}" alt="" loading="lazy"><b>${esc(c.short)}</b><span>Shop all ${n(c.count)} →</span></a></div>`;
  }
  function header(active) {
    const c = bagCount();
    const navLink = (href, label, key, extra = '') => `<li><a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>${extra}</li>`;
    return `<div class="top-strip"><div class="wrap"><span>${icon('truck')}Free delivery across India</span><span class="hide-sm">${icon('thread')}Handwoven in Old Mangalagiri</span><span class="hide-sm">${icon('whatsapp')}Order on WhatsApp: <a href="https://wa.me/${WA}">${mobileText(NH.store.phone)}</a></span></div></div>
    <header class="hdr"><div class="wrap hdr-row">
      <div style="display:flex;align-items:center;gap:2px"><button type="button" class="btn-icon menu-btn" data-act="menu" aria-label="Menu" aria-haspopup="dialog">${icon('menu')}</button>
      <a class="logo" href="#/" aria-label="Nandam Handlooms, home"><img src="img/logo-96.png" alt="" width="42" height="42"><span class="wm"><b>Nandam</b><small>Handlooms · Mangalagiri</small></span></a></div>
      ${searchBox('h')}
      <div class="tools">
        <button type="button" class="tool search-tool" data-act="search" aria-label="Search" aria-expanded="${searchOpen}">${icon('search')}<span class="lbl">Search</span></button>
        <a class="tool" href="${me ? '#/orders' : '#/signin'}" aria-label="${me ? `My orders (${esc(first(me.name))})` : 'Sign in'}">${icon('user')}<span class="lbl">${me ? esc(first(me.name)) : 'Sign in'}</span></a>
        <button type="button" class="tool" data-act="bag" aria-haspopup="dialog" aria-label="Bag, ${c ? count(c, 'piece', 'pieces') : 'empty'}">${icon('bag')}<span class="lbl">Bag</span>${c ? `<span class="n" data-bag-n>${c}</span>` : ''}</button>
      </div>
    </div>
    <nav class="nav" aria-label="Shop"><div class="wrap"><ul>
      ${navLink('#/all', 'All sarees', 'all')}
      ${CATS.map((cat) => navLink(`#/c/${cat.slug}`, esc(cat.short), cat.slug, mega(cat))).join('')}
      ${navLink('#/new', 'New in', 'new')}
      ${navLink('#/sets', 'Sets', 'sets')}
    </ul></div></nav>
    ${searchOpen ? `<div class="search-pop"><div class="wrap">${searchBox('pop')}</div></div>` : ''}
    </header>`;
  }
  function footer() {
    const theme = opt('theme');
    return `<section class="trust" aria-label="Why shop with us"><div class="wrap">
      <div>${icon('truck')}<span><b>Free delivery</b>Anywhere in India</span></div>
      <div>${icon('thread')}<span><b>Handwoven in Mangalagiri</b>From our store in Old Mangalagiri</span></div>
      <div>${icon('shield')}<span><b>Secure payment</b>UPI, cards, net banking (Razorpay)</span></div>
      <div>${icon('whatsapp')}<span><b>Help on WhatsApp</b>${mobileText(NH.store.phone)}</span></div>
    </div></section>
    <footer class="ftr"><div class="wrap">
      <div class="cols">
        <div class="brand"><a class="logo" href="#/"><img src="img/logo-96.png" alt="" width="42" height="42"><span class="wm"><b>Nandam</b><small>Handlooms · Mangalagiri</small></span></a><p>Mangalagiri handloom pattu sarees, dress materials and lehanga sets, from our store in Old Mangalagiri to your door.</p></div>
        <div><h4>Shop</h4><ul>${CATS.map((c) => `<li><a href="#/c/${c.slug}">${esc(c.short)}</a></li>`).join('')}<li><a href="#/new">New in</a></li><li><a href="#/sets">Sets for the family</a></li></ul></div>
        <div><h4>Help</h4><ul><li><a href="https://wa.me/${WA}">WhatsApp us</a></li><li><a href="tel:+91${NH.store.phone}">Call ${mobileText(NH.store.phone)}</a></li><li><a href="#/orders">My orders</a></li><li><a href="#/privacy">Privacy</a></li><li><a href="#/terms">Terms</a></li></ul></div>
        <div><h4>Visit the store</h4><ul>${NH.store.addressLines.map((l) => `<li>${esc(l)}</li>`).join('')}<li>${esc(NH.store.hours)}</li><li><a href="${NH.store.mapUrl}">Directions on Google Maps</a></li></ul></div>
      </div>
      <div class="bottom"><span>© 2026 Nandam Handlooms, Mangalagiri. All prices include taxes. GSTIN 37CCWPN2487C1Z2</span>
        <span class="theme" role="group" aria-label="Colour theme">${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button type="button" data-theme="${k}" aria-pressed="${theme === k}">${l}</button>`).join('')}</span></div>
    </div></footer>`;
  }
  const strip = () => `<div class="mock-strip" role="note">${tag('Mock-up')}<span>Home page: the 6 categories as cards<span class="long"> at the top, 3 in a row. The rest is the live website, with every real saree</span></span><a href="index.html">Start page</a><a href="preview.html">Phone and laptop</a></div>`;
  const plainHeader = () => `<header class="hdr"><div class="wrap hdr-row plain"><a class="logo" href="#/" aria-label="Nandam Handlooms, back to the shop"><img src="img/logo-96.png" alt="" width="42" height="42"><span class="wm"><b>Nandam</b><small>Handlooms · Mangalagiri</small></span></a><span class="secure">${icon('lock', 'ico-sm')}Secure checkout</span><a class="btn btn-sm" href="#/bag">${icon('back', 'ico-sm')}Back to bag</a></div></header>`;
  const plainFooter = () => `<footer class="ftr plain"><div class="wrap"><div class="bottom"><span>${icon('shield', 'ico-sm')} Payments by Razorpay · UPI, cards, net banking</span><span>Help: <a href="https://wa.me/${WA}">WhatsApp ${mobileText(NH.store.phone)}</a></span></div></div></footer>`;
  function shell(main, { active, fab = true, plain = false } = {}) {
    if (plain) return `<a class="skip-link" href="#main">Skip to content</a>${strip()}${plainHeader()}<main id="main" tabindex="-1" class="page-in">${main}</main>${plainFooter()}`;
    return `<a class="skip-link" href="#main">Skip to content</a>${strip()}${header(active)}<main id="main" tabindex="-1" class="page-in">${main}</main>${footer()}${fab ? `<a class="wa-fab" href="https://wa.me/${WA}" aria-label="Message the shop on WhatsApp">${icon('whatsapp')}</a>` : ''}`;
  }

  /* ---------- Listing (home A, categories, collections, search, new, sets) ---------- */
  function filterGroups(scope, f, fixed, pre = 'side') {
    const fc = facets(scope, f);
    const box = (key, value, label, cnt, checked) => `<label class="fopt${cnt ? '' : ' zero'}"><input type="checkbox" data-f="${key}" value="${esc(value)}"${checked ? ' checked' : ''}${!cnt && !checked ? ' disabled' : ''}><span>${esc(label)}</span><small>${n(cnt)}</small></label>`;
    const groups = [];
    if (!fixed.cat) groups.push(['cat', 'Category', CATS.map((c) => box('cat', c.slug, c.short, fc.cat.get(c.slug) || 0, f.cat.includes(c.slug))).join('')]);
    groups.push(['craft', 'Craft', NH.crafts.map((k) => box('craft', k.key, k.name, fc.craft.get(k.key) || 0, f.craft.includes(k.key))).join('')]);
    groups.push(['price', 'Price', BANDS.map((b) => box('price', b.key, b.label, fc.price.get(b.key) || 0, f.price.includes(b.key))).join('')]);
    if (!fixed.col) {
      const cols = NH.collections.filter((c) => (fc.col.get(c.id) || 0) > 0 || f.col.includes(c.id));
      groups.push(['col', 'Collection', `<div class="fsearch"><label class="sr-only" for="colq-${pre}">Find a collection</label><input id="colq-${pre}" class="input" type="search" placeholder="Find a collection" data-colq></div>${cols.map((c) => `<div data-colname="${esc(c.name.toLowerCase())}">${box('col', c.id, c.name, fc.col.get(c.id) || 0, f.col.includes(c.id))}</div>`).join('')}`]);
    }
    groups.push(['sets', 'Availability', `<label class="fopt${fc.sets ? '' : ' zero'}"><input type="checkbox" data-f="sets" value="1"${f.sets ? ' checked' : ''}><span>Sets: more than one piece</span><small>${n(fc.sets)}</small></label>`]);
    return groups;
  }
  function filtersSide(scope, f, fixed) {
    return `<aside class="filters-side" aria-label="Filters"><div class="fh"><b>Filters</b>${appliedCount(f) ? '<button type="button" class="btn-link small" data-act="clear">Clear all</button>' : ''}</div>
      ${filterGroups(scope, f, fixed, 'side').map(([k, title, body]) => `<div class="fgroup"><button type="button" aria-expanded="true" aria-controls="fside-${k}" data-fg="${k}">${title}${icon('down', 'ico-sm')}</button><div class="opts" id="fside-${k}">${body}</div></div>`).join('')}</aside>`;
  }
  function filterBar(f, scope, fixed) {
    const groups = filterGroups(scope, f, fixed, 'bar');
    const on = (k) => (k === 'sets' ? (f.sets ? 1 : 0) : f[k].length);
    return `<div class="fbar" role="group" aria-label="Filters">${groups.map(([k, title, body]) => `<div class="fdrop"><button type="button" class="chip${on(k) ? ' on' : ''}" data-drop="${k}" aria-expanded="false">${title}${on(k) ? ` (${on(k)})` : ''}${icon('down')}</button><div class="pop" hidden data-pop="${k}">${body}</div></div>`).join('')}
      ${appliedCount(f) ? '<button type="button" class="btn-link small" data-act="clear">Clear all</button>' : ''}</div>`;
  }
  function appliedChips(f) {
    const chips = [];
    f.cat.forEach((v) => chips.push(['cat', v, catBy.get(v)?.short || v]));
    f.craft.forEach((v) => chips.push(['craft', v, craftBy.get(v)?.name || v]));
    f.price.forEach((v) => chips.push(['price', v, BANDS.find((b) => b.key === v)?.label || v]));
    f.col.forEach((v) => chips.push(['col', v, colBy.get(v)?.name || v]));
    if (f.sets) chips.push(['sets', '1', 'Sets']);
    if (!chips.length) return '';
    return `<div class="applied">${chips.map(([k, v, l]) => `<button type="button" class="chip" data-unf="${k}" data-v="${esc(v)}" aria-label="Remove filter ${esc(l)}">${esc(l)}${icon('x')}</button>`).join('')}<button type="button" class="btn-link small" data-act="clear">Clear all</button></div>`;
  }
  function listingBody({ title, scope, fixed = {}, path, q, display = false, intro = '' }) {
    const f = filtersOf(q);
    const state = q.get('state');
    const items = sorted(apply(scope, f), f.sort);
    const page = Math.max(1, Number(q.get('page')) || 1);
    const pages = Math.max(1, Math.ceil(items.length / PAGE));
    const shown = phone() ? items.slice(0, page * PAGE) : items.slice((page - 1) * PAGE, page * PAGE);
    const sideFilters = opt('filters') !== 'b';
    let grid;
    if (state === 'loading') grid = `<div class="grid" aria-busy="true" aria-label="Loading sarees">${Array.from({ length: 8 }, skelCard).join('')}</div>`;
    else if (state === 'error') grid = `<div class="empty" role="alert"><span class="ring">${icon('wifioff')}</span><h2>We couldn't load the sarees</h2><p>Check your connection and try again.</p><button type="button" class="btn btn-primary" data-act="retry">Try again</button></div>`;
    else if (!items.length) {
      grid = f.q && !appliedCount(f)
        ? `<div class="empty"><span class="ring">${icon('search')}</span><h2>Nothing found for "${esc(f.q)}"</h2><p>Try another word (a craft like "kalamkari", a colour, or a code like NH-MHPS-1862), or browse the categories.</p><div class="row-wrap" style="justify-content:center">${CATS.map((c) => `<a class="chip" href="#/c/${c.slug}">${esc(c.short)}</a>`).join('')}</div><a class="btn btn-wa" href="${waLink(`Hello, I'm looking for: ${f.q}`)}">${icon('whatsapp', 'ico-sm')}Ask us on WhatsApp</a></div>`
        : `<div class="empty"><span class="ring">${icon('filter')}</span><h2>No sarees match these filters</h2><p>Remove a filter to see more.</p><button type="button" class="btn btn-primary" data-act="clear">Clear all filters</button></div>`;
    } else {
      grid = `<div class="grid">${shown.map(card).join('')}</div>`;
      if (pages > 1) {
        const link = (pg) => { const qq = new URLSearchParams(q); qq.set('page', pg); return withQ(path, qq); };
        const nums = [];
        for (let i = 1; i <= pages; i += 1) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
        grid += phone()
          ? (page < pages ? `<div class="more-wrap"><span class="muted small">Showing ${n(shown.length)} of ${n(items.length)}</span><span class="bar"><i style="width:${Math.round((shown.length / items.length) * 100)}%"></i></span><a class="btn" href="${link(page + 1)}" data-keep-scroll>Show more sarees</a></div>` : '')
          : `<nav class="pager" aria-label="Pages">${page > 1 ? `<a href="${link(page - 1)}" aria-label="Previous page">${icon('left')}</a>` : ''}${nums.map((x) => (x === '…' ? '<span class="gap">…</span>' : x === page ? `<span aria-current="page">${x}</span>` : `<a href="${link(x)}">${x}</a>`)).join('')}${page < pages ? `<a href="${link(page + 1)}" aria-label="Next page">${icon('right')}</a>` : ''}</nav><p class="pager-note">Showing ${n((page - 1) * PAGE + 1)}–${n((page - 1) * PAGE + shown.length)} of ${n(items.length)}</p>`;
      }
    }
    const sort = `<div class="sortbox"><label for="sort">Sort by</label><select id="sort" class="select" data-sort>${Object.entries(SORTS).map(([k, [l]]) => `<option value="${k}"${f.sort === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`;
    const head = `<div class="list-head"><div><h1${display ? ' class="display"' : ''}>${esc(title)}</h1><p class="count">${state === 'loading' ? 'Loading…' : count(items.length, 'saree', 'sarees')}</p>${intro}</div>${sort}</div>`;
    return `${head}${sideFilters ? '' : filterBar(f, scope, fixed)}${appliedChips(f)}
      <div class="listing${sideFilters ? '' : ' no-side'}">${sideFilters ? filtersSide(scope, f, fixed) : ''}<div class="results">${grid}</div></div>
      <div class="mob-bar"><button type="button" data-act="filters">${icon('sliders')}Filter${appliedCount(f) ? ` <small>${appliedCount(f)}</small>` : ''}</button><button type="button" data-act="sort">${icon('filter')}Sort: ${SORTS[f.sort] ? SORTS[f.sort][0].replace('Price: ', '') : 'Newest'}</button></div>`;
  }
  function catStrip(activeCat, activeCraft) {
    return `<nav class="cat-strip" aria-label="Categories and crafts">
      <a class="cs all" href="#/all" ${!activeCat && !activeCraft ? 'aria-current="true"' : ''}><span class="ph">${icon('grid', 'ico-lg')}</span>All<small>${n(NH.totals.sarees)}</small></a>
      ${CATS.map((c) => `<a class="cs cat${c.soon ? ' soon' : ''}" href="#/c/${c.slug}"${activeCat === c.slug ? ' aria-current="true"' : ''}><span class="ph"><img src="${c.image}" alt="" loading="lazy"></span>${esc(c.short)}<small>${c.soon ? soonText : n(c.count)}</small></a>`).join('')}
      <span class="sep" aria-hidden="true"></span>
      ${NH.crafts.filter((k) => k.image).map((k) => `<a class="cs" href="#/all?craft=${k.key}"${activeCraft === k.key ? ' aria-current="true"' : ''}><span class="ph"><img src="${k.image}" alt="" loading="lazy"></span>${esc(k.name)}<small>${n(k.count)}</small></a>`).join('')}
    </nav>`;
  }

  // The client's request (27 Oct 2026): every category as a card at the top of the home page,
  // 3 in a row, only the photo and the name; the whole card opens the category's page (its
  // subcategories). A: a tall photo like the saree cards, the name under it; B: a wide photo
  // with the name on it.
  const newestOf = new Map(CATS.map((c) => [c.slug, NH.products.filter((p) => p.category === c.slug).reduce((a, p) => (!a || p.addedAt > a.addedAt ? p : a), null)]));
  // Choice 4: the photo set in the admin app (A), or the category's newest saree (B).
  const catPhoto = (c) => (opt('catphoto') === 'b' && newestOf.get(c.slug) ? newestOf.get(c.slug).photos[0].src : c.image);
  function categoryCard(c, i, style = opt('catcard') || 'a') {
    const img = `<img src="${catPhoto(c)}" alt="" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async"${style === 'a' ? ' width="600" height="800"' : ''}>`;
    return style === 'a'
      ? `<a class="card catc" style="--i:${i}" href="#/c/${c.slug}" role="listitem"><span class="ph">${img}</span><span class="nm">${esc(c.short)}</span></a>`
      : `<a class="ccard" style="--i:${i}" href="#/c/${c.slug}" role="listitem"><span class="ph">${img}</span><span class="t"><b>${esc(c.short)}</b></span></a>`;
  }
  const skelCatCard = () => (opt('catcard') === 'b'
    ? '<div class="ccard sk" aria-hidden="true"><span class="ph"><span class="skel" style="position:absolute;inset:0"></span></span></div>'
    : '<div class="card catc sk" aria-hidden="true"><span class="ph"><span class="skel" style="position:absolute;inset:0"></span></span><span class="skel" style="height:16px;width:60%"></span></div>');
  function categoryCards(st) {
    return `<section class="cat-sec" aria-labelledby="h-cats">
      <div class="block-head"><div><h2 id="h-cats">Shop by category</h2><p class="muted small">All ${CATS.length} categories from our store in Old Mangalagiri</p></div><a href="#/all">All ${n(NH.totals.sarees)} sarees ${icon('right', 'ico-sm')}</a></div>
      ${st === 'loading' ? `<div class="ccards" aria-busy="true" aria-label="Loading the categories">${CATS.map(skelCatCard).join('')}</div>` : `<div class="ccards" role="list" aria-label="Categories">${CATS.map((c, i) => categoryCard(c, i)).join('')}</div>`}
    </section>`;
  }
  // The crafts as round photos, under the cards (choice 3 A); B leaves them to the filters.
  function craftStrip(activeCraft) {
    if (opt('crafts') === 'b') return '';
    return `<nav class="cat-strip craft-strip" aria-label="Shop by craft"><span class="cs-h">By craft</span>
      ${NH.crafts.filter((k) => k.image).map((k) => `<a class="cs" href="#/all?craft=${k.key}"${activeCraft === k.key ? ' aria-current="true"' : ''}><span class="ph"><img src="${k.image}" alt="" loading="lazy"></span>${esc(k.name)}<small>${n(k.count)}</small></a>`).join('')}
    </nav>`;
  }
  function homeA(r) {
    const st = r.q.get('state');
    const craft = list(r.q, 'craft').length === 1 ? list(r.q, 'craft')[0] : null;
    return shell(`<div class="wrap">${st === 'error' ? '' : categoryCards(st)}${st === 'error' ? '' : craftStrip(craft)}${st === 'error' ? '' : latestCollections(st)}${listingBody({ title: 'All sarees', scope: NH.products, path: '/', q: r.q })}</div>`, { active: 'all' });
  }
  function listingPage(r, { title, scope, fixed, active, path, crumbsList, intro = '' }) {
    return shell(`<div class="wrap">${crumbs(crumbsList)}${listingBody({ title, scope, fixed, path, q: r.q, intro })}</div>`, { active });
  }

  /* ---------- Collections: tiles, the latest, a category page, a collection page ---------- */
  function colsOf(slug) {
    const cols = NH.collections.filter((c) => c.category === slug); // the website's order: the most pieces first
    return opt('order') === 'b' ? [...cols].sort((x, y) => x.name.localeCompare(y.name, 'en', { sensitivity: 'base' })) : cols;
  }
  function colTile(c, i = 0) {
    return `<a class="ctile${opt('tile') === 'b' ? ' under' : ''}" style="--i:${i % 12}" href="#/collection/${c.id}"><span class="ph"><img src="${c.image}" alt="" loading="lazy" decoding="async">${c.hasNew ? '<span class="tags"><span class="badge new">New</span></span>' : ''}</span>
      <span class="t"><b>${esc(c.name)}</b><span>${count(c.count, 'piece', 'pieces')} · ${rs(c.price)}</span></span></a>`;
  }
  const skelTile = () => '<div class="ctile sk" aria-hidden="true"><span class="skel" style="position:absolute;inset:0"></span></div>';
  // The collections whose newest saree came in most recently.
  function latestCollections(st) {
    const cols = [...NH.collections].sort((x, y) => y.newest.localeCompare(x.newest)).slice(0, 10);
    const fresh = NH.products.filter((p) => p.isNew).length;
    return `<section class="block latest" aria-labelledby="h-latest"><div class="block-head"><div><h2 id="h-latest">Latest collections</h2><p class="muted small" style="margin-top:.25rem">The collections with the newest sarees from our store</p></div>${fresh ? `<a href="#/new">${count(fresh, 'new saree', 'new sarees')} ${icon('right', 'ico-sm')}</a>` : ''}</div>
      ${st === 'loading' ? `<div class="rail" aria-busy="true">${Array.from({ length: 5 }, skelTile).join('')}</div>` : `<div class="rail" tabindex="0" role="region" aria-label="Latest collections">${cols.map(colTile).join('')}</div>`}</section>`;
  }
  function categoryPage(r, c) {
    const st = r.q.get('state');
    const cols = colsOf(c.slug);
    const banner = `<div class="cbanner${opt('banner') === 'b' ? ' big' : ''}"><img src="${c.banner}" alt="" style="object-position:${c.bannerPos}"><div class="wrap"><div class="in">${crumbs([['Home', '#/'], [c.name, '']])}
      <span class="eyebrow">${c.soon ? soonText : `${count(c.count, 'piece', 'pieces')} · ${count(c.collections, 'collection', 'collections')}`}</span><h1>${esc(c.name)}</h1>${c.description ? `<p>${esc(c.description)}</p>` : ''}</div></div></div>`;
    let body;
    if (c.soon) {
      body = `<div class="empty" style="margin:24px 0 56px"><span class="ring">${icon('spark')}</span><h2>${esc(c.short)}: new pieces coming soon</h2><p>We're adding them to the website. Ask us on WhatsApp and we'll send photos of what's in the store.</p>
        ${c.upcoming.length ? `<div class="row-wrap" style="justify-content:center">${c.upcoming.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}
        <a class="btn btn-wa" href="${waLink(`Hello, do you have ${c.short.toLowerCase()}? Please send photos.`)}">${icon('whatsapp', 'ico-sm')}Ask on WhatsApp</a>
        <p class="small">Or see: ${CATS.filter((x) => !x.soon).map((x) => `<a class="btn-link" href="#/c/${x.slug}">${esc(x.short)}</a>`).join(' · ')}</p></div>`;
    } else if (st === 'loading') body = `<div class="ccols" aria-busy="true">${Array.from({ length: 8 }, skelTile).join('')}</div>`;
    else if (st === 'error') body = `<div class="empty" role="alert" style="margin:24px 0 56px"><span class="ring">${icon('wifioff')}</span><h2>We couldn't load the collections</h2><p>Check your connection and try again.</p><button type="button" class="btn btn-primary" data-act="retry">Try again</button></div>`;
    else body = `<div class="ccols" role="list" aria-label="Collections">${cols.map((x, i) => colTile(x, i).replace('<a ', '<a role="listitem" ')).join('')}</div>`;
    const head = c.soon ? '' : `<div class="choose"><div><span class="eyebrow">Choose a collection</span><h2 id="h-cols">${count(cols.length, 'collection', 'collections')}</h2></div><p>${cols.length > 1 ? `${opt('order') === 'b' ? 'A to Z' : 'The most pieces first'} · tap one to see its sarees` : 'Tap it to see its sarees'}</p></div>`;
    const all = !c.soon && opt('catpage') === 'b' && !st ? `<section aria-labelledby="h-allc" class="cat-all"><h2 class="sr-only" id="h-allc">All ${count(c.count, 'piece', 'pieces')}</h2>${listingBody({ title: `All ${count(c.count, 'piece', 'pieces')}`, scope: NH.products.filter((p) => p.category === c.slug), fixed: { cat: true }, path: `/c/${c.slug}`, q: r.q }).replace('<h1', '<h2').replace('</h1>', '</h2>')}</section>` : '';
    return shell(`${banner}<div class="wrap"><section aria-labelledby="h-cols">${head}${body}</section>${all}<div style="height:clamp(24px,4vw,56px)"></div></div>`, { active: c.slug });
  }
  let lst = { key: '', shown: PAGE, sets: false, sort: 'new', cols: 4 };
  try { lst.cols = localStorage.getItem('w11mock.cols') === '3' ? 3 : 4; } catch { /* private mode */ }
  function collectionPage(r, c) {
    const st = r.q.get('state');
    const cat = catBy.get(c.category);
    const craft = craftBy.get(c.craft);
    const all = NH.products.filter((p) => p.collection.id === c.id);
    if (lst.key !== c.id) lst = { key: c.id, shown: PAGE, sets: false, sort: 'new', cols: lst.cols };
    const items = sorted(all.filter((p) => !lst.sets || p.available > 1), lst.sort);
    const shown = items.slice(0, lst.shown);
    const sets = all.filter((p) => p.available > 1).length;
    const sibs = colsOf(c.category);
    const chips = opt('colnav') === 'b' && sibs.length > 1 ? `<nav class="chip-row sibs" aria-label="Other collections in ${esc(cat.short)}">${sibs.map((x) => `<a class="chip${x.id === c.id ? ' on' : ''}" href="#/collection/${x.id}"${x.id === c.id ? ' aria-current="page"' : ''}>${esc(x.name)} <small>${n(x.count)}</small></a>`).join('')}</nav>` : '';
    let body;
    if (st === 'loading') body = `<div class="grid" aria-busy="true">${Array.from({ length: 8 }, skelCard).join('')}</div>`;
    else if (st === 'error') body = `<div class="empty" role="alert"><span class="ring">${icon('wifioff')}</span><h2>We couldn't load the sarees</h2><p>Check your connection and try again.</p><button type="button" class="btn btn-primary" data-act="retry">Try again</button></div>`;
    else if (st === 'soldout' || !all.length) body = `<div class="empty"><span class="ring">${icon('box')}</span><h2>Everything in this collection has sold out</h2><p>New pieces come in every week. Ask us on WhatsApp for one like it, or see the other collections.</p><a class="btn btn-primary" href="#/c/${c.category}">See ${esc(cat.short)}</a></div>`;
    else {
      body = `<div class="ctool"><div class="l">${sets ? `<button type="button" class="chip" aria-pressed="${lst.sets}" data-csets>Sets only</button>` : ''}<span class="count" role="status" aria-live="polite">${count(items.length, 'saree', 'sarees')}</span></div>
        <div class="r"><label class="sr-only" for="csort">Sort by</label><select id="csort" class="select" data-csort>${Object.entries(SORTS).map(([k, [l]]) => `<option value="${k}"${lst.sort === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <div class="density" role="group" aria-label="Grid size"><button type="button" aria-pressed="${lst.cols === 3}" aria-label="Bigger photos, 3 in a row" data-ccols="3">${icon('g3')}</button><button type="button" aria-pressed="${lst.cols === 4}" aria-label="Smaller photos, 4 in a row" data-ccols="4">${icon('g4')}</button></div></div></div>
        <div class="grid cgrid c${lst.cols}">${shown.map(card).join('')}</div>
        ${items.length > shown.length ? `<div class="more-wrap"><span class="muted small">You've seen ${n(shown.length)} of ${n(items.length)}</span><span class="bar"><i style="width:${Math.round((shown.length / items.length) * 100)}%"></i></span><button type="button" class="btn" data-cmore>Load more</button></div>` : (items.length > PAGE ? `<div class="more-wrap"><span class="muted small">You've seen all ${n(items.length)}</span></div>` : '')}`;
    }
    return shell(`<div class="wrap">${crumbs([['Home', '#/'], [cat.short, `#/c/${cat.slug}`], [c.name, '']])}<div class="chead">${craft ? `<span class="eyebrow">${esc(craft.name)}</span>` : ''}<h1>${esc(c.name)}</h1>
      <p class="meta">${count(c.count, 'piece', 'pieces')} · ${rs(c.price)} each${c.sets ? ` · ${n(c.sets)} available as sets` : ''}</p>${c.description ? `<p class="desc">${esc(c.description)}</p>` : ''}${chips}</div>${body}<div style="height:clamp(40px,6vw,80px)"></div></div>`, { active: c.category });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-csets], [data-ccols], [data-cmore]');
    if (!b) return;
    const y = window.scrollY;
    if (b.hasAttribute('data-csets')) { lst.sets = !lst.sets; lst.shown = PAGE; }
    if (b.hasAttribute('data-ccols')) { lst.cols = Number(b.dataset.ccols); try { localStorage.setItem('w11mock.cols', String(lst.cols)); } catch { /* private mode */ } }
    if (b.hasAttribute('data-cmore')) lst.shown += PAGE;
    render();
    window.scrollTo(0, y);
  });
  document.addEventListener('change', (e) => {
    if (!e.target.matches('[data-csort]')) return;
    const y = window.scrollY;
    lst.sort = e.target.value; lst.shown = PAGE;
    render();
    window.scrollTo(0, y);
  });

  /* ---------- The saree page ---------- */
  let qtyFor = {};
  function pdp(r) {
    const p = bySlug.get(r.parts[1]);
    if (!p) return notFound('This saree isn\'t on the website now', 'It may have sold out. Take a look at what\'s new instead.');
    const sold = r.q.get('state') === 'soldout';
    const col = colBy.get(p.collection.id);
    const cat = catBy.get(p.category);
    const inBag = bag.find((l) => l.slug === p.slug);
    const set = p.available > 1;
    const qty = Math.min(qtyFor[p.slug] || 1, p.available);
    const more = NH.products.filter((x) => x.collection.id === p.collection.id && x.slug !== p.slug).slice(0, 10);
    const like = NH.products.filter((x) => x.craft === p.craft && x.collection.id !== p.collection.id).sort(SORTS.new[1]).slice(0, 10);
    const waText = sold ? `Hello, this saree is sold out. Do you have a similar one?\n${p.name}\nCode: ${p.sku}\n${productUrl(p)}` : `Hello, I'd like to order this saree:\n${p.name}\nCode: ${p.sku}\nPrice: ${rs(p.price)}\n${productUrl(p)}`;
    const stock = sold ? '<p class="stockline out"><span class="dot"></span>Sold out</p>' : set ? `<p class="stockline"><span class="dot"></span>In stock: ${p.available} identical pieces (a set)</p>` : '<p class="stockline one"><span class="dot"></span>Only 1 piece: one of a kind</p>';
    const buy = sold
      ? `<div class="alert warn">${icon('alert')}<div><b>This saree has sold</b>We often have one like it. Ask us on WhatsApp and we'll send photos.</div></div><a class="btn btn-wa btn-lg btn-block" href="${waLink(waText)}">${icon('whatsapp', 'ico-sm')}Ask for a similar saree</a>`
      : `${set ? `<div class="row-wrap"><span class="label" style="margin:0">Pieces</span><div class="qty" role="group" aria-label="Pieces"><button type="button" data-qty="-1" aria-label="One piece less"${qty <= 1 ? ' disabled' : ''}>${icon('minus')}</button><output aria-live="polite">${qty}</output><button type="button" data-qty="1" aria-label="One piece more"${qty >= p.available ? ' disabled' : ''}>${icon('plus')}</button></div><span class="muted small">of ${p.available}</span></div>` : ''}
        <div class="buy-acts"><button type="button" class="btn ${inBag ? '' : 'btn-primary'} btn-lg" data-add="${p.slug}" data-qty-add>${icon(inBag ? 'check' : 'bag', 'ico-sm')}${inBag ? 'In your bag' : 'Add to bag'}</button><button type="button" class="btn btn-dark btn-lg" data-buy="${p.slug}">Buy now</button></div>
        <a class="btn btn-wa btn-block" href="${waLink(waText)}">${icon('whatsapp', 'ico-sm')}Order on WhatsApp instead</a>`;
    const gal = `<div class="gallery"><button type="button" class="main" data-zoom="${p.photos[0].src}" aria-label="See the photo full screen"><img src="${p.photos[0].src}" alt="${esc(p.photos[0].alt)}" width="600" height="800"><span class="zoom" aria-hidden="true">${icon('zoom')}</span></button>
      ${p.photos.length > 1 ? `<div class="thumbs">${p.photos.map((ph, i) => `<button type="button" aria-pressed="${i === 0}" data-thumb="${ph.src}" aria-label="Photo ${i + 1}"><img src="${ph.src}" alt=""></button>`).join('')}</div>` : '<p class="note">One photo of this saree today. More angles (pallu, border, blouse) would help customers decide. <span class="mock-tag">Content tip</span></p>'}</div>`;
    const box = `<div class="buybox">
      <p class="col">${p.craftName ? `<span>${esc(p.craftName)}</span><span aria-hidden="true">·</span>` : ''}<a href="#/collection/${p.collection.id}">${esc(p.collection.name)}</a></p>
      <h1>${esc(p.name)}</h1>
      <div class="code"><span>Code <b>${esc(p.sku)}</b></span><button type="button" class="btn-link small" data-share="${p.slug}">${icon('share', 'ico-sm')} Share</button></div>
      <div class="pricebox"><span class="price">${rs(p.price)}</span><small>Inclusive of all taxes · Free delivery across India</small></div>
      ${stock}${buy}
      <div class="pin-check"><label class="label" for="pin" style="margin:0">Check delivery</label><form data-pin><input id="pin" class="input" inputmode="numeric" maxlength="6" placeholder="Your pincode" autocomplete="postal-code"><button class="btn" type="submit">Check</button></form><p class="res" data-pin-res aria-live="polite"></p></div>
      <div class="assure"><div>${icon('truck')}Free delivery across India</div><div>${icon('thread')}Handwoven in Old Mangalagiri</div><div>${icon('shield')}Secure payment</div><div>${icon('whatsapp')}Help on WhatsApp</div></div>
      <div class="acc">
        <details open><summary>About this saree${icon('down')}</summary><div class="in"><p>${esc(p.description || cat?.description || '')}</p></div></details>
        <details${p.highlights.length ? '' : ' hidden'}><summary>Saree details${icon('down')}</summary><div class="in"><ul>${p.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div></details>
        <details><summary>Delivery and returns${icon('down')}</summary><div class="in"><p>Free delivery anywhere in India by DTDC, usually in 3 to 7 days. We pack within 2 working days.</p><p>Questions or a problem with your order? Message us on WhatsApp at ${mobileText(NH.store.phone)}.</p><p>${tag('Owner to confirm times and the return rule')}</p></div></details>
      </div></div>`;
    const rail = (title, items, id) => (items.length ? `<section class="block" aria-labelledby="${id}"><div class="block-head"><h2 class="display" id="${id}">${esc(title)}</h2></div><div class="rail" tabindex="0" role="region" aria-label="${esc(title)}">${items.map(card).join('')}</div></section>` : '');
    return shell(`<div class="wrap">${crumbs([['Home', '#/'], [cat?.short || 'Sarees', `#/c/${p.category}`], [p.collection.name, `#/collection/${p.collection.id}`], [p.sku, '']])}
      <div class="pdp">${gal}${box}</div>
      ${rail('More from this collection', more, 'h-more')}${rail('You may also like', like, 'h-like')}
      <div style="height:48px"></div>
      ${sold ? '' : `<div class="sticky-buy"><div><span class="price">${rs(p.price)}</span><small>${set ? `${p.available} in stock` : 'Only 1 piece'}</small></div><button type="button" class="btn ${inBag ? '' : 'btn-primary'}" data-add="${p.slug}" data-qty-add>${inBag ? 'In your bag' : 'Add to bag'}</button></div>`}</div>`, { active: p.category });
  }

  /* ---------- Bag ---------- */
  function bagLinesHtml(lines) {
    return lines.map((l) => `<div class="bline"><a class="ph" href="#/p/${l.p.slug}" tabindex="-1" aria-hidden="true"><img src="${l.p.photos[0].src}" alt=""></a>
      <div class="t"><a href="#/p/${l.p.slug}"><b>${esc(l.p.name)}</b></a><small>Code ${esc(l.p.sku)} · ${l.p.available > 1 ? `Set: ${l.p.available} in stock` : 'Single piece'}</small>
        <div class="row">${l.p.available > 1 ? `<div class="qty" role="group" aria-label="Pieces of ${esc(l.p.name)}"><button type="button" data-bq="${l.p.slug}" data-d="-1" aria-label="One piece less"${l.qty <= 1 ? ' disabled' : ''}>${icon('minus', 'ico-sm')}</button><output>${l.qty}</output><button type="button" data-bq="${l.p.slug}" data-d="1" aria-label="One piece more"${l.qty >= l.p.available ? ' disabled' : ''}>${icon('plus', 'ico-sm')}</button></div>` : '<span class="muted small">1 piece</span>'}<button type="button" class="rm" data-rm="${l.p.slug}">${icon('trash', 'ico-sm')}Remove</button></div></div>
      <span class="price">${rs(l.p.price * l.qty)}</span></div>`).join('');
  }
  function sumBox({ cta = true } = {}) {
    const t = bagTotal();
    return `<div class="sumbox"><h2>Order summary</h2><div class="r"><span>Subtotal (${count(bagCount(), 'piece', 'pieces')})</span><span>${rs(t)}</span></div><div class="r"><span>Delivery</span><span class="free">Free</span></div><div class="r tot"><span>Total</span><span>${rs(t)}</span></div><p class="note">Includes GST. Sarees in your bag aren't held for you: our store sells them too.</p>
      ${cta ? `<a class="btn btn-primary btn-lg btn-block" href="#/checkout">${icon('lock', 'ico-sm')}Checkout</a><a class="btn btn-wa btn-block" href="${waLink(bagMessage())}">${icon('whatsapp', 'ico-sm')}Order on WhatsApp instead</a><p class="pay-methods"><span>${icon('upi', 'ico-sm')}UPI</span><span>${icon('card', 'ico-sm')}Cards</span><span>${icon('bank', 'ico-sm')}Net banking</span></p>` : ''}</div>`;
  }
  function bagMessage() {
    const rows = bagLines().map((l, i) => `${i + 1}. ${l.p.name}\n   Code ${l.p.sku} · ${l.qty > 1 ? `${l.qty} pieces × ${rs(l.p.price)} = ${rs(l.qty * l.p.price)}` : `1 piece · ${rs(l.p.price)}`}\n   ${productUrl(l.p)}`);
    return `Hello Nandam Handlooms, I'd like to order these sarees from my bag:\n\n${rows.join('\n')}\n\nTotal: ${rs(bagTotal())} (${count(bagCount(), 'piece', 'pieces')}, free delivery)`;
  }
  const emptyBag = () => `<div class="empty"><span class="ring">${icon('bag')}</span><h2>Your bag is empty</h2><p>Add the sarees you like and check out in a minute, or order them on WhatsApp.</p><a class="btn btn-primary" href="#/all">Shop sarees</a></div>`;
  function bagPage(r) {
    if (r.q.get('state') === 'empty' && bag.length) { bag = []; saveBag(); }
    const lines = bagLines();
    return shell(`<div class="wrap">${crumbs([['Home', '#/'], ['Bag', '']])}<div class="list-head"><div><h1 class="display">Your bag</h1>${lines.length ? `<p class="count">${count(bagCount(), 'piece', 'pieces')}</p>` : ''}</div></div>
      ${lines.length ? `<div class="two-col"><div>${bagLinesHtml(lines)}<p style="margin-top:1rem"><a class="btn-link" href="#/all">Continue shopping</a></p></div><aside>${sumBox()}</aside></div>` : `<div style="padding-bottom:56px">${emptyBag()}</div>`}</div>`);
  }

  /* ---------- Sign in ---------- */
  let auth = { mobile: '', tries: 3, wrong: false, newbie: false };
  function signin(r) {
    const next = r.q.get('next') || '/';
    let step = r.q.get('step') || 'mobile';
    if (step !== 'mobile' && !auth.mobile) auth.mobile = step === 'profile' ? '9000000001' : PRIYA.mobile; // opened straight from the screen list
    if (step === 'wrong') { auth.wrong = true; auth.tries = 2; step = 'code'; }
    const bar = (k) => `<div class="steps" aria-hidden="true">${['mobile', 'code', 'profile'].map((s, i) => `<i class="${i <= ['mobile', 'code', 'profile'].indexOf(k) ? 'on' : ''}"></i>`).join('')}</div>`;
    let body;
    if (step === 'mobile') {
      body = `${bar('mobile')}<h1>Sign in or create an account</h1><p class="muted">Enter your mobile number. We'll text you a code: no password to remember.</p>
        <form class="field" data-auth="mobile" novalidate><label class="label" for="mob">Mobile number</label><div class="mob-input"><span>+91</span><input id="mob" inputmode="numeric" autocomplete="tel-national" maxlength="11" placeholder="98765 43210" value="${esc(auth.mobile ? `${auth.mobile.slice(0, 5)} ${auth.mobile.slice(5)}` : '')}"></div><p class="err" data-err hidden></p>
        <button class="btn btn-primary btn-lg btn-block" type="submit" style="margin-top:.6rem">Send code</button></form>
        <p class="muted small">Any 10-digit number works in this mock-up. ${tag('Sample')} 98765 43210 is a returning customer with saved addresses.</p>`;
    } else if (step === 'code') {
      body = `${bar('code')}<h1>Enter the code</h1><p class="muted">We sent a 6-digit code to <b>${mobileText(auth.mobile)}</b>. <a class="btn-link" href="${withQ('/signin', new URLSearchParams({ next }))}">Change</a></p>
        <form data-auth="code" novalidate><div class="otp${auth.wrong ? ' is-bad' : ''}" role="group" aria-label="The 6-digit code">${Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" maxlength="1" aria-label="Digit ${i + 1}" autocomplete="${i ? 'off' : 'one-time-code'}">`).join('')}</div>
        ${auth.wrong ? `<p class="err" role="alert" style="margin-top:.5rem">That code isn't right. ${count(auth.tries, 'try', 'tries')} left.</p>` : ''}
        <button class="btn btn-primary btn-lg btn-block" type="submit" style="margin-top:.9rem">Continue</button></form>
        <p class="muted small">Didn't get it? You can ask for a new code in 0:${String(Math.max(0, 42)).padStart(2, '0')}. ${tag('Sample code: 123456')}</p>`;
    } else {
      body = `${bar('profile')}<h1>Welcome! What's your name?</h1><p class="muted">For your orders and the delivery. You can change it later in My account.</p>
        <form class="form-grid" data-auth="profile" novalidate><div class="field full"><label class="label" for="nm">Full name</label><input id="nm" class="input" autocomplete="name" placeholder="As on the parcel"><p class="err" data-err hidden></p></div>
        <div class="field full"><label class="label" for="em">Email <span class="muted">(optional, for the invoice)</span></label><input id="em" class="input" type="email" autocomplete="email"></div>
        <button class="btn btn-primary btn-lg btn-block full" type="submit">Continue</button></form>`;
    }
    return shell(`<div class="wrap"><div class="auth">${body}</div></div>`, { plain: /checkout/.test(next) });
  }
  function signedIn(person, next) {
    me = person; write(sessionStorage, 'me', me);
    auth = { mobile: '', tries: 3, wrong: false, newbie: false };
    toast(`Welcome${person.addresses?.length ? ' back' : ''}, ${first(person.name)}`);
    go(`#${next}`);
  }

  /* ---------- Checkout ---------- */
  let co = { addr: null, adding: false, pay: 'upi' };
  function sampleSetup(r) {
    // Opened straight from the screen list: a sample customer and bag, so the screen has content.
    let note = '';
    if (!me) { me = { ...PRIYA }; write(sessionStorage, 'me', me); note = ' sample customer'; }
    if (!bag.length) { bag = [{ slug: newest[0].slug, qty: 1 }, { slug: (NH.products.find((p) => p.available > 1) || newest[1]).slug, qty: 2 }]; saveBag(); note += `${note ? ' and' : ''} sample bag`; }
    return note ? `<p style="margin:.4rem 0 0">${tag(`Opened directly:${note}`)}</p>` : '';
  }
  function coSteps(at) {
    const s = [['Sign in', 'signin'], ['Delivery address', 'addr'], ['Review and pay', 'pay']];
    const idx = s.findIndex((x) => x[1] === at);
    return `<div class="co-steps" aria-label="Checkout steps">${s.map(([l], i) => `<span class="${i < idx ? 'done' : i === idx ? 'on' : ''}"${i === idx ? ' aria-current="step"' : ''}><i>${i < idx ? icon('check', 'ico-sm') : i + 1}</i>${l}</span>${i < s.length - 1 ? '<span class="line" aria-hidden="true"></span>' : ''}`).join('')}</div>`;
  }
  const addrText = (a) => `${esc(a.fullName)} · ${mobileText(a.phone)}<br>${esc(a.line1)}${a.line2 ? `, ${esc(a.line2)}` : ''}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.pincode)}`;
  function checkout(r) {
    const note = sampleSetup(r);
    const step = r.q.get('step') === 'pay' ? 'pay' : 'addr';
    const addrs = me.addresses || [];
    if (!co.addr && addrs.length) co.addr = addrs[0].id;
    const addr = addrs.find((a) => a.id === co.addr);
    const summary = `<aside><div class="sumbox"><h2>Your order</h2>${bagLines().map((l) => `<div class="r" style="align-items:center"><span style="display:flex;gap:.6rem;align-items:center;min-width:0"><img src="${l.p.photos[0].src}" alt="" style="width:38px;height:50px;object-fit:cover;border-radius:4px"><span style="min-width:0"><b style="font-weight:600;font-size:.86rem;display:block">${esc(l.p.name)}</b><small class="muted">${esc(l.p.sku)} · ${l.qty} × ${rs(l.p.price)}</small></span></span><span>${rs(l.qty * l.p.price)}</span></div>`).join('')}
      <div class="r"><span>Delivery</span><span class="free">Free</span></div><div class="r tot"><span>Total</span><span>${rs(bagTotal())}</span></div><p class="note">Includes GST. The sarees are held for 15 minutes while you pay.</p></div></aside>`;
    let left;
    if (step === 'addr') {
      const form = `<form class="form-grid" data-addr novalidate>
        <div class="field full"><label class="label" for="a-name">Full name</label><input id="a-name" class="input" autocomplete="name" value="${esc(addrs.length ? '' : me.name)}"></div>
        <div class="field"><label class="label" for="a-phone">Mobile</label><input id="a-phone" class="input" inputmode="numeric" maxlength="10" autocomplete="tel-national" value="${esc(me.mobile)}"></div>
        <div class="field"><label class="label" for="a-pin">Pincode</label><input id="a-pin" class="input" inputmode="numeric" maxlength="6" autocomplete="postal-code"><span class="hint" data-pin-hint>We fill in the city and state.</span></div>
        <div class="field full"><label class="label" for="a-l1">House, flat, street</label><input id="a-l1" class="input" autocomplete="address-line1"></div>
        <div class="field full"><label class="label" for="a-l2">Area, landmark <span class="muted">(optional)</span></label><input id="a-l2" class="input" autocomplete="address-line2"></div>
        <div class="field"><label class="label" for="a-city">City</label><input id="a-city" class="input" autocomplete="address-level2"></div>
        <div class="field"><label class="label" for="a-state">State</label><select id="a-state" class="select"><option value="">Choose…</option>${STATES.map((s) => `<option>${esc(s)}</option>`).join('')}</select></div>
        <p class="err full" data-err hidden></p>
        <button class="btn btn-primary btn-lg full" type="submit">Deliver here</button></form>`;
      left = `<div class="panel"><h2>Where should we deliver?</h2>
        ${addrs.length && !co.adding ? `<div role="radiogroup" aria-label="Saved addresses" style="display:grid;gap:.6rem">${addrs.map((a) => `<label class="addr"><input type="radio" name="addr" value="${a.id}"${co.addr === a.id ? ' checked' : ''}><span><b>${esc(a.label)}</b><span>${addrText(a)}</span></span></label>`).join('')}</div>
          <button type="button" class="btn" data-act="add-addr">${icon('plus', 'ico-sm')}Add a new address</button><a class="btn btn-primary btn-lg" href="#/checkout?step=pay" data-act="to-pay">Deliver here</a>` : form}</div>`;
    } else {
      const fail = r.q.get('state') === 'payfail';
      const a = addr || addrs[0] || PRIYA.addresses[0];
      left = `<div class="panel">${fail ? `<div class="alert bad" role="alert">${icon('alertc')}<div><b>The payment didn't go through</b>No money was taken. Try again, choose another way to pay, or order on WhatsApp.</div></div>` : ''}
        <h2>Deliver to</h2><div class="addr" style="cursor:default"><span>${icon('pin')}</span><span>${addrText(a)}</span></div><a class="btn-link small" href="#/checkout">Change the address</a>
        <h2>Pieces</h2>${bagLinesHtml(bagLines())}
        <button type="button" class="btn btn-primary btn-lg" data-act="pay">${icon('lock', 'ico-sm')}Pay ${rs(bagTotal())} securely</button>
        <p class="pay-methods"><span>${icon('upi', 'ico-sm')}UPI</span><span>${icon('card', 'ico-sm')}Cards</span><span>${icon('bank', 'ico-sm')}Net banking</span><span>Razorpay</span></p>
        <a class="btn btn-wa" href="${waLink(bagMessage())}">${icon('whatsapp', 'ico-sm')}Order on WhatsApp instead</a></div>`;
    }
    return shell(`<div class="wrap"><h1 class="display co-title">Checkout</h1>${coSteps(step)}${note}<div class="two-col">${bagLines().length ? `<div>${left}</div>${summary}` : `<div>${emptyBag()}</div>`}</div></div>`, { plain: true });
  }
  function payWindow() {
    const ways = [['upi', 'upi', 'UPI', 'Google Pay, PhonePe, Paytm, any UPI app'], ['card', 'card', 'Card', 'Visa, Mastercard, RuPay'], ['bank', 'bank', 'Net banking', 'All Indian banks']];
    overlay(`<div class="modal rzp" role="dialog" aria-modal="true" aria-labelledby="rzp-h"><div class="rh"><div><b id="rzp-h">Nandam Handlooms</b><small>Razorpay secure checkout ${'·'} ${rs(bagTotal())}</small></div><button type="button" class="btn-icon" data-close aria-label="Close the payment window" style="color:#fff">${icon('x')}</button></div>
      <div class="rb"><p class="muted small">${tag('Stand-in for Razorpay')} The real window is Razorpay's own.</p>${ways.map(([k, ic, t, s]) => `<button type="button" class="way" data-way="${k}" aria-pressed="${co.pay === k}">${icon(ic)}<span>${t}<small>${s}</small></span></button>`).join('')}
      <button type="button" class="btn btn-primary btn-lg btn-block" data-act="paid">Pay ${rs(bagTotal())}</button><button type="button" class="btn btn-block" data-act="payfail">Try a failed payment</button></div></div>`, { modal: true });
  }
  function placeOrder() {
    const no = `NH${String(25200000 + Math.floor(Math.random() * 99999)).padStart(8, '0')}`;
    const a = (me.addresses || []).find((x) => x.id === co.addr) || (me.addresses || [])[0] || PRIYA.addresses[0];
    const items = bagLines().map((l) => ({ slug: l.p.slug, sku: l.p.sku, name: l.p.name, price: l.p.price, qty: l.qty, photo: l.p.photos[0].src }));
    const order = { no, at: new Date().toISOString(), status: 'paid', items, total: items.reduce((s, i) => s + i.price * i.qty, 0), address: a, pay: co.pay === 'upi' ? 'UPI' : co.pay === 'card' ? 'Card' : 'Net banking' };
    placed = [order, ...placed].slice(0, 10); write(localStorage, 'orders', placed);
    bag = []; saveBag();
    closeOverlay();
    go(`#/order/${no}`);
  }
  function orderPlaced(r) {
    let o = r.parts[1] === 'latest' ? placed[0] : allOrders().find((x) => x.no === r.parts[1]);
    let sample = '';
    if (!o) { o = { ...SAMPLE_ORDERS[0], no: 'NH25200417', status: 'paid', at: new Date().toISOString() }; sample = tag('Sample order'); }
    const who = me ? first(me.name) : 'Priya';
    return shell(`<div class="wrap" style="max-width:860px"><div class="done-hero"><span class="tick">${icon('check')}</span><h1>Thank you, ${esc(who)}! Your order is placed</h1><p class="muted">Order <b>${esc(o.no)}</b> · paid ${rs(o.total)} by ${esc(o.pay)} · ${dateText(o.at)} ${sample}</p></div>
      <ol class="next-steps" aria-label="What happens next"><li class="on">${icon('check')}<b>Paid</b><small>Just now</small></li><li>${icon('box')}<b>Packed</b><small>Within 2 working days</small></li><li>${icon('truck')}<b>Shipped by DTDC</b><small>Tracking in My orders</small></li><li>${icon('home')}<b>Delivered</b><small>Usually 3 to 7 days</small></li></ol>
      <p class="muted small" style="margin-top:.6rem">${tag('Owner to confirm times')}</p>
      <div class="two-col halves"><div class="panel"><h2>Pieces</h2>${o.items.map((i) => `<div class="r" style="display:flex;gap:.7rem;align-items:center"><img src="${i.photo}" alt="" style="width:44px;height:58px;object-fit:cover;border-radius:4px"><span style="flex:1;min-width:0"><b style="font-weight:600;font-size:.9rem">${esc(i.name)}</b><br><small class="muted">${esc(i.sku)} · ${i.qty} × ${rs(i.price)}</small></span><b>${rs(i.qty * i.price)}</b></div>`).join('')}</div>
      <div class="panel"><h2>Delivering to</h2><p>${addrText(o.address)}</p><div class="row-wrap"><a class="btn btn-primary" href="#/orders/${o.no}">See my order</a><a class="btn" href="#/all">Continue shopping</a></div></div></div></div>`, { fab: false });
  }

  /* ---------- My orders ---------- */
  const STATUS = { paid: ['Paid · being packed', 'info'], shipped: ['Shipped', 'warn'], delivered: ['Delivered', 'ok'] };
  function orders(r) {
    if (!me) { me = { ...PRIYA }; write(sessionStorage, 'me', me); }
    const list2 = r.q.get('state') === 'empty' ? [] : allOrders();
    const body = list2.length ? `<div style="display:grid;gap:.8rem;padding-bottom:56px">${list2.map((o) => `<a class="ocard" href="#/orders/${o.no}"><div class="top"><div><b>Order ${esc(o.no)}</b><small>${dateText(o.at)} · ${count(o.items.reduce((s, i) => s + i.qty, 0), 'piece', 'pieces')}</small></div><span class="badge ${STATUS[o.status][1]}">${STATUS[o.status][0]}</span></div>
      <div class="thumbs">${o.items.map((i) => `<img src="${i.photo}" alt="">`).join('')}</div><div class="bot"><span class="price">${rs(o.total)}</span><span class="muted small">${o.sample ? tag('Sample') : ''} View details ›</span></div></a>`).join('')}</div>`
      : `<div style="padding-bottom:56px"><div class="empty"><span class="ring">${icon('box')}</span><h2>No orders yet</h2><p>When you buy on the website, your orders show here with their tracking number and invoice.</p><a class="btn btn-primary" href="#/all">Shop sarees</a></div></div>`;
    return shell(`<div class="wrap" style="max-width:900px">${crumbs([['Home', '#/'], ['My orders', '']])}<div class="list-head"><div><h1 class="display">My orders</h1><p class="count">Signed in as ${esc(me.name)} · ${mobileText(me.mobile)}</p></div><button type="button" class="btn btn-sm" data-act="signout">${icon('logout', 'ico-sm')}Sign out</button></div>${body}</div>`);
  }
  function orderDetail(r) {
    const o = allOrders().find((x) => x.no === r.parts[1]);
    if (!o) return notFound('We couldn\'t find that order', 'Check the order number, or see all your orders.');
    const steps = [['check', 'Paid', dateText(o.at)], ['box', 'Packed', o.shippedAt ? dateText(o.shippedAt) : 'Within 2 working days'], ['truck', 'Shipped', o.shippedAt ? `${dateText(o.shippedAt)} · ${o.courier}` : 'Tracking number here'], ['home', 'Delivered', o.deliveredAt ? dateText(o.deliveredAt) : 'Usually 3 to 7 days']];
    const at = o.status === 'delivered' ? 4 : o.status === 'shipped' ? 3 : 1;
    return shell(`<div class="wrap" style="max-width:980px">${crumbs([['Home', '#/'], ['My orders', '#/orders'], [o.no, '']])}
      <div class="list-head"><div><h1 class="display">Order ${esc(o.no)}</h1><p class="count">${dateText(o.at)} · ${rs(o.total)} paid by ${esc(o.pay)} ${o.sample ? tag('Sample') : ''}</p></div><span class="badge ${STATUS[o.status][1]}">${STATUS[o.status][0]}</span></div>
      <div class="two-col aside-360"><div style="display:grid;gap:1rem">
        <div class="panel"><h2>Where it is</h2><ol class="timeline">${steps.map(([ic, t, s], i) => `<li class="${i < at - 1 || at === 4 ? 'done' : i === at - 1 ? 'now' : ''}"><i>${icon(ic, 'ico-sm')}</i><span><b>${t}</b><small>${esc(s)}</small></span></li>`).join('')}</ol>
        ${o.awb ? `<div class="alert info">${icon('truck')}<div><b>${esc(o.courier)} tracking number: ${esc(o.awb)}</b><div class="row-wrap" style="margin-top:.5rem"><button type="button" class="btn btn-sm" data-copy="${esc(o.awb)}">${icon('copy', 'ico-sm')}Copy</button><a class="btn btn-sm" href="https://www.dtdc.in/tracking.asp">Track on DTDC ${icon('external', 'ico-sm')}</a></div></div></div>` : ''}</div>
        <div class="panel"><h2>Pieces</h2>${o.items.map((i) => `<div style="display:flex;gap:.7rem;align-items:center"><img src="${i.photo}" alt="" style="width:52px;height:68px;object-fit:cover;border-radius:4px"><span style="flex:1;min-width:0"><a href="#/p/${i.slug}"><b style="font-weight:600">${esc(i.name)}</b></a><br><small class="muted">${esc(i.sku)} · ${i.qty} × ${rs(i.price)}</small></span><b>${rs(i.qty * i.price)}</b></div>`).join('')}
          <div class="row-wrap"><button type="button" class="btn btn-sm" data-act="invoice">${icon('download', 'ico-sm')}GST invoice (PDF)</button><button type="button" class="btn btn-sm" data-again="${o.no}">${icon('refresh', 'ico-sm')}Buy again</button></div></div></div>
        <aside style="display:grid;gap:1rem"><div class="panel"><h2>Delivering to</h2><p>${addrText(o.address)}</p></div><div class="panel"><h2>Need help?</h2><p class="muted">To change or cancel, message us with your order number.</p><a class="btn btn-wa" href="${waLink(`Hello, about my order ${o.no}`)}">${icon('whatsapp', 'ico-sm')}WhatsApp us</a></div></aside></div></div>`);
  }

  function notFound(title = 'We couldn\'t find that page', text = 'The link may be old. Try the categories or search.') {
    return shell(`<div class="wrap" style="padding:36px 0 64px"><div class="empty"><span class="ring">${icon('search')}</span><h1 style="font-size:1.4rem">${esc(title)}</h1><p>${esc(text)}</p><a class="btn btn-primary" href="#/new">See what's new</a></div></div>`);
  }
  function infoPage(title) {
    return shell(`<div class="wrap" style="max-width:760px;padding:28px 0 64px"><h1 class="display" style="font-size:2rem">${esc(title)}</h1><p class="lead" style="margin-top:1rem">This page is the website's own ${esc(title.toLowerCase())} page, unchanged. ${tag('Not part of this mock-up')}</p></div>`);
  }

  /* ---------- Render ---------- */
  let lastPath = null;
  let lastPage = null;
  let keepSheet = null; // the phone filter sheet stays open while filters change
  function render() {
    if (!app) return; // the design kit page has no shop to draw
    closeOverlay(true);
    const r = route();
    const [a, b] = r.parts;
    let html;
    let states = [];
    if (!a) {
      html = homeA(r);
      states = [['normal', 'Normal'], ['loading', 'Loading'], ['error', 'Couldn\'t load']];
    } else if (a === 'all') {
      html = listingPage(r, { title: 'All sarees', scope: NH.products, path: '/all', active: 'all', crumbsList: [['Home', '#/'], ['All sarees', '']] });
      states = [['normal', 'Normal'], ['loading', 'Loading'], ['error', 'Couldn\'t load']];
    } else if (a === 'c' && catBy.has(b)) {
      html = categoryPage(r, catBy.get(b));
      if (!catBy.get(b).soon) states = [['normal', 'Normal'], ['loading', 'Loading'], ['error', 'Couldn\'t load']];
    } else if (a === 'collection' && colBy.has(b)) {
      html = collectionPage(r, colBy.get(b));
      states = [['normal', 'Normal'], ['loading', 'Loading'], ['error', 'Couldn\'t load'], ['soldout', 'All sold']];
    } else if (a === 'new') {
      html = listingPage(r, { title: 'New in', scope: NH.products.filter((p) => p.isNew), path: '/new', active: 'new', crumbsList: [['Home', '#/'], ['New in', '']] });
    } else if (a === 'sets') {
      html = listingPage(r, { title: 'Sets: more than one identical piece', scope: NH.products.filter((p) => p.available > 1), path: '/sets', active: 'sets', crumbsList: [['Home', '#/'], ['Sets', '']], intro: '<p class="muted" style="margin-top:.6rem">For sisters, mothers and daughters, or a family function: these designs have several identical pieces in stock.</p>' });
    } else if (a === 'search') {
      const q = r.q.get('q') || '';
      html = listingPage(r, { title: q ? `Results for "${q}"` : 'Search', scope: NH.products, path: '/search', active: '', crumbsList: [['Home', '#/'], ['Search', '']] });
    } else if (a === 'p') {
      html = pdp(r);
      states = [['normal', 'In stock'], ['soldout', 'Sold out']];
    } else if (a === 'bag') {
      html = bagPage(r);
      states = [['normal', 'With sarees'], ['empty', 'Empty']];
    } else if (a === 'signin') {
      html = signin(r);
      states = [['mobile', 'Mobile number'], ['code', 'SMS code'], ['wrong', 'Wrong code'], ['profile', 'New customer: name']];
    } else if (a === 'checkout') {
      if (!me && !r.q.get('step') && !r.q.get('direct')) { go(withQ('/signin', new URLSearchParams({ next: '/checkout' }))); return; }
      html = checkout(r);
      states = r.q.get('step') === 'pay' ? [['normal', 'Ready to pay'], ['payfail', 'Payment failed']] : [];
    } else if (a === 'order' && b) {
      html = orderPlaced(r);
    } else if (a === 'orders') {
      html = b ? orderDetail(r) : orders(r);
      if (!b) states = [['normal', 'With orders'], ['empty', 'No orders yet']];
    } else if (a === 'privacy' || a === 'terms') {
      html = infoPage(a === 'privacy' ? 'Privacy' : 'Terms');
    } else html = notFound();
    app.innerHTML = html;
    const path = r.path;
    const pg = r.q.get('page');
    if (path !== lastPath) { window.scrollTo(0, 0); lastPath = path; } else if (pg !== lastPage && !phone()) app.querySelector('.list-head')?.scrollIntoView({ block: 'start' });
    lastPage = pg;
    document.title = `${(document.querySelector('main h1')?.textContent || 'Nandam Handlooms').trim()} · Nandam Handlooms (mock-up)`;
    if (window.W10Opts) {
      const cur = a === 'signin' ? (r.q.get('step') || 'mobile') : (r.q.get('state') || (states[0] && states[0][0]));
      window.W10Opts.setStates(states, cur, pickState);
    }
    if (a === 'signin') { const f = app.querySelector('[data-auth] input'); if (f) f.focus(); }
    if (keepSheet) {
      const k = keepSheet; keepSheet = null;
      filterSheet();
      const again = k.f && ov && ov.el.querySelector(`[data-f="${k.f}"][value="${CSS.escape(k.v)}"]`);
      if (again) again.focus();
    }
  }
  function pickState(s) {
    const r = route();
    const q = new URLSearchParams(r.q);
    if (r.parts[0] === 'signin') { if (s === 'mobile') q.delete('step'); else q.set('step', s); auth.wrong = false; } else if (s === 'normal' || s === 'mobile') q.delete('state'); else q.set('state', s);
    if (s === 'empty' && r.parts[0] === 'bag') { bag = []; saveBag(); }
    if (r.parts[0] === 'bag' && s === 'normal' && !bag.length) { bag = [{ slug: newest[0].slug, qty: 1 }, { slug: newest[3].slug, qty: 1 }]; saveBag(); }
    go(withQ(r.path, q));
  }

  /* ---------- Overlays: menu, bag, filters, sort, photo, payment ---------- */
  let ov = null;
  function overlay(html, { modal = false, onClose } = {}) {
    closeOverlay(true);
    const back = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'ov';
    wrap.innerHTML = `<div class="scrim" data-close></div>${html}`;
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    ov = { el: wrap, back, onClose, modal };
    const f = wrap.querySelector('[data-close]:not(.scrim), button, a, input');
    if (f) f.focus();
  }
  function closeOverlay(quiet) {
    if (!ov) return;
    const { el, back, onClose } = ov;
    ov = null;
    el.remove();
    document.body.style.overflow = '';
    if (onClose) onClose();
    if (!quiet && back && document.contains(back)) back.focus();
  }
  function bagDrawer(justAdded) {
    const lines = bagLines();
    overlay(`<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="bag-h"><div class="dh"><h2 id="bag-h">Your bag${lines.length ? ` (${bagCount()})` : ''}</h2><button type="button" class="btn-icon" data-close aria-label="Close the bag">${icon('x')}</button></div>
      <div class="db">${justAdded ? `<div class="alert ok" style="margin-bottom:1rem">${icon('check')}<div><b>Added to your bag</b>${esc(bySlug.get(justAdded)?.name || '')}</div></div>` : ''}${lines.length ? bagLinesHtml(lines) : emptyBag()}</div>
      ${lines.length ? `<div class="df"><div class="r" style="display:flex;justify-content:space-between;font-weight:750;font-size:1.05rem"><span>Total</span><span>${rs(bagTotal())}</span></div><p class="muted small" style="margin-top:-.3rem">Free delivery · includes GST</p><a class="btn btn-primary btn-lg" href="#/checkout">${icon('lock', 'ico-sm')}Checkout</a><div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem"><a class="btn" href="#/bag">View bag</a><a class="btn btn-wa" href="${waLink(bagMessage())}">${icon('whatsapp', 'ico-sm')}WhatsApp</a></div></div>` : ''}</div>`);
  }
  function sideMenu() {
    overlay(`<div class="drawer left" role="dialog" aria-modal="true" aria-labelledby="menu-h"><div class="dh"><a class="logo" href="#/"><img src="img/logo-96.png" alt="" width="36" height="36"><span class="wm"><b id="menu-h">Nandam</b></span></a><button type="button" class="btn-icon" data-close aria-label="Close the menu">${icon('x')}</button></div>
      <div class="db side-nav"><h4>Shop</h4><a href="#/all">All sarees <small>${n(NH.totals.sarees)}</small></a>${CATS.map((c) => `<a href="#/c/${c.slug}">${esc(c.short)} <small>${c.soon ? soonText : n(c.count)}</small></a>`).join('')}<a href="#/new">New in</a><a href="#/sets">Sets for the family</a>
      <h4>Crafts</h4>${NH.crafts.map((k) => `<a href="#/all?craft=${k.key}">${esc(k.name)} <small>${n(k.count)}</small></a>`).join('')}
      <h4>You</h4><a href="${me ? '#/orders' : '#/signin'}">${me ? 'My orders' : 'Sign in'}</a><a href="https://wa.me/${WA}">WhatsApp us <small>${mobileText(NH.store.phone)}</small></a></div></div>`);
  }
  function filterSheet() {
    const r = route();
    const scopeFor = () => {
      const [a, b] = r.parts;
      if (a === 'c') return [NH.products.filter((p) => p.category === b), { cat: true }];
      if (a === 'collection') return [NH.products.filter((p) => p.collection.id === b), { cat: true, col: true }];
      if (a === 'new') return [NH.products.filter((p) => p.isNew), {}];
      if (a === 'sets') return [NH.products.filter((p) => p.available > 1), {}];
      return [NH.products, {}];
    };
    const [scope, fixed] = scopeFor();
    const f = filtersOf(r.q);
    overlay(`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="fs-h"><div class="dh"><h2 id="fs-h">Filter</h2><button type="button" class="btn-icon" data-close aria-label="Close filters">${icon('x')}</button></div>
      <div class="db">${filterGroups(scope, f, fixed, 'sheet').map(([k, t, body]) => `<div class="fgroup"><button type="button" aria-expanded="${f[k] && (k === 'sets' ? f.sets : f[k].length) ? 'true' : 'false'}" aria-controls="fsheet-${k}" data-fg="${k}">${t}${icon('down', 'ico-sm')}</button><div class="opts"${f[k] && (k === 'sets' ? f.sets : f[k].length) ? '' : ' hidden'} id="fsheet-${k}">${body}</div></div>`).join('')}</div>
      <div class="df"><button type="button" class="btn" data-act="clear">Clear all</button><button type="button" class="btn btn-primary" data-close>Show ${count(apply(scope, f).length, 'saree', 'sarees')}</button></div></div>`);
  }
  function sortSheet() {
    const f = filtersOf(route().q);
    overlay(`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ss-h"><div class="dh"><h2 id="ss-h">Sort by</h2><button type="button" class="btn-icon" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="db" role="radiogroup" aria-label="Sort by">${Object.entries(SORTS).map(([k, [l]]) => `<label class="fopt" style="padding:.7rem 0"><input type="radio" name="sortm" value="${k}" data-sortm${f.sort === k ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>`);
  }

  /* ---------- Bag actions ---------- */
  function add(slug, qty = 1) {
    const p = bySlug.get(slug);
    if (!p) return;
    const line = bag.find((l) => l.slug === slug);
    if (line) {
      if (line.qty >= p.available) { toast(p.available > 1 ? `All ${p.available} pieces are in your bag` : 'This one-of-a-kind saree is already in your bag', { action: ['View bag', () => bagDrawer()] }); return; }
      line.qty = Math.min(p.available, line.qty + qty);
    } else bag.push({ slug, qty: Math.min(qty, p.available) });
    saveBag();
    render();
    const nEl = document.querySelector('[data-bag-n]');
    if (nEl && !noMotion()) nEl.classList.add('bump');
    bagDrawer(slug);
  }
  function setQty(slug, d) {
    const line = bag.find((l) => l.slug === slug);
    const p = bySlug.get(slug);
    if (!line || !p) return;
    line.qty = Math.max(1, Math.min(p.available, line.qty + d));
    saveBag();
    refreshBagViews();
  }
  function remove(slug) {
    const i = bag.findIndex((l) => l.slug === slug);
    if (i < 0) return;
    const [gone] = bag.splice(i, 1);
    saveBag();
    refreshBagViews();
    toast(`Removed ${bySlug.get(slug)?.name || 'the saree'}`, { action: ['Undo', () => { bag.splice(i, 0, gone); saveBag(); refreshBagViews(); }] });
  }
  function refreshBagViews() {
    const drawerOpen = ov && ov.el.querySelector('.drawer:not(.left)');
    render();
    if (drawerOpen) bagDrawer();
  }

  /* ---------- Toasts ---------- */
  let toastBox = null;
  function toast(text, { tone = '', action } = {}) {
    if (!toastBox || !document.body.contains(toastBox)) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; toastBox.setAttribute('aria-live', 'polite'); document.body.appendChild(toastBox); }
    const t = document.createElement('div');
    t.className = `toast ${tone}`;
    t.setAttribute('role', tone === 'bad' ? 'alert' : 'status');
    t.innerHTML = `${icon(tone === 'bad' ? 'alertc' : 'check')}<span>${esc(text)}</span>${action ? `<button type="button">${esc(action[0])}</button>` : '<span></span>'}`;
    if (action) t.querySelector('button').addEventListener('click', () => { t.remove(); action[1](); });
    toastBox.appendChild(t);
    while (toastBox.children.length > 2) toastBox.firstChild.remove();
    setTimeout(() => t.remove(), 4500);
  }

  /* ---------- Search suggestions ---------- */
  function suggest(form) {
    const input = form.querySelector('input');
    form.querySelector('.suggest')?.remove();
    const v = input.value.trim();
    if (v.length < 2) return;
    const cols = NH.collections.filter((c) => words(v).every((w) => c.name.toLowerCase().includes(w))).slice(0, 4);
    const crafts = NH.crafts.filter((k) => k.name.toLowerCase().includes(v.toLowerCase())).slice(0, 2);
    const items = NH.products.filter((p) => matches(p, v)).slice(0, 4);
    if (!cols.length && !crafts.length && !items.length) return;
    const box = document.createElement('div');
    box.className = 'suggest';
    box.innerHTML = `${crafts.length ? `<span class="h">Crafts</span>${crafts.map((k) => `<a href="#/all?craft=${k.key}">${esc(k.name)}<small>${n(k.count)}</small></a>`).join('')}` : ''}
      ${cols.length ? `<span class="h">Collections</span>${cols.map((c) => `<a href="#/collection/${c.id}">${esc(c.name)}<small>${n(c.count)}</small></a>`).join('')}` : ''}
      ${items.length ? `<span class="h">Sarees</span>${items.map((p) => `<a href="#/p/${p.slug}"><img src="${p.photos[0].src}" alt="">${esc(p.name)}<small>${rs(p.price)}</small></a>`).join('')}` : ''}
      <a href="#/search?q=${encodeURIComponent(v)}"><b>See all results for "${esc(v)}"</b></a>`;
    form.appendChild(box);
  }

  /* ---------- Events ---------- */
  function setFilter(key, value, on) {
    const r = route();
    const q = new URLSearchParams(r.q);
    if (key === 'sets') { if (on) q.set('sets', '1'); else q.delete('sets'); } else {
      const cur = list(q, key).filter((x) => x !== value);
      if (on) cur.push(value);
      if (cur.length) q.set(key, cur.join(',')); else q.delete(key);
    }
    q.delete('page'); q.delete('state');
    if (ov && ov.el.querySelector('.sheet')) keepSheet = { f: key, v: value };
    go(withQ(r.path, q));
  }
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('.mo-panel, .mo-fab')) return;
    if (!t.closest('form.search')) document.querySelectorAll('.suggest').forEach((s) => s.remove());
    const el = t.closest('[data-act], [data-add], [data-buy], [data-rm], [data-bq], [data-close], [data-unf], [data-zoom], [data-thumb], [data-share], [data-qty], [data-drop], [data-fg], [data-theme], [data-way], [data-copy], [data-again], a');
    if (!el) { document.querySelectorAll('.fdrop .pop:not([hidden])').forEach((p) => { if (!p.contains(t)) { p.hidden = true; p.previousElementSibling.setAttribute('aria-expanded', 'false'); } }); return; }
    if (el.hasAttribute('data-close')) { closeOverlay(); return; }
    if (el.dataset.add) { e.preventDefault(); const inBag = bag.find((l) => l.slug === el.dataset.add); if (inBag && !el.hasAttribute('data-qty-add')) { bagDrawer(); return; } add(el.dataset.add, el.hasAttribute('data-qty-add') ? (qtyFor[el.dataset.add] || 1) : 1); return; }
    if (el.dataset.buy) { const s = el.dataset.buy; if (!bag.find((l) => l.slug === s)) { bag.push({ slug: s, qty: qtyFor[s] || 1 }); saveBag(); } go('#/checkout'); return; }
    if (el.dataset.rm) { remove(el.dataset.rm); return; }
    if (el.dataset.bq) { setQty(el.dataset.bq, Number(el.dataset.d)); return; }
    if (el.dataset.qty) { const slug = route().parts[1]; const p = bySlug.get(slug); qtyFor[slug] = Math.max(1, Math.min(p.available, (qtyFor[slug] || 1) + Number(el.dataset.qty))); render(); return; }
    if (el.dataset.unf) { setFilter(el.dataset.unf, el.dataset.v, false); return; }
    if (el.dataset.zoom) { overlay(`<div class="lightbox" role="dialog" aria-modal="true" aria-label="Photo" data-close><img src="${el.dataset.zoom}" alt=""><button type="button" class="btn-icon x" data-close aria-label="Close the photo">${icon('x')}</button></div>`); return; }
    if (el.dataset.thumb) { const m = app.querySelector('.gallery .main'); m.querySelector('img').src = el.dataset.thumb; m.dataset.zoom = el.dataset.thumb; app.querySelectorAll('[data-thumb]').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); return; }
    if (el.dataset.share) { const p = bySlug.get(el.dataset.share); if (navigator.share) navigator.share({ title: p.name, text: `${p.name}, ${rs(p.price)}`, url: productUrl(p) }).catch(() => {}); else toast('Link copied'); return; }
    if (el.dataset.drop) { const pop = el.nextElementSibling; const open = pop.hidden; document.querySelectorAll('.fdrop .pop').forEach((p) => { p.hidden = true; p.previousElementSibling.setAttribute('aria-expanded', 'false'); }); pop.hidden = !open; el.setAttribute('aria-expanded', String(open)); return; }
    if (el.dataset.fg) { const box = el.nextElementSibling; const open = el.getAttribute('aria-expanded') === 'true'; el.setAttribute('aria-expanded', String(!open)); box.hidden = open; return; }
    if (el.dataset.theme) { if (window.W10Opts) window.W10Opts.set('theme', el.dataset.theme); return; }
    if (el.dataset.way) { co.pay = el.dataset.way; ov.el.querySelectorAll('[data-way]').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); return; }
    if (el.dataset.copy) { navigator.clipboard?.writeText(el.dataset.copy).catch(() => {}); toast('Tracking number copied'); return; }
    if (el.dataset.again) { const o = allOrders().find((x) => x.no === el.dataset.again); o.items.forEach((i) => { if (bySlug.has(i.slug) && !bag.find((l) => l.slug === i.slug)) bag.push({ slug: i.slug, qty: Math.min(i.qty, bySlug.get(i.slug).available) }); }); saveBag(); render(); bagDrawer(); return; }
    const act = el.dataset.act;
    if (act === 'menu') { sideMenu(); return; }
    if (act === 'bag') { bagDrawer(); return; }
    if (act === 'search') { searchOpen = !searchOpen; render(); if (searchOpen) document.getElementById('q-pop')?.focus(); return; }
    if (act === 'filters') { filterSheet(); return; }
    if (act === 'sort') { sortSheet(); return; }
    if (act === 'clear') { const r = route(); const q = new URLSearchParams(); if (r.q.get('q')) q.set('q', r.q.get('q')); if (r.q.get('sort')) q.set('sort', r.q.get('sort')); if (ov && ov.el.querySelector('.sheet')) keepSheet = {}; go(withQ(r.path, q)); return; }
    if (act === 'retry') { pickState('normal'); return; }
    if (act === 'add-addr') { co.adding = true; render(); return; }
    if (act === 'to-pay') { const c = app.querySelector('input[name="addr"]:checked'); if (c) co.addr = c.value; return; }
    if (act === 'pay') { payWindow(); return; }
    if (act === 'paid') { placeOrder(); return; }
    if (act === 'payfail') { closeOverlay(true); go('#/checkout?step=pay&state=payfail'); return; }
    if (act === 'signout') { me = null; write(sessionStorage, 'me', null); toast('Signed out'); go('#/'); return; }
    if (act === 'invoice') { toast('The GST invoice downloads here (sample)'); return; }
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || '';
      if (/^(https?:|tel:)/.test(href)) { e.preventDefault(); toast(/wa\.me/.test(href) ? 'Opens WhatsApp with the shop (+91 73823 88565) and the message filled in' : /tel:/.test(href) ? 'Calls the shop' : 'Opens in a new tab on the website'); return; }
      if (href.startsWith('#/') && ov) closeOverlay(true);
      if (el.hasAttribute('data-keep-scroll')) lastPath = route().path;
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-f]')) { setFilter(t.dataset.f, t.value, t.checked); return; }
    if (t.matches('[data-sort]') || t.matches('[data-sortm]')) { const r = route(); const q = new URLSearchParams(r.q); if (t.value === 'new') q.delete('sort'); else q.set('sort', t.value); q.delete('page'); closeOverlay(true); go(withQ(r.path, q)); return; }
    if (t.name === 'addr') co.addr = t.value;
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.closest('form.search')) { suggest(t.closest('form.search')); return; }
    if (t.matches('[data-colq]')) { const v = t.value.trim().toLowerCase(); t.closest('.opts').querySelectorAll('[data-colname]').forEach((d) => { d.hidden = v && !d.dataset.colname.includes(v); }); return; }
    if (t.closest('.otp')) {
      t.value = t.value.replace(/\D/g, '').slice(-1);
      const boxes = [...t.closest('.otp').querySelectorAll('input')];
      if (t.value && boxes.indexOf(t) < 5) boxes[boxes.indexOf(t) + 1].focus();
      return;
    }
    if (t.id === 'mob') { const d = t.value.replace(/\D/g, '').slice(0, 10); t.value = d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d; return; }
    if (t.id === 'a-pin') { const d = t.value.replace(/\D/g, '').slice(0, 6); t.value = d; const hit = PINS[d]; const hint = app.querySelector('[data-pin-hint]'); if (d.length === 6) { if (hit) { app.querySelector('#a-city').value = hit[0]; app.querySelector('#a-state').value = hit[1]; hint.textContent = `${hit[0]}, ${hit[1]}`; } else hint.textContent = 'Type the city and state.'; } }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (ov) { e.preventDefault(); closeOverlay(); return; }
      document.querySelectorAll('.suggest').forEach((s) => s.remove());
      document.querySelectorAll('.fdrop .pop:not([hidden])').forEach((p) => { p.hidden = true; p.previousElementSibling.setAttribute('aria-expanded', 'false'); p.previousElementSibling.focus(); });
    }
    if (e.key === 'Backspace' && e.target.closest('.otp') && !e.target.value) { const boxes = [...e.target.closest('.otp').querySelectorAll('input')]; const i = boxes.indexOf(e.target); if (i > 0) boxes[i - 1].focus(); }
  });
  document.addEventListener('paste', (e) => {
    const otp = e.target.closest && e.target.closest('.otp');
    if (!otp) return;
    const d = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!d) return;
    e.preventDefault();
    [...otp.querySelectorAll('input')].forEach((b, i) => { b.value = d[i] || ''; });
  });
  document.addEventListener('submit', (e) => {
    const f = e.target;
    e.preventDefault();
    if (f.matches('form.search')) { const v = f.querySelector('input').value.trim(); searchOpen = false; if (v) go(`#/search?q=${encodeURIComponent(v)}`); return; }
    if (f.matches('[data-pin]')) {
      const d = f.querySelector('input').value.replace(/\D/g, '');
      const res = app.querySelector('[data-pin-res]');
      if (!/^[1-9]\d{5}$/.test(d)) { res.innerHTML = `<span class="err">Type a 6-digit pincode.</span>`; return; }
      const hit = PINS[d];
      res.innerHTML = `${icon('check')}<span>Free delivery to ${hit ? `${hit[0]}, ${hit[1]}` : d}: usually ${d.startsWith('52') ? '2 to 4' : '3 to 7'} days. ${tag('Sample')}</span>`;
      return;
    }
    const r = route();
    const next = r.q.get('next') || '/';
    if (f.dataset.auth === 'mobile') {
      const d = f.querySelector('input').value.replace(/\D/g, '');
      const err = f.querySelector('[data-err]');
      if (!/^[6-9]\d{9}$/.test(d)) { err.textContent = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.'; err.hidden = false; f.querySelector('.mob-input').classList.add('is-bad'); return; }
      auth = { mobile: d, tries: 3, wrong: false, newbie: d !== PRIYA.mobile };
      const q = new URLSearchParams(r.q); q.set('step', 'code'); go(withQ('/signin', q));
      return;
    }
    if (f.dataset.auth === 'code') {
      const code = [...f.querySelectorAll('.otp input')].map((b) => b.value).join('');
      if (code !== '123456') { auth.wrong = true; auth.tries = Math.max(0, auth.tries - 1); render(); return; }
      if (auth.mobile === PRIYA.mobile) { signedIn({ ...PRIYA }, next); return; }
      const q = new URLSearchParams(r.q); q.set('step', 'profile'); go(withQ('/signin', q));
      return;
    }
    if (f.dataset.auth === 'profile') {
      const name = f.querySelector('#nm').value.trim();
      const err = f.querySelector('[data-err]');
      if (name.length < 2) { err.textContent = 'Type your name (at least 2 letters).'; err.hidden = false; f.querySelector('#nm').classList.add('is-bad'); return; }
      signedIn({ mobile: auth.mobile || '9000000001', name, email: f.querySelector('#em').value.trim(), addresses: [] }, next);
      return;
    }
    if (f.matches('[data-addr]')) {
      const v = (id) => f.querySelector(id).value.trim();
      const err = f.querySelector('[data-err]');
      const missing = [['#a-name', 'name'], ['#a-phone', 'mobile'], ['#a-pin', 'pincode'], ['#a-l1', 'house and street'], ['#a-city', 'city'], ['#a-state', 'state']].filter(([id]) => !v(id));
      f.querySelectorAll('.input, .select').forEach((i) => i.classList.toggle('is-bad', missing.some(([id]) => `#${i.id}` === id)));
      if (missing.length) { err.textContent = `Please fill in: ${missing.map((m) => m[1]).join(', ')}.`; err.hidden = false; return; }
      if (!/^[6-9]\d{9}$/.test(v('#a-phone'))) { err.textContent = 'The mobile number needs 10 digits.'; err.hidden = false; return; }
      if (!/^[1-9]\d{5}$/.test(v('#a-pin'))) { err.textContent = 'The pincode needs 6 digits.'; err.hidden = false; return; }
      const a = { id: `a${Date.now()}`, label: me.addresses?.length ? 'New address' : 'Home', fullName: v('#a-name'), phone: v('#a-phone'), line1: v('#a-l1'), line2: v('#a-l2'), city: v('#a-city'), state: v('#a-state'), pincode: v('#a-pin') };
      me.addresses = [...(me.addresses || []), a];
      write(sessionStorage, 'me', me);
      co.addr = a.id; co.adding = false;
      go('#/checkout?step=pay');
    }
  });
  window.addEventListener('hashchange', render);
  document.addEventListener('w10opts', () => { const y = window.scrollY; render(); window.scrollTo(0, y); });
  let rw = window.innerWidth;
  window.addEventListener('resize', () => { if ((rw <= 900) !== (window.innerWidth <= 900)) { rw = window.innerWidth; render(); } });

  window.HC = { card, NH, icon, rs, skelCard, colTile, skelTile, CATS, colsOf, categoryCard, skelCatCard };
  if (!window.W10_KIT) render();
})();
