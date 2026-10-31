/* Website mock-up: our story, visit the store, help and policies, wishlist (planned),
   maintenance and page not found. Policy wording is a draft for the shop to confirm. */
(function () {
  'use strict';
  var NH = window.NH, Site = window.Site, D = Site.D, icon = NH.icon, esc = Site.esc, rs = Site.rs, num = Site.num;

  Site.page('story', function () {
    var crafts = D.crafts.filter(function (c) { return c.count; });
    return {
      title: 'Our story',
      html: '<section class="story" data-story style="min-height:clamp(420px,62vh,620px)"><div class="bgimg" style="background-image:url(' + (D.site['hero-craft-story'] || '') + ')"></div><div class="wrap"><div class="copy reveal from-left"><span class="eyebrow">Our story</span><h1 style="color:#fff">Mangalagiri, thread by thread</h1><p>A store in Old Mangalagiri bringing the town’s handloom pattu to homes across India.</p></div></div></section>' +
        '<section class="section"><div class="wrap"><div class="feature-row reveal"><div class="ph"><img src="' + (D.site['craft-texture-gold-border-1'] || D.site['hero-pattu-zari-border']) + '" alt="" loading="lazy"></div><div class="prose"><span class="eyebrow">The weave</span><h2>What makes a Mangalagiri saree</h2><p>Mangalagiri sarees are known for their fine, light weave, a crisp feel and zari borders without heavy body work. They drape easily and last for years.</p><p>Our pattu sarees carry that tradition into embroidery, applique, kalamkari, digital and screen prints, so there is a Mangalagiri saree for every day and every celebration.</p><span class="draft-note">' + icon('edit', 'ico-sm') + 'Story text is a draft for the shop to confirm</span></div></div></div></section>' +
        '<section class="section band"><div class="wrap"><div class="center-head reveal"><span class="eyebrow">In numbers</span><h2>Today on nandamhandlooms.com</h2></div><div class="stats-row reveal">' +
        [[D.totals.shown, 'pieces online'], [D.collections.length, 'collections'], [crafts.length, 'crafts'], [D.totals.sets, 'designs in sets']].map(function (s) { return '<div><b data-count-to="' + s[0] + '">0</b><span>' + s[1] + '</span></div>'; }).join('') + '</div><p class="note" style="justify-content:center;margin-top:1.2rem">' + icon('info', 'ico-sm') + 'Live catalogue, ' + esc(D.totals.fetchedAt) + '</p></div></section>' +
        '<section class="section"><div class="wrap"><div class="feature-row flip reveal"><div class="ph"><img src="' + (D.site['brand-handloom_banner'] || '') + '" alt="" loading="lazy"></div><div class="prose"><span class="eyebrow">The store</span><h2>Opposite the Brahmam Gari temple</h2><p>Our store in Old Mangalagiri is open every day. Come feel the fabrics, see a set in every colour, or ask us to send photos of a design on WhatsApp.</p><div style="display:flex;gap:.6rem;flex-wrap:wrap"><a class="btn btn-primary" href="#/store">' + icon('pin', 'ico-sm') + 'Visit the store</a><a class="btn" href="#/collections">Shop collections</a></div></div></div></div></section>' +
        '<section class="section band"><div class="wrap"><div class="sec-head reveal"><div><span class="eyebrow">Crafts</span><h2>How our sarees are made</h2></div>' + Site.railNav() + '</div>' + Site.rail(crafts.map(function (c, i) { return '<a class="craft reveal" style="--i:' + i + '" href="#/shop?craft=' + c.key + '"><img src="' + c.img + '" alt="" loading="lazy"><span class="t"><b>' + esc(c.name) + '</b><span>' + num(c.count) + ' pieces</span></span></a>'; }), 'three', 'Crafts') + '</div></section>',
      mount: function (el) { var b = el.querySelector('[data-story] .bgimg'); Site.onScroll(function (y) { b.style.transform = 'translateY(' + (y * .25) + 'px)'; }); }
    };
  });

  Site.page('store', function () {
    var st = D.store;
    return {
      title: 'Visit the store',
      html: '<div class="wrap"><div class="page-head">' + Site.crumbs([['Home', 'home'], ['Visit the store']]) + '<span class="eyebrow">Old Mangalagiri</span><h1>Visit the store</h1><p class="lead">See every saree in person, in daylight. We are happy to help you choose.</p></div>' +
        '<div class="two-col" style="padding-bottom:clamp(48px,6vw,90px)"><div class="mapcard reveal zoom"><div><div class="pin">' + icon('pin', 'ico-lg') + '</div><h3>' + esc(st.name) + '</h3><p class="muted" style="margin:.4rem 0 1.2rem">' + st.lines.map(esc).join('<br>') + '</p><a class="btn btn-primary" href="' + st.map + '" target="_blank" rel="noopener">' + icon('external', 'ico-sm') + 'Open in Google Maps</a></div></div>' +
        '<aside class="card" style="display:grid;gap:1.2rem"><div class="visit" style="border:0;background:none;display:block"><dl style="margin:0">' +
        '<div><dt>' + icon('pin') + '</dt><dd><b>Address</b>' + st.lines.map(esc).join('<br>') + '</dd></div><div><dt>' + icon('clock') + '</dt><dd><b>Open</b>' + esc(st.hours) + '</dd></div><div><dt>' + icon('phone') + '</dt><dd><b>Call or WhatsApp</b><span class="tnum" style="user-select:all">' + esc(st.phone) + '</span></dd></div></dl></div>' +
        '<div style="display:grid;gap:.6rem"><a class="btn btn-primary" href="https://wa.me/917382968566" target="_blank" rel="noopener">' + icon('whatsapp', 'ico-sm') + 'WhatsApp the store</a><button type="button" class="btn" data-copy>' + icon('copy', 'ico-sm') + 'Copy the address</button></div><p class="note">' + icon('info', 'ico-sm') + 'Address, phone and hours: from the current website.</p></aside></div></div>',
      mount: function (el) { el.querySelector('[data-copy]').addEventListener('click', function () { var t = st.name + ', ' + st.lines.join(', '); try { navigator.clipboard.writeText(t).then(function () { Site.toast('Address copied'); }, function () { Site.toast(t); }); } catch (e) { Site.toast(t); } }); }
    };
  });

  var HELP = [
    ['delivery', 'Delivery', [['How much is delivery?', 'Delivery is free on every order, anywhere in India.'], ['How long does it take?', 'We pack your order at the store, usually the next working day. DTDC then delivers in about 4 to 7 days.'], ['How do I track my order?', 'You get the DTDC tracking number by SMS when it ships. It is also in My orders, with a link to track on DTDC.']]],
    ['returns', 'Returns and exchanges', [['Can I return or exchange a saree?', 'Policy to confirm with the shop: the window, the condition the saree must be in, and who pays for the return.'], ['A saree arrived damaged', 'WhatsApp us a photo within 48 hours of delivery and we will sort it out. (Draft: to confirm.)']]],
    ['pay', 'Payments', [['How can I pay?', 'UPI (Google Pay, PhonePe, Paytm), debit and credit cards, net banking and wallets, through Razorpay.'], ['Is cash on delivery available?', 'Not today. Every order is paid online. (The shop can decide to add it later.)'], ['The payment failed but money was taken', 'Failed payments are refunded by your bank automatically, usually in 5 to 7 working days. WhatsApp us the order number if you need help.']]],
    ['care', 'Saree care', [['How do I wash a pattu saree?', 'Dry clean the first few times. Store it folded in a soft cotton cloth.'], ['Will the colour run?', 'Hand-dyed and printed sarees can bleed a little at first: wash separately in cold water. (Care text to confirm.)']]],
    ['faq', 'Questions', [['Are all pieces handloom?', 'Each collection page says what it is. Ask us on WhatsApp if you want to know more about a design.'], ['Two sarees look the same. Why?', 'Some designs come in sets of identical pieces. The saree page says “Only N left” when there are several.'], ['Can I see a saree before buying?', 'Visit the store in Old Mangalagiri, or WhatsApp us and we will send more photos.']]]
  ];
  Site.page('help', function (r) {
    var t = r.q.t || 'delivery';
    return {
      title: 'Help',
      html: '<div class="wrap"><div class="page-head">' + Site.crumbs([['Home', 'home'], ['Help']]) + '<span class="eyebrow">We are here to help</span><h1>Help and policies</h1><p class="lead">Answers to common questions. For anything else, WhatsApp the store on ' + esc(D.store.phone) + '.</p><span class="draft-note">' + icon('edit', 'ico-sm') + 'Draft wording: the shop confirms each policy before go-live</span></div>' +
        '<div class="acct" style="padding-bottom:clamp(48px,6vw,90px)"><nav aria-label="Help topics">' + HELP.map(function (h) { return '<a href="#/help?t=' + h[0] + '" aria-current="' + (t === h[0] ? 'page' : 'false') + '">' + h[1] + '</a>'; }).join('') + '</nav><div><div class="acc">' +
        (HELP.filter(function (h) { return h[0] === t; })[0] || HELP[0])[2].map(function (q, i) { return '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(q[0]) + icon('plus', 'ico-sm') + '</summary><div class="body"><p>' + esc(q[1]) + '</p></div></details>'; }).join('') +
        '</div><div class="card-flat" style="margin-top:1.6rem;display:flex;gap:1rem;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>Still need help?</b><p class="muted">' + esc(D.store.hours) + '</p></div><a class="btn btn-primary" href="https://wa.me/917382968566" target="_blank" rel="noopener">' + icon('whatsapp', 'ico-sm') + 'WhatsApp us</a></div></div></div></div>'
    };
  });

  Site.page('wishlist', function (r, st) {
    var list = st === 'empty' ? [] : Site.S().wish.map(Site.prod).filter(Boolean);
    return {
      title: 'Wishlist', handles: st === 'empty',
      html: '<div class="wrap"><div class="page-head">' + Site.crumbs([['Home', 'home'], ['Wishlist']]) + '<h1>Wishlist</h1><p class="lead">Sarees you saved. <span class="badge badge-sample">Planned: the website has no wishlist today</span></p></div>' +
        (list.length ? '<div class="pgrid">' + list.map(Site.card).join('') + '</div>' : Site.empty('heart', 'Nothing saved yet', 'Tap the heart on any saree to keep it here.', '<a class="btn btn-primary" href="#/shop?sort=new">Shop new in</a>')) + '<div style="height:clamp(48px,6vw,90px)"></div></div>'
    };
  });

  Site.page('maintenance', function () {
    return {
      bare: true, title: 'Back soon',
      html: '<div class="maint"><div><img src="' + (D.site['brand-logo'] || '') + '" alt="Nandam Handlooms"><span class="eyebrow">Nandam Handlooms</span><h1>We’ll be back shortly</h1><p class="lead">We are updating the website. Orders and payments already placed are safe. The store in Old Mangalagiri is open as usual.</p><div class="card" style="display:grid;gap:.5rem;text-align:left;width:min(420px,100%)"><span class="label">Need something now?</span><b>' + esc(D.store.phone) + ' · Call or WhatsApp</b><span class="muted">' + esc(D.store.hours) + '</span></div><p class="note">' + icon('info', 'ico-sm') + 'Shown when the shop turns the website off from the admin app (Settings).</p><a class="btn" href="#/home">Back to the mock-up home</a></div></div>'
    };
  });

  function notFound() {
    return {
      title: 'Page not found',
      html: '<div class="wrap narrow">' + Site.empty('search', 'We couldn’t find that page', 'The link may be old, or the saree may have sold. Try a search or one of these collections.', '<form class="input-group" data-nf style="width:min(460px,100%)"><span class="pre">' + icon('search', 'ico-sm') + '</span><label class="sr-only" for="nf-q">Search</label><input class="input" id="nf-q" placeholder="Search sarees"><button class="btn btn-primary" type="submit">Search</button></form><div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center">' + D.collections.slice(0, 5).map(function (c) { return '<a class="chip" href="#/shop?col=' + c.id + '">' + esc(c.name) + '</a>'; }).join('') + '</div>').replace('<h3>We couldn’t find that page</h3>', '<h1 style="font-size:clamp(1.8rem,3vw,2.6rem)">We couldn’t find that page</h1>') + '</div>',
      mount: function (el) { el.querySelector('[data-nf]').addEventListener('submit', function (e) { e.preventDefault(); var v = el.querySelector('#nf-q').value.trim(); if (v) Site.go('search?q=' + encodeURIComponent(v)); }); }
    };
  }
  Site.pageNotFound = notFound;
  Site.page('notfound', notFound);
})();
