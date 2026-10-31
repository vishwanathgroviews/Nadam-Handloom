/* Module 5 mock-up: icons, saved choices, the floating Design options panel and
   demo controls. The design system was chosen on 2026-10-11 (Peacock, Plus Jakarta
   Sans, soft corners), so only the theme and Module 5's new layout choices are open. */
(function () {
  var NH = window.NH = window.NH || {};
  var OPT_KEY = 'nh-m5-options';
  var FLAG_KEY = 'nh-m5-flags';

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
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>',
    crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z"/>',
    whatsapp: '<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.2A8.5 8.5 0 1 1 20.5 12z"/><path d="M9 8.5c0 3.5 2.6 6.5 6.5 6.5l1-1.6-2-1-1 1c-1.4-.6-2.4-1.6-3-3l1-1-1-2L9 8.5z"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    grip: '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8.5"/>',
    camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
    pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    eye2: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
    filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    userplus: '<circle cx="10" cy="8" r="4"/><path d="M3 20.5a7 7 0 0 1 12.5-4.3M19 14v6M16 17h6"/>',
    signal: '<path d="M4 18v-2M8.5 18v-5M13 18v-8M17.5 18V6"/>',
    barcode: '<path d="M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    skip: '<path d="M5 5l9 7-9 7V5zM18 5v14"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10"/>',
    bluetooth: '<path d="M7 7l10 10-5 4V3l5 4L7 17"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z"/>',
    move: '<path d="M5 12h14M15 8l4 4-4 4"/><path d="M9 5H5v14h4"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5H7z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>',
    broken: '<path d="M3 12V4h8l3 3-3 3 3 3-3 3 3 3-1 1L3 12z"/><path d="M15 9l6 6-6 6"/>',
    flash: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    list: '<rect x="3.5" y="5" width="5" height="5" rx="1.2"/><rect x="3.5" y="14" width="5" height="5" rx="1.2"/><path d="M11.5 7.5h9M11.5 16.5h9"/>',
    cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
    upi: '<path d="M7 4l5 16M12 4l5 16"/><path d="M4 12h16"/>',
    card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6.5 15h4"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    xcircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    store: '<path d="M3.5 9l1.5-5h14l1.5 5M3.5 9v11h17V9M3.5 9h17M9 20v-6h6v6"/>',
    zoom: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5"/>'
  };
  NH.icon = function (name, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || P.info) + '</svg>';
  };
  NH.iconNames = Object.keys(P);
  NH.icon = function (name, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || P.info) + '</svg>';
  };

  NH.OPTIONS = [
    { key: 'theme', title: 'Theme', def: 'auto', choices: [['light', 'A', 'Light'], ['dark', 'B', 'Dark'], ['auto', 'C', 'Auto (follow phone)']] },
    { key: 'scanLayout', title: 'Scan screen', def: 'a', isNew: true, choices: [['a', 'A', 'Camera full, bill strip at the bottom (picked)'], ['b', 'B', 'Split: camera on top, bill below']] },
    { key: 'complete', title: 'Complete sale', def: 'a', isNew: true, choices: [['a', 'A', 'One page (picked)'], ['b', 'B', 'Three short steps']] }
  ];
  function read(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v || fallback; } catch (e) { return fallback; } }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { } }
  NH.opts = (function () { var s = read(OPT_KEY, {}), o = {}; NH.OPTIONS.forEach(function (d) { o[d.key] = s[d.key] || d.def; }); return o; })();
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  NH.applyOptions = function () {
    var r = document.documentElement, o = NH.opts;
    r.setAttribute('data-theme', o.theme);
    r.setAttribute('data-mode', o.theme === 'auto' ? (mq && mq.matches ? 'dark' : 'light') : o.theme);
    // Chosen design system (fixed): Peacock palette, Plus Jakarta Sans, soft corners, floating tab bar.
    r.setAttribute('data-palette', 'b'); r.setAttribute('data-font', 'a'); r.setAttribute('data-corners', 'soft'); r.setAttribute('data-menu', 'a');
    document.dispatchEvent(new CustomEvent('nh:options'));
  };
  NH.setOption = function (k, v) { NH.opts[k] = v; write(OPT_KEY, NH.opts); NH.applyOptions(); NH.renderPanel && NH.renderPanel(); };
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (NH.opts.theme === 'auto') NH.applyOptions(); });
  NH.applyOptions();

  var FLAG_DEFAULTS = { platform: 'android', viewAs: 'owner', offline: false };
  NH.flags = function () { var f = read(FLAG_KEY, {}), o = {}; for (var k in FLAG_DEFAULTS) o[k] = (k in f) ? f[k] : FLAG_DEFAULTS[k]; return o; };
  NH.setFlag = function (k, v, quiet) { var f = NH.flags(); f[k] = v; write(FLAG_KEY, f); if (!quiet) document.dispatchEvent(new CustomEvent('nh:flags')); NH.renderPanel && NH.renderPanel(); };
  window.addEventListener('storage', function (e) {
    if (e.key === OPT_KEY) { var s = read(OPT_KEY, {}); NH.OPTIONS.forEach(function (d) { NH.opts[d.key] = s[d.key] || d.def; }); NH.applyOptions(); NH.renderPanel && NH.renderPanel(); }
    if (e.key === FLAG_KEY) { document.dispatchEvent(new CustomEvent('nh:flags')); NH.renderPanel && NH.renderPanel(); }
  });

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
  NH.sendState = function (s) { var t = appTargets(); if (!t.length) return NH.toast('Screen states work on app screens. Pick one from "Go to screen".'); t.forEach(function (a) { a.setState(s); }); };
  NH.sendAction = function (n) { var t = appTargets(); if (!t.length) return NH.toast('Open an app screen to use demo actions.'); t.forEach(function (a) { a.action(n); }); };
  NH.goScreen = function (route) { if (window.NHApp) { location.hash = '#/' + route; return; } if (NH.onGoScreen) return NH.onGoScreen(route); location.href = 'app.html#/' + route; };

  var panelOpen = false, lastFocus = null;
  NH.renderPanel = function () {
    var panel = document.getElementById('opt-panel'); if (!panel) return;
    var o = NH.opts, f = NH.flags(), isApp = !!window.NHApp || !!document.querySelector('iframe[data-app]');
    var h = '<header><b>' + NH.icon('sliders', 'icon-sm') + ' Design options</b><span class="mock-tag">Mock-up control</span><button class="opt-close" type="button" data-close aria-label="Close design options">' + NH.icon('x', 'icon-sm') + '</button></header><div class="opt-body">';
    h += '<div class="opt-group"><div class="opt-title">Design system <small>chosen 11 Oct</small></div><p class="opt-note" style="margin:0">Peacock colours · Plus Jakarta Sans · soft corners · floating tab bar (side menu on tablets). Fixed for every module.</p><p class="opt-note" style="margin:.4rem 0 0"><b>Module 5 decisions (11 Oct):</b> Cash / UPI / Card · cancel = owners, same day · warn under half the store price · no selling without internet.</p></div>';
    NH.OPTIONS.forEach(function (d) {
      h += '<div class="opt-group" role="group" aria-label="' + d.title + '"><div class="opt-title">' + d.title + (d.isNew ? ' <small>new</small>' : '') + '</div><div class="opt-row">';
      d.choices.forEach(function (c) { h += '<button type="button" data-opt="' + d.key + '" data-val="' + c[0] + '" aria-pressed="' + (o[d.key] === c[0]) + '">' + c[1] + ' · ' + c[2] + '</button>'; });
      h += '</div></div>';
    });
    h += '<div class="opt-group"><button type="button" class="opt-btn opt-copy" data-copy>' + NH.icon('copy', 'icon-sm') + ' Copy my choices</button></div>';
    h += '<div class="opt-group"><div class="opt-title"><label for="opt-go">Go to screen</label></div><select id="opt-go"><option value="">Choose a screen…</option>';
    NH_GROUPS.forEach(function (g) { h += '<optgroup label="' + g.title + '">'; NH_SCREENS.filter(function (s) { return s.group === g.id; }).forEach(function (s) { h += '<option value="' + NH_ROUTE(s) + '">' + s.title + '</option>'; }); h += '</optgroup>'; });
    h += '</select><p class="opt-note"><a href="index.html">Start page</a> · <a href="../module-1-sign-in/kit.html">Design kit</a> · <a href="preview.html">Device preview</a></p></div>';
    h += '<div class="opt-group"><div class="opt-title">Screen states <small>for the open screen</small></div><div class="opt-row">';
    [['normal', 'Normal'], ['loading', 'Loading'], ['empty', 'Empty'], ['error', 'Error'], ['success', 'Success'], ['warning', 'Warning'], ['popup', 'Pop-up']].forEach(function (s) { h += '<button type="button" data-state="' + s[0] + '">' + s[1] + '</button>'; });
    h += '</div></div>';
    if (isApp) {
      h += '<div class="opt-group"><div class="opt-title">View the app as <small>sample data</small></div><div class="opt-row">' +
        '<button type="button" data-flag="viewAs" data-val="owner" aria-pressed="' + (f.viewAs === 'owner') + '">Lakshmi · Owner</button>' +
        '<button type="button" data-flag="viewAs" data-val="staff" aria-pressed="' + (f.viewAs === 'staff') + '">Ravi · Staff</button></div>' +
        '<div class="opt-row" style="margin-top:.35rem"><button type="button" data-flag="platform" data-val="android" aria-pressed="' + (f.platform === 'android') + '">Android</button><button type="button" data-flag="platform" data-val="ios" aria-pressed="' + (f.platform === 'ios') + '">iPhone</button></div>' +
        '<div class="opt-row" style="margin-top:.35rem"><button type="button" data-toggle="offline" aria-pressed="' + f.offline + '">No internet</button><button type="button" data-action="reset">Reset demo</button></div>' +
        '<p class="opt-note">Sarees, tags, prices and photos are the shop\'s real data (copy of 11 Oct); customers, order numbers and today\'s sales are sample. Changes stay in this browser.</p></div>';
    }
    panel.innerHTML = h + '</div>';
  };
  function copyChoices() {
    var lines = ['Nandam Handlooms admin app: Module 5 (Scan to sell) mock-up choices'];
    NH.OPTIONS.forEach(function (d) { var c = d.choices.filter(function (x) { return x[0] === NH.opts[d.key]; })[0]; lines.push(d.title + ': ' + c[1] + ' (' + c[2] + ')'); });
    var text = lines.join('\n');
    function done() { NH.toast('Copied. Paste it back in the chat.'); }
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { prompt('Copy your choices:', text); } ta.remove(); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function openPanel(open) {
    var panel = document.getElementById('opt-panel'), fab = document.getElementById('opt-fab'); if (!panel) return;
    panelOpen = open; panel.classList.toggle('is-open', open); fab.setAttribute('aria-expanded', String(open));
    if (open) { lastFocus = document.activeElement; var b = panel.querySelector('button[aria-pressed="true"]') || panel.querySelector('button'); b && b.focus(); } else if (lastFocus) lastFocus.focus();
  }
  function initShell() {
    if (document.body.classList.contains('embed')) return;
    var fab = document.createElement('button'); fab.id = 'opt-fab'; fab.className = 'opt-fab'; fab.type = 'button'; fab.setAttribute('aria-controls', 'opt-panel'); fab.setAttribute('aria-expanded', 'false'); fab.innerHTML = NH.icon('sliders', 'icon-sm') + ' Design options';
    var panel = document.createElement('div'); panel.id = 'opt-panel'; panel.className = 'opt-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Design options (mock-up control)');
    document.body.appendChild(panel); document.body.appendChild(fab); NH.renderPanel();
    fab.addEventListener('click', function () { openPanel(!panelOpen); });
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) return openPanel(false);
      if (b.dataset.opt) return NH.setOption(b.dataset.opt, b.dataset.val);
      if (b.hasAttribute('data-copy')) return copyChoices();
      if (b.dataset.state) return NH.sendState(b.dataset.state);
      if (b.dataset.flag) return NH.setFlag(b.dataset.flag, b.dataset.val);
      if (b.dataset.toggle) return NH.setFlag(b.dataset.toggle, !NH.flags()[b.dataset.toggle]);
      if (b.dataset.action) { if (b.dataset.action === 'reset') { write(FLAG_KEY, FLAG_DEFAULTS); document.dispatchEvent(new CustomEvent('nh:flags')); } return NH.sendAction(b.dataset.action); }
    });
    panel.addEventListener('change', function (e) { if (e.target.id === 'opt-go' && e.target.value) { NH.goScreen(e.target.value); e.target.value = ''; } });
    var mb = document.querySelector('[data-menu-btn]'), nav = document.querySelector('.site-nav');
    if (mb && nav) mb.addEventListener('click', function () { var o = !nav.classList.contains('is-open'); nav.classList.toggle('is-open', o); mb.setAttribute('aria-expanded', String(o)); });
    document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; if (panelOpen) openPanel(false); if (nav && nav.classList.contains('is-open')) { nav.classList.remove('is-open'); mb && mb.setAttribute('aria-expanded', 'false'); } });
    var els = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } }); }, { threshold: .08 }); els.forEach(function (el) { io.observe(el); }); } else els.forEach(function (el) { el.classList.add('is-visible'); });
    document.querySelectorAll('i[data-icon]').forEach(function (i) { i.outerHTML = NH.icon(i.dataset.icon, i.className); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initShell); else initShell();
})();
