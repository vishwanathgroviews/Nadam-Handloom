import { describe, expect, it } from 'vitest';
import { buildShipmentMessage, dedupeProductLinks } from './shipmentMessage';

const TRACKING_URL = 'https://www.dtdc.com/track-your-shipment/';

describe('buildShipmentMessage', () => {
  it('carries the AWB, the tracking page and every product link', () => {
    const message = buildShipmentMessage({
      customerName: 'Lakshmi',
      orderNumber: 'NH15922621',
      awbNumber: 'D12345678',
      carrier: 'DTDC',
      trackingUrl: TRACKING_URL,
      productLinks: [
        { name: 'Mangalagiri Cotton Saree', url: 'https://shop.test/product/mangalagiri-cotton-saree' },
        { name: 'Uppada Jamdani Saree', url: 'https://shop.test/product/uppada-jamdani-saree' },
      ],
    });

    expect(message).toContain('Hi Lakshmi');
    expect(message).toContain('NH15922621');
    expect(message).toContain('Tracking ID (AWB): D12345678');
    expect(message).toContain(TRACKING_URL);
    expect(message).toContain('https://shop.test/product/mangalagiri-cotton-saree');
    expect(message).toContain('https://shop.test/product/uppada-jamdani-saree');
  });

  // The customer is sent the invoice as a real PDF attachment, not a link to
  // fetch one — so no storage URL may leak into the message text.
  it('never puts an invoice download link in the message', () => {
    const message = buildShipmentMessage({
      customerName: 'Lakshmi',
      orderNumber: 'NH15922621',
      awbNumber: 'D12345678',
      trackingUrl: TRACKING_URL,
      productLinks: [{ name: 'Saree', url: 'https://shop.test/product/saree' }],
    });

    expect(message).not.toContain('Invoice');
    expect(message).not.toContain('.pdf');
  });

  it('lists one link per product, not one per unit bought', () => {
    const message = buildShipmentMessage({
      orderNumber: 'NH1',
      awbNumber: 'D1',
      trackingUrl: TRACKING_URL,
      productLinks: [
        { name: 'Venkatagiri Saree', url: 'https://shop.test/product/venkatagiri-saree' },
        { name: 'Venkatagiri Saree', url: 'https://shop.test/product/venkatagiri-saree' },
      ],
    });

    const occurrences = message.split('https://shop.test/product/venkatagiri-saree').length - 1;
    expect(occurrences).toBe(1);
  });

  it('falls back to a neutral greeting when the order carries no customer name', () => {
    const message = buildShipmentMessage({
      customerName: '   ',
      orderNumber: 'NH2',
      awbNumber: 'D2',
      trackingUrl: TRACKING_URL,
    });
    expect(message.startsWith('Hi there,')).toBe(true);
  });

  it('omits the product block rather than printing an empty heading', () => {
    const message = buildShipmentMessage({
      orderNumber: 'NH3',
      awbNumber: 'D3',
      trackingUrl: TRACKING_URL,
      productLinks: [],
    });
    expect(message).not.toContain('Your order:');
    expect(message).toContain('Tracking ID (AWB): D3');
  });

  it('still sends something useful before an AWB exists', () => {
    const message = buildShipmentMessage({
      customerName: 'Ravi',
      orderNumber: 'NH4',
      trackingUrl: TRACKING_URL,
      productLinks: [{ name: 'Chanderi Dupatta', url: 'https://shop.test/product/chanderi-dupatta' }],
    });

    expect(message).toContain('Hi Ravi');
    expect(message).toContain('NH4');
    expect(message).toContain('https://shop.test/product/chanderi-dupatta');
    expect(message).not.toContain('Tracking ID (AWB)');
    expect(message).not.toContain('has shipped via');
  });

  it('names the real carrier when the shipment used one other than DTDC', () => {
    const message = buildShipmentMessage({
      orderNumber: 'NH5',
      awbNumber: 'D5',
      carrier: 'Blue Dart',
      trackingUrl: TRACKING_URL,
    });
    expect(message).toContain('has shipped via Blue Dart');
  });
});

describe('dedupeProductLinks', () => {
  it('keeps the first occurrence and preserves order', () => {
    expect(
      dedupeProductLinks([
        { name: 'A', url: 'https://shop.test/product/a' },
        { name: 'B', url: 'https://shop.test/product/b' },
        { name: 'A again', url: 'https://shop.test/product/a' },
      ])
    ).toEqual([
      { name: 'A', url: 'https://shop.test/product/a' },
      { name: 'B', url: 'https://shop.test/product/b' },
    ]);
  });
});
