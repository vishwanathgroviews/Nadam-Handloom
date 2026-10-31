/* The "Design options" panel (mock-up only), on every page of the home page mock-up (27 Oct 2026:
   the 6 categories as cards at the top of the home page).
   Choices are lettered, remembered in this browser, shared with the device preview, and copied
   as text with "Copy my choices". */
(function () {
  'use strict';
  var KEY = 'w11mock.opts.v1';
  var GROUPS = [
    { sec: 'Look (A is the picked design)', items: [
      ['theme', 'Theme', [['auto', 'A', 'Auto'], ['light', 'B', 'Light'], ['dark', 'C', 'Dark']]],
      ['palette', 'Colours', [['a', 'A', 'Wine & gold (live)'], ['b', 'B', 'Classic red & gold'], ['c', 'C', 'Modern teal']]],
      ['font', 'Fonts', [['a', 'A', 'Bodoni titles + Figtree (live)'], ['b', 'B', 'Figtree only'], ['c', 'C', 'The phone\'s own font']]],
      ['corners', 'Corners', [['a', 'A', 'Soft (live)'], ['b', 'B', 'Crisp']]],
      ['motion', 'Motion', [['a', 'A', 'Full'], ['b', 'B', 'Off']]],
    ] },
    { sec: 'Home: the categories section (your choices)', decide: true, items: [
      ['catcard', '1. The category cards', [['a', 'A', 'Like the saree cards (client)'], ['b', 'B', 'Wide photo, name on the photo (earlier)']]],
      ['catcols', '2. On laptops', [['a', 'A', '3 in a row, 2 rows (as asked)'], ['b', 'B', '6 in a row (the saree cards\' size)']]],
      ['crafts', '3. Under the cards', [['a', 'A', 'The crafts as small round photos'], ['b', 'B', 'Nothing (crafts stay in the filters)']]],
      ['catphoto', '4. The card photos', [['a', 'A', 'The admin app photo'], ['b', 'B', 'The newest saree (a tall photo)']]],
    ] },
  ];
  // The category, collection and saree pages are as live (their choices were all A); only the
  // home page's categories section is new.
  var DEF = { theme: 'auto', palette: 'a', font: 'a', corners: 'a', motion: 'a', catcard: 'a', catcols: 'a', crafts: 'a', catphoto: 'a', catpage: 'a', banner: 'a', tile: 'a', order: 'a', colnav: 'a', pdp: 'a' };
  // Every screen, from the live data, for "Go to screen" and the preview.
  function screens() {
    var NH = window.NH || { products: [], collections: [], categories: [] };
    var col = function (re) { return NH.collections.filter(function (c) { return re.test(c.name); })[0]; };
    var one = NH.products.filter(function (p) { return p.available === 1; })[0] || NH.products[0] || { slug: '' };
    var set = NH.products.filter(function (p) { return p.available > 1; })[0] || one;
    var picks = [col(/^Gap Border Embroidery Sarees$/), col(/^50\/50 Digital Print Sarees$/), col(/^Rangoli Border/), col(/^Kalamkari Lehanga/), col(/^Plain Cotton Saree$/)].filter(Boolean);
    var g = picks[0] || { id: '' };
    return [
      ['The home page (the change)', [['site.html#/', 'Home: the 6 category cards, then the rest as live'], ['site.html?catcard=a#/', 'Cards A: like the saree cards'], ['site.html?catcard=b#/', 'Cards B: wide photo, name on it'], ['site.html?catcols=b#/', 'On laptops B: 6 in a row'], ['site.html?catphoto=b#/', 'Photos B: the newest saree'], ['site.html#/?state=loading', 'Home: loading'], ['site.html#/?state=error', 'Home: couldn\'t load']]],
      ['Where a card goes: the category page (as live)', NH.categories.map(function (c) { return ['site.html#/c/' + c.slug, c.short + (c.soon ? ' (coming soon)' : ' (' + c.collections + ' collection' + (c.collections === 1 ? '' : 's') + ')')]; })
        .concat([['site.html#/c/mangalagiri-handloom-pattu-sarees?state=loading', 'A category: loading'], ['site.html#/c/mangalagiri-handloom-pattu-sarees?state=error', 'A category: couldn\'t load']])],
      ['A collection: all its sarees (as live)', picks.map(function (c) { return ['site.html#/collection/' + c.id, c.name + ' (' + c.count + ')']; })
        .concat([['site.html#/collection/' + g.id + '?state=loading', 'A collection: loading'], ['site.html#/collection/' + g.id + '?state=soldout', 'A collection: everything sold']])],
      ['Finding and buying a saree', [
        ['site.html#/search?q=kalamkari', 'Search: "kalamkari"'], ['site.html#/search?q=banarasi', 'Search: nothing found'], ['site.html#/new', 'New in'], ['site.html#/sets', 'Sets'],
        ['site.html#/p/' + one.slug, 'Saree page: a single piece'], ['site.html#/p/' + set.slug, 'Saree page: a set'], ['site.html#/p/' + one.slug + '?state=soldout', 'Saree page: sold out'],
        ['site.html#/bag', 'Bag'], ['site.html#/bag?state=empty', 'Bag: empty'], ['site.html#/signin?next=/checkout', 'Sign in'], ['site.html#/signin?next=/checkout&step=code', 'Sign in: the SMS code'],
        ['site.html#/checkout?direct=1', 'Checkout: address'], ['site.html#/checkout?step=pay', 'Checkout: pay'], ['site.html#/checkout?step=pay&state=payfail', 'Checkout: payment failed'],
        ['site.html#/order/latest', 'Order placed'], ['site.html#/orders', 'My orders'], ['site.html#/orders/NH25104471', 'One order: shipped'],
      ]],
      ['Mock-up pages', [['index.html', 'Start page (with the full list)'], ['kit.html', 'Design kit'], ['preview.html', 'Phone, tablet and laptop']]],
    ];
  }
  var SCREENS = screens();

  function read() {
    var o = {};
    try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { o = {}; }
    var out = {};
    Object.keys(DEF).forEach(function (k) { out[k] = o[k] || DEF[k]; });
    return out;
  }
  var opts = read();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(opts)); } catch (e) { /* private mode: this page only */ } }
  // A link can open a choice directly (site.html?top=b): it is remembered like a click.
  (function () {
    var q = new URLSearchParams(location.search); var any = false;
    Object.keys(DEF).forEach(function (k) { var v = q.get(k); if (v) { opts[k] = v; any = true; } });
    if (any) save();
  })();

  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function apply() {
    var h = document.documentElement;
    var dark = opts.theme === 'dark' || (opts.theme === 'auto' && mq && mq.matches);
    h.setAttribute('data-mode', dark ? 'dark' : 'light');
    Object.keys(DEF).filter(function (k) { return k !== 'theme'; }).forEach(function (k) { h.setAttribute('data-' + k, opts[k]); });
    h.classList.toggle('no-motion', opts.motion === 'b');
    document.dispatchEvent(new CustomEvent('w10opts', { detail: opts }));
  }
  apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (opts.theme === 'auto') apply(); });
  window.addEventListener('storage', function (e) { if (e.key === KEY) { opts = read(); apply(); render(); } });

  function labelOf(k) {
    for (var g = 0; g < GROUPS.length; g++) for (var i = 0; i < GROUPS[g].items.length; i++) {
      var it = GROUPS[g].items[i];
      if (it[0] === k) { var c = it[2].filter(function (x) { return x[0] === opts[k]; })[0]; return [it[1], c ? c[1] + ' ' + c[2] : opts[k]]; }
    }
    return [k, opts[k]];
  }
  function choicesText() {
    var lines = ['Nandam website (home A, categories → collections → sarees): my picks'];
    GROUPS.forEach(function (g) { g.items.forEach(function (it) { var l = labelOf(it[0]); lines.push(l[0] + ': ' + l[1]); }); });
    return lines.join('\n');
  }

  /* ---------- Panel ---------- */
  var states = { list: [], current: null, pick: null };
  var fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'mo-fab'; fab.setAttribute('aria-haspopup', 'dialog');
  fab.innerHTML = '<span aria-hidden="true">✦</span> Design options';
  var panel = document.createElement('div');
  panel.className = 'mo-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Design options (mock-up only)');

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function here() { var p = location.pathname.split('/').pop() || 'index.html'; return p + (p === 'site.html' ? location.hash : ''); }

  function render() {
    var h = '<div class="mo-head"><div><b>Design options</b><small>Mock-up control, not part of the website</small></div><button type="button" class="mo-x" data-mo-close aria-label="Close design options">✕</button></div>';
    h += '<div class="mo-sec"><h4>Go to screen</h4><select class="mo-sel" data-mo-go aria-label="Go to screen"><option value="">Choose a screen…</option>';
    SCREENS = screens();
    SCREENS.forEach(function (g) {
      h += '<optgroup label="' + esc(g[0]) + '">' + g[1].map(function (s) { return '<option value="' + esc(s[0]) + '"' + (s[0] === here() ? ' selected' : '') + '>' + esc(s[1]) + '</option>'; }).join('') + '</optgroup>';
    });
    h += '</select></div>';
    h += '<div class="mo-sec"><h4>Screen states</h4>';
    h += states.list.length ? '<div class="mo-row">' + states.list.map(function (s) { return '<button type="button" data-mo-state="' + esc(s[0]) + '" aria-pressed="' + (s[0] === states.current) + '">' + esc(s[1]) + '</button>'; }).join('') + '</div>' : '<p class="mo-states-empty">Open a screen of the website (site.html) to switch its states here.</p>';
    h += '</div>';
    GROUPS.forEach(function (g) {
      h += '<div class="mo-sec"><h4>' + esc(g.sec) + '</h4>';
      g.items.forEach(function (it) {
        h += '<div class="mo-g" role="group" aria-label="' + esc(it[1]) + '"><span>' + esc(it[1]) + '</span><div class="mo-seg">' + it[2].map(function (c) {
          return '<button type="button" data-mo-k="' + it[0] + '" data-mo-v="' + c[0] + '" aria-pressed="' + (opts[it[0]] === c[0]) + '"><b>' + c[1] + '</b>' + esc(c[2]) + (g.decide && c[1] === 'A' ? '<span class="mo-rec">Recommended</span>' : '') + '</button>';
        }).join('') + '</div></div>';
      });
      h += '</div>';
    });
    h += '<div class="mo-sec"><button type="button" class="mo-copy" data-mo-copy>Copy my choices</button><p class="mo-note" data-mo-copied aria-live="polite"></p>';
    h += '<div class="mo-row" style="margin-top:6px"><button type="button" data-mo-reset>Back to the recommended</button></div></div>';
    panel.innerHTML = h;
  }

  function open() { render(); panel.hidden = false; fab.hidden = true; try { sessionStorage.setItem(KEY + '.open', '1'); } catch (e) { /* ignore */ } var x = panel.querySelector('[data-mo-close]'); if (x) x.focus(); }
  function close() { panel.hidden = true; fab.hidden = false; try { sessionStorage.removeItem(KEY + '.open'); } catch (e) { /* ignore */ } fab.focus(); }

  function copy(text, done) {
    function fallback() {
      var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove(); done(ok);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback); else fallback();
  }

  panel.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-mo-close')) { close(); return; }
    if (b.hasAttribute('data-mo-k')) { opts[b.getAttribute('data-mo-k')] = b.getAttribute('data-mo-v'); save(); apply(); render(); var again = panel.querySelector('[data-mo-k="' + b.getAttribute('data-mo-k') + '"][data-mo-v="' + b.getAttribute('data-mo-v') + '"]'); if (again) again.focus(); return; }
    if (b.hasAttribute('data-mo-state')) { if (states.pick) states.pick(b.getAttribute('data-mo-state')); return; }
    if (b.hasAttribute('data-mo-reset')) { opts = JSON.parse(JSON.stringify(DEF)); save(); apply(); render(); return; }
    if (b.hasAttribute('data-mo-copy')) {
      var text = choicesText();
      copy(text, function (ok) {
        var n = panel.querySelector('[data-mo-copied]');
        if (ok) n.textContent = 'Copied. Paste it in WhatsApp or an email.';
        else { n.innerHTML = 'Couldn\'t copy by itself. Select and copy this:<br><textarea class="mo-sel" rows="8" style="height:auto;padding:6px">' + esc(text) + '</textarea>'; }
      });
    }
  });
  panel.addEventListener('change', function (e) {
    if (e.target.matches('[data-mo-go]') && e.target.value) {
      var v = e.target.value;
      var page = location.pathname.split('/').pop() || 'index.html';
      var page = location.pathname.split('/').pop() || 'index.html';
      if (page === 'site.html' && v.indexOf('site.html#') === 0) location.hash = v.slice(9); else location.href = v;
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); close(); } }, true);
  fab.addEventListener('click', open);

  function mount() {
    document.body.appendChild(fab); document.body.appendChild(panel);
    var want = false; try { want = sessionStorage.getItem(KEY + '.open') === '1'; } catch (e) { want = false; }
    if (want && !window.frameElement) open();
    if (window.frameElement) fab.hidden = true; // inside the device preview: the outer page has the panel
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  window.W10Opts = {
    get: function (k) { return opts[k]; },
    set: function (k, v) { opts[k] = v; save(); apply(); render(); },
    screens: screens,
    setStates: function (list, current, pick) { states = { list: list || [], current: current, pick: pick }; if (!panel.hidden) render(); },
    refresh: function () { if (!panel.hidden) render(); },
    choicesText: choicesText,
  };
})();
