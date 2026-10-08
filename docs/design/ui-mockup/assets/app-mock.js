/* Mock-up tools: start page, design kit, device preview, the Design options panel, event wiring and boot. */
(() => {
  'use strict';
  const N = window.NH;
  const { C, P, D, $, $$, rupee, esc, I, OPTS, opts, STATUS, crumbs } = N;

  /* ---------- start page ---------- */
  const SCREENS = [
    ['Public shopping', [
      ['Home', '#/', 'Top section, services, shop by border, new arrivals, story, price, colour, store, WhatsApp.'],
      ['Collections', '#/collections', 'The 23 collections in stock, one price each. The live site’s category page.'],
      ['All sarees', '#/shop', 'Listing with filters for colour, border, work and price, sort, and pages of 12.'],
      ['Collection listing', '#/shop/collection/0', 'One collection, with its material, loom and model lines from the shop.'],
      ['Shop by border', '#/shop/border/Scallop', 'Listing narrowed to a border, from the mega menu or the home page.'],
      ['New arrivals', '#/shop/new', 'Newest first. Replaces the empty Bestsellers row on the live site.'],
      ['Search results', '#/search/blue', 'Search by colour, border, work or tag. The search overlay opens from the header.'],
      ['Product page', '#/product/' + P[33].id, 'Gallery with zoom and detail views, price, stock, colour, buy buttons, details, you may also like.'],
      ['Saree no longer available', '#/product/' + P[33].id + '/sold', 'What an old link shows after a single piece has been sold.'],
      ['Your bag', '#/cart', 'Bag page with removal, summary and checkout. The bag drawer opens from the header too.'],
      ['Wishlist', '#/wishlist', 'Planned feature. Saved on this device only in the mock.'],
    ]],
    ['Buying', [
      ['Checkout, signed out', '#/checkout', 'The sign-in gate shown when you reach checkout without an account. Sign out first to see it.'],
      ['Checkout', '#/checkout', 'Delivery address, saree list with stock check, summary, and the Pay button.'],
      ['Payment window', '#/checkout', 'Stand-in for Razorpay. Press the Pop-up state button on the checkout page, or tap Pay.'],
      ['Order confirmed', '#/order-confirmation/NH51204488', 'Paid. The GST invoice link appears a few seconds later.'],
      ['Payment pending', '#/order-confirmation/NH51204488', 'Press the Warning state button on the confirmation page.'],
      ['Payment failed', '#/order-confirmation/NH51204488', 'Press the Error state button on the confirmation page.'],
    ]],
    ['Account', [
      ['Sign in', '#/login', 'Mobile number and MPIN. Any 10-digit number works in the mock.'],
      ['Create account', '#/register', 'Name, mobile, state and pincode, then OTP and MPIN.'],
      ['Verify by OTP', '#/otp', 'Six boxes, resend countdown. Sample code 123456. Start from Create account.'],
      ['Set MPIN', '#/mpin-setup', 'Last step of sign-up. Rejects easy PINs like 1234. Start from Create account.'],
      ['Forgot MPIN', '#/forgot-mpin', 'Enter the mobile number to get a reset code.'],
      ['Reset MPIN', '#/reset-mpin', 'After the OTP: choose a new MPIN. Also the success card.'],
      ['My profile', '#/account', 'Personal details, verified number, addresses with add, edit, delete and default, security.'],
      ['My orders', '#/account/orders', 'Three sample orders plus any you place in the mock. Table becomes cards on a phone.'],
      ['Order detail', '#/account/orders/NH50937716', 'Timeline, DTDC AWB number, sarees, address, payment, invoice.'],
    ]],
    ['Other', [
      ['Maintenance', '#/maintenance', 'Shown instead of the shop when the owner switches it on in the staff app.'],
      ['Page not found', '#/nowhere', 'For old or broken links.'],
    ]],
    ['Mock-up tools', [
      ['Design kit', '#/kit', 'Colours, type scale, buttons, fields, pills, alerts, cards, tables, progress, loading placeholders, icons.'],
      ['Device preview', '#/preview', 'Any screen inside a phone, tablet or laptop frame, or phone and laptop side by side.'],
    ]],
  ];
  N.SCREENS = SCREENS;
  N.pages.start = {
    title: 'Mock-up start page',
    render() {
      return `<div class="start-hero"><div class="wrap" style="display:grid;gap:18px"><span class="sample">Mock-up · not part of the product</span><h1>Nandam Handlooms website mock-up</h1><p>A clickable mock of the whole customer website, built from the live catalogue on ${D.built}. Every screen is listed below. Use the <b>Design options</b> panel at the bottom left to switch theme, palette, fonts, corners, layouts and screen states, then copy your choices and send them back.</p>
        <div class="figures"><div><b>${D.totals.sarees.toLocaleString('en-IN')}</b><span>Sarees online</span></div><div><b>${P.length}</b><span>Shown in the mock</span></div><div><b>${C.length}</b><span>Collections</span></div><div><b>${rupee(D.totals.low)} – ${rupee(D.totals.high)}</b><span>Price range</span></div></div>
        <div class="acts"><a class="btn btn-fill" href="#/">Open the home page</a><a class="btn" href="#/kit">Design kit</a><a class="btn" href="#/preview">Device preview</a></div></div></div>
      <div class="wrap">
        ${SCREENS.map(([group, list]) => `<div class="start-sec"><h2>${group}</h2><div class="start-grid">${list.map(([name, href, text]) => `<a class="screen" href="${href}"><span class="path">${esc(href)}</span><b>${esc(name)}</b><p>${esc(text)}</p></a>`).join('')}</div></div>`).join('')}
        <div class="start-sec"><h2>How to review</h2><ol><li>Open the <b>Design options</b> panel (bottom left). Every option has a letter.</li><li>Walk through the screens above. The <b>Go to screen</b> menu in the panel jumps anywhere.</li><li>Use the <b>screen state</b> buttons to see loading, empty, error, success, warning and pop-up versions of the page you are on.</li><li>Press <b>Copy my choices</b> and paste the text into your reply.</li></ol></div>
        <div class="start-sec"><h2>Real and sample</h2><ul><li><b>Real:</b> every saree, photo, collection name, price and spec line comes from the live catalogue. The shop address, phone, hours and map link are the real ones.</li><li><b>Sample:</b> the customer Priya Sharma, her two addresses, the three orders, AWB numbers and invoice numbers. The OTP code 123456 and the payment window are stand-ins. Anything marked <span class="sample">Sample</span> or <span class="sample">Planned</span> is not live data.</li><li><b>Not on the live site today:</b> wishlist, delivery and returns text, policy pages, order timeline, colour filter.</li></ul></div>
        <div class="start-sec"><h2>Content fixed in this mock</h2><ul>
          <li><b>“89% off” on every saree.</b> The live site shows a struck-out MRP of ₹16,999 on all 660 sarees because that MRP is a placeholder. The mock hides MRP and discount until real MRPs are entered.</li>
          <li><b>Search box said “sarees, shawls”.</b> No shawls are sold. It now says what you can search by.</li>
          <li><b>Empty Bestsellers row.</b> No product is marked featured, so the home page showed “New arrivals coming soon”. The mock shows real new arrivals, newest first.</li>
          <li><b>“Embroidry”.</b> Spelt Embroidery on screen. The database is unchanged.</li>
          <li><b>“100% pure handloom” claim.</b> Two collections are described as powerloom in the shop’s own data, so the mock states the loom per collection and makes no blanket claim.</li>
          <li><b>Same name on 43 sarees.</b> Product names repeat the collection name, so each card also shows the border, the colour and the tag number.</li>
          <li><b>One category in the menu.</b> Only one category has stock, so the menu is organised by border, work, price and colour instead of by category.</li>
          <li><b>Pincode example “524001”.</b> The shop is in Mangalagiri 522503, so the example now matches.</li>
          <li><b>“Invalid access” wording</b> on the OTP page replaced with a plain “Start again” message.</li>
          <li><b>“Contact support” with no link.</b> Changing the mobile number now points to WhatsApp.</li>
          <li><b>No note about archived orders.</b> The 6-month archive rule from the spec is now stated on My Orders.</li>
        </ul></div>
      </div>`;
    },
  };

  /* ---------- design kit ---------- */
  N.pages.kit = {
    title: 'Design kit',
    render() {
      const cs = getComputedStyle(document.documentElement);
      const tok = (n) => cs.getPropertyValue(n).trim();
      const colours = [['--bg', 'Page'], ['--bg2', 'Soft ground'], ['--ink', 'Ink'], ['--muted', 'Muted text'], ['--line', 'Hairline'], ['--accent', 'Accent fill'], ['--accent-ink', 'Accent text'], ['--gold', 'Gold'], ['--gold-light', 'Gold on dark'], ['--ok', 'Success'], ['--warn', 'Warning'], ['--bad', 'Error'], ['--info', 'Information']];
      const sec = (title, inner, note = '') => `<div class="kit-sec"><div><h2>${title}</h2>${note ? `<p class="note">${note}</p>` : ''}</div>${inner}</div>`;
      return `<div class="wrap">${crumbs([['Start page', '#/start'], ['Design kit']])}<div class="page-head left"><span class="sample">Mock-up tool</span><h1>Design kit</h1><p>Every piece of the interface in the palette, fonts and corners you have chosen in the Design options panel. Change an option and this page updates.</p></div>
        ${sec('Colours', `<div class="swatches">${colours.map(([v, n]) => `<div class="swatch"><i style="--c:var(${v})"></i><div><b>${n}</b><code>${v} ${esc(tok(v))}</code></div></div>`).join('')}</div>`, `Palette ${opts.palette.toUpperCase()} ${OPTS.palette[1][opts.palette]}, ${document.documentElement.dataset.theme || 'auto'} theme.`)}
        ${sec('Type scale', `<div class="type-scale"><div><span class="label">Display · h1</span><span style="font-family:var(--serif);font-size:clamp(42px,6vw,88px);line-height:1">The art of the weave</span></div><div><span class="label">Heading · h2</span><h2 style="font-size:clamp(32px,4vw,56px)">Shop by border</h2></div><div><span class="label">Heading · h3</span><h3 style="font-size:26px">Order summary</h3></div><div><span class="label">Card title</span><span style="font-family:var(--serif);font-size:21px;font-weight:500">Scallop Border Hand Painted Saree</span></div><div><span class="label">Body</span><span>Pattu sarees with zari borders, brought to you directly from the weavers of Old Mangalagiri. Running text stays near 65 characters wide.</span></div><div><span class="label">Note</span><span class="note">Stock is checked once more when you tap Pay.</span></div><div><span class="label">Label</span><span class="label">Mangalagiri handloom</span></div><div><span class="label">Price</span><span class="price" style="font-size:18px">${rupee(3800)}</span></div></div>`, `Fonts ${opts.font.toUpperCase()} ${OPTS.font[1][opts.font]}.`)}
        ${sec('Buttons', `<div class="kit-row"><button class="btn btn-fill" type="button">Add to bag</button><button class="btn" type="button">Continue shopping</button><button class="btn btn-ghost" type="button">Cancel</button><span style="background:var(--accent-deep);padding:10px;display:inline-block"><button class="btn btn-light" type="button">On a photograph</button></span><button class="btn btn-sm" type="button">Small</button><button class="btn btn-fill" type="button" disabled>Disabled</button><button class="btn btn-fill busy" type="button">Processing</button><button class="under" type="button">Text link</button><a class="link" href="#/kit">Inline link</a><button class="icon" type="button" aria-label="Bag">${I.bag}<span class="badge-n">2</span></button><button class="arrow-btn" type="button" aria-label="Next">${I.right}</button></div>`)}
        ${sec('Form fields', `<div class="row2" style="max-width:760px"><div class="field"><label for="k-text">Text field</label><input class="input" id="k-text" placeholder="Placeholder"></div><div class="field"><label for="k-sel">Select</label><select class="input" id="k-sel"><option>Andhra Pradesh</option><option>Telangana</option></select></div><div class="field"><label for="k-bad">With an error</label><input class="input bad" id="k-bad" value="98765"><span class="err">Enter a valid 10-digit mobile number</span></div><div class="field"><label for="k-good">Verified</label><div class="input-wrap"><input class="input" id="k-good" value="+91 98765 43210" disabled>${I.checkCircle}</div><span class="hint">Message us on WhatsApp to change it.</span></div><div class="field"><span class="lbl">One-time code</span><div class="pin">${[1, 2, 3, '', '', ''].map((v, i) => `<input class="input" maxlength="1" value="${v}" aria-label="Digit ${i + 1}">`).join('')}</div></div><div class="field"><label for="k-mpin">MPIN</label><input class="input input-mpin" id="k-mpin" type="password" value="2580"></div><label class="radio"><input type="radio" name="k-r" checked> Radio, selected</label><label class="check"><input type="checkbox" checked> Make this my default address</label><div class="field frange" style="grid-column:1/-1"><span class="lbl">Range</span><input type="range" min="1800" max="4200" value="3200" aria-label="Highest price"><div><span>${rupee(1800)}</span><span>${rupee(3200)}</span></div></div></div>`)}
        ${sec('Pills and badges', `<div class="kit-row">${Object.keys(STATUS).map((k) => `<span class="pill ${STATUS[k][1]}">${STATUS[k][0]}</span>`).join('')}<span class="pill gold">Default</span><span class="pill">Neutral</span><span class="pc-tag" style="position:static">New</span><span class="sample">Sample</span><span class="sample">Planned</span></div>`)}
        ${sec('Alerts', `<div class="stack" style="max-width:760px"><div class="alert info">${I.info}<div><b>Information</b><p>Orders older than 6 months are archived.</p></div></div><div class="alert ok">${I.checkCircle}<div><b>Profile updated</b></div></div><div class="alert warn">${I.alert}<div><b>Can’t proceed, one saree is out of stock</b><p>Remove it to continue.</p></div></div><div class="alert bad">${I.alert}<div><b>Payment failed</b><p>Nothing has been charged. Please try again.</p></div></div><div class="otp-note">${I.info}<div><b>Sample code</b> 123456</div></div></div>`)}
        ${sec('Cards', `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));align-items:start">${N.card(P[33], 0, true)}${N.card(P[60], 1, true)}<a class="tile" href="#/shop/collection/5"><span class="tile-img"><img src="${C[5].img}" alt="" loading="lazy"></span><span class="tile-name">${esc(C[5].name)}</span><span class="muted">${C[5].total} sarees · ${rupee(C[5].price)}</span><span class="under">View</span></a><div class="addr on"><input type="radio" checked aria-label="Selected address"><div><b>Priya Sharma</b> · +91 98765 43210<p>Flat 302, Lakshmi Residency, Hyderabad, Telangana – 500034</p></div>${I.checkCircle}</div></div>`, `Product card ${opts.card.toUpperCase()} ${OPTS.card[1][opts.card]}. Hover a card to see its behaviour.`)}
        ${sec('Table', `<table class="orders-table"><thead><tr><th>Order</th><th>Sarees</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>${N.data.orders.slice(0, 2).map((o) => `<tr><td><span class="no">${o.no}</span><br><span class="muted" style="font-size:13px">${N.fmtDate(o.placedAt)}</span></td><td data-th="Sarees"><div class="thumbs-sm">${o.items.map((it) => `<img src="${it.img}" alt="">`).join('')}</div></td><td data-th="Status"><span class="pill ${STATUS[o.status][1]}">${STATUS[o.status][0]}</span></td><td data-th="Total" class="rupee">${rupee(o.total)}</td><td><a class="btn btn-ghost btn-sm" href="#/account/orders/${o.no}">View</a></td></tr>`).join('')}</tbody></table>`, 'Rows turn into cards below 900px.')}
        ${sec('Progress', `<div class="stack" style="max-width:760px"><div class="steps">${['Bag', 'Address', 'Payment', 'Confirmation'].map((s, i) => `<div class="step ${i < 1 ? 'done' : i === 1 ? 'now' : ''}"><i></i><span>${i + 1}. ${s}</span></div>`).join('')}</div><div class="timeline">${[['Order placed', 'done'], ['Payment received', 'done'], ['Packed in Mangalagiri', 'now'], ['Shipped by DTDC', 'todo']].map(([t, k]) => `<div class="tl ${k}"><i>${k === 'done' ? I.check : ''}</i><div><b>${t}</b><span>Step description</span></div></div>`).join('')}</div><div class="kit-row"><div class="to-top show"><svg class="meter-ring" viewBox="0 0 46 46"><circle cx="23" cy="23" r="21"/><circle cx="23" cy="23" r="21" style="stroke-dashoffset:50"/></svg>${I.up}</div><div class="spinner"></div><svg class="ok-mark" viewBox="0 0 100 100" style="width:60px;height:60px;margin:0"><circle cx="50" cy="50" r="46"/><path d="M30 52l13 13 27-30"/></svg></div></div>`)}
        ${sec('Loading placeholders', `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${N.skCard()}${N.skCard()}<div class="stack"><div class="sk sk-text w80"></div><div class="sk sk-text"></div><div class="sk sk-text w60"></div><div class="sk sk-line"></div></div></div>`)}
        ${sec('Icons', `<div class="icons">${Object.keys(I).map((k) => `<div>${I[k]}<span>${k}</span></div>`).join('')}</div>`, 'One stroke weight, drawn inline, so they follow the text colour in both themes.')}
      </div>`;
    },
  };

  /* ---------- device preview ---------- */
  const PV = { screen: '#/', device: 'phone' };
  N.pages.preview = {
    title: 'Device preview',
    render(route) {
      if (route.a) PV.screen = '#/' + route.a.replace(/^\/+/, '');
      const all = SCREENS.flatMap(([g, list]) => list.map(([n, h]) => [g, n, h]));
      return `<div class="wrap">${crumbs([['Start page', '#/start'], ['Device preview']])}<div class="page-head left"><span class="sample">Mock-up tool</span><h1>Device preview</h1><p>Any screen inside a phone, tablet or laptop frame. The frames load this same mock, so your Design options apply inside them.</p></div>
        <div class="preview-bar"><div class="field"><label for="pv-screen">Screen</label><select class="input" id="pv-screen">${all.map(([g, n, h]) => `<option value="${esc(h)}"${h === PV.screen ? ' selected' : ''}>${esc(g)} · ${esc(n)}</option>`).join('')}</select></div><div class="field"><span class="lbl">Device</span><div class="pay-tabs" style="min-width:320px">${[['phone', 'Phone'], ['tablet', 'Tablet'], ['laptop', 'Laptop'], ['both', 'Phone + laptop']].map(([k, t]) => `<button type="button" data-device="${k}" aria-pressed="${PV.device === k}">${t}</button>`).join('')}</div></div><button class="btn btn-sm" type="button" data-act="pv-reload">Reload frames</button></div>
        <div class="devices" id="devices"></div><p class="preview-note">Phone 390 × 844, tablet 820 × 1100, laptop 1366 × 820. Frames are scaled to fit this window. If they stay blank, open the local copy of the mock: the hosted preview may not allow a page inside a page.</p></div>`;
    },
    after() { renderDevices(); },
  };
  function renderDevices() {
    const box = $('#devices'); if (!box) return;
    const src = location.pathname + location.search + PV.screen;
    const frame = (kind) => `<div class="device"><span class="label">${kind}</span><div class="device-scale" data-kind="${kind}"><div class="frame ${kind}"><iframe src="${esc(src)}" name="nh-frame" title="${kind} preview" loading="lazy"></iframe></div></div></div>`;
    box.innerHTML = PV.device === 'both' ? frame('phone') + frame('laptop') : frame(PV.device);
    scaleDevices();
  }
  function scaleDevices() {
    const box = $('#devices'); if (!box) return;
    const avail = box.clientWidth;
    $$('.device-scale', box).forEach((el) => {
      const f = el.firstElementChild, w = f.offsetWidth, h = f.offsetHeight;
      const share = PV.device === 'both' ? (el.dataset.kind === 'phone' ? .28 : .7) : 1;
      const s = Math.min(1, (avail * share - 10) / w);
      el.style.transform = `scale(${s})`; el.style.width = w * s + 'px'; el.style.height = h * s + 'px';
    });
  }
  N.previewSet = (k, v) => { PV[k] = v; renderDevices(); $$('[data-device]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.device === PV.device)); };
  N.previewReload = () => renderDevices();
  addEventListener('resize', () => { scaleDevices(); });

  /* ---------- the Design options panel ---------- */
  function renderOptsPanel() {
    const allScreens = SCREENS.flatMap(([g, list]) => list.map(([n, h]) => [g, n, h]));
    $('#opts-body').innerHTML = Object.keys(OPTS).map((k) => `<div class="opts-sec"><h4>${OPTS[k][0]}</h4><div class="opts-row">${Object.entries(OPTS[k][1]).map(([l, name]) => `<button class="opt" type="button" data-opt="${k}" data-v="${l}" aria-pressed="${opts[k] === l}"><b>${l.toUpperCase()}</b>${name}</button>`).join('')}</div></div>`).join('') +
      `<div class="opts-sec"><h4>Screen state <span id="ui-state" style="color:#c9a86a">Normal</span></h4><div class="opts-row">${['normal', 'loading', 'empty', 'error', 'success', 'warning', 'popup'].map((s) => `<button class="opt" type="button" data-ui="${s}" aria-pressed="${N.UI === s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div><p class="opts-note">Shows that state of the page you are on. It resets when you move to another page.</p></div>
      <div class="opts-sec"><h4>Go to screen</h4><select id="opts-go" aria-label="Go to screen"><option value="">Choose a screen…</option>${allScreens.map(([g, n, h]) => `<option value="${esc(h)}">${esc(g)} · ${esc(n)}</option>`).join('')}</select></div>
      <div class="opts-sec"><div class="opts-actions"><button class="opts-btn fill" type="button" data-act="opts-copy">Copy my choices</button><button class="opts-btn" type="button" data-act="opts-reset">Reset to defaults</button></div><p class="opts-note">Your choices are remembered on this device as you move between pages. Sign-in, bag and orders in the mock are also kept on this device only.</p><div class="opts-actions"><a class="opts-btn" href="#/start">Start page</a><button class="opts-btn" type="button" data-act="opts-clear">Clear mock data</button></div></div>`;
  }
  N.setOpt = (k, v) => { opts[k] = v; N.applyOptions(); renderOptsPanel(); N.renderShell(); N.render(false); N.toast(`${OPTS[k][0]}: ${v.toUpperCase()} ${OPTS[k][1][v]}`); };
  N.toggleOpts = (open) => { const p = $('#opts-panel'), t = $('#opts-tab'); const show = open ?? p.hidden; p.hidden = !show; t.setAttribute('aria-expanded', show); if (show) renderOptsPanel(); };

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a'); if (!t) return; const d = t.dataset;
    if ('close' in d) closeTop();
    if (d.go) { e.preventDefault(); N.go(d.go); }
    else if (d.add) N.addToBag(d.add);
    else if (d.wish) N.toggleWish(d.wish);
    else if (d.quick) N.quick(d.quick);
    else if (d.remove) N.removeFromBag(d.remove);
    else if (d.open) N.showPanel(d.open);
    else if (d.ask !== undefined) { const r = N.askResolve; N.askResolve = null; N.hidePanel(); if (r) r(d.ask === '1'); }
    else if (d.f) { const F = N.listing.F; F[d.f] = F[d.f] === d.v ? null : d.v; F.page = 1; N.listing.renderListing(); }
    else if (d.unset) { const F = N.listing.F; if (d.unset === 'band' || d.unset === 'max') { F.min = 0; F.max = D.totals.high; } else if (d.unset === 'q') { F.q = ''; } else F[d.unset] = null; F.page = 1; N.listing.renderListing(); }
    else if (d.page) { N.listing.F.page = +d.page; N.listing.renderListing(); $('#listing-main')?.scrollIntoView({ behavior: N.anim() ? 'smooth' : 'auto', block: 'start' }); }
    else if (d.shot) N.setShot(+d.shot);
    else if (d.slide) N.slideTo && N.slideTo((N.slideAt || 0) + +d.slide);
    else if (d.slideTo) N.slideTo && N.slideTo(+d.slideTo);
    else if (d.term) { $('#search-input').value = d.term; N.renderSearch(d.term); }
    else if (d.rail) { const r = $('#rail-' + d.rail); r.scrollBy({ left: +d.dir * (r.clientWidth + 20), behavior: N.anim() ? 'smooth' : 'auto' }); }
    else if (d.copy !== undefined) N.copyText(d.copy, d.copied || 'Copied');
    else if ('soon' in d) N.toast(d.soon || 'Planned: this page is not written yet');
    else if (d.ui) N.setUI(d.ui);
    else if (d.opt) N.setOpt(d.opt, d.v);
    else if (d.tab) N.payTab(d.tab);
    else if (d.device) N.previewSet('device', d.device);
    else if (d.act) action(d.act, t, e);
  });
  async function action(act, t, e) {
    const d = t.dataset;
    switch (act) {
      case 'retry': N.setUI('normal'); break;
      case 'filter-toggle': { const f = $('#filters'); f.classList.toggle('show'); t.setAttribute('aria-expanded', f.classList.contains('show')); break; }
      case 'f-clear': N.listing.resetF(); N.listing.renderListing(); break;
      case 'buy-now': N.addToBag(d.id, true); N.go('#/checkout'); break;
      case 'bag-checkout': N.hidePanel(); N.go('#/checkout'); break;
      case 'pay': N.openPaySheet(); break;
      case 'pay-go': N.payGo(d.no); break;
      case 'pay-fail': N.payFail(d.no); break;
      case 'invoice': N.toast(`The live site opens the GST invoice PDF ${d.no} here`); break;
      case 'sample-login': $('#login-phone').value = '9876543210'; $('#login-mpin').value = '2580'; $('#login-mpin').focus(); break;
      case 'resend': N.resendCode(); break;
      case 'logout': N.logout(); break;
      case 'try-again': t.classList.add('busy'); t.textContent = 'Checking…'; setTimeout(() => { N.toast('The shop is still closed for maintenance'); N.render(false); }, 1200); break;
      case 'to-top': scrollTo({ top: 0, behavior: N.anim() ? 'smooth' : 'auto' }); break;
      case 'opts-toggle': N.toggleOpts(); break;
      case 'opts-close': N.toggleOpts(false); break;
      case 'opts-copy': N.copyText(`Nandam Handlooms mock-up, my choices:\n${N.choicesText()}`, 'Choices copied'); break;
      case 'opts-reset': Object.assign(opts, N.OPT_DEFAULT); N.applyOptions(); renderOptsPanel(); N.renderShell(); N.render(false); N.toast('Options reset'); break;
      case 'opts-clear': if (await N.ask({ title: 'Clear mock data?', text: 'Signs out, empties the bag and wishlist, and restores the sample orders and addresses on this device.', ok: 'Clear', cancel: 'Keep', danger: true })) { ['bag', 'wish', 'session', 'profiles', 'addresses', 'orders'].forEach((k) => N.store.del(k)); location.reload(); } break;
      case 'pv-reload': N.previewReload(); break;
      case 'add-address': case 'cancel-address': case 'edit-address': case 'delete-address': case 'default-address': N.addressAct(act, d.id); break;
      case 'select-address': N.addressAct(act, t.value); break;
    }
  }
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'f-sort') { N.listing.F.sort = t.value; N.listing.F.page = 1; N.listing.renderListing(); }
    else if (t.id === 'opts-go' && t.value) { N.toggleOpts(false); N.go(t.value); t.value = ''; }
    else if (t.id === 'pv-screen') N.previewSet('screen', t.value);
    else if (t.matches('[data-act="select-address"]')) N.addressAct('select-address', t.value);
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'f-max') { const F = N.listing.F; F.min = 0; F.max = +t.value; F.page = 1; $('#f-max-label').textContent = rupee(F.max); clearTimeout(t._t); t._t = setTimeout(() => N.listing.renderListing(), 250); }
    else if (t.id === 'search-input') N.renderSearch(t.value);
    else if (t.matches('[inputmode="numeric"]') && !t.closest('[data-pin]')) t.value = t.value.replace(/\D/g, '');
  });
  document.addEventListener('submit', (e) => {
    const f = e.target; e.preventDefault();
    if (f.id === 'search-form') { const q = $('#search-input').value.trim(); N.hidePanel(); if (q) N.go('#/search/' + encodeURIComponent(q)); }
    else if (f.id === 'profile-form') N.profileSubmit(f);
    else if (f.id === 'address-form') N.addressSubmit(f);
    else { const page = N.pages[N.route.name]; if (page && page.submit) page.submit(f); }
  });
  // Closing the stand-in payment window counts as a dismissed payment, as it does with Razorpay.
  function closeTop() {
    if (N.panel && N.panel.id === 'confirm' && $('#pay')) { const no = $('[data-act="pay-go"]')?.dataset.no; N.hidePanel(); if (no) N.payDismiss(no); return; }
    N.hidePanel();
  }
  $('#scrim').addEventListener('click', closeTop);
  $('#quick').addEventListener('click', (e) => { if (e.target.id === 'quick') N.hidePanel(); });
  $('#confirm').addEventListener('click', (e) => { if (e.target.id === 'confirm') closeTop(); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (N.panel) closeTop(); else if (!$('#opts-panel').hidden) N.toggleOpts(false); $$('.nav-item.open').forEach((n) => n.classList.remove('open')); }
    else if (e.key === 'ArrowDown' && e.target.matches('.nav-item > button')) { e.preventDefault(); const item = e.target.parentElement; item.classList.add('open'); item.querySelector('.mega button')?.focus(); }
  });
  addEventListener('hashchange', N.navigate);
  addEventListener('scroll', () => { requestAnimationFrame(N.onScroll); }, { passive: true });

  /* ---------- announcement bar, cursor ring ---------- */
  const notes = $$('#announce span'); let noteAt = 0;
  setInterval(() => { if (!N.anim()) return; notes[noteAt].classList.remove('on'); noteAt = (noteAt + 1) % notes.length; notes[noteAt].classList.add('on'); }, 4200);
  const ring = $('#ring'); let rx = 0, ry = 0, tx = 0, ty = 0, ringOn = false;
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' || !N.full()) return; tx = e.clientX; ty = e.clientY; if (!ringOn) { ringOn = true; rx = tx; ry = ty; ring.classList.add('show'); } const hit = e.target.closest && e.target.closest('[data-cursor]'); ring.classList.toggle('big', Boolean(hit)); if (hit) ring.firstElementChild.textContent = hit.dataset.cursor; }, { passive: true });
  document.addEventListener('pointerleave', () => { ringOn = false; ring.classList.remove('show'); });
  (function follow() { if (ringOn) { rx += (tx - rx) * .16; ry += (ty - ry) * .16; ring.style.transform = `translate3d(${rx}px,${ry}px,0)`; } requestAnimationFrame(follow); })();

  /* ---------- boot ---------- */
  N.applyOptions();
  if (N.full() && !sessionStorage.getItem('nh.mock.intro')) { document.documentElement.classList.add('intro-on'); try { sessionStorage.setItem('nh.mock.intro', '1'); } catch (e) {} setTimeout(() => document.documentElement.classList.remove('intro-on'), 2900); }
  N.renderShell(); N.renderBag(); renderOptsPanel();
  if (window.name === 'nh-frame') $('#opts').hidden = true;   // inside a device-preview frame the panel belongs to the outer page
  document.documentElement.classList.add('rv-on');
  N.render(true); N.started = true;
})();
