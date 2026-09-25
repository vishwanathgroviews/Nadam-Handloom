import type { AuditLogEntry } from '../api/admin';

/**
 * Plain-English description of one Audit Log entry: what happened, who did
 * it, and the facts that matter — product, order, price before and after —
 * as labelled lines rather than raw ids.
 */

export type AuditTone = 'sale' | 'catalog' | 'order' | 'team' | 'security' | 'signin';

export interface AuditDetail {
  label: string;
  value: string;
}

export interface AuditDescription {
  title: string;
  icon: string;
  tone: AuditTone;
  /** "by Priya Sharma (Staff)" — or a plain statement when no one was recorded. */
  byLine: string;
  details: AuditDetail[];
}

const rupees = (value: unknown): string | null => {
  const n = Number(value);
  return Number.isFinite(n) && value !== null && value !== undefined && value !== ''
    ? `₹${n.toLocaleString('en-IN')}`
    : null;
};

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

const pushIf = (details: AuditDetail[], label: string, value: string | null | undefined) => {
  if (value) details.push({ label, value });
};

interface EventSpec {
  title: string;
  icon: string;
  tone: AuditTone;
}

const EVENTS: Record<string, EventSpec> = {
  // Sign-in
  login_success: { title: 'Signed in', icon: 'log-in-outline', tone: 'signin' },
  login_failed: { title: 'Wrong MPIN entered', icon: 'alert-circle-outline', tone: 'security' },
  login_denied_not_staff: { title: 'Sign-in blocked — not a team member', icon: 'ban-outline', tone: 'security' },
  app_activation_requested: { title: 'Asked for an activation code', icon: 'chatbox-ellipses-outline', tone: 'signin' },
  app_phone_verified: { title: 'Mobile number verified', icon: 'checkmark-done-outline', tone: 'signin' },
  app_mpin_setup: { title: 'MPIN created', icon: 'key-outline', tone: 'signin' },
  app_mpin_reset: { title: 'MPIN changed', icon: 'key-outline', tone: 'signin' },
  refresh_token_reuse_detected: { title: 'Suspicious sign-in blocked', icon: 'shield-outline', tone: 'security' },

  // Products
  product_created: { title: 'Product added', icon: 'add-circle-outline', tone: 'catalog' },
  product_updated: { title: 'Product details changed', icon: 'create-outline', tone: 'catalog' },
  product_deleted: { title: 'Product deleted', icon: 'trash-outline', tone: 'security' },
  product_image_updated: { title: 'Product photo changed', icon: 'image-outline', tone: 'catalog' },

  // Categories
  category_created: { title: 'Category added', icon: 'folder-open-outline', tone: 'catalog' },
  category_updated: { title: 'Category changed', icon: 'create-outline', tone: 'catalog' },
  category_price_changed: { title: 'Category price changed', icon: 'pricetag-outline', tone: 'catalog' },
  category_image_updated: { title: 'Category photo changed', icon: 'image-outline', tone: 'catalog' },
  category_hidden_from_web: { title: 'Category hidden from website', icon: 'eye-off-outline', tone: 'catalog' },
  category_shown_on_web: { title: 'Category shown on website', icon: 'eye-outline', tone: 'catalog' },

  // Subcategories
  subcategory_created: { title: 'Subcategory added', icon: 'albums-outline', tone: 'catalog' },
  subcategory_price_changed: { title: 'Price changed', icon: 'pricetag-outline', tone: 'catalog' },
  subcategory_image_updated: { title: 'Subcategory photo changed', icon: 'image-outline', tone: 'catalog' },
  subcategory_hidden_from_web: { title: 'Subcategory hidden from website', icon: 'eye-off-outline', tone: 'catalog' },
  subcategory_shown_on_web: { title: 'Subcategory shown on website', icon: 'eye-outline', tone: 'catalog' },
  subcategory_deleted: { title: 'Subcategory deleted', icon: 'trash-outline', tone: 'security' },
  subcategory_catalog_pdf_generated: { title: 'Catalog PDF made', icon: 'document-text-outline', tone: 'catalog' },

  // Sales & orders
  offline_sale_price_override: { title: 'Price changed on a sale', icon: 'cash-outline', tone: 'sale' },
  order_marked_shipped: { title: 'Order shipped', icon: 'cube-outline', tone: 'order' },
  order_marked_delivered: { title: 'Order delivered', icon: 'checkmark-circle-outline', tone: 'order' },

  // Team
  admin_provisioned_user: { title: 'Team member invited', icon: 'person-add-outline', tone: 'team' },
  admin_reinvited_user: { title: 'Team member invited again', icon: 'person-add-outline', tone: 'team' },
  admin_revoked_user_access: { title: 'Team member access removed', icon: 'person-remove-outline', tone: 'team' },
  session_revoked_by_admin: { title: 'Device signed out', icon: 'phone-portrait-outline', tone: 'team' },
};

