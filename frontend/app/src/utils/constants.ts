// Fallback only — every shipment response from the backend carries its own
// `trackingUrl` (see admin.service.ts's markOrderShipped), which is what the
// app uses when it has one. This covers building a tracking message for an
// order that was already marked shipped in an earlier session.
export const DTDC_TRACKING_URL = 'https://www.dtdc.com/track-your-shipment/';
