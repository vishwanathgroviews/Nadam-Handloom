// The shop's categories as the website shows them (client's design, 26 Oct 2026): short names
// for the menu, the photos, and all of them in one list: those with sarees first (the most
// pieces first), then those coming soon (the server's `soon`: nothing on the website yet).

const SHORT = {
  'mangalagiri-handloom-pattu-sarees': 'Pattu sarees',
  'handloom-pattu-dress-material': 'Pattu dress materials',
  'pattu-lehanga-sets': 'Lehanga sets',
  'handloom-cotton-saree': 'Cotton sarees',
  'handloom-cotton-dress-material': 'Cotton dress materials',
  fabrics: 'Fabrics',
};
export const shortName = (c) => SHORT[c?.slug] || c?.name || '';

// Every category shows the photo set in the admin app (owner, 27 Oct 2026). The server falls
// back to its newest collection's photo; with neither, one of the website's own photos.
// { site: name } for one of the website's photos (Picture), or { url } for the shop's own.
const photoOf = (c) => (c.image ? { url: c.image } : { site: 'silver-border' });
export const roundPhoto = photoOf;
export const bannerPhoto = photoOf;
export const cardPhoto = photoOf;

export function allCategories(catalog) {
  if (!catalog) return [];
  const shown = [...catalog.categories].sort((a, b) => b.count - a.count);
  const soon = (catalog.soon || []).map((c) => ({ ...c, soon: true, count: 0, collections: 0 }));
  return [...shown, ...soon];
}

// The collections of a category, the most pieces first (the catalogue's own order).
export const collectionsOf = (catalog, slug) => (catalog?.collections || []).filter((c) => c.category === slug);

export const SOON = 'Coming soon';
