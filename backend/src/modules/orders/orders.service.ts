import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError, BadRequestError, NotFoundError } from '../../utils/errors';
import { paymentProvider } from '../../providers/payment';
import { DTDC_TRACKING_URL } from '../../utils/constants';
import { reserveOrderNumber } from '../../utils/orderNumber';
import { reserveItemsForOrder, finalizeReservationsForOrder, releaseReservationsForOrder } from '../inventory/inventory.service';
import { writeEvent } from '../events/events.service';

interface CheckoutInput {
  items: { productId: string; quantity: number }[];
  addressId?: string;
  address?: any;
}

export const checkout = async (authAccountId: string, data: CheckoutInput) => {
  let address;
  if (data.addressId) {
    address = await prisma.address.findUnique({ where: { id: data.addressId } });
    if (!address || address.authAccountId !== authAccountId) throw new NotFoundError('Address not found');
  } else if (data.address) {
    const existingCount = await prisma.address.count({ where: { authAccountId } });
    address = await prisma.address.create({
      data: { ...data.address, authAccountId, isDefault: existingCount === 0 },
    });
  } else {
    throw new BadRequestError('A shipping address is required');
  }

  if (!paymentProvider.isConfigured()) {
    throw new AppError(
      'Online payments are not configured yet. Please contact support.',
      503,
      'PAYMENT_NOT_CONFIGURED'
    );
  }

  const shippingAddress = {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country,
  };

  // Reservation + order creation happen in one transaction: two buyers
  // racing for the same unit can never both win it — see
  // inventory.service.ts's reserveItemsForOrder for how the claim is made
  // atomic. A shortfall throws and rolls back the whole order, including
  // any earlier items already claimed in this same checkout.
  const { order, total } = await prisma.$transaction(async (tx) => {
    const orderNumber = await reserveOrderNumber(tx);
    const draft = await tx.order.create({
      data: {
        orderNumber,
        authAccountId,
        addressId: address.id,
        channel: 'online',
        subtotal: 0,
        total: 0,
        shippingAddress,
      },
    });

    const lines = await reserveItemsForOrder(tx, draft.id, data.items);

    // No shipping fee is ever charged — the order total is exactly the sum
    // of its line items.
    const subtotal = lines.reduce((sum, line) => sum + Number(line.unitPrice) * line.quantity, 0);
    const total = subtotal;

    await tx.order.update({ where: { id: draft.id }, data: { subtotal, total } });
    await tx.orderItem.createMany({
      data: lines.map((line) => ({
        orderId: draft.id,
        productId: line.productId,
        pieceId: line.pieceId,
        nameSnapshot: line.productName,
        priceSnapshot: line.unitPrice,
        imageSnapshot: line.productImage,
        quantity: line.quantity,
      })),
    });

    return { order: draft, total };
  });

  // The reservation is already committed at this point, so anything that
  // goes wrong from here on has to hand the stock back itself — there is no
  // transaction left to roll back. Without this, a payment gateway that was
  // down for ten seconds kept every item in that cart off the shelf for the
  // full reservation TTL, against an order that could never be paid because
  // it never got a payment record.
  let razorpayOrder;
  try {
    razorpayOrder = await paymentProvider.createOrder({
      amount: total,
      currency: 'INR',
      receipt: order.orderNumber,
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        razorpayOrderId: razorpayOrder.providerOrderId,
        amount: total,
        status: 'created',
      },
    });
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await releaseReservationsForOrder(tx, order.id);
      await tx.order.update({ where: { id: order.id }, data: { status: 'payment_failed' } });
    });
    throw error;
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: total,
    currency: 'INR',
    razorpayOrderId: razorpayOrder.providerOrderId,
    razorpayKeyId: env.RAZORPAY_KEY_ID ?? null,
  };
};

