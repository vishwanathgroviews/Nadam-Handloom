import { z } from 'zod';
import { AUDIT_GROUP_KEYS } from './auditLog.groups';

export const provisionUserSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  role: z.enum(['ADMIN', 'STAFF']),
});

// Kept in sync with the comment on Order.status in schema.prisma — there's
// no DB enum backing this column, so it's validated here instead.
const ORDER_STATUSES = [
  'pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'payment_failed',
] as const;

export const listAdminOrdersQuerySchema = z.object({
  // Comma-separated, e.g. "processing,shipped" — lets the UI offer a
  // multi-select status filter without a separate query param per value.
  status: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()).filter(Boolean) : undefined))
    .refine((arr) => !arr || arr.every((s) => (ORDER_STATUSES as readonly string[]).includes(s)), {
      message: `status must be a comma-separated list of: ${ORDER_STATUSES.join(', ')}`,
    }),
  channel: z.enum(['online', 'store', 'whatsapp']).optional(),
  paymentStatus: z.enum(['created', 'paid', 'failed']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  // Order number or customer email/phone, case-insensitive contains match.
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

export const auditLogQuerySchema = z.object({
  eventType: z.string().trim().optional(),
  // Filter by kind of activity (see auditLog.groups.ts) and by how far back.
  group: z.enum(AUDIT_GROUP_KEYS).optional(),
  from: z.coerce.date().optional(),
  source: z.enum(['customer_web', 'staff_app']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

export const updateShipmentSchema = z.object({
  awbNumber: z
    .string()
    .trim()
    .min(4, 'Enter a valid DTDC AWB number')
    .max(40, 'AWB number looks too long'),
  carrier: z.string().trim().min(2).max(40).optional(),
});
