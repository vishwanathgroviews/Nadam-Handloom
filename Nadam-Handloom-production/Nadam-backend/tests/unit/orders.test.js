// Module 7: the ship-to card, the town, tracking numbers, the WhatsApp message.
import { describe, it, expect } from 'vitest';
import { addressLines, townOf, customerOf, tidyAwb, isAwb, shipmentMessage } from '../../src/services/order.service.js';

const wa = (line1, extra = {}) => ({ channel: 'whatsapp', shippingAddress: { fullName: 'Padma', phone: '9123456780', line1, line2: null, city: '', state: '', pincode: '' }, ...extra });

describe('the ship-to card', () => {
  it('a WhatsApp address in its own lines; never a blank name or stray commas', () => {
    expect(addressLines(wa('Flat 3B, Sai Residency\n  Lakshmipuram \n\nGuntur 522007'))).toEqual(['Flat 3B, Sai Residency', 'Lakshmipuram', 'Guntur 522007']);
    const online = { channel: 'online', shippingAddress: { fullName: 'Kavya Sri', phone: '9989012345', line1: 'D.No 12-4', line2: '', city: 'Guntur', state: 'Andhra Pradesh', pincode: '522002' } };
    expect(addressLines(online)).toEqual(['D.No 12-4', 'Guntur, Andhra Pradesh 522002']);
    expect(customerOf(wa('x', { shippingAddress: { fullName: '', phone: '9', line1: 'x' } })).name).toBe('WhatsApp customer');
  });
  it('the town for the list', () => {
    expect(townOf(wa('Flat 3B\nGuntur 522007'))).toBe('Guntur');
    expect(townOf(wa('12-4 Main Road, Tenali 522201'))).toBe('Tenali');
    expect(townOf(wa('Flat 3B Sai Residency Lakshmipuram Guntur 522007'))).toBe('Guntur');
    expect(townOf({ channel: 'online', shippingAddress: { city: 'Hyderabad' } })).toBe('Hyderabad');
  });
});

describe('tracking numbers', () => {
  it('capitals, no spaces or dashes; 8 to 20 letters and digits', () => {
    expect(tidyAwb(' h100 1830-791 ')).toBe('H1001830791');
    expect(isAwb('H1001830791')).toBe(true);
    expect(isAwb('AB12')).toBe(false);
    expect(isAwb('H1001830791!')).toBe(false);
  });
});

describe('the WhatsApp message (as the old app, with the customer\'s name)', () => {
  const order = (carrier, items) => ({ ...wa('Guntur 522007'), orderNumber: 'NH12345678', shipment: { carrier, awbNumber: 'H1001830791' }, items });
  const items = [{ nameSnapshot: 'Rainbow checks sarees', product: { slug: 'rainbow-checks-sarees' } }, { nameSnapshot: 'Rainbow checks sarees', product: { slug: 'rainbow-checks-sarees' } }];
  it('DTDC: tracking ID and link; one line per saree design', () => {
    const m = shipmentMessage(order('DTDC', items));
    expect(m).toBe('Hi Padma, your Nandam Handlooms order NH12345678 has shipped via DTDC.\n\nTracking ID (AWB): H1001830791\nTrack it here: https://www.dtdc.com/track-your-shipment/\n\nYour order:\nRainbow checks sarees\n\nThank you for shopping with us!');
  });
  it('another courier: the number only', () => {
    const m = shipmentMessage(order('India Post', items.slice(0, 1)));
    expect(m).toContain('shipped via India Post.\n\nTracking number: H1001830791\n');
    expect(m).not.toContain('dtdc');
  });
});
