/* Nandam Handlooms mock-up: core (utilities, icons, options, storage, shell, router, overlays).
   The other app-*.js files add pages to NH.pages. Everything is plain JavaScript, no build step. */
window.NH = (() => {
  'use strict';
  const D = window.NH_DATA;
  const C = D.collections, P = D.products;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rupee = (n) => '₹ ' + Number(n).toLocaleString('en-IN');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tidy = (s) => String(s ?? '').replace(/Embroidry/gi, 'Embroidery').replace(/Handpaint(ed)?/gi, 'Hand painted');
  const byId = Object.fromEntries(P.map((p) => [p.id, p]));
  const nm = (p) => tidy(p.name);
  const bd = (c) => c.border + ' border';
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtDate = (iso, style = 'short') => new Date(iso).toLocaleDateString('en-IN', style === 'long' ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' });
  const maskPhone = (ph) => (ph && ph.length >= 4 ? `${ph.slice(0, 2)}${'*'.repeat(ph.length - 4)}${ph.slice(-2)}` : ph || '');
  const prettyPhone = (ph) => (ph && ph.length === 10 ? `+91 ${ph.slice(0, 5)} ${ph.slice(5)}` : ph || '');
  const reducedOS = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SHOP = {
    name: 'Nandam Handlooms', phoneShow: '+91 73829 68566', phoneTel: '917382968566',
    address: ['#10-23, Opp. Brahmam Gari Temple, Hussain Katta', 'Old Mangalagiri, Guntur Dist', 'Andhra Pradesh – 522 503'],
    hours: 'Monday to Sunday, 9:30 AM – 8:30 PM', map: 'https://maps.app.goo.gl/qK54PztChaCdGzMz6',
    wa: (text) => 'https://wa.me/917382968566?text=' + encodeURIComponent(text || 'Hello Nandam Handlooms'),
    dtdc: 'https://www.dtdc.com/track-your-shipment/',
  };
  const FAMILIES = ['Red', 'Pink', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple', 'Brown', 'Ivory & grey'].filter((f) => P.some((p) => p.fam === f));
  const BORDERS = ['50/50', '100/50', '150/50', '250/50', '300 Kanchi', 'Gap', 'Scallop', 'Rangoli', 'Kanchi'].filter((b) => P.some((p) => C[p.c].border === b));
  const WORKS = [...new Set(C.map((c) => c.work))].sort();
  const BANDS = [{ key: 'a', title: 'Under ₹ 2,500', min: 0, max: 2499 }, { key: 'b', title: '₹ 2,500 to ₹ 3,200', min: 2500, max: 3200 }, { key: 'c', title: 'Above ₹ 3,200', min: 3201, max: 1e9 }];
  const famHex = (f) => { const m = P.filter((p) => p.fam === f); return m[Math.floor(m.length / 2)].hex; };
  const newest = [...P].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  const recommended = (() => { const groups = C.map((_, i) => newest.filter((p) => p.c === i)).filter((g) => g.length).sort((a, b) => C[b[0].c].price - C[a[0].c].price); const out = []; for (let k = 0; out.length < P.length; k++) groups.forEach((g) => g[k] && out.push(g[k])); return out; })();
  const rank = Object.fromEntries(recommended.map((p, i) => [p.id, i]));
  const freshMix = (() => { const seen = {}, out = []; for (const p of newest) { seen[p.c] = (seen[p.c] || 0) + 1; if (seen[p.c] <= 2) out.push(p); if (out.length === 12) break; } return out; })();
  const STATUS = {
    pending_payment: ['Payment pending', 'warn'], paid: ['Paid', 'info'], processing: ['Processing', 'info'], shipped: ['Shipped', 'ok'],
    delivered: ['Delivered', 'ok'], cancelled: ['Cancelled', 'bad'], payment_failed: ['Payment failed', 'bad'],
  };
  const TRIVIAL = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '123456', '654321', '012345']);
  const STATES = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Kerala', 'Maharashtra', 'Gujarat', 'Delhi', 'West Bengal', 'Odisha', 'Madhya Pradesh', 'Rajasthan', 'Uttar Pradesh', 'Punjab', 'Haryana', 'Bihar', 'Assam', 'Goa', 'Other'];

  /* ---------- icons (one stroke set, drawn once) ---------- */
  const I = {
    search: '<svg class="svg" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>',
    user: '<svg class="svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.9-3.6 3.9-5.4 7.5-5.4s6.6 1.8 7.5 5.4"/></svg>',
    heart: '<svg class="svg" viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/></svg>',
    bag: '<svg class="svg" viewBox="0 0 24 24"><path d="M5 8.5h14l-1 11.5H6z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/></svg>',
    menu: '<svg class="svg" viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
    close: '<svg class="svg" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    left: '<svg class="svg" viewBox="0 0 24 24"><path d="M14.5 5 7.5 12l7 7"/></svg>',
    right: '<svg class="svg" viewBox="0 0 24 24"><path d="m9.5 5 7 7-7 7"/></svg>',
    up: '<svg class="svg" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    arrow: '<svg class="svg sm" viewBox="0 0 24 24"><path d="M4 12h16M14 6l6 6-6 6"/></svg>',
    wa: '<svg class="svg" viewBox="0 0 32 32"><path d="M16 5a11 11 0 0 0-9.4 16.7L5 27l5.5-1.5A11 11 0 1 0 16 5z"/><path d="M12.5 11.5c-.5 4.5 3.5 8.5 8 8l1-2-2.5-1.5-1 1c-1.5-.7-2.5-1.7-3.2-3.2l1-1-1.5-2.5z"/></svg>',
    pin: '<svg class="svg" viewBox="0 0 32 32"><path d="M16 28s-8-7.5-8-14a8 8 0 0 1 16 0c0 6.5-8 14-8 14z"/><circle cx="16" cy="14" r="2.8"/></svg>',
    card: '<svg class="svg" viewBox="0 0 32 32"><rect x="5" y="9" width="22" height="15" rx="1.5"/><path d="M5 14h22M9 20h5"/></svg>',
    loom: '<svg class="svg" viewBox="0 0 32 32"><path d="M4 9h24M4 23h24M8 9v14M13 9v14M19 9v14M24 9v14M4 16h24"/></svg>',
    truck: '<svg class="svg" viewBox="0 0 32 32"><path d="M4 9h15v12H4zM19 13h5l4 4v4h-9z"/><circle cx="9" cy="23" r="2.5"/><circle cx="23" cy="23" r="2.5"/></svg>',
    check: '<svg class="svg" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    checkCircle: '<svg class="svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/></svg>',
    alert: '<svg class="svg" viewBox="0 0 24 24"><path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/></svg>',
    info: '<svg class="svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.3"/></svg>',
    trash: '<svg class="svg" viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13M10 11v6M14 11v6"/></svg>',
    pencil: '<svg class="svg" viewBox="0 0 24 24"><path d="m4 20 4.5-1L19 8.5l-3.5-3.5L5 15.5zM13.5 7l3.5 3.5"/></svg>',
    star: '<svg class="svg" viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.8l6.1-.7z"/></svg>',
    shield: '<svg class="svg" viewBox="0 0 24 24"><path d="M12 3 4.5 6v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9V6z"/><path d="m9 12 2 2 4-4.5"/></svg>',
    key: '<svg class="svg" viewBox="0 0 24 24"><circle cx="8" cy="14" r="4"/><path d="m11 11 9-8M16 6l2 2M13.5 8.5 16 11"/></svg>',
    phone: '<svg class="svg" viewBox="0 0 24 24"><path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/></svg>',
    copy: '<svg class="svg" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    box: '<svg class="svg" viewBox="0 0 24 24"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg>',
    clock: '<svg class="svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    wrench: '<svg class="svg" viewBox="0 0 24 24"><path d="M14.5 4.5a5 5 0 0 0-5.3 6.8L3.5 17l3.5 3.5 5.7-5.7a5 5 0 0 0 6.8-5.3l-3 3-2.8-.7-.7-2.8z"/></svg>',
    eye: '<svg class="svg" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    filter: '<svg class="svg" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    plus: '<svg class="svg sm" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    logout: '<svg class="svg" viewBox="0 0 24 24"><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/></svg>',
    download: '<svg class="svg" viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M4 19h16"/></svg>',
    external: '<svg class="svg sm" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6"/></svg>',
    zoom: '<svg class="svg" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8M8 11h6M11 8v6"/></svg>',
  };

  /* ---------- design options (mock-up controls) ---------- */
  const OPTS = {
    theme: ['Theme', { a: 'Light', b: 'Dark', c: 'Auto' }],
    palette: ['Colour palette', { a: 'Wine & gold', b: 'Oxblood & cotton', c: 'Ink & brass' }],
    font: ['Fonts', { a: 'Cormorant + Jost', b: 'Playfair + Outfit', c: 'Marcellus + Manrope' }],
    corner: ['Corners', { a: 'Crisp', b: 'Soft' }],
    menu: ['Main menu', { a: 'Centred logo', b: 'Logo left', c: 'Compact' }],
    home: ['Home top section', { a: 'Full-width slider', b: 'Split editorial', c: 'Centred cinematic' }],
    card: ['Product card', { a: 'Clean', b: 'Framed', c: 'Hover bar' }],
    login: ['Login page', { a: 'Split with banner', b: 'Centred card', c: 'Minimal' }],
    motion: ['Motion', { a: 'Full', b: 'Calm', c: 'Off' }],
  };
  const OPT_DEFAULT = { theme: 'a', palette: 'a', font: 'a', corner: 'a', menu: 'b', home: 'a', card: 'b', login: 'a', motion: 'a' };
  const store = {
    get(k, def) { try { const v = localStorage.getItem('nh.mock.' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem('nh.mock.' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('nh.mock.' + k); } catch (e) {} },
  };
  const opts = Object.assign({}, OPT_DEFAULT, store.get('options', {}));
  function applyOptions() {
    const h = document.documentElement;
    if (opts.theme === 'a') h.dataset.theme = 'light'; else if (opts.theme === 'b') h.dataset.theme = 'dark'; else h.removeAttribute('data-theme');
    for (const k of ['palette', 'font']) { if (opts[k] === 'a') h.removeAttribute('data-' + k); else h.dataset[k] = opts[k]; }
    h.dataset.corner = opts.corner === 'b' ? 'soft' : 'crisp';
    for (const k of ['menu', 'home', 'card', 'login']) h.dataset[k] = opts[k];
    h.dataset.motion = opts.motion === 'a' ? 'full' : opts.motion === 'b' ? 'calm' : 'off';
    store.set('options', opts);
  }
  const anim = () => !reducedOS && opts.motion !== 'c';     // any motion at all
  const full = () => !reducedOS && opts.motion === 'a';     // the showpieces (curtain, ring, word rise)
  const choicesText = () => Object.keys(OPTS).map((k) => `${OPTS[k][0]}: ${opts[k].toUpperCase()} ${OPTS[k][1][opts[k]]}`).join('\n');

  /* ---------- customer data kept in this browser (bag, wishlist, sign-in, addresses, orders) ---------- */
  const SAMPLE_USER = { first: 'Priya', last: 'Sharma', display: 'Priya', phone: '9876543210', state: 'Telangana', pincode: '500034', since: '2026-06-14' };
  const SAMPLE_ADDRESSES = [
    { id: 'a1', fullName: 'Priya Sharma', phone: '9876543210', line1: 'Flat 302, Lakshmi Residency', line2: 'Road No. 12, Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034', isDefault: true },
    { id: 'a2', fullName: 'Priya Sharma', phone: '9876543210', line1: 'Plot 45, Hitech City Main Road', line2: 'Madhapur', city: 'Hyderabad', state: 'Telangana', pincode: '500081', isDefault: false },
  ];
  const snap = (p) => ({ id: p.id, name: nm(p), price: C[p.c].price, img: p.img, collection: C[p.c].name });
  const SAMPLE_ORDERS = [
    { no: 'NH48213097', placedAt: '2026-09-12T11:20:00+05:30', status: 'delivered', items: [snap(P[9])], address: SAMPLE_ADDRESSES[0], shipment: { status: 'delivered', awb: 'D7001234567', shippedAt: '2026-09-13T16:00:00+05:30', deliveredAt: '2026-09-16T13:10:00+05:30' }, invoice: 'INV-000061', sample: true },
    { no: 'NH50937716', placedAt: '2026-10-03T18:05:00+05:30', status: 'shipped', items: [snap(P[41]), snap(P[88])], address: SAMPLE_ADDRESSES[0], shipment: { status: 'shipped', awb: 'D7001298765', shippedAt: '2026-10-05T12:30:00+05:30' }, invoice: 'INV-000074', sample: true },
    { no: 'NH51204488', placedAt: '2026-10-07T20:41:00+05:30', status: 'processing', items: [snap(P[120])], address: SAMPLE_ADDRESSES[1], shipment: { status: 'not_shipped' }, invoice: 'INV-000079', sample: true },
  ];
  for (const o of SAMPLE_ORDERS) { o.subtotal = o.items.reduce((t, i) => t + i.price, 0); o.total = o.subtotal; }
  const data = {
    bag: store.get('bag', []).filter((id) => byId[id]),
    wish: store.get('wish', []).filter((id) => byId[id]),
    session: store.get('session', null),
    profiles: store.get('profiles', {}),
    addresses: store.get('addresses', null) || SAMPLE_ADDRESSES.map((a) => ({ ...a })),
    orders: store.get('orders', null) || SAMPLE_ORDERS,
  };
  const persist = () => { store.set('bag', data.bag); store.set('wish', data.wish); store.set('session', data.session); store.set('profiles', data.profiles); store.set('addresses', data.addresses); store.set('orders', data.orders); };
  const bagTotal = () => data.bag.reduce((t, id) => t + C[byId[id].c].price, 0);
  const uid = () => Math.random().toString(36).slice(2, 9);
  const newOrderNo = () => 'NH' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const newInvoiceNo = () => 'INV-' + String(80 + data.orders.filter((o) => !o.sample).length).padStart(6, '0');

  /* ---------- mock-up state (not part of the product) ---------- */
  let UI = 'normal';           // normal | loading | empty | error | success | warning | popup
  const pending = { phone: '', redirect: '', purpose: '' };   // the OTP / MPIN flow in progress
  const route = { name: 'home', a: '', b: '' };
  let started = false, goToken = 0;

  /* ---------- toast, confirm sheet, panels ---------- */
  let toastTimer;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2800); }
  let panel = null, panelOpener = null;
  function showPanel(which) {
    hidePanel();
    panel = $('#' + which); if (!panel) return;
    panelOpener = document.activeElement;
    panel.classList.add('on'); panel.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('on');
    if (which === 'search') { renderSearch($('#search-input').value); setTimeout(() => $('#search-input').focus(), 120); }
    else { const f = panel.querySelector('input, button, [tabindex]'); if (f) setTimeout(() => f.focus(), 120); }
  }
  function hidePanel() {
    if (!panel) return;
    panel.classList.remove('on'); panel.setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('on');
    const was = panel; panel = null;
    if (was.id === 'confirm' && askResolve) { const r = askResolve; askResolve = null; r(false); }
    if (panelOpener && panelOpener.focus && document.contains(panelOpener)) panelOpener.focus({ preventScroll: true });
  }
  let askResolve = null;
  function ask({ title, text, ok = 'Confirm', cancel = 'Cancel', danger = false, body = '' }) {
    $('#confirm-box').innerHTML = `<button class="icon sheet-close" type="button" data-close aria-label="Close">${I.close}</button><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${body}<div class="acts"><button class="btn ${danger ? '' : 'btn-fill'}" type="button" data-ask="1"${danger ? ' style="border-color:var(--bad);color:var(--bad)"' : ''}>${esc(ok)}</button><button class="btn btn-ghost" type="button" data-ask="0">${esc(cancel)}</button></div>`;
    return new Promise((res) => { askResolve = res; showPanel('confirm'); });
  }
  function sheet(html, opts = {}) {
    $('#confirm-box').innerHTML = (opts.noClose ? '' : `<button class="icon sheet-close" type="button" data-close aria-label="Close">${I.close}</button>`) + html;
    showPanel('confirm');
  }

  /* ---------- product card (shared by home, listing, rails) ---------- */
  const card = (p, i = 0, still = false) => `<article class="pc rv${still ? ' in' : ''}" style="--d:${(i % 4) * .09}s">
  <div class="pc-media">
    <a class="pc-img" href="#/product/${p.id}" data-cursor="View" aria-label="${esc(nm(p))}, ${rupee(C[p.c].price)}"><img src="${p.img}" alt="${esc(nm(p))}, ${p.fam.toLowerCase()}" loading="lazy" width="640" height="853"></a>
    <span class="pc-detail" style="background-image:url('${p.img}')" aria-hidden="true"></span>
    ${newest.indexOf(p) < 12 ? '<span class="pc-tag">New</span>' : ''}
    <button class="pc-wish" type="button" data-wish="${p.id}" aria-pressed="${data.wish.includes(p.id)}" aria-label="Save to wishlist">${I.heart}</button>
    <div class="pc-bar"><button type="button" data-quick="${p.id}">Quick view</button><button type="button" data-add="${p.id}">Add to bag</button></div>
  </div>
  <div class="pc-info"><span class="label">${esc(bd(C[p.c]))}</span><a class="pc-name" href="#/product/${p.id}">${esc(nm(p))}</a><span class="price">${rupee(C[p.c].price)}</span></div>
</article>`;
  const skCard = () => `<div class="pc"><div class="sk sk-img"></div><div class="pc-info" style="width:100%"><div class="sk sk-text w40"></div><div class="sk sk-text w80"></div><div class="sk sk-text w40"></div></div></div>`;
  const railHtml = (id, inner) => `<div class="rail-wrap"><button class="arrow-btn rail-arrow prev" type="button" data-rail="${id}" data-dir="-1" aria-label="Previous">${I.left}</button><div class="rail" id="rail-${id}">${inner}</div><button class="arrow-btn rail-arrow next" type="button" data-rail="${id}" data-dir="1" aria-label="Next">${I.right}</button></div>`;
  const secHead = (label, title, lede = '') => `<div class="sec-head rv"><span class="label">${esc(label)}</span><h2>${title}</h2><div class="orn"><i></i></div>${lede ? `<p>${lede}</p>` : ''}</div>`;
  const crumbs = (items) => `<nav class="crumbs" aria-label="Breadcrumb">${items.map((it, i) => (i ? '<span>/</span>' : '') + (it[1] ? `<a href="${it[1]}">${esc(it[0])}</a>` : `<span class="here">${esc(it[0])}</span>`)).join('')}</nav>`;
  const emptyBlock = (icon, title, text, cta = '', tag = 'span') => `<div class="empty">${icon}<${tag} class="empty-title">${esc(title)}</${tag}><p>${esc(text)}</p>${cta}</div>`;

  /* ---------- bag, wishlist ---------- */
  function renderCounts() {
    $$('[data-bag-count]').forEach((n) => { n.hidden = !data.bag.length; n.textContent = data.bag.length; });
    $$('[data-wish-count]').forEach((n) => { n.hidden = !data.wish.length; n.textContent = data.wish.length; });
  }
  function renderBag() {
    renderCounts();
    $('#bag-lines').innerHTML = data.bag.length ? data.bag.map((id) => { const p = byId[id]; return `<div class="line"><a href="#/product/${id}" data-close><img src="${p.img}" alt=""></a><div><a class="line-name" href="#/product/${id}" data-close>${esc(nm(p))}</a><span class="label">${esc(bd(C[p.c]))} · ${p.fam} · one piece</span><button class="under" type="button" data-remove="${id}" style="font-size:10px">Remove</button></div><span class="price">${rupee(C[p.c].price)}</span></div>`; }).join('')
      : `<div class="empty" style="padding:60px 0">${I.bag}<span class="empty-title">Your bag is empty</span><p>Sarees you add will wait for you here.</p></div>`;
    $('#bag-total').textContent = rupee(bagTotal());
    $('#bag-checkout').disabled = !data.bag.length; $('#bag-view').hidden = !data.bag.length;
  }
  function addToBag(id, quiet) {
    if (data.bag.includes(id)) { toast('Already in your bag'); if (!quiet) showPanel('bag'); return; }
    data.bag.push(id); persist(); renderBag(); if (!quiet) showPanel('bag');
  }
  function removeFromBag(id) { data.bag = data.bag.filter((x) => x !== id); persist(); renderBag(); if (route.name === 'cart' || route.name === 'checkout') render(false); }
  function toggleWish(id) {
    data.wish = data.wish.includes(id) ? data.wish.filter((x) => x !== id) : [...data.wish, id]; persist(); renderCounts();
    $$(`[data-wish="${id}"]`).forEach((b) => b.setAttribute('aria-pressed', data.wish.includes(id)));
    toast(data.wish.includes(id) ? 'Saved to your wishlist' : 'Removed from your wishlist');
    if (route.name === 'wishlist') render(false);
  }
  function quick(id) {
    const p = byId[id], c = C[p.c];
    $('#q-img').src = p.img; $('#q-img').alt = nm(p); $('#q-border').textContent = `${bd(c)} · ${c.work}`; $('#q-name').textContent = nm(p); $('#q-price').textContent = rupee(c.price);
    $('#q-spec').textContent = [c.spec.Material, c.spec.Loom, c.spec.Body && `${tidy(c.spec.Body)} body`, c.spec.Blouse && `${tidy(c.spec.Blouse).toLowerCase()} blouse`].filter(Boolean).join(' · ') || c.spec.About || '';
    $('#q-stock').textContent = p.stock === 1 ? 'Only one piece available' : `${p.stock} pieces available`;
    $('#q-add').dataset.add = id; $('#q-view').href = '#/product/' + id; showPanel('quick');
  }
  function renderSearch(q) {
    q = (q || '').trim().toLowerCase();
    $('#search-chips').innerHTML = ['Scallop', 'Kanchi', 'Hand painted', 'Digital print', 'Checks', 'Blue', 'Pink', 'Green'].map((t) => `<button class="chip" type="button" data-term="${t}">${t}</button>`).join('');
    const hits = q ? searchList(q) : freshMix.slice(0, 6);
    $('#search-hits').innerHTML = hits.slice(0, 12).map((p) => `<a class="hit" href="#/product/${p.id}" data-close><img src="${p.img}" alt="" loading="lazy"><span>${esc(nm(p))}</span><span class="price" style="font-size:12px">${rupee(C[p.c].price)}</span></a>`).join('');
    $('#search-count').textContent = q ? (hits.length ? `${hits.length} ${hits.length === 1 ? 'saree' : 'sarees'} found · press Enter to see them all` : 'Nothing found. Try a colour such as blue, or a border such as scallop.') : 'New arrivals';
  }
  const searchList = (q) => { q = q.toLowerCase(); return P.filter((p) => { const c = C[p.c]; return `${nm(p)} ${p.id} ${p.fam} ${c.border} ${c.work} ${c.spec.Loom || ''} ${c.spec.Body || ''}`.toLowerCase().includes(q); }); };

  /* ---------- shell: header, menus, footer ---------- */
  const NAV_LINKS = () => `
    <div class="nav-item"><button type="button" aria-haspopup="true" data-go="#/shop">Sarees</button>
      <div class="mega"><div class="wrap mega-grid">
        <div class="mega-col"><h4>By border</h4>${BORDERS.map((b) => `<button type="button" data-go="#/shop/border/${encodeURIComponent(b)}">${esc(b)}</button>`).join('')}</div>
        <div class="mega-col"><h4>By work</h4>${WORKS.map((w) => `<button type="button" data-go="#/shop/work/${encodeURIComponent(w)}">${esc(w)}</button>`).join('')}</div>
        <div class="mega-col"><h4>By price</h4>${BANDS.map((b) => `<button type="button" data-go="#/shop/price/${b.key}">${b.title}</button>`).join('')}<h4 style="margin-top:26px">Discover</h4><button type="button" data-go="#/shop/new">New arrivals</button><button type="button" data-go="#/collections">All collections</button><button type="button" data-go="#/shop">All sarees</button></div>
        <a class="mega-feature" href="#/shop/new"><img src="img/site/hero-cotton-checks.jpg" alt="Checked sarees folded beside brass lamps" loading="lazy"><span class="label gold">Just arrived</span><span style="font-family:var(--serif);font-size:26px;margin-top:6px">New on our shelves</span></a>
      </div></div>
    </div>
    <a href="#/collections">Collections</a>
    <a href="#/shop/new">New arrivals</a>
    <a href="#/story">Our story</a>
    <a href="#/visit">Visit us</a>`;
  function renderShell() {
    $$('.nav').forEach((n) => { n.innerHTML = NAV_LINKS(); });
    const signed = !!data.session;
    $('#menu-links').innerHTML = `<a href="#/shop">All sarees<span>→</span></a><a href="#/collections">Collections<span>→</span></a><a href="#/shop/new">New arrivals<span>→</span></a><a href="#/shop/border/Scallop">Shop by border<span>→</span></a><a href="#/shop/colour/Blue">Shop by colour<span>→</span></a><a href="#/story">Our story<span>→</span></a><a href="#/visit">Visit us<span>→</span></a>
      ${signed ? `<a class="small" href="#/account">My account</a><a class="small" href="#/account/orders">My orders</a>` : `<a class="small" href="#/login">Sign in or create account</a>`}<a class="small" href="#/wishlist">Wishlist</a>`;
    $('#acct-link').href = signed ? '#/account' : '#/login'; $('#acct-link').title = signed ? 'My account' : 'Sign in';
    $('#foot-mock').innerHTML = `<span class="sample">Design mock-up · ${P.length} of ${D.totals.sarees} sarees shown · built ${D.built}</span>`;
    renderCounts();
  }

  /* ---------- router ---------- */
  const pages = {};         // name -> { render(route) -> html, after(route), title }
  function parseHash() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const parts = raw.split('/').map((s) => { try { return decodeURIComponent(s); } catch (e) { return s; } });
    return { name: parts[0] || 'home', a: parts[1] || '', b: parts[2] || '' };
  }
  function go(hash) { if (location.hash === hash) render(true); else location.hash = hash; }
  function render(fresh = true) {
    const r = parseHash(); Object.assign(route, r);
    const page = pages[route.name] || pages['not-found'];
    const main = $('#main');
    document.documentElement.classList.toggle('has-buybar', false); $('#buybar').classList.remove('on');
    main.innerHTML = `<section class="view">${page.render(route, UI)}</section>`;
    document.title = (page.title ? (typeof page.title === 'function' ? page.title(route) : page.title) + ' · ' : '') + 'Nandam Handlooms';
    $$('.nav a').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === location.hash));
    if (page.after) page.after(route, UI);
    if (fresh) { try { scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { scrollTo(0, 0); } main.focus({ preventScroll: true }); }
    onScroll(); requestAnimationFrame(observe);
    $('#ui-state').textContent = UI === 'normal' ? 'Normal' : UI[0].toUpperCase() + UI.slice(1);
    if (UI === 'popup' && page.popup) setTimeout(() => page.popup(route), 350);
  }
  function navigate() {
    hidePanel(); UI = 'normal'; $$('.nav-item.open').forEach((n) => n.classList.remove('open'));
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (!started || !full()) return render(true);
    const token = ++goToken, curtain = $('#curtain');
    curtain.classList.remove('run'); void curtain.offsetWidth; curtain.classList.add('run');
    setTimeout(() => { if (token === goToken) render(true); }, 430);
  }
  function setUI(state) { UI = state; render(false); $$('[data-ui]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.ui === state)); if (state !== 'normal') toast(`Showing the ${state} state`); }

  /* ---------- scroll, reveal, motion ---------- */
  let ticking = false, lastY = 0, push = 0, io;
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight, at = max > 0 ? Math.min(1, scrollY / max) : 0;
    $('#head').classList.toggle('scrolled', scrollY > 60);
    $('#progress').style.transform = `scaleX(${at})`;
    $('#to-top').classList.toggle('show', scrollY > 700);
    $('#top-ring').style.strokeDashoffset = 132 * (1 - at);
    const buy = $('#pd-add'); const showBar = !!buy && buy.getBoundingClientRect().bottom < 60;
    $('#buybar').classList.toggle('on', showBar); document.documentElement.classList.toggle('has-buybar', showBar);
    push = Math.min(40, Math.abs(scrollY - lastY)); lastY = scrollY;
    if (anim()) {
      $$('[data-parallax]').forEach((img) => { const r = img.parentElement.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) img.style.transform = `translateY(${((r.top + r.height / 2 - innerHeight / 2) / innerHeight) * -9}%)`; });
      $$('[data-float]').forEach((el) => { const r = el.parentElement.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) el.style.translate = `0 ${((r.top + r.height / 2 - innerHeight / 2) / innerHeight) * -46}px`; });
    }
  }
  function countUp(el) { const end = +el.dataset.count, t0 = performance.now(); (function step(t) { const k = Math.min(1, (t - t0) / 1500), eased = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(end * eased).toLocaleString('en-IN'); if (k < 1) requestAnimationFrame(step); })(t0); }
  function reveal(el) { el.classList.add('in'); el.querySelectorAll('[data-count]').forEach((n) => { if (!n.dataset.done) { n.dataset.done = 1; if (anim()) countUp(n); else n.textContent = (+n.dataset.count).toLocaleString('en-IN'); } }); }
  function observe() {
    const els = $$('.rv:not(.in), .rvi:not(.in)');
    if (!('IntersectionObserver' in window) || !anim()) return els.forEach(reveal);
    io ??= new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0 && r.width) reveal(el); else io.observe(el); });
  }
  function copyText(text, done = 'Copied') {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(done)).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = 0; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); toast(done); } catch (e) { toast('Select the text and copy it'); } ta.remove();
    });
  }

  return { D, C, P, $, $$, rupee, esc, tidy, byId, nm, bd, pad2, fmtDate, maskPhone, prettyPhone, SHOP, FAMILIES, BORDERS, WORKS, BANDS, famHex, newest, recommended, rank, freshMix, STATUS, TRIVIAL, STATES, I,
    OPTS, OPT_DEFAULT, opts, applyOptions, anim, full, choicesText, store, data, persist, bagTotal, uid, newOrderNo, newInvoiceNo, snap, SAMPLE_USER,
    get UI() { return UI; }, set UI(v) { UI = v; }, pending, route, get started() { return started; }, set started(v) { started = v; },
    toast, showPanel, hidePanel, ask, sheet, get askResolve() { return askResolve; }, set askResolve(v) { askResolve = v; }, get panel() { return panel; },
    card, skCard, railHtml, secHead, crumbs, emptyBlock, renderCounts, renderBag, addToBag, removeFromBag, toggleWish, quick, renderSearch, searchList,
    renderShell, pages, parseHash, go, render, navigate, setUI, onScroll, observe, copyText, get push() { return push; }, set push(v) { push = v; } };
})();
