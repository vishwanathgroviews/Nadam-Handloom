/* Website mock-up: the premium home page (15 Oct 2026, client: "complete standard premium
   design"). Built like a luxury house: intro, cinematic opening, brand statement, editorial
   collection grid, new arrivals, spotlight, occasion edits (pinned, sideways), the craft
   story (pinned images), promise band, sets, the store and the newsletter. Photos: the
   shop's own site photos and live saree photos. Brand wording is a draft to confirm. */
(function () {
  'use strict';
  var NH = window.NH, Site = window.Site, D = Site.D, icon = NH.icon, esc = Site.esc, rs = Site.rs, num = Site.num;
  var S = D.site;
  function img(k) { return S[k] || ('img/site/' + k + '.jpg'); }
  function lines(arr, cls) { return '<span class="lines ' + (cls || '') + '">' + arr.map(function (t, i) { return '<span class="ln"><span style="--d:' + i + '">' + t + '</span></span>'; }).join('') + '</span>'; }
  var craftCount = function (k) { var c = Site.craft(k); return c ? c.count : 0; };
  var colCount = function (k) { return D.collections.filter(function (c) { return c.craft === k; }).length; };

  var SLIDES = [
    { img: 'brand-handloom_banner', name: 'The loom', eye: 'From the looms of Mangalagiri', title: ['Woven by hand,', 'worn for a lifetime'], text: 'Pure Mangalagiri handloom pattu, from our store in Old Mangalagiri to your door, free across India.', cta: ['Discover the collection', 'c/mangalagiri-handloom-pattu-sarees'] },
    { img: 'hero-pattu-zari-border', name: 'Zari', eye: 'The zari edit', title: ['The quiet art of', 'the zari border'], text: 'Borders woven in silver and gold zari: the signature of a Mangalagiri saree.', cta: ['Shop pure pattu', 'shop?craft=pure'] },
    { img: 'craft-texture-mint-border', name: 'Pastels', eye: 'Soft colour', title: ['Quiet colour,', 'rich borders'], text: 'Mint, blush and ivory pattu with fine borders and embroidery.', cta: ['Shop embroidery', 'shop?craft=embroidery'] },
    { img: 'hero-kalamkari-border', name: 'Kalamkari', eye: 'Painted by hand', title: ['Kalamkari and', 'Tanjore stories'], text: 'Hand-painted and printed pattu that carries a story in colour.', cta: ['Shop the craft', 'shop?craft=kalamkari'] },
    { img: 'hero-cotton-checks', name: 'Everyday', eye: 'Everyday heirlooms', title: ['Checks, stripes', 'and easy drapes'], text: 'Light Mangalagiri weaves you will reach for every week.', cta: ['Shop checks', 'shop?craft=checks'] }
  ].filter(function (s) { return img(s.img); });

  function intro() {
    var seen = false; try { seen = sessionStorage.getItem('nh-intro') === '1'; sessionStorage.setItem('nh-intro', '1'); } catch (e) { }
    if (seen || NH.opts.motion === 'off' || document.body.classList.contains('embed')) return '';
    return '<div class="intro" aria-hidden="true"><div><img src="' + img('brand-logo') + '" alt=""><b>Nandam Handlooms</b><i></i><small>Old Mangalagiri</small></div></div>';
  }
  function opening() {
    if (NH.opts.hero === 'b') {
      var p = Site.byNewest.filter(function (x) { return !x.logo; })[4];
      return '<section class="lux-split"><div class="copy"><span class="eyebrow">From the looms of Mangalagiri</span><h1>' + lines(['Woven by hand,', '<em>worn for a</em>', '<em>lifetime</em>'], 'reveal-now') + '</h1><p class="reveal">Pure Mangalagiri handloom pattu: ' + num(D.totals.shown) + ' pieces in ' + D.collections.length + ' collections, sent free from our store in Old Mangalagiri.</p>' +
        '<div class="reveal" style="display:flex;gap:2rem;align-items:center;flex-wrap:wrap"><a class="btn btn-dark btn-lg" href="#/c/mangalagiri-handloom-pattu-sarees">Discover the collection</a><a class="lux-link" href="#/story">Our story ' + icon('arrow') + '</a></div></div>' +
        '<div class="art"><div class="big wipe" data-cur="View"><img data-par=".12" src="' + img('brand-handloom_banner') + '" alt="A weaver at a handloom"></div><a class="small wipe" href="#/p/' + p.slug + '" data-cur="View"><img src="' + p.img + '" alt="' + esc(p.name) + '"></a><div class="tag reveal"><span class="lux-label">New this week</span><b>' + esc(Site.colOf(p).name) + '</b><span class="price">' + rs(Site.priceOf(p)) + '</span></div></div></section>';
    }
    return '<section class="lux-hero hero" aria-roledescription="carousel" aria-label="Featured" style="--slide:7.5s">' + SLIDES.map(function (s, i) {
      return '<div class="hero-slide' + (i === 0 ? ' on' : '') + '" data-slide="' + i + '" aria-hidden="' + (i !== 0) + '"><img src="' + img(s.img) + '" alt=""' + (i ? ' loading="lazy"' : '') + '>' +
        '<div class="hero-copy"><div class="wrap"><div><span class="eyebrow">' + esc(s.eye) + '</span><h1>' + lines(s.title) + '</h1><p>' + esc(s.text) + '</p><div style="display:flex;gap:2rem;align-items:center;flex-wrap:wrap"><a class="btn btn-light btn-lg" href="#/' + s.cta[1] + '">' + esc(s.cta[0]) + '</a><a class="lux-link" href="#/story">Our story ' + icon('arrow') + '</a></div></div></div></div></div>';
    }).join('') + '<div class="hud"><div class="wrap"><div class="names" role="tablist">' + SLIDES.map(function (s, i) { return '<button type="button" role="tab" data-dot="' + i + '" aria-current="' + (i === 0) + '">' + esc(s.name) + '<i></i></button>'; }).join('') + '</div><span class="tally" data-hcount>01 — 0' + SLIDES.length + '</span></div></div><div class="cue">Scroll<i></i></div></section>';
  }
  function bindOpening(el) {
    var hero = el.querySelector('.lux-hero'); if (!hero) return;
    var slides = hero.querySelectorAll('[data-slide]'), dots = hero.querySelectorAll('[data-dot]'), cur = 0, t, n = slides.length;
    function show(i) {
      cur = (i + n) % n;
      slides.forEach(function (s, k) { var on = k === cur; s.classList.toggle('on', on); s.setAttribute('aria-hidden', !on); if (on) { var im = s.querySelector('img'); im.style.animation = 'none'; void im.offsetWidth; im.style.animation = ''; } });
      dots.forEach(function (d, k) { d.setAttribute('aria-current', k === cur); var b = d.querySelector('i'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; });
      hero.querySelector('[data-hcount]').textContent = '0' + (cur + 1) + ' — 0' + n;
      clearTimeout(t); if (NH.opts.motion !== 'off') t = setTimeout(function () { if (document.body.contains(hero)) show(cur + 1); }, 7500);
    }
    dots.forEach(function (d) { d.addEventListener('click', function () { show(+d.dataset.dot); }); });
    var sx = null; hero.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', function (e) { if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); sx = null; });
    if (NH.opts.motion !== 'off') t = setTimeout(function () { show(1); }, 7500);
    Site.onScroll(function (y) { if (y > innerHeight) return; hero.querySelectorAll('.hero-copy').forEach(function (c) { c.style.transform = 'translateY(' + (y * .3) + 'px)'; c.style.opacity = String(Math.max(0, 1 - y / (innerHeight * .7))); }); });
  }

  Site.page('home', function (r, st) {
    if (st === 'loading') return { html: '<div class="skel" style="height:100vh;border-radius:0"></div>', handles: true };
    if (st === 'error') return { html: '<div class="wrap" style="padding-top:160px">' + Site.empty('wifioff', 'Couldn’t load the home page', 'Check your internet connection and try again.', '<button type="button" class="btn btn-primary" onclick="NHSite.setState(\'normal\')">Try again</button>') + '</div>', handles: true };
    var shown = Site.shownCats, pattu = shown[0], dress = shown[1];
    var newest = Site.byNewest.filter(function (p) { return !p.logo; }).slice(0, 12);
    var pureCol = D.collections.filter(function (c) { return /pure pattu/i.test(c.name); })[0] || D.collections[0];
    var pureP = D.products.filter(function (p) { return p.col === pureCol.id; }).slice(0, 3);
    var sets = D.products.filter(function (p) { return p.avail > 1 && !p.logo; }).slice(0, 10);
    var EDITS = [
      ['01', 'The wedding edit', 'Pure pattu, butta and zari', 'shop?craft=pure', 'craft-texture-silver-border-1', craftCount('pure')],
      ['02', 'The festive edit', 'Kalamkari, Tanjore and hand-painted', 'shop?craft=kalamkari', 'hero-kalamkari-border', craftCount('kalamkari')],
      ['03', 'Embroidered pastels', 'Soft colour with fine handwork', 'shop?craft=embroidery', 'craft-texture-mint-embroidery', craftCount('embroidery')],
      ['04', 'Everyday Mangalagiri', 'Checks, prints and easy drapes', 'shop?craft=checks', 'hero-cotton-checks', craftCount('checks') + craftCount('digital')],
      ['05', 'Buy for the family', 'Designs with several identical pieces', 'shop?stock=set', 'cat-fabrics', D.totals.sets]
    ].filter(function (e) { return img(e[4]); });
    var STEPS = [
      ['brand-handloom_banner', 'The loom', 'Every Mangalagiri saree starts on a handloom. The weaver throws the shuttle by hand, thread by thread, over several days.'],
      ['craft-texture-silver-border-1', 'The zari border', 'Borders are woven in with silver and gold zari. A crisp, clean border is the signature of Mangalagiri.'],
      ['craft-texture-mint-embroidery', 'Finished by hand', 'Embroidery, applique and fine work are added by hand once the weaving is done.'],
      ['hero-kalamkari-border', 'Painted and printed', 'Kalamkari, Tanjore and hand-painted pieces carry stories from the region in colour.']
    ].filter(function (s) { return img(s[0]); });
    var html = intro() + opening() +
      '<section class="statement"><div class="wrap"><svg class="orn" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.2"><path d="M32 6c6 9 6 17 0 26-6-9-6-17 0-26zM32 58c-6-9-6-17 0-26 6 9 6 17 0 26zM6 32c9-6 17-6 26 0-9 6-17 6-26 0zM58 32c-9 6-17 6-26 0 9-6 17-6 26 0z"/><circle cx="32" cy="32" r="4"/></g></svg>' +
      '<p class="big words" data-words>From the looms of <em>Old Mangalagiri</em>, every saree is woven slowly, by hand, to be worn for the moments you keep and passed on to the ones you love.</p><a class="lux-link" href="#/story">Discover our story ' + icon('arrow') + '</a></div></section>' +
      '<section class="section" style="padding-top:0"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">The collections</span><h2>' + lines(['Woven for every', 'occasion']) + '</h2></div><a class="lux-link" href="#/collections">All ' + D.collections.length + ' collections ' + icon('arrow') + '</a></div>' +
      '<div class="edit-grid">' +
      '<a class="tile wipe crop-left" href="#/c/' + pattu.slug + '" data-cur="Shop"><img src="' + img('cat-mangalagiri-handloom-pattu-sarees') + '" alt="A model in a Mangalagiri pattu saree"><span class="cap"><span class="lux-label">' + num(pattu.count) + ' pieces</span><b>Mangalagiri pattu sarees</b><span class="lux-link">Shop now ' + icon('arrow') + '</span></span></a>' +
      (dress ? '<a class="tile wipe" href="#/c/' + dress.slug + '" data-cur="Shop"><img src="' + img('cat-handloom-pattu-dress-material') + '" alt=""><span class="cap"><span class="lux-label">' + num(dress.count) + ' pieces</span><b>Pattu dress materials</b><span class="lux-link">Shop now ' + icon('arrow') + '</span></span></a>' : '') +
      '<a class="tile wipe" href="#/shop?craft=pure" data-cur="Shop"><img src="' + img('hero-bridal-brocade') + '" alt=""><span class="cap"><span class="lux-label">' + num(craftCount('pure')) + ' pieces</span><b>Pure pattu and butta</b><span class="lux-link">Shop now ' + icon('arrow') + '</span></span></a>' +
      '<a class="tile wipe" href="#/collections" data-cur="Explore"><img src="' + img('craft-texture-gold-border-1') + '" alt=""><span class="cap"><span class="lux-label">' + D.collections.length + ' collections · ' + D.crafts.filter(function (c) { return c.count; }).length + ' crafts</span><b>Explore every collection</b><span class="lux-link">View all ' + icon('arrow') + '</span></span></a>' +
      '</div></div></section>' +
      '<section class="section band"><div class="wrap lux-rail"><div class="sec-head"><div><span class="eyebrow">Just arrived</span><h2>' + lines(['New this week']) + '</h2><p>The newest pieces from the store, added from the shop’s app the day they arrive.</p></div><div style="display:flex;gap:1.6rem;align-items:center">' + Site.railNav() + '<a class="lux-link" href="#/shop?sort=new">View all ' + icon('arrow') + '</a></div></div><div data-cur="Drag">' + Site.rail(newest.map(Site.card), '', 'New this week') + '</div></div></section>' +
      '<section class="lux-spot"><div class="pic" data-cur="View"><img data-par=".14" src="' + img('hero-pattu-zari-border') + '" alt=""></div><div class="txt"><span class="eyebrow">Collection spotlight</span><h2>' + lines([esc(pureCol.name)]) + '</h2><p class="reveal">' + num(pureCol.count) + ' pieces of our richest weave: pure pattu with butta motifs worked across the body, for weddings, festivals and family functions. ' + rs(pureCol.price) + ' each, delivered free.</p><div class="pgrid reveal">' + pureP.map(Site.card).join('') + '</div><a class="btn btn-dark btn-lg reveal" style="justify-self:start" href="#/shop?col=' + pureCol.id + '">Shop the collection</a></div></section>' +
      '<section class="edits" data-edits style="height:' + (EDITS.length * 42 + 70) + 'vh"><div class="pin"><div class="wrap head"><div><span class="eyebrow">Edits</span><h2 style="margin-top:.8rem">' + lines(['Dressed for the', 'moment']) + '</h2></div><p>Curated groups of our collections. Keep scrolling to see them all.</p></div><div class="strip" data-strip>' +
      EDITS.map(function (e) { return '<a class="edit-card" href="#/' + e[3] + '" data-cur="Shop"><span class="im"><img src="' + img(e[4]) + '" alt="" loading="lazy"></span><span class="no">' + e[0] + '</span><b>' + e[1] + '</b><span>' + e[2] + ' · ' + num(e[5]) + ' pieces</span></a>'; }).join('') + '</div></div></section>' +
      '<section class="craftstory" data-craft><div class="sticky">' + STEPS.map(function (s, i) { return '<figure class="' + (i === 0 ? 'on' : '') + '" data-fig="' + i + '"><img src="' + img(s[0]) + '" alt="" loading="lazy"></figure>'; }).join('') + '<span class="count" data-ccount>01 / 0' + STEPS.length + '</span></div><div class="steps-col">' +
      STEPS.map(function (s, i) { return '<div class="step' + (i === 0 ? ' on' : '') + '" data-step="' + i + '"><span class="mob"><img src="' + img(s[0]) + '" alt="" loading="lazy"></span><span class="no">0' + (i + 1) + '</span><span class="eyebrow">The craft</span><h3>' + s[1] + '</h3><p>' + s[2] + '</p>' + (i === STEPS.length - 1 ? '<a class="lux-link" href="#/story">Read our story ' + icon('arrow') + '</a>' : '') + '</div>'; }).join('') + '</div></section>' +
      '<section class="promise"><div class="wrap">' + [['thread', 'Woven in Mangalagiri', 'From our store in Old Mangalagiri'], ['truck', 'Free delivery', 'On every order, anywhere in India'], ['shield', 'Secure payment', 'UPI, cards and net banking by Razorpay'], ['whatsapp', 'Here to help', 'Call or WhatsApp ' + D.store.phone]].map(function (p) { return '<div class="it reveal">' + icon(p[0]) + '<b>' + p[1] + '</b><span>' + esc(p[2]) + '</span></div>'; }).join('') + '</div></section>' +
      (sets.length ? '<section class="section"><div class="wrap lux-rail"><div class="sec-head"><div><span class="eyebrow">For the family</span><h2>' + lines(['More than one', 'of a design']) + '</h2><p>' + num(D.totals.sets) + ' designs have several identical pieces in stock: for sisters, mothers and daughters, or a family function.</p></div>' + Site.railNav() + '</div><div data-cur="Drag">' + Site.rail(sets.map(Site.card), '', 'Sets') + '</div></div></section>' : '') +
      '<section class="lux-store"><img data-par=".1" src="' + img('hero-craft-story') + '" alt=""><div class="wrap"><div class="card-glass"><span class="eyebrow" style="color:#EBCB8B">Visit the store</span><h2>' + lines(['Come and see', 'them in daylight']) + '</h2><p style="color:rgba(255,255,255,.85)">Feel the weave, see a design in every colour, and let us help you choose.</p><dl><div><dt>Address</dt><dd>' + D.store.lines.map(esc).join(', ') + '</dd></div><div><dt>Open</dt><dd>' + esc(D.store.hours) + '</dd></div><div><dt>Call</dt><dd>' + esc(D.store.phone) + ' · Call or WhatsApp</dd></div></dl><div style="display:flex;gap:1.6rem;align-items:center;flex-wrap:wrap"><a class="btn btn-light btn-lg" href="' + D.store.map + '" target="_blank" rel="noopener">Get directions</a><a class="lux-link" href="#/store">Store details ' + icon('arrow') + '</a></div></div></div></section>' +
      '<section class="lux-news"><div class="wrap"><span class="eyebrow">New weaves first</span><h2>' + lines(['Be the first to see', 'what comes off the loom']) + '</h2><p class="muted">One email when new collections arrive. No spam.</p><form data-news><label class="sr-only" for="ln-in">Email</label><input id="ln-in" type="email" placeholder="Your email address" autocomplete="email"><button type="submit">Subscribe</button></form><span class="badge badge-sample">Planned: no newsletter today</span></div></section>';
    return {
      title: 'Mangalagiri Handloom Pattu Sarees', handles: st === 'popup',
      html: html,
      mount: function (el) {
        bindOpening(el);
        // statement: words light up as it scrolls through the screen
        var words = el.querySelector('[data-words]');
        if (words) {
          words.innerHTML = words.innerHTML.replace(/(<em>.*?<\/em>|[^\s<]+)/g, function (w) { return '<span class="w">' + w + '</span>'; });
          var ws = words.querySelectorAll('.w');
          Site.onScroll(function () { var r = words.getBoundingClientRect(), k = Math.min(1, Math.max(0, (innerHeight * .85 - r.top) / (r.height + innerHeight * .35))); var n = Math.round(k * ws.length); ws.forEach(function (w, i) { w.classList.toggle('on', i < n); }); });
          if (NH.opts.motion === 'off') ws.forEach(function (w) { w.classList.add('on'); });
        }
        // parallax images
        var par = el.querySelectorAll('[data-par]');
        Site.onScroll(function () { par.forEach(function (im) { var r = im.parentNode.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; im.style.transform = 'translateY(' + ((r.top + r.height / 2 - innerHeight / 2) * -(+im.dataset.par)) + 'px)'; }); });
        // edits: pinned, slide sideways while scrolling down
        var ed = el.querySelector('[data-edits]');
        if (ed && innerWidth > 860) Site.onScroll(function () { var r = ed.getBoundingClientRect(), strip = ed.querySelector('[data-strip]'), total = ed.offsetHeight - innerHeight, k = Math.min(1, Math.max(0, -r.top / total)); strip.style.transform = 'translateX(' + (-k * Math.max(0, strip.scrollWidth - innerWidth + 80)) + 'px)'; });
        // craft story: the image follows the step in view
        var steps = el.querySelectorAll('[data-step]'), figs = el.querySelectorAll('[data-fig]'), cc = el.querySelector('[data-ccount]');
        Site.onScroll(function () { var best = 0; steps.forEach(function (s, i) { var r = s.getBoundingClientRect(); if (r.top < innerHeight * .55) best = i; }); steps.forEach(function (s, i) { s.classList.toggle('on', i === best); }); figs.forEach(function (f, i) { f.classList.toggle('on', i === best); }); if (cc) cc.textContent = '0' + (best + 1) + ' / 0' + steps.length; });
        var nf = el.querySelector('[data-news]'); nf && nf.addEventListener('submit', function (e) { e.preventDefault(); Site.toast('Sample: you would get new arrivals by email.'); });
        if (st === 'popup') Site.openSearch();
        setTimeout(function () { window.dispatchEvent(new Event('scroll')); }, 60);
      }
    };
  });
})();
