/**
 * Display order ("position") for categories and for the subcategories inside
 * one category.
 *
 * The bug this replaces: sortOrder was a free number with nothing stopping
 * two siblings sharing it. Moving B to 0 while A was already at 0 left both
 * at 0, and Postgres is free to return a tied pair in either order, so
 * changing the number often visibly did nothing — on the website as well as
 * in the app.
 *
 * Positions are now a clean 1..n sequence per parent, and choosing a position
 * someone else holds swaps the two, which is what staff expect when they say
 * "put this at number 2".
 */

export interface PositionedRow {
  id: string;
  sortOrder: number;
  name: string;
}

export interface PositionUpdate {
  id: string;
  sortOrder: number;
}

/**
 * The canonical order of a set of siblings: position, then name, then id.
 * Name before id so legacy ties (every row at 0) resolve alphabetically —
 * something a person can predict — rather than by random uuid.
 */
export const canonicalOrder = <T extends PositionedRow>(rows: T[]): T[] =>
  [...rows].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
      a.id.localeCompare(b.id)
  );

/**
 * Works out every sortOrder write needed to put `movingId` at `requested`
 * (1-based) among `rows`, swapping with whoever is there.
 *
 * Also renumbers any gaps or duplicates left by older data into a clean
 * 1..n, so the result is always a strict order. Returns only rows whose value
 * actually changes. A request beyond either end is clamped to it.
 */
export const planReposition = (rows: PositionedRow[], movingId: string, requested: number): PositionUpdate[] => {
  const ordered = canonicalOrder(rows);
  const positions = new Map(ordered.map((row, index) => [row.id, index + 1]));

  const from = positions.get(movingId);
  if (from === undefined) return [];

  const target = Math.min(Math.max(Math.round(requested), 1), ordered.length);
  if (target !== from) {
    const displaced = ordered[target - 1]!;
    positions.set(displaced.id, from);
    positions.set(movingId, target);
  }

  return ordered
    .filter((row) => row.sortOrder !== positions.get(row.id))
    .map((row) => ({ id: row.id, sortOrder: positions.get(row.id)! }));
};

/** The next position at the end of a set of siblings. */
export const nextPosition = (rows: PositionedRow[]): number => rows.length + 1;
