/* The catalogue of Module 9 (Analytics) screens. Shared by the start page, the
   "Go to screen" menu, the review notes and the device preview. */
window.NH_GROUPS = [
  { id: 'main', title: 'Analytics', who: 'Owners', desc: 'Any period and channel: sales, the period before, a chart, best sellers, bargains, people, payment, busy hours, stock.' },
  { id: 'detail', title: 'Look closer', who: 'Owners', desc: 'Every design sold; one person\'s figures; stock.' },
  { id: 'edge', title: 'Edge cases', who: 'Owners and staff', desc: 'The first weeks with little history; staff can\'t open it.' }
];

window.NH_SCREENS = [
  {
    id: 'month', route: 'analytics?demo=1', group: 'main', icon: 'chart', title: 'This month',
    desc: '1–12 Oct compared with 1–12 Sep: sales, bills, sarees, average bill, a bar per day.',
    purpose: 'The page most owners open: how this month is going.',
    rules: ['This month compares with the same days of last month (6.3).', 'Cancelled sales are left out and shown on one small line.', 'Amounts are bill totals, GST included, after bargains.'],
    edges: ['Tap a bar in the chart.', 'Switch "Layout" and "Chart" A / B in Design options.', 'Pick Counter, WhatsApp or Online.'],
    fixes: ['Old app: no "this month", no comparison shown, no chart.'],
    states: ['loading', 'error']
  },
  {
    id: 'week', route: 'analytics?p=7d', group: 'main', icon: 'calendar', title: '7 days',
    desc: 'Today and the 6 days before, against the 7 days before that.',
    purpose: 'A quick look at the week.',
    rules: ['7 days = today and the 6 days before, on every screen (6.2).'],
    edges: ['Try 30 days and Last month.'],
    fixes: ['Old app: "7 days" meant 7 days here but 8 calendar days on other screens.'],
    states: []
  },
  {
    id: 'today', route: 'analytics?p=today', group: 'main', icon: 'clock', title: 'Today, by hour',
    desc: 'One day: a bar per hour, compared with yesterday.',
    purpose: 'How today is going, hour by hour.',
    rules: ['A single day shows hours (6.4).'],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'custom', route: 'analytics?demo=custom', group: 'main', icon: 'sliders', title: 'Any dates',
    desc: 'Choose the first and last day.',
    purpose: 'A festival week, or the same month last year.',
    rules: ['Up to today; whole India days.', 'Longer than 3 months: a bar per week.'],
    edges: ['Pick 1 Aug to 12 Oct: bars per week.'],
    fixes: [],
    states: []
  },
  {
    id: 'designs', route: 'designs', group: 'detail', icon: 'layers', title: 'All designs',
    desc: 'Every design sold in the period, by sarees or by ₹.',
    purpose: 'What to re-order from the weavers (6.5).',
    rules: ['A design = a subcategory.', 'Tap one to see its sarees in Products.'],
    edges: ['Switch By sarees / By ₹.'],
    fixes: ['Old app: top 5 by ₹ only.'],
    states: ['empty']
  },
  {
    id: 'person', route: 'person?id=ravi', group: 'detail', icon: 'user', title: 'One person',
    desc: 'Their bills, sarees, ₹, bargains and best designs.',
    purpose: 'A fair look at each person\'s sales (6.7).',
    rules: ['Owners only.', 'Old-app sales show as "Not recorded".'],
    edges: ['Open Lakshmi and Anil too.'],
    fixes: ['New.'],
    states: []
  },
  {
    id: 'stock', route: 'analytics?focus=stock', group: 'detail', icon: 'box', title: 'Stock',
    desc: 'Sarees in stock, their value at store prices, designs not sold for 60 days.',
    purpose: 'Money on the shelf, and what isn\'t moving (6.10).',
    rules: ['Value = in-stock sarees × store price.', 'Slow: in stock and in the shop 60 days, nothing sold for 60 days.'],
    edges: [],
    fixes: ['New.'],
    states: []
  },
  {
    id: 'early', route: 'analytics?demo=early', group: 'edge', icon: 'info', title: 'The first weeks',
    desc: 'The real situation today: sales recorded from 5 Oct, so little to compare with.',
    purpose: 'The page stays honest while history builds up.',
    rules: ['"↑ / ↓" only when the period before had sales.', 'Days of the week after 4 weeks of sales.', 'Slow designs from early December.'],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'staff', route: 'analytics?as=staff', group: 'edge', icon: 'lock', title: 'Staff',
    desc: 'Analytics is for owners.',
    purpose: 'Staff never see money totals or each other\'s figures (6.1).',
    rules: ['The server refuses staff, not just the app.'],
    edges: ['Switch to Lakshmi · Owner.'],
    fixes: [],
    states: []
  }
];

window.NH_SCREEN = function (id) { return window.NH_SCREENS.find(function (s) { return s.id === id; }); };
window.NH_ROUTE = function (s) { return s.route || s.id; };
