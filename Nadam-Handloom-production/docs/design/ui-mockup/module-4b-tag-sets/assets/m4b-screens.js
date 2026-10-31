/* The catalogue of screens in the sets mock-up (one photo, several tags; 15 Oct 2026).
   Shared by the start page, the "Go to screen" menu, the review notes and the device
   preview. A screen marked `main: true` is the one shown for its page when no demo
   link was used. */
window.NH_GROUPS = [
  { id: 'old', title: 'What the client means', who: 'From the old app', desc: 'The old staff app\'s New Product screen: one photo, then each saree\'s barcode into a list. This is the feature to bring back.' },
  { id: 'add', title: 'Adding a set (new app)', who: 'Owners and staff', desc: 'The same thing inside the new app\'s Add sarees: pick the photos, and on a set\'s photo scan every saree\'s tag. Three ways to tell the app "this photo is a set": try A, B and C in Design options.' },
  { id: 'checks', title: 'Tag checks in a set', who: 'Owners and staff', desc: 'Every tag of a set is checked on its own, the moment it is scanned. A set is saved whole or not at all.' },
  { id: 'page', title: 'After saving: the set\'s page', who: 'Owners and staff', desc: 'One listing, one photo, several tags. Each tag sells, changes or is replaced on its own. More sarees of the same design can be added later.' },
  { id: 'rest', title: 'Unchanged from Module 4', who: 'For context', desc: 'The rest of the products screens, so the flow can be clicked end to end. Their design was agreed on 11 Oct.' }
];

