-- Backfill AuthEvent.source for rows written before the column existed.
-- The column's DB default ('staff_app') is correct for admin/staff-app
-- accounts and for NULL-actor rows, but wrong for historical customer-web
-- activity (registrations, logins, password resets) — flip those explicitly.
UPDATE "AuthEvent" ae
SET "source" = 'customer_web'
WHERE ae."authAccountId" IN (
  SELECT ur."authAccountId" FROM "UserRole" ur
  JOIN "Role" r ON r.id = ur."roleId"
  WHERE r.name = 'CUSTOMER'
)
AND ae."authAccountId" NOT IN (
  SELECT ur."authAccountId" FROM "UserRole" ur
  JOIN "Role" r ON r.id = ur."roleId"
  WHERE r.name IN ('ADMIN', 'STAFF')
);
