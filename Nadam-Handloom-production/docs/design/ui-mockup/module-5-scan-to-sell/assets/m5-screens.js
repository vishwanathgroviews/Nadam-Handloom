/* The catalogue of Module 5 (Scan to sell) screens. Shared by the start page, the
   "Go to screen" menu, the review notes and the device preview. */
window.NH_GROUPS = [
  { id: 'sell', title: 'Sell at the counter', who: 'Owners and staff', desc: 'Scan the sarees, agree the price, choose how it was paid, invoice yes or no, share or print.' },
  { id: 'cant', title: 'When a saree can\'t be sold', who: 'Owners and staff', desc: 'Already sold, already on the bill, damaged, Online only, held by an online checkout, unknown tag, sold on another phone mid-bill.' },
  { id: 'check', title: 'Price check and today\'s sales', who: 'Owners and staff', desc: 'Check a price without touching the bill; today\'s sales; cancel a sale (owners, same day).' },
  { id: 'safety', title: 'Never lost, never twice', who: 'Owners and staff', desc: 'No internet, the bill kept on the phone, tapping Complete twice.' }
];

window.NH_SCREENS = [
  {
    id: 'scan', route: 'scan?demo=1', group: 'sell', icon: 'scan', title: 'Scan tab with a bill',
    desc: 'Camera, "Type", and the bill strip with 2 sarees and their total.',
    purpose: 'The round Scan button. Scan each saree; it goes on the bill at its store price and the camera stays open.',
    rules: ['A tag is accepted after two matching reads (as in Module 4).', 'The bill is kept on the phone: closing the app loses nothing.', 'Price check and Today\'s sales are one tap away.'],
    edges: ['Press "Saree in stock" in the pretend-scan bar.', 'Press "Same saree again".', 'Switch "Scan screen" A / B in Design options.'],
    fixes: ['Old app: switching to Price check wiped the bill without asking.'],
    states: ['loading', 'empty']
  },
  {
    id: 'scanempty', route: 'scan?demo=empty', group: 'sell', icon: 'scan', title: 'First saree',
    desc: 'An empty bill: "Scan the first saree".',
    purpose: 'Where every sale starts.',
    rules: ['Type the number on the tag if it won\'t scan (2264 → NH2264).'],
    edges: ['Press "Saree in stock".', 'Press Type and enter 3.'],
    fixes: [],
    states: []
  },
  {
    id: 'bill', route: 'bill?demo=1', group: 'sell', icon: 'receipt', title: 'The bill',
    desc: 'Each saree with its store price and an "agreed price" box; total and savings.',
    purpose: 'Bargaining happens here: type the price the customer agreed. The catalogue price never changes.',
    rules: ['Leave the box empty to sell at the store price.', 'The total and "₹… off" update as you type.', 'Remove a saree with ✕; Clear asks first.'],
    edges: ['Type 3000 for the first saree.', 'Type 1200 (under half): see the check.', 'Remove a saree.'],
    fixes: ['Old app: the bargained price box was easy to miss; no savings shown.'],
    states: ['empty']
  },
  {
    id: 'lowprice', route: 'bill?demo=low', group: 'sell', icon: 'percent', title: 'Very low price check',
    desc: '"₹1,200 is under half the store price. Is this right?"',
    purpose: 'Decision 6.3: catches a typo (12000 vs 1200) before it\'s sold. A quick confirm, not a block.',
    rules: ['Shows when an agreed price is under half the store price.', 'Today about 1 in 4 bargains is under half, so this will show often (plan section 3).'],
    edges: ['Choose "Change it" or "Yes, sell at ₹1,200".'],
    fixes: ['New.'],
    states: []
  },
  {
    id: 'complete', route: 'complete?demo=1', group: 'sell', icon: 'check', title: 'Complete sale',
    desc: 'Where · Paid by (Cash / UPI / Card) · Invoice yes / no · customer.',
    purpose: 'Three required choices and one button. Everything is sold together, or nothing.',
    rules: ['Paid by is required (decision 6.1).', 'Invoice yes / no has no default (6.7).', 'Counter: customer name and mobile optional (6.5); they go on the invoice.'],
    edges: ['Press Complete sale without choosing: see what\'s missing.', 'Switch "Complete sale" A one page / B three steps in Design options.'],
    fixes: ['Old app: payment mode never recorded.'],
    states: ['loading', 'error']
  },
  {
    id: 'whatsapp', route: 'complete?demo=wa', group: 'sell', icon: 'whatsapp', title: 'WhatsApp order',
    desc: 'Name, mobile and delivery address required.',
    purpose: 'A sale agreed on WhatsApp, to be couriered. It goes to Orders → To ship (Module 7).',
    rules: ['Name, mobile and address required (6.6).', 'Status "processing" until shipped.'],
    edges: ['Leave the name empty and press Create WhatsApp order.'],
    fixes: ['Old app: no customer name, so the invoice and ship-to card had blank lines.'],
    states: []
  },
  {
    id: 'sold', route: 'sold?demo=1', group: 'sell', icon: 'check', title: 'Sold',
    desc: 'Order, invoice, Share on WhatsApp, Print, Next customer.',
    purpose: 'Hand over the invoice and start the next bill.',
    rules: ['Android: WhatsApp opens straight in the customer\'s chat with the PDF; iPhone: the share menu.', 'Next customer starts a new, empty bill.'],
    edges: ['Press Share on WhatsApp.', 'Press View invoice.', 'Switch Android / iPhone in Design options.'],
    fixes: [],
    states: []
  },
  {
    id: 'invoice', route: 'invoice?demo=1', group: 'sell', icon: 'receipt', title: 'Invoice',
    desc: 'The PDF the customer gets: GST included, CGST + SGST.',
    purpose: 'Same layout and GST split as today\'s invoices, with the payment mode and the customer\'s name when given.',
    rules: ['Prices include GST (5%). Per line: taxable = price ÷ 1.05; GST split CGST / SGST.', 'Next number: INV-000016.'],
    edges: [],
    fixes: ['New: payment mode and the customer\'s name on the invoice.'],
    states: []
  },
  {
    id: 'invoicefail', route: 'sold?demo=fail', group: 'sell', icon: 'refresh', title: 'Invoice couldn\'t be made',
    desc: 'The sale is saved; "Make the invoice again".',
    purpose: 'The sale never waits on the PDF. If it fails, make it again here (or later from the sale).',
    rules: ['Making it again never creates a second invoice.'],
    edges: ['Press Make the invoice again.'],
    fixes: ['Old app: a failed counter invoice could never be made again.'],
    states: []
  },
  {
    id: 'alreadysold', route: 'scan?demo=sold', group: 'cant', icon: 'alert', title: 'Already sold',
    desc: '"NH6 is already sold (at the counter, 9 Oct)."',
    purpose: 'Says exactly why, with the saree\'s photo, and keeps the bill.',
    rules: ['Never added to the bill.'],
    edges: ['Press "Back to bill".'],
    fixes: [],
    states: []
  },
  {
    id: 'onbill', route: 'scan?demo=onbill', group: 'cant', icon: 'copy', title: 'Already on this bill',
    desc: 'The same tag scanned twice.',
    purpose: 'A short notice; the camera stays open for the next saree.',
    rules: [],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'damaged', route: 'scan?demo=damaged', group: 'cant', icon: 'alertc', title: 'Damaged',
    desc: '"Saree damaged: not for sale."',
    purpose: 'Marked damaged in Module 4; Back in stock there makes it sellable again.',
    rules: [],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'onlineonly', route: 'scan?demo=online', group: 'cant', icon: 'eye', title: 'Online only',
    desc: '"Set to Online only." With a link to change it.',
    purpose: 'Decision 6.9: an Online only saree isn\'t sold at the counter by mistake.',
    rules: ['"Change it to Online + store" opens the saree page.'],
    edges: [],
    fixes: ['Old app: Online only and switched-off sarees could be sold at the counter.'],
    states: []
  },
  {
    id: 'heldowner', route: 'scan?demo=held', group: 'cant', icon: 'clock', title: 'Held online (owner)',
    desc: '"A customer is paying for it online until 4:15 pm." Sell anyway.',
    purpose: 'Decision 6.8: the owner can sell it; that online checkout is cancelled in the same step.',
    rules: ['Owners only.', 'Asks first and says the online customer\'s checkout will be cancelled.'],
    edges: ['Press Sell anyway.'],
    fixes: ['Old app: the owner\'s option almost never appeared, and the online order wasn\'t cancelled (sold twice).'],
    states: []
  },
  {
    id: 'heldstaff', route: 'scan?demo=held&as=staff', group: 'cant', icon: 'lock', title: 'Held online (staff)',
    desc: '"Ask an owner, or wait until 4:15 pm."',
    purpose: 'Staff can\'t sell a saree that is being paid for online.',
    rules: [],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'unknown', route: 'scan?demo=unknown', group: 'cant', icon: 'barcode', title: 'Unknown tag',
    desc: '"No saree has NH999999."',
    purpose: 'A tag that isn\'t in the shop yet.',
    rules: ['Owners and staff can add it as a new saree (Module 4).'],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'linechanged', route: 'complete?demo=changed', group: 'cant', icon: 'alert', title: 'Sold on another phone',
    desc: 'Mid-bill, another phone sold one of the sarees.',
    purpose: 'Nothing is sold; the bill stays and that saree is marked, so you remove it and complete.',
    rules: ['All or nothing: never a half-sold bill.'],
    edges: ['Press Remove it and complete.'],
    fixes: ['Old app: the error didn\'t say which saree.'],
    states: []
  },
  {
    id: 'pricecheck', route: 'pricecheck', group: 'check', icon: 'tag', title: 'Price check',
    desc: 'Scan to see price and status. Never touches the bill.',
    purpose: 'A customer asks "how much is this one?".',
    rules: ['Store price, website price, MRP and status.', 'The bill stays as it was (6.11).'],
    edges: ['Press "Saree in stock" in the pretend-scan bar.'],
    fixes: ['Old app: switching to Price check wiped the bill.'],
    states: []
  },
  {
    id: 'today', route: 'today', group: 'check', icon: 'history', title: 'Today\'s sales',
    desc: 'Today\'s bills: time, sarees, total, paid by, who sold.',
    purpose: 'See what was sold today; open one to share its invoice again or cancel it.',
    rules: ['Newest first.', 'Cancelled sales stay in the list, marked Cancelled.'],
    edges: ['Open a sale.'],
    fixes: ['New.'],
    states: ['loading', 'empty']
  },
  {
    id: 'sale', route: 'sale?id=s1', group: 'check', icon: 'receipt', title: 'A sale',
    desc: 'Its sarees, prices, invoice; Cancel sale (owners).',
    purpose: 'Everything about one bill.',
    rules: ['Share or print the invoice again.', 'Cancel: owners, same day.'],
    edges: ['Press Cancel sale.'],
    fixes: [],
    states: []
  },
  {
    id: 'cancel', route: 'sale?id=s1&demo=cancel', group: 'check', icon: 'xcircle', title: 'Cancel a sale',
    desc: 'A reason, then the sarees go back in stock; the invoice is marked CANCELLED.',
    purpose: 'Decision 6.2: undo a mistake on the same day.',
    rules: ['Owners only, the same day.', 'The invoice is kept, marked CANCELLED; its number is never reused.', 'Recorded in the activity log.'],
    edges: ['Choose a reason and cancel; see the sarees back in stock.'],
    fixes: ['Old app: no way to cancel or undo.'],
    states: []
  },
  {
    id: 'cancelstaff', route: 'sale?id=s1&as=staff', group: 'check', icon: 'lock', title: 'Cancel (staff)',
    desc: '"Ask an owner to cancel this sale."',
    purpose: 'Staff see the sale, but can\'t cancel it.',
    rules: [],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'cancelold', route: 'sale?id=s0', group: 'check', icon: 'clock', title: 'Yesterday\'s sale',
    desc: 'Cancel isn\'t offered after the day of the sale.',
    purpose: 'Keeps invoices and GST filings stable.',
    rules: ['Returns after the day are for later (plan 2).'],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'offline', route: 'complete?demo=offline', group: 'safety', icon: 'wifioff', title: 'No internet',
    desc: '"Complete sale" waits; the bill stays on the phone.',
    purpose: 'Decision 6.4: never sell without internet, so a saree can\'t be sold twice.',
    rules: ['Scanning and the bill still work offline; completing waits for the internet.'],
    edges: ['Turn on "No internet" in Design options, then try Complete sale.'],
    fixes: ['Old app: everything blocked offline.'],
    states: []
  },
  {
    id: 'draft', route: 'scan?demo=draft', group: 'safety', icon: 'layers', title: 'Bill kept on the phone',
    desc: 'The app was closed mid-bill: the bill is back.',
    purpose: 'A phone call or a closed app never loses a bill.',
    rules: ['The bill belongs to the person who started it.'],
    edges: [],
    fixes: ['Old app: the bill lived only on the screen.'],
    states: []
  },
  {
    id: 'twice', route: 'sold?demo=twice', group: 'safety', icon: 'check', title: 'Tapped Complete twice',
    desc: 'The same sale comes back; nothing sold twice.',
    purpose: 'A slow network or a double tap never makes a second sale.',
    rules: ['Each bill has its own id from the phone.'],
    edges: [],
    fixes: ['Old app: a repeat looked like "already sold" for a sale that had worked.'],
    states: []
  }
];

window.NH_SCREEN = function (id) { return window.NH_SCREENS.find(function (s) { return s.id === id; }); };
window.NH_ROUTE = function (s) { return s.route || s.id; };