export const verifyPayment = async (
  authAccountId: string,
  orderId: string,
  data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order || order.authAccountId !== authAccountId) throw new NotFoundError('Order not found');
  if (!order.payment) throw new BadRequestError('No payment record exists for this order');
  if (order.payment.razorpayOrderId !== data.razorpay_order_id) {
    throw new BadRequestError('Payment order mismatch');
  }

  // Already finalized — most likely the webhook beat this browser callback
  // to it. Nothing left to do; redoing it would double-fire the push event.
  if (order.payment.status === 'paid') {
    return { orderId, status: 'processing' };
  }

  const isValid = paymentProvider.verifyPaymentSignature({
    orderId: data.razorpay_order_id,
    paymentId: data.razorpay_payment_id,
    signature: data.razorpay_signature,
  });

  if (!isValid) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { orderId }, data: { status: 'failed' } });
      await tx.order.update({ where: { id: orderId }, data: { status: 'payment_failed' } });
      // Free the held stock right away — no reason to make it wait out the TTL.
      await releaseReservationsForOrder(tx, orderId);
    });
    throw new BadRequestError('Payment verification failed');
  }

  await finalizeCapturedPayment(orderId, data.razorpay_payment_id, data.razorpay_signature);
  return { orderId, status: 'processing' };
};

/**
 * The one place a captured payment actually gets finalized — called from
 * both the client's post-checkout callback (verifyPayment above) and the
 * Razorpay webhook. Idempotent: a conditional `updateMany` (status still
 * not 'paid') is the atomic claim, so if both callers race, exactly one
 * finalizes and the other is a clean no-op — no double shipment, no double
 * push notification.
 */
export const finalizeCapturedPayment = async (
  orderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string | null
): Promise<'finalized' | 'already_finalized' | 'not_found'> => {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
  if (!order || !order.payment) return 'not_found';
  if (order.payment.status === 'paid') return 'already_finalized';

  return prisma.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({
      where: { orderId, status: { not: 'paid' } },
      data: {
        status: 'paid',
        razorpayPaymentId,
        ...(razorpaySignature ? { razorpaySignature } : {}),
      },
    });
    if (claim.count === 0) return 'already_finalized';

    await tx.order.update({ where: { id: orderId }, data: { status: 'processing' } });
    const existingShipment = await tx.shipment.findUnique({ where: { orderId } });
    if (!existingShipment) await tx.shipment.create({ data: { orderId } });
    await finalizeReservationsForOrder(tx, orderId);
    await writeEvent(tx, 'order.paid', { orderId, orderNumber: order.orderNumber, total: Number(order.total) });
    return 'finalized';
  });
};

/** Ignores anything that isn't a captured payment for an order we recognize — Razorpay retries webhooks, and we'd rather no-op than 500 and get retried forever. */
export const handleRazorpayWebhookEvent = async (payload: any): Promise<void> => {
  if (payload?.event !== 'payment.captured') return;

  const paymentEntity = payload?.payload?.payment?.entity;
  const razorpayOrderId = paymentEntity?.order_id;
  const razorpayPaymentId = paymentEntity?.id;
  if (!razorpayOrderId || !razorpayPaymentId) return;

  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId } });
  if (!payment) {
    console.warn(`Razorpay webhook: no local payment record for Razorpay order ${razorpayOrderId}`);
    return;
  }

  await finalizeCapturedPayment(payment.orderId, razorpayPaymentId, null);
};

export const listOrders = async (authAccountId: string, page: number, pageSize: number) => {
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where: { authAccountId },
      orderBy: { placedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: true, payment: true, shipment: true },
    }),
    prisma.order.count({ where: { authAccountId } }),
  ]);
  return { items, total, page, pageSize };
};

export const getOrder = async (authAccountId: string, orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true, shipment: true, address: true },
  });
  if (!order || order.authAccountId !== authAccountId) throw new NotFoundError('Order not found');
  return order;
};

// Fully manual tracking, by design: no DTDC courier API. Admin/staff set the
// AWB and status (mark shipped / mark delivered) by hand; the customer taps
// through to DTDC's own public tracking page and enters the AWB themselves.
export const getOrderTracking = async (authAccountId: string, orderId: string) => {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } });
  if (!order || order.authAccountId !== authAccountId) throw new NotFoundError('Order not found');

  // The DTDC tracking page isn't AWB-specific (no query-param deep link), so
  // it's safe — and useful — to show the customer where they'll track their
  // shipment even before an AWB has been assigned.
  return {
    carrier: order.shipment?.carrier ?? 'DTDC',
    awbNumber: order.shipment?.awbNumber ?? null,
    status: order.shipment?.status ?? 'not_shipped',
    trackingUrl: DTDC_TRACKING_URL,
  };
};