window.NH_SCREENS = [
  {
    id: 'oldapp', route: 'oldapp', group: 'old', icon: 'history', title: 'Old app: New Product', main: true,
    desc: 'One photo, Category, Subcategory, then "Barcodes *": scan each saree into the list.',
    purpose: 'What the client is asking for: a set of 5 identical sarees gets ONE photo and FIVE barcodes, so the shop has one listing with 5 in stock. The old app did this on its New Product screen. The new app (since 15 Oct) only lets one tag go on one photo.',
    rules: ['Copied from the old app\'s screen (ProductFormScreen): same labels and helper text.', 'Filled with a real set from the shop: NH-MHPS-516, one photo, tags NH558, NH559, NH560, NH561.', 'In the live copy, 140 listings have 2–6 tags each: they were all added this way.'],
    edges: ['Tap the barcode icon: a pretend scan adds the next free tag to the list.', 'Tap ✕ on a barcode to take it out.', 'Tap "See the same thing in the new app".'],
    fixes: ['Old app: one product at a time (about 36 seconds each). The new app keeps its fast batch flow and adds sets to it.'],
    states: []
  },
  {
    id: 'addstart', route: 'addstart?id=rainbow', group: 'add', icon: 'plus', title: '1 · Start adding', main: true,
    desc: 'Subcategory chosen once, where they sell, gallery or quick add. Same as Module 4.',
    purpose: 'Nothing changes here: a batch can mix single sarees and sets.',
    rules: ['One subcategory for the whole batch (name and price come from it).', 'Sets need no extra step here: you say "this photo is a set" while scanning.'],
    edges: ['Tap "Choose photos from the gallery".'],
    fixes: [],
    states: ['warning']
  },
  {
    id: 'gallery', route: 'gallery?id=rainbow', group: 'add', icon: 'image', title: '2 · Choose photos', main: true,
    desc: 'One photo per design. For a set of 5, pick its photo once.',
    purpose: 'Pick the photos. A set needs only one photo: the 5 identical sarees share it.',
    rules: ['Up to 50 photos in a batch.', 'The number on a photo is the order you scan in.'],
    edges: ['Pick 3 photos, then Next: the scanner opens on photo 1.'],
    fixes: [],
    states: []
  },
  {
    id: 'setscan', route: 'scan?id=rainbow&demo=set', group: 'add', icon: 'layers', title: '3 · Scan a set\'s tags', main: true,
    desc: 'Photo 2 is a set of 5: 2 of its 5 tags are scanned. Switch A / B / C in Design options.',
    purpose: 'The heart of the change. While a photo is shown, every tag scanned goes on that photo. A one-saree photo moves on by itself after its tag, as today. For a set, the app needs to know to stay on the photo: that is what A, B and C decide.',
    rules: ['A · Count first: "Sarees in this photo" starts at 1. Tap + to 5, scan 5 tags, it moves on by itself after the 5th.', 'B · Switch: "One saree / A set". In "A set" each scan adds a tag; tap "Next photo" when done.', 'C · Keep scanning: no setting at all. Every photo stays until you tap "Next photo" (one extra tap for every single saree).', 'Each tag is checked the moment it is scanned (already used, sold, retired).', 'Tap ✕ on a tag to take it off. "Undo last" takes off the last tag scanned.', 'Up to 50 tags on one photo (to confirm).'],
    edges: ['Tap "Free tag" 3 times to finish the set (A), or then tap "Next photo" (B, C).', 'Tap "Same tag again": "already on this photo".', 'Tap "Tag from photo 1": it is on another photo of this batch.', 'In A, tap − or + to change the count.', 'Tap the strip: a set shows its count (2/5).'],
    fixes: ['New: a photo can hold a set. Module 4 allowed one tag per photo (rule T1, 11 Oct).', 'Old app: sets were added one product at a time; now they sit in the same batch as single sarees.'],
    states: ['warning', 'popup']
  },
  {
    id: 'setfull', route: 'scan?id=rainbow&demo=full', group: 'add', icon: 'plus', title: 'One more than counted',
    desc: 'Photo 2 has its 5 of 5; a 6th tag is scanned.',
    purpose: 'With A (count first), scanning past the count asks before adding, so a tag meant for the next saree doesn\'t land on the set by mistake.',
    rules: ['A: "Photo 2 has its 5 tags. Make it a set of 6?" or "No, it\'s for another photo".', 'B (A set) and C: the 6th tag is simply added; ✕ takes it off.'],
    edges: ['Switch to B or C in Design options, then open this screen again.'],
    fixes: [],
    states: []
  },
  {
    id: 'review', route: 'review?id=rainbow&demo=1', group: 'add', icon: 'grid', title: '4 · Check before saving', main: true,
    desc: '8 photos, 11 sarees: photo 2 is a set of 5. "Save 11 sarees · 7 photos".',
    purpose: 'See every photo with its tags before saving. A set shows a set mark and its tags (or just the count: Design option "Tags on the check screen").',
    rules: ['Each tag is one saree: the counts say sarees, not photos.', 'A set is one listing: one photo, one SKU, that many in stock.', 'Photo 5 has no tag: it stays as a draft, to scan later.'],
    edges: ['Tap photo 2: its tags, ✕ to take one off, scan more, or type one.', 'Switch "Tags on the check screen" between A and B.', 'Warning state: tap Save with photo 5 missing.'],
    fixes: [],
    states: ['warning', 'popup']
  },
  {
    id: 'reviewcell', route: 'review?id=rainbow&demo=cell', group: 'add', icon: 'layers', title: 'A set\'s photo, opened',
    desc: 'Photo 2\'s 5 tags with ✕, Scan more tags, Type a tag number.',
    purpose: 'Fix a set before saving: take a wrong tag off, add a missing one, or change the count.',
    rules: ['✕ takes a tag off this photo; it stays free for another saree.', 'A: the count can be changed here too. B: "One saree / A set".'],
    edges: ['Take one tag off: the photo shows 4.', 'Tap "Scan more tags": the scanner opens on this photo.'],
    fixes: [],
    states: []
  },
  {
    id: 'reviewshort', route: 'review?id=rainbow&demo=short', group: 'add', icon: 'alert', title: 'A set not finished (A only)',
    desc: 'Photo 2: you said 5, scanned 3. Save asks first.',
    purpose: 'With A the app knows how many tags to expect, so it can warn when a set is short before anything is saved.',
    rules: ['"Scan the other 2" or "Save it as a set of 3".', 'B and C don\'t know the count, so they can\'t warn: photo 2 is simply a set of 3.'],
    edges: ['Tap Save.', 'Switch to B or C and open this again.'],
    fixes: [],
    states: []
  },
  {
    id: 'saving', route: 'saving?id=rainbow&demo=1', group: 'add', icon: 'upload', title: '5 · Saving in the background', main: true,
    desc: 'Each photo saves on its own; the set saves as one listing with 5 tags.',
    purpose: 'Same as Module 4, counting sarees. The set appears once in the list with all its tags.',
    rules: ['A set is saved whole or not at all: if one of its tags was taken meanwhile, none of it is saved until that tag is replaced.', 'Done: "12 sarees added · 8 listings, a set of 5".'],
    edges: ['Error state: the set fails on one tag; tap Fix.', 'Turn on "No internet": it waits, and continues by itself.'],
    fixes: [],
    states: ['error', 'success']
  },
  {
    id: 'quick', route: 'quick?id=rainbow&demo=set', group: 'add', icon: 'camera', title: 'Quick add a set',
    desc: 'Take one photo, scan 4 tags. Same A / B / C choice.',
    purpose: 'For one set at the counter: photo, then its tags, then the next photo.',
    rules: ['A: set the count, it saves by itself after the last tag.', 'B and C: tap "Done: 4 sarees · next photo".', 'Saved in the background, like the batch.'],
    edges: ['Tap "Free tag" until the set is full.', 'Tap ✕ on a tag.'],
    fixes: [],
    states: []
  },
  {
    id: 'samephoto', route: 'scan?id=rainbow&demo=same', group: 'checks', icon: 'copy', title: 'Same tag scanned twice',
    desc: 'The phone reads a set\'s tag again: "already on this photo".',
    purpose: 'Scanning a pile of sarees, the camera often reads the same tag twice. It is ignored with a short note, never added twice.',
    rules: ['No pop-up: a short note only, scanning carries on.'],
    edges: ['Tap "Same tag again".'],
    fixes: [],
    states: []
  },
  {
    id: 'usedbatch', route: 'scan?id=rainbow&demo=dup', group: 'checks', icon: 'copy', title: 'Tag on another photo of this batch',
    desc: 'Photo 1\'s tag scanned on photo 3.',
    purpose: 'Each tag can be on one photo only. Move it here, or scan a different one.',
    rules: ['"Move it to this photo" takes it off the other photo.'],
    edges: ['Tap "Move it to this photo".'],
    fixes: [],
    states: []
  },
  {
    id: 'usedother', route: 'scan?id=rainbow&demo=used', group: 'checks', icon: 'alert', title: 'Tag already on another saree',
    desc: 'The same alert as Module 4, for every tag of a set.',
    purpose: 'Each tag of a set is checked on its own against the whole shop.',
    rules: ['Already used, sold or retired tags can\'t go on a set.'],
    edges: ['Tap "Open that saree".'],
    fixes: [],
    states: []
  },
  {
    id: 'replaceask', route: 'scan?id=rainbow&demo=again', group: 'checks', icon: 'barcode', title: 'A second tag on a one-saree photo',
    desc: 'Replace it, or "It\'s a set: keep both".',
    purpose: 'Forgot to say a photo is a set? A second tag on a one-saree photo asks: wrong tag (replace) or a set (keep both).',
    rules: ['A and B: the question shows. C: the second tag is simply added (C never assumes one saree).'],
    edges: ['Tap "It\'s a set: keep both": photo 1 becomes a set of 2.'],
    fixes: ['Module 4: only "Replace" was possible here.'],
    states: []
  },
  {
    id: 'setfail', route: 'saving?id=rainbow&demo=setfail', group: 'checks', icon: 'alertc', title: 'A set that can\'t save',
    desc: 'One of the set\'s 5 tags was used on another phone a moment ago.',
    purpose: 'All or nothing: a set is never saved with a missing tag, so stock never ends up wrong.',
    rules: ['The failing tag is shown in red; the others wait.', 'Fix: scan a new tag in its place; the whole set then saves.'],
    edges: ['Wait for it to fail, then tap Fix.'],
    fixes: [],
    states: []
  },
  {
    id: 'setpage', route: 'product?id=cbb47607', group: 'page', icon: 'layers', title: 'A set\'s page',
    desc: 'NH-MHPS-516: one photo, 4 tags (NH558–NH561), "Set of 4 · 4 in stock".',
    purpose: 'What a set looks like once saved. One listing on the website with its stock; each tag is one saree.',
    rules: ['"Set of 4 · 4 in stock" at the top.', 'Each tag can be changed, replaced (damaged tag), marked damaged or removed on its own.', 'The website shows the listing until the last one sells.', 'Price and name come from the subcategory, as for every saree.'],
    edges: ['Tap a tag: its own actions.', 'Tap "Add more tags".', 'Tap Delete: all unsold tags become free.'],
    fixes: ['Module 4 said "From the old app… new sarees get one tag each". That note goes: sets are allowed again.'],
    states: ['loading', 'error', 'popup']
  },
  {
    id: 'addmore', route: 'product?id=cbb47607&demo=add', group: 'page', icon: 'plus', title: 'Add more tags later',
    desc: '3 more of the same design arrived: scan their tags onto the set.',
    purpose: 'Restocking a design without a new photo or a new listing (to confirm with the client).',
    rules: ['Each new tag is checked like any other.', 'A tag already on this saree, or on another one, can\'t be added.', 'Nothing is added until "Add 3 tags".'],
    edges: ['Tap "A tag already on this saree".', 'Tap "Free tag" 3 times, then Add.'],
    fixes: ['Old app: restocking was removed on 19 Sep 2026 ("Inventory and restocking are removed").'],
    states: []
  },
  {
    id: 'soldone', route: 'product?id=cbb47607&demo=sold', group: 'page', icon: 'check', title: 'After one of the set sells',
    desc: 'NH558 sold at the counter: "Set of 4 · 3 in stock".',
    purpose: 'Selling one saree of a set sells only that tag. The listing, its photo and the other tags stay.',
    rules: ['Sold tags are locked (can\'t be changed).', 'The real sale happens in Scan → Sell (Module 5); this is a pretend sale.'],
    edges: ['Tap NH558: its actions are locked.'],
    fixes: [],
    states: []
  },
  {
    id: 'search', route: 'products?q=558', group: 'page', icon: 'search', title: 'Find a set by one of its tags',
    desc: 'Search 558: the set comes up, marked "Set of 4".',
    purpose: 'Any tag of a set finds the set. The list marks sets so they are easy to spot.',
    rules: ['Rows show the first two tags and "+2".', '"Set of 4 · 3 left" when some are sold.'],
    edges: ['Clear the search: other sets in the list carry the same mark.'],
    fixes: [],
    states: []
  },
  {
    id: 'products', route: 'products', group: 'rest', icon: 'box', title: 'Products tab', main: true,
    desc: 'The list, with sets marked.',
    purpose: 'The starting point for sarees (Module 4). Sets now show a "Set of N" mark.',
    rules: ['The 5,000 limit counts listings in stock: a set counts once.'],
    edges: ['Tap "+ Add" to start a batch.'],
    fixes: [],
    states: ['loading', 'empty', 'error']
  },
  {
    id: 'product', route: 'product?id=630692a8', group: 'rest', icon: 'box', title: 'A one-saree page', main: true,
    desc: 'A normal saree with one tag. It can become a set with "Add more tags".',
    purpose: 'Unchanged from Module 4, plus the "Add more tags" button.',
    rules: [],
    edges: ['Tap "Add more tags": it becomes a set.'],
    fixes: [],
    states: ['loading', 'error', 'popup']
  },
  {
    id: 'addpick', route: 'addpick', group: 'rest', icon: 'tag', title: 'Which subcategory?', main: true,
    desc: 'Step 1 of adding, unchanged.',
    purpose: 'Unchanged from Module 4: the subcategory is chosen once for the batch.',
    rules: [],
    edges: ['Pick a subcategory, then "Choose photos".'],
    fixes: [],
    states: []
  },
  {
    id: 'subproducts', route: 'subproducts?id=rainbow', group: 'rest', icon: 'folder', title: 'A subcategory\'s sarees', main: true,
    desc: 'Where "See them" goes after saving.',
    purpose: 'Unchanged from Module 4. Sets show their mark here too.',
    rules: [],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'crop', route: 'crop?id=rainbow&i=1', group: 'rest', icon: 'crop', title: 'Adjust a photo', main: true,
    desc: 'From the check screen, unchanged.',
    purpose: 'Unchanged from Module 4. A set\'s photo is adjusted once for all its sarees.',
    rules: [],
    edges: [],
    fixes: [],
    states: []
  },
  {
    id: 'scanfind', route: 'scanfind', group: 'rest', icon: 'scan', title: 'Scan to find', main: true,
    desc: 'Scanning any tag of a set opens the set.',
    purpose: 'Unchanged from Module 4.',
    rules: [],
    edges: ['Tap "Tag on a saree".'],
    fixes: [],
    states: []
  },
  {
    id: 'staffproduct', route: 'product?id=cbb47607&as=staff', group: 'rest', icon: 'user', title: 'A set\'s page (staff)',
    desc: 'Staff can add sets and add tags too. Prices stay with owners.',
    purpose: 'Staff see and do the same as owners for sets (Module 2 rights).',
    rules: ['Prices: view only.'],
    edges: [],
    fixes: [],
    states: []
  }
];

window.NH_SCREEN = function (id) { return window.NH_SCREENS.find(function (s) { return s.id === id; }); };
window.NH_ROUTE = function (s) { return s.route || s.id; };
// Which catalogue screen a route is: same page and the same demo/as/q/id; otherwise the page's main screen.
window.NH_ID_FOR = function (r) {
  var p = r.params || {}, same = [];
  window.NH_SCREENS.forEach(function (s) {
    var parts = window.NH_ROUTE(s).split('?'), q = {};
    if (parts[0] !== r.name) return;
    (parts[1] || '').split('&').forEach(function (kv) { if (kv) { var a = kv.split('='); q[a[0]] = a[1] || ''; } });
    same.push({ s: s, q: q });
  });
  function eq(a, b) { return (a || '') === (b || ''); }
  var exact = same.filter(function (c) { return eq(c.q.demo, p.demo) && eq(c.q.as, p.as) && eq(c.q.q, p.q); });
  var hit = exact.filter(function (c) { return c.q.id && c.q.id === p.id; })[0] || (p.demo || p.q || p.as ? exact[0] : null) || same.filter(function (c) { return c.s.main; })[0] || same[0];
  return hit ? hit.s.id : null;
};
