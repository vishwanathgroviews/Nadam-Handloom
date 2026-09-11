import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

// INV-000001, INV-000002, ... — sequential (unlike order numbers, GST
// invoice numbers should tell you the count/order they were issued in).
// Found by taking the current highest invoiceNumber and incrementing, then
// verified unique inside the same transaction as the create that follows;
// the column is still @unique in the schema as the final backstop against
// a concurrent race this check can't fully rule out. Deliberately no raw
// SQL / sequence object, so this keeps working against the in-memory
// fakePrisma test double (see reserveOrderNumber for the same convention).
const PREFIX = 'INV-';
const PAD = 6;

export const nextInvoiceNumber = async (tx: Tx, attempts = 5): Promise<string> => {
  const latest = await tx.invoice.findFirst({
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });
  let next = latest ? Number(latest.invoiceNumber.replace(PREFIX, '')) + 1 : 1;

  for (let i = 0; i < attempts; i++) {
    const candidate = `${PREFIX}${String(next).padStart(PAD, '0')}`;
    const existing = await tx.invoice.findUnique({ where: { invoiceNumber: candidate }, select: { id: true } });
    if (!existing) return candidate;
    next += 1;
  }
  throw new Error('Could not generate a unique invoice number after several attempts');
};
