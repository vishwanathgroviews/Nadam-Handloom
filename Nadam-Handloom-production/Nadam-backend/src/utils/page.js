// Every list is sent 20 at a time (owner's decision, 2026-10-12): ask with ?offset=0, then
// with the nextOffset each answer gives, until it is null. `total` is how many there are in
// all (after any search or filter); summaries in the same answer always cover everything.
import { z } from 'zod';

export const PAGE_SIZE = 20;
export const pageFields = {
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1, 'Ask for at least 1.').max(PAGE_SIZE, `Lists come ${PAGE_SIZE} at a time.`).default(PAGE_SIZE),
};
export const pageQuery = z.object(pageFields);

// One page of a list already worked out in memory (the small lists).
export function pageOf(all, { offset = 0, limit = PAGE_SIZE } = {}) {
  return { items: all.slice(offset, offset + limit), nextOffset: offset + limit < all.length ? offset + limit : null, total: all.length };
}
