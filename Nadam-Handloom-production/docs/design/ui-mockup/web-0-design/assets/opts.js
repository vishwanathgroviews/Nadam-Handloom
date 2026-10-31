/* Website mock-up: icons, the three looks (Design options panel), saved choices and the
   list of every screen. Shared by the website, the start page, the design kit and the
   device preview. The panel is a mock-up control, not part of the website. */
(function () {
  'use strict';
  var NH = window.NH = window.NH || {};

  /* ---------- Icons (24px line set) ---------- */
  var P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    bag: '<path d="M5 8h14l-1.2 12H6.2L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    right: '<path d="M9.5 6l6 6-6 6"/>', left: '<path d="M14.5 6l-6 6 6 6"/>', down: '<path d="M6 9.5l6 6 6-6"/>', up: '<path d="M6 14.5l6-6 6 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    truck: '<path d="M3 6.5h11v9H3zM14 9.5h3.6l3.4 3.3v2.7h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.1-7.5 9.5-4.3-1.4-7.5-4.9-7.5-9.5V6L12 3z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    store: '<path d="M4 9.5L5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 11.5V20h13v-8.5M10 20v-5h4v5"/>',
    pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
    phone: '<path d="M7 3.5h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 5 5.7 2 2 0 0 1 7 3.5z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    whatsapp: '<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.2A8.5 8.5 0 1 1 20.5 12z"/><path d="M9 8.5c0 3.5 2.6 6.5 6.5 6.5l1-1.6-2-1-1 1c-1.4-.6-2.4-1.6-3-3l1-1-1-2L9 8.5z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 4l9 16H3L12 4z"/><path d="M12 10v4M12 17h.01"/>', alertc: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>',
    thread: '<circle cx="12" cy="12" r="8"/><path d="M4.5 9.5c5 1 10 1 15 0M4.5 14.5c5-1 10-1 15 0M9.5 4.5c1 5 1 10 0 15M14.5 4.5c-1 5-1 10 0 15"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6M11 8v6"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="17.5" cy="6" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="M8.3 10.8l7-3.6M8.3 13.2l7 3.6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    g2: '<rect x="4" y="4" width="7" height="16" rx="1"/><rect x="13" y="4" width="7" height="16" rx="1"/>',
    g3: '<rect x="3" y="4" width="4.6" height="16" rx="1"/><rect x="9.7" y="4" width="4.6" height="16" rx="1"/><rect x="16.4" y="4" width="4.6" height="16" rx="1"/>',
    g4: '<rect x="3" y="4" width="3.5" height="7" rx=".8"/><rect x="8.5" y="4" width="3.5" height="7" rx=".8"/><rect x="14" y="4" width="3.5" height="7" rx=".8"/><rect x="3" y="13" width="3.5" height="7" rx=".8"/><rect x="8.5" y="13" width="3.5" height="7" rx=".8"/><rect x="14" y="13" width="3.5" height="7" rx=".8"/>',
    box: '<path d="M20.5 7.5L12 3 3.5 7.5 12 12l8.5-4.5z"/><path d="M3.5 7.5v9L12 21l8.5-4.5v-9M12 12v9"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    logout: '<path d="M9.5 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h3"/><path d="M15.5 16.5L20 12l-4.5-4.5M20 12H9.5"/>',
    home: '<path d="M3.5 10.5L12 4l8.5 6.5"/><path d="M5.5 9.5V20h13V9.5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>', trash: '<path d="M4.5 7h15M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 3.5V8h4.5M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20.5V16h-4.5"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    sliders: '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    upi: '<path d="M6 4l4 16M13 4l-3 8M14 4l4 16"/>', bank: '<path d="M3.5 9.5L12 4.5l8.5 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3.5 20h17"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18v-3H3zM12 6v14M12 6c-1.5-3-5-3-5-1s3 1 5 1zm0 0c1.5-3 5-3 5-1s-3 1-5 1z"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5C21 6.4 17 3 12 3z"/>',
    type: '<path d="M5 7V5h14v2M9.5 19h5M12 5v14"/>', star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8L12 3.5z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    laptop: '<rect x="4" y="4.5" width="16" height="11" rx="1.5"/><path d="M2 19.5h20"/>', phonedev: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    tablet: '<rect x="3.5" y="3" width="17" height="18" rx="2.5"/><path d="M11 18h2"/>', doc: '<path d="M14 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9L14 3.5z"/><path d="M14 3.5V9h5.5M8.5 13h7M8.5 16.5h5"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    wifioff: '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.6-2.5M19 12.6a10 10 0 0 0-2.3-1.6M2 8.8a15 15 0 0 1 4-2.5M22 8.8A15 15 0 0 0 11 5.1M12 20h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    contrast: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/>',
    tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5z"/>'
  };
  NH.icon = function (n, cls) { return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || P.info) + '</svg>'; };
  NH.iconNames = Object.keys(P);

  /* ---------- The three looks and the options ---------- */
  NH.DESIGNS = {
    a: { theme: 'light', palette: 'a', font: 'a', corners: 'crisp', header: 'a', hero: 'a', card: 'a', pdp: 'a', motion: 'full' },
    b: { theme: 'light', palette: 'b', font: 'b', corners: 'soft', header: 'b', hero: 'b', card: 'b', pdp: 'b', motion: 'calm' },
    c: { theme: 'auto', palette: 'c', font: 'c', corners: 'crisp', header: 'c', hero: 'c', card: 'a', pdp: 'b', motion: 'full' }   // the owner's picks, 15 Oct
  };
  NH.OPTIONS = [
    { key: 'design', title: 'Design (sets everything below)', choices: [['a', 'A', 'Heritage: ivory, maroon & zari gold'], ['b', 'B', 'Atelier: modern white & peacock'], ['c', 'C', 'Utsav: festive night & gold (chosen)']] },
    { key: 'theme', title: 'Theme', choices: [['light', 'A', 'Light'], ['dark', 'B', 'Dark'], ['auto', 'C', 'Auto (follow device)']] },
    { key: 'palette', title: 'Colours', choices: [['a', 'A', 'Maroon & zari gold'], ['b', 'B', 'Peacock & brass'], ['c', 'C', 'Kumkum & festive gold']] },
    { key: 'font', title: 'Fonts', choices: [['a', 'A', 'Cormorant + Manrope'], ['b', 'B', 'Instrument Serif + Hanken Grotesk'], ['c', 'C', 'Bodoni Moda + Figtree']] },
    { key: 'corners', title: 'Corners', choices: [['crisp', 'A', 'Crisp'], ['soft', 'B', 'Soft']] },
    { key: 'header', title: 'Top menu', choices: [['a', 'A', 'Logo centred, menu below'], ['b', 'B', 'Logo left, menu in one line, search box'], ['c', 'C', 'Minimal: menu icon, full-screen menu']] },
    { key: 'hero', title: 'Home: opening', choices: [['a', 'A', 'Full-screen cinematic, words on the left'], ['b', 'B', 'Editorial split with layered photos'], ['c', 'C', 'Full-screen cinematic, words centred']] },
    { key: 'card', title: 'Saree card', choices: [['a', 'A', 'Gallery frame on a soft mat'], ['b', 'B', 'Clean, edge to edge'], ['c', 'C', 'Details over the photo']] },
    { key: 'pdp', title: 'Saree page', choices: [['a', 'A', 'Photo + close-ups, details beside'], ['b', 'B', 'Large photos, details stay in view']] },
    { key: 'motion', title: 'Motion', choices: [['full', 'A', 'Full'], ['calm', 'B', 'Calm'], ['off', 'C', 'Off']] }
  ];
  var OPT_KEY = 'nh-web-options', FLAG_KEY = 'nh-web-flags';
  function read(k, f) { try { var v = JSON.parse(localStorage.getItem(k)); return v || f; } catch (e) { return f; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  // Default: design C, the owner's pick (15 Oct).
  NH.opts = (function () { var s = read(OPT_KEY, {}), o = Object.assign({ design: 'c' }, NH.DESIGNS[s.design || 'c']); Object.keys(s).forEach(function (k) { o[k] = s[k]; }); return o; })();
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function hostMode() { var h = document.documentElement.getAttribute('data-theme'); return h === 'dark' || h === 'light' ? h : (mq && mq.matches ? 'dark' : 'light'); }
  NH.applyOptions = function () {
    var r = document.documentElement, o = NH.opts;
    r.setAttribute('data-mode', o.theme === 'auto' ? hostMode() : o.theme);
    ['palette', 'font', 'corners', 'header', 'hero', 'card', 'pdp', 'motion'].forEach(function (k) { r.setAttribute('data-' + k, o[k]); });
    r.setAttribute('data-design', o.design);
    document.dispatchEvent(new CustomEvent('nh:options'));
  };
  NH.setOption = function (k, v) {
    if (k === 'design') { NH.opts = Object.assign({ design: v }, NH.DESIGNS[v]); write(OPT_KEY, { design: v }); }
    else { NH.opts[k] = v; var s = read(OPT_KEY, {}); s.design = NH.opts.design; s[k] = v; write(OPT_KEY, s); }
    NH.applyOptions(); NH.renderPanel && NH.renderPanel();
  };
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (NH.opts.theme === 'auto') NH.applyOptions(); });
  window.addEventListener('storage', function (e) {
    if (e.key === OPT_KEY) { var s = read(OPT_KEY, {}); NH.opts = Object.assign({ design: s.design || 'c' }, NH.DESIGNS[s.design || 'c'], s); NH.applyOptions(); NH.renderPanel && NH.renderPanel(); }
    if (e.key === FLAG_KEY) document.dispatchEvent(new CustomEvent('nh:flags'));
  });
  NH.applyOptions();

  var FLAG_DEFAULTS = { signedIn: false };
  NH.flags = function () { return Object.assign({}, FLAG_DEFAULTS, read(FLAG_KEY, {})); };
  NH.setFlag = function (k, v) { var f = NH.flags(); f[k] = v; write(FLAG_KEY, f); document.dispatchEvent(new CustomEvent('nh:flags')); NH.renderPanel && NH.renderPanel(); };
  NH.store = { read: read, write: write };

  /* ---------- Every screen (start page, Go to screen, device preview) ---------- */
  NH.GROUPS = [
    { id: 'w1', title: 'W1 · Sign in and my account', who: 'Customers', desc: 'Module W1 (planned with the owner): mobile + SMS code, a short profile once, 30-day sign-in, profile and picture, addresses, notifications, devices, delete account.' },
    { id: 'browse', title: 'Shopping', who: 'Every visitor', desc: 'Finding sarees: home, collections, a category, the full list with filters, search and the saree page.' },
    { id: 'buy', title: 'Bag and checkout', who: 'Every visitor', desc: 'Bag, signing in at checkout, address, payment (Razorpay) and the order confirmation.' },
    { id: 'account', title: 'Orders', who: 'Signed-in customers', desc: 'Orders with DTDC tracking and the invoice (module W7).' },
    { id: 'brand', title: 'Brand and help', who: 'Every visitor', desc: 'Our story, visit the store in Old Mangalagiri, help and policies, wishlist (planned).' },
    { id: 'states', title: 'Site states', who: 'Shop', desc: 'Maintenance message and page not found.' }
  ];
  NH.SCREENS = [
    { id: 'home', route: 'home', group: 'browse', icon: 'home', title: 'Home (premium)', desc: 'Intro reveal, full-screen cinematic opening, brand statement, editorial collection grid, new arrivals, spotlight, occasion edits that slide as you scroll, the craft story, the store.' },
    { id: 'collections', route: 'collections', group: 'browse', icon: 'grid', title: 'All collections', desc: 'All 61 collections, filtered by category or craft.' },
    { id: 'category', route: 'c/mangalagiri-handloom-pattu-sarees', group: 'browse', icon: 'thread', title: 'Category: Mangalagiri pattu sarees', desc: 'Category banner, its collections in a sliding row, then its sarees.' },
    { id: 'shop', route: 'shop', group: 'browse', icon: 'filter', title: 'All sarees with filters', desc: 'Filters (category, craft, collection, price, stock), sort, 2/3/4 per row, Load more.' },
    { id: 'collection', route: 'shop?col=COL1', group: 'browse', icon: 'box', title: 'One collection', desc: 'The list filtered to one collection.' },
    { id: 'search', route: 'search?q=applique', group: 'browse', icon: 'search', title: 'Search results', desc: 'Results for "applique". The search box at the top shows suggestions while typing.' },
    { id: 'product', route: 'p/PROD1', group: 'browse', icon: 'eye', title: 'Saree page', desc: 'Photo with close-ups and zoom, price, stock, Add to bag, delivery check, details, more from the collection.' },
    { id: 'productset', route: 'p/PRODSET', group: 'browse', icon: 'spark', title: 'Saree page: a set (several in stock)', desc: 'A design with more than one in stock: "Only N left" and a quantity choice.' },
    { id: 'soldout', route: 'p/PROD2?sold=1', group: 'browse', icon: 'alertc', title: 'Saree page: sold out', desc: 'Sold out: Notify me (planned) and similar sarees.' },
    { id: 'bag', route: 'bag', group: 'buy', icon: 'bag', title: 'Bag', desc: 'Sarees in the bag, quantity for sets, free delivery, total. The bag also opens as a side panel.' },
    { id: 'checkout', route: 'checkout', group: 'buy', icon: 'lock', title: 'Checkout', desc: 'Step 1 sign in (if needed), step 2 address, step 3 review and pay with Razorpay.' },
    { id: 'paid', route: 'confirmed?state=paid', group: 'buy', icon: 'check', title: 'Order placed', desc: 'Paid: thank-you, “Get updates about this order here?” (Firebase notifications), what happens next.' },
    { id: 'pending', route: 'confirmed?state=pending', group: 'buy', icon: 'clock', title: 'Payment being confirmed', desc: 'Razorpay has not confirmed yet: the page checks again.' },
    { id: 'failed', route: 'confirmed?state=failed', group: 'buy', icon: 'alert', title: 'Payment failed', desc: 'Nothing was charged; the sarees are kept for 15 minutes; try again.' },
    { id: 'signin', route: 'signin', group: 'w1', icon: 'phone', title: '1 · Sign in: mobile number', desc: 'One screen for sign-in and sign-up. Mobile number, then "Send code". No password.' },
    { id: 'signcode', route: 'signin?step=code', group: 'w1', icon: 'lock', title: '2 · Enter the SMS code', desc: '6 boxes (fills itself on Android), resend after 60 seconds, 3 tries. Sample code 123456.' },
    { id: 'signprofile', route: 'signin?step=profile&demo=new', group: 'w1', icon: 'user', title: '3 · Complete your profile (new customer)', desc: 'Full name, email, pincode → city and state, offers tick. Once only.' },
    { id: 'account', route: 'account', group: 'w1', icon: 'user', title: 'My account', desc: 'Picture, greeting, profile completeness, latest order, addresses, notifications.' },
    { id: 'profile', route: 'account?tab=profile', group: 'w1', icon: 'edit', title: 'Profile', desc: 'Picture, name, email, change mobile (code on the new number), pincode → city and state, language, birthday, anniversary.' },
    { id: 'addresses', route: 'account?tab=addresses', group: 'w1', icon: 'pin', title: 'Addresses', desc: 'Add (pincode fills city and state), edit, delete, label (Home / Office), landmark, default.' },
    { id: 'notify', route: 'account?tab=notifications', group: 'w1', icon: 'spark', title: 'Notifications (Firebase)', desc: 'Turn on browser notifications; choose order updates, new arrivals, offers by notification or email.' },
    { id: 'devices', route: 'account?tab=devices', group: 'w1', icon: 'laptop', title: 'Signed-in devices', desc: '30-day sign-in per device; sign one out, or all.' },
    { id: 'delete', route: 'account?tab=delete', group: 'w1', icon: 'trash', title: 'Delete account (7 days to cancel)', desc: 'Request, then a banner with "Keep my account" for 7 days.' },
    { id: 'checkoutsign', route: 'checkout?s=mobile', group: 'w1', icon: 'lock', title: 'Sign in inside checkout', desc: 'The same mobile + code steps inside step 1 of checkout; a new customer’s account is made on the spot.' },
    { id: 'orders', route: 'orders', group: 'account', icon: 'box', title: 'My orders', desc: 'Every order with its status.' },
    { id: 'order', route: 'order/NH51204488', group: 'account', icon: 'truck', title: 'Order with tracking', desc: 'Timeline from paid to delivered, DTDC tracking number, invoice, help on WhatsApp.' },
    { id: 'story', route: 'story', group: 'brand', icon: 'thread', title: 'Our story', desc: 'Mangalagiri weaving, the shop, numbers from the live catalogue.' },
    { id: 'store', route: 'store', group: 'brand', icon: 'store', title: 'Visit the store', desc: 'Address, hours, directions, call and WhatsApp.' },
    { id: 'help', route: 'help', group: 'brand', icon: 'info', title: 'Help and policies', desc: 'Delivery, returns and exchanges, payments, care, FAQs, contact (text to confirm).' },
    { id: 'wishlist', route: 'wishlist', group: 'brand', icon: 'heart', title: 'Wishlist (planned)', desc: 'Saved sarees. New: the website has no wishlist today.' },
    { id: 'maintenance', route: 'maintenance', group: 'states', icon: 'tools', title: 'Maintenance', desc: 'When the shop turns the website off from the admin app.' },
    { id: 'notfound', route: 'nope', group: 'states', icon: 'alertc', title: 'Page not found', desc: 'A wrong link: search and popular collections.' }
  ];
  // Fill the sample ids (real sarees from the live catalogue) once the data is loaded.
  NH.resolveRoute = function (r) {
    var D = window.NH_DATA; if (!D) return r;
    var bigCol = D.collections[0], setP = D.products.filter(function (p) { return p.avail > 2; })[0] || D.products[0];
    var p1 = D.products.filter(function (p) { return p.avail === 1; })[3] || D.products[1];
    var p2 = D.products.filter(function (p) { return p.avail === 1; })[9] || D.products[2];
    return r.replace('COL1', bigCol.id).replace('PRODSET', setP.slug).replace('PROD1', p1.slug).replace('PROD2', p2.slug);
  };

  /* ---------- Design options panel (mock-up control) ---------- */
  var open = false, last = null;
  NH.toast = function (msg) {
    var t = document.createElement('div'); t.className = 'nh-mock-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  };
  function targets() {
    var list = []; if (window.NHSite) list.push(window.NHSite);
    document.querySelectorAll('iframe[data-site]').forEach(function (f) { try { if (f.contentWindow.NHSite) list.push(f.contentWindow.NHSite); } catch (e) { } });
    return list;
  }
  NH.goScreen = function (route) {
    route = NH.resolveRoute(route);
    if (window.NHSite) { location.hash = '#/' + route; return; }
    if (NH.onGoScreen) return NH.onGoScreen(route);
    location.href = 'site.html#/' + route;
  };
  NH.renderPanel = function () {
    var panel = document.getElementById('nh-panel'); if (!panel) return;
    var o = NH.opts, f = NH.flags(), site = !!targets().length;
    var h = '<div class="nh-ph"><b>' + NH.icon('sliders', 'ico-sm') + ' Design options</b><span class="mock-tag">Mock-up control</span><button type="button" class="nh-x" data-close aria-label="Close design options">' + NH.icon('x', 'ico-sm') + '</button></div><div class="nh-pb">';
    NH.OPTIONS.forEach(function (d) {
      h += '<div class="nh-g" role="group" aria-label="' + d.title + '"><div class="nh-t">' + d.title + '</div><div class="nh-r">';
      d.choices.forEach(function (c) { h += '<button type="button" data-opt="' + d.key + '" data-val="' + c[0] + '" aria-pressed="' + (o[d.key] === c[0]) + '"><i>' + c[1] + '</i>' + c[2] + '</button>'; });
      h += '</div></div>';
    });
    h += '<div class="nh-g"><button type="button" class="nh-copy" data-copy>' + NH.icon('copy', 'ico-sm') + ' Copy my choices</button></div>';
    h += '<div class="nh-g"><div class="nh-t"><label for="nh-go">Go to screen</label></div><select id="nh-go"><option value="">Choose a screen…</option>';
    NH.GROUPS.forEach(function (g) { h += '<optgroup label="' + g.title + '">'; NH.SCREENS.filter(function (s) { return s.group === g.id; }).forEach(function (s) { h += '<option value="' + s.route + '">' + s.title + '</option>'; }); h += '</optgroup>'; });
    h += '</select><p class="nh-n"><a href="index.html">Start page</a> · <a href="kit.html">Design kit</a> · <a href="preview.html">Device preview</a></p></div>';
    h += '<div class="nh-g"><div class="nh-t">Screen states <small>for the open screen</small></div><div class="nh-r nh-states">';
    [['normal', 'Normal'], ['loading', 'Loading'], ['empty', 'Empty'], ['error', 'Error'], ['success', 'Success'], ['warning', 'Warning'], ['popup', 'Pop-up']].forEach(function (s) { h += '<button type="button" data-state="' + s[0] + '">' + s[1] + '</button>'; });
    h += '</div></div>';
    if (site) {
      h += '<div class="nh-g"><div class="nh-t">Demo <small>sample customer</small></div><div class="nh-r nh-states"><button type="button" data-flag="signedIn" aria-pressed="' + !!f.signedIn + '">' + (f.signedIn ? 'Signed in as Priya (sample)' : 'Signed out') + '</button><button type="button" data-action="reset">Reset demo</button></div>' +
        '<p class="nh-n">Sarees, photos, collections, prices and stock: the live website (' + ((window.NH_DATA && window.NH_DATA.totals.fetchedAt) || '') + '). Customer, orders and addresses: sample. Changes stay in this browser.</p></div>';
    }
    panel.innerHTML = h + '</div>';
  };
  function copyChoices() {
    var lines = ['Nandam Handlooms website mock-up: my choices'];
    NH.OPTIONS.forEach(function (d) { var c = d.choices.filter(function (x) { return x[0] === NH.opts[d.key]; })[0]; if (c) lines.push(d.title.replace(/ \(.*\)/, '') + ': ' + c[1] + ' (' + c[2] + ')'); });
    var text = lines.join('\n');
    function done() { NH.toast('Copied. Paste it in the chat.'); }
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { NH.toast('Select and copy: ' + text); } ta.remove(); }
    try { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback(); } catch (e) { fallback(); }
  }
  function setOpen(v) {
    var panel = document.getElementById('nh-panel'), fab = document.getElementById('nh-fab'); if (!panel) return;
    open = v; panel.classList.toggle('on', v); fab.setAttribute('aria-expanded', String(v));
    if (v) { last = document.activeElement; var b = panel.querySelector('button[aria-pressed="true"]') || panel.querySelector('button'); b && b.focus(); } else if (last) last.focus();
  }
  NH.mountPanel = function () {
    if (document.body.classList.contains('embed') || document.getElementById('nh-panel')) return;
    var css = document.createElement('style');
    css.textContent = '.nh-fab{position:fixed;z-index:100;left:calc(18px + env(safe-area-inset-left,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));display:inline-flex;align-items:center;gap:.45rem;padding:.7rem 1rem;border-radius:999px;border:1.5px dashed #B7791F;background:#FFF6E5;color:#6B4508;font:700 13px/1 ui-monospace,Menlo,monospace;letter-spacing:.04em;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18)}' +
      '.nh-panel{position:fixed;z-index:101;left:calc(18px + env(safe-area-inset-left,0px));bottom:calc(74px + env(safe-area-inset-bottom,0px));width:min(380px,calc(100vw - 36px));max-height:min(78vh,760px);overflow:auto;background:#FFFCF6;color:#2B2116;border:1.5px dashed #B7791F;border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.28);font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;opacity:0;visibility:hidden;transform:translateY(10px);transition:all .25s}' +
      '.nh-panel.on{opacity:1;visibility:visible;transform:none}.nh-ph{position:sticky;top:0;display:flex;align-items:center;gap:.5rem;padding:.8rem .9rem;background:#FFF3DD;border-bottom:1px dashed #D9B36C;z-index:1}.nh-ph b{display:flex;gap:.4rem;align-items:center;font-size:14px}.nh-x{margin-left:auto;width:32px;height:32px;border-radius:50%;border:0;background:transparent;cursor:pointer;display:grid;place-items:center;color:inherit}' +
      '.nh-pb{padding:.4rem .9rem 1rem}.nh-g{padding:.6rem 0;border-bottom:1px dashed #EAD7B0}.nh-g:last-child{border:0}.nh-t{font-weight:700;font-size:12px;letter-spacing:.04em;margin-bottom:.4rem;color:#6B4508}.nh-t small{font-weight:500;color:#9A7A44;margin-left:.3rem}.nh-r{display:grid;gap:.3rem}.nh-r button{display:flex;gap:.5rem;align-items:center;text-align:left;padding:.45rem .6rem;border-radius:8px;border:1px solid #E7D5B3;background:#fff;color:#2B2116;cursor:pointer;font:inherit}.nh-r button i{font-style:normal;font-weight:800;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#F3E6CC;font-size:11px;flex:none}' +
      '.nh-r button[aria-pressed="true"]{border-color:#8A5A10;background:#FFF0D2;box-shadow:inset 0 0 0 1px #8A5A10}.nh-r button[aria-pressed="true"] i{background:#8A5A10;color:#fff}.nh-states{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}.nh-states button{justify-content:center}.nh-copy{width:100%;display:flex;justify-content:center;gap:.4rem;align-items:center;padding:.6rem;border-radius:8px;border:0;background:#8A5A10;color:#fff;font:600 13px system-ui;cursor:pointer}#nh-go{width:100%;padding:.5rem;border-radius:8px;border:1px solid #E7D5B3;background:#fff;color:#2B2116;font:inherit}.nh-n{margin:.5rem 0 0;color:#7A6040;font-size:12px}.nh-n a{color:#8A5A10;text-decoration:underline}' +
      '.nh-mock-toast{position:fixed;z-index:120;left:50%;top:18px;transform:translateX(-50%);background:#2B2116;color:#FFF3DD;padding:.6rem 1rem;border-radius:999px;font:600 13px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.25)}.nh-fab .ico,.nh-panel .ico{width:16px;height:16px}@media (max-width:600px){.nh-fab{padding:.65rem;bottom:calc(84px + env(safe-area-inset-bottom,0px))}.nh-fab span{display:none}.nh-panel{bottom:calc(140px + env(safe-area-inset-bottom,0px))}}';
    document.head.appendChild(css);
    var fab = document.createElement('button'); fab.id = 'nh-fab'; fab.className = 'nh-fab'; fab.type = 'button'; fab.setAttribute('aria-controls', 'nh-panel'); fab.setAttribute('aria-expanded', 'false'); fab.innerHTML = NH.icon('sliders') + '<span>Design options</span>'; fab.setAttribute('aria-label', 'Design options (mock-up control)');
    var panel = document.createElement('div'); panel.id = 'nh-panel'; panel.className = 'nh-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Design options (mock-up control)');
    document.body.appendChild(panel); document.body.appendChild(fab); NH.renderPanel();
    fab.addEventListener('click', function () { setOpen(!open); });
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) return setOpen(false);
      if (b.dataset.opt) return NH.setOption(b.dataset.opt, b.dataset.val);
      if (b.hasAttribute('data-copy')) return copyChoices();
      if (b.dataset.state) { var t = targets(); if (!t.length) return NH.toast('Screen states work on website screens. Pick one in "Go to screen".'); t.forEach(function (s) { s.setState(b.dataset.state); }); return; }
      if (b.dataset.flag) return NH.setFlag(b.dataset.flag, !NH.flags()[b.dataset.flag]);
      if (b.dataset.action === 'reset') { targets().forEach(function (s) { s.reset(); }); NH.toast('Demo reset'); }
    });
    panel.addEventListener('change', function (e) { if (e.target.id === 'nh-go' && e.target.value) { NH.goScreen(e.target.value); e.target.value = ''; } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) setOpen(false); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', NH.mountPanel); else NH.mountPanel();
})();
