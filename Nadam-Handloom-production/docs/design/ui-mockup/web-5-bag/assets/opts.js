/* The "Design options" panel (mock-up only), on every page of the W5 bag mock-up.
   Choices are lettered like the plan (docs/modules/web-03-cart.md section 5), remembered in
   this browser, shared with the device preview, and copied as text with "Copy my choices". */
(function () {
  'use strict';
  var KEY = 'w5mock.opts.v1';
  var GROUPS = [
    { sec: 'Look (A is the live website, picked 15 Oct)', items: [
      ['theme', 'Theme', [['auto', 'A', 'Auto'], ['light', 'B', 'Light'], ['dark', 'C', 'Dark']]],
      ['palette', 'Colours', [['a', 'A', 'Utsav (live)'], ['b', 'B', 'Heritage'], ['c', 'C', 'Atelier']]],
      ['font', 'Fonts', [['a', 'A', 'Bodoni + Figtree (live)'], ['b', 'B', 'Cormorant + Manrope'], ['c', 'C', 'Instrument + Hanken']]],
      ['corners', 'Corners', [['a', 'A', 'Crisp (live)'], ['b', 'B', 'Soft']]],
      ['motion', 'Motion', [['a', 'A', 'Full'], ['b', 'B', 'Off']]],
    ] },
    { sec: 'The bag: owner\'s decisions (plan section 5)', decide: true, items: [
      ['name', '5.1 Its name', [['a', 'A', 'Bag'], ['b', 'B', 'Cart']]],
      ['after', '5.2 After "Add to bag"', [['a', 'A', 'Side panel'], ['b', 'B', 'Short message'], ['c', 'C', 'Go to the bag page']]],
      ['layout', '5.3 Bag page', [['a', 'A', 'Two columns'], ['b', 'B', 'One column, large photos'], ['c', 'C', 'Compact rows']]],
      ['qty', '5.4 How many (sets)', [['a', 'A', '− 1 +'], ['b', 'B', 'List'], ['c', 'C', 'Number buttons']]],
      ['icon', '5.5 Bag in the header', [['a', 'A', 'Icon + number'], ['b', 'B', 'Word "Bag (2)"'], ['c', 'C', 'Icon + total']]],
      ['pdp', '5.6 Saree page buttons', [['a', 'A', 'Bag first, WhatsApp under'], ['b', 'B', 'Side by side'], ['c', 'C', 'Bag + Buy now']]],
      ['problems', '5.7 When something changed', [['a', 'A', 'On the line + one note'], ['b', 'B', 'Own group at the top'], ['c', 'C', 'Pop-up']]],
      ['w6', '5.8 Until online payment (W6)', [['a', 'A', 'WhatsApp is the main button'], ['b', 'B', 'Checkout greyed'], ['c', 'C', 'With W6: Checkout']]],
    ] },
  ];
  var DEF = { theme: 'auto', palette: 'a', font: 'a', corners: 'a', motion: 'a', name: 'a', after: 'a', layout: 'a', qty: 'a', icon: 'a', pdp: 'a', problems: 'a', w6: 'a' };
  var SCREENS = [
    ['Visitor', [
      ['site.html#/shop', 'Sarees list (as live)'],
      ['site.html#/product/pure-pattu-350k-butta-saree-34', 'Saree page: one piece'],
      ['site.html#/product/150-50-plain-saree-7', 'Saree page: a set of 5'],
      ['site.html#/product/350k-butta-saree-3', 'Saree page: sold out'],
      ['site.html#/product/pure-pattu-350k-butta-saree-34?state=added', 'Just added to the bag'],
      ['site.html#/bag', 'The bag'],
      ['site.html#/bag?state=empty', 'Empty bag'],
      ['site.html#/bag?state=problems', 'Bag: things changed since adding'],
      ['site.html#/bag?state=whatsapp', 'Send the bag on WhatsApp'],
      ['site.html#/bag?state=sent', 'After sending on WhatsApp'],
    ]],
    ['Signed-in customer', [
      ['site.html#/sign-in', 'Sign in (mock-up shortcut)'],
      ['site.html#/bag?state=merged', 'Bags joined at sign-in'],
      ['site.html#/bag?state=signedout', 'After signing out'],
    ]],
    ['Rare situations', [
      ['site.html#/bag?state=loading', 'Checking (slow connection)'],
      ['site.html#/bag?state=offline', 'Offline'],
      ['site.html#/bag?state=error', 'Couldn\'t check the bag'],
      ['site.html#/bag?state=oldbag', 'Old website\'s bag brought back'],
      ['site.html#/bag?state=nostore', 'Browser won\'t save the bag'],
      ['site.html#/product/pure-pattu-350k-butta-saree-34?state=bagfull', 'Bag full (20 sarees)'],
    ]],
    ['Planned for later', [
      ['site.html#/checkout', 'Checkout (W6, planned)'],
    ]],
    ['Mock-up pages', [
      ['index.html', 'Start page'], ['kit.html', 'Design kit'], ['preview.html', 'Device preview'],
    ]],
  ];

  function read() {
    var o = {};
    try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { o = {}; }
    var out = {};
    Object.keys(DEF).forEach(function (k) { out[k] = o[k] || DEF[k]; });
    return out;
  }
  var opts = read();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(opts)); } catch (e) { /* private mode: this page only */ } }

  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function apply() {
    var h = document.documentElement;
    var dark = opts.theme === 'dark' || (opts.theme === 'auto' && mq && mq.matches);
    h.setAttribute('data-mode', dark ? 'dark' : 'light');
    ['palette', 'font', 'corners', 'motion', 'name', 'after', 'layout', 'qty', 'icon', 'pdp', 'problems', 'w6'].forEach(function (k) { h.setAttribute('data-' + k, opts[k]); });
    h.classList.toggle('no-motion', opts.motion === 'b');
    document.dispatchEvent(new CustomEvent('w5opts', { detail: opts }));
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
    var lines = ['Nandam website W5 (bag): my picks'];
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
      if (page === 'site.html' && v.indexOf('site.html#') === 0) location.hash = v.slice(9);
      else location.href = v;
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

  window.W5Opts = {
    get: function (k) { return opts[k]; },
    set: function (k, v) { opts[k] = v; save(); apply(); render(); },
    screens: SCREENS,
    word: function (cap) { var w = opts.name === 'b' ? 'cart' : 'bag'; return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w; },
    setStates: function (list, current, pick) { states = { list: list || [], current: current, pick: pick }; if (!panel.hidden) render(); },
    refresh: function () { if (!panel.hidden) render(); },
    choicesText: choicesText,
  };
})();
