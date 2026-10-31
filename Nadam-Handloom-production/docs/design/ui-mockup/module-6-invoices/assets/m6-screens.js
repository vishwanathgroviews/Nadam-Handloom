/* The catalogue of Module 6 (Invoices and the sales summary) screens. Shared by the
   start page, the "Go to screen" menu, the review notes and the device preview. */
window.NH_GROUPS = [
  { id: 'find', title: 'Find an invoice', who: 'Owners and staff', desc: 'Newest first, search by number, name, mobile or tag, filter by period and channel. Owners see the totals.' },
  { id: 'one', title: 'One invoice', who: 'Owners and staff', desc: 'Every saree, the GST, the customer; share on WhatsApp, print; correct a name (owners).' },
  { id: 'summary', title: 'Sales summary', who: 'Owners', desc: 'A month or any dates: totals, every invoice, sarees by name; PDF and an Excel file for the accountant.' },
  { id: 'later', title: 'An invoice made later', who: 'Owners and staff', desc: 'A customer comes back for an invoice for a sale recorded without one.' }
];

window.NH_SCREENS = [
  {
    id: 'list', route: 'invoices?demo=1', group: 'find', icon: 'receipt', title: 'Invoices',
    desc: 'Newest first; number, date, customer, channel, total; the owner\'s totals line.',
    purpose: 'More → Invoices. The one place to find any invoice, old or new, counter, WhatsApp or online.',
    rules: ['30 at a time, then "Show more".', 'Owners see "N invoices · ₹… (cancelled not counted)" for the filter.', 'Dates are the invoice date, India time.'],
    edges: ['Switch "Invoices list" A / B in Design options.', 'Tap This month, then Last month.', 'Tap the channel chips.'],
    fixes: ['Old app: no search, and "7 days" was really 8 days.'],
    states: ['loading', 'empty', 'error']
  },
  {
    id: 'liststaff', route: 'invoices?as=staff', group: 'find', icon: 'lock', title: 'Invoices · Staff',
    desc: 'The same list, without money totals.',
    purpose: 'Staff help a customer who comes back for their invoice, without seeing the shop\'s totals (Module 2).',
    rules: ['Staff open, share and print any invoice.', 'No totals line, no sales summary.'],
    edges: ['Switch to Lakshmi · Owner in Design options and compare.'],
    fixes: ['Old app: Staff could download the full sales summary.'],
    states: []
  },
  {
    id: 'search', route: 'invoices?q=sravani', group: 'find', icon: 'search', title: 'Search',
    desc: 'Find by invoice number, order number, name, mobile or a saree\'s tag.',
    purpose: 'A customer at the counter says "I bought two sarees last week": type her name or mobile.',
    rules: ['17 finds INV-000017; a 10-digit number finds the mobile; NH3136 finds the invoice with that saree.', 'Search looks at every date, not only the chosen period.'],
    edges: ['Type 98765.', 'Type 14.', 'Type a tag from an invoice, like NH10380.'],
    fixes: ['Old app: no search at all.'],
    states: ['empty']
  },
  {
    id: 'calendar', route: 'invoices?demo=calendar', group: 'find', icon: 'calendar', title: 'Custom dates',
    desc: 'A small calendar for From and To.',
    purpose: 'Any range, for example the days of an exhibition.',
    rules: ['The whole day in India time: from 00:00 to 23:59.', 'To can\'t be before From; no future dates.'],
    edges: ['Pick 1 Oct, then 10 Oct.', 'Pick only one day (From = To).'],
    fixes: ['Old app: a custom From date started at 5:30 am, so early sales were missed.'],
    states: []
  },
  {
    id: 'invoice', route: 'invoice?id=i24', group: 'one', icon: 'doc', title: 'One invoice',
    desc: 'Customer, every saree with its price, GST, paid by; share and print.',
    purpose: 'Everything about one invoice, the same figures as the PDF.',
    rules: ['Share on WhatsApp goes straight into the customer\'s chat on Android.', 'Open the sale: cancel there (owners, same day).'],
    edges: ['Tap Share on WhatsApp.', 'Tap View the PDF.', 'Owners: Correct the customer.'],
    fixes: ['Old app: the invoice page showed no sarees, only totals.'],
    states: ['loading', 'error']
  },
  {
    id: 'cancelled', route: 'invoice?id=i21', group: 'one', icon: 'xcircle', title: 'A cancelled invoice',
    desc: 'Kept, stamped CANCELLED, never counted.',
    purpose: 'A sale cancelled the same day (Module 5). Its invoice number stays in the sequence.',
    rules: ['Shown in the list with a CANCELLED badge; not in totals.', 'Its PDF carries the stamp.'],
    edges: ['View the PDF.'],
    fixes: ['New: the old app had no cancel.'],
    states: []
  },
  {
    id: 'whatsapp', route: 'invoice?id=i23', group: 'one', icon: 'whatsapp', title: 'A WhatsApp order\'s invoice',
    desc: 'With the customer\'s name, mobile and delivery address.',
    purpose: 'WhatsApp orders now carry the name (Module 5).',
    rules: ['The address shows here; the courier details are in Orders (Module 7).'],
    edges: [],
    fixes: ['Old app: WhatsApp invoices had no name and read "Walk-in customer".'],
    states: []
  },
  {
    id: 'oldwa', route: 'invoice?id=i02', group: 'one', icon: 'history', title: 'An old WhatsApp invoice',
    desc: 'Made by the old app, no name: "WhatsApp customer".',
    purpose: 'The 9 old WhatsApp invoices have a mobile but no name.',
    rules: ['Shown as "WhatsApp customer" with the mobile, not "Walk-in customer".', 'Correct the customer adds the name only within its month (6.11).'],
    edges: ['Try Correct the customer: it was last month.'],
    fixes: [],
    states: []
  },
  {
    id: 'online', route: 'invoice?id=i20', group: 'one', icon: 'cloud', title: 'An online order\'s invoice',
    desc: 'From the website; opens the order in Orders.',
    purpose: 'Online invoices sit in the same list and number sequence.',
    rules: ['Made automatically when the customer pays.', '"Open the order" goes to Module 7.'],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'correct', route: 'invoice?id=i24&demo=correct', group: 'one', icon: 'edit', title: 'Correct the customer',
    desc: 'Owners: fix a name or mobile; same number and amounts.',
    purpose: 'A typo in the name, or a name added when the customer asks.',
    rules: ['Owners only, the invoice\'s own month.', 'The PDF is made again with the same number; recorded in the activity log.', 'Amounts can never change.'],
    edges: ['Clear the mobile.', 'Type a 9-digit mobile.', 'Open an invoice from last month and try.'],
    fixes: ['Old app: a wrong name could never be fixed.'],
    states: []
  },
  {
    id: 'pdf', route: 'pdf?id=i24', group: 'one', icon: 'pdf', title: 'The invoice PDF',
    desc: 'As the customer gets it (same as Module 5).',
    purpose: 'For comparison: the screen and the PDF show the same figures.',
    rules: ['Prices on the PDF are shown without GST; the GST lines add it back.'],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'summary', route: 'summary', group: 'summary', icon: 'chart', title: 'Sales summary',
    desc: 'Choose the period and the channels, then Make the summary.',
    purpose: 'For the owner and the accountant: a month, or any dates.',
    rules: ['Owners only.', 'Last month is one tap (GST is filed monthly).', 'Up to one year at a time.'],
    edges: ['Switch "Sales summary screen" A / B in Design options.', 'Choose Custom.', 'Untick Online.'],
    fixes: ['Old app: "All time" printed only the current month.'],
    states: ['loading', 'error']
  },
  {
    id: 'result', route: 'summary?demo=result', group: 'summary', icon: 'sheet', title: 'Summary ready',
    desc: 'The totals on screen; Share PDF, Print, Excel file.',
    purpose: 'Check the totals before sending them to the accountant.',
    rules: ['The totals equal the invoices list for the same period, always.', 'Cancelled invoices are listed, not counted (6.4).', 'Sales without an invoice: as decision 6.3.'],
    edges: ['Switch decision 6.3 A / B / C in Design options.', 'Tap Excel file.'],
    fixes: ['Old app: the list counted by invoice date, the summary by sale date, so the totals could differ.'],
    states: []
  },
  {
    id: 'summarypdf', route: 'summarypdf?demo=1', group: 'summary', icon: 'pdf', title: 'The summary PDF',
    desc: 'Totals page, every invoice, sarees by name (decision 6.2).',
    purpose: 'What the accountant receives.',
    rules: ['Same letterhead as the invoices.', 'Cancelled invoices marked, not counted.'],
    edges: ['Switch decision 6.2 A / B / C in Design options.'],
    fixes: ['Old app: grouped by saree name only; no invoice-by-invoice list.'],
    states: []
  },
  {
    id: 'summarynone', route: 'summary?demo=none', group: 'summary', icon: 'info', title: 'Nothing in the period',
    desc: '"No invoices from … to …".',
    purpose: 'A period with no invoices, such as a holiday week.',
    rules: ['Sales without an invoice are still mentioned if there were any.'],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'summarystaff', route: 'summary?as=staff', group: 'summary', icon: 'lock', title: 'Summary · Staff',
    desc: 'Owners only: Staff see why.',
    purpose: 'Money totals are for owners (Module 2).',
    rules: ['The server refuses it too, not only the app.'],
    edges: [],
    fixes: ['Old app: Staff could make it.'],
    states: []
  },
  {
    id: 'makelater', route: 'sale?id=n3&demo=make', group: 'later', icon: 'plus', title: 'Make an invoice later',
    desc: 'A sale recorded without an invoice, this month: "Make an invoice".',
    purpose: 'The customer comes back and asks for an invoice (decision 6.5).',
    rules: ['Same month as the sale only.', 'Takes the next number and today\'s date; the sale date is printed too.', 'Not for a cancelled sale.'],
    edges: ['Make it, then share it.'],
    fixes: ['Old app: impossible.'],
    states: []
  },
  {
    id: 'makelaterold', route: 'sale?id=n1', group: 'later', icon: 'clock', title: 'Too late for an invoice',
    desc: 'A sale from last month: "Invoices can be made only in the month of the sale".',
    purpose: 'Keeps a GST month that may be filed unchanged.',
    rules: [],
    edges: [],
    fixes: [],
    states: []
  }
];

window.NH_SCREEN = function (id) { return window.NH_SCREENS.find(function (s) { return s.id === id; }); };
window.NH_ROUTE = function (s) { return s.route || s.id; };
