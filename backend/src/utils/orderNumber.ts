import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

// NH + 8 digits, e.g. NH12345678 — the format the business wants on
// receipts/WhatsApp/labels: short and purely numeric after the prefix.
const generateOrderNumber = (): string => {
  const digits = randomInt(0, 100_000_000).toString().padStart(8, '0');
  return `NH${digits}`;
};

// 10^8 possible values isn't astronomically large the way the old date+hex
// scheme was, so a single generateOrderNumber() call isn't safe to trust
// blindly at scale. Checked inside the same transaction as the order create
// that follows it, so the two stay atomic with respect to each other; the
// column is still @unique in the schema as the final backstop against the
// rare concurrent-race case this check can't fully rule out.
export const reserveOrderNumber = async (tx: Tx, attempts = 5): Promise<string> => {
  for (let i = 0; i < attempts; i++) {
    const candidate = generateOrderNumber();
    const existing = await tx.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  throw new Error('Could not generate a unique order number after several attempts');
};
