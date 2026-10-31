/* The catalogue of Module 10 (Activity log) screens. Shared by the start page, the
   "Go to screen" menu, the review notes and the device preview. */
window.NH_GROUPS = [
  { id: 'list', title: 'Activity', who: 'Owners', desc: 'Every action, newest first, in plain words; filters and search.' },
  { id: 'detail', title: 'Look closer', who: 'Owners', desc: 'One entry with its details; a group of repeated actions.' },
  { id: 'other', title: 'Elsewhere', who: 'Owners and staff', desc: 'The security alert on Home; staff can\'t open Activity.' }
];

window.NH_SCREENS = [
  {
    id: 'all', route: 'activity?demo=1', group: 'list', icon: 'history', title: 'Activity',
    desc: 'Today, Yesterday, Sat 10 Oct: one plain sentence per action.',
    purpose: 'Who did what, and when, at a glance.',
    rules: ['One sentence with the details (6.4).', 'Important actions have an amber mark (6.7).', 'Repeated actions grouped (6.5).'],
    edges: ['Switch "List" and "Filters" A / B in Design options.', 'Tap the ₹54,310 price change.', 'Tap "added 48 sarees".'],
    fixes: ['Old app: codes as titles, 1,530 "Product created" rows, kept 30 days.'],
    states: ['loading', 'empty', 'error']
  },
  {
    id: 'kind', route: 'activity?kind=prices', group: 'list', icon: 'tag', title: 'Prices and catalogue',
    desc: 'One kind only: price changes, designs, photos, catalogue PDFs.',
    purpose: '"Who changed this price?"',
    rules: ['Kinds: Sales, Orders, Prices and catalogue, Products and tags, Team, Sign-in.'],
    edges: ['Try Sales and Sign-in.'],
    fixes: ['Old app: dates only.'],
    states: []
  },
  {
    id: 'important', route: 'activity?important=1', group: 'list', icon: 'alert', title: 'Important only',
    desc: 'Price changes, cancellations, Sell anyway, big bargains, deletions, new phones, locked PINs.',
    purpose: 'The few entries worth a look (6.7).',
    rules: ['A bargain is important under half the store price.'],
    edges: [],
    fixes: ['New.'],
    states: []
  },
  {
    id: 'search', route: 'activity?q=NH2264', group: 'list', icon: 'search', title: 'Search',
    desc: 'A tag, an order or invoice number, a design, a person.',
    purpose: '"Who touched NH2264?"',
    rules: ['Searches every kept entry, not just the screen.'],
    edges: ['Search Gap Border, H1001830, Anil.'],
    fixes: ['Old app: no search.'],
    states: ['empty']
  },
  {
    id: 'filters', route: 'activity?demo=filters', group: 'list', icon: 'filter', title: 'Filters',
    desc: 'Person, period, Important only.',
    purpose: 'Narrow the list (6.6).',
    rules: ['Former team members stay in the person list.', 'Periods: Today, 7 days, 30 days, any dates.'],
    edges: ['Pick Ravi and 7 days.'],
    fixes: [],
    states: []
  },
  {
    id: 'entry', route: 'entry?id=e3', group: 'detail', icon: 'doc', title: 'One entry',
    desc: 'The ₹3,800 → ₹54,310 price change: who, when, which phone, before → after.',
    purpose: 'Every detail, and a link to the thing itself.',
    rules: ['Phone name, not the IP address (6.10).', 'Open goes to the design, sale, order, saree or person.'],
    edges: ['Tap Open.'],
    fixes: ['Old app: the IP address was sent but never shown.'],
    states: []
  },
  {
    id: 'group', route: 'entry?id=g1', group: 'detail', icon: 'layers', title: 'A group',
    desc: '"System Admin added 48 sarees to Rainbow checks sarees": the 48 inside.',
    purpose: 'Big stock entries stay readable (6.5).',
    rules: ['Same person, same action, same design, less than 10 minutes apart.'],
    edges: [],
    fixes: ['Old app: one row each (1,530 in a week).'],
    states: []
  },
  {
    id: 'home', route: 'home-alert', group: 'other', icon: 'shield', title: 'Home · security alert',
    desc: 'For 24 hours: "Ravi\'s PIN was locked after 5 wrong tries".',
    purpose: 'Know the same day (6.8).',
    rules: ['Only locked PINs and blocked stolen sign-ins.', 'Owners only.'],
    edges: ['Tap it: Activity on Sign-in.'],
    fixes: ['New.'],
    states: []
  },
  {
    id: 'staff', route: 'activity?as=staff', group: 'other', icon: 'lock', title: 'Staff',
    desc: 'Activity is for owners.',
    purpose: 'Staff don\'t see everyone\'s actions (6.1, 6.12).',
    rules: ['The server refuses staff, not just the app.'],
    edges: [],
    fixes: [],
    states: []
  }
];

window.NH_SCREEN = function (id) { return window.NH_SCREENS.find(function (s) { return s.id === id; }); };
window.NH_ROUTE = function (s) { return s.route || s.id; };
