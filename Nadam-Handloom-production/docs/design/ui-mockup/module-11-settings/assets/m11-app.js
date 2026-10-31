/* Module 11 (Settings): the clickable app.
   The saved settings and shop details are the shop's real values (copy of 11 Oct 2026);
   phones and versions are sample. The pretend server follows the plan: owners only,
   maintenance asks first, Require this version from an updated phone, GSTIN checked,
   new invoices only, every change logged. */
(function () {
  'use strict';
  var NH = window.NH;
  var EMBED = /[?&]embed=1/.test(location.search);
  var DEMO_KEY = 'nh-m11-demo';
  var THIS_BUILD = { android: 26, ios: 7 };
  var OLD_PHONES = { android: [['Ravi\'s Redmi', 25], ['Anil\'s Galaxy', 25]], ios: [['Shop iPad', 6]] };
  var GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

  function fresh() {
    return {
      staff: { on: false, message: '', since: null, by: null },
      web: { on: false, message: '', since: null, by: null },
      android: { newest: 23, oldest: 0, required: false, link: '' },
      ios: { newest: 3, oldest: 0, required: false, link: '' },
      shop: { name: 'Nandam Handlooms', address: 'Hussain Katta, Mangalagiri, Andhra Pradesh 522503', mobile: '9494170180', gstin: '37CCWPN2487C1Z2', website: '' },
      last: { maint: 'Never changed', updates: '4 Oct 2026 · person not recorded', shop: 'Server setting · not changed in the app yet' },
      owners: 5, log: [], bannerHidden: false
    };
  }
  var demo = load();
  function load() { try { var d = JSON.parse(sessionStorage.getItem(DEMO_KEY)); if (d && d.shop) return d; } catch (e) { } return fresh(); }
  function save() { try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch (e) { } }
  function flags() { return NH.flags(); }
  function owner() { return flags().viewAs !== 'staff'; }
  function plat() { return ui.plat || (flags().platform === 'ios' ? 'ios' : 'android'); }
  function now() { return '12 Oct, 3:10 pm'; }
  function logIt(text) { demo.log.unshift(text); }

  /* ================= Helpers ================= */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(n, c) { return NH.icon(n, c); }
  function topBar(title, back, right) { return '<div class="scr-top">' + (back ? '<button class="icon-btn" type="button" data-go="' + back + '" aria-label="Back">' + icon('back') + '</button>' : '<span style="width:12px"></span>') + '<h1>' + (title || '') + '</h1>' + (right || '') + '</div>'; }
  function alertBox(type, title, text, ic, extra) { var map = { info: 'info', success: 'check', warning: 'alert', error: 'alertc' }; return '<div class="alert alert-' + type + '" role="' + (type === 'error' ? 'alert' : 'status') + '">' + icon(ic || map[type]) + '<div>' + (title ? '<strong>' + title + '</strong>' : '') + (text ? '<p>' + text + '</p>' : '') + (extra || '') + '</div></div>'; }
  function emptyCard(ic, title, text) { return '<div class="ph-tile" style="min-height:130px;align-items:center;justify-content:center;text-align:center;gap:.4rem">' + icon(ic, 'icon-xl') + '<b>' + title + '</b><span>' + text + '</span></div>'; }
  function sw(attr, on, label) { return '<button type="button" class="switch' + (on ? ' on' : '') + '" role="switch" aria-checked="' + on + '" aria-label="' + label + '" ' + attr + '><span></span></button>'; }
  function last(t) { return '<p class="last-changed">' + icon('history', 'icon-sm') + 'Last changed: ' + esc(t) + '</p>'; }
  function mobileText(m) { return '+91 ' + m.slice(0, 5) + ' ' + m.slice(5); }

  /* ================= Overlays ================= */
  var overlays, root, viewport, closers = [];
  function addOverlay(html) { var d = document.createElement('div'); d.innerHTML = html; var el = d.firstElementChild; overlays.appendChild(el); return el; }
  function toast(msg, ok) { var old = overlays.querySelector('.app-toast'); if (old) old.remove(); var t = addOverlay('<div class="app-toast' + (ok ? ' ok' : '') + '" role="status">' + icon(ok ? 'check' : 'info') + esc(msg) + '</div>'); setTimeout(function () { t.remove(); }, 2800); }
  function sheet(html, onMount) {
    var el = addOverlay('<div class="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div></div>');
    function close() { el.remove(); closers = closers.filter(function (c) { return c !== close; }); }
    closers.push(close);
    el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-close]')) close(); });
    onMount && onMount(el, close);
    return close;
  }

  /* ================= Router ================= */
  var current = { name: '', params: {} }, state = 'normal', stack = [], ui = {};
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), q = h.split('?'), p = {};
    (q[1] || '').split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); p[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
    return { name: q[0] || 'settings', params: p };
  }
  function go(route) { if (('#/' + route) === location.hash) render(); else location.hash = '#/' + route; }
  function back() { if (stack.length > 1) history.back(); else go('settings'); }
  function onRoute() {
    var r = parse(), h = location.hash;
    if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop(); else if (stack[stack.length - 1] !== h) stack.push(h);
    if (r.name !== current.name || JSON.stringify(r.params) !== JSON.stringify(current.params)) { state = 'normal'; ui.draft = null; }
    current = r;
    var want = r.params.as === 'staff' ? 'staff' : (r.params.as === 'owner' ? 'owner' : null);
    if (want && flags().viewAs !== want) NH.setFlag('viewAs', want, true);
    demo.owners = r.params.demo === 'oneowner' ? 1 : (demo.owners === 1 ? 5 : demo.owners);
    render();
    if (r.params.demo === 'maint' && owner()) confirmStaff(true);
    document.dispatchEvent(new CustomEvent('nh:route', { detail: { name: r.name, params: Object.assign({}, r.params) } }));
  }

  /* ================= Shell ================= */
  var TABS = [['home', 'home', 'Home'], ['orders', 'orders', 'Orders'], ['scan', 'scan', 'Scan'], ['products', 'box', 'Products'], ['more', 'more', 'More']];
  function shell(inner, cur) {
    cur = cur || 'more';
    var tabs = TABS.map(function (t) {
      if (t[0] === 'scan') return '<button type="button" class="scan-tab" data-tab="scan" aria-label="Scan"><span class="scan-ico">' + icon('scan') + '</span></button>';
      return '<button type="button" data-tab="' + t[0] + '"' + (t[0] === cur ? ' aria-current="page"' : '') + '>' + icon(t[1]) + t[2] + '</button>';
    }).join('');
    var rail = '<nav class="rail" aria-label="Main menu"><img src="assets/logo.png" alt="Nandam Handlooms">' + TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '"' + (t[0] === cur ? ' aria-current="page"' : '') + '>' + icon(t[1]) + t[2] + '</button>'; }).join('') + '</nav>';
    var bar = flags().offline ? '<div class="saved-bar">' + icon('wifioff') + 'Offline · Settings needs internet.</div>' : '';
    return '<div class="shell">' + rail + '<div class="shell-main">' + bar + inner + '</div><nav class="tabbar" aria-label="Main menu">' + tabs + '</nav></div>';
  }

  /* ================= Saving (pick B keeps a draft) ================= */
  function B() { return NH.opts.saving === 'b'; }
  function cfg() { if (B()) { if (!ui.draft) ui.draft = JSON.parse(JSON.stringify(demo)); return ui.draft; } return demo; }
  // The settings an action changes: the draft (pick B) or a copy saved at once (pick A).
  function work() { return B() ? cfg() : JSON.parse(JSON.stringify(demo)); }
  function dirty() { return B() && ui.draft && JSON.stringify(pick(ui.draft)) !== JSON.stringify(pick(demo)); }
  function pick(d) { return { staff: [d.staff.on, d.staff.message], web: [d.web.on, d.web.message], android: d.android, ios: d.ios }; }
  function apply(from) {
    var turnedOn = from.staff.on && !demo.staff.on, webOn = from.web.on && !demo.web.on;
    if (from.staff.on !== demo.staff.on) { logIt('Lakshmi ' + (from.staff.on ? 'paused' : 'resumed') + ' the staff app'); from.staff.since = from.staff.on ? now() : null; from.staff.by = from.staff.on ? 'Lakshmi' : null; demo.last.maint = 'Lakshmi, ' + now(); }
    if (from.web.on !== demo.web.on) { logIt('Lakshmi ' + (from.web.on ? 'paused' : 'resumed') + ' the website'); from.web.since = from.web.on ? now() : null; from.web.by = from.web.on ? 'Lakshmi' : null; demo.last.maint = 'Lakshmi, ' + now(); }
    if (JSON.stringify(from.android) !== JSON.stringify(demo.android) || JSON.stringify(from.ios) !== JSON.stringify(demo.ios)) { logIt('Lakshmi changed the app update settings'); demo.last.updates = 'Lakshmi, ' + now(); }
    demo.staff = from.staff; demo.web = from.web; demo.android = from.android; demo.ios = from.ios;
    ui.draft = null; save();
    return turnedOn || webOn;
  }

  /* ================= Sections ================= */
  function maintSection() {
    var c = cfg();
    function row(key, title, who) {
      var m = c[key];
      return '<div class="set-row"><div class="grow"><b>' + title + '</b><span>' + (m.on ? '<em class="on-pill">On</em> since ' + esc(m.since || 'now') + (m.by ? ', by ' + esc(m.by) : '') : who) + '</span></div>' + sw('data-switch="' + key + '"', m.on, title) + '</div>' +
        (m.on || ui['edit-' + key] ? '<div class="msg-field"><label class="field-label" for="msg-' + key + '">Message</label><textarea id="msg-' + key + '" class="input" rows="2" maxlength="300" data-msg="' + key + '" placeholder="' + (key === 'staff' ? 'Updating prices, back at 6 pm' : 'Our website is being updated. Please come back soon.') + '">' + esc(m.message) + '</textarea><div class="msg-foot"><span class="field-hint">' + (m.message.length) + '/300</span>' + (!B() ? '<button type="button" class="btn btn-sm" data-savemsg="' + key + '">Save message</button>' : '') + '</div></div>' : '');
    }
    return '<section class="set-card" data-sec="maint"><h2>' + icon('alert', 'icon-sm') + 'Maintenance</h2>' +
      row('staff', 'Staff app', 'Off · staff work normally') + row('web', 'Website', 'Off · customers shop normally') +
      '<p class="field-hint">Owners keep working while the staff app is paused; the server refuses staff too.</p>' + last(demo.last.maint) + '</section>';
  }
  function updatesSection() {
    var c = cfg(), p = plat(), u = c[p], mine = THIS_BUILD[p];
    var behind = mine > u.newest;
    return '<section class="set-card" data-sec="updates"><h2>' + icon('download', 'icon-sm') + 'App updates</h2>' +
      '<div class="seg2" role="tablist"><button type="button" role="tab" data-plat="android" aria-selected="' + (p === 'android') + '">Android</button><button type="button" role="tab" data-plat="ios" aria-selected="' + (p === 'ios') + '">iPhone</button></div>' +
      '<div class="ver-grid"><div><small>This phone</small><b>2.0.0 (' + mine + ')</b></div><div><small>Newest</small><b>' + u.newest + '</b></div><div><small>Oldest allowed</small><b>' + (u.oldest || 'any') + '</b></div></div>' +
      (behind ? '<p class="field-hint warn-text">' + icon('alert', 'icon-sm') + 'This phone (' + mine + ') is newer than the saved newest version (' + u.newest + ').</p>' : '') +
      '<div class="btn-stack"><button type="button" class="btn btn-sm btn-block" data-tell>' + icon('sparkle', 'icon-sm') + 'Tell phones a new version is available</button>' +
      '<button type="button" class="btn btn-sm btn-block btn-danger-soft" data-require>' + icon('download', 'icon-sm') + 'Require this version (' + mine + ') for everyone</button></div>' +
      '<button type="button" class="link-btn adv-toggle" data-adv aria-expanded="' + !!ui.adv + '">' + (ui.adv ? 'Hide' : 'Show') + ' advanced</button>' +
      (ui.adv ? '<div class="adv"><label class="field-label">Newest version<input class="input" type="number" min="0" data-num="newest" value="' + u.newest + '"></label><label class="field-label">Oldest allowed<input class="input" type="number" min="0" data-num="oldest" value="' + u.oldest + '"></label>' +
        '<div class="set-row"><div class="grow"><b>Update required</b><span>Phones below the newest must update</span></div>' + sw('data-required', u.required, 'Update required') + '</div>' +
        '<label class="field-label">Store link<input class="input" type="url" data-link placeholder="' + (p === 'android' ? 'https://play.google.com/store/apps/details?id=com.nandamhandlooms.staff' : 'https://testflight.apple.com/…') + '" value="' + esc(u.link) + '"></label><p class="field-error" data-adverr hidden></p>' +
        (!B() ? '<button type="button" class="btn btn-sm" data-saveadv>Save</button>' : '') + '</div>' : '') +
      last(demo.last.updates) + '</section>';
  }
  function shopSection() {
    var s = demo.shop;
    return '<section class="set-card" data-sec="shop"><h2>' + icon('store', 'icon-sm') + 'Shop details</h2>' +
      '<dl class="facts-list"><div><dt>Name</dt><dd>' + esc(s.name) + '</dd></div><div><dt>Address</dt><dd>' + esc(s.address) + '</dd></div><div><dt>Mobile</dt><dd>' + mobileText(s.mobile) + '</dd></div><div><dt>GSTIN</dt><dd>' + esc(s.gstin) + '</dd></div><div><dt>Website</dt><dd>' + (s.website ? esc(s.website) : '<span class="warn-text">Not set: WhatsApp messages go without product links</span>') + '</dd></div></dl>' +
      '<button type="button" class="btn btn-sm" data-go="shop">' + icon('edit', 'icon-sm') + 'Edit shop details</button>' + last(demo.last.shop) + '</section>';
  }
  var RULES = [['A warning when a saree is sold under', 'half its store price'], ['Running low', '1 to 3 sarees left in a design'], ['Check delivery', '10 days after shipping'], ['Unpaid website checkouts', 'kept 30 days (Home shows 7)'], ['Signed in on a phone', '7 days, renewed each time the app is used'], ['Sarees in stock', 'up to 5,000'], ['Activity log', 'sign-ins 1 year; everything else for years']];
  function rulesSection() {
    return '<section class="set-card" data-sec="rules"><h2>' + icon('list', 'icon-sm') + 'Shop rules</h2><dl class="facts-list">' + RULES.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl><p class="field-hint">Fixed, so nothing breaks by accident. Ask, and a rule can become a setting.</p></section>';
  }
  function aboutSection() {
    var one = demo.owners < 2;
    return '<section class="set-card" data-sec="about"><h2>' + icon('info', 'icon-sm') + 'About</h2>' +
      (one ? alertBox('warning', 'Only 1 owner can sign in', 'If that owner loses their phone number, nobody can get back in. Add a second owner in Team.', null, '<button type="button" class="btn btn-sm" data-team style="margin-top:.5rem">' + icon('userplus', 'icon-sm') + 'Open Team</button>') : '') +
      '<dl class="facts-list"><div><dt>This phone</dt><dd>Nandam Admin 2.0.0 (build ' + THIS_BUILD[plat()] + ')</dd></div><div><dt>Server</dt><dd>2.0.0 · connected</dd></div><div><dt>Owners who can sign in</dt><dd>' + demo.owners + '</dd></div><div><dt>Lost phone number</dt><dd>Another owner removes the old number and invites the new one</dd></div></dl>' +
      '<button type="button" class="btn btn-sm" data-activity>' + icon('history', 'icon-sm') + 'Settings changes in Activity</button>' +
      (demo.log.length ? '<ul class="mini-log">' + demo.log.slice(0, 4).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '') + '</section>';
  }
  var SECTIONS = { maint: ['Maintenance', 'alert', maintSection], updates: ['App updates', 'download', updatesSection], rules: ['Shop rules', 'list', rulesSection], about: ['About', 'info', aboutSection] };
  function rowStatus(id) {
    if (id === 'maint') return demo.staff.on ? '<em class="on-pill">Staff app paused</em>' : demo.web.on ? '<em class="on-pill">Website paused</em>' : 'Off';
    if (id === 'updates') return 'Android ' + demo.android.newest + ' · iPhone ' + demo.ios.newest + (demo.android.oldest || demo.ios.oldest ? ' · update required' : '');
    if (id === 'shop') return esc(demo.shop.name) + ' · GSTIN ' + esc(demo.shop.gstin);
    if (id === 'rules') return 'Fixed numbers the app uses';
    return 'Versions, owners';
  }
  function saveBar() {
    if (!B()) return '';
    var d = dirty();
    return '<div class="save-bar' + (d ? ' on' : '') + '"><span>' + (d ? icon('alert', 'icon-sm') + 'Unsaved changes' : 'No changes') + '</span><span class="err" data-saveerr></span><button type="button" class="btn btn-primary btn-sm" data-saveall' + (d ? '' : ' disabled') + '>Save</button></div>';
  }

  /* ================= Screens ================= */
  var S = {};
  function locked(title) { return { html: '<section class="scr">' + topBar(title, 'more') + '<div class="scr-body narrow">' + emptyCard('lock', 'For owners', 'Settings can pause the app and require updates, so it is for owners.') + '</div></section>' }; }
  S.settings = function () {
    if (!owner()) return locked('Settings');
    if (state === 'loading') return { html: '<section class="scr">' + topBar('Settings', 'more') + '<div class="scr-body narrow"><div class="skeleton" style="height:150px;border-radius:18px;margin-bottom:12px"></div><div class="skeleton" style="height:200px;border-radius:18px"></div></div></section>' };
    if (state === 'error') return { html: '<section class="scr">' + topBar('Settings', 'more') + '<div class="scr-body narrow">' + alertBox('error', 'Couldn\'t load Settings', 'Check the internet and try again.', null, '<button type="button" class="btn btn-sm" data-retry style="margin-top:.5rem">' + icon('refresh', 'icon-sm') + 'Retry</button>') + '</div></section>', mount: mountAll };
    var body;
    if (NH.opts.layout === 'b') {
      body = '<div class="list">' + [['maint', 'alert', 'Maintenance'], ['updates', 'download', 'App updates'], ['shop', 'store', 'Shop details'], ['rules', 'list', 'Shop rules'], ['about', 'info', 'About']].map(function (r) {
        return '<button type="button" class="row" data-go="' + (r[0] === 'shop' ? 'shop' : r[0]) + '"><span class="tile">' + icon(r[1]) + '</span><span class="grow"><b>' + r[2] + '</b><span>' + rowStatus(r[0]) + '</span></span>' + icon('right', 'chev') + '</button>';
      }).join('') + '</div>';
    } else body = '<div class="set-grid">' + maintSection() + updatesSection() + shopSection() + rulesSection() + aboutSection() + '</div>';
    return { html: '<section class="scr">' + topBar('Settings', 'more') + '<div class="scr-body narrow' + (NH.opts.layout === 'b' ? '' : ' wide') + '">' + body + '</div>' + (NH.opts.layout === 'b' ? '' : saveBar()) + '</section>', mount: mountAll };
  };
  ['maint', 'updates', 'rules', 'about'].forEach(function (id) {
    S[id] = function () {
      if (!owner()) return locked(SECTIONS[id][0]);
      return { html: '<section class="scr">' + topBar(SECTIONS[id][0], 'settings') + '<div class="scr-body narrow">' + SECTIONS[id][2]() + '</div>' + (id === 'maint' || id === 'updates' ? saveBar() : '') + '</section>', mount: mountAll, full: true };
    };
  });
  S.shop = function () {
    if (!owner()) return locked('Shop details');
    var f = ui.shop || (ui.shop = JSON.parse(JSON.stringify(demo.shop)));
    var errs = ui.shopErr || {};
    function field(key, label, attrs, hint) {
      return '<div class="field"><label class="field-label" for="f-' + key + '">' + label + '</label>' + (key === 'address' ? '<textarea id="f-' + key + '" class="input" rows="2" data-f="address">' + esc(f[key]) + '</textarea>' : '<input id="f-' + key + '" class="input" data-f="' + key + '" ' + (attrs || '') + ' value="' + esc(f[key]) + '">') + (errs[key] ? '<p class="field-error" role="alert">' + errs[key] + '</p>' : hint ? '<p class="field-hint">' + hint + '</p>' : '') + '</div>';
    }
    var preview = previewHtml(f);
    return {
      html: '<section class="scr">' + topBar('Shop details', 'settings') + '<div class="scr-body narrow">' +
        field('name', 'Shop name', 'maxlength="60"') + field('address', 'Address') + field('mobile', 'Mobile', 'inputmode="numeric" maxlength="10"', '10 digits, printed with +91') +
        field('gstin', 'GSTIN', 'maxlength="15" autocapitalize="characters"', '15 characters, like 37CCWPN2487C1Z2') + field('website', 'Website address', 'type="url" placeholder="https://nandamhandlooms.com"', 'Used for product links in WhatsApp messages') +
        '<div class="list-title">Invoice letterhead preview</div>' + preview +
        '<p class="field-hint">New invoices use these details. Invoices already made keep theirs.</p></div>' +
        '<div class="scr-foot">' + (Object.keys(errs).length ? '<p class="field-error" role="alert" style="margin:0">Fix the ' + Object.keys(errs).map(function (k) { return { name: 'shop name', address: 'address', mobile: 'mobile', gstin: 'GSTIN', website: 'website address' }[k]; }).join(' and ') + ' above.</p>' : '') + '<button type="button" class="btn btn-primary btn-block" data-saveshop>Save shop details</button></div></section>',
      full: true,
      mount: function (el) {
        el.querySelectorAll('[data-f]').forEach(function (i) { i.addEventListener('input', function () { f[i.dataset.f] = i.dataset.f === 'gstin' ? i.value.toUpperCase() : i.value; if (i.dataset.f === 'gstin') i.value = f.gstin; var lh = el.querySelector('.letterhead'); if (lh) lh.outerHTML = previewHtml(f); }); });
        el.querySelector('[data-saveshop]').addEventListener('click', function () {
          var e = {};
          if (f.name.trim().length < 2) e.name = 'Type the shop name.';
          if (f.address.trim().length < 10) e.address = 'Type the full address.';
          if (!/^\d{10}$/.test(f.mobile)) e.mobile = 'Type 10 digits.';
          if (!GSTIN.test(f.gstin)) e.gstin = 'That doesn\'t look like a GSTIN: 15 characters, like 37CCWPN2487C1Z2.';
          if (f.website && !/^https:\/\/[^\s.]+\.[^\s]+$/.test(f.website)) e.website = 'Start with https://, like https://nandamhandlooms.com';
          ui.shopErr = e;
          if (Object.keys(e).length) return render();
          var changed = Object.keys(f).filter(function (k) { return f[k] !== demo.shop[k]; });
          demo.shop = JSON.parse(JSON.stringify(f)); ui.shop = null;
          if (changed.length) { demo.last.shop = 'Lakshmi, ' + now(); logIt('Lakshmi changed the shop details: ' + changed.join(', ')); }
          save(); go('settings'); setTimeout(function () { toast(changed.length ? 'Saved. New invoices use these details.' : 'Nothing changed', true); }, 200);
        });
      }
    };
  };
  function previewHtml(f) {
    return '<div class="letterhead"><img src="assets/logo.png" alt=""><div><b>' + esc(f.name || '—') + '</b><span>' + esc(f.address || '—') + '</span><span>Mobile: ' + (/^\d{10}$/.test(f.mobile) ? mobileText(f.mobile) : esc(f.mobile)) + ' · GSTIN: ' + esc(f.gstin) + '</span></div><em>TAX INVOICE</em></div>';
  }
  function staffScreen(kind) {
    var m = demo.staff.message || 'We are making changes. Please wait a little.';
    if (kind === 'maint') return '<section class="scr gate"><div class="gate-body"><img src="assets/logo.png" alt=""><span class="gate-ico">' + icon('clock') + '</span><h1>Under maintenance</h1><p class="gate-msg">' + esc(m) + '</p><p class="field-hint">Your work on this phone is kept. The app checks again by itself every minute.</p><button type="button" class="btn btn-primary btn-block" data-again>Try again</button><button type="button" class="btn btn-block" data-logout>Log out</button></div></section>';
    var p = plat(), u = demo[p], need = Math.max(u.oldest, u.required ? u.newest : 0) || THIS_BUILD[p];
    return '<section class="scr gate"><div class="gate-body"><img src="assets/logo.png" alt=""><span class="gate-ico">' + icon('download') + '</span><h1>Update required</h1><p class="gate-msg">This phone has version 2.0.0 (' + (THIS_BUILD[p] - 1) + '). Version ' + need + ' or later is needed to keep working.</p><button type="button" class="btn btn-primary btn-block" data-update>' + (p === 'ios' ? 'Open TestFlight' : 'Update in Play Store') + '</button><button type="button" class="btn btn-block" data-again>Check again</button></div></section>';
  }
  S['staff-maint'] = function () { return { html: staffScreen('maint'), full: true, mount: mountGate }; };
  S['staff-update'] = function () { return { html: staffScreen('update'), full: true, mount: mountGate }; };
  S['staff-banner'] = function () {
    return {
      cur: 'home',
      html: '<section class="scr">' + (demo.bannerHidden ? '' : '<div class="new-ver">' + icon('sparkle', 'icon-sm') + '<span>A new version is available.</span><button type="button" class="link-btn" data-update>Update</button><button type="button" class="link-btn muted" data-later>Later</button></div>') +
        '<div class="scr-body"><div class="home-head"><span class="avatar">RK</span><div style="flex:1"><h1>Good evening, Ravi</h1><p>Mon 12 Oct · Updated just now</p></div></div><div class="ph-tile" style="min-height:120px"><b>Home (Module 8)</b><span>The banner sits on top of every screen until the phone updates or "Later" is tapped (hidden for a day).</span></div></div></section>',
      mount: mountGate
    };
  };
  function mountGate(el) {
    el.querySelectorAll('[data-again]').forEach(function (b) { b.addEventListener('click', function () { toast(demo.staff.on ? 'Still under maintenance' : 'Checked: you can work again', !demo.staff.on); }); });
    el.querySelectorAll('[data-update]').forEach(function (b) { b.addEventListener('click', function () { toast('Opens the store page (pretend)'); }); });
    var l = el.querySelector('[data-logout]'); l && l.addEventListener('click', function () { toast('Logs out (pretend)'); });
    var lt = el.querySelector('[data-later]'); lt && lt.addEventListener('click', function () { demo.bannerHidden = true; save(); render(); toast('Hidden for a day'); });
  }

  /* ================= Actions ================= */
  function confirmStaff(on) {
    var c = work();
    if (!on) {
      sheet('<h2 class="sheet-title">Resume the staff app?</h2><p>Staff can sell and ship again straight away.</p><div class="sheet-actions"><button type="button" class="btn btn-primary btn-block" data-yes>Resume</button><button type="button" class="btn btn-block" data-close>Cancel</button></div>', function (el, close) {
        el.querySelector('[data-yes]').addEventListener('click', function () { c.staff.on = false; close(); if (!B()) { apply(c); toast('Staff app resumed', true); } render(); });
      });
      return;
    }
    sheet('<h2 class="sheet-title">Pause the staff app?</h2><p>Staff will see your message and can\'t sell or ship until you turn it off. <b>Owners keep working.</b></p><label class="field-label" for="pause-msg">Message for staff</label><textarea id="pause-msg" class="input" rows="2" maxlength="300" placeholder="Updating prices, back at 6 pm">' + esc(c.staff.message) + '</textarea><div class="sheet-actions"><button type="button" class="btn btn-danger btn-block" data-yes>Pause the staff app</button><button type="button" class="btn btn-block" data-close>Cancel</button></div>', function (el, close) {
      el.querySelector('[data-yes]').addEventListener('click', function () { c.staff.on = true; c.staff.message = el.querySelector('#pause-msg').value.slice(0, 300); close(); if (!B()) { apply(c); toast('Staff app paused. Staff phones switch within a minute.', true); } render(); });
    });
  }
  function confirmWeb(on) {
    var c = work();
    sheet('<h2 class="sheet-title">' + (on ? 'Pause the website?' : 'Open the website again?') + '</h2><p>' + (on ? 'Customers see your message instead of the shop.' : 'Customers can shop again straight away.') + '</p>' + (on ? '<label class="field-label" for="web-msg">Message for customers</label><textarea id="web-msg" class="input" rows="2" maxlength="300" placeholder="Our website is being updated. Please come back soon.">' + esc(c.web.message) + '</textarea>' : '') + '<div class="sheet-actions"><button type="button" class="btn btn-primary btn-block" data-yes>' + (on ? 'Pause the website' : 'Open the website') + '</button><button type="button" class="btn btn-block" data-close>Cancel</button></div>', function (el, close) {
      el.querySelector('[data-yes]').addEventListener('click', function () { c.web.on = on; if (on) c.web.message = el.querySelector('#web-msg').value.slice(0, 300); close(); if (!B()) { apply(c); toast(on ? 'Website paused' : 'Website open again', true); } render(); });
    });
  }
  function confirmRequire() {
    var p = plat(), mine = THIS_BUILD[p], old = OLD_PHONES[p];
    sheet('<h2 class="sheet-title">Require version ' + mine + ' for everyone?</h2>' + alertBox('warning', plural(old.length, 'phone') + ' signed in this week ' + (old.length === 1 ? 'uses' : 'use') + ' an older version', old.map(function (x) { return esc(x[0]) + ' (' + x[1] + ')'; }).join(', ') + '. They must update before they can be used.') + '<p class="field-hint">Make sure version ' + mine + ' is in the ' + (p === 'ios' ? 'TestFlight' : 'Play Store') + ' first.</p><div class="sheet-actions"><button type="button" class="btn btn-danger btn-block" data-yes>Require version ' + mine + '</button><button type="button" class="btn btn-block" data-close>Cancel</button></div>', function (el, close) {
      el.querySelector('[data-yes]').addEventListener('click', function () { var c = work(); c[p].oldest = mine; c[p].newest = Math.max(c[p].newest, mine); close(); if (!B()) { apply(c); toast('Version ' + mine + ' required. Older phones show "Update required".', true); } render(); });
    });
  }
  // Pick B: show "Unsaved changes" without redrawing (typing keeps its place).
  function markDirty() {
    var bar = viewport.querySelector('.save-bar'); if (!bar || !dirty()) return;
    bar.classList.add('on'); bar.firstElementChild.innerHTML = icon('alert', 'icon-sm') + 'Unsaved changes';
    var b = bar.querySelector('[data-saveall]'); if (b) b.disabled = false;
  }
  function plural(n, a) { return n + ' ' + (n === 1 ? a : a + 's'); }
  function mountAll(el) {
    var r = el.querySelector('[data-retry]'); r && r.addEventListener('click', function () { state = 'normal'; render(); });
    el.querySelectorAll('[data-switch]').forEach(function (b) { b.addEventListener('click', function () { var k = b.dataset.switch, on = !cfg()[k].on; if (k === 'staff') confirmStaff(on); else confirmWeb(on); }); });
    el.querySelectorAll('[data-msg]').forEach(function (t) { t.addEventListener('input', function () { cfg()[t.dataset.msg].message = t.value.slice(0, 300); var c = t.parentNode.querySelector('.field-hint'); if (c) c.textContent = t.value.length + '/300'; if (B()) markDirty(); }); });
    el.querySelectorAll('[data-savemsg]').forEach(function (b) { b.addEventListener('click', function () { demo.last.maint = 'Lakshmi, ' + now(); logIt('Lakshmi changed the ' + (b.dataset.savemsg === 'staff' ? 'staff' : 'website') + ' maintenance message'); save(); toast('Message saved', true); }); });
    el.querySelectorAll('[data-plat]').forEach(function (b) { b.addEventListener('click', function () { ui.plat = b.dataset.plat; render(); }); });
    var tell = el.querySelector('[data-tell]'); tell && tell.addEventListener('click', function () { var c = work(), p = plat(); c[p].newest = Math.max(c[p].newest, THIS_BUILD[p]); if (!B()) { apply(c); toast('Phones on older versions see "A new version is available"', true); } render(); });
    var rq = el.querySelector('[data-require]'); rq && rq.addEventListener('click', confirmRequire);
    var adv = el.querySelector('[data-adv]'); adv && adv.addEventListener('click', function () { ui.adv = !ui.adv; render(); });
    el.querySelectorAll('[data-num]').forEach(function (i) { i.addEventListener('change', function () { cfg()[plat()][i.dataset.num] = Math.max(0, parseInt(i.value || '0', 10)); render(); }); });
    var req = el.querySelector('[data-required]'); req && req.addEventListener('click', function () { var c = cfg(); c[plat()].required = !c[plat()].required; render(); });
    var lk = el.querySelector('[data-link]'); lk && lk.addEventListener('change', function () { cfg()[plat()].link = lk.value.trim(); render(); });
    var sa = el.querySelector('[data-saveadv]'); sa && sa.addEventListener('click', function () {
      var u = demo[plat()], err = el.querySelector('[data-adverr]');
      if (u.oldest > u.newest) { err.hidden = false; err.textContent = 'The oldest allowed can\'t be above the newest.'; return; }
      if (u.link && !/^https:\/\//.test(u.link)) { err.hidden = false; err.textContent = 'The store link must start with https://'; return; }
      demo.last.updates = 'Lakshmi, ' + now(); logIt('Lakshmi changed the app update settings'); save(); toast('Saved', true); render();
    });
    var all = viewport.querySelector('[data-saveall]'); all && all.addEventListener('click', function () {
      var d = ui.draft, p = plat(), e = viewport.querySelector('[data-saveerr]');
      if (d[p].oldest > d[p].newest) { e.textContent = 'Oldest allowed is above the newest (App updates).'; return; }
      if (d.staff.on && !demo.staff.on) {
        sheet('<h2 class="sheet-title">Save and pause the staff app?</h2><p>Staff will see your message and can\'t sell or ship. Owners keep working.</p><div class="sheet-actions"><button type="button" class="btn btn-danger btn-block" data-yes>Save</button><button type="button" class="btn btn-block" data-close>Cancel</button></div>', function (el2, close) {
          el2.querySelector('[data-yes]').addEventListener('click', function () { apply(d); close(); render(); toast('Saved', true); });
        });
        return;
      }
      apply(d); render(); toast('Saved', true);
    });
    var tm = el.querySelector('[data-team]'); tm && tm.addEventListener('click', function () { toast('Opens Team (Module 2)'); });
    var ac = el.querySelector('[data-activity]'); ac && ac.addEventListener('click', function () { toast('Opens Activity on Settings (Module 10)'); });
  }

  /* ================= Render ================= */
  function render() {
    closers = [];
    Array.prototype.slice.call(overlays.children).forEach(function (c) { if (!c.classList.contains('app-toast')) c.remove(); });
    var name = current.name, fn = S[name] || S.settings;
    var scr = fn(current.params || {});
    viewport.innerHTML = scr.full ? scr.html : shell(scr.html, scr.cur);
    var el = viewport.querySelector('.scr') || viewport.firstElementChild;
    viewport.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.go === 'more') return toast('Back to More (Module 2)'); if (b.dataset.go === 'settings' && stack.length > 1) return back(); go(b.dataset.go); }); });
    viewport.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { toast('This tab is another module'); }); });
    scr.mount && scr.mount(el);
    var spec = window.NH_SCREENS.filter(function (s) { return NH_ROUTE(s).split('?')[0] === name; });
    if (state !== 'normal' && spec.length && !spec.some(function (s) { return s.states.indexOf(state) >= 0; })) NH.toast('"' + state + '" isn\'t a state of this screen. Try: ' + (spec.map(function (s) { return s.states.join(', '); }).filter(Boolean).join(', ') || 'none'));
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && closers.length) { closers[closers.length - 1](); e.stopPropagation(); } });

  window.NHApp = {
    setState: function (s) { state = s; render(); },
    go: go,
    action: function (name) { if (name === 'reset') { demo = fresh(); save(); ui = {}; state = 'normal'; go('settings'); } },
    demo: function () { return demo; }
  };

  function boot() {
    root = document.getElementById('app-root'); viewport = document.getElementById('app'); overlays = document.getElementById('app-overlays');
    if (EMBED) { document.body.className = 'embed'; document.body.innerHTML = ''; document.body.appendChild(root); }
    function syncPlatform() { var f = flags(); root.dataset.platform = f.platform; var dev = document.getElementById('device'); if (dev) dev.classList.toggle('is-android', f.platform === 'android'); }
    syncPlatform();
    var size = '';
    function measure() { var s = root.clientWidth >= 700 ? 'tablet' : 'phone'; if (s !== size) { size = s; root.dataset.size = s; if (current.name) render(); } }
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(root); else window.addEventListener('resize', measure);
    measure();
    document.addEventListener('nh:options', function () { ui.draft = null; if (current.name) render(); });
    document.addEventListener('nh:flags', function () { syncPlatform(); ui.plat = null; if (!current.name) return; render(); document.dispatchEvent(new CustomEvent('nh:route', { detail: { name: current.name, params: Object.assign({}, current.params) } })); });
    window.addEventListener('hashchange', onRoute);
    onRoute();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
