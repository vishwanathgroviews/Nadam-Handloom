import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, NotFoundError } from '../../utils/errors';
import { reserveOrderNumber } from '../../utils/orderNumber';
import { normalizeBarcode, barcodeCandidates } from '../../utils/barcode';
import { generateInvoiceForOrder } from '../invoices/invoices.service';
import { logAuthEvent } from '../auth/auditLog.service';

type Tx = Prisma.TransactionClient;

/**
 * How long an unpaid checkout may hold stock. A shopper who opens the
 * payment sheet and walks away must not keep a saree off the shelf
 * indefinitely — after this window the expiry sweep puts it back and it
 * reads as in stock again everywhere (catalog.availability.ts counts only
 * `in_stock` pieces plus the legacy counter, both of which the release
 * restores).
 */
export const RESERVATION_TTL_MS = 10 * 60 * 1000;
const LOW_STOCK_THRESHOLD = 3;

export interface ReserveRequestItem {
  productId: string;
  quantity: number;
}

export interface ReservedLine {
  productId: string;
  pieceId: string | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
  productName: string;
  productImage: string | null;
}

// ─────────────────────────────────────────────────────────────────
// Online reservations — the double-sell fix.
//
// No raw SQL / explicit row locks: a conditional `updateMany` (WHERE the
// row is still in the state we expect) is atomic per-row in Postgres —
// two concurrent transactions racing to claim the same unit will have
// exactly one succeed (count === 1) and the other see count === 0 and
// correctly detect the conflict. This is the standard compare-and-swap
// pattern for exactly this problem, and it's portable to the in-memory
// test double (fakePrisma) since it needs no raw queries.
// ─────────────────────────────────────────────────────────────────

/**
 * Reserves stock for every item in a checkout, inside the same transaction
 * that creates the order. Throws AppError('OUT_OF_STOCK', 409) the moment
 * any item can't be fully reserved — the caller's transaction then rolls
 * back everything (including any earlier items already claimed in this
 * same call), so a failed checkout never leaves a partial hold behind.
 */
