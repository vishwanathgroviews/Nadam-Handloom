import { describe, expect, it } from 'vitest';
import { dayLabel, describeAuditEntry } from './auditLog';
import type { AuditLogEntry } from '../api/admin';

const entry = (over: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: 'e1',
  eventType: 'product_updated',
  ipAddress: null,
  metadata: {},
  createdAt: '2026-09-19T10:00:00.000Z',
  ...over,
});

describe('describeAuditEntry', () => {
  it('says who did it, and names the product rather than showing its id', () => {
    const d = describeAuditEntry(entry({
      eventType: 'product_updated',
      actor: { id: 'u1', name: 'Priya Sharma', role: 'Staff' },
      context: { productName: 'Plain Cotton Saree', productSku: 'NH-HCS-001' },
    }));
    expect(d.title).toBe('Product details changed');
    expect(d.byLine).toBe('by Priya Sharma (Staff)');
    expect(d.details).toContainEqual({ label: 'Product', value: 'Plain Cotton Saree · NH-HCS-001' });
  });

  // The old log showed the customer as the person who shipped their order.
  it('credits a shipment to the staff member and lists the customer separately', () => {
    const d = describeAuditEntry(entry({
      eventType: 'order_marked_shipped',
      metadata: { awbNumber: 'D1234567' },
      actor: { id: 'u1', name: 'Ravi', role: 'Staff' },
      subject: { id: 'c1', name: 'Lakshmi Rao', role: 'Customer' },
      context: { orderNumber: 'NH-2026-0042' },
    }));
    expect(d.byLine).toBe('by Ravi (Staff)');
    expect(d.details).toEqual(expect.arrayContaining([
      { label: 'Order', value: 'NH-2026-0042' },
      { label: 'Tracking no.', value: 'D1234567' },
      { label: 'Customer', value: 'Lakshmi Rao' },
    ]));
  });

  it('shows a price change as before → after, only for the prices that changed', () => {
    const d = describeAuditEntry(entry({
      eventType: 'subcategory_price_changed',
      metadata: {
        before: { onlinePrice: '2500', storePrice: '2000', mrp: '3000', description: 'x' },
        after: { onlinePrice: '2600', storePrice: '2000', mrp: '3000', description: 'x' },
      },
      context: { subcategoryName: 'Kanchi Border' },
    }));
    expect(d.details).toContainEqual({ label: 'Website price', value: '₹2,500 → ₹2,600' });
    expect(d.details.find((x) => x.label === 'Store price')).toBeUndefined();
    expect(d.details).toContainEqual({ label: 'Subcategory', value: 'Kanchi Border' });
  });

  it('shows the store price and the price actually charged on a bargained sale', () => {
    const d = describeAuditEntry(entry({
      eventType: 'offline_sale_price_override',
      metadata: { categoryStorePrice: 2000, salePrice: 1750 },
    }));
    expect(d.details).toEqual(expect.arrayContaining([
      { label: 'Store price', value: '₹2,000' },
      { label: 'Sold for', value: '₹1,750' },
    ]));
  });

  it('says so plainly when an older entry never recorded who did it', () => {
    expect(describeAuditEntry(entry({ actor: null })).byLine).toBe('Person not recorded');
  });

  it('still reads sensibly for an event type it has no wording for', () => {
    expect(describeAuditEntry(entry({ eventType: 'stock_counted' })).title).toBe('Stock counted');
  });
});

describe('dayLabel', () => {
  const now = new Date(2026, 8, 19, 15, 0);
  it('groups entries under Today and Yesterday', () => {
    expect(dayLabel(new Date(2026, 8, 19, 9, 0).toISOString(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 8, 18, 22, 0).toISOString(), now)).toBe('Yesterday');
  });
  it('uses the date for anything older', () => {
    expect(dayLabel(new Date(2026, 8, 10, 9, 0).toISOString(), now)).toMatch(/10 Sept?\.? 2026|10 Sep 2026/);
  });
});
