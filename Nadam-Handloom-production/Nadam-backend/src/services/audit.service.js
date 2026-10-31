// Writes an entry to the audit trail. Never throws: a failed audit write must
// not stop someone from signing in. Event names reuse the old app's where the
// meaning is the same, so the old Activity screen still titles them correctly.
import * as AuthEvent from '../models/authEvent.model.js';

export async function audit(eventType, { accountId = null, ctx = {}, metadata = {}, source = 'staff_app' } = {}) {
  try {
    await AuthEvent.create({
      authAccountId: accountId,
      eventType,
      source,
      ipAddress: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      metadata: { api: 'v2', platform: ctx.platform ?? null, deviceId: ctx.deviceId ?? null, ...metadata },
    });
  } catch (err) {
    console.error(`[audit] could not record ${eventType}: ${err.message}`);
  }
}

// The website's entries (W1): kept apart from the staff Activity log by their source.
export const shopAudit = (eventType, opts = {}) => audit(eventType, { ...opts, source: 'customer_web' });
