/**
 * The bill being built in Scan to Sell: the lines, their prices, and what is
 * finally sent to the server as ONE order with ONE invoice.
 *
 * Kept here, free of React, because this is the arithmetic a shop is handing
 * a customer — it is unit-tested rather than clicked through.
 */

export interface BillLine {
  /** The barcode (or SKU) that was scanned. */
  code: string;
  productName: string;
  categoryName: string;
  /** The catalogue price, as the server sent it. */
  storePrice: string;
  /** What staff typed for this line. Blank means sell at the store price. */
  priceInput: string;
  quantity: number;
  /**
   * True for a barcoded piece — one tag, one physical saree, so scanning it
   * again is the same item, not a second one. False for a product counted by
   * quantity, where scanning again means one more of them.
   */
  serialized: boolean;
}

export interface ScannedItem {
  code: string;
  productName: string;
  categoryName: string;
  storePrice: string;
  priceInput: string;
  serialized: boolean;
}

/** The price this line actually sells at: what was typed, else the store price. */
export const lineUnitPrice = (line: BillLine): number => {
  const typed = Number(line.priceInput.trim());
  return line.priceInput.trim() && Number.isFinite(typed) && typed > 0 ? typed : Number(line.storePrice);
};

export const lineTotal = (line: BillLine): number => lineUnitPrice(line) * line.quantity;

export const billTotal = (bill: BillLine[]): number => bill.reduce((sum, line) => sum + lineTotal(line), 0);

export const billItemCount = (bill: BillLine[]): number => bill.reduce((sum, line) => sum + line.quantity, 0);

export const findLine = (bill: BillLine[], code: string): BillLine | undefined =>
  bill.find((line) => line.code.toUpperCase() === code.toUpperCase());

export type AddOutcome =
  /** A line was appended. */
  | 'added'
  /** A product counted by quantity — one more of it. */
  | 'quantity'
  /** The same barcoded piece scanned twice: the bill is left alone. */
  | 'duplicate';

/**
 * Puts a scanned product onto the bill.
 *
 * Scanning the same tag twice is the commonest thing that happens at a
 * counter — the label is still under the camera when it re-arms — so it is
 * an outcome to report, never an error that throws away the bill.
 */
export const addLine = (bill: BillLine[], item: ScannedItem): { bill: BillLine[]; outcome: AddOutcome } => {
  const existing = findLine(bill, item.code);

  if (existing) {
    if (existing.serialized) return { bill, outcome: 'duplicate' };
    return {
      bill: bill.map((line) =>
        line === existing
          ? {
              ...line,
              quantity: line.quantity + 1,
              // A price typed on this scan applies to the whole line; not
              // typing one leaves whatever the line already had.
              priceInput: item.priceInput.trim() || line.priceInput,
            }
          : line
      ),
      outcome: 'quantity',
    };
  }

  return {
    bill: [...bill, { ...item, priceInput: item.priceInput.trim(), quantity: 1 }],
    outcome: 'added',
  };
};

export interface SellItem {
  code: string;
  override: boolean;
  quantity?: number;
  salePrice?: number;
}

/**
 * The bill as the server wants it.
 *
 * A price is only sent when staff actually typed a different number — blank,
 * or the store price re-typed, sells at the catalogue price and raises no
 * discount audit event.
 */
export const toSellItems = (bill: BillLine[], override: boolean): SellItem[] =>
  bill.map((line) => {
    const typed = Number(line.priceInput.trim());
    const bargained =
      line.priceInput.trim() && Number.isFinite(typed) && typed > 0 && typed !== Number(line.storePrice)
        ? typed
        : undefined;
    return {
      code: line.code,
      override,
      ...(line.quantity > 1 ? { quantity: line.quantity } : {}),
      ...(bargained !== undefined ? { salePrice: bargained } : {}),
    };
  });
