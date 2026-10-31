/* Shared by every page: icons, saved design choices, the floating
   "Design options" panel, demo controls, header menu and scroll reveal.
   Loaded in <head> so the chosen theme applies before first paint. */
(function () {
  var NH = window.NH = window.NH || {};
  var OPT_KEY = 'nh-m1-options';
  var FLAG_KEY = 'nh-m1-flags';

  /* ---------------- Icons (inline SVG, stroke style) ---------------- */
  var P = {
    phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    tablet: '<rect x="3.5" y="3" width="17" height="18" rx="2.5"/><path d="M11 18h2"/>',
    laptop: '<rect x="4" y="4.5" width="16" height="11" rx="1.5"/><path d="M2 19.5h20"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.1-7.5 9.5-4.3-1.4-7.5-4.9-7.5-9.5V6L12 3z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M10.9 12.1L19 4M16 7l2.5 2.5M14 9l2 2"/>',
    faceid: '<path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16"/><path d="M9 9.5v1M15 9.5v1M12 9.5V13h-1M9.5 15.5c1.5 1.1 3.5 1.1 5 0"/>',
    finger: '<path d="M12 11v3.5c0 2-.6 4-1.6 5.6"/><path d="M8.5 20c.8-1.5 1.2-3.3 1.2-5.5v-2a2.3 2.3 0 0 1 4.6 0v1.8"/><path d="M6.2 17.5c.5-1.3.8-2.8.8-4.5v-1a5 5 0 0 1 10 0v2.5c0 1.6-.2 3-.6 4.4"/><path d="M4.6 14.3c.3-.8.4-1.6.4-2.4a7 7 0 0 1 12.6-4.2M19 11.9v1.6"/>',
    message: '<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.2A8.5 8.5 0 1 1 20.5 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    alert: '<path d="M12 4l9 16H3L12 4z"/><path d="M12 10v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alertc: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
    wifioff: '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.6-2.5M19 12.6a10 10 0 0 0-2.3-1.6M2 8.8a15 15 0 0 1 4-2.5M22 8.8A15 15 0 0 0 11 5.1M12 20h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.3 2 12 2 12s3.6 6 10 6c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    home: '<path d="M3.5 10.5L12 4l8.5 6.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
    box: '<path d="M20.5 7.5L12 3 3.5 7.5 12 12l8.5-4.5z"/><path d="M3.5 7.5v9L12 21l8.5-4.5v-9M12 12v9"/>',
    scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7 12h10"/>',
    orders: '<path d="M9 3.5h6v3H9z"/><path d="M7.5 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.5"/><path d="M8 12h8M8 16h5"/>',
    more: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    logout: '<path d="M9.5 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h3"/><path d="M15.5 16.5L20 12l-4.5-4.5M20 12H9.5"/>',
    right: '<path d="M9.5 6l6 6-6 6"/>',
    left: '<path d="M14.5 6l-6 6 6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 3.5V8h4.5M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20.5V16h-4.5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9"/>',
    sliders: '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16z"/>',
    backspace: '<path d="M20 5.5H9.5L3.5 12l6 6.5H20a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    type: '<path d="M5 7V5h14v2M9.5 19h5M12 5v14"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5C21 6.4 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>',
    doc: '<path d="M14 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9L14 3.5z"/><path d="M14 3.5V9h5.5M8.5 13h7M8.5 16.5h5"/>',
    play: '<path d="M7 4.5v15l12-7.5-12-7.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    signal: '<path d="M4 18v-2M8.5 18v-5M13 18v-8M17.5 18V6"/>'
  };
  NH.icon = function (name, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || P.info) + '</svg>';
  };
  NH.iconNames = Object.keys(P);

  /* ---------------- Design choices ---------------- */
  NH.OPTIONS = [
    { key: 'theme', title: 'Theme', def: 'auto', choices: [['light', 'A', 'Light'], ['dark', 'B', 'Dark'], ['auto', 'C', 'Auto (follow phone)']] },
    { key: 'palette', title: 'Colour palette', def: 'b', choices: [['a', 'A', 'Indigo Loom'], ['b', 'B', 'Peacock'], ['c', 'C', 'Rani & Charcoal']] },
    { key: 'font', title: 'Font', def: 'a', choices: [['a', 'A', 'Plus Jakarta Sans'], ['b', 'B', 'Manrope'], ['c', 'C', 'Fraunces + Inter']] },
    { key: 'corners', title: 'Corner style', def: 'soft', choices: [['soft', 'A', 'Soft'], ['crisp', 'B', 'Crisp']] },
    { key: 'login', title: 'Sign-in layout', def: 'a', choices: [['a', 'A', 'Woven header + card'], ['b', 'B', 'Brand screen + sheet'], ['c', 'C', 'Minimal']] },
    { key: 'pin', title: 'PIN entry', def: 'a', choices: [['a', 'A', 'Boxes + phone keyboard'], ['b', 'B', 'Dots + on-screen keypad']] },
    { key: 'menu', title: 'Main menu on phones', def: 'a', choices: [['a', 'A', 'Floating tab bar'], ['b', 'B', 'Classic bottom bar']] }
  ];
  function read(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v || fallback; } catch (e) { return fallback; } }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* private mode: choices last for this page only */ } }
  NH.opts = (function () {
    var saved = read(OPT_KEY, {}), o = {};
    NH.OPTIONS.forEach(function (d) { o[d.key] = saved[d.key] || d.def; });
    return o;
  })();
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  NH.applyOptions = function () {
    var r = document.documentElement, o = NH.opts;
    r.setAttribute('data-theme', o.theme);
    r.setAttribute('data-mode', o.theme === 'auto' ? (mq && mq.matches ? 'dark' : 'light') : o.theme);
    r.setAttribute('data-palette', o.palette);
    r.setAttribute('data-font', o.font);
    r.setAttribute('data-corners', o.corners);
    r.setAttribute('data-login', o.login);
    r.setAttribute('data-pin', o.pin);
    r.setAttribute('data-menu', o.menu);
    document.dispatchEvent(new CustomEvent('nh:options'));
  };
  NH.setOption = function (key, val) { NH.opts[key] = val; write(OPT_KEY, NH.opts); NH.applyOptions(); NH.renderPanel && NH.renderPanel(); };
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (NH.opts.theme === 'auto') NH.applyOptions(); });
  NH.applyOptions();

  /* ---------------- Demo flags (mock only, shared with the app) ---------------- */
  var FLAG_DEFAULTS = { platform: 'ios', newPhone: false, offline: false, server: false, face: true, faceChanged: false };
  NH.flags = function () { var f = read(FLAG_KEY, {}); var o = {}; for (var k in FLAG_DEFAULTS) o[k] = (k in f) ? f[k] : FLAG_DEFAULTS[k]; return o; };
  NH.setFlag = function (k, v, quiet) { var f = NH.flags(); f[k] = v; write(FLAG_KEY, f); if (!quiet) document.dispatchEvent(new CustomEvent('nh:flags')); NH.renderPanel && NH.renderPanel(); };
  NH.resetFlags = function () { write(FLAG_KEY, FLAG_DEFAULTS); document.dispatchEvent(new CustomEvent('nh:flags')); };

  window.addEventListener('storage', function (e) {
    if (e.key === OPT_KEY) { var s = read(OPT_KEY, {}); NH.OPTIONS.forEach(function (d) { NH.opts[d.key] = s[d.key] || d.def; }); NH.applyOptions(); NH.renderPanel && NH.renderPanel(); }
    if (e.key === FLAG_KEY) { document.dispatchEvent(new CustomEvent('nh:flags')); NH.renderPanel && NH.renderPanel(); }
  });

  /* Targets for states/actions: the app on this page, or the app inside device frames */
  function appTargets() {
    var list = [];
    if (window.NHApp) list.push(window.NHApp);
    document.querySelectorAll('iframe[data-app]').forEach(function (f) { try { if (f.contentWindow.NHApp) list.push(f.contentWindow.NHApp); } catch (e) { } });
    return list;
  }
  NH.toast = function (msg) {
    var old = document.querySelector('.mock-toast'); if (old) old.remove();
    var t = document.createElement('div'); t.className = 'mock-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  };
  NH.sendState = function (s) {
    var t = appTargets();
    if (!t.length) { NH.toast('Screen states work on app screens. Pick one from "Go to screen".'); return; }
    t.forEach(function (a) { a.setState(s); });
  };
  NH.sendAction = function (name, arg) {
    var t = appTargets();
    if (!t.length) { NH.toast('Open an app screen to use demo actions.'); return; }
    t.forEach(function (a) { a.action(name, arg); });
  };
  NH.goScreen = function (route) {
    if (window.NHApp) { location.hash = '#/' + route; return; }
    if (NH.onGoScreen) { NH.onGoScreen(route); return; }
    location.href = 'app.html#/' + route;
  };

  /* ---------------- The floating panel ---------------- */
  var panelOpen = false, lastFocus = null;
  NH.renderPanel = function () {
    var panel = document.getElementById('opt-panel'); if (!panel) return;
    var o = NH.opts, f = NH.flags(), isApp = !!window.NHApp || !!document.querySelector('iframe[data-app]');
    var h = '<header><b>' + NH.icon('sliders', 'icon-sm') + ' Design options</b><span class="mock-tag">Mock-up control</span>' +
      '<button class="opt-close" type="button" data-close aria-label="Close design options">' + NH.icon('x', 'icon-sm') + '</button></header><div class="opt-body">';
    NH.OPTIONS.forEach(function (d) {
      h += '<div class="opt-group" role="group" aria-label="' + d.title + '"><div class="opt-title">' + d.title + '</div><div class="opt-row">';
      d.choices.forEach(function (c) { h += '<button type="button" data-opt="' + d.key + '" data-val="' + c[0] + '" aria-pressed="' + (o[d.key] === c[0]) + '">' + c[1] + ' · ' + c[2] + '</button>'; });
      h += '</div></div>';
    });
    h += '<div class="opt-group"><button type="button" class="opt-btn opt-copy" data-copy>' + NH.icon('copy', 'icon-sm') + ' Copy my choices</button><p class="opt-note">Paste the copied text back to me with your picks.</p></div>';
    h += '<div class="opt-group"><div class="opt-title"><label for="opt-go">Go to screen</label></div><select id="opt-go"><option value="">Choose a screen…</option>';
    NH_GROUPS.forEach(function (g) {
      h += '<optgroup label="' + g.title + '">';
      NH_SCREENS.filter(function (s) { return s.group === g.id; }).forEach(function (s) { h += '<option value="' + NH_ROUTE(s) + '">' + s.title + '</option>'; });
      h += '</optgroup>';
    });
    h += '</select><p class="opt-note"><a href="index.html">Start page</a> · <a href="kit.html">Design kit</a> · <a href="preview.html">Device preview</a></p></div>';
    h += '<div class="opt-group"><div class="opt-title">Screen states <small>for the open screen</small></div><div class="opt-row">';
    [['normal', 'Normal'], ['loading', 'Loading'], ['empty', 'Empty'], ['error', 'Error'], ['success', 'Success'], ['warning', 'Warning'], ['popup', 'Pop-up']].forEach(function (s) {
      h += '<button type="button" data-state="' + s[0] + '">' + s[1] + '</button>';
    });
    h += '</div></div>';
    if (isApp) {
      h += '<div class="opt-group"><div class="opt-title">Demo phone <small>sample, not design</small></div><div class="opt-row">' +
        '<button type="button" data-flag="platform" data-val="ios" aria-pressed="' + (f.platform === 'ios') + '">iPhone / iPad</button>' +
        '<button type="button" data-flag="platform" data-val="android" aria-pressed="' + (f.platform === 'android') + '">Android</button></div>' +
        '<div class="opt-row" style="margin-top:.35rem">' +
        '<button type="button" data-toggle="offline" aria-pressed="' + f.offline + '">No internet</button>' +
        '<button type="button" data-toggle="server" aria-pressed="' + f.server + '">Server slow / down</button>' +
        '<button type="button" data-toggle="newPhone" aria-pressed="' + f.newPhone + '">Treat this phone as new</button>' +
        '<button type="button" data-toggle="face" aria-pressed="' + f.face + '">Phone has ' + (f.platform === 'ios' ? 'Face ID' : 'fingerprint') + '</button>' +
        '<button type="button" data-toggle="faceChanged" aria-pressed="' + f.faceChanged + '">Face settings changed</button></div></div>';
      h += '<div class="opt-group"><div class="opt-title">Sample accounts <small>tap to fill</small></div><div class="demo-accounts">' +
        '<button type="button" class="opt-btn" data-action="fill" data-arg="9000000001"><b>90000 00001</b><span>PIN 246810</span><small>Lakshmi · Owner · Face ID on</small></button>' +
        '<button type="button" class="opt-btn" data-action="fill" data-arg="9000000002"><b>90000 00002</b><span>PIN 1357</span><small>Ravi · Staff · old 4-digit PIN</small></button>' +
        '<button type="button" class="opt-btn" data-action="fill" data-arg="9000000003"><b>90000 00003</b><span>not set up</span><small>Suresh · Staff · invited, use "First time here?"</small></button>' +
        '<button type="button" class="opt-btn" data-action="fill" data-arg="9000000004"><b>90000 00004</b><span>removed</span><small>Kiran · access removed by the owner</small></button>' +
        '</div><p class="opt-note">All names and numbers are sample data.</p></div>';
      h += '<div class="opt-group"><div class="opt-title">Demo events</div><div class="opt-row">' +
        '<button type="button" data-action="expire">Simulate 7 days unused</button>' +
        '<button type="button" data-action="remote">Signed out elsewhere</button>' +
        '<button type="button" data-action="removed">Access removed</button>' +
        '<button type="button" data-action="stolen">Copied sign-in detected</button>' +
        '<button type="button" data-action="signout">Sign out this phone</button>' +
        '<button type="button" data-action="reset">Reset demo</button></div></div>';
    }
    h += '</div>';
    panel.innerHTML = h;
  };

  function copyChoices() {
    var lines = ['Nandam Handlooms admin app: Module 1 (Sign in) mock-up choices'];
    NH.OPTIONS.forEach(function (d) { var c = d.choices.filter(function (x) { return x[0] === NH.opts[d.key]; })[0]; lines.push(d.title + ': ' + c[1] + ' (' + c[2] + ')'); });
    var text = lines.join('\n');
    function done() { NH.toast('Copied. Paste it back in the chat.'); }
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, fallback); } else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { prompt('Copy your choices:', text); }
      ta.remove();
    }
  }
  function openPanel(open) {
    var panel = document.getElementById('opt-panel'), fab = document.getElementById('opt-fab'); if (!panel) return;
    panelOpen = open; panel.classList.toggle('is-open', open); fab.setAttribute('aria-expanded', String(open));
    if (open) { lastFocus = document.activeElement; var b = panel.querySelector('button[aria-pressed="true"]') || panel.querySelector('button'); b && b.focus(); }
    else if (lastFocus) lastFocus.focus();
  }

  function initShell() {
    if (document.body.classList.contains('embed')) return; // inside a device frame: no shell, no panel
    var fab = document.createElement('button');
    fab.id = 'opt-fab'; fab.className = 'opt-fab'; fab.type = 'button';
    fab.setAttribute('aria-controls', 'opt-panel'); fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = NH.icon('sliders', 'icon-sm') + ' Design options';
    var panel = document.createElement('div');
    panel.id = 'opt-panel'; panel.className = 'opt-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Design options (mock-up control)');
    document.body.appendChild(panel); document.body.appendChild(fab);
    NH.renderPanel();
    fab.addEventListener('click', function () { openPanel(!panelOpen); });
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) return openPanel(false);
      if (b.dataset.opt) return NH.setOption(b.dataset.opt, b.dataset.val);
      if (b.hasAttribute('data-copy')) return copyChoices();
      if (b.dataset.state) return NH.sendState(b.dataset.state);
      if (b.dataset.flag) return NH.setFlag(b.dataset.flag, b.dataset.val);
      if (b.dataset.toggle) return NH.setFlag(b.dataset.toggle, !NH.flags()[b.dataset.toggle]);
      if (b.dataset.action) { if (b.dataset.action === 'reset') NH.resetFlags(); return NH.sendAction(b.dataset.action, b.dataset.arg); }
    });
    panel.addEventListener('change', function (e) { if (e.target.id === 'opt-go' && e.target.value) { NH.goScreen(e.target.value); e.target.value = ''; } });

    // Header mobile menu
    var mb = document.querySelector('[data-menu-btn]'), nav = document.querySelector('.site-nav');
    if (mb && nav) mb.addEventListener('click', function () { var o = !nav.classList.contains('is-open'); nav.classList.toggle('is-open', o); mb.setAttribute('aria-expanded', String(o)); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (panelOpen) openPanel(false);
      if (nav && nav.classList.contains('is-open')) { nav.classList.remove('is-open'); mb && mb.setAttribute('aria-expanded', 'false'); }
    });

    // Reveal on scroll
    var els = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } }); }, { threshold: .08 });
      els.forEach(function (el) { io.observe(el); });
    } else els.forEach(function (el) { el.classList.add('is-visible'); });

    // Fill icon placeholders: <i data-icon="name"></i>
    document.querySelectorAll('i[data-icon]').forEach(function (i) { i.outerHTML = NH.icon(i.dataset.icon, i.className); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initShell); else initShell();
})();
