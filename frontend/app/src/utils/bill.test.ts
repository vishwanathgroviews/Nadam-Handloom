import { describe, expect, it } from 'vitest';
import {
  addLine,
  billItemCount,
  billTotal,
  findLine,
  lineTotal,
  lineUnitPrice,
  toSellItems,
  BillLine,
  ScannedItem,
} from './bill';

const scanned = (over: Partial<ScannedItem> = {}): ScannedItem => ({
  code: 'NH0001',
  productName: 'Ikkath Border Check Saree',
  categoryName: 'Handloom Pattu Saree',
  storePrice: '3500',
  priceInput: '',
  serialized: true,
  ...over,
});

const line = (over: Partial<BillLine> = {}): BillLine => ({
  ...scanned(),
  quantity: 1,
  ...over,
});

describe('adding scanned products to one bill', () => {
  it('puts each different product on its own line', () => {
    let bill: BillLine[] = [];
    ({ bill } = addLine(bill, scanned({ code: 'NH0001' })));
    const second = addLine(bill, scanned({ code: 'NH0002', productName: 'Kuppadam Saree' }));
    expect(second.outcome).toBe('added');
    expect(second.bill.map((l) => l.code)).toEqual(['NH0001', 'NH0002']);
  });

  it('keeps the bill untouched when the same barcoded piece is scanned twice', () => {
    const { bill } = addLine([], scanned({ code: 'NH0001' }));
    const again = addLine(bill, scanned({ code: 'nh0001' })); // same tag, any case
    expect(again.outcome).toBe('duplicate');
    expect(again.bill).toBe(bill);
    expect(again.bill).toHaveLength(1);
  });

  it('counts one more of a product that is sold by quantity', () => {
    const { bill } = addLine([], scanned({ code: 'SKU-9', serialized: false }));
    const again = addLine(bill, scanned({ code: 'SKU-9', serialized: false }));
    expect(again.outcome).toBe('quantity');
    expect(again.bill[0]!.quantity).toBe(2);
  });

  it('carries over the price typed on the scan that added the line', () => {
    const { bill } = addLine([], scanned({ priceInput: ' 3200 ' }));
    expect(bill[0]!.priceInput).toBe('3200');
  });

  it('applies a price typed on a later scan to the whole quantity line', () => {
    const { bill } = addLine([], scanned({ code: 'SKU-9', serialized: false }));
    const { bill: after } = addLine(bill, scanned({ code: 'SKU-9', serialized: false, priceInput: '3000' }));
    expect(after[0]!.priceInput).toBe('3000');
    expect(lineTotal(after[0]!)).toBe(6000);
  });

  it('finds a line however the code was typed', () => {
    const bill = [line({ code: 'NH0001' })];
    expect(findLine(bill, 'nh0001')?.code).toBe('NH0001');
    expect(findLine(bill, 'NH0002')).toBeUndefined();
  });
});

describe('what the bill adds up to', () => {
  it('sells at the store price when nothing was typed', () => {
    expect(lineUnitPrice(line({ storePrice: '3500' }))).toBe(3500);
  });

  it('sells at the typed price when one was', () => {
    expect(lineUnitPrice(line({ storePrice: '3500', priceInput: '3200' }))).toBe(3200);
  });

  it('ignores a blank, zero or nonsense price and falls back to the store price', () => {
    expect(lineUnitPrice(line({ priceInput: '   ' }))).toBe(3500);
    expect(lineUnitPrice(line({ priceInput: '0' }))).toBe(3500);
    expect(lineUnitPrice(line({ priceInput: 'abc' }))).toBe(3500);
  });

  it('multiplies by the quantity and adds the lines up', () => {
    const bill = [
      line({ code: 'A', storePrice: '3500' }),
      line({ code: 'B', storePrice: '1000', serialized: false, quantity: 3 }),
      line({ code: 'C', storePrice: '2000', priceInput: '1800' }),
    ];
    expect(lineTotal(bill[1]!)).toBe(3000);
    expect(billTotal(bill)).toBe(3500 + 3000 + 1800);
    expect(billItemCount(bill)).toBe(5);
  });
});

describe('what is sent to the server', () => {
  it('sends every line of the bill, so they become one order and one invoice', () => {
    const bill = [line({ code: 'A' }), line({ code: 'B' }), line({ code: 'C' })];
    expect(toSellItems(bill, false).map((i) => i.code)).toEqual(['A', 'B', 'C']);
  });

  it('sends a price only when it differs from the store price', () => {
    const bill = [
      line({ code: 'A', storePrice: '3500', priceInput: '' }),
      line({ code: 'B', storePrice: '3500', priceInput: '3500' }),
      line({ code: 'C', storePrice: '3500', priceInput: '3200' }),
    ];
    const items = toSellItems(bill, false);
    expect(items[0]!.salePrice).toBeUndefined();
    expect(items[1]!.salePrice).toBeUndefined();
    expect(items[2]!.salePrice).toBe(3200);
  });

  it('sends a quantity only when more than one was scanned', () => {
    const items = toSellItems([line({ code: 'A' }), line({ code: 'B', serialized: false, quantity: 4 })], false);
    expect(items[0]!.quantity).toBeUndefined();
    expect(items[1]!.quantity).toBe(4);
  });

  it('carries the override flag onto every line', () => {
    expect(toSellItems([line({ code: 'A' }), line({ code: 'B' })], true).every((i) => i.override)).toBe(true);
  });
});
