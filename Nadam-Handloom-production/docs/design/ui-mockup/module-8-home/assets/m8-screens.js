/* The catalogue of Module 8 (Home) screens. Shared by the start page, the
   "Go to screen" menu, the review notes and the device preview. */
window.NH_GROUPS = [
  { id: 'owner', title: 'Home for owners', who: 'Owners', desc: 'Today\'s sales, what needs doing, shortcuts, the last sales.' },
  { id: 'staff', title: 'Home for staff', who: 'Staff', desc: 'Their own sarees today, what needs doing, shortcuts. No money totals.' },
  { id: 'more', title: 'From Home', who: 'Owners', desc: 'Designs running low; today\'s sales with online orders.' }
];

window.NH_SCREENS = [
  {
    id: 'home', route: 'home?demo=1', group: 'owner', icon: 'home', title: 'Home · Owner',
    desc: 'Today\'s sales, Needs attention, shortcuts, recent sales.',
    purpose: 'Open the app and know in five seconds how the day is going and what needs doing.',
    rules: ['Today = Counter + WhatsApp + paid online orders, not cancelled, India time (6.1).', 'Each Needs attention line shows only when there is something (6.4).', 'Every line opens the screen that deals with it.'],
    edges: ['Switch "Home layout" and "Sales card" A / B in Design options.', 'Press "Pretend a sale on another phone" in Design options: the numbers move within a minute.', 'Tap the eye button.', 'Tap "5 designs sold out, 2 running low".'],
    fixes: ['Old app: a carousel that moves by itself every 3 seconds.', 'Old app: "To ship" with no number; low stock counted but never shown.', 'Old app: recent sales sorted by amount.'],
    states: ['loading', 'empty', 'error']
  },
  {
    id: 'hidden', route: 'home?hide=1', group: 'owner', icon: 'eyeoff', title: 'Amounts hidden',
    desc: 'Every ₹ on Home shows as "₹ ••••".',
    purpose: 'A customer at the counter can see the phone (6.2).',
    rules: ['Remembered on this phone.', 'Home only: Today\'s sales still shows the amounts.'],
    edges: ['Tap the eye again to show them.'],
    fixes: ['New: the old app always showed the totals.'],
    states: []
  },
  {
    id: 'month', route: 'home?demo=month', group: 'owner', icon: 'calendar', title: 'Monthly reminder',
    desc: '1st–7th: "Send September\'s sales summary to your accountant".',
    purpose: 'The accountant needs last month\'s summary early in the month for GST (6.6).',
    rules: ['Owners, 1st to 7th of the month.', 'Gone once the summary is opened on that phone.'],
    edges: ['Tap it: it opens the summary (Module 6), then disappears from Home.'],
    fixes: ['New.'],
    states: []
  },
  {
    id: 'caught', route: 'home?demo=caught', group: 'owner', icon: 'check', title: 'All caught up',
    desc: 'Nothing to do: one quiet line.',
    purpose: 'When everything is done, Home says so and gets out of the way.',
    rules: ['No empty boxes or zeros.'],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'offline', route: 'home?demo=offline', group: 'owner', icon: 'wifioff', title: 'Offline',
    desc: 'The last numbers stay, with "Updated 7:52 pm".',
    purpose: 'No internet for a moment: Home doesn\'t go blank (6.10).',
    rules: ['Updates on open, on pull-down, and every minute while open.', 'Phone items (your bill, uploads) are always live.'],
    edges: ['Turn "No internet" off in Design options.'],
    fixes: [],
    states: []
  },
  {
    id: 'staff', route: 'home?as=staff', group: 'staff', icon: 'lock', title: 'Home · Staff',
    desc: '"You sold 4 sarees today", Needs attention, shortcuts, their own last sales.',
    purpose: 'Staff see what to do, never the shop\'s money totals (6.3).',
    rules: ['The server never sends money totals to staff.', 'Only their own sales; an invoice not made on their own sale.', 'No unpaid checkouts, stock running low or monthly reminder.'],
    edges: ['Switch to Lakshmi · Owner and compare.'],
    fixes: ['Old staff Home: "Ready for the counter", tiles with no numbers.'],
    states: ['loading', 'empty']
  },
  {
    id: 'low', route: 'low', group: 'more', icon: 'layers', title: 'Running low',
    desc: 'Designs sold out in the last 30 days, and designs with 1–3 left.',
    purpose: 'What to order from the weavers (6.5).',
    rules: ['A design = a subcategory.', 'Sold out: none left, at least one sold in 30 days.', 'Running low: 1 to 3 left.', 'Designs that never had a tagged saree are left out.'],
    edges: ['Tap a design: its sarees in Products.', 'Note "Test1": it looks like a test design.'],
    fixes: ['Old app: the server counted low stock but the app never showed it.'],
    states: ['empty']
  },
  {
    id: 'today', route: 'today', group: 'more', icon: 'receipt', title: 'Today\'s sales',
    desc: 'Module 5\'s list, now with today\'s paid online orders, so it matches Home.',
    purpose: 'Tap the sales card on Home.',
    rules: ['Same total as Home.', 'An online order opens in Orders.'],
    edges: [],
    fixes: [],
    states: []
  }
];

window.NH_SCREEN = function (id) { return window.NH_SCREENS.find(function (s) { return s.id === id; }); };
window.NH_ROUTE = function (s) { return s.route || s.id; };
