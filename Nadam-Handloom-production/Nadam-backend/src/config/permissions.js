// Who can do what. This is the table in docs/modules/module-02-roles-and-team.md
// (section 4): change it there first. The server checks these on every request;
// the app reads the same list from /api/v2/me to decide what to show.
export const PERMISSION = Object.freeze({
  TEAM_MANAGE: 'team.manage', // team list, invite, roles, remove, sign out someone's phones
  SALES_VIEW: 'sales.view', // today's sales, money totals, sales summary PDFs
  ANALYTICS_VIEW: 'analytics.view',
  ACTIVITY_VIEW: 'activity.view',
  SETTINGS_MANAGE: 'settings.manage', // maintenance, app updates
  CATALOG_EDIT: 'catalog.edit', // add or edit categories and subcategories, change prices
  CATALOG_VIEW: 'catalog.view',
  PRODUCTS_MANAGE: 'products.manage', // view, add, edit, delete products
  ORDERS_MANAGE: 'orders.manage', // orders today and past, shipping
  SELL_USE: 'sell.use', // scan to sell, invoices for customers
  SELL_OVERRIDE: 'sell.override', // sell an item an online checkout is holding
  PAYMENTS_VIEW: 'payments.view', // Online payments (website): the list, refunds, payment notifications
});

const STAFF = [PERMISSION.CATALOG_VIEW, PERMISSION.PRODUCTS_MANAGE, PERMISSION.ORDERS_MANAGE, PERMISSION.SELL_USE];

// ADMIN is the database name for Owner. Owners can do everything.
export const ROLE_PERMISSIONS = Object.freeze({
  ADMIN: Object.freeze(Object.values(PERMISSION)),
  STAFF: Object.freeze(STAFF),
});

export const permissionsFor = (role) => ROLE_PERMISSIONS[role] ?? [];
export const can = (role, permission) => permissionsFor(role).includes(permission);
