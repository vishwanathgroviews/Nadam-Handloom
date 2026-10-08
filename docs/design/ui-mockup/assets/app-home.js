/* Home page (three top-section layouts), collections index, story and visit anchors. */
(() => {
  'use strict';
  const N = window.NH;
  const { C, P, $, $$, rupee, esc, tidy, nm, bd, I, SHOP, BORDERS, FAMILIES, BANDS, famHex, freshMix, card, skCard, railHtml, secHead, crumbs } = N;

  const SLIDES = [
    { img: 'img/site/hero-zari-border.jpg', alt: 'A silver zari border with paisley and flower motifs on a dark saree', label: 'Mangalagiri handloom', h: 'The art of the <em>Mangalagiri</em> weave', p: 'Pattu sarees with zari borders, brought to you directly from the weavers.', cta: 'Shop sarees', href: '#/shop' },
    { img: 'img/site/hero-cotton-checks.jpg', alt: 'Blue checked sarees folded beside brass lamps and flowers', label: 'New arrivals', h: 'Fresh from <em>the loom</em>', p: 'The newest sarees to reach our shelves in Old Mangalagiri.', cta: 'View new arrivals', href: '#/shop/new' },
    { img: 'img/site/hero-brocade.jpg', alt: 'A pale blue saree with a wide gold woven border', label: 'Shop by border', h: 'Scallop, Gap <em>and</em> Kanchi', p: 'Choose a saree the way our weavers name them: by the border.', cta: 'Explore the borders', href: '#/collections' },
  ];
  const wordWrap = (html) => html.replace(/(<em>)?([^<\s]+)(<\/em>)?/g, (m, a, w, b) => m.startsWith('<') && !a ? m : `${a || ''}<span class="w"><span>${w}</span></span>${b || ''}`);

  const heroA = () => `<div class="hero" id="hero" aria-roledescription="carousel" aria-label="Featured">
    ${SLIDES.map((s, i) => `<div class="slide${i ? '' : ' on'}"><div class="slide-media"><img src="${s.img}" alt="${esc(s.alt)}"${i ? ' loading="lazy"' : ''}></div><div class="slide-copy"><div class="wrap"><div class="stack"><span class="label">${s.label}</span><h1>${wordWrap(s.h)}</h1><p>${s.p}</p><a class="btn btn-light" href="${s.href}">${s.cta}</a></div></div></div></div>`).join('')}
    <div class="seal" aria-hidden="true"><svg viewBox="0 0 200 200"><defs><path id="seal-path" d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0"/></defs><text><textPath href="#seal-path" textLength="496">Nandam Handlooms · Weaving tradition into fashion · </textPath></text></svg><img src="img/site/logo.png" alt="" width="76" height="76"></div>
    <div class="cue" aria-hidden="true">Scroll<i></i></div>
    <div class="hero-ui"><div class="wrap"><div class="ticks" id="ticks"></div><div class="arrows"><button class="arrow-btn" type="button" data-slide="-1" aria-label="Previous slide">${I.left}</button><button class="arrow-btn" type="button" data-slide="1" aria-label="Next slide">${I.right}</button></div></div></div>
  </div>`;
  const heroB = () => `<div class="hero-b" id="hero">
    <div class="hero-b-copy"><span class="label">Mangalagiri handloom</span><h1>The art of the <em>Mangalagiri</em> weave</h1><p>Pattu sarees with zari borders, named by their border and priced by the collection, brought to you directly from the weavers of Old Mangalagiri.</p><div class="acts"><a class="btn btn-fill" href="#/shop">Shop sarees</a><a class="btn" href="#/collections">The collections</a></div></div>
    <div class="hero-b-pics">${SLIDES.map((s, i) => `<img src="${s.img}" alt="${esc(s.alt)}" class="${i ? '' : 'on'}"${i ? ' loading="lazy"' : ''}>`).join('')}<div class="hero-b-dots">${SLIDES.map((_, i) => `<button type="button" class="${i ? '' : 'on'}" data-slide-to="${i}" aria-label="Picture ${i + 1}"></button>`).join('')}</div></div>
  </div>`;
  const heroC = () => `<div class="hero-c" id="hero"><img src="${SLIDES[0].img}" alt="${esc(SLIDES[0].alt)}"><div class="hero-c-copy"><span class="label">Mangalagiri handloom</span><h1>The art of the <em>Mangalagiri</em> weave</h1><div class="orn-light"><i></i></div><p>Pattu sarees with zari borders, brought to you directly from the weavers.</p><div class="acts" style="justify-content:center"><a class="btn btn-light" href="#/shop">Shop sarees</a><a class="btn btn-light" href="#/collections">The collections</a></div></div></div>`;

  const services = () => `<div class="services"><div class="wrap">
    <div class="service">${I.loom}<b>Direct from weavers</b><span>Sourced from weaver collectives</span></div>
    <div class="service">${I.card}<b>Secure payment</b><span>UPI, cards and netbanking</span></div>
    <div class="service">${I.wa}<b>WhatsApp assistance</b><span>${SHOP.phoneShow}</span></div>
    <div class="service">${I.pin}<b>Visit our store</b><span>Old Mangalagiri, open all week</span></div>
  </div></div>`;

  const borderShows = () => BORDERS.map((b) => {
    const cols = C.map((c, i) => ({ c, i })).filter((x) => x.c.border === b).sort((x, y) => y.c.total - x.c.total);
    const own = P.filter((p) => p.c === cols[0].i);
    return { b, pic: own[2] || own[0] || P.find((p) => C[p.c].border === b), sarees: cols.reduce((t, x) => t + x.c.total, 0), from: Math.min(...cols.map((x) => x.c.price)) };
  });

  N.pages.home = {
    title: 'Handwoven sarees from Mangalagiri',
    render(route, UI) {
      const hero = N.opts.home === 'b' ? heroB() : N.opts.home === 'c' ? heroC() : heroA();
      const shows = borderShows();
      const fi = C.reduce((best, c, i) => (c.price > C[best].price ? i : best), 0), f = C[fi];
      const byHue = P.filter((p) => p.s > 0).sort((a, b) => a.h - b.h);
      const rowOf = (start) => { const pick = byHue.filter((_, i) => i % 6 === start).slice(0, 22); const cells = pick.map((p) => `<a class="ribbon-item" href="#/product/${p.id}" data-cursor="View" aria-label="${esc(nm(p))}"><img src="${p.img}" alt="" loading="lazy"></a>`).join(''); return cells + cells; };
      const ist = new Date(Date.now() + (330 + new Date().getTimezoneOffset()) * 60000), mins = ist.getHours() * 60 + ist.getMinutes(), open = mins >= 570 && mins < 1230;
      const arrivals = UI === 'loading' ? railHtml('new', Array(4).fill(skCard()).join(''))
        : UI === 'empty' ? `<div class="empty">${I.box}<span class="empty-title">New arrivals are on their way</span><p>Nothing new has reached the shelves this week. The collections below are all in stock.</p></div>`
        : UI === 'error' ? `<div class="alert bad">${I.alert}<div><b>We could not load the newest sarees</b><p>Please check your connection and try again.</p></div><button class="btn btn-sm" type="button" data-act="retry" style="margin-left:auto">Try again</button></div>`
        : railHtml('new', freshMix.map((p, i) => card(p, i)).join(''));
      return `${hero}${services()}
      <div class="marquee" aria-hidden="true"><div class="marquee-track" id="marquee">${Array(2).fill(['Mangalagiri', 'Pattu', 'Zari borders', 'Scallop', 'Kanchi', 'Hand painted', 'Chikankari', 'Rangoli checks'].map((w) => `<span>${w}</span><i></i>`).join('')).join('')}</div></div>
      <div class="sec" id="borders"><div class="wrap">
        ${secHead('The collections', 'Shop by border', 'Every saree here is named for its border. Choose yours, then the work on the body.')}
        <div class="showcase">
          <div class="show-list rv" id="show-list">${shows.map((x, i) => `<button class="show-row" type="button" data-show="${i}" data-go="#/shop/border/${encodeURIComponent(x.b)}"><b>${esc(x.b)} border</b><span>${x.sarees} sarees · from ${rupee(x.from)}</span></button>`).join('')}</div>
          <div class="show-view rv" style="--d:.15s"><a class="show-frame" id="show-frame" href="#/shop/border/${encodeURIComponent(shows[0].b)}" data-cursor="Explore" aria-label="Explore this border">${shows.map((x) => `<img src="${x.pic.img}" alt="A ${esc(x.b)} border saree" loading="lazy">`).join('')}</a><div class="show-cap"><span class="label muted" id="show-meta"></span><a class="under" id="show-btn" href="#/shop/border/${encodeURIComponent(shows[0].b)}">Explore the border</a></div></div>
        </div>
        <div class="rail-mobile rv">${railHtml('borders', shows.map((x) => `<a class="tile" href="#/shop/border/${encodeURIComponent(x.b)}"><span class="tile-img"><img src="${x.pic.img}" alt="A ${esc(x.b)} border saree" loading="lazy"></span><span class="tile-name">${esc(x.b)} border</span><span class="muted">${x.sarees} sarees · from ${rupee(x.from)}</span><span class="under">Explore</span></a>`).join(''))}</div>
      </div></div>
      <div class="sec sec-stone"><div class="wrap">
        ${secHead('Just arrived', 'New arrivals', 'Shown newest first. The live site shows a Bestsellers row here that is empty today, so this mock shows new arrivals instead.')}
        <div class="rv">${arrivals}</div>
        <div class="sec-foot rv"><a class="btn" href="#/shop/new">View all new arrivals</a></div>
      </div></div>
      <div class="sec" id="story"><div class="wrap story">
        <div class="story-art"><div class="story-main rvi"><img class="main" src="img/site/loom.jpg" alt="A weaver's hand passing the shuttle across a pattu saree on the loom" loading="lazy"></div><img class="inset rv" style="--d:.45s" src="img/site/gold-border.jpg" alt="Gold and silver zari border on an orange saree" loading="lazy" data-float></div>
        <div class="story-text rv" style="--d:.25s"><span class="label">Our story</span><h2>Every thread has <em>a story</em></h2><p>Nandam Handlooms works directly with weaver collectives to bring you pattu and cotton sarees that carry generations of craft, from hand-painted work to intricate zari borders.</p><p>No two pieces are ever quite the same.</p>
          <div class="figures">${[[N.D.totals.sarees, 'Sarees'], [N.D.totals.collections, 'Collections'], [BORDERS.length, 'Borders']].map(([a, b]) => `<div><b data-count="${a}">${a}</b><span>${b}</span></div>`).join('')}</div>
          <a class="btn" href="#/shop">Explore the collection</a></div>
      </div></div>
      <div class="feature"><img src="img/site/mint-border.jpg" alt="A grey woven border on a mint green saree" data-parallax loading="lazy"><div class="feature-copy rv"><span class="label">${esc(bd(f))} · ${rupee(f.price)}</span><h2>${esc(tidy(f.name)).replace(/(\S+)$/, '<em>$1</em>')}</h2><p>${esc([f.spec.Material, f.spec.Loom, f.spec.Body && tidy(f.spec.Body)].filter(Boolean).join('. '))}.</p><a class="btn btn-light" href="#/shop/collection/${fi}">View the collection</a></div></div>
      <div class="sec"><div class="wrap">
        ${secHead('One price for every collection', 'Shop by price')}
        <div class="edits">${BANDS.map((band, n) => { const list = P.filter((p) => C[p.c].price >= band.min && C[p.c].price <= band.max); const cols = C.filter((c) => c.price >= band.min && c.price <= band.max); const pics = [list[Math.floor(list.length * .25)], list[Math.floor(list.length * .7)]]; return `<a class="edit rv" href="#/shop/price/${band.key}" data-cursor="Shop" style="--d:${n * .12}s"><span class="edit-imgs">${pics.map((p) => `<img src="${p.img}" alt="" loading="lazy">`).join('')}</span><span class="edit-copy"><span class="label">${cols.length} collections</span><span class="edit-title">${band.title}</span><span class="under">Shop now</span></span></a>`; }).join('')}</div>
      </div></div>
      <div class="sec sec-stone" id="colours"><div class="wrap">${secHead('Find your shade', 'Shop by colour', 'The colour of each saree is read from its own photograph, so you can go straight to the shade you have in mind.')}</div>
        <div class="ribbon rv" id="ribbon"><div class="ribbon-row">${rowOf(0)}</div><div class="ribbon-row back">${rowOf(3)}</div></div>
        <div class="wrap"><div class="shades rv">${FAMILIES.map((fam) => `<a class="shade" href="#/shop/colour/${encodeURIComponent(fam)}" style="--c:${famHex(fam)}"><i></i><span>${fam}</span></a>`).join('')}</div></div>
      </div>
      <div class="sec" id="visit"><div class="wrap"><div class="store">
        <div class="store-pic rvi"><img src="img/site/silver-border.jpg" alt="Silver zari paisley border on a dark saree" loading="lazy"></div>
        <div class="store-info rv" style="--d:.2s"><span class="label">Visit us</span><h2>See and feel <em>the weave</em></h2><address id="store-address">${SHOP.address.join('<br>')}</address>
          <div class="store-rows"><div><span class="label muted">Hours</span><span>${SHOP.hours}</span></div><div><span class="label muted">Today</span><span class="open-dot${open ? '' : ' shut'}"><i></i><span>${open ? 'Open now' : 'Closed now'}</span></span></div><div><span class="label muted">Phone</span><b>${SHOP.phoneShow}</b></div></div>
          <div class="acts"><a class="btn btn-fill" href="${SHOP.map}" target="_blank" rel="noopener">Get directions</a><button class="btn" type="button" data-copy="${esc(SHOP.address.join(', '))}" data-copied="Address copied">Copy address</button></div></div>
      </div></div></div>
      <div class="sec sec-stone"><div class="wrap band rv"><span class="label gold">Personal assistance</span><h2>Chosen with you, <em>on WhatsApp</em></h2><p>Tell us the colour and border you have in mind and we will help you choose. Message <b>${SHOP.phoneShow}</b>.</p><a class="btn btn-fill" href="${SHOP.wa()}" target="_blank" rel="noopener">Message us on WhatsApp</a></div></div>`;
    },
    after(route) {
      // hero A: slides, ticks and the pointer-tracked parallax
      const slides = $$('.slide');
      if (slides.length) {
        let at = 0, timer;
        $('#ticks').innerHTML = `<span id="slide-no">01</span>` + slides.map((_, i) => `<button class="tick${i ? '' : ' on'}" type="button" data-slide-to="${i}" aria-label="Slide ${i + 1}"><i></i></button>`).join('') + `<span>0${slides.length}</span>`;
        $$('.slide h1 .w > span').forEach((w, i) => w.style.setProperty('--i', i % 8));
        const slideTo = (i) => { const was = at; at = (i + slides.length) % slides.length; N.slideAt = at; slides.forEach((s, k) => { s.classList.toggle('prev', k === was && was !== at); s.classList.toggle('on', k === at); }); $$('.tick').forEach((t, k) => { t.classList.remove('on'); if (k === at) { void t.offsetWidth; t.classList.add('on'); } }); $('#slide-no').textContent = '0' + (at + 1); clearInterval(timer); if (N.anim()) timer = setInterval(() => { if (!document.hidden && N.route.name === 'home' && document.contains(slides[0])) slideTo(at + 1); else clearInterval(timer); }, 7000); };
        N.slideTo = slideTo; slideTo(0);
        const hero = $('#hero'); let touchX = null;
        hero.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' || !N.full()) return; const r = hero.getBoundingClientRect(); hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5).toFixed(3)); hero.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5).toFixed(3)); });
        hero.addEventListener('pointerleave', () => { hero.style.setProperty('--mx', 0); hero.style.setProperty('--my', 0); });
        hero.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
        hero.addEventListener('touchend', (e) => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 50) slideTo(at + (dx < 0 ? 1 : -1)); touchX = null; });
      }
      // hero B: crossfade
      const pics = $$('.hero-b-pics img');
      if (pics.length) {
        let at = 0, timer;
        const show = (i) => { at = (i + pics.length) % pics.length; N.slideAt = at; pics.forEach((p, k) => p.classList.toggle('on', k === at)); $$('.hero-b-dots button').forEach((d, k) => d.classList.toggle('on', k === at)); clearInterval(timer); if (N.anim()) timer = setInterval(() => { if (document.contains(pics[0]) && !document.hidden) show(at + 1); else clearInterval(timer); }, 6000); };
        N.slideTo = show; show(0);
      }
      // the border showcase: the photograph changes as you move down the list
      const rows = $$('.show-row'), imgs = $$('#show-frame img'), shows = borderShows();
      let showAt = -1, hold = false;
      const pick = (i) => { if (i === showAt) return; imgs.forEach((im) => im.classList.remove('was')); if (showAt >= 0) { imgs[showAt].classList.remove('on'); imgs[showAt].classList.add('was'); } showAt = i; imgs[i].classList.add('on'); rows.forEach((r, k) => r.classList.toggle('on', k === i)); $('#show-meta').textContent = `${shows[i].sarees} sarees · from ${rupee(shows[i].from)}`; const href = `#/shop/border/${encodeURIComponent(shows[i].b)}`; $('#show-frame').href = href; $('#show-btn').href = href; };
      pick(0);
      const list = $('#show-list');
      list.addEventListener('pointerover', (e) => { const r = e.target.closest('.show-row'); if (r) { hold = true; pick(+r.dataset.show); } });
      list.addEventListener('focusin', (e) => { const r = e.target.closest('.show-row'); if (r) { hold = true; pick(+r.dataset.show); } });
      list.addEventListener('pointerleave', () => { hold = false; });
      if (N.anim()) { const t = setInterval(() => { if (!document.contains(list)) return clearInterval(t); if (!hold && !document.hidden) pick((showAt + 1) % shows.length); }, 3400); }
      // the band of words drifts by itself and hurries when the page is scrolled
      const track = $('#marquee'); let mx = 0;
      if (N.anim()) (function drift() { if (!document.contains(track)) return; const half = track.scrollWidth / 2; if (half) { mx -= .7 + N.push * .22; N.push *= .92; if (-mx >= half) mx += half; track.style.transform = `translate3d(${mx}px,0,0)`; } requestAnimationFrame(drift); })();
      if (route.name === 'story' || route.name === 'visit') setTimeout(() => document.getElementById(route.name)?.scrollIntoView({ behavior: N.anim() ? 'smooth' : 'auto', block: 'start' }), 60);
    },
    popup() { N.quick(freshMix[0].id); },
  };
  N.pages.story = Object.assign({}, N.pages.home, { title: 'Our story' });
  N.pages.visit = Object.assign({}, N.pages.home, { title: 'Visit us' });

  /* ---------- collections index (the live site's "category" page) ---------- */
  N.pages.collections = {
    title: 'Collections',
    render(route, UI) {
      const tiles = UI === 'loading' ? Array(8).fill(`<div class="tile"><div class="sk sk-img"></div><div class="sk sk-text w60" style="margin:20px auto 0"></div><div class="sk sk-text w40" style="margin-inline:auto"></div></div>`).join('')
        : UI === 'empty' ? N.emptyBlock(I.box, 'No collections to show', 'Every collection is hidden from the website right now. Switch one on in the staff app under Catalogue.')
        : UI === 'error' ? `<div class="alert bad" style="grid-column:1/-1">${I.alert}<div><b>Could not load the collections</b><p>Please check your connection and try again.</p></div><button class="btn btn-sm" type="button" data-act="retry" style="margin-left:auto">Try again</button></div>`
        : C.map((c, i) => `<a class="tile rv" href="#/shop/collection/${i}" style="--d:${(i % 4) * .08}s"><span class="tile-img"><img src="${c.img}" alt="${esc(tidy(c.name))}" loading="lazy"></span><span class="tile-name">${esc(tidy(c.name))}</span><span class="muted">${c.total} sarees · ${rupee(c.price)}</span><span class="under">View</span></a>`).join('');
      return `<div class="wrap">${crumbs([['Home', '#/'], ['Collections']])}
        <div class="page-head"><h1>Mangalagiri handloom pattu sarees</h1><div class="orn"><i></i></div><p>${C.length} collections in stock today, each at one price. The five empty categories on the live site are not shown.</p></div>
        <div class="tiles" style="padding-bottom:clamp(60px,8vw,110px)">${tiles}</div></div>`;
    },
  };
})();
