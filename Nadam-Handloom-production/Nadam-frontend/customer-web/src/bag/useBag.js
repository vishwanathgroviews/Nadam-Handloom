// The bag in React: the store's state, and what each line shows.
import { useSyncExternalStore } from 'react';
import { bagStore } from './store.js';

export const useBag = () => useSyncExternalStore(bagStore.subscribe, bagStore.get, bagStore.get);

// Each saree as the bag shows it: today's details once checked, otherwise what this browser
// kept when it was added. state: unknown (not checked yet) | ok | fewer | sold_out | unavailable.
export function bagLines(state) {
  const checked = new Map((state.checked?.items || []).map((l) => [l.slug, l]));
  return state.items.map((it) => {
    const l = checked.get(it.slug);
    const st = l?.state || 'unknown';
    const known = !!l && st !== 'unavailable' && st !== 'not_found';
    const price = known ? l.price : it.priceSeen;
    const buyable = st === 'ok' || st === 'fewer' || st === 'unknown';
    return {
      slug: it.slug,
      sku: known ? l.sku : it.sku,
      name: (known ? l.name : it.name) || 'A saree from your bag',
      photo: known ? l.photo : it.photo,
      craftName: known ? l.craftName : null,
      price,
      // A note about a new price shows until the customer changes the bag (rule 5).
      priceWas: known && l.priceWas != null && it.priceSeen !== l.price ? l.priceWas : null,
      available: known ? l.available : st === 'unknown' ? null : 0,
      quantity: it.quantity,
      fewerFrom: st === 'fewer' && l.asked > it.quantity ? l.asked : null,
      state: st,
      buyable,
      lineTotal: buyable && price != null ? price * it.quantity : 0,
    };
  });
}

export function bagTotals(lines) {
  const buy = lines.filter((l) => l.buyable);
  return {
    pieces: buy.reduce((n, l) => n + l.quantity, 0),
    amount: buy.reduce((n, l) => n + l.lineTotal, 0),
    out: lines.length - buy.length,
    changes: {
      soldOut: lines.filter((l) => l.state === 'sold_out').length,
      unavailable: lines.filter((l) => l.state === 'unavailable').length,
      fewer: lines.filter((l) => l.fewerFrom).length,
      priceChanged: lines.filter((l) => l.priceWas != null).length,
    },
  };
}
