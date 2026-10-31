// Module 10 (Activity log): who did it, important, grouping, without the database.
import { describe, it, expect } from 'vitest';
import { actorIdOf, isImportant, groupRows, KINDS, ALL_TYPES } from '../../src/services/activity.service.js';

describe('who did it', () => {
  it('Team records: the owner in byUserId (the person acted on is authAccountId); others: actorId, then authAccountId', () => {
    expect(actorIdOf({ eventType: 'admin_changed_role', authAccountId: 'ravi', metadata: { byUserId: 'meena' } })).toBe('meena');
    expect(actorIdOf({ eventType: 'admin_provisioned_user', authAccountId: 'ravi', metadata: {} })).toBeNull();
    expect(actorIdOf({ eventType: 'order_marked_shipped', authAccountId: 'customer', metadata: { actorId: 'anil' } })).toBe('anil');
    expect(actorIdOf({ eventType: 'login_success', authAccountId: 'meena', metadata: {} })).toBe('meena');
  });
});

describe('important (6.7)', () => {
  it('Listed kinds, and a bargain under half the store price', () => {
    expect(isImportant({ eventType: 'subcategory_price_changed' })).toBe(true);
    expect(isImportant({ eventType: 'login_success' })).toBe(false);
    expect(isImportant({ eventType: 'offline_sale_price_override', metadata: { salePrice: 1500, categoryStorePrice: 3800 } })).toBe(true);
    expect(isImportant({ eventType: 'offline_sale_price_override', metadata: { salePrice: 2000, categoryStorePrice: 3800 } })).toBe(false);
  });
  it('Every kind is in exactly one group', () => {
    expect(new Set(ALL_TYPES).size).toBe(ALL_TYPES.length);
    expect(Object.keys(KINDS)).toEqual(['sales', 'orders', 'prices', 'products', 'team', 'settings', 'signin']);
  });
});

describe('grouping (6.5)', () => {
  const row = (id, at, groupKey, type = 'order_marked_shipped') => ({ id, at, groupKey, type, time: at.slice(11, 16), day: at.slice(0, 10), actor: { name: 'Anil' }, text: `Anil shipped ${id}` });
  it('Same key within 10 minutes of the previous one; a gap or another key breaks it; null keys never group', () => {
    const out = groupRows([
      row('a', '2026-10-10T13:10:00Z', 'k'), row('b', '2026-10-10T13:05:00Z', 'k'), row('c', '2026-10-10T12:58:00Z', 'k'),
      row('d', '2026-10-10T12:30:00Z', 'k'), row('e', '2026-10-10T12:29:00Z', null), row('f', '2026-10-10T12:28:00Z', null),
    ]);
    expect(out.map((x) => (x.group ? `g${x.count}` : x.id))).toEqual(['g3', 'd', 'e', 'f']);
    expect(out[0].text).toBe('Anil shipped 3 orders');
  });
  it('Wrong PINs read as a count', () => {
    const wrong = (id, at) => ({ id, at, groupKey: 'x|login_failed|', type: 'login_failed', time: '', day: '', actor: { name: 'Anil' }, text: 'Wrong PIN for Anil' });
    expect(groupRows([wrong('a', '2026-10-12T04:24:00Z'), wrong('b', '2026-10-12T04:22:00Z')])[0].text).toBe('2 wrong PINs for Anil');
  });
});
