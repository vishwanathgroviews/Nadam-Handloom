/**
 * Sending a subcategory's catalog PDF to a customer on WhatsApp.
 *
 * As with invoices (see invoiceShare.ts), the customer's number is used only
 * to open their WhatsApp chat on this phone and is never sent to the server.
 */

/**
 * The text sent alongside the catalog PDF. Every photo in the catalog carries
 * its piece's ID number, which is what the customer quotes back to order.
 */
export const catalogCaption = (subcategoryName: string): string => {
  const name = subcategoryName.trim();
  return `Nandam Handlooms – ${name ? `${name} catalogue` : 'catalogue'}. Please tell us the ID number of the piece you like.`;
};

/** The name the customer sees on the attached file, e.g. "Nandam-Kanchi-Pattu-catalogue.pdf". */
export const catalogFilename = (subcategoryName: string): string => {
  const slug = subcategoryName
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `Nandam-${slug ? `${slug}-` : ''}catalogue.pdf`;
};
