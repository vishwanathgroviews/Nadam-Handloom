/**
 * Pure rules behind the app's infinite-scroll lists (see usePagedList).
 * Kept free of React so they can be tested on their own.
 */

/** How many records a list asks the server for at a time. */
export const PAGE_SIZE = 10;

/** Appends a page, dropping anything already on screen (a row can shift between pages while scrolling). */
export const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
  const seen = new Set(existing.map((item) => item.id));
  return [...existing, ...incoming.filter((item) => !seen.has(item.id))];
};

/** Whether another page is worth asking for. */
export const hasMorePages = (loaded: number, total: number, lastPageSize: number, pageSize: number): boolean =>
  loaded < total && lastPageSize >= pageSize;

/**
 * How to refresh a list without losing the reader's place.
 *
 * Coming back to a list after opening one of its rows should still show
 * everything already scrolled through — but refetching it page by page would
 * mean one request per ten rows. Instead the loaded rows are refetched as a
 * single larger page (rounded up to a whole number of pages, so the next
 * normal page picks up exactly where it ends), capped at the most the server
 * will return at once.
 */
export const refreshPlan = (loaded: number, pageSize: number, maxPageSize: number) => {
  const wholePages = Math.max(1, Math.ceil(loaded / pageSize));
  const maxPages = Math.max(1, Math.floor(maxPageSize / pageSize));
  const pages = Math.min(wholePages, maxPages);
  return { requestPageSize: pages * pageSize, pagesCovered: pages };
};
