/* The catalogue of Module 11 (Settings) screens. Shared by the start page, the
   "Go to screen" menu, the review notes and the device preview. */
window.NH_GROUPS = [
  { id: 'owner', title: 'Settings', who: 'Owners', desc: 'Maintenance, app updates, shop details, shop rules, about.' },
  { id: 'staff', title: 'What staff see', who: 'Staff (and old phones)', desc: 'The maintenance screen, the update screen, the new-version banner.' },
  { id: 'other', title: 'Edge cases', who: 'Owners and staff', desc: 'Fewer than two owners; staff can\'t open Settings.' }
];

window.NH_SCREENS = [
  {
    id: 'settings', route: 'settings?demo=1', group: 'owner', icon: 'sliders', title: 'Settings',
    desc: 'Maintenance · App updates · Shop details · Shop rules · About, each with "Last changed by".',
    purpose: 'Run the app itself without a developer.',
    rules: ['Owners only (6.1); every change goes to the Activity log.', 'The real saved values: maintenance off, Android newest 23 (the app is at 25), iPhone 3 (app at 6).'],
    edges: ['Switch "Layout" and "Saving" A / B in Design options.', 'Turn on staff maintenance.'],
    fixes: ['Old app: one long page; who changed it never shown; the error far from Save.'],
    states: ['loading', 'error']
  },
  {
    id: 'maint', route: 'settings?demo=maint', group: 'owner', icon: 'alert', title: 'Turn on maintenance',
    desc: 'Asks first, with your message; then "On since 3:10 pm, by Lakshmi".',
    purpose: 'Pause the staff app while you fix prices (6.2).',
    rules: ['Owners keep working.', 'The server refuses staff too (6.3).', 'Staff phones switch within a minute.'],
    edges: ['Turn it off again.', 'Try the website switch.'],
    fixes: ['Old app: only the app checked it; staff could still sign in.'],
    states: []
  },
  {
    id: 'updates', route: 'updates', group: 'owner', icon: 'download', title: 'App updates',
    desc: 'This phone\'s version, newest, oldest allowed; "Require this version for everyone".',
    purpose: 'Move every phone to a new version (6.4).',
    rules: ['Warns about phones still on older versions.', 'Numbers and store links under Advanced.'],
    edges: ['Press "Require this version for everyone".', 'Open Advanced.', 'Switch to iPhone in Design options.'],
    fixes: ['Old app: build numbers typed by hand, already out of date.'],
    states: []
  },
  {
    id: 'shop', route: 'shop', group: 'owner', icon: 'store', title: 'Shop details',
    desc: 'Name, address, mobile, GSTIN, website; the invoice letterhead preview.',
    purpose: 'The details on every invoice (6.5).',
    rules: ['GSTIN checked (15 characters).', 'New invoices only; old ones keep theirs.', 'Website address used in WhatsApp product links (6.7).'],
    edges: ['Type a wrong GSTIN.', 'Change the mobile and watch the preview.'],
    fixes: ['Old app: a server setting only a developer could change.'],
    states: []
  },
  {
    id: 'rules', route: 'rules', group: 'owner', icon: 'list', title: 'Shop rules',
    desc: 'The fixed numbers the app uses, read-only.',
    purpose: 'Everyone knows the rules (6.6).',
    rules: ['Ask and a rule can become a setting.'],
    edges: [],
    fixes: ['New.'],
    states: []
  },
  {
    id: 'about', route: 'about', group: 'owner', icon: 'info', title: 'About and owners',
    desc: 'Versions, owners who can sign in, settings changes in Activity.',
    purpose: 'What is running, and who can get back in (6.9).',
    rules: ['Warns when fewer than 2 owners can sign in.'],
    edges: ['Try "Fewer than 2 owners" below.'],
    fixes: [],
    states: []
  },
  {
    id: 'smaint', route: 'staff-maint', group: 'staff', icon: 'clock', title: 'Maintenance screen',
    desc: 'What a staff phone shows while the staff app is paused.',
    purpose: 'Staff know why and when.',
    rules: ['Shows the owner\'s message.', '"Try again" checks at once; it also checks by itself every minute.'],
    edges: [],
    fixes: ['Old app: staff could sign in first, then see it.'],
    states: []
  },
  {
    id: 'supdate', route: 'staff-update', group: 'staff', icon: 'download', title: 'Update required',
    desc: 'A phone on an older version than allowed, owners too.',
    purpose: 'Every phone on the version that works with the server.',
    rules: ['"Update" opens the store page.', '"Check again" after updating.'],
    edges: ['Switch to iPhone.'],
    fixes: [],
    states: []
  },
  {
    id: 'sbanner', route: 'staff-banner', group: 'staff', icon: 'sparkle', title: 'New version banner',
    desc: '"A new version is available" with Update and Later.',
    purpose: 'Nudges without blocking.',
    rules: ['"Later" hides it for a day.'],
    edges: ['Tap Later.'],
    fixes: ['Old app: never shown, as the saved newest build was behind.'],
    states: []
  },
  {
    id: 'owners', route: 'about?demo=oneowner', group: 'other', icon: 'users', title: 'Fewer than 2 owners',
    desc: 'The warning when only one owner can sign in.',
    purpose: 'Avoid being locked out for good (6.9).',
    rules: ['Another owner removes a lost number and invites the new one (Module 2).'],
    edges: [],
    fixes: ['Parked from Module 1.'],
    states: []
  },
  {
    id: 'staff', route: 'settings?as=staff', group: 'other', icon: 'lock', title: 'Staff',
    desc: 'Settings is for owners.',
    purpose: 'Staff see only the results.',
    rules: ['The server refuses staff, not just the app.'],
    edges: [],
    fixes: [],
    states: []
  }
];

window.NH_SCREEN = function (id) { return window.NH_SCREENS.find(function (s) { return s.id === id; }); };
window.NH_ROUTE = function (s) { return s.route || s.id; };