/** Falls back to the raw code made readable, so a new event type still shows sensibly. */
const fallbackTitle = (eventType: string) =>
  eventType.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const describeAuditEntry = (entry: AuditLogEntry): AuditDescription => {
  const spec = EVENTS[entry.eventType] ?? { title: fallbackTitle(entry.eventType), icon: 'document-text-outline', tone: 'catalog' as AuditTone };
  const meta = (entry.metadata ?? {}) as Record<string, any>;
  const ctx = entry.context ?? {};
  const details: AuditDetail[] = [];

  // What it was about.
  if (ctx.productName || ctx.productSku) {
    pushIf(details, 'Product', [ctx.productName, ctx.productSku].filter(Boolean).join(' · '));
  }
  pushIf(details, 'Subcategory', ctx.subcategoryName ?? null);
  pushIf(details, 'Category', ctx.categoryName ?? null);
  pushIf(details, 'Order', ctx.orderNumber ?? null);

  // Event-specific facts.
  switch (entry.eventType) {
    case 'product_created': {
      const n = Number(meta.barcodeCount);
      if (Number.isFinite(n) && n > 0) pushIf(details, 'Barcodes', String(n));
      break;
    }
    case 'subcategory_price_changed': {
      const before = meta.before ?? {};
      const after = meta.after ?? {};
      const change = (label: string, key: string) => {
        const from = rupees(before[key]);
        const to = rupees(after[key]);
        if (from && to && from !== to) pushIf(details, label, `${from} → ${to}`);
      };
      change('Website price', 'onlinePrice');
      change('Store price', 'storePrice');
      change('MRP', 'mrp');
      if (text(before.description) !== text(after.description)) pushIf(details, 'Description', 'Updated');
      break;
    }
    case 'offline_sale_price_override':
      pushIf(details, 'Store price', rupees(meta.categoryStorePrice));
      pushIf(details, 'Sold for', rupees(meta.salePrice));
      break;
    case 'order_marked_shipped':
      pushIf(details, 'Tracking no.', text(meta.awbNumber));
      pushIf(details, 'Customer', entry.subject?.name ?? null);
      break;
    case 'admin_provisioned_user':
    case 'admin_reinvited_user':
      pushIf(details, 'Person', entry.subject?.name ?? null);
      pushIf(details, 'Role', meta.role === 'ADMIN' ? 'Owner' : meta.role === 'STAFF' ? 'Staff' : text(meta.role));
      break;
    case 'admin_revoked_user_access':
    case 'session_revoked_by_admin':
      pushIf(details, 'Person', entry.subject?.name ?? null);
      break;
    case 'product_deleted': {
      // The product row may be gone for good, so name it from the event itself.
      if (!ctx.productName) pushIf(details, 'Product', [text(meta.name), text(meta.sku)].filter(Boolean).join(' · ') || null);
      const codes = Array.isArray(meta.barcodes) ? meta.barcodes.filter(Boolean) : [];
      if (codes.length) pushIf(details, 'Barcodes', codes.join(', '));
      if (meta.archived) pushIf(details, 'Sales history', 'Kept — past orders and invoices are unchanged');
      break;
    }
    case 'subcategory_deleted': {
      const removed = Array.isArray(meta.productsDeleted) ? meta.productsDeleted.length : 0;
      if (removed) pushIf(details, 'Products removed', String(removed));
      break;
    }
    case 'subcategory_catalog_pdf_generated': {
      const n = Number(meta.productCount);
      if (Number.isFinite(n)) pushIf(details, 'Photos', String(n));
      break;
    }
    default:
      break;
  }

  const actor = entry.actor;
  const byLine = actor
    ? `by ${actor.name}${actor.role ? ` (${actor.role})` : ''}`
    : 'Person not recorded';

  return { title: spec.title, icon: spec.icon, tone: spec.tone, byLine, details };
};

/** "Today", "Yesterday", or a date — the section a log entry sits under. */
export const dayLabel = (iso: string, now: Date = new Date()): string => {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** "10:42 am" */
export const timeLabel = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