export const reserveItemsForOrder = async (
  tx: Tx,
  orderId: string,
  items: ReserveRequestItem[]
): Promise<ReservedLine[]> => {
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
  const lines: ReservedLine[] = [];

  for (const item of items) {
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      include: {
        subcategory: { select: { onlinePrice: true } },
        images: { take: 1, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product || !product.isActive) {
      throw new AppError('One of the items in your cart is no longer available', 409, 'OUT_OF_STOCK');
    }
    if (!['online_only', 'both'].includes(product.channelVisibility)) {
      throw new AppError(`"${product.name}" is not available online`, 409, 'OUT_OF_STOCK');
    }

    const unitPrice = product.subcategory.onlinePrice;
    const productImage = product.images[0]?.url ?? null;

    // Every product can carry both individually-barcoded pieces and a
    // legacy bulk `stock` counter side by side (see Piece model comment) —
    // claim from in-stock pieces first, then fall back to the counter for
    // whatever's still needed, rather than branching on trackingMode.
    const claimedPieceIds: string[] = [];
    // A handful of passes covers contention from other concurrent buyers
    // claiming pieces out from under this candidate list.
    for (let attempt = 0; attempt < 3 && claimedPieceIds.length < item.quantity; attempt++) {
      const stillNeeded = item.quantity - claimedPieceIds.length;
      const candidates = await tx.piece.findMany({
        where: { productId: product.id, status: 'in_stock' },
        orderBy: { createdAt: 'asc' },
        take: stillNeeded * 2 + 3,
        select: { id: true },
      });
      if (!candidates.length) break;
      for (const candidate of candidates) {
        if (claimedPieceIds.length >= item.quantity) break;
        const claim = await tx.piece.updateMany({
          where: { id: candidate.id, status: 'in_stock' },
          data: { status: 'reserved' },
        });
        if (claim.count === 1) claimedPieceIds.push(candidate.id);
      }
    }

    let stockClaimed = 0;
    const stillNeededFromStock = item.quantity - claimedPieceIds.length;
    if (stillNeededFromStock > 0) {
      const claim = await tx.product.updateMany({
        where: { id: product.id, stock: { gte: stillNeededFromStock } },
        data: { stock: { decrement: stillNeededFromStock } },
      });
      if (claim.count === 1) stockClaimed = stillNeededFromStock;
    }

    const totalClaimed = claimedPieceIds.length + stockClaimed;
    if (totalClaimed < item.quantity) {
      throw new AppError(
        totalClaimed === 0
          ? `"${product.name}" just sold out`
          : `Only ${totalClaimed} left of "${product.name}"`,
        409,
        'OUT_OF_STOCK'
      );
    }

    for (const pieceId of claimedPieceIds) {
      await tx.reservation.create({ data: { productId: product.id, pieceId, quantity: 1, orderId, expiresAt } });
      await tx.stockLedger.create({
        data: { productId: product.id, pieceId, delta: -1, reason: 'reserve', channel: 'online', ref: orderId },
      });
      lines.push({ productId: product.id, pieceId, quantity: 1, unitPrice, productName: product.name, productImage });
    }
    if (stockClaimed > 0) {
      await tx.reservation.create({ data: { productId: product.id, quantity: stockClaimed, orderId, expiresAt } });
      await tx.stockLedger.create({
        data: { productId: product.id, delta: -stockClaimed, reason: 'reserve', channel: 'online', ref: orderId },
      });
      lines.push({ productId: product.id, pieceId: null, quantity: stockClaimed, unitPrice, productName: product.name, productImage });
    }
  }

  return lines;
};

/** Payment captured: converts every active reservation on this order into a real sale. */
export const finalizeReservationsForOrder = async (tx: Tx, orderId: string): Promise<void> => {
  const reservations = await tx.reservation.findMany({ where: { orderId, status: 'active' } });
  for (const r of reservations) {
    if (r.pieceId) {
      await tx.piece.update({ where: { id: r.pieceId }, data: { status: 'sold_online', soldAt: new Date() } });
    }
    await tx.reservation.update({ where: { id: r.id }, data: { status: 'converted' } });
    await tx.stockLedger.create({
      data: { productId: r.productId, pieceId: r.pieceId, delta: 0, reason: 'online_sale', channel: 'online', ref: orderId },
    });
  }
};

/** Payment failed/cancelled: frees the held stock immediately rather than waiting for the TTL sweep. */
export const releaseReservationsForOrder = async (tx: Tx, orderId: string): Promise<void> => {
  const reservations = await tx.reservation.findMany({ where: { orderId, status: 'active' } });
  for (const r of reservations) {
    if (r.pieceId) {
      await tx.piece.updateMany({ where: { id: r.pieceId, status: 'reserved' }, data: { status: 'in_stock' } });
    } else {
      await tx.product.update({ where: { id: r.productId }, data: { stock: { increment: r.quantity } } });
    }
    await tx.reservation.update({ where: { id: r.id }, data: { status: 'released' } });
    await tx.stockLedger.create({
      data: { productId: r.productId, pieceId: r.pieceId, delta: r.quantity, reason: 'release', channel: 'online', ref: orderId },
    });
  }
};

/** Periodic sweep for abandoned checkouts — releases reservations past their TTL. Safe to run concurrently/repeatedly. */
export const sweepExpiredReservations = async (): Promise<number> => {
  const expired = await prisma.reservation.findMany({
    where: { status: 'active', expiresAt: { lt: new Date() } },
    select: { id: true },
  });

  let swept = 0;
  for (const { id } of expired) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.reservation.findUnique({ where: { id } });
      if (!fresh || fresh.status !== 'active') return;
      if (fresh.pieceId) {
        await tx.piece.updateMany({ where: { id: fresh.pieceId, status: 'reserved' }, data: { status: 'in_stock' } });
      } else {
        await tx.product.update({ where: { id: fresh.productId }, data: { stock: { increment: fresh.quantity } } });
      }
      await tx.reservation.update({ where: { id }, data: { status: 'expired' } });
      await tx.stockLedger.create({
        data: { productId: fresh.productId, pieceId: fresh.pieceId, delta: fresh.quantity, reason: 'release', channel: 'online', ref: fresh.orderId },
      });
      swept += 1;
    });
  }
  return swept;
};

// ─────────────────────────────────────────────────────────────────
// Scan-to-lookup / scan-to-sell — the admin app's in-store flow.
// Offline sales are synchronous (no reservation stage): scan, confirm,
// sold. A serialized piece that's `reserved` (an online buyer mid-payment)
// blocks the sale unless the owner explicitly overrides.
// ─────────────────────────────────────────────────────────────────

