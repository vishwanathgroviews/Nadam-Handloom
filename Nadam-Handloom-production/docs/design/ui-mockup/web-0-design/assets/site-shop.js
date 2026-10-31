/* Website mock-up: shopping pages. Home, collections, a category, the full list with
   filters, search, the saree page and the bag. Every saree, photo, collection, price and
   stock count here is from the live website. */
(function () {
  'use strict';
  var NH = window.NH, Site = window.Site, D = Site.D, icon = NH.icon, esc = Site.esc, rs = Site.rs, num = Site.num;
  var PER_PAGE = 24;

  function errorBlock(what) { return Site.empty('wifioff', 'Couldn’t load ' + what, 'Check your internet connection and try again.', '<button type="button" class="btn btn-primary" onclick="NHSite.setState(\'normal\')">' + icon('refresh', 'ico-sm') + 'Try again</button>'); }
  function warnBanner(text) { return '<div class="wrap" style="padding-top:1rem"><div class="alert alert-warn state-banner">' + icon('alert') + '<div>' + text + '</div></div></div>'; }
  function colCard(c, i) {
    return '<a class="craft reveal" style="--i:' + (i % 8) + '" href="#/shop?col=' + c.id + '"><img src="' + c.img + '" alt="" loading="lazy"><span class="go">' + icon('arrow', 'ico-sm') + '</span><span class="t"><b>' + esc(c.name) + '</b><span>' + num(c.count) + ' pieces · ' + rs(c.price) + '</span></span></a>';
  }
  function craftCard(c, i) {
    return '<a class="craft reveal" style="--i:' + (i % 8) + '" href="#/shop?craft=' + c.key + '"><img src="' + c.img + '" alt="" loading="lazy"><span class="go">' + icon('arrow', 'ico-sm') + '</span><span class="t"><b>' + esc(c.name) + '</b><span>' + num(c.count) + ' pieces</span></span></a>';
  }

  /* ================= Home ================= */
  var SLIDES = [
    { img: 'hero-pattu-zari-border', eye: 'Mangalagiri handloom pattu', title: 'Woven in zari, made in Mangalagiri', text: 'Pure Mangalagiri pattu sarees from our shop in Old Mangalagiri, delivered free across India.', cta: ['Shop pattu sarees', 'c/mangalagiri-handloom-pattu-sarees'], cta2: ['Our story', 'story'] },
    { img: 'hero-kalamkari-border', eye: 'Shop by craft', title: 'Kalamkari, Tanjore and hand-painted borders', text: 'Painted and printed by hand, on pattu that drapes softly.', cta: ['Shop the craft', 'shop?craft=kalamkari'], cta2: ['All crafts', 'collections'] },
    { img: 'hero-bridal-brocade', eye: 'For the wedding season', title: 'Pure pattu, butta and gold', text: 'Our richest weaves for weddings, festivals and family functions.', cta: ['Shop pure pattu', 'shop?craft=pure'], cta2: ['New in', 'shop?sort=new'] },
    { img: 'hero-cotton-checks', eye: 'Everyday elegance', title: 'Checks, stripes and easy drapes', text: 'Light Mangalagiri weaves you will reach for every week.', cta: ['Shop checks', 'shop?craft=checks'], cta2: ['All sarees', 'shop'] }
  ].filter(function (s) { return D.site[s.img]; });

  function heroCarousel(kind) {
    var slides = SLIDES.map(function (s, i) {
      return '<div class="hero-slide' + (i === 0 ? ' on' : '') + '" data-slide="' + i + '" aria-hidden="' + (i !== 0) + '"><img src="' + D.site[s.img] + '" alt=""' + (i ? ' loading="lazy"' : '') + '>' +
        '<div class="hero-copy"><div class="wrap"><div><span class="eyebrow">' + esc(s.eye) + '</span><h1>' + esc(s.title) + '</h1><p>' + esc(s.text) + '</p><div class="ctas"><a class="btn btn-light btn-lg" href="#/' + s.cta[1] + '">' + esc(s.cta[0]) + icon('arrow', 'ico-sm') + '</a><a class="btn btn-outline-light btn-lg" href="#/' + s.cta2[1] + '">' + esc(s.cta2[0]) + '</a></div></div></div></div></div>';
    }).join('');
    return '<section class="hero hero-' + kind + '" aria-roledescription="carousel" aria-label="Featured" style="--slide:7s">' + slides +
      '<div class="hero-ctrl"><div class="wrap"><div class="hero-dots" role="tablist">' + SLIDES.map(function (s, i) { return '<button type="button" role="tab" data-dot="' + i + '" aria-current="' + (i === 0) + '" aria-label="Slide ' + (i + 1) + '"><i></i></button>'; }).join('') + '</div>' +
      '<span class="count" data-hcount>01 / 0' + SLIDES.length + '</span><div class="arrows"><button type="button" data-hprev aria-label="Previous slide">' + icon('left') + '</button><button type="button" data-hnext aria-label="Next slide">' + icon('right') + '</button></div></div></div>' +
      (kind === 'c' ? '<div class="scroll-cue"><span>Scroll</span><i></i></div>' : '') + '</section>';
  }
  function bindHero(el) {
    var hero = el.querySelector('.hero-a, .hero-c'); if (!hero) return;
    var slides = hero.querySelectorAll('[data-slide]'), dots = hero.querySelectorAll('[data-dot]'), cur = 0, t = null, n = slides.length;
    function show(i) {
      cur = (i + n) % n;
      slides.forEach(function (s, k) { s.classList.toggle('on', k === cur); s.setAttribute('aria-hidden', k !== cur); var im = s.querySelector('img'); if (k === cur && im) { im.style.animation = 'none'; void im.offsetWidth; im.style.animation = ''; } });
      dots.forEach(function (d, k) { d.setAttribute('aria-current', k === cur); var bar = d.querySelector('i'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; });
      var c = hero.querySelector('[data-hcount]'); if (c) c.textContent = '0' + (cur + 1) + ' / 0' + n;
      restart();
    }
    function restart() { clearTimeout(t); if (NH.opts.motion !== 'off') t = setTimeout(function () { if (document.body.contains(hero)) show(cur + 1); }, 7000); }
    dots.forEach(function (d) { d.addEventListener('click', function () { show(+d.dataset.dot); }); });
    hero.querySelector('[data-hprev]').addEventListener('click', function () { show(cur - 1); });
    hero.querySelector('[data-hnext]').addEventListener('click', function () { show(cur + 1); });
    var sx = null; hero.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', function (e) { if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); sx = null; });
    restart();
    if (hero.classList.contains('hero-c')) Site.onScroll(function (y) { var im = hero.querySelector('.hero-slide.on img'); if (im && y < innerHeight) hero.style.setProperty('--py', (y * .3) + 'px'), hero.querySelectorAll('.hero-copy').forEach(function (c) { c.style.transform = 'translateY(' + (y * .25) + 'px)'; c.style.opacity = String(Math.max(0, 1 - y / 600)); }); });
  }
  function heroSplit() {
    var seen = {}, pics = Site.byNewest.filter(function (p) { if (p.logo || seen[p.col]) return false; seen[p.col] = 1; return true; }).slice(0, 9);
    return '<section class="hero hero-b"><div class="wrap split"><div class="copy reveal"><span class="eyebrow">From the looms of Mangalagiri</span><h1>Handloom pattu, <em>woven for you</em></h1><p>' + num(D.totals.shown) + ' sarees and dress materials in ' + D.collections.length + ' collections, sent free from our store in Old Mangalagiri.</p>' +
      '<div class="ctas"><a class="btn btn-primary btn-lg" href="#/c/mangalagiri-handloom-pattu-sarees">Shop sarees ' + icon('arrow', 'ico-sm') + '</a><a class="btn btn-lg" href="#/collections">Explore collections</a></div>' +
      '<div class="stats"><div><b data-count-to="' + D.totals.shown + '">0</b><span>pieces online</span></div><div><b data-count-to="' + D.collections.length + '">0</b><span>collections</span></div><div><b data-count-to="' + D.totals.sets + '">0</b><span>designs in sets</span></div></div></div>' +
      '<div class="mosaic reveal zoom" data-mosaic>' + pics.slice(0, 3).map(function (p, i) { return '<figure><img src="' + p.img + '" alt="' + esc(p.name) + '"><figcaption>' + esc(Site.colOf(p).name) + '</figcaption></figure>'; }).join('') + '</div></div></section>';
  }
  function bindMosaic(el) {
    var m = el.querySelector('[data-mosaic]'); if (!m) return;
    var seen = {}, pool = Site.byNewest.filter(function (p) { if (p.logo || seen[p.col]) return false; seen[p.col] = 1; return true; }).slice(0, 18), k = 3;
    (function loop() {
      Site.after(function () {
        if (!document.body.contains(m) || NH.opts.motion === 'off') return;
        var figs = m.querySelectorAll('figure'), f = figs[k % 3], p = pool[k % pool.length]; k++;
        var img = f.querySelector('img'); img.src = p.img; img.alt = p.name; img.classList.remove('swap'); void img.offsetWidth; img.classList.add('swap');
        f.querySelector('figcaption').textContent = Site.colOf(p).name; loop();
      }, 3200);
    })();
  }

  Site.page('home', function (r, st) {
    var o = NH.opts;
    if (st === 'loading') return { html: '<div class="skel" style="height:clamp(420px,70vh,700px);border-radius:0"></div><section class="section"><div class="wrap"><div class="skel" style="height:34px;width:280px;margin-bottom:24px"></div><div class="pgrid">' + Site.cardSkel(4) + '</div></div></section>', handles: true };
    if (st === 'error') return { html: '<div class="wrap">' + errorBlock('the home page') + '</div>', handles: true };
    var hero = o.hero === 'b' ? heroSplit() : heroCarousel(o.hero === 'c' ? 'c' : 'a');
    var newest = Site.byNewest.filter(function (p) { return !p.logo; }).slice(0, 12);
    var sets = D.products.filter(function (p) { return p.avail > 1; }).slice(0, 10);
    var crafts = D.crafts.filter(function (c) { return c.count && c.img; });
    var spotCol = D.collections.filter(function (c) { return /pure pattu/i.test(c.name); })[0] || D.collections[0];
    var spotP = D.products.filter(function (p) { return p.col === spotCol.id; }).slice(0, 4);
    var recent = Site.S().recent.map(Site.prod).filter(Boolean).slice(0, 8);
    var useH = o.hero === 'c' && innerWidth > 860;
    var craftSection = useH
      ? '<section class="hscroll" data-hscroll style="height:' + (crafts.length * 34 + 60) + 'vh"><div class="pin"><div class="wrap sec-head" style="margin:0 auto"><div><span class="eyebrow">Shop by craft</span><h2>Eight ways Mangalagiri is woven</h2></div><p>Scroll to browse each craft.</p></div><div class="strip" data-strip>' + crafts.map(craftCard).join('') + '</div></div></section>'
      : '<section class="section"><div class="wrap"><div class="sec-head reveal"><div><span class="eyebrow">Shop by craft</span><h2>Eight ways Mangalagiri is woven</h2></div>' + Site.railNav() + '</div>' + Site.rail(crafts.map(craftCard), 'three', 'Crafts') + '</div></section>';
    var html = (st === 'warning' ? warnBanner('<b>Some prices are being checked</b>Sample warning: the shop is updating prices. What you pay is shown at checkout.') : '') + hero +
      '<div class="trust"><div class="wrap trust-in">' + [['thread', 'Woven in Mangalagiri', 'From our store in Old Mangalagiri'], ['truck', 'Free delivery', 'On every order, across India'], ['shield', 'Secure payment', 'UPI, cards, net banking (Razorpay)'], ['whatsapp', 'Talk to us', 'Call or WhatsApp ' + D.store.phone]].map(function (t) { return '<div>' + icon(t[0]) + '<span><b>' + t[1] + '</b><span>' + esc(t[2]) + '</span></span></div>'; }).join('') + '</div></div>' +
      '<section class="section"><div class="wrap"><div class="center-head reveal"><span class="eyebrow">Shop by category</span><h2>Woven for every occasion</h2></div><div class="cats stagger">' +
      Site.shownCats.map(function (c, i) { return '<a class="cat reveal" style="--i:' + i + '" href="#/c/' + c.slug + '"><span class="ph"><img src="' + c.img + '" alt="" loading="lazy"></span><b>' + esc(c.name) + '</b><span>' + Site.plural(c.count, 'piece') + '</span></a>'; }).join('') + '</div></div></section>' +
      '<section class="section band"><div class="wrap"><div class="sec-head reveal"><div><span class="eyebrow">Just added</span><h2>New in this week</h2><p>The newest sarees from the store, added from the shop’s app.</p></div><div style="display:flex;gap:1rem;align-items:center">' + Site.railNav() + '<a class="link" href="#/shop?sort=new">View all</a></div></div>' + Site.rail(newest.map(Site.card), '', 'New in') + '</div></section>' +
      craftSection +
      '<div class="marquee" aria-label="Collections"><div class="row">' + D.collections.slice(0, 14).concat(D.collections.slice(0, 14)).map(function (c) { return '<a href="#/shop?col=' + c.id + '" tabindex="-1">' + esc(c.name) + '</a>'; }).join('') + '</div></div>' +
      '<section class="section"><div class="wrap spot"><a class="big reveal zoom" href="#/shop?col=' + spotCol.id + '"><img src="' + spotCol.img + '" alt="" loading="lazy"><span class="cap"><span class="eyebrow" style="color:#E9C987">Collection spotlight</span><b>' + esc(spotCol.name) + '</b><span>' + num(spotCol.count) + ' pieces · ' + rs(spotCol.price) + ' each</span></span></a>' +
      '<div class="side"><div class="reveal"><span class="eyebrow">Spotlight</span><h2 style="margin-top:.6rem">' + esc(spotCol.name) + '</h2><p class="lead" style="margin-top:.8rem">' + esc(spotCol.desc && spotCol.desc.length > 20 ? spotCol.desc : 'Pure pattu woven with butta motifs, one of the richest weaves in the store.') + '</p></div><div class="pgrid">' + spotP.map(Site.card).join('') + '</div><a class="btn btn-lg reveal" href="#/shop?col=' + spotCol.id + '">See all ' + num(spotCol.count) + ' ' + icon('arrow', 'ico-sm') + '</a></div></div></section>' +
      (sets.length ? '<section class="section band"><div class="wrap"><div class="sec-head reveal"><div><span class="eyebrow">Sets</span><h2>More than one of a design</h2><p>' + num(D.totals.sets) + ' designs have several identical pieces in stock: buy one, or a few for the family.</p></div>' + Site.railNav() + '</div>' + Site.rail(sets.map(Site.card), '', 'Sets') + '</div></section>' : '') +
      '<section class="story" data-story><div class="bgimg" style="background-image:url(' + (D.site['hero-craft-story'] || D.site['brand-handloom_banner']) + ')"></div><div class="wrap"><div class="copy reveal from-left"><span class="eyebrow">Our story</span><h2>Mangalagiri, thread by thread</h2><p>Mangalagiri, near Guntur, has woven for generations: fine pattu and cotton with zari borders and no-fuss elegance. Our store sits in Old Mangalagiri, opposite the Brahmam Gari temple.</p>' +
      '<div class="facts"><div><b data-count-to="' + D.totals.shown + '">0</b><span>pieces online</span></div><div><b data-count-to="' + D.collections.length + '">0</b><span>collections</span></div><div><b>7</b><span>days a week</span></div></div><div><a class="btn btn-outline-light btn-lg" href="#/story">Read our story ' + icon('arrow', 'ico-sm') + '</a></div></div></div></section>' +
      (recent.length ? '<section class="section"><div class="wrap"><div class="sec-head reveal"><div><span class="eyebrow">For you</span><h2>Recently viewed</h2></div>' + Site.railNav() + '</div>' + Site.rail(recent.map(Site.card), 'five', 'Recently viewed') + '</div></section>' : '') +
      '<section class="section"><div class="wrap"><div class="visit reveal"><div class="ph"><img src="' + (D.site['brand-handloom_banner'] || '') + '" alt="" loading="lazy"></div><div class="txt"><span class="eyebrow">Visit the store</span><h2>Come see them in person</h2><dl><div><dt>' + icon('pin') + '</dt><dd><b>Address</b>' + D.store.lines.map(esc).join(', ') + '</dd></div><div><dt>' + icon('clock') + '</dt><dd><b>Open</b>' + esc(D.store.hours) + '</dd></div><div><dt>' + icon('phone') + '</dt><dd><b>Call or WhatsApp</b>' + esc(D.store.phone) + '</dd></div></dl><div style="display:flex;gap:.6rem;flex-wrap:wrap"><a class="btn btn-primary" href="' + D.store.map + '" target="_blank" rel="noopener">' + icon('pin', 'ico-sm') + 'Get directions</a><a class="btn" href="#/store">Store details</a></div></div></div></div></section>';
    return {
      html: html, title: 'Mangalagiri Handloom Pattu Sarees', handles: st === 'popup',
      mount: function (el) {
        bindHero(el); bindMosaic(el);
        var story = el.querySelector('[data-story] .bgimg');
        if (story) Site.onScroll(function () { var r = story.parentNode.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) story.style.transform = 'translateY(' + ((r.top - innerHeight / 2) * -.12) + 'px)'; });
        var hs = el.querySelector('[data-hscroll]');
        if (hs) Site.onScroll(function () { var r = hs.getBoundingClientRect(), strip = hs.querySelector('[data-strip]'), total = hs.offsetHeight - innerHeight, k = Math.min(1, Math.max(0, -r.top / total)); strip.style.transform = 'translateX(' + (-k * Math.max(0, strip.scrollWidth - innerWidth + 64)) + 'px)'; });
        if (st === 'popup') Site.openSearch();
      }
    };
  });

  /* ================= Collections ================= */
  Site.page('collections', function (r, st) {
    var f = r.q.f || 'all';
    var list = D.collections.filter(function (c) { return f === 'all' || c.cat === f || c.craft === f; });
    var chips = [['all', 'All', D.collections.length]].concat(Site.shownCats.map(function (c) { return [c.slug, c.name, D.collections.filter(function (x) { return x.cat === c.slug; }).length]; }))
      .concat(D.crafts.filter(function (c) { return c.count; }).map(function (c) { return [c.key, c.name, D.collections.filter(function (x) { return x.craft === c.key; }).length]; }));
    var body = st === 'loading' ? '<div class="pgrid" style="--cols:4">' + Site.cardSkel(8) + '</div>' : st === 'error' ? errorBlock('the collections') : (st === 'empty' || !list.length) ? Site.empty('grid', 'No collections here', 'Try another category or craft.', '<a class="btn" href="#/collections">Show all</a>') :
      '<div class="pgrid" style="--cols:4">' + list.map(colCard).join('') + '</div>';
    return {
      title: 'All collections', handles: st === 'loading' || st === 'error' || st === 'empty',
      html: '<div class="wrap"><div class="page-head">' + Site.crumbs([['Home', 'home'], ['Collections']]) + '<h1>All collections</h1><p class="lead">' + D.collections.length + ' collections, ' + num(D.totals.shown) + ' pieces. Each collection is one design family at one price.</p></div>' +
        '<div style="display:flex;gap:.5rem;overflow-x:auto;padding-bottom:1rem;scrollbar-width:none" role="group" aria-label="Filter collections">' + chips.map(function (c) { return '<a class="chip" href="#/collections?f=' + c[0] + '" aria-pressed="' + (f === c[0]) + '">' + esc(c[1]) + ' <span class="n">' + c[2] + '</span></a>'; }).join('') + '</div>' +
        '<div style="padding-bottom:clamp(48px,6vw,90px)">' + body + '</div></div>'
    };
  });

  /* ================= Category ================= */
  Site.page('category', function (r, st) {
    var c = Site.cat(r.arg);
    if (!c || !c.shown) return Site.pageNotFound();
    var cols = D.collections.filter(function (x) { return x.cat === c.slug; });
    var prods = D.products.filter(function (p) { return Site.colOf(p).cat === c.slug; });
    var desc = { 'mangalagiri-handloom-pattu-sarees': 'Authentic Mangalagiri handloom pattu sarees: rich colours, traditional borders and a royal drape for festivals, weddings, family functions and every celebration.' }[c.slug] || (c.raw && D.categories.filter(function (x) { return x.slug === c.slug; })[0] ? '' : '');
    var grid = st === 'loading' ? Site.cardSkel(8) : prods.slice(0, 16).map(Site.card).join('');
    return {
      title: c.name,
      html: '<div class="wrap"><div class="page-head">' + Site.crumbs([['Home', 'home'], [c.name]]) + '</div><div class="cat-banner reveal zoom"><img src="' + (c.slug === 'mangalagiri-handloom-pattu-sarees' ? D.site['hero-pattu-zari-border'] : c.img) + '" alt=""><div class="in"><span class="eyebrow">' + Site.plural(c.count, 'piece') + ' · ' + Site.plural(cols.length, 'collection') + '</span><h1>' + esc(c.name) + '</h1>' + (desc ? '<p>' + esc(desc) + '</p>' : '') + '</div></div></div>' +
        (st === 'error' ? '<div class="wrap">' + errorBlock(c.name) + '</div>' :
        '<section class="section tight"><div class="wrap"><div class="sec-head reveal"><div><span class="eyebrow">Collections</span><h2>Choose a design family</h2></div>' + Site.railNav() + '</div>' + Site.rail(cols.map(colCard), cols.length > 3 ? '' : 'three', 'Collections') + '</div></section>' +
        '<section class="section tight"><div class="wrap"><div class="sec-head reveal"><div><span class="eyebrow">Latest</span><h2>' + esc(c.name) + '</h2></div><a class="btn" href="#/shop?cat=' + c.slug + '">' + icon('filter', 'ico-sm') + 'All ' + num(c.count) + ' with filters</a></div><div class="pgrid">' + grid + '</div>' +
        '<div class="more-row"><a class="btn btn-primary btn-lg" href="#/shop?cat=' + c.slug + '">See all ' + num(c.count) + ' ' + icon('arrow', 'ico-sm') + '</a><span class="note">' + icon('info', 'ico-sm') + 'The mock-up has ' + prods.length + ' of these ' + num(c.count) + ' pieces (6 from each collection).</span></div></div></section>'),
      handles: st === 'error'
    };
  });

  /* ================= All sarees with filters ================= */
  var BANDS = [['u25', 'Under ₹2,500', 0, 2499], ['25-35', '₹2,500 to ₹3,500', 2500, 3500], ['35-50', '₹3,501 to ₹5,000', 3501, 5000], ['o50', 'Over ₹5,000', 5001, 1e9]];
  var SORTS = [['new', 'Newest first'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['sets', 'Sets first']];
  function filterList(q) {
    var list = D.products.slice();
    if (q.cat) list = list.filter(function (p) { return Site.colOf(p).cat === q.cat; });
    if (q.craft) list = list.filter(function (p) { return Site.colOf(p).craft === q.craft; });
    if (q.col) list = list.filter(function (p) { return p.col === q.col; });
    if (q.price) { var b = BANDS.filter(function (x) { return x[0] === q.price; })[0]; if (b) list = list.filter(function (p) { var v = Site.priceOf(p); return v >= b[2] && v <= b[3]; }); }
    if (q.stock === 'set') list = list.filter(function (p) { return p.avail > 1; });
    if (q.q) { var hits = Site.search(q.q).prods; list = list.filter(function (p) { return hits.indexOf(p) >= 0; }); }
    var s = q.sort || 'new';
    list.sort(function (a, b) {
      if (a.logo !== b.logo) return a.logo ? 1 : -1;
      if (s === 'price-asc') return Site.priceOf(a) - Site.priceOf(b);
      if (s === 'price-desc') return Site.priceOf(b) - Site.priceOf(a);
      if (s === 'sets') return b.avail - a.avail;
      return a.at < b.at ? 1 : a.at > b.at ? -1 : 0;
    });
    return list;
  }
  function realTotal(q) {
    var cols = D.collections.filter(function (c) {
      if (q.cat && c.cat !== q.cat) return false; if (q.craft && c.craft !== q.craft) return false; if (q.col && c.id !== q.col) return false;
      if (q.price) { var b = BANDS.filter(function (x) { return x[0] === q.price; })[0]; if (b && !(c.price >= b[2] && c.price <= b[3])) return false; }
      return true;
    });
    return q.stock === 'set' || q.q ? null : cols.reduce(function (n, c) { return n + c.count; }, 0);
  }
  function qs(q, change) { var o = Object.assign({}, q, change); Object.keys(o).forEach(function (k) { if (o[k] == null || o[k] === '') delete o[k]; }); var s = Object.keys(o).map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&'); return 'shop' + (s ? '?' + s : ''); }
  function filtersHtml(q) {
    function grp(title, key, opts, closed) {
      return '<div class="fgroup"' + (closed ? ' data-closed' : '') + '><button type="button" data-fg aria-expanded="' + !closed + '">' + title + icon('down', 'ico-sm') + '</button><div class="opts">' +
        opts.map(function (o) { var on = q[key] === o[0]; return '<label class="check"><input type="checkbox" data-f="' + key + '" value="' + o[0] + '"' + (on ? ' checked' : '') + '><span>' + esc(o[1]) + '</span><span>' + (o[2] != null ? num(o[2]) : '') + '</span></label>'; }).join('') + '</div></div>';
    }
    var base = Object.assign({}, q);
    function cnt(k, v) { var o = {}; o[k] = v; return realTotal(Object.assign({}, base, o, { q: null, stock: null })); }
    return grp('Category', 'cat', Site.shownCats.map(function (c) { return [c.slug, c.name, cnt('cat', c.slug)]; })) +
      grp('Craft', 'craft', D.crafts.filter(function (c) { return c.count; }).map(function (c) { return [c.key, c.name, cnt('craft', c.key)]; })) +
      grp('Price', 'price', BANDS.map(function (b) { return [b[0], b[1], cnt('price', b[0])]; })) +
      grp('Availability', 'stock', [['set', 'Sets: more than one in stock', null]]) +
      grp('Collection', 'col', D.collections.filter(function (c) { return (!q.cat || c.cat === q.cat) && (!q.craft || c.craft === q.craft); }).slice(0, 30).map(function (c) { return [c.id, c.name, c.count]; }), !q.col) +
      '<div class="fgroup" style="border:0"><p class="note">' + icon('info', 'ico-sm') + 'Colour, fabric and occasion filters come once sarees have those details (none filled in today).</p></div>';
  }
  function density() { try { return localStorage.getItem('nh-web-cols') || '4'; } catch (e) { return '4'; } }
  Site.page('shop', function (r, st) {
    var q = r.q, shown = +(q.n || PER_PAGE), list = filterList(q), total = realTotal(q);
    var c = q.col && Site.col(q.col), cat = q.cat && Site.cat(q.cat), cr = q.craft && Site.craft(q.craft);
    var title = c ? c.name : cr ? cr.name : cat ? cat.name : q.sort === 'new' ? 'New in' : 'All sarees';
    var active = [['cat', cat && cat.name], ['craft', cr && cr.name], ['col', c && c.name], ['price', q.price && BANDS.filter(function (b) { return b[0] === q.price; })[0][1]], ['stock', q.stock && 'Sets only']].filter(function (a) { return a[1]; });
    var grid;
    if (st === 'loading') grid = '<div class="pgrid">' + Site.cardSkel(8) + '</div>';
    else if (st === 'error') grid = errorBlock('the sarees');
    else if (st === 'empty' || !list.length) grid = Site.empty('search', 'No sarees match these filters', 'Remove a filter or try another craft.', '<a class="btn btn-primary" href="#/shop">Clear all filters</a>');
    else grid = '<div class="pgrid" style="--cols:' + density() + '">' + list.slice(0, shown).map(Site.card).join('') + '</div>' +
      '<div class="more-row"><span class="muted" style="font-size:.88rem">Showing ' + Math.min(shown, list.length) + ' of ' + list.length + (total ? ' in the mock-up (' + num(total) + ' on the live site)' : '') + '</span><div class="progress"><i style="width:' + (Math.min(shown, list.length) / list.length * 100) + '%"></i></div>' + (list.length > shown ? '<a class="btn btn-lg" href="#/' + qs(q, { n: shown + PER_PAGE }) + '" data-more>Load more</a>' : '') + '</div>';
    return {
      title: title, handles: st === 'loading' || st === 'error' || st === 'empty',
      html: (st === 'warning' ? warnBanner('<b>You are offline</b>Showing the list saved on this device. Stock may have changed.') : '') +
        '<div class="wrap"><div class="page-head">' + Site.crumbs([['Home', 'home'], cat ? [cat.name, 'c/' + cat.slug] : ['Shop', 'shop'], [title]].filter(function (x, i, a) { return !(i === 1 && a[2][0] === x[0]); })) + '<h1>' + esc(title) + '</h1>' +
        (c ? '<p class="lead">' + rs(c.price) + ' each · ' + Site.plural(c.count, 'piece') + (c.sets ? ' · ' + c.sets + ' in sets' : '') + '</p>' : cr ? '<p class="lead">' + Site.plural(cr.count, 'piece') + ' across ' + D.collections.filter(function (x) { return x.craft === cr.key; }).length + ' collections.</p>' : '') + '</div>' +
        '<div class="toolbar"><div class="l"><button type="button" class="btn btn-sm filters-btn" data-ffilters>' + icon('filter', 'ico-sm') + 'Filters' + (active.length ? ' (' + active.length + ')' : '') + '</button><span class="count">' + (total != null ? num(total) + ' pieces' : list.length + ' pieces') + '</span></div>' +
        '<div class="r"><label class="sr-only" for="sort">Sort</label><select id="sort">' + SORTS.map(function (s) { return '<option value="' + s[0] + '"' + ((q.sort || 'new') === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' +
        '<div class="density" role="group" aria-label="Sarees per row">' + [['2', 'g2'], ['3', 'g3'], ['4', 'g4']].map(function (d) { return '<button type="button" data-cols="' + d[0] + '" aria-pressed="' + (density() === d[0]) + '" aria-label="' + d[0] + ' per row">' + icon(d[1], 'ico-sm') + '</button>'; }).join('') + '</div></div></div>' +
        '<div class="shop"><aside class="filters" aria-label="Filters">' + filtersHtml(q) + '</aside><div>' +
        (active.length ? '<div class="active-filters">' + active.map(function (a) { var ch = {}; ch[a[0]] = null; return '<a class="chip" href="#/' + qs(q, Object.assign(ch, { n: null })) + '" aria-pressed="true">' + esc(a[1]) + icon('x', 'ico-sm') + '</a>'; }).join('') + '<a class="chip" href="#/shop">Clear all</a></div>' : '') +
        grid + '</div></div><div style="height:clamp(48px,6vw,90px)"></div></div>',
      mount: function (el) {
        el.querySelector('#sort').addEventListener('change', function (e) { Site.go(qs(q, { sort: e.target.value, n: null })); });
        el.querySelectorAll('[data-cols]').forEach(function (b) { b.addEventListener('click', function () { try { localStorage.setItem('nh-web-cols', b.dataset.cols); } catch (x) { } el.querySelectorAll('.pgrid').forEach(function (g) { g.style.setProperty('--cols', b.dataset.cols); }); el.querySelectorAll('[data-cols]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); }); });
        function bindF(scope, close) {
          scope.querySelectorAll('[data-f]').forEach(function (cb) { cb.addEventListener('change', function () { var ch = { n: null }; ch[cb.dataset.f] = cb.checked ? cb.value : null; if (cb.dataset.f === 'cat') { ch.col = null; } close && close(); Site.go(qs(q, ch)); }); });
          scope.querySelectorAll('[data-fg]').forEach(function (b) { b.addEventListener('click', function () { var g = b.parentNode; var c = g.hasAttribute('data-closed'); if (c) g.removeAttribute('data-closed'); else g.setAttribute('data-closed', ''); b.setAttribute('aria-expanded', c); }); });
        }
        bindF(el.querySelector('.filters'));
        var more = el.querySelector('[data-more]');
        if (more) more.addEventListener('click', function (e) { e.preventDefault(); var y = scrollY; more.classList.add('is-loading'); setTimeout(function () { history.replaceState(null, '', '#/' + qs(q, { n: shown + PER_PAGE })); Site.render(); scrollTo(0, y); }, 450); });
        var fb = el.querySelector('[data-ffilters]');
        fb.addEventListener('click', function () { Site.drawer('Filters', filtersHtml(q), '<a class="btn btn-primary btn-block" href="#/' + qs(q, {}) + '" data-close>Show ' + (total != null ? num(total) : list.length) + ' pieces</a><a class="btn btn-block" href="#/shop">Clear all</a>', 'left', function (d, close) { bindF(d, close); }); });
      }
    };
  });

  /* ================= Search results ================= */
  Site.page('search', function (r, st) {
    var q = r.q.q || '', res = Site.search(q);
    var none = st === 'empty' || (!res.cols.length && !res.prods.length);
    return {
      title: 'Search', handles: st === 'empty',
      html: '<div class="wrap"><div class="page-head">' + Site.crumbs([['Home', 'home'], ['Search']]) + '<span class="eyebrow">Search results</span><h1>“' + esc(q) + '”</h1>' +
        (none ? '' : '<p class="lead">' + Site.plural(res.cols.reduce(function (n, c) { return n + c.count; }, 0), 'piece') + ' in ' + Site.plural(res.cols.length, 'collection') + ' match.</p>') + '</div>' +
        '<form class="input-group" data-s style="max-width:640px;margin-bottom:1.6rem"><span class="pre">' + icon('search', 'ico-sm') + '</span><label class="sr-only" for="sq">Search</label><input class="input" id="sq" type="search" value="' + esc(q) + '" placeholder="Search sarees, crafts or SKU"><button class="btn btn-primary" type="submit">Search</button></form>' +
        (st === 'loading' ? '<div class="pgrid">' + Site.cardSkel(8) + '</div>' : none ? Site.empty('search', 'Nothing found for “' + esc(q) + '”', 'Check the spelling, or try a craft like applique, kalamkari or checks, or a SKU like NH-MHPS-516.', '<div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center">' + ['Applique', 'Kalamkari', 'Pure Pattu', 'Checks'].map(function (w) { return '<a class="chip" href="#/search?q=' + w + '">' + w + '</a>'; }).join('') + '</div>') :
        '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.6rem">' + res.cols.slice(0, 10).map(function (c) { return '<a class="chip" href="#/shop?col=' + c.id + '">' + Site.mark(c.name, q) + ' <span class="n">' + c.count + '</span></a>'; }).join('') + '</div><div class="pgrid">' + res.prods.slice(0, 24).map(Site.card).join('') + '</div>' +
        (res.prods.length > 24 ? '<div class="more-row"><a class="btn btn-lg" href="#/shop?q=' + encodeURIComponent(q) + '">See all ' + res.prods.length + '</a></div>' : '')) + '<div style="height:clamp(48px,6vw,90px)"></div></div>',
      mount: function (el) { el.querySelector('[data-s]').addEventListener('submit', function (e) { e.preventDefault(); var v = el.querySelector('#sq').value.trim(); if (v) Site.go('search?q=' + encodeURIComponent(v)); }); }
    };
  });

  /* ================= Saree page ================= */
  var VIEWS = [['Full saree', 'center', 'cover'], ['Border', '50% 96%', '260%'], ['Pallu and body', '50% 18%', '220%'], ['Weave close-up', '35% 55%', '360%']];
  Site.page('product', function (r, st) {
    var p0 = Site.prod(r.arg); if (!p0) return Site.pageNotFound();
    var sold = r.q.sold === '1' || st === 'warning';
    var p = Object.assign({}, p0, { avail: sold ? 0 : p0.avail });
    var c = Site.colOf(p), cat = Site.cat(c.cat), cr = c.craft && Site.craft(c.craft);
    Site.seen(p.slug);
    if (st === 'loading') return { html: '<div class="wrap"><div class="page-head"><div class="skel" style="height:14px;width:240px"></div></div><div class="pdp"><div class="skel" style="aspect-ratio:3/4"></div><div class="buy"><div class="skel" style="height:14px;width:40%"></div><div class="skel" style="height:44px;width:80%"></div><div class="skel" style="height:30px;width:30%"></div><div class="skel" style="height:52px"></div></div></div></div>', handles: true };
    if (st === 'error') return { html: '<div class="wrap">' + errorBlock('this saree') + '</div>', handles: true };
    var wish = Site.S().wish.indexOf(p.slug) >= 0;
    var more = D.products.filter(function (x) { return x.col === p.col && x.slug !== p.slug; });
    var similar = D.products.filter(function (x) { return x.col !== p.col && Site.colOf(x).craft && Site.colOf(x).craft === c.craft; }).slice(0, 10);
    var recent = Site.S().recent.filter(function (s) { return s !== p.slug; }).map(Site.prod).filter(Boolean).slice(0, 8);
    var stock = p.avail > 1 ? '<div class="stockline low"><span class="dot"></span>Only ' + p.avail + ' left: this design is a set of identical pieces</div>' : p.avail === 1 ? '<div class="stockline"><span class="dot"></span>In stock · one of a kind</div>' : '<div class="stockline out"><span class="dot"></span>Sold out</div>';
    var desc = c.desc && c.desc.length > 20 && c.desc !== 'Ho' ? c.desc : (cat.slug === 'mangalagiri-handloom-pattu-sarees' ? 'A Mangalagiri handloom pattu saree from our ' + c.name + ' collection: rich colour, a traditional border and a soft, royal drape for festivals, weddings and family functions.' : 'From our ' + c.name + ' collection.');
    var buy = p.avail ? '<div class="buy-row">' + (p.avail > 1 ? '<div class="qty" role="group" aria-label="Quantity"><button type="button" data-qd="-1" aria-label="One fewer" disabled>−</button><output data-qty>1</output><button type="button" data-qd="1" aria-label="One more">+</button></div>' : '') +
      '<button type="button" class="btn btn-primary btn-lg" data-addp>' + icon('bag', 'ico-sm') + 'Add to bag</button><button type="button" class="btn btn-icon" data-wishp aria-pressed="' + wish + '" aria-label="Save to wishlist">' + icon('heart') + '</button></div><button type="button" class="btn btn-dark btn-lg btn-block" data-buynow>Buy now</button>'
      : '<div class="alert alert-warn">' + icon('alert') + '<div><b>This saree has sold out</b>Each handloom piece is unique. See similar sarees below, or ask us on WhatsApp about this design.</div></div><div class="buy-row"><button type="button" class="btn btn-lg" data-notify style="flex:1">' + icon('mail', 'ico-sm') + 'Tell me if it’s back</button></div><span class="badge badge-sample" style="justify-self:start">Planned: not on the website today</span>';
    var views = VIEWS.map(function (v, i) { return '<button type="button" data-view="' + i + '" aria-current="' + (i === 0) + '" aria-label="' + v[0] + '" style="background-image:url(' + p.img + ');background-position:' + v[1] + ';background-size:' + v[2] + '"></button>'; }).join('');
    var html = (sold && st === 'warning' ? warnBanner('<b>This saree just sold at the store</b>Sample: it was in stock a moment ago. The page updated by itself.') : '') +
      '<div class="wrap"><div class="page-head" style="padding-bottom:1rem">' + Site.crumbs([['Home', 'home'], [cat.name, 'c/' + cat.slug], [c.name, 'shop?col=' + c.id], [p.sku]]) + '</div>' +
      '<div class="pdp"><div class="gallery"><div class="thumbs" role="tablist" aria-label="Views">' + views + '</div><div class="stage" data-stage role="img" aria-label="' + esc(p.name) + '"><div class="view" style="background-image:url(' + p.img + ')"></div><span class="hint">' + icon('zoom', 'ico-sm') + 'Hover to zoom</span></div>' +
      VIEWS.slice(1).map(function (v) { return '<div class="stage"><div class="view" style="background-image:url(' + p.img + ');background-position:' + v[1] + ';background-size:' + v[2] + '"></div><span class="hint">' + v[0] + '</span></div>'; }).join('') + '</div>' +
      '<div class="buy"><a class="colname" href="#/' + (cr ? 'shop?craft=' + cr.key : 'c/' + cat.slug) + '">' + esc(cr ? cr.name : cat.name) + '</a><h1>' + esc(p.name) + '</h1><div class="meta"><span>SKU ' + esc(p.sku) + '</span><span aria-hidden="true">·</span><span>' + esc(cat.name) + '</span>' + (cr ? '<span aria-hidden="true">·</span><a class="link" href="#/shop?craft=' + cr.key + '">' + esc(cr.name) + '</a>' : '') + '</div>' +
      '<div class="pricebox"><span class="price">' + rs(c.price) + '</span><small>Inclusive of all taxes · Free delivery</small></div>' + stock + buy +
      '<div class="perks">' + [['truck', 'Free delivery across India'], ['shield', 'Secure payment by Razorpay'], ['thread', 'Woven in Mangalagiri'], ['whatsapp', 'Questions? WhatsApp ' + D.store.phone]].map(function (x) { return '<div>' + icon(x[0], 'ico-sm') + '<span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>' +
      '<form class="field" data-pin><label for="pin-in">Check delivery</label><div class="pincode"><input class="input" id="pin-in" inputmode="numeric" maxlength="6" placeholder="Pincode, like 500034"><button class="btn" type="submit">Check</button></div><p class="field-hint" data-pin-out>Enter your pincode for a delivery estimate.</p></form>' +
      '<div class="acc"><details open><summary>Description' + icon('plus', 'ico-sm') + '</summary><div class="body"><p>' + esc(desc) + '</p></div></details>' +
      '<details><summary>Details' + icon('plus', 'ico-sm') + '</summary><div class="body"><ul><li>Category: ' + esc(cat.name) + '</li><li>Collection: ' + esc(c.name) + '</li>' + (cr ? '<li>Craft: ' + esc(cr.name) + '</li>' : '') + '<li>SKU: ' + esc(p.sku) + '</li><li>Price: ' + rs(c.price) + ' per piece' + (p0.avail > 1 ? ', ' + p0.avail + ' identical pieces in stock' : '') + '</li></ul><p class="note">' + icon('info', 'ico-sm') + 'Colour, fabric, border and length show here once the shop fills them in (optional in the admin app).</p></div></details>' +
      '<details><summary>Delivery and returns' + icon('plus', 'ico-sm') + '</summary><div class="body"><p>Free delivery across India by DTDC. You get the tracking number by SMS and in My orders once it ships.</p><p>Returns and exchanges: <span class="draft-note">' + icon('edit', 'ico-sm') + 'Policy to confirm with the shop</span></p></div></details>' +
      '<details><summary>Saree care' + icon('plus', 'ico-sm') + '</summary><div class="body"><ul><li>Dry clean the first few times for pattu.</li><li>Store folded in a cotton cloth, away from damp.</li><li>Refold every few months so the zari does not crease.</li></ul><span class="draft-note">' + icon('edit', 'ico-sm') + 'Care text to confirm with the shop</span></div></details></div>' +
      '<div class="share">Share:<a class="btn btn-sm" href="https://wa.me/?text=' + encodeURIComponent(p.name + ' ' + rs(c.price)) + '" target="_blank" rel="noopener">' + icon('whatsapp', 'ico-sm') + 'WhatsApp</a><button type="button" class="btn btn-sm" data-copylink>' + icon('copy', 'ico-sm') + 'Copy link</button></div></div></div></div>' +
      (more.length ? '<section class="section band"><div class="wrap"><div class="sec-head reveal"><div><span class="eyebrow">Same collection</span><h2>More ' + esc(c.name) + '</h2><p>' + Site.plural(c.count, 'piece') + ' at ' + rs(c.price) + ' each.</p></div><div style="display:flex;gap:1rem;align-items:center">' + Site.railNav() + '<a class="link" href="#/shop?col=' + c.id + '">View all</a></div></div>' + Site.rail(more.map(Site.card), '', 'Same collection') + '</div></section>' : '') +
      (similar.length ? '<section class="section"><div class="wrap"><div class="sec-head reveal"><div><span class="eyebrow">You may also like</span><h2>More ' + esc(cr.name) + '</h2></div>' + Site.railNav() + '</div>' + Site.rail(similar.map(Site.card), '', 'Similar') + '</div></section>' : '') +
      (recent.length ? '<section class="section tight"><div class="wrap"><div class="sec-head reveal"><div><span class="eyebrow">For you</span><h2>Recently viewed</h2></div>' + Site.railNav() + '</div>' + Site.rail(recent.map(Site.card), 'five', 'Recently viewed') + '</div></section>' : '') +
      (p.avail ? '<div class="buybar" data-buybar><img src="' + p.img + '" alt=""><div class="t"><b>' + esc(p.name) + '</b><span class="price">' + rs(c.price) + '</span></div><button type="button" class="btn btn-primary" data-addp2>' + icon('bag', 'ico-sm') + 'Add</button></div>' : '');
    return {
      title: p.name, handles: st === 'popup' || st === 'success' || st === 'loading' || st === 'error',
      html: html,
      mount: function (el) {
        var qty = 1, stage = el.querySelector('[data-stage]'), view = stage.querySelector('.view');
        el.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { var v = VIEWS[+b.dataset.view]; view.style.backgroundPosition = v[1]; view.style.backgroundSize = v[2]; el.querySelectorAll('[data-view]').forEach(function (x) { x.setAttribute('aria-current', x === b); }); }); });
        stage.addEventListener('mousemove', function (e) { var r = stage.getBoundingClientRect(); stage.classList.add('zooming'); view.style.backgroundPosition = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%'; });
        stage.addEventListener('mouseleave', function () { stage.classList.remove('zooming'); var cur = el.querySelector('[data-view][aria-current="true"]'); var v = VIEWS[cur ? +cur.dataset.view : 0]; view.style.backgroundPosition = v[1]; view.style.backgroundSize = v[2]; });
        stage.addEventListener('click', function () { lightbox(p); });
        el.querySelectorAll('[data-qd]').forEach(function (b) { b.addEventListener('click', function () { qty = Math.max(1, Math.min(p.avail, qty + (+b.dataset.qd))); el.querySelector('[data-qty]').textContent = qty; el.querySelector('[data-qd="-1"]').disabled = qty <= 1; el.querySelector('[data-qd="1"]').disabled = qty >= p.avail; }); });
        function add(btn, then) { btn.classList.add('is-loading'); setTimeout(function () { btn.classList.remove('is-loading'); Site.addToBag(p.slug, qty); then && then(); }, 420); }
        var a = el.querySelector('[data-addp]'); a && a.addEventListener('click', function () { add(a); });
        var a2 = el.querySelector('[data-addp2]'); a2 && a2.addEventListener('click', function () { add(a2); });
        var bn = el.querySelector('[data-buynow]'); bn && bn.addEventListener('click', function () { Site.addToBag(p.slug, qty, true); Site.go('checkout'); });
        var w = el.querySelector('[data-wishp]'); w && w.addEventListener('click', function () { var on = Site.toggleWish(p.slug); w.setAttribute('aria-pressed', on); w.querySelector('.ico').style.fill = on ? 'currentColor' : ''; Site.toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist'); Site.paintHeader(); });
        if (w && wish) w.querySelector('.ico').style.fill = 'currentColor';
        var nt = el.querySelector('[data-notify]'); nt && nt.addEventListener('click', function () { Site.toast('Sample: we would send you an SMS when this design is back.'); });
        el.querySelector('[data-copylink]').addEventListener('click', function () { try { navigator.clipboard.writeText(location.href).then(function () { Site.toast('Link copied'); }, function () { Site.toast('Copy the address from the browser bar'); }); } catch (x) { Site.toast('Copy the address from the browser bar'); } });
        el.querySelector('[data-pin]').addEventListener('submit', function (e) { e.preventDefault(); var v = el.querySelector('#pin-in').value.trim(), out = el.querySelector('[data-pin-out]'); out.innerHTML = /^\d{6}$/.test(v) ? '<span style="color:var(--ok);font-weight:700">' + icon('check', 'ico-sm') + ' Delivers to ' + v + ' in 4 to 7 days, free.</span> <span class="badge badge-sample">Sample estimate</span>' : '<span style="color:var(--bad);font-weight:700">Enter a 6-digit pincode.</span>'; });
        var bar = el.querySelector('[data-buybar]'), anchor = el.querySelector('[data-addp]');
        if (bar && anchor) Site.onScroll(function () { bar.classList.toggle('on', anchor.getBoundingClientRect().bottom < 0); });
        if (st === 'popup') lightbox(p);
        if (st === 'success') { Site.addToBag(p.slug, 1); }
      }
    };
  });
  function lightbox(p) {
    Site.modal('<div style="position:relative;background:var(--mat)"><img src="' + p.img + '" alt="' + esc(p.name) + '" style="width:100%;max-height:86vh;object-fit:contain"><button type="button" class="btn btn-icon" data-close aria-label="Close" style="position:absolute;top:10px;right:10px;background:#fff;color:#111">' + icon('x') + '</button></div>', true);
  }

  /* ================= Bag ================= */
  Site.page('bag', function (r, st) {
    var lines = Site.bagLines();
    if (st === 'empty') lines = [];
    var body = !lines.length ? Site.empty('bag', 'Your bag is empty', 'Find something you love: every piece is woven by hand in Mangalagiri.', '<div style="display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center"><a class="btn btn-primary btn-lg" href="#/shop?sort=new">Shop new in</a><a class="btn btn-lg" href="#/collections">Collections</a></div>') :
      '<div class="two-col"><div>' + (st === 'warning' ? '<div class="alert alert-warn" style="margin-bottom:1rem">' + icon('alert') + '<div><b>A saree in your bag just sold at the store</b>Sample: it would be marked here and left out of checkout.</div></div>' : '') +
      '<div data-lines>' + lines.map(Site.lineHtml).join('') + '</div><a class="link" style="margin-top:1.2rem" href="#/shop">' + icon('back', 'ico-sm') + 'Continue shopping</a></div>' +
      '<aside class="card"><h3 style="margin-bottom:1rem">Order summary</h3><div class="sumrow"><span>Subtotal (' + Site.plural(Site.bagCount(), 'piece') + ')</span><span class="price">' + rs(Site.bagTotal()) + '</span></div><div class="sumrow"><span>Delivery</span><span style="color:var(--ok);font-weight:700">Free</span></div><div class="sumrow total"><span>Total</span><span class="price">' + rs(Site.bagTotal()) + '</span></div>' +
      '<a class="btn btn-primary btn-lg btn-block" style="margin-top:1.2rem" href="#/checkout">' + icon('lock', 'ico-sm') + 'Checkout securely</a><p class="note" style="margin-top:.9rem;justify-content:center">' + icon('shield', 'ico-sm') + 'Pay by UPI, card or net banking (Razorpay)</p>' +
      '<div class="freebar" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--line)"><span>' + icon('truck', 'ico-sm') + ' Free delivery across India, always.</span><span>' + icon('clock', 'ico-sm') + ' Sarees are kept for you for 15 minutes while you pay.</span></div></aside></div>';
    return {
      title: 'Your bag', handles: st === 'empty' || st === 'warning',
      html: '<div class="wrap"><div class="page-head">' + Site.crumbs([['Home', 'home'], ['Bag']]) + '<h1>Your bag</h1></div>' + body + '<div style="height:clamp(48px,6vw,90px)"></div></div>',
      mount: function (el) { Site.bindLines(el, function () { Site.render(); }); }
    };
  });
})();
