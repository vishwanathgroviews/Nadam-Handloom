import { env } from './env';

// Single source of truth for the business's own letterhead details, used by
// every generated PDF (invoices, sales reports, subcategory catalogs).
export const COMPANY = {
  name: env.COMPANY_NAME,
  address: env.COMPANY_ADDRESS,
  mobile: env.COMPANY_MOBILE,
  gstin: env.COMPANY_GSTIN,
  logoUrl: env.COMPANY_LOGO_URL,
  gstRatePercent: env.GST_RATE_PERCENT,
};
