/* The home page without the carousel (mock-up). The header, the sections under the new top part,
   the footer and the menu are the live website's own (captured.js); only the top part is new:
   the categories straight under the header, in layout A, B or C (Design options). Clicks that
   would leave the home page say where they go instead. */
(function () {
  'use strict';
  var CAP = window.CAP;
  var NH = window.NH;
  var ICONS = window.ICONS;
  var app = document.getElementById('app');
  // Largest first: the cotton sarees (2 pieces today) come last.
  var CATS = NH.categories.slice().sort(function (a, b) { return b.count - a.count; });
  var opt = function (k) { return window.W8Opts ? window.W8Opts.get(k) : null; };

  var fmt = new Intl.NumberFormat('en-IN');
  function n(v) { return fmt.format(v); }
  function rs(v) { return '₹' + fmt.format(v); }
  function count(v, one, many) { return n(v) + ' ' + (v === 1 ? one : many); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name, size) { return '<svg class="ico' + (size === 'sm' ? ' ico-sm' : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || ICONS.info) + '</svg>'; }
  function lines(text, id, tag) { return '<' + tag + (id ? ' id="' + id + '"' : '') + '><span class="lines"><span class="ln"><span style="--d:0">' + esc(text) + '</span></span></span></' + tag + '>'; }

  // A photo as the website's Picture component writes it (webp first, sizes for the screen).
  function sitePic(name, alt, sizes) {
    var ws = NH.siteSizes[name] || [800];
    var set = function (ext) { return ws.map(function (w) { return 'img/site/' + name + '-' + w + '.' + ext + ' ' + w + 'w'; }).join(', '); };
    var mid = ws.indexOf(800) >= 0 ? 800 : ws[ws.length - 1];
    return '<span class="pic"><picture><source type="image/webp" srcset="' + set('webp') + '" sizes="' + sizes + '"><img src="img/site/' + name + '-' + mid + '.jpg" srcset="' + set('jpg') + '" sizes="' + sizes + '" alt="' + esc(alt) + '" loading="lazy" decoding="async"></picture></span>';
  }
  function photo(p, alt, sizes) { return p.site ? sitePic(p.site, alt, sizes) : '<span class="pic"><img src="' + p.src + '" alt="' + esc(alt) + '" loading="lazy" decoding="async"></span>'; }

  /* ---------- The new top part ---------- */
  function head(center) {
    return '<div class="hc-head' + (center ? ' center' : '') + '"><div><span class="eyebrow">Handwoven in Old Mangalagiri</span>' + lines('Shop by category', 'h-shop', 'h1') + '</div>' +
      (center ? '' : '<p class="hc-sum"><b>' + n(NH.totals.sarees) + '</b> pieces in <b>' + NH.totals.collections + '</b> collections · free delivery across India</p>') + '</div>';
  }
  function collectionTile(c, i) {
    return '<a class="craft reveal" style="--i:' + (i % 8) + '" href="/category/' + c.category + '/' + c.id + '" data-cur="Shop"><img src="' + c.image + '" alt="" loading="lazy" decoding="async"><span class="go" aria-hidden="true">' + icon('arrow', 'sm') + '</span><span class="t"><b>' + esc(c.name) + '</b><span>' + count(c.count, 'piece', 'pieces') + ' · ' + rs(c.price) + '</span></span></a>';
  }
  function railNav(label) {
    return '<div class="rail-nav"><button type="button" aria-label="Previous ' + esc(label) + '" disabled>' + icon('left') + '</button><button type="button" aria-label="Next ' + esc(label) + '">' + icon('right') + '</button></div>';
  }
  function skel(cls) { return '<div class="hc-skel ' + (cls || '') + '"><span class="skel"></span></div>'; }
  function errorBox() { return '<div class="hc-error" role="alert"><p>We couldn\'t load the categories. Check your connection.</p><button type="button" class="btn btn-primary" data-hc-retry>Try again</button></div>'; }

  // A: four category tiles, then the crafts as chips.
  function topA(state) {
    var body;
    if (state === 'loading') body = '<div class="hc-tiles" aria-busy="true">' + [0, 1, 2, 3].map(function () { return skel('hc-tile'); }).join('') + '</div>';
    else if (state === 'error') body = errorBox();
    else {
      body = '<div class="hc-tiles">' + CATS.map(function (c, i) {
        return '<a class="hc-tile reveal" style="--i:' + i + '" href="/category/' + c.slug + '" data-cur="Shop">' + photo(c.photo, c.alt, '(max-width: 900px) 50vw, 25vw') +
          '<span class="cap"><span class="lux-label">' + count(c.count, 'piece', 'pieces') + ' · ' + count(c.collections, 'collection', 'collections') + '</span><b>' + esc(c.short) + '</b><span class="lux-link">Shop now ' + icon('arrow') + '</span></span></a>';
      }).join('') + '</div>' +
      '<div class="hc-crafts"><span class="lux-label">Shop by craft</span><div class="chip-row">' + NH.crafts.map(function (k) {
        return '<a class="chip" href="/shop?craft=' + k.key + '">' + esc(k.name) + ' <small>' + n(k.count) + '</small></a>';
      }).join('') + '<a class="chip" href="/collections">All ' + NH.totals.collections + ' collections</a></div></div>';
    }
    return '<section class="section hc hc-a" aria-labelledby="h-shop"><div class="wrap">' + head(false) + body + '</div></section>';
  }

  // B: round photos (the categories, then the crafts), then the largest collections.
  function topB(state) {
    var circles;
    var grid;
    if (state === 'loading') {
      circles = '<div class="hc-circles cats" aria-busy="true">' + [0, 1, 2, 3].map(function () { return '<span class="hc-circle"><span class="ring">' + skel('round') + '</span></span>'; }).join('') + '</div>';
      grid = '<div class="hc-cols">' + [0, 1, 2, 3].map(function () { return skel('craft'); }).join('') + '</div>';
    } else if (state === 'error') {
      circles = errorBox(); grid = '';
    } else {
      circles = '<nav class="hc-circles cats" aria-label="Categories">' +
        CATS.map(function (c, i) { return '<a class="hc-circle reveal" style="--i:' + i + '" href="/category/' + c.slug + '"><span class="ring">' + photo(c.photo, '', '200px') + '</span><b>' + esc(c.short) + '</b><small>' + count(c.count, 'piece', 'pieces') + '</small></a>'; }).join('') +
        '</nav><span class="lux-label hc-crafts-label">Or shop by craft</span><nav class="hc-circles crafts" aria-label="Crafts">' +
        NH.crafts.filter(function (k) { return k.image; }).map(function (k, i) { return '<a class="hc-circle reveal" style="--i:' + (i + 4) + '" href="/shop?craft=' + k.key + '"><span class="ring">' + photo({ src: k.image }, '', '120px') + '</span><b>' + esc(k.name) + '</b><small>' + n(k.count) + '</small></a>'; }).join('') +
        '</nav>';
      var top = NH.collections.filter(function (c) { return c.image; }).slice(0, 8);
      grid = '<div class="sec-head"><div><span class="eyebrow">Most to choose from</span>' + lines('Our largest collections', 'h-largest', 'h2') + '</div><a class="lux-link" href="/collections">All ' + NH.totals.collections + ' collections ' + icon('arrow') + '</a></div>' +
        '<div class="hc-cols">' + top.map(collectionTile).join('') + '</div>';
    }
    return '<section class="section hc hc-b" aria-labelledby="h-shop"><div class="wrap">' + head(true) + circles + grid + '</div></section>';
  }

  // C: each category with a row of its collections.
  function topC(state) {
    var jump = '<div class="chip-row hc-jump">' + CATS.map(function (c) { return '<a class="chip" href="#hc-' + c.slug + '" data-hc-jump>' + esc(c.short) + ' <small>' + n(c.count) + '</small></a>'; }).join('') + '</div>';
    var bands;
    if (state === 'loading') bands = [0, 1].map(function () { return '<div class="hc-band"><div class="wrap"><div class="rail" aria-busy="true">' + [0, 1, 2, 3, 4].map(function () { return skel('craft'); }).join('') + '</div></div></div>'; }).join('');
    else if (state === 'error') bands = '<div class="wrap" style="padding-bottom:48px">' + errorBox() + '</div>';
    else {
      bands = CATS.map(function (c) {
        var cols = NH.collections.filter(function (x) { return x.category === c.slug && x.image; }).slice(0, 10);
        var label = c.short + ' collections';
        return '<div class="hc-band" id="hc-' + c.slug + '"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">' + count(c.count, 'piece', 'pieces') + ' · ' + count(c.collections, 'collection', 'collections') + '</span>' + lines(c.short, 'h-' + c.slug, 'h2') + '</div><div class="side">' + (cols.length > 3 ? railNav(label) : '') + '<a class="lux-link" href="/category/' + c.slug + '">View all ' + icon('arrow') + '</a></div></div>' +
          '<div class="rail-wrap"><div class="rail" tabindex="0" role="region" aria-label="' + esc(label) + '" data-cur="Drag">' +
          '<a class="hc-lead" href="/category/' + c.slug + '">' + photo(c.photo, c.alt, '(max-width: 560px) 62vw, 20vw') + '<span class="lux-label" style="color:rgba(255,255,255,.84)">All ' + n(c.count) + '</span><b>' + esc(c.short) + '</b><span class="lux-link">Shop all ' + icon('arrow') + '</span></a>' +
          cols.map(collectionTile).join('') + '</div><div class="rail-bar" aria-hidden="true"><i></i></div></div></div></div>';
      }).join('');
    }
    return '<section class="hc hc-c" aria-labelledby="h-shop"><div class="wrap">' + head(false) + jump + '</div>' + bands + '</section>';
  }

  /* ---------- The page ---------- */
  function state() { var m = /[?&]state=(\w+)/.exec(location.search + location.hash); return m ? m[1] : 'normal'; }
  var REST = { a: ['Our story', 'h-new'], b: ['h-new', 'Our story'] };
  var AFTER = ['h-spot', 'h-edits', 'h-craft', 'Our promise', 'h-sets', 'h-store', 'h-alerts'];

  function render() {
    if (window.HC_KIT) { window.HC_KIT(); wire(); return; } // the design kit page draws its own
    var top = { a: topA, b: topB, c: topC }[opt('top') || 'a'](state());
    var rest = (REST[opt('after')] || REST.a).concat(AFTER).map(function (k) { return CAP.sections[k] || ''; }).join('');
    app.innerHTML = '<div class="hc-page">' +
      '<a class="skip-link" href="#main">Skip to content</a>' +
      '<div class="mock-strip" role="note"><span class="mock-tag">Mock-up</span><span>The home page without the carousel<span class="long">: the categories straight under the header. Everything below is today\'s home page.</span></span><a href="index.html">Start page</a><a href="preview.html">Phone and laptop</a></div>' +
      CAP.announce + CAP.header +
      '<main id="main" tabindex="-1"><div>' + top + rest + '</div></main>' +
      CAP.footer + CAP.fab + '</div>';
    document.title = 'Nandam Handlooms · Handwoven in Mangalagiri (home page mock-up)';
    wire();
    if (window.W8Opts) window.W8Opts.setStates([['normal', 'Normal'], ['loading', 'Loading'], ['error', 'Couldn\'t load']], state(), pickState);
  }
  function pickState(s) {
    var url = location.pathname + (s === 'normal' ? '' : '?state=' + s);
    history.replaceState(null, '', url);
    render();
  }

  /* ---------- What the live website does on this page ---------- */
  var cleanups = [];
  function onScroll(fn) {
    var raf = 0;
    var run = function () { raf = 0; fn(); };
    var h = function () { if (!raf) raf = requestAnimationFrame(run); };
    window.addEventListener('scroll', h, { passive: true }); window.addEventListener('resize', h);
    cleanups.push(function () { window.removeEventListener('scroll', h); window.removeEventListener('resize', h); });
    fn();
  }
  var noMotion = function () { return document.documentElement.classList.contains('no-motion') || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };

  function reveal() {
    var items = [].slice.call(app.querySelectorAll('.reveal:not(.in), .wipe:not(.in), .lines:not(.in)'));
    if (noMotion() || !('IntersectionObserver' in window)) { items.forEach(function (el) { el.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) {
      if (!el.classList.contains('wipe')) { io.observe(el); return; }
      var sub = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { el.classList.add('in'); sub.disconnect(); } }, { threshold: 0.08 });
      sub.observe(el.parentElement);
    });
    cleanups.push(function () { io.disconnect(); });
  }

  function announce() {
    var track = app.querySelector('.announce .track');
    if (!track) return;
    var msgs = [].slice.call(track.querySelectorAll('.msg'));
    var at = 0;
    var show = function () { track.style.transform = 'translateY(calc(' + (-at) + ' * var(--announce-h, 36px)))'; msgs.forEach(function (m, i) { m.setAttribute('aria-hidden', String(i !== at)); }); };
    show();
    if (msgs.length < 2 || noMotion()) return;
    var t = setInterval(function () { at = (at + 1) % msgs.length; show(); }, 4500);
    cleanups.push(function () { clearInterval(t); });
  }

  function statement() {
    var big = app.querySelector('.statement .big');
    if (!big) return;
    var words = [].slice.call(big.querySelectorAll('.w'));
    onScroll(function () {
      var r = big.getBoundingClientRect();
      var k = Math.min(1, Math.max(0, (window.innerHeight * 0.85 - r.top) / (r.height + window.innerHeight * 0.35)));
      var on = noMotion() ? words.length : Math.round(k * words.length);
      words.forEach(function (w, i) { w.classList.toggle('on', i < on); });
    });
  }

  function rails() {
    [].slice.call(app.querySelectorAll('.rail-wrap')).forEach(function (wrap) {
      var rail = wrap.querySelector('.rail');
      var holder = wrap.closest('.wrap');
      var nav = holder && holder.querySelector('.rail-nav');
      var bar = wrap.querySelector('.rail-bar i');
      var btns = nav ? nav.querySelectorAll('button') : [];
      var update = function () {
        var max = rail.scrollWidth - rail.clientWidth;
        var w = rail.scrollWidth ? Math.min(100, (rail.clientWidth / rail.scrollWidth) * 100) : 100;
        if (bar) { bar.style.width = w + '%'; bar.style.left = (max > 0 ? (rail.scrollLeft / max) * (100 - w) : 0) + '%'; }
        if (btns.length) { btns[0].disabled = rail.scrollLeft < 4; btns[1].disabled = rail.scrollLeft > max - 4; }
      };
      if (btns.length) {
        btns[0].addEventListener('click', function () { rail.scrollBy({ left: -rail.clientWidth * 0.8, behavior: noMotion() ? 'auto' : 'smooth' }); });
        btns[1].addEventListener('click', function () { rail.scrollBy({ left: rail.clientWidth * 0.8, behavior: noMotion() ? 'auto' : 'smooth' }); });
      }
      rail.addEventListener('scroll', update, { passive: true });
      update();
    });
  }

  function edits() {
    var sec = app.querySelector('.edits');
    var strip = sec && sec.querySelector('.strip');
    if (!strip) return;
    onScroll(function () {
      if (window.innerWidth <= 860 || noMotion()) { strip.style.transform = ''; return; }
      var r = sec.getBoundingClientRect();
      var total = sec.offsetHeight - window.innerHeight;
      var k = Math.min(1, Math.max(0, -r.top / total));
      strip.style.transform = 'translateX(' + (-k * Math.max(0, strip.scrollWidth - window.innerWidth + 80)) + 'px)';
    });
  }

  function craft() {
    var el = app.querySelector('.craftstory');
    if (!el) return;
    var steps = [].slice.call(el.querySelectorAll('[data-step]'));
    var figs = [].slice.call(el.querySelectorAll('[data-fig]'));
    var c = el.querySelector('.count');
    onScroll(function () {
      var best = 0;
      steps.forEach(function (s, i) { if (s.getBoundingClientRect().top < window.innerHeight * 0.55) best = i; });
      steps.forEach(function (s, i) { s.classList.toggle('on', i === best); });
      figs.forEach(function (f, i) { f.classList.toggle('on', i === best); });
      if (c) c.textContent = '0' + (best + 1) + ' / 0' + steps.length;
    });
  }

  function parallax() {
    [['.lux-spot .big .pic', 0.12], ['.lux-store > .pic', 0.1]].forEach(function (p) {
      var el = app.querySelector(p[0]);
      if (!el) return;
      onScroll(function () {
        if (noMotion()) { el.style.transform = ''; return; }
        var r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        el.style.transform = 'translateY(' + ((r.top + r.height / 2 - window.innerHeight / 2) * -p[1]) + 'px)';
      });
    });
  }

  /* ---------- Menu, entrance, messages ---------- */
  var menuEl = null;
  var menuBtn = null;
  function openMenu() {
    if (menuEl) return;
    var box = document.createElement('div');
    box.innerHTML = CAP.menu;
    menuEl = box.firstElementChild;
    document.body.appendChild(menuEl);
    document.body.style.overflow = 'hidden';
    menuBtn.setAttribute('aria-expanded', 'true');
    menuEl.querySelector('.close').addEventListener('click', closeMenu);
    menuEl.querySelector('.close').focus();
  }
  function closeMenu() {
    if (!menuEl) return;
    menuEl.remove(); menuEl = null;
    document.body.style.overflow = '';
    if (menuBtn) { menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.focus(); }
  }

  var played = false;
  function entrance() {
    if (opt('entrance') !== 'b' || noMotion() || played) return;
    played = true;
    var box = document.createElement('div');
    box.innerHTML = CAP.sections.intro;
    var el = box.firstElementChild;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3100);
  }

  var toastBox = null;
  function toast(text) {
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; toastBox.setAttribute('aria-live', 'polite'); document.body.appendChild(toastBox); }
    var t = document.createElement('div');
    t.className = 'toast info'; t.setAttribute('role', 'status');
    t.innerHTML = icon('info') + '<span>' + esc(text) + '</span>';
    toastBox.appendChild(t);
    setTimeout(function () { t.remove(); }, 4200);
    while (toastBox.children.length > 2) toastBox.firstChild.remove();
  }
  function where(href) {
    if (/^\/category\/[^/]+\/[^/]+/.test(href)) return 'that collection';
    if (/^\/category\//.test(href)) return 'that category';
    if (/^\/product\//.test(href)) return 'that saree';
    if (/^\/shop/.test(href)) return 'the list of sarees';
    if (href === '/collections') return 'every collection';
    if (href === '/sign-in') return 'sign in';
    if (href === '/bag') return 'the bag';
    if (/^https:\/\/wa\.me/.test(href)) return 'WhatsApp with the shop (+91 73823 88565)';
    if (/^tel:/.test(href)) return 'a call to the shop';
    if (/maps/.test(href)) return 'Google Maps';
    return href;
  }

  function wire() {
    cleanups.forEach(function (f) { f(); }); cleanups = [];
    reveal(); announce(); statement(); rails(); edits(); craft(); parallax(); if (!window.HC_KIT) entrance();
    menuBtn = app.querySelector('.hdr .menu-btn');
    var mode = opt('theme');
    [].slice.call(app.querySelectorAll('.ftr-theme button')).forEach(function (b) { b.setAttribute('aria-pressed', String(b.textContent.trim().toLowerCase() === mode)); });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    var b = e.target.closest('button');
    if (b && b.closest('.mo-panel, .mo-fab')) return;
    if (b && b.matches('.hdr .menu-btn')) { openMenu(); return; }
    if (b && b.matches('[data-hc-retry]')) { pickState('normal'); return; }
    if (b && b.closest('.ftr-theme')) { if (window.W8Opts) window.W8Opts.set('theme', b.textContent.trim().toLowerCase()); return; }
    if (b && b.closest('.hdr .tools')) { toast(b.getAttribute('aria-label') === 'Search' ? 'Search opens here, as today. Not part of this change.' : 'The bag opens here, as today. Not part of this change.'); return; }
    if (!a || a.closest('.mo-panel, .mock-strip')) return;
    var href = a.getAttribute('href') || '';
    if (a.hasAttribute('data-hc-jump')) { e.preventDefault(); var t = document.querySelector(href); if (t) t.scrollIntoView({ behavior: noMotion() ? 'auto' : 'smooth', block: 'start' }); return; }
    if (href === '#main') return;
    if (href === '/#craft' || href === '/#store') {
      e.preventDefault(); closeMenu();
      var to = document.getElementById(href.slice(2));
      if (to) to.scrollIntoView({ behavior: noMotion() ? 'auto' : 'smooth' });
      return;
    }
    if (href === '/') { e.preventDefault(); closeMenu(); window.scrollTo({ top: 0, behavior: noMotion() ? 'auto' : 'smooth' }); return; }
    e.preventDefault();
    closeMenu();
    toast('On the website this opens ' + where(href) + '. That page doesn\'t change.');
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuEl) { e.preventDefault(); closeMenu(); } });
  document.addEventListener('w8opts', function () { var y = window.scrollY; render(); window.scrollTo(0, Math.min(y, document.documentElement.scrollHeight)); });

  window.HC = { topA: topA, topB: topB, topC: topC, CATS: CATS };
  render();
})();