export interface OfflineOrderLine {
  productId: string;
  pieceId: string | null;
  quantity: number;
  unitPrice: Prisma.Decimal | number;
  productName: string;
  productImage?: string | null;
}

export interface WhatsappCustomer {
  phone: string;
  /** The whole delivery address as one block of text — see whatsappCustomerSchema. */
  address: string;
  notes?: string;
}

// Used by scanSell's counter/WhatsApp sale (below) — every offline sale,
// whether one scanned piece or a whole exhibition bill, is one Order
// created here. A 'store' sale is synchronous and payment-complete at
// creation (no separate Payment row, unlike online/Razorpay orders) —
// there's no "pending" state to wait out, so it lands as `delivered`.
// A 'whatsapp' sale is agreed over chat but still has to be packed and
// couriered, so it lands as `processing` with a Shipment row — exactly the
// shape the To Ship queue and markOrderShipped already expect of an online
// order, which is why WhatsApp orders flow through the same AWB screen.
export const createOfflineOrder = async (
  tx: Tx,
  orderNumber: string,
  items: OfflineOrderLine[],
  customer?: { fullName?: string; phone?: string } | WhatsappCustomer,
  channel: 'store' | 'whatsapp' = 'store'
) => {
  const total = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const isWhatsapp = channel === 'whatsapp';
  // Stored in the same shape every other order uses, so the To Ship screen
  // and the shipment message read one field set regardless of where the
  // order came from: the free-text WhatsApp address lands in line1.
  const shippingAddress: Prisma.InputJsonValue = isWhatsapp && customer && 'address' in customer
    ? {
        fullName: '',
        phone: customer.phone,
        line1: customer.address,
        line2: null,
        city: '',
        state: '',
        pincode: '',
        ...(customer.notes ? { notes: customer.notes } : {}),
      }
    : ({ ...(customer ?? {}) } as Prisma.InputJsonObject);

  const order = await tx.order.create({
    data: {
      orderNumber,
      channel,
      status: isWhatsapp ? 'processing' : 'delivered',
      subtotal: total,
      total,
      shippingAddress,
    },
  });
  await tx.orderItem.createMany({
    data: items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      pieceId: item.pieceId,
      nameSnapshot: item.productName,
      priceSnapshot: item.unitPrice,
      imageSnapshot: item.productImage ?? null,
      quantity: item.quantity,
    })),
  });
  if (isWhatsapp) await tx.shipment.create({ data: { orderId: order.id } });
  return order;
};

export const scanLookup = async (code: string) => {
  // Not one string but every form the same physical tag can decode as — a
  // camera reports whichever symbology it matched this frame, so scanning one
  // label twice can genuinely produce two different strings (see
  // barcodeCandidates). Matching the family is what makes a repeat scan of a
  // tag resolve to the piece the first scan found.
  const candidates = barcodeCandidates(code);
  if (!candidates.length) throw new NotFoundError('No product found for this code');

  const piece = await prisma.piece.findFirst({
    where: { barcode: { in: candidates } },
    include: { product: { include: { category: { select: { name: true } }, subcategory: { select: { storePrice: true } } } } },
  });
  if (piece) {
    return {
      mode: 'serialized' as const,
      productId: piece.productId,
      productName: piece.product.name,
      categoryName: piece.product.category.name,
      pieceId: piece.id,
      barcode: piece.barcode,
      status: piece.status,
      storePrice: piece.product.subcategory.storePrice,
    };
  }

  const product = await prisma.product.findFirst({
    where: { sku: { in: candidates } },
    include: { category: { select: { name: true } }, subcategory: { select: { storePrice: true } } },
  });
  if (product) {
    return {
      mode: 'quantity' as const,
      productId: product.id,
      productName: product.name,
      categoryName: product.category.name,
      sku: product.sku,
      status: product.stock > 0 ? 'in_stock' : 'out_of_stock',
      availableQty: product.stock,
      storePrice: product.subcategory.storePrice,
    };
  }

  throw new NotFoundError('No product found for this code');
};

export interface ScanSellSoldLine {
  productId: string;
  productName: string;
  quantity: number;
  /** What this line actually sold for — the bargained price when one was set. */
  unitPrice: number;
  /** The subcategory's price, unchanged by any bargain on this sale. */
  storePrice: number;
  overridden: boolean;
  priceAdjusted: boolean;
}

