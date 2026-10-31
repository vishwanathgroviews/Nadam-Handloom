/* Module 2 (Roles and team): the clickable app.
   A small pretend backend in this file applies the real rules from the plan
   (two roles, main-owner protection, no changing yourself, removal keeps history,
   invite edge cases), so every case can be tried in the browser. */
(function () {
  'use strict';
  var NH = window.NH;
  var EMBED = /[?&]embed=1/.test(location.search);
  var APP_LINK = '[app download link]';

  /* ================= Roles (same table as the plan, section 4) ================= */
  var PERMS = {
    owner: ['team.manage', 'sales.view', 'analytics.view', 'activity.view', 'settings.manage', 'catalog.edit', 'catalog.view', 'products.manage', 'orders.manage', 'sell.use', 'sell.override'],
    staff: ['catalog.view', 'products.manage', 'orders.manage', 'sell.use']
  };
  var CAN_DO = {
    staff: { can: ['Products: view, add, edit and delete', 'Orders: today and past, and shipping', 'Scan to sell and share invoices', 'See categories and prices'], cant: ['Sales totals, sales summaries and analytics', 'The team', 'Changing categories or prices', 'Activity log and settings'] },
    owner: { can: ['Everything Staff can do', 'Today\'s sales, sales summaries and analytics', 'The team: invite, change roles, remove', 'Categories and prices', 'Activity log and settings'], cant: [] }
  };
  var ROLE = { owner: 'Owner', staff: 'Staff' };

  /* ================= Pretend backend (sample data) ================= */
  var DEMO_KEY = 'nh-m2-demo';
  function freshDemo() {
    return {
      members: {
        lakshmi: { id: 'lakshmi', name: 'Lakshmi Devi', mobile: '9000000001', role: 'owner', main: true, status: 'active', added: '12 Mar 2024', last: 'Active now',
          devices: [{ id: 'l1', name: 'iPhone 15', kind: 'phone', os: 'iOS 18', last: 'Active now' }, { id: 'l2', name: 'Counter iPad', kind: 'tablet', os: 'iPadOS 18', last: '2 hours ago' }] },
        priya: { id: 'priya', name: 'Priya Rao', mobile: '9000000005', role: 'owner', main: false, status: 'active', added: '4 Jan 2026', addedBy: 'Lakshmi', last: '3 hours ago',
          devices: [{ id: 'p1', name: 'Galaxy S23', kind: 'phone', os: 'Android 14', last: '3 hours ago' }] },
        ravi: { id: 'ravi', name: 'Ravi Kumar', mobile: '9000000002', role: 'staff', main: false, status: 'active', added: '20 Jun 2025', addedBy: 'Lakshmi', last: '20 min ago',
          devices: [{ id: 'r1', name: 'Counter tablet (Galaxy Tab A9)', kind: 'tablet', os: 'Android 14', last: '20 min ago' }, { id: 'r2', name: 'Redmi Note 13', kind: 'phone', os: 'Android 14', last: 'Yesterday' }] },
        anil: { id: 'anil', name: 'Anil Babu', mobile: '9000000006', role: 'staff', main: false, status: 'active', added: '2 Aug 2026', addedBy: 'Priya', last: '2 days ago',
          devices: [{ id: 'a1', name: 'iPhone 13', kind: 'phone', os: 'iOS 18', last: '2 days ago' }] },
        suresh: { id: 'suresh', name: 'Suresh', mobile: '9000000003', role: 'staff', main: false, status: 'invited', added: '9 Oct 2026', addedBy: 'Lakshmi', invited: '2 days ago', invitedBy: 'Lakshmi', devices: [] },
        kiran: { id: 'kiran', name: 'Kiran', mobile: '9000000004', role: 'staff', main: false, status: 'removed', added: '1 Feb 2025', addedBy: 'Lakshmi', removed: '10 Sep 2026', removedBy: 'Lakshmi', devices: [] }
      },
      customers: { '9000000009': 'Meena' },
      seen: { lakshmi: 'owner', priya: 'owner', ravi: 'staff', anil: 'staff' }
    };
  }
  var demo = load();
  function load() { try { var d = JSON.parse(sessionStorage.getItem(DEMO_KEY)); if (d && d.members) return d; } catch (e) { } return freshDemo(); }
  function save() { try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch (e) { } }
  window.addEventListener('storage', function (e) { if (e.key === DEMO_KEY) demo = load(); });

  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function flags() { return NH.flags(); }
  function me() { return demo.members[flags().viewAs] || demo.members.lakshmi; }
  function can(p, who) { var m = who || me(); return m.status === 'active' && PERMS[m.role].indexOf(p) >= 0; }
  function first(name) { return String(name || '').split(/\s+/)[0]; }
  function list() { return Object.keys(demo.members).map(function (k) { return demo.members[k]; }); }
  function owners() { return list().filter(function (m) { return m.role === 'owner' && m.status !== 'removed'; }); }

  function call(fn, ms) {
    return wait(ms || 650).then(function () {
      if (flags().offline) { var e = new Error('offline'); e.code = 'offline'; throw e; }
      var r = fn(); save(); return r;
    });
  }
  function guard(target, kind) {
    var v = me();
    if (!can('team.manage')) return 'FORBIDDEN';
    if (!target) return 'MEMBER_NOT_FOUND';
    if (kind === 'change' || kind === 'devices') { if (target.id === v.id) return 'CANNOT_CHANGE_SELF'; }
    if ((kind === 'change' || kind === 'devices') && target.main) return 'MAIN_OWNER_PROTECTED';
    return null;
  }
  var api = {
    invite: function (name, mobile, role) {
      return call(function () {
        if (!can('team.manage')) return { error: 'FORBIDDEN' };
        var v = me(), m = list().filter(function (x) { return x.mobile === mobile; })[0];
        if (m && m.status === 'active') return { error: 'ALREADY_IN_TEAM', member: m };
        if (m && m.status === 'invited') return { error: 'ALREADY_INVITED', member: m };
        if (m) {                                    // removed earlier: invite again with the new name and role
          m.name = name; m.role = role; m.status = 'invited'; m.invited = 'Just now'; m.invitedBy = first(v.name); m.devices = [];
          return { member: m, again: true };
        }
        var id = 'm' + Date.now().toString(36);
        m = demo.members[id] = { id: id, name: name, mobile: mobile, role: role, main: false, status: 'invited', added: 'Today', addedBy: first(v.name), invited: 'Just now', invitedBy: first(v.name), devices: [] };
        return { member: m, customer: !!demo.customers[mobile] };
      }, 800);
    },
    rename: function (id, name) { return call(function () { var t = demo.members[id], g = guard(t, 'name'); if (g) return { error: g }; t.name = name; return { member: t }; }); },
    setRole: function (id, role) {
      return call(function () {
        var t = demo.members[id], g = guard(t, 'change'); if (g) return { error: g };
        if (t.role === 'owner' && role === 'staff' && owners().length <= 1) return { error: 'LAST_OWNER' };
        t.role = role; return { member: t };
      });
    },
    remove: function (id) {
      return call(function () {
        var t = demo.members[id], g = guard(t, 'change'); if (g) return { error: g };
        if (t.role === 'owner' && owners().length <= 1) return { error: 'LAST_OWNER' };
        var n = t.devices.length;
        t.status = 'removed'; t.removed = 'Just now'; t.removedBy = first(me().name); t.devices = [];
        return { member: t, signedOut: n };
      }, 800);
    },
    reinvite: function (id, role) {
      return call(function () {
        var t = demo.members[id], g = guard(t, 'name'); if (g) return { error: g };
        if (t.status !== 'removed') return { error: 'ALREADY_IN_TEAM' };
        t.role = role; t.status = 'invited'; t.invited = 'Just now'; t.invitedBy = first(me().name);
        return { member: t };
      });
    },
    makeMain: function (id) {
      return call(function () {
        var v = me(), t = demo.members[id];
        if (!can('team.manage') || !v.main) return { error: 'FORBIDDEN' };
        if (!t || t.role !== 'owner' || t.status !== 'active' || t.id === v.id) return { error: 'NOT_ACTIVE_OWNER' };
        v.main = false; t.main = true; return { member: t };
      }, 800);
    },
    signOutDevice: function (id, devId) {
      return call(function () { var t = demo.members[id], g = guard(t, 'devices'); if (g) return { error: g }; t.devices = t.devices.filter(function (d) { return d.id !== devId; }); return { ok: true }; });
    },
    signOutAll: function (id) {
      return call(function () { var t = demo.members[id], g = guard(t, 'devices'); if (g) return { error: g }; var n = t.devices.length; t.devices = []; return { signedOut: n }; }, 700);
    },
    finishSetup: function (id) {        // pretend: the person sets their PIN on their own phone (Module 1)
      return call(function () { var t = demo.members[id]; t.status = 'active'; t.last = 'Active now'; t.devices = [{ id: id + '-1', name: 'Their phone', kind: 'phone', os: 'Android 14', last: 'Active now' }]; return { member: t }; }, 500);
    }
  };
  var ERR = {
    FORBIDDEN: 'Only owners can do this.',
    MEMBER_NOT_FOUND: 'This person isn\'t in the team any more.',
    CANNOT_CHANGE_SELF: 'You can\'t change your own role or remove yourself. Use My account for your own phones.',
    MAIN_OWNER_PROTECTED: 'The main owner can\'t be removed or made Staff.',
    LAST_OWNER: 'The team needs at least one owner.',
    NOT_ACTIVE_OWNER: 'Only an active owner can become the main owner.',
    ALREADY_IN_TEAM: 'Already in your team.'
  };

  /* The invite text. The backend builds the same text (services/inviteMessage.js). */
  function inviteText(m) {
    var byName = me().name; // signed by the owner who shares it, from their own phone
    return 'Hi ' + first(m.name) + ', you\'ve been added to the Nandam Handlooms team as ' + (m.role === 'owner' ? 'an Owner' : 'Staff') + '.\n\n' +
      'To get started:\n' +
      '1. Install the Nandam Handlooms Admin app: ' + APP_LINK + '\n' +
      '2. Open it and tap "First time here? Set up your account".\n' +
      '3. Enter your mobile number ' + fmt(m.mobile) + '. You\'ll get an SMS code.\n' +
      '4. Choose your own 6-digit PIN.\n\n' +
      'Never share your PIN or SMS code with anyone, including me.\n\n' +
      '– ' + byName + ', Nandam Handlooms';
  }

  /* ================= Helpers ================= */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { n = String(n || ''); return n.length > 5 ? n.slice(0, 5) + ' ' + n.slice(5) : n; }
  function masked(n) { return '+91 ' + n.slice(0, 5) + ' •••' + n.slice(8); }
  function initials(name) { return String(name || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }
  function mobileError(d) { if (!d) return 'Enter their 10-digit mobile number.'; if (d.length !== 10) return 'Enter a 10-digit mobile number.'; if (!/^[6-9]/.test(d)) return 'Mobile numbers start with 6, 7, 8 or 9.'; return null; }
  function nameError(s) { s = String(s || '').trim(); if (s.length < 2) return 'Enter their full name (at least 2 letters).'; if (s.length > 80) return 'Keep the name under 80 characters.'; return null; }
  function icon(n, c) { return NH.icon(n, c); }
  function alertBox(type, title, text, ic, extra) {
    var map = { info: 'info', success: 'check', warning: 'alert', error: 'alertc' };
    return '<div class="alert alert-' + type + '" role="' + (type === 'error' ? 'alert' : 'status') + '">' + icon(ic || map[type]) + '<div>' + (title ? '<strong>' + title + '</strong>' : '') + (text ? '<p>' + text + '</p>' : '') + (extra || '') + '</div></div>';
  }
  function topBar(title, back, right) { return '<div class="scr-top">' + (back ? '<button class="icon-btn" type="button" data-go="' + back + '" aria-label="Back">' + icon('back') + '</button>' : '<span style="width:12px"></span>') + '<h1>' + (title || '') + '</h1>' + (right || '') + '</div>'; }
  function netToast(e) { return 'You\'re offline. Try again when connected.'; }
  function successMark() { return '<div class="success-mark" aria-hidden="true"><svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="50"/><path d="M36 58l13 13 27-29"/></svg></div>'; }
  function roleBadge(m) { return '<span class="badge ' + (m.role === 'owner' ? 'badge-owner' : 'badge-staff') + '">' + ROLE[m.role] + '</span>'; }
  function statusBadge(m) { return m.status === 'invited' ? '<span class="badge badge-warning">Invited</span>' : m.status === 'removed' ? '<span class="badge badge-danger">Removed</span>' : '<span class="badge badge-success">Active</span>'; }
  function subline(m) {
    if (m.status === 'invited') return ROLE[m.role] + ' · Invited ' + esc(m.invited);
    if (m.status === 'removed') return 'Removed ' + esc(m.removed);
    return (m.main ? 'Main owner' : ROLE[m.role]) + ' · ' + (m.last === 'Active now' ? 'Active now' : 'Last active ' + esc(m.last));
  }
  function whoLine(m) {
    return '<span class="who-line"><b>' + esc(m.name) + '</b>' + (m.main ? icon('crown', 'crown') : '') + (m.id === me().id ? '<span class="you-tag">You</span>' : '') + '</span>';
  }
  function skelRows(n) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="skel-row"><div class="skeleton" style="width:40px;height:40px;border-radius:50%"></div><div style="flex:1"><div class="skeleton" style="height:14px;width:50%;margin-bottom:6px"></div><div class="skeleton" style="height:11px;width:35%"></div></div></div>'; return '<div class="list">' + h + '</div>'; }
  function roleOptions(name, selected) {
    return '<div class="role-pick" role="radiogroup" aria-label="Role">' + ['staff', 'owner'].map(function (r) {
      var c = CAN_DO[r];
      return '<label class="role-opt"><input type="radio" name="' + name + '" value="' + r + '"' + (selected === r ? ' checked' : '') + '><span class="dot"></span><b>' + ROLE[r] + '</b>' +
        '<ul>' + c.can.map(function (x) { return '<li>' + x + '</li>'; }).join('') + (c.cant.length ? '<li class="cant">Can\'t see or change: ' + c.cant.join(', ').toLowerCase() + '</li>' : '') + '</ul></label>';
    }).join('') + '</div>';
  }

  /* ================= Overlays ================= */
  var overlays, root, viewport, closers = [];
  function addOverlay(html) { var d = document.createElement('div'); d.innerHTML = html; var el = d.firstElementChild; overlays.appendChild(el); return el; }
  function toast(msg, ok) {
    var old = overlays.querySelector('.app-toast'); if (old) old.remove();
    var t = addOverlay('<div class="app-toast' + (ok ? ' ok' : '') + '" role="status">' + icon(ok ? 'check' : 'info') + esc(msg) + '</div>');
    setTimeout(function () { t.remove(); }, 3000);
  }
  function dialog(o) {
    var acts = (o.actions || []).map(function (a, i) { return '<button type="button" class="btn btn-block ' + (a.kind || '') + '" data-i="' + i + '">' + a.label + '</button>'; }).join('');
    var el = addOverlay('<div class="dlg-backdrop"><div class="dlg is-' + (o.tone || 'info') + '" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d">' +
      '<div class="dlg-ico">' + icon(o.icon || 'info') + '</div><h2 id="dlg-t">' + o.title + '</h2><p id="dlg-d">' + o.text + '</p><div class="dlg-actions">' + acts + '</div></div></div>');
    function close() { el.remove(); closers = closers.filter(function (c) { return c !== close; }); }
    closers.push(close);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (b) { var a = o.actions[+b.dataset.i]; if (a.keep) { a.fn && a.fn(b, close); } else { close(); a.fn && a.fn(); } return; }
      if (e.target === el) close();
    });
    var f = el.querySelector('[data-i]'); f && f.focus();
    return close;
  }
  function sheet(html, onMount) {
    var el = addOverlay('<div class="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div></div>');
    function close() { el.remove(); closers = closers.filter(function (c) { return c !== close; }); }
    closers.push(close);
    el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-close]')) close(); });
    onMount && onMount(el, close);
    return close;
  }
  // Act on a server answer: run ok() on success, or show the reason it was refused.
  function done(r, ok) { if (r && r.error) { toast(ERR[r.error] || 'Something went wrong. Try again.'); render(); return; } ok(r); }
  // Errors: offline shows a toast, nothing changes.
  function fail(close) { return function (e) { close && close(); toast(netToast(e)); render(); }; }

  function shareSheet(m) {
    var plat = flags().platform;
    sheet('<h2>Share invite</h2><p>Send ' + esc(first(m.name)) + '\'s invite with any app on your phone.</p><div class="share-grid">' +
      '<button type="button" data-app="wa"><span class="app-ico" style="background:#25D366">' + icon('whatsapp') + '</span>WhatsApp</button>' +
      '<button type="button" data-app="sms"><span class="app-ico" style="background:' + (plat === 'ios' ? '#34C759' : '#1A73E8') + '">' + icon('message') + '</span>Messages</button>' +
      '<button type="button" data-app="mail"><span class="app-ico" style="background:#EA4335">' + icon('mail') + '</span>Email</button>' +
      '<button type="button" data-app="copy"><span class="app-ico" style="background:#6B7280">' + icon('copy') + '</span>Copy</button></div>' +
      '<div class="acts"><button type="button" class="btn btn-block" data-close>Cancel</button></div>', function (el, close) {
      el.querySelectorAll('[data-app]').forEach(function (b) {
        b.addEventListener('click', function () {
          close();
          var a = b.dataset.app;
          if (a === 'wa') return go('whatsapp?id=' + m.id);
          toast(a === 'copy' ? 'Invite copied. Paste it anywhere.' : a === 'sms' ? 'Messages opens with the invite filled in (pretend)' : 'Your email app opens with the invite (pretend)', true);
        });
      });
    });
  }
  function canDoSheet(role, whose) {
    var c = CAN_DO[role];
    sheet('<h2>What ' + (whose ? esc(whose) : 'an ' + ROLE[role]) + ' can do</h2>' +
      '<div class="facts" style="margin-top:.5rem">' + c.can.map(function (x) { return '<div>' + icon('check') + x + '</div>'; }).join('') + '</div>' +
      (c.cant.length ? '<p style="margin:.9rem 0 0"><b style="color:var(--text)">Owners only:</b> ' + c.cant.join(', ').toLowerCase() + '.</p>' : '') +
      '<div class="acts"><button type="button" class="btn btn-primary btn-block" data-close>OK</button></div>');
  }

  /* ================= Router ================= */
  var current = { name: '', params: {} }, state = 'normal', ui = {}, timers = [];
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), q = h.split('?'), p = {};
    (q[1] || '').split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); p[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
    return { name: q[0] || 'more', params: p };
  }
  function go(route) { if (('#/' + route) === location.hash) { render(); } else location.hash = '#/' + route; }
  function after(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function afterNav(fn, ms) { return setTimeout(fn, ms); }   // survives the next render (used right after go())
  var OWNER_ONLY = { team: 1, invite: 1, invited: 1, whatsapp: 1, member: 1 };
  function onRoute() {
    var r = parse();
    if (r.name !== current.name || JSON.stringify(r.params) !== JSON.stringify(current.params)) { ui[r.name] = undefined; state = 'normal'; }
    current = r;
    if (r.params.as && demo.members[r.params.as] && flags().viewAs !== r.params.as) { lastViewer = r.params.as; NH.setFlag('viewAs', r.params.as, true); }
    if (r.params.changed === '1') {                     // "Role changed" demo: Lakshmi makes Anil an Owner
      var a = demo.members.anil;
      if (a.role === 'staff' && a.status === 'active') { a.role = 'owner'; save(); }
    }
    render();
    document.dispatchEvent(new CustomEvent('nh:route', { detail: r }));
  }

  /* ================= Screens ================= */
  var S = {};

  /* ----- Signed-in shell (from Module 1) ----- */
  var TABS = [['home', 'home', 'Home'], ['orders', 'orders', 'Orders'], ['scan', 'scan', 'Scan'], ['products', 'box', 'Products'], ['more', 'more', 'More']];
  function shell(tab, inner) {
    var tabs = TABS.map(function (t) {
      var cur = t[0] === tab ? ' aria-current="page"' : '';
      if (t[0] === 'scan') return '<button type="button" class="scan-tab" data-go="scan"' + cur + ' aria-label="Scan"><span class="scan-ico">' + icon('scan') + '</span></button>';
      return '<button type="button" data-go="' + t[0] + '"' + cur + '>' + icon(t[1]) + t[2] + '</button>';
    }).join('');
    var rail = '<nav class="rail" aria-label="Main menu"><img src="assets/logo.png" alt="Nandam Handlooms">' + TABS.map(function (t) { return '<button type="button" data-go="' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + icon(t[1]) + t[2] + '</button>'; }).join('') + '</nav>';
    var bar = flags().offline ? '<div class="offline-bar" role="status">' + icon('wifioff') + 'Offline. Team changes need internet.</div>' : '';
    return '<div class="shell">' + rail + '<div class="shell-main">' + bar + inner + '</div><nav class="tabbar" aria-label="Main menu">' + tabs + '</nav></div>';
  }
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

  S.home = function () {
    var v = me(), owner = can('sales.view');
    var tiles = (owner ? '<div class="ph-tile"><b>Today\'s sales</b><span class="badge badge-planned">Module 8</span></div>' : '') +
      '<div class="ph-tile"><b>To ship</b><span class="badge badge-planned">Module 7</span></div>' +
      '<div class="ph-tile"><b>Scan to sell</b><span class="badge badge-planned">Module 5</span></div><div class="ph-tile"><b>Products</b><span class="badge badge-planned">Module 4</span></div>' +
      (owner ? '<div class="ph-tile"><b>Analytics</b><span class="badge badge-planned">Module 9</span></div><div class="ph-tile wide"><b>Recent activity</b><span class="badge badge-planned">Module 10</span></div>'
        : '<div class="ph-tile wide"><b>Today\'s orders</b><span class="badge badge-planned">Module 7</span></div>');
    return {
      shell: 'home',
      html: '<section class="scr"><div class="scr-body">' +
        '<div class="home-head"><span class="avatar">' + initials(v.name) + '</span><div style="flex:1;min-width:0"><h1>' + greeting() + ', ' + esc(first(v.name)) + '</h1><p>Nandam Handlooms · Mangalagiri</p></div>' + roleBadge(v) + '</div>' +
        '<div style="height:1rem"></div>' +
        alertBox('info', owner ? 'Owner view' : 'Staff view', owner ? 'Owners see sales, analytics and the activity log.' : 'Staff don\'t see money totals, analytics or the activity log. Home itself is designed in Module 8.') +
        '<div class="list-title">' + (owner ? 'Tiles for owners' : 'Tiles for staff') + '</div><div class="placeholder-grid">' + tiles + '</div></div></section>'
    };
  };
  function placeholder(tab, title, mod) {
    return function () {
      return { shell: tab, html: '<section class="scr"><div class="scr-top" style="padding:0 20px"><h1>' + title + '</h1></div><div class="scr-body"><div class="ph-tile" style="min-height:200px;align-items:center;justify-content:center;text-align:center;gap:.5rem">' + icon(tab === 'scan' ? 'scan' : tab === 'orders' ? 'orders' : 'box', 'icon-xl') + '<b>' + title + '</b><span>Designed in Module ' + mod + '</span></div></div></section>' };
    };
  }
  S.orders = placeholder('orders', 'Orders', 7);
  S.scan = placeholder('scan', 'Scan to sell', 5);
  S.products = placeholder('products', 'Products', 4);

  S.more = function () {
    var v = me(), owner = can('team.manage');
    var team = list().filter(function (m) { return m.status !== 'removed'; }), inv = team.filter(function (m) { return m.status === 'invited'; }).length;
    var profile = state === 'loading' ? '<div class="list"><div class="skel-row"><div class="skeleton" style="width:64px;height:64px;border-radius:50%"></div><div style="flex:1"><div class="skeleton" style="height:18px;width:55%;margin-bottom:8px"></div><div class="skeleton" style="height:12px;width:35%"></div></div></div></div>'
      : state === 'error' ? alertBox('error', 'Couldn\'t load your profile', 'Check your connection. You can still log out below.') + '<button type="button" class="btn btn-sm" style="margin-top:.6rem" data-retry>' + icon('refresh', 'icon-sm') + 'Retry</button>'
      : '<div class="list"><div class="profile-card"><span class="avatar lg">' + initials(v.name) + '</span><div><b>' + esc(v.name) + '</b><span>+91 ' + fmt(v.mobile) + '</span><div style="margin-top:.35rem;display:flex;gap:.35rem;align-items:center;flex-wrap:wrap">' + roleBadge(v) + (v.main ? '<span class="badge badge-info">Main owner</span>' : '') +
        '<button type="button" class="link-btn" style="font-size:var(--fs-13)" data-cando>What can I do?</button></div></div></div></div>';
    return {
      shell: 'more',
      html: '<section class="scr"><div class="scr-top" style="padding:0 20px"><h1>More</h1></div><div class="scr-body narrow">' + profile +
        (owner ? '<div class="list-title">Team</div><div class="list"><button type="button" class="row" data-go="team"><span class="tile">' + icon('users') + '</span><span class="grow"><b>Team</b><span>' + team.length + ' people' + (inv ? ' · ' + inv + ' invited' : '') + '</span></span>' + icon('right', 'chev') + '</button></div>' : '') +
        '<div class="list-title">Sign-in and security</div><div class="list">' +
        '<button type="button" class="row" data-m1="Change PIN"><span class="tile">' + icon('key') + '</span><span class="grow"><b>Change PIN</b><span>No SMS needed while signed in</span></span>' + icon('right', 'chev') + '</button>' +
        '<button type="button" class="row" data-m1="My devices"><span class="tile">' + icon('phone') + '</span><span class="grow"><b>My devices</b><span>' + v.devices.length + ' signed in</span></span>' + icon('right', 'chev') + '</button></div>' +
        '<div style="height:1.25rem"></div><button type="button" class="btn btn-danger btn-block" data-m1="Log out">' + icon('logout') + 'Log out</button>' +
        '<p class="version">Nandam Handlooms Admin · v2.0.0 (mock-up)</p></div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-m1]').forEach(function (b) { b.addEventListener('click', function () { toast(b.dataset.m1 + ' is built in Module 1 (already done)'); }); });
        var c = el.querySelector('[data-cando]'); c && c.addEventListener('click', function () { canDoSheet(v.role, 'you'); });
        var r = el.querySelector('[data-retry]'); r && r.addEventListener('click', function () { state = 'normal'; render(); });
      }
    };
  };

  /* ----- Team list ----- */
  function sortTeam(a, b) {
    function rank(m) { return m.main ? 0 : m.role === 'owner' ? 1 : 2; }
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  }
  function teamItems(items) {
    if (NH.opts.teamList === 'b') {
      return '<div class="mcards">' + items.map(function (m) {
        var meta = m.status === 'active' ? '<span>' + icon('clock') + (m.last === 'Active now' ? 'Active now' : 'Last active ' + esc(m.last)) + '</span><span>' + icon('phone') + m.devices.length + ' phone' + (m.devices.length === 1 ? '' : 's') + '</span>'
          : m.status === 'invited' ? '<span>' + icon('send') + 'Invited ' + esc(m.invited) + ' by ' + esc(m.invitedBy) + '</span>' : '<span>' + icon('clock') + 'Removed ' + esc(m.removed) + ' by ' + esc(m.removedBy) + '</span>';
        return '<button type="button" class="mcard" data-go="member?id=' + m.id + '"><div class="top"><span class="avatar' + (m.status === 'removed' ? ' is-removed' : '') + '">' + initials(m.name) + '</span><span class="grow">' + whoLine(m) + '<small>+91 ' + fmt(m.mobile) + '</small></span>' + roleBadge(m) + '</div>' +
          '<div class="meta">' + (m.status === 'active' ? '' : statusBadge(m)) + meta + '</div></button>';
      }).join('') + '</div>';
    }
    return '<div class="list">' + items.map(function (m) {
      return '<button type="button" class="row" data-go="member?id=' + m.id + '"><span class="avatar' + (m.status === 'removed' ? ' is-removed' : '') + '">' + initials(m.name) + '</span><span class="grow">' + whoLine(m) + '<span>' + subline(m) + '</span></span>' +
        (m.status === 'invited' ? statusBadge(m) : '') + icon('right', 'chev') + '</button>';
    }).join('') + '</div>';
  }
  S.team = function (p) {
    var u = ui.team || (ui.team = { q: '' });
    var tab = p.tab === 'removed' ? 'removed' : 'team';
    var all = list().sort(sortTeam), inTeam = all.filter(function (m) { return m.status !== 'removed'; }), removed = all.filter(function (m) { return m.status === 'removed'; });
    if (state === 'empty') { inTeam = inTeam.filter(function (m) { return m.id === me().id; }); removed = []; }
    var owners = inTeam.filter(function (m) { return m.role === 'owner'; }).length, inv = inTeam.filter(function (m) { return m.status === 'invited'; }).length;
    function body() {
      if (state === 'loading') return skelRows(4);
      if (state === 'error') return alertBox('error', 'Couldn\'t load the team', 'Check your connection and try again.') + '<button type="button" class="btn btn-sm" style="margin-top:.6rem" data-retry>' + icon('refresh', 'icon-sm') + 'Retry</button>';
      var src = tab === 'removed' ? removed : inTeam, q = u.q.trim().toLowerCase(), qd = q.replace(/\D/g, '');
      var items = src.filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) >= 0 || (qd && m.mobile.indexOf(qd) >= 0); });
      if (!src.length && tab === 'removed') return '<div class="ph-tile" style="min-height:160px;align-items:center;justify-content:center;text-align:center;gap:.4rem">' + icon('users', 'icon-xl') + '<b>Nobody has been removed</b><span>People you remove show here, with their history kept.</span></div>';
      if (!items.length) return '<div class="ph-tile" style="min-height:140px;align-items:center;justify-content:center;text-align:center;gap:.4rem">' + icon('search', 'icon-xl') + '<b>No one matches "' + esc(u.q) + '"</b><span>Try a first name or the last digits of the number.</span></div>';
      var extra = tab === 'team' && inTeam.length === 1 ? '<div class="ph-tile" style="margin-top:.75rem;min-height:150px;align-items:center;justify-content:center;text-align:center;gap:.45rem">' + icon('userplus', 'icon-xl') + '<b>It\'s just you so far</b><span>Invite your staff or a second owner.</span><button type="button" class="btn btn-sm btn-primary" data-go="invite">' + icon('plus', 'icon-sm') + 'Invite someone</button></div>' : '';
      return teamItems(items) + extra;
    }
    return {
      shell: 'more',
      html: '<section class="scr">' + topBar('Team', 'more', '<button type="button" class="btn btn-sm btn-primary top-act" data-go="invite">' + icon('plus', 'icon-sm') + 'Invite</button>') +
        '<div class="scr-body narrow">' +
        '<div class="tabs2" role="tablist" aria-label="Team or removed"><button type="button" role="tab" aria-selected="' + (tab === 'team') + '" data-go="team">Team<span class="count">' + inTeam.length + '</span></button>' +
        '<button type="button" role="tab" aria-selected="' + (tab === 'removed') + '" data-go="team?tab=removed">Removed<span class="count">' + removed.length + '</span></button></div>' +
        '<div class="search">' + icon('search') + '<input class="input" type="search" id="team-q" placeholder="Search name or number" autocomplete="off" value="' + esc(u.q) + '" aria-label="Search the team"></div>' +
        (tab === 'team' && state !== 'loading' && state !== 'error' ? '<p class="team-summary">' + owners + ' owner' + (owners === 1 ? '' : 's') + ' · ' + (inTeam.length - owners) + ' staff' + (inv ? ' · ' + inv + ' invited' : '') + '</p>' : '') +
        '<div id="team-items">' + body() + '</div></div></section>',
      mount: function (el) {
        var q = el.querySelector('#team-q'), box = el.querySelector('#team-items');
        q.addEventListener('input', function () { u.q = q.value; box.innerHTML = body(); bindGo(box); });
        el.addEventListener('click', function (e) { if (e.target.closest('[data-retry]')) { state = 'normal'; render(); } });
      }
    };
  };

  /* ----- Invite ----- */
  S.invite = function () {
    var u = ui.invite || (ui.invite = { name: '', mobile: '', role: 'staff', errs: {} });
    if (state === 'error' && !u.errs.mobile) u.errs = { name: nameError(''), mobile: 'Enter a 10-digit mobile number.' };
    var e = u.errs;
    return {
      shell: 'more',
      html: '<section class="scr">' + topBar('Invite someone', 'team') + '<div class="scr-body narrow">' +
        '<p class="scr-lead" style="margin-top:.25rem">They\'ll set up the app on their own phone with an SMS code. Next, you send them the invite on WhatsApp.</p>' +
        (u.result || '') + (u.net ? alertBox('warning', 'You\'re offline', 'Inviting needs internet. Nothing was saved.', 'wifioff') + '<div style="height:.75rem"></div>' : '') +
        '<div class="field' + (e.name ? ' has-error' : '') + '"><label for="inv-name">Full name</label><input class="input" id="inv-name" type="text" autocomplete="off" autocapitalize="words" maxlength="80" placeholder="e.g. Suresh Babu" value="' + esc(u.name) + '"' + (e.name ? ' aria-invalid="true" aria-describedby="inv-name-err"' : '') + '>' +
        (e.name ? '<p class="field-error" id="inv-name-err">' + icon('alertc', 'icon-sm') + esc(e.name) + '</p>' : '') + '</div>' +
        '<div class="field' + (e.mobile ? ' has-error' : '') + '"><label for="inv-mobile">Mobile number</label><div class="input-group"><span class="prefix">+91</span><input class="input" id="inv-mobile" type="tel" inputmode="numeric" autocomplete="off" maxlength="11" placeholder="98765 43210" value="' + esc(fmt(u.mobile)) + '"' + (e.mobile ? ' aria-invalid="true" aria-describedby="inv-mobile-err"' : '') + '></div>' +
        (e.mobile ? '<p class="field-error" id="inv-mobile-err">' + icon('alertc', 'icon-sm') + esc(e.mobile) + '</p>' : '<p class="field-hint">Their own number. It can\'t be changed later.</p>') + '</div>' +
        '<div class="field" style="margin-bottom:0"><span class="field-label">Role</span>' + roleOptions('inv-role', u.role) + '</div>' +
        (u.role === 'owner' ? '<div style="height:.75rem"></div>' + alertBox('warning', 'Owners can do everything', 'Including seeing all sales, changing prices and managing the team (you too, unless you\'re the main owner). Only choose Owner for someone you fully trust.') : '') +
        '</div><div class="scr-foot" style="padding-bottom:104px"><button type="button" class="btn btn-primary btn-block' + (state === 'loading' ? ' is-loading' : '') + '" data-invite>' + icon('userplus') + 'Invite</button></div></section>',
      mount: function (el) {
        var nm = el.querySelector('#inv-name'), mb = el.querySelector('#inv-mobile');
        nm.addEventListener('input', function () { u.name = nm.value; });
        mb.addEventListener('input', function () { var d = mb.value.replace(/\D/g, '').slice(0, 10); u.mobile = d; var f = fmt(d); if (mb.value !== f) mb.value = f; });
        el.querySelectorAll('input[name="inv-role"]').forEach(function (r) { r.addEventListener('change', function () { u.role = r.value; render(); }); });
        el.querySelector('[data-invite]').addEventListener('click', function (ev) {
          var b = ev.currentTarget;
          u.errs = { name: nameError(u.name), mobile: mobileError(u.mobile) }; u.result = ''; u.net = false;
          if (u.errs.name || u.errs.mobile) return render();
          b.classList.add('is-loading');
          api.invite(u.name.trim().replace(/\s+/g, ' '), u.mobile, u.role).then(function (r) {
            if (r.error === 'ALREADY_IN_TEAM') { u.result = alertBox('error', esc(r.member.name) + ' is already in your team', 'As ' + ROLE[r.member.role] + ', since ' + esc(r.member.added) + '.', 'alertc', '<button type="button" class="btn btn-sm" style="margin-top:.5rem" data-go="member?id=' + r.member.id + '">Open ' + esc(first(r.member.name)) + '\'s page</button>') + '<div style="height:.75rem"></div>'; return render(); }
            if (r.error === 'ALREADY_INVITED') { u.result = alertBox('warning', esc(r.member.name) + ' is already invited', 'Invited ' + esc(r.member.invited) + ' by ' + esc(r.member.invitedBy) + '. Send the invite again if they didn\'t get it.', 'send', '<button type="button" class="btn btn-sm" style="margin-top:.5rem" data-go="invited?id=' + r.member.id + '&again=share">Share invite again</button>') + '<div style="height:.75rem"></div>'; return render(); }
            if (r.error) { toast(ERR[r.error]); return render(); }
            ui.invite = undefined;
            go('invited?id=' + r.member.id + (r.again ? '&again=1' : '') + (r.customer ? '&customer=1' : ''));
          }, function () { u.net = true; render(); });
        });
      }
    };
  };

  S.invited = function (p) {
    var m = demo.members[p.id];
    if (!m) return S.team({});
    var title = p.again === 'share' ? 'Share ' + esc(first(m.name)) + '\'s invite' : esc(first(m.name)) + ' is invited' + (p.again === '1' ? ' again' : '');
    return {
      shell: 'more',
      html: '<section class="scr">' + topBar('', null, '<button type="button" class="btn btn-sm btn-ghost top-act" data-go="team">Done</button>') + '<div class="scr-body narrow center-col" style="justify-content:flex-start">' + (p.again === 'share' ? '<div class="msg-icon">' + icon('send') + '</div>' : successMark()) +
        '<h2 class="scr-title">' + title + '</h2><p class="scr-lead">Send the invite on WhatsApp. It opens on your phone with the message ready; you press Send. It\'s free.</p>' +
        '<div class="facts"><div>' + icon('check') + 'In your team as ' + ROLE[m.role] + ', waiting to set up</div><div>' + icon('check') + 'They get an SMS code at ' + masked(m.mobile) + ' when they set up</div>' +
        (p.customer === '1' ? '<div>' + icon('check') + 'This number shops on the website too. That account stays as it is.</div>' : '') + '</div>' +
        '<div class="msg-preview-label">The message</div><div class="msg-preview">' + esc(inviteText(m)) + '</div></div>' +
        '<div class="scr-foot" style="padding-bottom:104px"><button type="button" class="btn btn-wa btn-block" data-go="whatsapp?id=' + m.id + '">' + icon('whatsapp') + 'Share invite on WhatsApp</button>' +
        '<button type="button" class="btn btn-block" data-share>' + icon('share') + 'Share another way</button></div></section>',
      mount: function (el) { el.querySelector('[data-share]').addEventListener('click', function () { shareSheet(m); }); }
    };
  };

  S.whatsapp = function (p) {
    var m = demo.members[p.id] || demo.members.suresh, text = inviteText(m);
    var u = ui.whatsapp || (ui.whatsapp = { sent: false });
    return {
      full: true,
      html: '<section class="wa" aria-label="WhatsApp (picture of another app)"><div class="wa-top"><button type="button" data-back aria-label="Back to Nandam Admin">' + icon('back') + '</button><span class="wa-av">' + initials(m.name) + '</span><div style="flex:1;min-width:0"><b>+91 ' + fmt(m.mobile) + '</b><small>WhatsApp · picture for the mock-up</small></div></div>' +
        '<div class="wa-chat"><div class="wa-note">Messages are end-to-end encrypted. This is a picture of WhatsApp, not part of our app.</div>' +
        (u.sent ? '<div class="wa-bubble">' + esc(text) + '<small>' + new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) + ' ✓✓</small></div><button type="button" class="btn btn-sm wa-back" data-back>' + icon('back', 'icon-sm') + 'Back to Nandam Admin</button>' : '') + '</div>' +
        (u.sent ? '' : '<div class="wa-compose"><div class="wa-input">' + esc(text) + '</div><button type="button" class="wa-send" data-send aria-label="Send">' + icon('send') + '</button></div>') + '</section>',
      mount: function (el) {
        el.querySelectorAll('[data-back]').forEach(function (b) { b.addEventListener('click', function () { ui.whatsapp = undefined; history.length > 1 ? history.back() : go('invited?id=' + m.id); }); });
        var s = el.querySelector('[data-send]'); s && s.addEventListener('click', function () { u.sent = true; render(); });
      }
    };
  };

  /* ----- Member page ----- */
  S.member = function (p) {
    var m = demo.members[p.id], v = me();
    if (!m) return { shell: 'more', html: '<section class="scr">' + topBar('Team member', 'team') + '<div class="scr-body narrow">' + alertBox('error', ERR.MEMBER_NOT_FOUND, '') + '</div></section>' };
    var self = m.id === v.id, fn = esc(first(m.name));
    var loading = state === 'loading', error = state === 'error';
    var canChange = !self && !m.main;
    var body = '';
    if (loading) body = skelRows(1) + '<div style="height:1rem"></div>' + skelRows(3);
    else if (error) body = alertBox('error', 'Couldn\'t load ' + fn + '\'s details', 'Check your connection and try again.') + '<button type="button" class="btn btn-sm" style="margin-top:.6rem" data-retry>' + icon('refresh', 'icon-sm') + 'Retry</button>';
    else {
      var facts = ['Added ' + esc(m.added) + (m.addedBy ? ' by ' + esc(m.addedBy) : '')];
      if (m.status === 'active') facts.push(m.last === 'Active now' ? 'Active now' : 'Last active ' + esc(m.last));
      if (m.status === 'invited') facts.push('Invited ' + esc(m.invited) + ' by ' + esc(m.invitedBy) + '. Not set up yet.');
      if (m.status === 'removed') facts.push('Removed ' + esc(m.removed) + ' by ' + esc(m.removedBy));
      body = '<div class="list"><div class="member-head"><span class="avatar lg' + (m.status === 'removed' ? ' is-removed' : '') + '">' + initials(m.name) + '</span><div class="grow"><b>' + esc(m.name) + (m.main ? icon('crown') : '') + '</b><span class="mono">+91 ' + fmt(m.mobile) + '</span>' +
        '<div class="badges">' + (m.status === 'removed' ? '' : roleBadge(m)) + statusBadge(m) + (m.main ? '<span class="badge badge-info">Main owner</span>' : '') + (self ? '<span class="badge">You</span>' : '') + '</div></div></div>' +
        '<div class="member-facts">' + facts.map(function (f) { return '<span>' + f + '</span>'; }).join('') + '</div></div>';
      if (self) body += '<div style="height:.75rem"></div>' + alertBox('info', 'This is you', 'Change your own PIN, phones and ' + (flags().platform === 'ios' ? 'Face ID' : 'fingerprint') + ' in More → My account. Another owner manages your role.');
      else if (m.main) body += '<div style="height:.75rem"></div>' + alertBox('info', 'Main owner · protected', fn + ' is the main owner. Nobody can remove them, make them Staff or sign out their phones.', 'crown');

      if (m.status === 'removed') {
        body += '<div style="height:.75rem"></div>' + alertBox('warning', 'Access removed', fn + ' can\'t sign in. Their sales, invoices and history are kept.') +
          '<div style="height:.75rem"></div><button type="button" class="btn btn-primary btn-block" data-reinvite>' + icon('userplus') + 'Invite again</button>';
      } else {
        body += '<div class="list-title">Details</div><div class="list">' +
          '<div class="row"><span class="tile">' + icon('user') + '</span><span class="grow"><b>Name</b><span>' + esc(m.name) + '</span></span><button type="button" class="btn btn-sm" data-edit>' + icon('edit', 'icon-sm') + 'Edit</button></div>' +
          '<button type="button" class="row" data-mobile><span class="tile">' + icon('phone') + '</span><span class="grow"><b>Mobile</b><span>+91 ' + fmt(m.mobile) + ' · can\'t be changed</span></span>' + icon('lock', 'lock') + '</button></div>';
        body += '<div class="list-title">Role</div><div class="list"><div class="row"><span class="tile">' + icon('shield') + '</span><span class="grow"><b>' + ROLE[m.role] + '</b><span>' + (m.role === 'owner' ? 'Can do everything' : 'No money totals or team') +
          ' · <button type="button" class="link-btn" data-cando>Details</button></span></span>' +
          (canChange ? '<button type="button" class="btn btn-sm" data-role>' + (m.role === 'owner' ? 'Make Staff' : 'Make Owner') + '</button>' : '<span class="field-hint" style="flex:none">' + (self ? 'Your own role' : 'Main owner') + '</span>') + '</div>' +
          (v.main && !self && m.role === 'owner' && m.status === 'active' ? '<div class="row"><span class="tile">' + icon('crown') + '</span><span class="grow"><b>Main owner</b><span>Hand the main-owner title to ' + fn + '</span></span><button type="button" class="btn btn-sm" data-main>Make main owner</button></div>' : '') + '</div>';
        if (m.status === 'active') {
          body += '<div class="list-title">Phones signed in</div>' + (m.devices.length ? '<div class="list">' + m.devices.map(function (d) {
            return '<div class="row"><span class="tile">' + icon(d.kind) + '</span><span class="grow"><b>' + esc(d.name) + '</b><span>' + esc(d.os) + ' · ' + (d.last === 'Active now' ? 'Active now' : 'Last active ' + esc(d.last)) + '</span></span>' +
              (self || m.main ? '' : '<button type="button" class="btn btn-sm btn-danger" data-out="' + d.id + '">Sign out</button>') + '</div>';
          }).join('') + '</div>' : '<div class="ph-tile" style="min-height:96px;align-items:center;justify-content:center;text-align:center"><b>No phones signed in</b><span>' + fn + ' needs their PIN and an SMS code to sign in.</span></div>') +
            (self ? '<p class="field-hint" style="margin-top:.6rem">Sign out your own phones in More → My devices.</p>' : m.main ? '' : m.devices.length > 1 ? '<div style="height:.6rem"></div><button type="button" class="btn btn-danger btn-block" data-allout>Sign out all ' + m.devices.length + ' phones</button>' : '');
        }
        if (m.status === 'invited') {
          body += '<div class="list-title">Invite</div><div style="display:grid;gap:.5rem"><button type="button" class="btn btn-wa btn-block" data-go="whatsapp?id=' + m.id + '">' + icon('whatsapp') + 'Share invite again on WhatsApp</button>' +
            '<button type="button" class="btn btn-block" data-share>' + icon('share') + 'Share another way</button></div><div class="sim-inline"><button type="button" class="sim" data-finish>Simulate: ' + fn + ' finishes setup</button></div>';
        }
        if (canChange) body += '<div style="height:1.5rem"></div><button type="button" class="btn btn-danger btn-block" data-remove>' + icon('logout') + (m.status === 'invited' ? 'Cancel invite' : 'Remove access') + '</button>';
      }
    }
    return {
      shell: 'more',
      html: '<section class="scr">' + topBar(self ? 'You' : esc(m.name), m.status === 'removed' ? 'team?tab=removed' : 'team') + '<div class="scr-body narrow" style="padding-bottom:110px">' + body + '</div></section>',
      mount: function (el) {
        function on(sel, f) { var b = el.querySelector(sel); b && b.addEventListener('click', f); }
        on('[data-retry]', function () { state = 'normal'; render(); });
        on('[data-cando]', function () { canDoSheet(m.role, first(m.name)); });
        on('[data-mobile]', function () { toast('To use a new number, remove ' + first(m.name) + ' and invite the new number.'); });
        on('[data-share]', function () { shareSheet(m); });
        on('[data-edit]', editName);
        on('[data-role]', roleDialog);
        on('[data-main]', mainDialog);
        on('[data-remove]', removeDialog);
        on('[data-allout]', allOutDialog);
        on('[data-reinvite]', reinviteSheet);
        on('[data-finish]', function () { api.finishSetup(m.id).then(function () { render(); toast(first(m.name) + ' set up the app and is now Active', true); }, fail()); });
        el.querySelectorAll('[data-out]').forEach(function (b) {
          b.addEventListener('click', function () {
            var d = m.devices.filter(function (x) { return x.id === b.dataset.out; })[0];
            dialog({ tone: 'danger', icon: 'logout', title: 'Sign out ' + esc(d.name) + '?', text: 'It will need ' + fn + '\'s PIN and an SMS code to sign in again. Anything unsaved on it stays on that phone.',
              actions: [{ label: 'Sign out', kind: 'btn-danger-solid', keep: true, fn: function (btn, close) { btn.classList.add('is-loading'); api.signOutDevice(m.id, d.id).then(function (r) { close(); done(r, function () { render(); toast(d.name + ' signed out', true); }); }, fail(close)); } }, { label: 'Cancel' }] });
          });
        });
        if (state === 'popup' && !loading) (canChange ? removeDialog : roleDialog)();
        if (state === 'success') after(function () { toast('Saved', true); }, 200);

        function editName() {
          sheet('<h2>Edit name</h2><div class="field" style="margin:.75rem 0 0"><label for="ed-name">Full name</label><input class="input" id="ed-name" type="text" maxlength="80" autocapitalize="words" value="' + esc(m.name) + '"><p class="field-error" id="ed-err" hidden></p></div>' +
            '<div class="acts"><button type="button" class="btn btn-primary btn-block" data-save>Save</button><button type="button" class="btn btn-block" data-close>Cancel</button></div>', function (sh, close) {
            var inp = sh.querySelector('#ed-name'), err = sh.querySelector('#ed-err');
            if (!EMBED) setTimeout(function () { inp.focus(); }, 200);
            sh.querySelector('[data-save]').addEventListener('click', function (ev) {
              var n = inp.value.trim().replace(/\s+/g, ' '), e = nameError(n);
              if (e) { err.hidden = false; err.innerHTML = icon('alertc', 'icon-sm') + e; return; }
              ev.currentTarget.classList.add('is-loading');
              api.rename(m.id, n).then(function (r) { close(); done(r, function () { render(); toast('Name saved', true); }); }, fail(close));
            });
          });
        }
        function roleDialog() {
          var toOwner = m.role === 'staff';
          dialog({ tone: toOwner ? 'warning' : 'info', icon: 'shield', title: toOwner ? 'Make ' + fn + ' an Owner?' : 'Make ' + fn + ' Staff?',
            text: toOwner ? fn + ' will see sales and analytics, manage the team, change categories and prices, and open settings. Only choose this for someone you fully trust. ' + fn + ' stays signed in.'
              : fn + ' will no longer see sales totals, analytics, the team, the activity log or settings. ' + fn + ' stays signed in; their app updates the next time it checks in.',
            actions: [{ label: toOwner ? 'Make Owner' : 'Make Staff', kind: 'btn-primary', keep: true, fn: function (btn, close) { btn.classList.add('is-loading'); api.setRole(m.id, toOwner ? 'owner' : 'staff').then(function (r) { close(); done(r, function () { render(); toast(first(m.name) + ' is now ' + (toOwner ? 'an Owner' : 'Staff'), true); }); }, fail(close)); } }, { label: 'Cancel' }] });
        }
        function mainDialog() {
          dialog({ tone: 'warning', icon: 'crown', title: 'Make ' + fn + ' the main owner?',
            text: fn + ' becomes the main owner: nobody can remove them or make them Staff. You stay an Owner but lose that protection, and only ' + fn + ' can hand it back.',
            actions: [{ label: 'Make main owner', kind: 'btn-primary', keep: true, fn: function (btn, close) { btn.classList.add('is-loading'); api.makeMain(m.id).then(function (r) { close(); done(r, function () { render(); toast(first(m.name) + ' is now the main owner', true); }); }, fail(close)); } }, { label: 'Cancel' }] });
        }
        function removeDialog() {
          var inv = m.status === 'invited', n = m.devices.length;
          dialog({ tone: 'danger', icon: 'alert', title: inv ? 'Cancel ' + fn + '\'s invite?' : 'Remove ' + fn + '\'s access?',
            text: inv ? 'The invite stops working. ' + fn + ' moves to Removed, and you can invite them again later.'
              : fn + ' is signed out on ' + (n ? 'every phone (' + n + ')' : 'every phone') + ' straight away and can\'t sign in again. Their sales, invoices and history are kept. You can invite them again later.',
            actions: [{ label: inv ? 'Cancel invite' : 'Remove access', kind: 'btn-danger-solid', keep: true, fn: function (btn, close) { btn.classList.add('is-loading'); api.remove(m.id).then(function (r) { close(); done(r, function (res) { go('team'); afterNav(function () { toast(inv ? first(m.name) + '\'s invite cancelled' : first(m.name) + '\'s access removed' + (res.signedOut ? ' · signed out of ' + res.signedOut + ' phone' + (res.signedOut > 1 ? 's' : '') : ''), true); }, 300); }); }, fail(close)); } },
              { label: inv ? 'Keep invite' : 'Cancel' }] });
        }
        function allOutDialog() {
          var n = m.devices.length;
          dialog({ tone: 'danger', icon: 'logout', title: 'Sign out all of ' + fn + '\'s phones?', text: 'All ' + n + ' phones are signed out. Each needs ' + fn + '\'s PIN and an SMS code to sign in again. ' + fn + ' stays in the team.',
            actions: [{ label: 'Sign out ' + n + ' phones', kind: 'btn-danger-solid', keep: true, fn: function (btn, close) { btn.classList.add('is-loading'); api.signOutAll(m.id).then(function (r) { close(); done(r, function (res) { render(); toast(res.signedOut + ' phones signed out', true); }); }, fail(close)); } }, { label: 'Cancel' }] });
        }
        function reinviteSheet() {
          sheet('<h2>Invite ' + fn + ' again</h2><p>Choose their role. ' + fn + ' sets up again with an SMS code and a new PIN.</p><div style="height:.5rem"></div>' + roleOptions('re-role', m.role) +
            '<div class="acts"><button type="button" class="btn btn-primary btn-block" data-go2>' + icon('userplus') + 'Invite again</button><button type="button" class="btn btn-block" data-close>Cancel</button></div>', function (sh, close) {
            sh.querySelector('[data-go2]').addEventListener('click', function (ev) {
              var role = (sh.querySelector('input[name="re-role"]:checked') || {}).value || 'staff';
              ev.currentTarget.classList.add('is-loading');
              api.reinvite(m.id, role).then(function (r) { close(); done(r, function () { go('invited?id=' + m.id + '&again=1'); }); }, fail(close));
            });
          });
        }
      }
    };
  };

  /* ----- Staff and system screens ----- */
  function message(o) {
    return {
      shell: o.shell, full: !o.shell,
      html: '<section class="scr"><div class="scr-body center-col"><div class="msg-icon ' + (o.tone ? 'is-' + o.tone : '') + '">' + icon(o.icon) + '</div>' +
        '<h2 class="scr-title">' + o.title + '</h2><p class="scr-lead">' + o.text + '</p>' + (o.extra || '') + '</div>' +
        '<div class="scr-foot"' + (o.shell ? ' style="padding-bottom:104px"' : '') + '>' + o.buttons + '</div></section>',
      mount: o.mount
    };
  }
  S.noaccess = function () {
    return message({
      shell: 'more', icon: 'lock', title: 'Only owners can open this', text: 'Your role is ' + ROLE[me().role] + '. If you need this, ask an owner.',
      extra: '<div class="sim-inline"><button type="button" class="sim" data-as="lakshmi">Mock-up: switch to Lakshmi\'s view</button></div>',
      buttons: '<button type="button" class="btn btn-primary btn-block" data-go="home">Go to Home</button>',
      mount: function (el) { el.querySelector('[data-as]').addEventListener('click', function () { NH.setFlag('viewAs', 'lakshmi'); }); }
    });
  };
  S.removed = function () {
    return message({
      icon: 'alert', tone: 'danger', title: 'Your access has been removed', text: 'The owner removed this account from the Nandam Handlooms team. If you think this is a mistake, please contact the owner.',
      extra: '<div class="facts"><div>' + icon('check') + 'Sign-in keys were removed from this phone</div></div><div class="sim-inline"><button type="button" class="sim" data-as="lakshmi">Mock-up: back to Lakshmi\'s view</button></div>',
      buttons: '<button type="button" class="btn btn-primary btn-block" data-ok>OK</button>',
      mount: function (el) {
        el.querySelector('[data-ok]').addEventListener('click', function () { toast('Their phone goes to Sign in (Module 1)'); });
        el.querySelector('[data-as]').addEventListener('click', function () { NH.setFlag('viewAs', 'lakshmi'); go('team'); });
      }
    });
  };
  S.notsetup = function () {
    var v = me();
    return message({
      icon: 'send', title: esc(first(v.name)) + ' hasn\'t set up yet', text: 'On their phone they open the app, tap "First time here? Set up your account", get an SMS code and choose a PIN (Module 1).',
      extra: '<div class="sim-inline"><button type="button" class="sim" data-finish>Simulate: ' + esc(first(v.name)) + ' finishes setup</button><button type="button" class="sim" data-as="lakshmi">Back to Lakshmi\'s view</button></div>',
      buttons: '',
      mount: function (el) {
        el.querySelector('[data-finish]').addEventListener('click', function () { api.finishSetup(v.id).then(function () { demo.seen[v.id] = v.role; save(); go('home'); }, fail()); });
        el.querySelector('[data-as]').addEventListener('click', function () { NH.setFlag('viewAs', 'lakshmi'); });
      }
    });
  };

  /* ================= Render ================= */
  function bindGo(scope) { scope.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.go); }); }); }
  var lastViewer = null;
  function render() {
    timers.forEach(function (t) { clearTimeout(t); }); timers = [];
    closers = [];
    Array.prototype.slice.call(overlays.children).forEach(function (c) { if (!c.classList.contains('app-toast')) c.remove(); });
    var v = me(), name = current.name, fn = S[name] || S.more;
    // The viewer's own status decides first, as the server would on their next request.
    if (name !== 'removed' && v.status === 'removed') fn = S.removed;
    else if (name !== 'removed' && v.status === 'invited') fn = S.notsetup;
    else if (OWNER_ONLY[name] && !can('team.manage')) fn = S.noaccess;
    var scr = fn(current.params || {});
    var html = scr.shell ? shell(scr.shell, scr.html) : scr.html;
    viewport.innerHTML = html;
    root.classList.toggle('on-dark', false);
    var el = viewport.querySelector('.scr, .wa') || viewport.firstElementChild;
    bindGo(viewport);
    scr.mount && scr.mount(el);
    // Role changed by an owner since this person last checked in: say so once (the app does this on /me).
    if (v.status === 'active' && demo.seen[v.id] && demo.seen[v.id] !== v.role) {
      var was = demo.seen[v.id]; demo.seen[v.id] = v.role; save();
      afterNav(function () { toast('Your role is now ' + ROLE[v.role] + (was === 'owner' ? '. Some owner-only screens are hidden.' : '. Owner screens are now on.'), true); }, 350);
    } else if (v.status === 'active' && !demo.seen[v.id]) { demo.seen[v.id] = v.role; save(); }
    var spec = window.NH_SCREENS.filter(function (s) { return NH_ROUTE(s).split('?')[0] === name; })[0];
    if (state !== 'normal' && spec && spec.states.indexOf(state) < 0 && !window.NH_SCREENS.some(function (s) { return NH_ROUTE(s).split('?')[0] === name && s.states.indexOf(state) >= 0; })) NH.toast('"' + state + '" isn\'t a state of this screen. Try: ' + (spec.states.join(', ') || 'none'));
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && closers.length) { closers[closers.length - 1](); e.stopPropagation(); }
  });

  /* ================= Public API for the mock controls ================= */
  window.NHApp = {
    setState: function (s) { state = s; if (s === 'normal') ui[current.name] = undefined; render(); },
    go: go,
    action: function (name) {
      if (name === 'reset') { demo = freshDemo(); save(); ui = {}; lastViewer = 'lakshmi'; return go('more'); }
    }
  };

  /* ================= Boot ================= */
  function boot() {
    root = document.getElementById('app-root'); viewport = document.getElementById('app'); overlays = document.getElementById('app-overlays');
    if (EMBED) { document.body.className = 'embed'; document.body.innerHTML = ''; document.body.appendChild(root); }
    function syncPlatform() {
      var f = flags(); root.dataset.platform = f.platform;
      var dev = document.getElementById('device'); if (dev) dev.classList.toggle('is-android', f.platform === 'android');
    }
    syncPlatform();
    var size = '';
    function measure() { var s = root.clientWidth >= 700 ? 'tablet' : 'phone'; if (s !== size) { size = s; root.dataset.size = s; if (current.name) render(); } }
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(root); else window.addEventListener('resize', measure);
    measure();
    lastViewer = flags().viewAs;
    document.addEventListener('nh:options', function () { if (current.name) render(); });
    document.addEventListener('nh:flags', function () {
      syncPlatform();
      var v = flags().viewAs;
      if (v !== lastViewer) { lastViewer = v; var m = demo.members[v]; if (m) afterNav(function () { toast('Now showing ' + first(m.name) + '\'s phone · ' + (m.status === 'active' ? (m.main ? 'Main owner' : ROLE[m.role]) : m.status === 'invited' ? 'Invited' : 'Removed')); }, 150); }
      if (current.name) render();
    });
    window.addEventListener('hashchange', onRoute);
    onRoute();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
