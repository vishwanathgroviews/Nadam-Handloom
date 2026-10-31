/* The catalogue of Module 7 (Orders and shipping) screens. Shared by the start page,
   the "Go to screen" menu, the review notes and the device preview. */
window.NH_GROUPS = [
  { id: 'lists', title: 'The Orders tab', who: 'Owners and staff', desc: 'To ship (oldest first), Shipped, Delivered; search; a count on the tab.' },
  { id: 'order', title: 'One order', who: 'Owners and staff', desc: 'The sarees, the customer and address, payment, invoice, and what happened when.' },
  { id: 'ship', title: 'Ship it', who: 'Owners and staff', desc: 'Scan or type the tracking number, Mark shipped, send it on WhatsApp; fix a wrong number; mark delivered.' },
  { id: 'cancel', title: 'Cancel and unpaid', who: 'Owners', desc: 'Cancel an order not yet shipped; follow up unpaid website checkouts.' }
];

window.NH_SCREENS = [
  {
    id: 'toship', route: 'orders?demo=1', group: 'lists', icon: 'orders', title: 'To ship',
    desc: 'Paid online orders and WhatsApp orders not shipped yet, oldest first.',
    purpose: 'The Orders tab. What needs packing, with the longest-waiting parcel on top.',
    rules: ['Oldest first (6.2); "waiting 2 days" in amber after a day.', 'The Orders tab shows how many are waiting.', 'Online and WhatsApp badges.'],
    edges: ['Switch "Orders tab" A / B in Design options.', 'Tap an order.', 'Search for Padma, or a tracking number.'],
    fixes: ['Old app: newest first, no channel badge, no search; the tile showed no number.'],
    states: ['loading', 'empty', 'error']
  },
  {
    id: 'shipped', route: 'orders?tab=shipped', group: 'lists', icon: 'truck', title: 'Shipped',
    desc: 'Newest shipped first, with the tracking number; "Check delivery" after 10 days.',
    purpose: 'Parcels on their way.',
    rules: ['Sorted by the shipped date (not the order date).', 'After 10 days: "Check delivery" (6.8).'],
    edges: ['Open an order shipped 12 days ago.'],
    fixes: ['Old app: filtered by the order date and never emptied (no "delivered").'],
    states: ['empty']
  },
  {
    id: 'delivered', route: 'orders?tab=delivered', group: 'lists', icon: 'packagecheck', title: 'Delivered',
    desc: 'Orders marked delivered.',
    purpose: 'Done parcels, newest first.',
    rules: ['Marked by hand: DTDC sends us no updates.'],
    edges: [],
    fixes: ['New: the old app had no "delivered".'],
    states: ['empty']
  },
  {
    id: 'search', route: 'orders?q=H1001830', group: 'lists', icon: 'search', title: 'Search',
    desc: 'Order number, name, mobile, tracking number or a saree\'s tag.',
    purpose: 'A customer calls: "Where is my parcel?"',
    rules: ['Searches all three lists.'],
    edges: ['Type 98765.', 'Type Padma.'],
    fixes: ['Old app: no search.'],
    states: ['empty']
  },
  {
    id: 'staff', route: 'orders?as=staff', group: 'lists', icon: 'lock', title: 'Orders · Staff',
    desc: 'The same lists; no unpaid checkouts, no cancel.',
    purpose: 'Staff pack and ship every order.',
    rules: ['Staff ship, change tracking numbers and mark delivered.', 'Cancel and unpaid checkouts are for owners.'],
    edges: ['Switch to Lakshmi · Owner and compare.'],
    fixes: [],
    states: []
  },
  {
    id: 'orderwa', route: 'order?id=o1', group: 'order', icon: 'whatsapp', title: 'A WhatsApp order to ship',
    desc: 'Sarees, ship-to with Call / Copy / WhatsApp, payment, invoice, Ship.',
    purpose: 'Everything needed to pack it and send it.',
    rules: ['The address in clean lines (no blank name, no stray commas).', 'Copy address puts it on the clipboard for the courier slip.'],
    edges: ['Tap Copy address.', 'Tap Ship.'],
    fixes: ['Old app: a blank name line and a stray ", -" line; "Hi there" in the message.'],
    states: ['loading', 'error']
  },
  {
    id: 'orderonline', route: 'order?id=o3', group: 'order', icon: 'cloud', title: 'An online order to ship',
    desc: 'Paid via Razorpay; the customer\'s website account.',
    purpose: 'A website order: pack and ship like a WhatsApp order.',
    rules: ['Only a paid order can be shipped.', 'Its invoice was made when the customer paid.'],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'ordershipped', route: 'order?id=o6', group: 'order', icon: 'truck', title: 'A shipped order',
    desc: 'Tracking number, Send on WhatsApp, Change tracking number, Mark delivered.',
    purpose: 'After shipping.',
    rules: ['The timeline shows who shipped it and when.'],
    edges: ['Tap Mark delivered.', 'Tap Change tracking number.'],
    fixes: [],
    states: []
  },
  {
    id: 'ship', route: 'order?id=o1&demo=ship', group: 'ship', icon: 'barcode', title: 'Ship: tracking number',
    desc: 'DTDC (or another courier), scan or type the number, Mark shipped.',
    purpose: 'The courier label goes on the parcel; its number goes on the order.',
    rules: ['8–20 letters and digits.', 'A number already on another order is refused (6.5).', 'Another courier by name (6.4).'],
    edges: ['Press "Scan a label" in the pretend bar.', 'Type H1001830791 (already used).', 'Switch "Ship step" A / B in Design options.'],
    fixes: ['Old app: the same number could go on two orders.'],
    states: []
  },
  {
    id: 'duplicate', route: 'order?id=o1&demo=dup', group: 'ship', icon: 'alert', title: 'Tracking number already used',
    desc: '"H1001830791 is already on order NH… (Padma)".',
    purpose: 'A double scan or a typo, caught at once.',
    rules: ['A cancelled order\'s number can be used again.'],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'sent', route: 'order?id=o1&demo=sent', group: 'ship', icon: 'whatsapp', title: 'Send tracking on WhatsApp',
    desc: 'The message the customer gets, then the invoice PDF.',
    purpose: 'One tap after shipping.',
    rules: ['Android: straight into the customer\'s chat; iPhone: the share menu.', 'The message greets the customer by name.'],
    edges: ['Switch to iPhone in Design options.'],
    fixes: ['Old app: "Hi there" for WhatsApp customers.'],
    states: []
  },
  {
    id: 'change', route: 'order?id=o6&demo=change', group: 'ship', icon: 'edit', title: 'Change tracking number',
    desc: 'A wrong number fixed; the old one kept in the history.',
    purpose: 'A wrong label, or a re-sent parcel.',
    rules: ['Owners and staff (6.6).', 'Recorded in the activity log with the old number.'],
    edges: [],
    fixes: ['Old app: typed over with no record.'],
    states: []
  },
  {
    id: 'cancel', route: 'order?id=o3&demo=cancel', group: 'cancel', icon: 'xcircle', title: 'Cancel an order',
    desc: 'Owners, before it ships: reason; "Refund ₹… in Razorpay" for online orders.',
    purpose: 'The customer changed their mind, or the saree was found damaged while packing.',
    rules: ['Not shipped, same month as the order (6.3).', 'Sarees back in stock; invoice marked CANCELLED.', 'The app never moves money.'],
    edges: ['Switch to Ravi · Staff: no Cancel.'],
    fixes: ['Old app: a paid order could not be cancelled.'],
    states: []
  },
  {
    id: 'unpaid', route: 'unpaid', group: 'cancel', icon: 'clock', title: 'Unpaid checkouts',
    desc: 'Website checkouts not paid: customer, sarees, amount, Call / WhatsApp.',
    purpose: 'Follow up people who tried to buy (6.7). 4 customers tried 18 times on 9–10 Oct.',
    rules: ['Owners only.', 'Older than 15 minutes, newer than 30 days.', 'Nothing is held: the sarees are back on sale.'],
    edges: ['Tap Call.', 'Switch to Ravi · Staff.'],
    fixes: ['Old app: invisible, and "pending" forever.'],
    states: ['empty']
  }
];

window.NH_SCREEN = function (id) { return window.NH_SCREENS.find(function (s) { return s.id === id; }); };
window.NH_ROUTE = function (s) { return s.route || s.id; };
