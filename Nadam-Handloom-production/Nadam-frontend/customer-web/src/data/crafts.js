// Craft names (the server's CRAFTS list), for labels on cards.
export const CRAFT_NAMES = {
  embroidery: 'Embroidery',
  applique: 'Applique',
  digital: 'Digital Print',
  screen: 'Screen & Block Print',
  kalamkari: 'Kalamkari & Hand Painted',
  bandhani: 'Bandhani & Shibori',
  checks: 'Checks',
  pure: 'Pure Pattu & Plain',
};

// The same spellings the server groups by (CRAFTS in the server's constants).
const MATCH = {
  embroidery: /embroid|chikankari/i,
  applique: /applique/i,
  digital: /digital/i,
  screen: /screen|baguru|bagru|embossing/i,
  kalamkari: /kalamkari|kalankari|hand ?painted|tanjore/i,
  bandhani: /bandini|bandhani|shibori/i,
  checks: /\bchecks?\b/i,
  pure: /pure pattu|plain|\bbutt?a\b/i,
};

// Does a search word name this craft? ("kalankari", "embroidered", "print" …)
export function wordMeansCraft(word, key) {
  const w = word.toLowerCase();
  if (!CRAFT_NAMES[key]) return false;
  if (MATCH[key].test(w)) return true;
  return w.length >= 4 && (key.startsWith(w) || CRAFT_NAMES[key].toLowerCase().split(/[^a-z]+/).some((n) => n.length >= 4 && n.startsWith(w)));
}

// The small line above a saree's name: its collection, or its craft when the saree is
// simply named after the collection (most are).
export function cardLabel(card, prefer = 'collection') {
  const craft = card.craftName || CRAFT_NAMES[card.craft] || 'Mangalagiri handloom';
  const col = card.collection?.name;
  if (prefer === 'collection' && col && col.trim().toLowerCase() !== String(card.name).trim().toLowerCase()) return col;
  return craft;
}
