import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/errors';
import { reserveOrderNumber } from '../../utils/orderNumber';
import { createOfflineOrder, resolveAndClaimOfflineSaleItem, OfflineOrderLine } from '../inventory/inventory.service';
import { generateInvoiceForOrder } from '../invoices/invoices.service';
import { logAuthEvent } from '../auth/auditLog.service';

interface CompleteSaleItemInput {
  code: string;
  quantity?: number;
  salePrice?: number;
}

export interface CompleteSaleInput {
  customerName: string;
  customerMobile?: string;
  items: CompleteSaleItemInput[];
}

interface OverriddenLine {
  code: string;
  productId: string;
  storePrice: number;
  salePrice: number;
}

/**
 * The multi-item counterpart to inventory.service.ts's scanSell — one bill,
 * one customer, any number of scanned/typed lines, all landing in a single
 * Order (see the sample exhibition invoice this exists to replicate).
 * Every line is resolved and its stock claimed with the exact same
 * compare-and-swap logic scanSell uses (resolveAndClaimOfflineSaleItem), so
 * a piece reserved by an online buyer mid-checkout still blocks the sale —
 * batch billing just reports which line failed rather than offering an
 * in-cart override; staff can still use the single-scan screen for that.
 */
export const completeSale = async (input: CompleteSaleInput, actorId: string) => {
  const { orderId, orderNumber, overriddenLines } = await prisma.$transaction(async (tx) => {
    const orderNumber = await reserveOrderNumber(tx);
    const lines: OfflineOrderLine[] = [];
    const overriddenLines: OverriddenLine[] = [];

    for (const item of input.items) {
      let line;
      try {
        line = await resolveAndClaimOfflineSaleItem(
          tx,
          item.code,
          {
            ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
            ...(item.salePrice !== undefined ? { salePrice: item.salePrice } : {}),
          },
          actorId,
          orderNumber
        );
      } catch (error) {
        if (error instanceof AppError) {
          throw new AppError(`"${item.code}" — ${error.message}`, error.statusCode, error.code, error.details);
        }
        throw error;
      }

      lines.push(line);
      if (item.salePrice != null && Number(line.unitPrice) !== Number(line.storePrice)) {
        overriddenLines.push({
          code: item.code,
          productId: line.productId,
          storePrice: Number(line.storePrice),
          salePrice: Number(line.unitPrice),
        });
      }
    }

    const order = await createOfflineOrder(tx, orderNumber, lines, {
      fullName: input.customerName,
      ...(input.customerMobile !== undefined ? { phone: input.customerMobile } : {}),
    });

    return { orderId: order.id, orderNumber, overriddenLines };
  });

  // Bargain-dispute traceability, same as scanSell — one event per
  // discounted line, logged after the sale transaction commits.
  for (const o of overriddenLines) {
    await logAuthEvent({
      authAccountId: actorId,
      eventType: 'offline_sale_price_override',
      source: 'staff_app',
      metadata: {
        orderId,
        orderNumber,
        productId: o.productId,
        categoryStorePrice: o.storePrice,
        salePrice: o.salePrice,
      },
    });
  }

  // Staff are waiting on-screen to print/share this, so generate it
  // synchronously rather than via the async event pipeline online orders use.
  const invoice = await generateInvoiceForOrder(orderId, actorId);

  return { orderId, orderNumber, invoice };
};
