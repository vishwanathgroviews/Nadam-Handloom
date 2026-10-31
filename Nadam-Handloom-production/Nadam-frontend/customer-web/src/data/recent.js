// Sarees this visitor looked at (their cards), kept in this browser for "Recently viewed".
const KEY = 'nh-recent';
const MAX = 12;

export function readRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((c) => c && c.slug && c.photo) : [];
  } catch {
    return [];
  }
}

export function rememberSaree(card) {
  try {
    const keep = { slug: card.slug, sku: card.sku, name: card.name, collection: card.collection, category: card.category, craft: card.craft, price: card.price, available: card.available, photo: card.photo, isNew: false };
    const list = [keep, ...readRecent().filter((c) => c.slug !== card.slug)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* private mode */ }
}
