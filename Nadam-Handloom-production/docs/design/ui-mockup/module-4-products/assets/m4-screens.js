/* The catalogue of Module 4 (Products and barcodes) screens. Shared by the start
   page, the "Go to screen" menu, the review notes and the device preview. */
window.NH_GROUPS = [
  { id: 'find', title: 'Find sarees', who: 'Owners and staff', desc: 'The Products tab, search by tag number, scan a tag to find its saree, and a subcategory\'s sarees.' },
  { id: 'add', title: 'Add sarees (the new way)', who: 'Owners and staff', desc: 'Choose the subcategory once, pick many photos, scan each saree\'s tag while its photo is shown, review, save in the background. Quick add for one or two.' },
  { id: 'tags', title: 'Tag rules', who: 'Owners and staff', desc: 'One saree, one tag. Already-used alerts, change a wrong tag, replace a damaged tag, type a tag that won\'t scan.' },
  { id: 'page', title: 'Saree page', who: 'Owners and staff', desc: 'Photos, tag, price from the subcategory, where it sells, details, move, delete (never erased).' },
  { id: 'staff', title: 'What Staff see', who: 'Staff', desc: 'Staff can add and change sarees too (Module 2). Prices stay with owners.' }
];

window.NH_SCREENS = [
  {
    id: 'products', group: 'find', icon: 'box', title: 'Products tab',
    desc: '"1,427 sarees in stock", search, scan to find, filters.',
    purpose: 'The starting point for sarees. Shows how many are in stock against the 5,000 limit, and every listing.',
    rules: ['Rows with photo by default. The switch above the list changes to a photo grid; the phone remembers it (owner\'s pick).', 'The 5,000 limit counts only sarees in stock (decision 6.8): sold-out listings don\'t count.', 'Search: name, SKU, or a tag number ("2264" finds NH2264).', 'Filters: All · In stock · Sold out · No photo · Online only · Store only.', 'The name always follows the subcategory (decision 6.2).'],
    edges: ['Type 2264 in the search.', 'Tap "No photo": the 6 listings without a photo.', 'Tap the grid button above the list, then reload: it remembers.', 'Turn on "No internet": the saved copy shows with its time.'],
    fixes: ['Old app: the limit counted sold-out listings too.', 'Old app: 501 listings showed an old name.', 'Old app: no search by tag number.'],
    states: ['loading', 'empty', 'error']
  },
  {
    id: 'search', route: 'products?q=2264', group: 'find', icon: 'search', title: 'Search by tag number',
    desc: 'Type the number on the tag; the saree comes up.',
    purpose: 'A customer sends a PDF ID or a tag number: find that saree in one step.',
    rules: ['Digits only: matches the tag number exactly (2264 → NH2264), then SKUs containing it.', 'Words: matches the name (the subcategory).'],
    edges: ['Clear the search.', 'Search "NH-HPS-00" for SKUs.'],
    fixes: ['New.'],
    states: []
  },
  {
    id: 'scanfind', route: 'scanfind', group: 'find', icon: 'scan', title: 'Scan to find',
    desc: 'Scan a tag: its saree opens. Unknown tag: add a new saree with it.',
    purpose: 'Pick up any saree, scan its tag, see everything about it.',
    rules: ['Known tag: opens the saree.', 'Unknown tag: "No saree has this tag", with Add a new saree.', 'Works with the camera, typing, or a Bluetooth scanner.'],
    edges: ['Press "Tag on a saree" in the pretend-scan bar.', 'Press "Unknown tag".'],
    fixes: ['Old app: only possible inside the sell screen.'],
    states: []
  },
  {
    id: 'subproducts', route: 'subproducts?id=rainbow', group: 'find', icon: 'folder', title: 'A subcategory\'s sarees',
    desc: 'Rainbow checks sarees: its 36 sarees, Add products, Quick add.',
    purpose: 'Opened from the Module 3 subcategory page ("36 products · 32 in stock"). The subcategory is already chosen, so adding starts here.',
    rules: ['Price and description come from the subcategory.', 'Add products (gallery + scan) and Quick add (camera).'],
    edges: ['Press Add products.', 'Press Quick add.', 'Use the rows / grid switch above the list.'],
    fixes: ['Old app: pick category and subcategory again for every saree.'],
    states: ['loading', 'empty']
  },
  {
    id: 'addpick', route: 'addpick', group: 'add', icon: 'tag', title: '1 · Which subcategory?',
    desc: 'Only when you start from the Products tab. Recent ones on top.',
    purpose: 'Chosen once for the whole batch.',
    rules: ['Recent subcategories first, then search across all 100+.', 'Each shows its store and website price.'],
    edges: ['Search "bandini".'],
    fixes: ['Old app: scroll through 102 subcategories for every saree.'],
    states: []
  },
  {
    id: 'addstart', route: 'addstart?id=rainbow', group: 'add', icon: 'plus', title: '2 · Start adding',
    desc: 'Where it sells (once), then Choose photos or Quick add.',
    purpose: 'Sets the things every saree in the batch shares.',
    rules: ['Where it sells: Online + store (default) · Online only · Store only. Changeable per saree later.', 'Up to 50 photos per batch.', 'A warning when the 5,000 limit is near.'],
    edges: ['Use "Warning" in Screen states: the limit is nearly reached.'],
    fixes: [],
    states: ['warning']
  },
  {
    id: 'gallery', route: 'gallery?id=rainbow', group: 'add', icon: 'image', title: '3 · Choose photos',
    desc: 'Pick many at once from the phone\'s gallery.',
    purpose: 'The photos were taken first, in good light. Pick them all here.',
    rules: ['Up to 50. The order you tap is the order you\'ll scan in.', 'Each photo is fitted to the website\'s product shape (3:4, portrait) automatically (decision 6.4).'],
    edges: ['Tap 8 photos, then "Next".', 'Tap a selected photo again to unselect it.'],
    fixes: [],
    states: []
  },
  {
    id: 'scan', route: 'scan?id=rainbow&demo=1', group: 'add', icon: 'barcode', title: '4 · Scan each saree\'s tag',
    desc: 'Photo shown big. Scan that saree\'s tag. Undo last, Skip.',
    purpose: 'The heart of the new way: the camera fills the screen and the photo you are tagging sits in a card (owner\'s pick B), so tags never go on the wrong saree.',
    rules: ['A free tag: tick, and the next photo.', 'One saree, one tag (rule T1).', 'Already used: alert at once (rule T2).', 'Undo last: the previous scan was the wrong saree.', 'Skip: comes back at the end.'],
    edges: ['Press "Free tag" a few times in the pretend-scan bar.', 'Press Undo last.', 'Press Skip.', 'Open it on a tablet in Device preview: the scanning frame moves to the right of the photo.'],
    fixes: ['Old app: a used tag was found only at save time, and the whole saree had to be redone.'],
    states: ['popup', 'warning']
  },
  {
    id: 'review', route: 'review?id=rainbow&demo=1', group: 'add', icon: 'grid', title: '5 · Review before saving',
    desc: 'Every photo with its tag. Tap one to change tag, fix the photo or remove it.',
    purpose: 'One last look. Nothing is saved until you press Save.',
    rules: ['Shows photos without a tag in red.', 'Tap a photo: Change tag · Type the number · Adjust photo · Remove from batch.', 'Save with a photo still missing a tag: save the rest and keep that one as a draft.'],
    edges: ['Tap the red "No tag" photo.', 'Press Save with it still untagged.'],
    fixes: [],
    states: ['warning']
  },
  {
    id: 'crop', route: 'crop?id=rainbow&demo=1&i=0', group: 'add', icon: 'crop', title: 'Adjust a photo',
    desc: 'Only if the automatic fit cut something off.',
    purpose: 'The frame is the website\'s product card shape (3:4).',
    rules: ['Drag to move the photo inside the frame.', 'Stored small (80 KB or less), location removed (as in Module 3).'],
    edges: ['Drag the photo, press "Use photo".'],
    fixes: [],
    states: []
  },
  {
    id: 'saving', route: 'saving?id=rainbow&demo=1', group: 'add', icon: 'upload', title: '6 · Saving in the background',
    desc: '"5 of 8 saved". Carry on; it finishes by itself.',
    purpose: 'No waiting after every saree. If the internet drops, it waits and continues.',
    rules: ['Each saree is saved on its own: one problem doesn\'t stop the rest.', 'Saving twice by accident can\'t make duplicates (each saree has its own id from the phone).', 'You can leave this screen; a small "Saving" bar follows you.'],
    edges: ['Turn on "No internet" while it saves: it waits. Turn it off: it continues.', 'Use "Error" in Screen states: one tag was taken meanwhile; fix it from the results.'],
    fixes: ['Old app: wait after every save; a slow network stopped the work.'],
    states: ['error', 'success']
  },
  {
    id: 'quick', route: 'quick?id=rainbow', group: 'add', icon: 'camera', title: 'Quick add (1–3 sarees)',
    desc: 'Take the photo → scan the tag → saved → next.',
    purpose: 'For a saree or two: no gallery step. The camera stays open for the next one.',
    rules: ['Same checks as the batch: one tag, already-used alert.', 'Saves in the background.'],
    edges: ['Press the shutter, then "Free tag". Repeat.'],
    fixes: [],
    states: []
  },
  {
    id: 'usedother', route: 'scan?id=rainbow&demo=used', group: 'tags', icon: 'alert', title: 'Tag already on another saree',
    desc: '"NH3 is already on Rainbow checks sarees", with its photo.',
    purpose: 'Rule T2: alert the moment it\'s scanned, not at save time.',
    rules: ['Shows that saree\'s photo, SKU and status so you can compare.', 'Choices: Scan a different tag · Open that saree.', 'Sold tags can\'t be used again either ("NH6 was sold on 9 Oct").'],
    edges: ['Press "Used tag" and "Sold tag" in the pretend-scan bar.'],
    fixes: ['Old app: found only when saving.'],
    states: []
  },
  {
    id: 'usedbatch', route: 'scan?id=rainbow&demo=dup', group: 'tags', icon: 'copy', title: 'Tag already used in this batch',
    desc: '"You already gave NH3301 to photo 1."',
    purpose: 'Stops the same tag going on two photos.',
    rules: ['Choices: Scan a different tag · Give it to this photo instead (photo 1 then needs a tag).'],
    edges: ['Press "Tag from photo 1" in the pretend-scan bar.'],
    fixes: [],
    states: []
  },
  {
    id: 'replaceask', route: 'scan?id=rainbow&demo=again', group: 'tags', icon: 'barcode', title: 'One saree, one tag',
    desc: 'Scanning a saree that already has a tag asks "Replace?"',
    purpose: 'Rule T1: a saree never gets a second tag by accident.',
    rules: ['"Replace NH3301 with NH3302? Each saree keeps one tag."', 'There is no "Add another tag" (owner\'s pick A).'],
    edges: ['Tap a photo that already has a tag in the strip, then scan.'],
    fixes: [],
    states: []
  },
  {
    id: 'typetag', route: 'scan?id=rainbow&demo=type', group: 'tags', icon: 'keyboard', title: 'Tag won\'t scan: type it',
    desc: 'Torn or faded tag: type the number. Same checks.',
    purpose: 'Rule T6: never stuck on a bad tag.',
    rules: ['Typing only digits adds NH (3302 → NH3302).', 'Spaces removed, capitals, same as the server.'],
    edges: ['Type 3 (used), 6 (sold), or 3330 (free).'],
    fixes: ['Old app: the app and the server tidied tags differently.'],
    states: []
  },
  {
    id: 'changetag', route: 'product?id=630692a8&demo=change', group: 'tags', icon: 'edit', title: 'Wrong tag: change it',
    desc: 'Tap the tag → Change tag → scan the right one.',
    purpose: 'Rule T3: a wrong tag is fixed in seconds; the wrong number becomes free for its real saree.',
    rules: ['Only while the saree is in stock (not sold, not held by an online order).', 'Asks "Change NH3 to NH3301?" first.', 'Recorded: who, when, old → new.'],
    edges: ['Scan a used tag here: refused with where it is.'],
    fixes: ['Old app: tags couldn\'t be changed at all.'],
    states: []
  },
  {
    id: 'damagedtag', route: 'product?id=630692a8&demo=damaged', group: 'tags', icon: 'broken', title: 'Damaged tag: replace it',
    desc: 'Tag torn or faded → stick a new tag, scan it.',
    purpose: 'Rule T4: the saree keeps selling with a new tag.',
    rules: ['The damaged number is retired: never used again.', 'Same number printed again? Just stick it on: nothing to do in the app.'],
    edges: ['After replacing, see the retired tag in grey.'],
    fixes: ['New.'],
    states: []
  },
  {
    id: 'sareedamaged', route: 'product?id=630692a8&demo=saree', group: 'tags', icon: 'alertc', title: 'Saree damaged (not the tag)',
    desc: 'Not for sale: off the website and the counter. Back in stock undoes it.',
    purpose: 'Rule T5: a torn or stained saree stops selling without deleting it.',
    rules: ['Asks first.', '"Back in stock" undoes it.'],
    edges: ['Mark it, then press Back in stock.'],
    fixes: [],
    states: []
  },
  {
    id: 'product', route: 'product?id=630692a8', group: 'page', icon: 'box', title: 'Saree page',
    desc: 'Photo, tag, price from the subcategory, where it sells, Best Seller.',
    purpose: 'Everything about one saree.',
    rules: ['Name = the subcategory\'s name.', 'Price comes from the subcategory (change it in the Catalogue).', 'On the website only when: sells online, subcategory shown, and in stock.', 'History: added, tag changes, moves.'],
    edges: ['Tap the tag.', 'Change "Where it sells".', 'Turn on Best Seller.'],
    fixes: ['Old app: tags couldn\'t be changed; details like colour couldn\'t be set.'],
    states: ['loading', 'error', 'popup']
  },
  {
    id: 'soldsaree', route: 'product?id=72246a83', group: 'page', icon: 'check', title: 'A sold saree',
    desc: 'Sold at the counter on 9 Oct. Its tag can\'t change.',
    purpose: 'Shows how sold sarees look and what\'s locked.',
    rules: ['Tag actions are locked after a sale.', 'Delete keeps the sale in the bills.'],
    edges: ['Tap the tag: the actions say why they\'re locked.'],
    fixes: [],
    states: []
  },
  {
    id: 'multitag', route: 'product?id=cbb47607', group: 'page', icon: 'layers', title: 'An old listing with 4 tags',
    desc: 'From the old app: 140 listings have 2–6 tags. They keep them.',
    purpose: 'Old listings keep working; each tag still sells. A never-sold extra tag can be removed.',
    rules: ['New sarees get one tag only (T1).', 'Each tag can be changed, replaced or removed separately.'],
    edges: ['Tap one of the tags → Remove this tag.'],
    fixes: [],
    states: []
  },
  {
    id: 'held', route: 'product?id=67d2f4e6&demo=held', group: 'page', icon: 'clock', title: 'Held by an online order',
    desc: 'A customer is paying for it on the website right now.',
    purpose: 'Nothing about it can change until the checkout finishes or expires (about 15 minutes).',
    rules: ['Change tag, replace and delete are refused while held.'],
    edges: ['Press Delete: refused.'],
    fixes: [],
    states: []
  },
  {
    id: 'move', route: 'move?id=630692a8', group: 'page', icon: 'move', title: 'Move to another subcategory',
    desc: 'Name and price change to the new subcategory\'s, after a check.',
    purpose: 'Added to the wrong subcategory? Move it.',
    rules: ['Shows the new name and old → new prices before moving.', 'The web address (slug) doesn\'t change.'],
    edges: ['Search "bandini", choose one, confirm.'],
    fixes: ['Old app: moving didn\'t update the name.'],
    states: []
  },
  {
    id: 'details', route: 'details?id=630692a8', group: 'page', icon: 'sliders', title: 'Details (optional)',
    desc: 'Colour, fabric, border, technique, blouse, zari, occasion.',
    purpose: 'Fills the website\'s filters over time. Never asked while adding (decision 6.6).',
    rules: ['All optional.', 'The website filters use them.'],
    edges: ['Pick a colour and an occasion, Save.'],
    fixes: ['Old app: couldn\'t be set; 0 filled in.'],
    states: []
  },
  {
    id: 'photos', route: 'photos?id=630692a8', group: 'page', icon: 'image', title: 'Photos',
    desc: 'Main photo plus up to 4 extra (border, pallu, blouse).',
    purpose: 'The website product page already shows extra photos with thumbnails (decision 6.3).',
    rules: ['Up to 5 in all. The first is the main one (list, website card, PDF).', 'Each stored small, location removed.'],
    edges: ['Add a photo, make it the main one, remove one.'],
    fixes: ['Old app: one photo only.'],
    states: []
  },
  {
    id: 'delete', route: 'product?id=630692a8&demo=delete', group: 'page', icon: 'trash', title: 'Delete (never erased)',
    desc: 'Gone from the app, website and counter. Bills keep it. Its tag is free again.',
    purpose: 'Decision 6.1: same rule as categories.',
    rules: ['Refused while an online order holds it.', 'Its unsold tag becomes free to use on another saree.', 'Sold history stays in bills and reports.'],
    edges: ['Delete it, then scan NH3 in a new batch: it\'s free.'],
    fixes: ['Old app: erased the saree (and some customer orders), or blocked its tags forever.'],
    states: []
  },
  {
    id: 'staffproducts', route: 'products?as=staff', group: 'staff', icon: 'box', title: 'Products (staff)',
    desc: 'The same list; adding works the same.',
    purpose: 'Staff add sarees too (Module 2: products.manage).',
    rules: ['Same screens and rules.'],
    edges: ['Compare with the owner view.'],
    fixes: [],
    states: []
  },
  {
    id: 'staffproduct', route: 'product?id=630692a8&as=staff', group: 'staff', icon: 'user', title: 'Saree page (staff)',
    desc: 'All tag actions; prices view-only.',
    purpose: 'Prices are set by owners in the Catalogue (Module 3).',
    rules: ['Can change tags, move, delete, set details.', 'Prices: view only.'],
    edges: [],
    fixes: [],
    states: []
  }
];

window.NH_SCREEN = function (id) { return window.NH_SCREENS.find(function (s) { return s.id === id; }); };
window.NH_ROUTE = function (s) { return s.route || s.id; };
