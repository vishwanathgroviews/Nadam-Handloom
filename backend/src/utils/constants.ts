// Public DTDC tracking page. We deliberately do not integrate the DTDC
// tracking API (no API key/customer code) — customers self-serve tracking
// by pasting their AWB number into DTDC's own site.
export const DTDC_TRACKING_URL = 'https://www.dtdc.com/track-your-shipment/';

// Online order statuses that represent a completed sale (payment captured).
// Store-channel orders are created already `delivered` (see
// inventory.service.ts's createOfflineOrder) and don't need this filter.
export const PAID_STATUSES = ['processing', 'shipped', 'delivered'];
