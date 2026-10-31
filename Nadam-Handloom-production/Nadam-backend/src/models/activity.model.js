// Activity queries (Module 10): the staff-app trail in AuthEvent, old app and new.
import { prisma } from '../config/database.js';
import { withRolesAndName } from './authAccount.model.js';

// Team records name the person acted on in authAccountId and the owner who did it
// in metadata.byUserId; every other record names the doer (metadata.actorId first,
// as the old app's shipping records put the customer in authAccountId).
export const TEAM_TYPES = ['admin_provisioned_user', 'admin_reinvited_user', 'admin_renamed_user', 'admin_changed_role', 'admin_revoked_user_access', 'admin_main_owner_changed', 'session_revoked_by_admin'];

// One page of entries, newest first. `ids` are extra matches for the search (people,
// designs, sarees, orders whose names match).
export function list({ types, person, from, to, like, ids, important, importantTypes, before, take }, db = prisma) {
  return db.$queryRaw`
    SELECT e.id, e."authAccountId", e."eventType", e.metadata, e."createdAt"
    FROM "AuthEvent" e
    WHERE e.source = 'staff_app'
      AND e."eventType" = ANY(${types})
      AND (${person}::text IS NULL OR (CASE WHEN e."eventType" = ANY(${TEAM_TYPES}) THEN e.metadata->>'byUserId' ELSE coalesce(e.metadata->>'actorId', e."authAccountId") END) = ${person})
      AND (${from}::timestamp IS NULL OR e."createdAt" >= ${from}::timestamp)
      AND (${to}::timestamp IS NULL OR e."createdAt" <= ${to}::timestamp)
      AND (${like}::text IS NULL
        OR e.metadata::text ILIKE ${like}
        OR e."authAccountId" = ANY(${ids.accounts})
        OR e.metadata->>'actorId' = ANY(${ids.accounts})
        OR e.metadata->>'byUserId' = ANY(${ids.accounts})
        OR e.metadata->>'subcategoryId' = ANY(${ids.subs})
        OR e.metadata->>'categoryId' = ANY(${ids.cats})
        OR e.metadata->>'productId' = ANY(${ids.products})
        OR e.metadata->>'orderId' = ANY(${ids.orders}))
      AND (NOT ${important}::boolean
        OR e."eventType" = ANY(${importantTypes})
        OR (e."eventType" = 'offline_sale_price_override'
            AND (e.metadata->>'salePrice')::numeric < (e.metadata->>'categoryStorePrice')::numeric / 2))
      AND (${before ? before.at : null}::timestamp IS NULL OR (e."createdAt", e.id) < (${before ? before.at : null}::timestamp, ${before ? before.id : ''}))
    ORDER BY e."createdAt" DESC, e.id DESC
    LIMIT ${take}`;
}

// What a search word matches by name: people, designs, categories, sarees (SKU, tag or
// design name), orders.
export async function matchIds(word, db = prisma) {
  const q = `%${word}%`;
  const [accounts, subs, cats, products, orders] = await Promise.all([
    db.$queryRaw`SELECT "authAccountId" AS id FROM "AdminProfile" WHERE ("firstName" || ' ' || coalesce("lastName", '')) ILIKE ${q} LIMIT 50`,
    db.$queryRaw`SELECT id FROM "Subcategory" WHERE name ILIKE ${q} LIMIT 100`,
    db.$queryRaw`SELECT id FROM "Category" WHERE name ILIKE ${q} LIMIT 50`,
    db.$queryRaw`SELECT DISTINCT pr.id FROM "Product" pr LEFT JOIN "Piece" p ON p."productId" = pr.id JOIN "Subcategory" s ON s.id = pr."subcategoryId" WHERE pr.sku ILIKE ${q} OR p.barcode ILIKE ${q} OR s.name ILIKE ${q} LIMIT 1000`,
    db.$queryRaw`SELECT id FROM "Order" WHERE "orderNumber" ILIKE ${q} LIMIT 100`,
  ]);
  const pick = (rows) => rows.map((r) => r.id).filter(Boolean);
  return { accounts: pick(accounts), subs: pick(subs), cats: pick(cats), products: pick(products), orders: pick(orders) };
}

// Names for a page of entries.
export const accounts = (ids, db = prisma) => (ids.length ? db.authAccount.findMany({ where: { id: { in: ids } }, include: withRolesAndName }) : []);
export const devices = (deviceIds, db = prisma) => (deviceIds.length ? db.trustedDevice.findMany({ where: { deviceId: { in: deviceIds } }, select: { deviceId: true, authAccountId: true, name: true, platform: true } }) : []);
export const subcategories = (ids, db = prisma) => (ids.length ? db.subcategory.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, status: true } }) : []);
export const categories = (ids, db = prisma) => (ids.length ? db.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, status: true } }) : []);
export const products = (ids, db = prisma) => (ids.length ? db.product.findMany({ where: { id: { in: ids } }, select: { id: true, sku: true, deletedAt: true, subcategory: { select: { id: true, name: true } }, pieces: { select: { barcode: true }, take: 3 } } }) : []);
export const orders = (ids, db = prisma) => (ids.length ? db.order.findMany({ where: { id: { in: ids } }, select: { id: true, orderNumber: true, channel: true } }) : []);

// Everyone who appears as a doer, for the person filter.
export const doers = (db = prisma) => db.$queryRaw`
  SELECT DISTINCT (CASE WHEN "eventType" = ANY(${TEAM_TYPES}) THEN metadata->>'byUserId' ELSE coalesce(metadata->>'actorId', "authAccountId") END) AS id
  FROM "AuthEvent" WHERE source = 'staff_app'`;

// Security alerts for Home (6.8).
export async function securitySince(since, types, db = prisma) {
  const where = { source: 'staff_app', eventType: { in: types }, createdAt: { gte: since } };
  const [count, latest] = await Promise.all([db.authEvent.count({ where }), db.authEvent.findFirst({ where, orderBy: { createdAt: 'desc' } })]);
  return { count, latest };
}

// Sign-in records older than `before` (kept 1 year, 6.2).
export const deleteSignInsBefore = (before, types, db = prisma) =>
  db.authEvent.deleteMany({ where: { source: 'staff_app', eventType: { in: types }, createdAt: { lt: before } } });
