import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WhatsAppShareButton from './WhatsAppShareButton';

describe('WhatsAppShareButton', () => {
  let openSpy;

  beforeEach(() => {
    openSpy = vi.fn();
    window.open = openSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing if product is missing', () => {
    const { container } = render(<WhatsAppShareButton product={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the button with accessible label and title', () => {
    const product = {
      name: 'Rani Pink Saree',
      sku: 'NH-PS-001',
      slug: 'rani-pink-saree',
      onlinePrice: 12999,
    };

    render(<WhatsAppShareButton product={product} />);

    const button = screen.getByRole('button', { name: /share this product on whatsapp/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Share this product on WhatsApp');
  });

  it('triggers window.open with the correctly encoded WhatsApp URL and NO raw image URL when clicked', () => {
    const product = {
      name: 'Magenta Pure Pattu Silk Saree with Pinstripe Checks and Gold Temple Border',
      sku: 'PROD-12345',
      subcategory: { onlinePrice: 12999 },
      slug: 'magenta-pure-pattu-silk-saree',
      images: [{ url: 'https://example.com/saree.jpg' }],
    };

    render(<WhatsAppShareButton product={product} activeImageIndex={0} />);

    const button = screen.getByRole('button', { name: /share this product on whatsapp/i });
    fireEvent.click(button);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const openedUrl = openSpy.mock.calls[0][0];
    expect(openedUrl).toContain('https://wa.me/916301151166?text=');
    expect(openedUrl).not.toContain('https://wa.me/?text=');
    expect(openedUrl).not.toContain('https://api.whatsapp.com/send?text=');

    const decoded = decodeURIComponent(openedUrl.replace('https://wa.me/916301151166?text=', ''));
    expect(decoded).toContain('Magenta Pure Pattu Silk Saree with Pinstripe Checks and Gold Temple Border');
    expect(decoded).toContain('Groviews');
    expect(decoded).toContain('Product ID: PROD-12345');
    expect(decoded).toContain('Price: ₹12,999');
    expect(decoded).toContain('View Product\nhttps://groviews.com/product/magenta-pure-pattu-silk-saree');
    expect(decoded).not.toContain('View Product:');
    expect(decoded).not.toContain('Product: Magenta');

    // Crucial check: verify raw image URL and Image labels are completely excluded
    expect(decoded).not.toContain('Product Image');
    expect(decoded).not.toContain('Image URL');
    expect(decoded).not.toContain('https://example.com/saree.jpg');
  });

  it('supports sharing an invoice PDF with dummy data', () => {
    const invoiceMedia = {
      type: 'invoice',
      invoiceNumber: 'INV-TEST-001',
      customerName: 'Test Customer',
      productName: 'Rani Pink Kanjivaram Pattu Silk Saree',
      productId: 'NH-PS-001',
      quantity: 1,
      price: 12999,
      total: 12999,
    };

    render(
      <WhatsAppShareButton
        media={invoiceMedia}
        label="Share Invoice on WhatsApp"
        ariaLabel="Share Invoice on WhatsApp"
      />
    );

    const button = screen.getByRole('button', { name: /share invoice on whatsapp/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const openedUrl = openSpy.mock.calls[0][0];
    expect(openedUrl).toContain('https://wa.me/916301151166?text=');
    const decoded = decodeURIComponent(openedUrl.replace('https://wa.me/916301151166?text=', ''));
    expect(decoded).toContain('Groviews');
    expect(decoded).toContain('Invoice: INV-TEST-001');
    expect(decoded).toContain('Please find your invoice attached.');
  });

  it('supports sharing a product catalogue PDF', () => {
    const pdfMedia = {
      type: 'pdf',
      title: 'Product Catalogue',
      filename: 'groviews-catalogue.pdf',
    };

    render(
      <WhatsAppShareButton
        media={pdfMedia}
        label="Share Catalogue on WhatsApp"
        ariaLabel="Share Catalogue on WhatsApp"
      />
    );

    const button = screen.getByRole('button', { name: /share catalogue on whatsapp/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const openedUrl = openSpy.mock.calls[0][0];
    const decoded = decodeURIComponent(openedUrl.replace('https://wa.me/916301151166?text=', ''));
    expect(decoded).toContain('Groviews');
    expect(decoded).toContain('Product Catalogue');
    expect(decoded).toContain('Please find the attached catalogue.');
  });
});

