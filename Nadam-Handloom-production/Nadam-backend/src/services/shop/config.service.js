// What the website reads when it opens (no sign-in): is it switched off, the shop's
// contact details, the lists for its forms and the public Firebase values for push.
import { env } from '../../config/env.js';
import { SHOP, BAG, PAYMENTS, INDIAN_STATES, LANGUAGES, ADDRESS_LABELS, PUSH_TOPICS, STORE } from '../../config/constants.js';
import { websiteMaintenance, shopDetails } from '../settings.service.js';
import { testersOnly } from './paymentAccess.js';

export async function websiteConfig() {
  const [maintenance, shop] = await Promise.all([websiteMaintenance(), shopDetails()]);
  return {
    maintenance,
    shop: { name: shop.name, mobile: shop.mobile, address: shop.address, gstin: shop.gstin, website: shop.website || null },
    store: STORE,
    signIn: { codeLength: SHOP.CODE_LENGTH, resendSeconds: SHOP.CODE_RESEND_SECONDS, sessionDays: SHOP.SESSION_DAYS },
    // testersOnly: only some signed-in customers may pay (their `payOnline`); the rest, WhatsApp.
    payments: { enabled: env.payments.enabled, testersOnly: env.payments.enabled && testersOnly(), holdMinutes: PAYMENTS.HOLD_MINUTES, mode: env.payments.enabled ? env.payments.mode : null, maxAmount: env.payments.maxAmount },
    gst: { ratePercent: env.company.gstRatePercent, shopState: env.company.state, igstOtherStates: env.company.igstOtherStates },
    limits: { maxAddresses: SHOP.MAX_ADDRESSES, avatarMaxBytes: SHOP.AVATAR_MAX_BYTES, nameMax: SHOP.NAME_MAX, deleteAfterDays: SHOP.DELETE_AFTER_DAYS, bag: { maxLines: BAG.MAX_LINES, maxQuantity: BAG.MAX_QUANTITY, keepDays: BAG.KEEP_DAYS } },
    states: INDIAN_STATES,
    languages: Object.entries(LANGUAGES).map(([code, name]) => ({ code, name })),
    addressLabels: ADDRESS_LABELS,
    push: env.push.web ? { ...env.push.web, topics: PUSH_TOPICS } : null,
  };
}
