/**
 * The Audit Log's filter groups, and which recorded event types fall in each.
 * Kept in one place so a new event type only needs adding here to be
 * filterable.
 */
export const AUDIT_GROUPS = {
  sales: ['offline_sale_price_override'],
  orders: ['order_marked_shipped', 'order_marked_delivered'],
  products: ['product_created', 'product_updated', 'product_image_updated', 'product_deleted'],
  catalog: [
    'category_created', 'category_updated', 'category_price_changed', 'category_image_updated',
    'category_hidden_from_web', 'category_shown_on_web',
    'subcategory_created', 'subcategory_price_changed', 'subcategory_image_updated',
    'subcategory_hidden_from_web', 'subcategory_shown_on_web', 'subcategory_deleted',
    'subcategory_catalog_pdf_generated',
  ],
  team: ['admin_provisioned_user', 'admin_reinvited_user', 'admin_revoked_user_access', 'session_revoked_by_admin'],
  signin: [
    'login_success', 'login_failed', 'login_denied_not_staff', 'app_activation_requested',
    'app_phone_verified', 'app_mpin_setup', 'app_mpin_reset', 'refresh_token_reuse_detected',
  ],
} as const;

export type AuditGroup = keyof typeof AUDIT_GROUPS;
export const AUDIT_GROUP_KEYS = Object.keys(AUDIT_GROUPS) as [AuditGroup, ...AuditGroup[]];

/** How long Audit Log entries are kept before the retention sweep removes them. */
export const AUDIT_LOG_RETENTION_DAYS = 30;
