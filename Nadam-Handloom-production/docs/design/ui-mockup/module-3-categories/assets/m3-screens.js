/* The catalogue of Module 3 (Categories and subcategories) screens. Shared by the
   start page, the "Go to screen" menu, the review notes and the device preview. */
window.NH_GROUPS = [
  { id: 'browse', title: 'Browse and find', who: 'Owners and staff', desc: 'The catalogue, a category, a subcategory, and search across everything.' },
  { id: 'change', title: 'Add and change', who: 'Owners', desc: 'Forms, the price check, photos and reordering.' },
  { id: 'delete', title: 'Hide and delete', who: 'Owners', desc: 'Hide from the website, or delete (never erased).' },
  { id: 'pdf', title: 'Catalogue PDF', who: 'Owners and staff', desc: 'Make a PDF of in-stock sarees and send it to a customer.' },
  { id: 'staff', title: 'What Staff see', who: 'Staff', desc: 'The same screens without any change controls.' }
];

window.NH_SCREENS = [
  {
    id: 'catalogue', group: 'browse', icon: 'folder', title: 'Catalogue',
    desc: 'Categories in shop order, search across all subcategories, filters.',
    purpose: 'The starting point. Owners and staff open it from More → Catalogue.',
    rules: ['Categories in shop order with "N subcategories · N products".', 'Search finds subcategories in every category, by name or price.', 'Filters: All · Hidden · Needs photo · No products.', 'Deleted items never appear.'],
    edges: ['Search "300k" or "2800".', 'Tap the "Needs photo" filter: the 99 without a photo.', 'Turn on "No internet" in Design options: the saved copy shows with its date.'],
    fixes: ['Old app: search only inside one category.', 'Old app: no way to find the subcategories without photos.'],
    states: ['loading', 'empty', 'error']
  },
  {
    id: 'search', route: 'catalogue?q=300k', group: 'browse', icon: 'search', title: 'Search all',
    desc: 'Results from every category, with the category name and price.',
    purpose: 'Find a subcategory without knowing its category.',
    rules: ['Matches names (ignoring capitals) and exact prices.', 'Each result shows its category and store price.'],
    edges: ['Clear the search to go back to categories.', 'Search something that does not exist: "No subcategories match".'],
    fixes: ['New.'],
    states: []
  },
  {
    id: 'category', route: 'category?id=2', group: 'browse', icon: 'folder', title: 'Category page',
    desc: 'Mangalagiri Handloom Pattu Sarees: its 102 subcategories.',
    purpose: 'One category: its photo, description and subcategories with prices and badges.',
    rules: ['Rows show store and website price, product count, Hidden and Needs photo badges.', 'Search and filters inside the category.', 'Delete category only when all its subcategories are deleted.'],
    edges: ['Switch "Subcategory list style" A rows / B photo grid in Design options.', 'Press Delete category: refused while it has subcategories.'],
    fixes: ['Old app: the store price appeared twice and the count said "pieces".'],
    states: ['loading', 'empty', 'error']
  },
  {
    id: 'subcategory', route: 'subcategory?id=rainbow', group: 'browse', icon: 'tag', title: 'Subcategory page',
    desc: 'Rainbow checks sarees: prices, MRP with % off, price history, PDF.',
    purpose: 'Everything about one subcategory.',
    rules: ['Prices: Store, Website, MRP with the "% off" the website shows.', 'Show on website switch.', 'Price history: who, when, old → new.', 'Delete refused while any saree is in stock.'],
    edges: ['Turn "Show on website" off: it asks first.', 'Press Delete: refused, "32 sarees are still in stock".', 'Open "Price history".'],
    fixes: ['Old app: MRP was invisible and could not be changed.', 'New: price history.'],
    states: ['loading', 'error', 'popup']
  },
  {
    id: 'catform', route: 'catform', group: 'change', icon: 'plus', title: 'Add a category',
    desc: 'Name, description, photo, all in one go.',
    purpose: 'Create a category. The photo can be added straight away.',
    rules: ['Name 2–100 characters, not the same as another active category.', 'Description required (the website shows it).', 'The web address is made from the name and kept if the name changes later.'],
    edges: ['Try the name "fabrics": already used.', 'Leave the description empty.'],
    fixes: ['Old app: a photo only after the first save; two categories could share a name; renaming broke the web address.'],
    states: ['loading', 'error']
  },
  {
    id: 'subform', route: 'subform?id=rainbow', group: 'change', icon: 'edit', title: 'Edit a subcategory',
    desc: 'Name, description, store / website / MRP prices, photo.',
    purpose: 'Change a subcategory. Price changes get the "old → new" check before saving.',
    rules: ['Prices more than ₹0 and at most ₹10,00,000.', 'MRP optional; if set, higher than the website price.', 'The "% off" updates as you type.'],
    edges: ['Change the store price to 54310 and press Save: the check warns it is 16 times higher.', 'Set MRP below the website price: refused.', 'Change only the description: no price check.'],
    fixes: ['New: MRP field, live "% off", price check.'],
    states: ['loading', 'error']
  },
  {
    id: 'pricecheck', route: 'subform?id=rainbow&demo=price', group: 'change', icon: 'alert', title: 'Price check',
    desc: '"Old → new" for every price, with warnings, before anything goes live.',
    purpose: 'Prices go live on the website immediately; one look-over prevents expensive typos.',
    rules: ['Shows each changed price old → new.', 'Warns when a price more than doubles, drops by more than half, or goes under ₹100.', 'Shows the new "% off" the customer will see.'],
    edges: ['Press "Go back and fix" to return with your typing kept.'],
    fixes: ['Real case from the history: a store price went from ₹3,800 to ₹54,310 with no check.'],
    states: []
  },
  {
    id: 'photo', route: 'subform?id=rainbow&demo=photo', group: 'change', icon: 'camera', title: 'Photo and crop',
    desc: 'Take or choose a photo, then crop to the website tile shape.',
    purpose: 'The website shows these photos as landscape tiles; the frame shows what customers will see.',
    rules: ['JPEG, PNG or WebP up to 8 MB.', 'Stored small (80 KB or less) with location data removed.', 'Uploads with Save; if it fails, other changes stay saved.'],
    edges: ['Drag the photo inside the frame; press "Use photo".'],
    fixes: ['Old app: no crop, and photos only after the first save.'],
    states: []
  },
  {
    id: 'reorder', route: 'reorder?cat=2', group: 'change', icon: 'grip', title: 'Reorder',
    desc: 'Drag by the handle, or use ▲ ▼.',
    purpose: 'Change the order customers see, without typing positions.',
    rules: ['Saved together when you press Save order.', 'Cancel leaves the order as it was.'],
    edges: ['Drag a row by its handle (or press ▲ ▼), then Save order.'],
    fixes: ['Old app: typing position numbers.'],
    states: []
  },
  {
    id: 'hide', route: 'subcategory?id=rainbow&demo=hide', group: 'delete', icon: 'eye2', title: 'Hide from website',
    desc: 'Off the website, still in the app.',
    purpose: 'For a season, or while photos are being taken. Customers cannot see it or its sarees; the shop still can.',
    rules: ['Asks first and says how many products also leave the website.', 'Shown with a Hidden badge in the app.'],
    edges: ['Turn it back on: it returns to the website.'],
    fixes: [],
    states: []
  },
  {
    id: 'delete', route: 'subcategory?id=empty&demo=delete', group: 'delete', icon: 'trash', title: 'Delete (never erased)',
    desc: 'Disappears from the app and website; kept in the background.',
    purpose: 'Delete sets it inactive. Old bills and history still show its name.',
    rules: ['Refused while any saree is in stock or held by an online order.', 'Also turns off Show on website.', 'Its name can be used again later.'],
    edges: ['Delete this empty one: it disappears from the list.', 'Open "Rainbow checks sarees" and press Delete: refused with the count.'],
    fixes: ['Old app: delete erased the subcategory, its products and some customer orders.'],
    states: []
  },
  {
    id: 'deletecat', route: 'category?id=6&demo=delete', group: 'delete', icon: 'trash', title: 'Delete a category',
    desc: 'Only after all its subcategories are deleted.',
    purpose: 'Stops whole groups disappearing by mistake.',
    rules: ['Refused while it has subcategories, with the count.'],
    edges: ['Delete its subcategory first, then the category.'],
    fixes: ['Old app: categories could not be deleted at all.'],
    states: []
  },
  {
    id: 'pdf', route: 'pdf?id=rainbow', group: 'pdf', icon: 'pdf', title: 'Catalogue PDF',
    desc: 'Make a new PDF; share it with a customer.',
    purpose: 'Send a customer every in-stock saree of a subcategory, one per page, with its tag ID.',
    rules: ['Includes only sarees in stock that have a photo; the screen says how many.', 'No price or shop name on the pages (as today).', 'At most 10 PDFs a minute.'],
    edges: ['Press "Make new PDF".', 'Press "Share on WhatsApp", type a number.', 'Switch to iPhone in Design options: the share menu instead.'],
    fixes: ['Old screen said "every active product"; it now says exactly what is included.'],
    states: ['loading', 'error', 'empty']
  },
  {
    id: 'pdfpage', route: 'pdfpage?id=rainbow', group: 'pdf', icon: 'pdf', title: 'PDF page preview',
    desc: 'What one page of the PDF looks like.',
    purpose: 'A4, ivory, gold border, subcategory name, "ID: tag numbers", the photo.',
    rules: [],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'wapdf', route: 'wapdf?id=rainbow', group: 'pdf', icon: 'whatsapp', title: 'WhatsApp with the PDF',
    desc: 'The customer\'s chat opens with the PDF and caption attached (Android).',
    purpose: 'A picture of WhatsApp: you press Send. The number is never saved.',
    rules: ['Caption: "Nandam Handlooms – <name> catalogue. Please tell us the ID number of the piece you like."'],
    edges: [],
    fixes: ['Old iPhone flow sent the file without the caption; now both send it.'],
    states: []
  },
  {
    id: 'staffcat', route: 'catalogue?as=staff', group: 'staff', icon: 'folder', title: 'Catalogue (staff)',
    desc: 'Search and view; no add, reorder or delete.',
    purpose: 'Staff look things up and share PDFs.',
    rules: ['No + New, Reorder, Edit, Hide or Delete.'],
    edges: ['Compare with the owner view.'],
    fixes: [],
    states: []
  },
  {
    id: 'staffsub', route: 'subcategory?id=rainbow&as=staff', group: 'staff', icon: 'tag', title: 'Subcategory (staff)',
    desc: 'Prices and the PDF, view only.',
    purpose: 'Same page, with a note that only owners can change the catalogue.',
    rules: ['Can make and share the catalogue PDF.'],
    edges: [],
    fixes: [],
    states: []
  }
];

window.NH_SCREEN = function (id) { return window.NH_SCREENS.find(function (s) { return s.id === id; }); };
window.NH_ROUTE = function (s) { return s.route || s.id; };
