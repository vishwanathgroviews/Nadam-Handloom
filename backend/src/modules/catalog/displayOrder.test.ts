import { describe, expect, it } from 'vitest';
import { canonicalOrder, planReposition, PositionedRow } from './displayOrder';

const apply = (rows: PositionedRow[], movingId: string, requested: number) => {
  const updates = new Map(planReposition(rows, movingId, requested).map((u) => [u.id, u.sortOrder]));
  const after = rows.map((r) => ({ ...r, sortOrder: updates.get(r.id) ?? r.sortOrder }));
  return canonicalOrder(after).map((r) => r.id);
};

const rows = (...ids: string[]): PositionedRow[] => ids.map((id, i) => ({ id, name: id, sortOrder: i + 1 }));

describe('planReposition', () => {
  it('swaps with whoever holds the chosen position', () => {
    expect(apply(rows('A', 'B', 'C', 'D'), 'D', 2)).toEqual(['A', 'D', 'C', 'B']);
  });

  it('moves the other way too', () => {
    expect(apply(rows('A', 'B', 'C', 'D'), 'A', 3)).toEqual(['C', 'B', 'A', 'D']);
  });

  it('changes nothing when the position is unchanged', () => {
    expect(planReposition(rows('A', 'B', 'C'), 'B', 2)).toEqual([]);
  });

  // The reported bug: two siblings could share a number, and the database
  // then returned them in either order, so the change appeared to do nothing.
  it('never leaves two siblings on the same position', () => {
    const tied: PositionedRow[] = [
      { id: 'a', name: 'Cotton', sortOrder: 0 },
      { id: 'b', name: 'Pattu', sortOrder: 0 },
      { id: 'c', name: 'Silk', sortOrder: 0 },
    ];
    const updates = planReposition(tied, 'c', 1);
    const values = tied.map((r) => updates.find((u) => u.id === r.id)?.sortOrder ?? r.sortOrder);
    expect(new Set(values).size).toBe(3);
    expect(apply(tied, 'c', 1)).toEqual(['c', 'b', 'a']);
  });

  it('turns legacy ties into a predictable alphabetical order before moving', () => {
    const tied: PositionedRow[] = [
      { id: 'x', name: 'Silk', sortOrder: 0 },
      { id: 'y', name: 'Cotton', sortOrder: 0 },
    ];
    expect(canonicalOrder(tied).map((r) => r.name)).toEqual(['Cotton', 'Silk']);
  });

  it('keeps a request past the end at the last position', () => {
    expect(apply(rows('A', 'B', 'C'), 'A', 99)).toEqual(['C', 'B', 'A']);
  });

  it('keeps a request of zero or less at the first position', () => {
    expect(apply(rows('A', 'B', 'C'), 'C', 0)).toEqual(['C', 'B', 'A']);
  });

  it('closes gaps left by older data', () => {
    const gappy: PositionedRow[] = [
      { id: 'a', name: 'a', sortOrder: 3 },
      { id: 'b', name: 'b', sortOrder: 10 },
    ];
    const updates = planReposition(gappy, 'a', 1);
    expect(updates).toEqual([
      { id: 'a', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
  });

  it('does nothing for an id that is not among the siblings', () => {
    expect(planReposition(rows('A', 'B'), 'Z', 1)).toEqual([]);
  });
});