export interface ScanSellResult {
  orderId: string;
  orderNumber: string;
  /** True if any line on this sale overrode an online reservation. */
  overridden: boolean;
  channel: 'store' | 'whatsapp';
  items: ScanSellSoldLine[];
  total: number;
  // Null only when invoice generation itself failed (storage unconfigured or
  // unreachable). The sale is committed either way — see scanSell.
  invoice: Awaited<ReturnType<typeof generateInvoiceForOrder>> | null;
}

export interface ClaimedSaleLine extends OfflineOrderLine {
  storePrice: Prisma.Decimal | number;
  overridden: boolean;
}

/**
 * Resolves one scanned code (barcode or SKU) and atomically claims its
 * stock for an offline sale, writing the same StockLedger trail either way
 * — the shared core of scanSell's single-item quick-sell (below) and the
 * counter and WhatsApp sale paths. Does not create
 * an Order itself: callers batch one or more claimed lines into a single
 * createOfflineOrder call, so a multi-item bill is one Order, not one per
 * scan. `ledgerRef` is the order number the caller has already reserved —
 * shared by every line on a multi-item bill.
 */
export const resolveAndClaimOfflineSaleItem = async (
  tx: Tx,
  code: string,
  input: { quantity?: number; override?: boolean; salePrice?: number },
  actorId: string,
  ledgerRef: string
): Promise<ClaimedSaleLine> => {
  // Same symbology-family match scanLookup uses, so the code that was looked
  // up and shown on the confirm step is the one that actually sells.
  const candidates = barcodeCandidates(code);
  if (!candidates.length) throw new NotFoundError('No product found for this code');

  const piece = await tx.piece.findFirst({
    where: { barcode: { in: candidates } },
    include: {
      product: {
        include: {
          subcategory: { select: { storePrice: true } },
          images: { take: 1, orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  });

  if (piece) {
    if (piece.status === 'sold_online' || piece.status === 'sold_offline') {
      throw new AppError('This piece has already been sold', 409, 'ALREADY_SOLD');
    }
    if (piece.status === 'damaged' || piece.status === 'returned') {
      throw new AppError(`This piece is marked "${piece.status}" and can't be sold`, 409, 'UNAVAILABLE');
    }

    let overridden = false;
    if (piece.status === 'reserved') {
      if (!input.override) {
        throw new AppError('Reserved online right now — an online buyer may be mid-checkout', 409, 'RESERVED_ONLINE');
      }
      const reservation = await tx.reservation.findFirst({ where: { pieceId: piece.id, status: 'active' } });
      if (reservation) await tx.reservation.update({ where: { id: reservation.id }, data: { status: 'released' } });
      overridden = true;
    }

    const claim = await tx.piece.updateMany({
      where: { id: piece.id, status: piece.status },
      data: { status: 'sold_offline', soldAt: new Date() },
    });
    if (claim.count !== 1) {
      throw new AppError('This piece just changed status — please scan again', 409, 'CONFLICT');
    }

    const storePrice = piece.product.subcategory.storePrice;
    const unitPrice = input.salePrice != null ? input.salePrice : storePrice;

    await tx.stockLedger.create({
      data: { productId: piece.productId, pieceId: piece.id, delta: -1, reason: 'offline_sale', channel: 'store', actorId, ref: ledgerRef },
    });
    if (overridden) {
      await tx.stockLedger.create({
        data: { productId: piece.productId, pieceId: piece.id, delta: 0, reason: 'release', channel: 'store', actorId, ref: `override:${ledgerRef}` },
      });
    }

    return {
      productId: piece.productId,
      pieceId: piece.id,
      quantity: 1,
      unitPrice,
      productName: piece.product.name,
      productImage: piece.product.images[0]?.url ?? null,
      storePrice,
      overridden,
    };
  }

  const product = await tx.product.findFirst({
    where: { sku: { in: candidates } },
    include: { subcategory: { select: { storePrice: true } }, images: { take: 1, orderBy: { sortOrder: 'asc' } } },
  });
  if (!product) throw new NotFoundError('No product found for this code');

  const quantity = input.quantity ?? 1;
  const claim = await tx.product.updateMany({
    where: { id: product.id, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  if (claim.count !== 1) {
    throw new AppError('Not enough stock — some may be reserved online right now', 409, 'INSUFFICIENT_STOCK');
  }

  const storePrice = product.subcategory.storePrice;
  const unitPrice = input.salePrice != null ? input.salePrice : storePrice;

  await tx.stockLedger.create({
    data: { productId: product.id, delta: -quantity, reason: 'offline_sale', channel: 'store', actorId, ref: ledgerRef },
  });

  return {
    productId: product.id,
    pieceId: null,
    quantity,
    unitPrice,
    productName: product.name,
    productImage: product.images[0]?.url ?? null,
    storePrice,
    overridden: false,
  };
};

export interface ScanSellItemInput {
  code: string;
  quantity?: number;
  override?: boolean;
  salePrice?: number;
}

/**
 * Completes one offline sale of one or more scanned products.
 *
 * Every line is claimed inside a single transaction, so a bill either goes
 * through whole or not at all — a sold-out item on line three rolls back the
 * stock already claimed for lines one and two rather than leaving them
 * orphaned on a half-made order. The lines then become ONE Order with one
 * order number and one invoice, which is what the customer is handed.
 *
 * A line's `salePrice` is the bargained price for that line on this bill
 * only. It is written to OrderItem.priceSnapshot; nothing touches
 * Subcategory.storePrice, so the next sale starts from the real price again.
 */
export const scanSell = async (
  input: {
    items: ScanSellItemInput[];
    channel?: 'store' | 'whatsapp';
    customer?: WhatsappCustomer;
  },
  actorId: string
): Promise<ScanSellResult> => {
  const channel = input.channel ?? 'store';
  const result = await prisma.$transaction(async (tx) => {
    const orderNumber = await reserveOrderNumber(tx);
    const lines: ClaimedSaleLine[] = [];
    for (const item of input.items) {
      lines.push(await resolveAndClaimOfflineSaleItem(tx, item.code, item, actorId, orderNumber));
    }
    const order = await createOfflineOrder(tx, orderNumber, lines, input.customer, channel);

    return {
      orderId: order.id,
      orderNumber,
      lines: lines.map((line, i) => ({
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: Number(line.unitPrice),
        storePrice: Number(line.storePrice),
        overridden: line.overridden,
        priceAdjusted:
          input.items[i]?.salePrice != null && Number(line.unitPrice) !== Number(line.storePrice),
      })),
    };
  });

  // Bargain-dispute traceability: one audit event per line that went out at
  // a price other than the subcategory's store price, so Admin can review
  // every staff-entered discount later.
  for (const line of result.lines) {
    if (!line.priceAdjusted) continue;
    await logAuthEvent({
      authAccountId: actorId,
      eventType: 'offline_sale_price_override',
      source: 'staff_app',
      metadata: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        productId: line.productId,
        categoryStorePrice: line.storePrice,
        salePrice: line.unitPrice,
      },
    });
  }

  // Every counter sale gets an invoice, exactly like an online
  // flow — a single scanned sale is no less a sale, and staff are standing
  // there ready to print or share it, so it's generated synchronously rather
  // than through the async event pipeline online orders use.
  //
  // Never fatal: the sale is already committed by this point (stock claimed,
  // order written), so letting a storage hiccup surface as a failed request
  // would invite staff to scan the item a second time. The invoice is
  // idempotent and recoverable from the Invoices screen instead.
  let invoice: ScanSellResult['invoice'] = null;
  try {
    invoice = await generateInvoiceForOrder(result.orderId, actorId);
  } catch (error) {
    console.error(`Sale ${result.orderNumber} completed but its invoice could not be generated:`, error);
  }

  return {
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    overridden: result.lines.some((line) => line.overridden),
    channel,
    items: result.lines,
    total: result.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    invoice,
  };
};

// ─────────────────────────────────────────────────────────────────
// Piece intake, stock ledger, low stock — supporting admin screens.
// ─────────────────────────────────────────────────────────────────

// Every physical unit is now individually barcoded by an external device
// before it reaches the app — staff scan each unit in here rather than
// typing a quantity. Barcodes are never recycled: once assigned to a Piece,
// that code is permanently taken even if the piece is later sold/damaged.
/**
 * Validates a batch of scanned codes and turns them into in-stock Piece rows
 * for `productId`, inside a transaction the caller owns.
 *
 * Shared by receivePieces (restocking an existing product) and product
 * creation (catalog.admin.service.ts), which assigns a product's first units
 * in the very transaction that creates the product — so a product can never
 * end up listed without the barcodes staff scanned for it, and a code can
 * never be consumed by a product that then failed to save.
 *
 * Both checks run inside the transaction on purpose: doing them beforehand
 * leaves a window where a concurrent scan claims the same code in between.
 */
export const claimPiecesForProduct = async (
  tx: Tx,
  productId: string,
  barcodes: string[],
  actorId: string
): Promise<{ id: string; barcode: string }[]> => {
  // Stored canonically so scanLookup finds the piece no matter which case the
  // code arrives in later — normalizing before the duplicate checks also stops
  // the same tag being claimed twice as "ABC123" and "abc123".
  const normalized = barcodes.map(normalizeBarcode);

  const uniqueCodes = new Set(normalized);
  if (uniqueCodes.size !== normalized.length) {
    throw new AppError('This batch has a duplicate code in it', 409, 'DUPLICATE_IN_BATCH');
  }

  // Checked against every equivalent form, not just the literal string: a tag
  // already stored as its EAN-13 form would otherwise be claimable a second
  // time by scanning the same label as UPC-A.
  const existing = await tx.piece.findMany({
    where: { barcode: { in: normalized.flatMap((code) => barcodeCandidates(code)) } },
    include: { product: { select: { name: true } } },
  });
  if (existing.length) {
    throw new AppError(
      existing.length === 1 ? 'Barcode already used' : 'Barcodes already used',
      409,
      'BARCODE_ALREADY_ASSIGNED',
      existing.map((e) => ({ barcode: e.barcode, productName: e.product.name, status: e.status }))
    );
  }

  const rows: { id: string; barcode: string }[] = [];
  for (const barcode of normalized) {
    const piece = await tx.piece.create({ data: { productId, barcode, status: 'in_stock' } });
    await tx.stockLedger.create({
      data: { productId, pieceId: piece.id, delta: 1, reason: 'restock', channel: 'store', actorId, ref: barcode },
    });
    rows.push({ id: piece.id, barcode: piece.barcode });
  }
  return rows;
};

export const receivePieces = async (productId: string, barcodes: string[], actorId: string) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Product not found');

  return prisma.$transaction((tx) => claimPiecesForProduct(tx, productId, barcodes, actorId));
};

export const listPieces = async (productId: string) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Product not found');
  return prisma.piece.findMany({
    where: { productId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, barcode: true, status: true, soldAt: true, createdAt: true },
  });
};

export const getStockLedger = async (query: { productId?: string; page: number; pageSize: number }) => {
  const where: any = {};
  if (query.productId) where.productId = query.productId;

  const [items, total] = await Promise.all([
    prisma.stockLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { product: { select: { name: true, sku: true } }, piece: { select: { barcode: true } } },
    }),
    prisma.stockLedger.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
};

/** Periodically releases abandoned-checkout reservations past their TTL. */
export const startReservationExpirySweep = () => {
  // Runs well inside the TTL so a hold is actually released at ~10 minutes
  // rather than up to a minute late — the sweep is a cheap indexed lookup
  // (Reservation has an index on [status, expiresAt]) and is a no-op when
  // nothing has expired.
  const SWEEP_INTERVAL_MS = 15 * 1000;

  const interval = setInterval(() => {
    sweepExpiredReservations().catch((error) => console.error('Reservation expiry sweep failed:', error));
  }, SWEEP_INTERVAL_MS);

  interval.unref();
  return interval;
};

// A product's real availability is its legacy `stock` counter plus however
// many individually-barcoded pieces are still in_stock — trackingMode no
// longer gates which of those two pools a product can draw from, so this
// checks every active product the same way rather than splitting by mode.
export const getLowStock = async () => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, sku: true, stock: true, category: { select: { name: true } } },
  });

  const items: (typeof products[number] & { availableCount: number })[] = [];
  for (const p of products) {
    const availablePieces = await prisma.piece.count({ where: { productId: p.id, status: 'in_stock' } });
    const availableCount = p.stock + availablePieces;
    if (availableCount <= LOW_STOCK_THRESHOLD) items.push({ ...p, availableCount });
  }
  items.sort((a, b) => a.availableCount - b.availableCount);

  return { items, threshold: LOW_STOCK_THRESHOLD };
};
