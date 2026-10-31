// What the signed-in person may do. The list comes from the server (/me and every
// sign-in), which also checks it on every request: hiding a button here is only
// for a tidy screen, never the protection itself. Table: docs Module 2, section 4.
import { useSession } from './session';

export const PERMISSION = Object.freeze({
  TEAM_MANAGE: 'team.manage',
  SALES_VIEW: 'sales.view',
  ANALYTICS_VIEW: 'analytics.view',
  ACTIVITY_VIEW: 'activity.view',
  SETTINGS_MANAGE: 'settings.manage',
  CATALOG_EDIT: 'catalog.edit',
  CATALOG_VIEW: 'catalog.view',
  PRODUCTS_MANAGE: 'products.manage',
  ORDERS_MANAGE: 'orders.manage',
  SELL_USE: 'sell.use',
  SELL_OVERRIDE: 'sell.override',
  PAYMENTS_VIEW: 'payments.view', // Online payments from the website, payment notifications
});

export const can = (user, permission) => !!user?.permissions?.includes(permission);

export function useCan(permission) {
  const s = useSession();
  return can(s.user, permission);
}
