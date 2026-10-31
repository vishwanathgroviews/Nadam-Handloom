// Module 7: tracking numbers, waiting text, list lines, links, the copied address.
import { tidyAwb, isAwb, waitingText, rowStatus, telLink, waLink, addressText } from './orders';

describe('tracking numbers', () => {
  it('capitals, no spaces or dashes; 8 to 20 letters and digits', () => {
    expect(tidyAwb(' h100 1830-791 ')).toBe('H1001830791');
    expect(isAwb('H1001830791')).toBe(true);
    expect(isAwb('AB12')).toBe(false);
    expect(isAwb('EM123456789IN')).toBe(true);
  });
});

describe('the list', () => {
  it('waiting text, amber from a day on; shipped, check delivery, delivered', () => {
    expect(waitingText(0)).toBe('today');
    expect(waitingText(1)).toBe('waiting 1 day');
    expect(rowStatus({ status: 'processing', waitingDays: 2 })).toEqual({ text: 'waiting 2 days', warn: true });
    expect(rowStatus({ status: 'processing', waitingDays: 0 }).warn).toBe(false);
    expect(rowStatus({ status: 'shipped', shippedDate: '10 Oct 2026', carrier: 'DTDC', awb: 'H1', checkDelivery: false }).text).toBe('Shipped 10 Oct 2026 · DTDC H1');
    expect(rowStatus({ status: 'shipped', shippedDate: '29 Sept 2026', checkDelivery: true })).toEqual({ text: 'Check delivery · shipped 29 Sept 2026', warn: true });
    expect(rowStatus({ status: 'delivered', deliveredDate: '4 Oct 2026' }).text).toBe('Delivered 4 Oct 2026');
  });
});

describe('links and the copied address', () => {
  it('call and WhatsApp the customer; the address block', () => {
    expect(telLink('9123456780')).toBe('tel:+919123456780');
    expect(waLink('9123456780', 'Hi Padma')).toBe('https://wa.me/919123456780?text=Hi%20Padma');
    expect(addressText({ name: 'Padma', lines: ['Flat 3B', 'Guntur 522007'], mobile: '9123456780' })).toBe('Padma\nFlat 3B\nGuntur 522007\nMobile: +91 9123456780');
  });
});
