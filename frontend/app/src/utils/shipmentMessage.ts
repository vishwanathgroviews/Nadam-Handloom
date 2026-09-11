/**
 * Builds the WhatsApp shipment message a customer receives once their order
 * is marked shipped.
 *
 * Kept here, free of React and of any Expo module, so the exact text can be
 * asserted in a unit test — this message is the only thing most WhatsApp
 * customers ever get from us, and a silently dropped tracking number or
 * invoice link is not something a typecheck would catch.
 */

export interface ProductLink {
  name: string;
  url: string;
}

export interface ShipmentMessageInput {
  customerName?: string | null;
  orderNumber: string;
  /** DTDC tracking number. Absent before the order is actually marked shipped. */
  awbNumber?: string | null;
  carrier?: string | null;
  trackingUrl: string;
  /** One per distinct product in the order — see dedupeProductLinks. */
  productLinks?: ProductLink[];
}

/** Two units of the same product are one link, not two identical ones. */
export const dedupeProductLinks = (links: ProductLink[]): ProductLink[] => {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
};

export const buildShipmentMessage = (input: ShipmentMessageInput): string => {
  const name = input.customerName?.trim() || 'there';
  const carrier = input.carrier?.trim() || 'DTDC';
  const links = dedupeProductLinks(input.productLinks ?? []);

  const productBlock = links.length
    ? `\nYour order:\n${links.map((link) => `${link.name}\n${link.url}`).join('\n\n')}\n`
    : '';
  // No invoice URL here on purpose — the customer gets the actual PDF file,
  // shared into the same chat straight after this message (see
  // OrderShipmentScreen.handleWhatsApp), not a link to download one.

  if (!input.awbNumber) {
    return (
      `Hi ${name}, this is Nandam Handlooms regarding your order ${input.orderNumber}.\n` +
      productBlock
    ).trimEnd();
  }

  return (
    `Hi ${name}, your Nandam Handlooms order ${input.orderNumber} has shipped via ${carrier}.\n\n` +
    `Tracking ID (AWB): ${input.awbNumber}\n` +
    `Track it here: ${input.trackingUrl}\n` +
    productBlock +
    `\nThank you for shopping with us!`
  );
};
