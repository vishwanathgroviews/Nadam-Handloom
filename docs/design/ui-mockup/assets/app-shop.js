/* Listing (shop, search, wishlist), product page, sold-out page, cart page. */
(() => {
  'use strict';
  const N = window.NH;
  const { C, P, D, $, $$, rupee, esc, tidy, byId, nm, bd, I, SHOP, FAMILIES, BORDERS, WORKS, BANDS, famHex, rank, card, skCard, railHtml, secHead, crumbs, emptyBlock } = N;
  const PAGE = 12;

  /* ---------- listing ---------- */
  const F = { key: null };
  const resetF = (keep = {}) => Object.assign(F, { fam: null, border: null, work: null, col: null, min: 0, max: D.totals.high, sort: 'rec', wish: false, fresh: false, q: '', page: 1 }, keep);
  function fromRoute(route) {
    const key = [route.name, route.a, route.b].join('|');
    if (F.key === key) return; F.key = key;
    if (route.name === 'wishlist') return resetF({ wish: true });
    if (route.name === 'search') return resetF({ q: route.a });
    const v = route.b;
    if (route.a === 'border') resetF({ border: v });
    else if (route.a === 'work') resetF({ work: v });
    else if (route.a === 'colour') resetF({ fam: v });
    else if (route.a === 'collection') resetF({ col: +v });
    else if (route.a === 'price') { const b = BANDS.find((x) => x.key === v) || BANDS[0]; resetF({ min: b.min, max: b.max }); }
    else if (route.a === 'new') resetF({ sort: 'new', fresh: true });
    else resetF();
  }
  function listFor() {
    const list = P.filter((p) => { const c = C[p.c]; return (!F.fam || p.fam === F.fam) && (!F.border || c.border === F.border) && (!F.work || c.work === F.work) && (F.col === null || p.c === F.col) && c.price >= F.min && c.price <= F.max && (!F.wish || N.data.wish.includes(p.id)) && (!F.q || N.searchList(F.q).includes(p)); });
    const pr = (p) => C[p.c].price;
    list.sort(F.sort === 'low' ? (a, b) => pr(a) - pr(b) : F.sort === 'high' ? (a, b) => pr(b) - pr(a) : F.sort === 'hue' ? (a, b) => a.h - b.h : F.sort === 'new' ? (a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id) : (a, b) => rank[a.id] - rank[b.id]);
    return list;
  }
  function titleFor() {
    const band = BANDS.find((b) => b.min === F.min && b.max === F.max);
    return F.wish ? 'Your wishlist' : F.q ? `Results for “${F.q}”` : F.col !== null ? tidy(C[F.col].name) : F.border ? `${F.border} border sarees` : F.work ? `${F.work} sarees` : F.fam ? `${F.fam} sarees` : band ? `Sarees ${band.title.toLowerCase()}` : F.fresh ? 'New arrivals' : 'All sarees';
  }
  function listingMain(UI) {
    const list = listFor(), pages = Math.max(1, Math.ceil(list.length / PAGE));
    F.page = Math.min(F.page, pages);
    const start = (F.page - 1) * PAGE, shown = list.slice(start, start + PAGE);
    const band = BANDS.find((b) => b.min === F.min && b.max === F.max);
    const chips = [];
    if (F.fam) chips.push(['fam', F.fam]); if (F.border) chips.push(['border', F.border + ' border']); if (F.work) chips.push(['work', F.work]);
    if (F.col !== null) chips.push(['col', tidy(C[F.col].name)]); if (band) chips.push(['band', band.title]); else if (F.max < D.totals.high) chips.push(['max', 'Up to ' + rupee(F.max)]);
    if (F.q) chips.push(['q', `“${F.q}”`]);
    const grid = UI === 'loading' ? Array(6).fill(skCard()).join('')
      : UI === 'error' ? `<div class="empty">${I.alert}<span class="empty-title">We could not load the sarees</span><p>The server did not answer. Check your connection and try again.</p><button class="btn" type="button" data-act="retry">Try again</button></div>`
      : (UI === 'empty' || !list.length) ? emptyBlock(F.wish ? I.heart : I.search, F.wish ? 'Nothing saved yet' : F.q ? `Nothing found for “${F.q}”` : 'No saree matches these filters', F.wish ? 'Tap the heart on any saree to keep it here.' : F.q ? 'Try a colour such as blue, a border such as scallop, or a work such as hand painted.' : 'Try removing a filter, or browse every collection.', `<a class="btn" href="#/shop">View all sarees</a>`)
      : shown.map((p, i) => card(p, i % 3)).join('');
    const pager = pages > 1 && UI === 'normal' ? `<nav class="pages" aria-label="Pages"><button type="button" data-page="${F.page - 1}" ${F.page <= 1 ? 'disabled' : ''} aria-label="Previous page">${I.left}</button>${Array.from({ length: pages }, (_, i) => `<button type="button" data-page="${i + 1}" ${i + 1 === F.page ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('')}<button type="button" data-page="${F.page + 1}" ${F.page >= pages ? 'disabled' : ''} aria-label="Next page">${I.right}</button><span class="pages-note">Page ${F.page} of ${pages}</span></nav>` : '';
    return `<div class="toolbar">
      <div class="toolbar-left"><button class="btn filter-toggle" type="button" data-act="filter-toggle" aria-expanded="false" aria-controls="filters">${I.filter} Filter</button><span class="label muted">${UI === 'loading' ? 'Loading…' : `${list.length} ${list.length === 1 ? 'saree' : 'sarees'}`}</span><div class="chips">${chips.map(([k, t]) => `<button class="chip" type="button" data-unset="${k}" aria-label="Remove filter ${esc(t)}">${esc(t)} <span aria-hidden="true">×</span></button>`).join('')}</div></div>
      <label class="label muted">Sort by <select id="f-sort" aria-label="Sort by"><option value="rec"${F.sort === 'rec' ? ' selected' : ''}>Recommended</option><option value="new"${F.sort === 'new' ? ' selected' : ''}>Newest</option><option value="low"${F.sort === 'low' ? ' selected' : ''}>Price, low to high</option><option value="high"${F.sort === 'high' ? ' selected' : ''}>Price, high to low</option><option value="hue"${F.sort === 'hue' ? ' selected' : ''}>Colour</option></select></label>
    </div>
    <div class="grid" id="shop-grid">${grid}</div>${pager}`;
  }
  const filtersHtml = () => `<div class="fgroup"><h4>Colour</h4><div class="fshades">${FAMILIES.map((f) => `<button class="fshade" type="button" data-f="fam" data-v="${f}" aria-pressed="${F.fam === f}" style="--c:${famHex(f)}" aria-label="${f}"><i></i><span>${f.split(' ')[0]}</span></button>`).join('')}</div></div>
    <div class="fgroup"><h4>Border</h4><div class="fopts">${BORDERS.map((b) => `<button class="fopt" type="button" data-f="border" data-v="${b}" aria-pressed="${F.border === b}"><span>${esc(b)}</span><small>${P.filter((p) => C[p.c].border === b).length}</small></button>`).join('')}</div></div>
    <div class="fgroup"><h4>Work</h4><div class="fopts">${WORKS.map((w) => `<button class="fopt" type="button" data-f="work" data-v="${w}" aria-pressed="${F.work === w}"><span>${esc(w)}</span><small>${P.filter((p) => C[p.c].work === w).length}</small></button>`).join('')}</div></div>
    <div class="fgroup frange"><h4>Price</h4><input type="range" id="f-max" min="${D.totals.low}" max="${D.totals.high}" step="100" value="${Math.min(F.max, D.totals.high)}" aria-label="Highest price"><div><span>${rupee(D.totals.low)}</span><span id="f-max-label">${rupee(Math.min(F.max, D.totals.high))}</span></div></div>
    <div class="fgroup"><button class="under" type="button" data-act="f-clear">Clear all filters</button></div>`;
  function renderListing() { const m = $('#listing-main'); if (!m) return; m.innerHTML = listingMain(N.UI); $('#filters').innerHTML = filtersHtml(); N.observe(); }
  N.listing = { F, renderListing, resetF };

  const listingPage = {
    title: () => titleFor(),
    render(route, UI) {
      fromRoute(route); const title = titleFor();
      const lede = F.col !== null ? [C[F.col].spec.Material, C[F.col].spec.Loom, C[F.col].spec.Body && tidy(C[F.col].spec.Body), rupee(C[F.col].price)].filter(Boolean).join(' · ')
        : F.wish ? 'The sarees you have saved. In this mock they are kept on this device only.' : F.q ? 'Search looks at the name, collection, colour, border and work of every saree.' : 'Pattu sarees from the looms of Mangalagiri, each collection at one price.';
      const trail = [['Home', '#/']]; if (F.col !== null || F.border || F.work) trail.push(['Collections', '#/collections']); trail.push([title === 'All sarees' ? 'Sarees' : title]);
      return `<div class="wrap">${crumbs(trail)}
        <div class="page-head"><h1>${esc(title)}${F.wish ? ' <span class="sample">Planned feature</span>' : ''}</h1><div class="orn"><i></i></div><p>${esc(lede)}</p></div>
        <div class="listing"><aside class="filters" id="filters" aria-label="Filters">${filtersHtml()}</aside><div id="listing-main">${listingMain(UI)}</div></div></div>`;
    },
    popup() { const first = listFor()[0]; if (first) N.quick(first.id); },
  };
  N.pages.shop = listingPage; N.pages.search = listingPage; N.pages.wishlist = listingPage;

  /* ---------- product ---------- */
  const SHOTS = [{ name: 'Full', s: 1, x: 50, y: 50 }, { name: 'Border', s: 2.3, x: 50, y: 94 }, { name: 'Body', s: 2.3, x: 42, y: 46 }, { name: 'Pallu', s: 2.1, x: 66, y: 18 }];
  N.pages.product = {
    title: (r) => (byId[r.a] ? nm(byId[r.a]) : 'Saree'),
    render(route, UI) {
      const p = byId[route.a];
      if (!p || route.b === 'sold' || UI === 'error') return soldPage(p);
      const c = C[p.c];
      if (UI === 'loading') return `<div class="wrap"><div class="crumbs"><div class="sk sk-text w40" style="width:260px"></div></div><div class="pd"><div class="sk sk-img"></div><div class="stack"><div class="sk sk-text w40"></div><div class="sk sk-text w80" style="height:40px"></div><div class="sk sk-text w40"></div><div class="sk sk-line"></div><div class="sk sk-line"></div><div class="sk sk-text"></div><div class="sk sk-text w80"></div></div></div></div>`;
      const gap = (a) => { const d = Math.abs(a.h - p.h); return (a.c === p.c ? 0 : 60) + Math.min(d, 360 - d); };
      const like = P.filter((x) => x.id !== p.id).sort((a, b) => gap(a) - gap(b)).slice(0, 12);
      const low = UI === 'warning';
      return `<div class="wrap">${crumbs([['Home', '#/'], ['Sarees', '#/shop'], [bd(c), '#/shop/border/' + encodeURIComponent(c.border)], [nm(p)]])}
      <div class="pd">
        <div class="gallery">
          <div class="thumbs" id="thumbs">${SHOTS.map((v, i) => `<button class="thumb" type="button" data-shot="${i}" aria-pressed="${i === 0}" aria-label="${v.name} view"><img src="${p.img}" alt="" style="transform:scale(${v.s});transform-origin:${v.x}% ${v.y}%"><small>${v.name}</small></button>`).join('')}</div>
          <div class="stage" id="stage"><img id="pd-img" src="${p.img}" alt="${esc(nm(p))}, ${p.fam.toLowerCase()}"><span class="stage-hint" id="stage-hint">Hover to zoom</span></div>
        </div>
        <div class="pd-info">
          <div class="pd-top"><span class="label">${esc(bd(c))} · ${esc(c.work)}</span><h1>${esc(nm(p))}</h1><span class="label muted">Tag ${p.id} · one of ${c.total} in this collection</span></div>
          <div class="pd-price"><span>${rupee(c.price)}</span><small>Inclusive of GST · no delivery charge</small></div>
          <div class="pd-note${low ? ' low' : ''}"><i></i><span>${low ? 'Only one piece, and it is in someone else’s bag right now. It stays available until they pay.' : p.stock === 1 ? 'Only one piece available. Every saree here is a single handloom piece.' : `${p.stock} pieces available`}</span></div>
          <div class="pd-shade"><i style="background:${p.hex}"></i>${p.hex2 ? `<i style="background:${p.hex2}"></i>` : ''}<div><span class="label muted">Colour</span><div class="pd-fam">${p.fam}</div></div></div>
          <div class="pd-buy"><button class="btn btn-fill" type="button" id="pd-add" data-add="${p.id}">Add to bag</button><button class="btn" type="button" data-act="buy-now" data-id="${p.id}">Buy now</button><button class="wish" type="button" data-wish="${p.id}" aria-pressed="${N.data.wish.includes(p.id)}" aria-label="Save to wishlist">${I.heart}</button></div>
          <a class="btn btn-block" href="${SHOP.wa(`Hello Nandam Handlooms, I would like to know more about ${nm(p)}, tag ${p.id}, ${rupee(c.price)}.`)}" target="_blank" rel="noopener">Enquire on WhatsApp</a>
          <div class="assure"><div>${I.card}<span>Secure payment by UPI, cards and netbanking through Razorpay</span></div><div>${I.truck}<span>Delivered across India by DTDC. Track with the AWB number in My Orders.</span></div><div>${I.wa}<span>Questions? WhatsApp us on <b>${SHOP.phoneShow}</b></span></div><div>${I.pin}<span>See it in person at our store in Old Mangalagiri</span></div></div>
          <div>
            <details open><summary>Product details</summary><div class="detail-body"><dl class="spec">${Object.entries(c.spec).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(tidy(v))}</dd></div>`).join('')}<div><dt>Colour</dt><dd>${p.fam} (read from the photograph)</dd></div><div><dt>Tag</dt><dd>${p.id}</dd></div></dl></div></details>
            <details><summary>About this collection</summary><div class="detail-body">${esc(tidy(c.name))} is a collection of ${c.total} sarees, each at ${rupee(c.price)}. It carries a ${esc(c.border)} border with ${esc(c.work.toLowerCase())} work. <a class="link" href="#/shop/collection/${p.c}">See the whole collection</a>.</div></details>
            <details><summary>Delivery and returns</summary><div class="detail-body">Orders are packed in Mangalagiri and sent by DTDC. No delivery charge is added at checkout. <span class="sample">Planned</span> The shop has not yet written its delivery times and returns policy; this text is a placeholder for them.</div></details>
            <details><summary>A note on colour</summary><div class="detail-body">The colour named here is taken from the photograph. Screens show colour a little differently from cloth, so if the exact shade matters, ask us for a fresh photograph on WhatsApp before you buy.</div></details>
          </div>
        </div>
      </div></div>
      <div class="sec sec-stone"><div class="wrap">${secHead('More to see', 'You may also like')}${railHtml('like', like.map((x, i) => card(x, i)).join(''))}</div></div>`;
    },
    after(route, UI) {
      const p = byId[route.a]; if (!p || route.b === 'sold' || UI !== 'normal' && UI !== 'warning' && UI !== 'popup' && UI !== 'success') return;
      const stage = $('#stage'), img = $('#pd-img'); if (!stage) return;
      let shot = 0;
      const setShot = (i) => { shot = i; const v = SHOTS[i]; img.style.transformOrigin = `${v.x}% ${v.y}%`; img.style.transform = `scale(${v.s})`; $$('.thumb').forEach((t, k) => t.setAttribute('aria-pressed', k === i)); };
      N.setShot = setShot; setShot(0);
      $('#stage-hint').textContent = matchMedia('(hover: hover)').matches ? 'Hover to zoom' : 'Tap to see the next view';
      stage.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const r = stage.getBoundingClientRect(); stage.classList.add('zooming'); img.style.transformOrigin = `${(e.clientX - r.left) / r.width * 100}% ${(e.clientY - r.top) / r.height * 100}%`; img.style.transform = 'scale(2.4)'; });
      stage.addEventListener('pointerleave', () => { stage.classList.remove('zooming'); setShot(shot); });
      stage.addEventListener('click', () => { if (!matchMedia('(hover: hover)').matches) setShot((shot + 1) % SHOTS.length); });
      $('#bb-img').src = p.img; $('#bb-name').textContent = nm(p); $('#bb-price').textContent = rupee(C[p.c].price); $('#bb-add').dataset.add = p.id;
      if (UI === 'success') { N.addToBag(p.id, true); N.toast('Added to your bag'); }
    },
    popup(route) { const p = byId[route.a]; if (p) { N.addToBag(p.id, true); N.showPanel('bag'); } },
  };
  function soldPage(p) {
    return `<div class="gate-page"><div class="card"><div class="ring-icon">${I.clock}</div><h1>No longer available</h1><p>${p ? esc(nm(p)) + ' was' : 'This saree was'} a one-of-a-kind handloom piece, and it has been sold. Every saree in the shop is a single piece, so a sold one does not come back.</p><div class="acts" style="justify-content:center"><a class="btn btn-fill" href="${p ? '#/shop/collection/' + p.c : '#/shop'}">See similar sarees</a><a class="btn" href="#/shop">Continue shopping</a></div></div></div>`;
  }

  /* ---------- cart page ---------- */
  N.pages.cart = {
    title: 'Your bag',
    render(route, UI) {
      const bag = UI === 'empty' ? [] : N.data.bag;
      if (UI === 'loading') return `<div class="wrap"><div class="page-head left"><div class="sk sk-text w40" style="height:40px;width:220px"></div></div><div class="two"><div>${Array(2).fill('<div class="line"><div class="sk sk-img" style="width:78px"></div><div><div class="sk sk-text w60"></div><div class="sk sk-text w40"></div></div></div>').join('')}</div><div class="card"><div class="sk sk-text w60"></div><div class="sk sk-line"></div></div></div></div>`;
      if (!bag.length) return `<div class="wrap">${crumbs([['Home', '#/'], ['Your bag']])}${emptyBlock(I.bag, 'Your bag is empty', 'Browse the collections and add something you love. Every saree is a single piece, so what you add is held for you only when you pay.', '<a class="btn btn-fill" href="#/shop">Start shopping</a>', 'h1')}</div>`;
      const off = UI === 'warning' ? bag[0] : null;
      return `<div class="wrap">${crumbs([['Home', '#/'], ['Your bag']])}
        <div class="page-head left"><h1>Your bag</h1><p>${bag.length} ${bag.length === 1 ? 'saree' : 'sarees'}. One piece each, no quantity to choose.</p></div>
        ${UI === 'error' ? `<div class="alert bad" style="margin-bottom:20px">${I.alert}<div><b>We could not check stock</b><p>The live stock check did not answer. You can still go to checkout; stock is checked again before you pay.</p></div></div>` : ''}
        <div class="two"><div>
          ${off ? `<div class="alert warn" style="margin-bottom:10px">${I.alert}<div><b>One saree in your bag has just been sold</b><p>It was a single piece and someone bought it in the shop. Remove it to continue.</p></div></div>` : ''}
          ${bag.map((id) => { const p = byId[id]; return `<div class="line${id === off ? ' off' : ''}"><a href="#/product/${id}"><img src="${p.img}" alt=""></a><div><a class="line-name" href="#/product/${id}">${esc(nm(p))}</a><span class="label">${esc(bd(C[p.c]))} · ${p.fam} · Tag ${p.id}</span>${id === off ? '<span class="pill bad" style="margin-bottom:10px">Sold out</span><br>' : ''}<button class="under" type="button" data-remove="${id}" style="font-size:10px">Remove</button></div><span class="price">${rupee(C[p.c].price)}</span></div>`; }).join('')}
          <p class="note" style="margin-top:16px">Adding a saree to your bag does not hold it. It is held for you for 15 minutes once you start paying.</p>
        </div>
        <aside class="card summary"><h3>Order summary</h3><div class="rows"><div><span>Subtotal</span><span class="rupee">${rupee(N.bagTotal())}</span></div><div><span>Delivery</span><span>No charge</span></div><div class="total"><span>Total</span><b class="rupee">${rupee(N.bagTotal())}</b></div></div>
          <button class="btn btn-fill btn-block" type="button" data-go="#/checkout" ${off ? 'disabled' : ''}>Proceed to checkout</button><a class="under" href="#/shop" style="justify-self:center">Continue shopping</a>
          <div class="assure"><div>${I.card}<span>UPI, cards and netbanking</span></div><div>${I.truck}<span>Delivered by DTDC across India</span></div></div></aside></div></div>`;
    },
    popup() { N.showPanel('bag'); },
  };
})();
