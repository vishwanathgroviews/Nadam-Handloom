import { describe, expect, it } from 'vitest';
import { cleanMobile, invoiceWhatsAppMessage } from './invoiceShare';

describe('cleanMobile', () => {
  it('accepts a 10-digit mobile however it was typed', () => {
    expect(cleanMobile('9876543210')).toBe('9876543210');
    expect(cleanMobile('98765 43210')).toBe('9876543210');
    expect(cleanMobile('+91 98765-43210')).toBe('9876543210');
    expect(cleanMobile('09876543210')).toBe('9876543210');
  });

  it('refuses anything that is not a real Indian mobile', () => {
    expect(cleanMobile('')).toBeNull();
    expect(cleanMobile('12345')).toBeNull();
    expect(cleanMobile('1234567890')).toBeNull(); // mobiles start 6-9
    expect(cleanMobile('98765432101')).toBeNull();
  });
});

describe('invoiceWhatsAppMessage', () => {
  const message = invoiceWhatsAppMessage({
    invoiceNumber: 'NH-INV-0042',
    totalAmount: '3500.00',
    url: 'https://example.com/invoices/abc.pdf',
  });

  it('carries the invoice number, amount and link', () => {
    expect(message).toContain('NH-INV-0042');
    expect(message).toContain('₹3,500');
    expect(message).toContain('https://example.com/invoices/abc.pdf');
  });

  it('says nothing about the customer', () => {
    expect(message).not.toMatch(/\d{10}/);
  });
});
