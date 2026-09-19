import { prisma } from '../../config/prisma';

/**
 * Turns raw audit rows into something a person can read: who did it, and the
 * names of what it was done to.
 *
 * The raw rows are hard to read for two reasons. Their details are ids
 * (productId, subcategoryId, orderId), not names. And `authAccountId` is not
 * always the person who acted — for some events it is the account the action
 * was done *to*: marking an order shipped records the customer, inviting
 * someone records the new staff member. Showing that account as "who did
 * it" credited actions to the wrong people.
 */

/** Events whose authAccountId is the person the action was done to, not the one who did it. */
const SUBJECT_EVENTS = new Set([
  'order_marked_shipped',
  'admin_provisioned_user',
  'admin_reinvited_user',
  'admin_revoked_user_access',
  'session_revoked_by_admin',
  'refresh_token_reuse_detected',
]);

export interface AuditPerson {
  id: string;
  name: string;
  role: string | null;
}

export interface AuditContext {
  productName?: string | undefined;
  productSku?: string | undefined;
  subcategoryName?: string | undefined;
  categoryName?: string | undefined;
  orderNumber?: string | undefined;
}

type RawEvent = {
  id: string;
  eventType: string;
  authAccountId: string | null;
  metadata: unknown;
  [key: string]: unknown;
};

const str = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);

/**
 * Who performed the action. Newer events carry an explicit actorId (written
 * by logAuthEvent); older ones fall back to authAccountId only where that was
 * the actor. For an older "done to" event the actor was never recorded, and
 * is reported as unknown rather than guessed.
 */
export const actorIdFor = (event: RawEvent): string | null => {
  const meta = (event.metadata ?? {}) as Record<string, unknown>;
  const explicit = str(meta.actorId) ?? str(meta.byUserId);
  if (explicit) return explicit;
  return SUBJECT_EVENTS.has(event.eventType) ? null : event.authAccountId;
};

/** The person the action was done to, for events that have one. */
export const subjectIdFor = (event: RawEvent): string | null =>
  SUBJECT_EVENTS.has(event.eventType) ? event.authAccountId : null;

const personName = (account: {
  phone: string | null;
  email: string | null;
  adminProfile: { firstName: string; lastName: string } | null;
  userProfile: { firstName: string; lastName: string } | null;
}) => {
  const profile = account.adminProfile ?? account.userProfile;
  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';
  return name || account.phone || account.email || 'Unknown';
};

export const presentAuditEvents = async <T extends RawEvent>(events: T[]) => {
  const meta = (e: RawEvent) => (e.metadata ?? {}) as Record<string, unknown>;

  const personIds = new Set<string>();
  const productIds = new Set<string>();
  const subcategoryIds = new Set<string>();
  const categoryIds = new Set<string>();
  const orderIds = new Set<string>();

  for (const e of events) {
    const actor = actorIdFor(e);
    const subject = subjectIdFor(e);
    if (actor) personIds.add(actor);
    if (subject) personIds.add(subject);
    const m = meta(e);
    if (str(m.productId)) productIds.add(m.productId as string);
    if (str(m.subcategoryId)) subcategoryIds.add(m.subcategoryId as string);
    if (str(m.categoryId)) categoryIds.add(m.categoryId as string);
    if (str(m.orderId) && !str(m.orderNumber)) orderIds.add(m.orderId as string);
  }

  // One query per kind of name, however many rows are on the page.
  const [people, products, subcategories, categories, orders] = await Promise.all([
    personIds.size
      ? prisma.authAccount.findMany({
          where: { id: { in: [...personIds] } },
          include: { adminProfile: true, userProfile: true, roles: { include: { role: true } } },
        })
      : [],
    productIds.size
      ? prisma.product.findMany({ where: { id: { in: [...productIds] } }, select: { id: true, name: true, sku: true } })
      : [],
    subcategoryIds.size
      ? prisma.subcategory.findMany({ where: { id: { in: [...subcategoryIds] } }, select: { id: true, name: true } })
      : [],
    categoryIds.size
      ? prisma.category.findMany({ where: { id: { in: [...categoryIds] } }, select: { id: true, name: true } })
      : [],
    orderIds.size
      ? prisma.order.findMany({ where: { id: { in: [...orderIds] } }, select: { id: true, orderNumber: true } })
      : [],
  ]);

  const personById = new Map<string, AuditPerson>(
    people.map((p) => {
      const roles = p.roles.map((r) => r.role.name);
      const role = roles.includes('ADMIN') ? 'Owner' : roles.includes('STAFF') ? 'Staff' : roles.includes('CUSTOMER') ? 'Customer' : null;
      return [p.id, { id: p.id, name: personName(p), role }];
    })
  );
  const productById = new Map(products.map((p) => [p.id, p]));
  const subcategoryById = new Map(subcategories.map((s) => [s.id, s.name]));
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));
  const orderById = new Map(orders.map((o) => [o.id, o.orderNumber]));

  return events.map((e) => {
    const m = meta(e);
    const actorId = actorIdFor(e);
    const subjectId = subjectIdFor(e);
    const product = str(m.productId) ? productById.get(m.productId as string) : undefined;

    const context: AuditContext = {
      productName: product?.name,
      productSku: product?.sku ?? str(m.sku),
      // A deleted row can't be looked up any more; its name was saved at the
      // time — as `name`, which means the category's name on category events
      // and the subcategory's on subcategory events.
      subcategoryName:
        (str(m.subcategoryId) && subcategoryById.get(m.subcategoryId as string)) ||
        (e.eventType.startsWith('subcategory_') ? str(m.name) : undefined),
      categoryName:
        (str(m.categoryId) && categoryById.get(m.categoryId as string)) ||
        (e.eventType.startsWith('category_') ? str(m.name) : undefined),
      orderNumber: str(m.orderNumber) ?? (str(m.orderId) ? orderById.get(m.orderId as string) : undefined),
    };

    return {
      ...e,
      actor: actorId ? personById.get(actorId) ?? null : null,
      subject: subjectId ? personById.get(subjectId) ?? null : null,
      context,
    };
  });
};
