/**
 * Sending a counter sale's invoice to the customer on WhatsApp.
 *
 * The customer's mobile number is used for exactly one thing — opening
 * WhatsApp at that customer's chat with the invoice PDF attached — and is
 * never sent to the server. It
 * lives only in the Scan to Sell screen's memory for the sale in hand and is
 * cleared when staff start the next sale. The server generates and keeps the
 * invoice exactly as it always has; it simply never learns who it was sent to.
 */

/** A 10-digit Indian mobile, allowing the spaces, dashes or +91 people type. */
export const cleanMobile = (raw: string): string | null => {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
};

export interface InvoiceShareDetails {
  invoiceNumber: string;
  totalAmount: string | number;
}

/**
 * The text sent alongside the invoice PDF: shop name, invoice number and
 * amount. Nothing about the customer — they are the one receiving it.
 */
export const invoiceCaption = ({ invoiceNumber, totalAmount }: InvoiceShareDetails): string => {
  const amount = Number(totalAmount);
  const amountText = Number.isFinite(amount) ? `₹${amount.toLocaleString('en-IN')}` : String(totalAmount);
  return `Thank you for shopping at Nandam Handlooms! Your invoice ${invoiceNumber} for ${amountText} is attached.`;
};
