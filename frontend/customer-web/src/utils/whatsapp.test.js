import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PRODUCTION_SITE_URL,
  OWNER_WHATSAPP_NUMBER,
  DEFAULT_OWNER_WHATSAPP_RECIPIENT,
  formatWhatsAppRecipient,
  getWhatsAppRecipient,
  isLocalhostUrl,
  getSiteBaseUrl,
  getAbsoluteImageUrl,
  getProductPageUrl,
  getShortProductDescription,
  buildWhatsAppProductMessage,
  getWhatsAppShareUrl,
  openWhatsAppShare,
  detectMediaType,
  buildInvoiceMessage,
  buildPdfMessage,
  generateDummyInvoicePdf,
  generateDummyCataloguePdf,
  shareToWhatsApp,
} from './whatsapp';

describe('whatsapp utils', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    delete window.location;
    window.location = new URL('http://localhost:5173/product/test-saree');
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('isLocalhostUrl', () => {
    it('detects localhost and loopback variations', () => {
      expect(isLocalhostUrl('http://localhost:5173')).toBe(true);
      expect(isLocalhostUrl('http://localhost:4173')).toBe(true);
      expect(isLocalhostUrl('http://127.0.0.1:5173')).toBe(true);
      expect(isLocalhostUrl('http://0.0.0.0:3000')).toBe(true);
      expect(isLocalhostUrl('http://[::1]:5173')).toBe(true);
    });

    it('returns false for production domains', () => {
      expect(isLocalhostUrl('https://groviews.com')).toBe(false);
      expect(isLocalhostUrl('https://www.groviews.com')).toBe(false);
      expect(isLocalhostUrl('https://shop.example.com')).toBe(false);
    });
  });

  describe('getSiteBaseUrl and getAbsoluteImageUrl', () => {
    it('defines PRODUCTION_SITE_URL as https://groviews.com', () => {
      expect(PRODUCTION_SITE_URL).toBe('https://groviews.com');
    });

    it('returns production site URL when in production mode', () => {
      window.location = new URL('http://localhost:5173/product/test');
      expect(getSiteBaseUrl({ isProd: true })).toBe(PRODUCTION_SITE_URL);
    });

    it('resolves relative image URLs against production base URL when in production', () => {
      window.location = new URL('http://localhost:5173/product/test');
      expect(getAbsoluteImageUrl('/images/test.jpg', { isProd: true })).toBe(
        'https://groviews.com/images/test.jpg'
      );
    });
  });

  describe('A. Development URL', () => {
    it('generates a local development URL with the correct slug when allowLocalhost is enabled', () => {
      window.location = new URL('http://localhost:5173/product/pink-diamond-jaal-peacock-pattu-saree');
      const url = getProductPageUrl('pink-diamond-jaal-peacock-pattu-saree', {
        allowLocalhost: true,
      });

      expect(url).toBe('http://localhost:5173/product/pink-diamond-jaal-peacock-pattu-saree');
      expect(url).toContain('localhost');
      expect(url).toContain('/product/pink-diamond-jaal-peacock-pattu-saree');
    });

    it('uses the active dev server origin (including LAN address) when allowLocalhost is enabled', () => {
      window.location = new URL('http://192.168.1.50:5173/product/cotton-saree');
      const url = getProductPageUrl('cotton-saree', { allowLocalhost: true });
      expect(url).toBe('http://192.168.1.50:5173/product/cotton-saree');
    });

    it('defaults to production site URL when running on localhost to ensure WhatsApp link is clickable', () => {
      window.location = new URL('http://localhost:5173/product/pink-diamond-jaal-peacock-pattu-saree');
      const url = getProductPageUrl('pink-diamond-jaal-peacock-pattu-saree');
      expect(url).toBe('https://groviews.com/product/pink-diamond-jaal-peacock-pattu-saree');
      expect(url).not.toContain('localhost');
    });
  });

  describe('B. Production URL', () => {
    it('generates https://groviews.com/product/<slug> in production', () => {
      window.location = new URL('https://groviews.com/product/pink-diamond-jaal-peacock-pattu-saree');
      const url = getProductPageUrl('pink-diamond-jaal-peacock-pattu-saree', { isProd: true });

      expect(url).toBe('https://groviews.com/product/pink-diamond-jaal-peacock-pattu-saree');
    });

    it('never outputs http://localhost:5173 or http://localhost:4173 in production', () => {
      // Testing with window on localhost:5173
      window.location = new URL('http://localhost:5173/product/pink-diamond-jaal-peacock-pattu-saree');
      const url5173 = getProductPageUrl('pink-diamond-jaal-peacock-pattu-saree', { isProd: true });
      expect(url5173).not.toContain('http://localhost:5173');
      expect(url5173).toBe('https://groviews.com/product/pink-diamond-jaal-peacock-pattu-saree');

      // Testing with window on localhost:4173 (e.g. previewing build locally)
      window.location = new URL('http://localhost:4173/product/pink-diamond-jaal-peacock-pattu-saree');
      const url4173 = getProductPageUrl('pink-diamond-jaal-peacock-pattu-saree', { isProd: true });
      expect(url4173).not.toContain('http://localhost:4173');
      expect(url4173).not.toContain('localhost');
      expect(url4173).toBe('https://groviews.com/product/pink-diamond-jaal-peacock-pattu-saree');
    });
  });

  describe('C. Localhost Protection', () => {
    it('strictly rejects localhost, 127.0.0.1, 0.0.0.0, and [::1] in production', () => {
      const loopbacks = [
        'http://localhost:5173',
        'http://localhost:4173',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080',
        'http://0.0.0.0:3000',
        'http://[::1]:5173',
      ];

      loopbacks.forEach((lb) => {
        window.location = new URL(`${lb}/product/test-saree`);
        const url = getProductPageUrl('test-saree', { isProd: true });
        expect(url).not.toContain('localhost');
        expect(url).not.toContain('127.0.0.1');
        expect(url).not.toContain('0.0.0.0');
        expect(url).not.toContain('[::1]');
        expect(url).toBe('https://groviews.com/product/test-saree');
      });
    });

    it('rejects an accidental localhost value even if set in VITE_SITE_URL during production', () => {
      vi.stubEnv('VITE_SITE_URL', 'http://localhost:5173');
      const url = getProductPageUrl('test-saree', { isProd: true });
      expect(url).not.toContain('localhost');
      expect(url).toBe('https://groviews.com/product/test-saree');
    });
  });

  describe('D. Custom Production URL', () => {
    it('uses configured VITE_SITE_URL when provided', () => {
      vi.stubEnv('VITE_SITE_URL', 'https://shop.groviews.com');
      const url = getProductPageUrl('pink-diamond-jaal-peacock-pattu-saree', { isProd: true });

      expect(url).toBe('https://shop.groviews.com/product/pink-diamond-jaal-peacock-pattu-saree');
    });
  });

  describe('E. Raw Image URL is NOT in WhatsApp message', () => {
    it('does NOT contain S3 bucket domain, Image URL:, or Product Image:', () => {
      const product = {
        name: 'Pink Diamond Jaal Pattu Silk Saree with Peacock Motif Border',
        sku: 'NH-PS-003',
        onlinePrice: 12999,
        slug: 'pink-diamond-jaal-peacock-pattu-saree',
        images: [
          { url: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/banarasi-pink-diamond-jaal.jpg' },
        ],
      };

      const msg = buildWhatsAppProductMessage(product, { isProd: true });

      // Must NOT contain the raw S3 image URL
      expect(msg).not.toContain('nandamhandlooms-media.s3.ap-south-1.amazonaws.com');
      expect(msg).not.toContain('banarasi-pink-diamond-jaal.jpg');

      // Must NOT contain Image URL: or Product Image: labels
      expect(msg).not.toContain('Image URL:');
      expect(msg).not.toContain('Image URL');
      expect(msg).not.toContain('Product Image:');
      expect(msg).not.toContain('Product Image');
    });
  });

  describe('getShortProductDescription', () => {
    it('returns empty string for invalid input or empty description', () => {
      expect(getShortProductDescription(null)).toBe('');
      expect(getShortProductDescription({})).toBe('');
      expect(getShortProductDescription({ description: '' })).toBe('');
    });

    it('returns description as-is if already within maximum length', () => {
      const product = { description: 'Handwoven saree ...' };
      expect(getShortProductDescription(product)).toBe('Handwoven saree ...');
    });

    it('truncates long descriptions at word boundaries with an ellipsis', () => {
      const product = {
        description:
          'Pure and regular pattu silk sarees, handwoven with Kanchi, temple, and scallop zari borders.',
      };
      const shortDesc = getShortProductDescription(product, 80);
      expect(shortDesc.length).toBeLessThanOrEqual(85);
      expect(shortDesc.endsWith('...')).toBe(true);
      expect(shortDesc).not.toContain('borders.');
    });

    it('prefers product.shortDescription, then description, then subcategory.description', () => {
      expect(
        getShortProductDescription({
          shortDescription: 'Short desc',
          description: 'Longer description',
          subcategory: { description: 'Subcat desc' },
        })
      ).toBe('Short desc');

      expect(
        getShortProductDescription({
          description: 'Direct description',
          subcategory: { description: 'Subcat desc' },
        })
      ).toBe('Direct description');

      expect(
        getShortProductDescription({
          subcategory: { description: 'Subcat description' },
        })
      ).toBe('Subcat description');
    });
  });

  describe('F. Product Information Structure', () => {
    it('structures message with product name, Groviews, short description, IDs, price, and View Product', () => {
      const product = {
        name: 'Pink Diamond Jaal Pattu Silk Saree with Peacock Motif Border',
        sku: 'NH-PS-003',
        barcodeId: 'BAR-987654',
        subcategory: {
          onlinePrice: 12999,
          description: 'Handwoven saree ...',
        },
        slug: 'pink-diamond-jaal-peacock-pattu-saree',
        images: [{ url: 'https://example.com/saree.jpg' }],
      };

      const msg = buildWhatsAppProductMessage(product, { isProd: true });

      // No "Product: " prefix
      expect(msg).not.toContain('Product: Pink');
      expect(msg).toContain('Pink Diamond Jaal Pattu Silk Saree with Peacock Motif Border');

      // Business name without emoji
      expect(msg).toContain('Groviews\nHandwoven saree ...');

      // Product ID and Barcode ID
      expect(msg).toContain('Product ID: NH-PS-003');
      expect(msg).toContain('Barcode ID: BAR-987654');
      expect(msg).toContain('Price: ₹12,999');

      // View Product without colon
      expect(msg).toContain('View Product\nhttps://groviews.com/product/pink-diamond-jaal-peacock-pattu-saree');
      expect(msg).not.toContain('View Product:');
    });

    it('gracefully handles missing barcode by omitting Barcode ID line completely', () => {
      const product = {
        name: 'Handloom Cotton Saree',
        sku: 'NH-CS-001',
        onlinePrice: 2999,
        slug: 'black-cotton-saree',
      };

      const msg = buildWhatsAppProductMessage(product, { isProd: true });
      expect(msg).not.toContain('Barcode ID');
      expect(msg).not.toContain('Barcode ID: N/A');
      expect(msg).not.toContain('undefined');
      expect(msg).toContain('Product ID: NH-CS-001');
      expect(msg).toContain('Price: ₹2,999');
    });

    it('omits Barcode ID line when barcode is null, empty string, or N/A', () => {
      ['', null, undefined, 'N/A', 'null', 'undefined'].forEach((invalidBarcode) => {
        const product = {
          name: 'Handloom Cotton Saree',
          sku: 'NH-CS-001',
          barcodeId: invalidBarcode,
          onlinePrice: 2999,
          slug: 'black-cotton-saree',
        };
        const msg = buildWhatsAppProductMessage(product, { isProd: true });
        expect(msg).not.toContain('Barcode ID');
      });
    });
  });

  describe('G. Production Product URL in Final Message Matching Required Specification', () => {
    it('matches exact specification example when Barcode ID IS available', () => {
      const product = {
        name: 'Rani Pink Kanjivaram Pattu Silk\nSaree with Peacock Zari Border',
        productId: '12345',
        barcodeId: 'NH-987654',
        price: 12500,
        description: 'Handwoven saree ...',
        slug: 'rani-pink-kanjivaram-pattu-silk-saree',
      };

      const msg = buildWhatsAppProductMessage(product, { isProd: true });

      const expected = [
        'Rani Pink Kanjivaram Pattu Silk\nSaree with Peacock Zari Border',
        'Groviews\nHandwoven saree ...',
        'Product ID: 12345\nBarcode ID: NH-987654\nPrice: ₹12,500',
        'View Product\nhttps://groviews.com/product/rani-pink-kanjivaram-pattu-silk-saree',
      ].join('\n\n');

      expect(msg).toBe(expected);
      expect(msg).toContain('https://groviews.com/product/rani-pink-kanjivaram-pattu-silk-saree');
      expect(msg).not.toContain('localhost');
    });

    it('matches exact specification example when Barcode ID is NOT available', () => {
      const product = {
        name: 'Rani Pink Kanjivaram Pattu Silk\nSaree with Peacock Zari Border',
        productId: '12345',
        price: 12500,
        description: 'Handwoven saree ...',
        slug: 'rani-pink-kanjivaram-pattu-silk-saree',
      };

      const msg = buildWhatsAppProductMessage(product, { isProd: true });

      const expected = [
        'Rani Pink Kanjivaram Pattu Silk\nSaree with Peacock Zari Border',
        'Groviews\nHandwoven saree ...',
        'Product ID: 12345\nPrice: ₹12,500',
        'View Product\nhttps://groviews.com/product/rani-pink-kanjivaram-pattu-silk-saree',
      ].join('\n\n');

      expect(msg).toBe(expected);
      expect(msg).not.toContain('Barcode ID');
      expect(msg).not.toContain('localhost');
    });
  });

  describe('recipient formatting and resolution', () => {
    it('defines OWNER_WHATSAPP_NUMBER as 6301151166 and recipient as 916301151166', () => {
      expect(OWNER_WHATSAPP_NUMBER).toBe('6301151166');
      expect(DEFAULT_OWNER_WHATSAPP_RECIPIENT).toBe('916301151166');
    });

    it('normalizes 10-digit Indian numbers with +91 country code without + sign', () => {
      expect(formatWhatsAppRecipient('6301151166')).toBe('916301151166');
      expect(formatWhatsAppRecipient('+91 63011 51166')).toBe('916301151166');
      expect(formatWhatsAppRecipient('+916301151166')).toBe('916301151166');
      expect(formatWhatsAppRecipient('916301151166')).toBe('916301151166');
    });

    it('resolves custom recipient from options or environment variable', () => {
      expect(getWhatsAppRecipient({ recipient: '9876543210' })).toBe('919876543210');

      vi.stubEnv('VITE_OWNER_WHATSAPP_NUMBER', '9998887770');
      expect(getWhatsAppRecipient()).toBe('919998887770');
    });
  });

  describe('getWhatsAppShareUrl and openWhatsAppShare — Specific Owner Recipient', () => {
    const sampleProduct = {
      name: 'Pink Diamond Jaal Pattu Silk Saree with Peacock Motif Border',
      sku: 'NH-PS-003',
      price: 12999,
      slug: 'pink-diamond-jaal-peacock-pattu-saree',
      images: [
        { url: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/banarasi-pink-diamond-jaal.jpg' },
      ],
    };

    it('1. generates URL with the exact configured recipient https://wa.me/916301151166?text=', () => {
      const url = getWhatsAppShareUrl(sampleProduct, { isProd: true });
      expect(url.startsWith('https://wa.me/916301151166?text=')).toBe(true);
      expect(url).toContain('https://wa.me/916301151166?text=');
    });

    it('2. does NOT generate a generic WhatsApp URL (no wa.me/?text= or send?text=)', () => {
      const url = getWhatsAppShareUrl(sampleProduct, { isProd: true });
      expect(url).not.toContain('https://wa.me/?text=');
      expect(url).not.toContain('https://api.whatsapp.com/send?text=');
    });

    it('3. correctly pre-fills product information (Groviews, name, sku, price, view product)', () => {
      const url = getWhatsAppShareUrl(sampleProduct, { isProd: true });
      const encodedText = url.replace('https://wa.me/916301151166?text=', '');
      const decoded = decodeURIComponent(encodedText);

      expect(decoded).toContain('Pink Diamond Jaal Pattu Silk Saree with Peacock Motif Border');
      expect(decoded).toContain('Groviews');
      expect(decoded).toContain('Product ID: NH-PS-003');
      expect(decoded).toContain('Price: ₹12,999');
      expect(decoded).toContain('View Product\nhttps://groviews.com/product/pink-diamond-jaal-peacock-pattu-saree');
    });

    it('4. contains production product URL and never localhost:5173', () => {
      window.location = new URL('http://localhost:5173/product/pink-diamond-jaal-peacock-pattu-saree');
      const url = getWhatsAppShareUrl(sampleProduct);
      const decoded = decodeURIComponent(url.replace('https://wa.me/916301151166?text=', ''));

      expect(decoded).toContain('https://groviews.com/product/pink-diamond-jaal-peacock-pattu-saree');
      expect(decoded).not.toContain('http://localhost:5173');
      expect(decoded).not.toContain('localhost');
    });

    it('5. does NOT contain raw S3 bucket URL or Image URL labels', () => {
      const url = getWhatsAppShareUrl(sampleProduct, { isProd: true });
      const decoded = decodeURIComponent(url.replace('https://wa.me/916301151166?text=', ''));

      expect(decoded).not.toContain('nandamhandlooms-media.s3.ap-south-1.amazonaws.com');
      expect(decoded).not.toContain('banarasi-pink-diamond-jaal.jpg');
      expect(decoded).not.toContain('Product Image:');
      expect(decoded).not.toContain('Image URL:');
    });

    it('triggers window.open with the direct owner chat URL when sharing', () => {
      const openSpy = vi.fn();
      window.open = openSpy;

      const result = openWhatsAppShare(sampleProduct, { isProd: true });
      expect(result).toBe(true);
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.mock.calls[0][0]).toContain('https://wa.me/916301151166?text=');
      expect(openSpy.mock.calls[0][1]).toBe('_blank');
      expect(openSpy.mock.calls[0][2]).toBe('noopener,noreferrer');
    });
  });

  describe('Automatic Media-Type Detection (detectMediaType)', () => {
    it('detects single-image for single image URL or single-image product', () => {
      expect(detectMediaType('https://example.com/saree.jpg')).toBe('single-image');
      expect(detectMediaType({ url: 'https://example.com/saree.png', type: 'image' })).toBe('single-image');
      expect(detectMediaType({ slug: 'saree', images: [{ url: 'https://example.com/saree.jpg' }] })).toBe('single-image');
    });

    it('detects multiple-images for array of images or product with multiple images', () => {
      const imgArray = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];
      expect(detectMediaType(imgArray)).toBe('multiple-images');

      const multiProd = {
        slug: 'saree',
        images: [{ url: 'https://example.com/1.jpg' }, { url: 'https://example.com/2.jpg' }],
      };
      expect(detectMediaType(multiProd)).toBe('multiple-images');
      expect(detectMediaType(multiProd, { shareAllImages: true })).toBe('multiple-images');
    });

    it('detects pdf for PDF files, URLs and document objects', () => {
      expect(detectMediaType('https://example.com/catalogue.pdf')).toBe('pdf');
      expect(detectMediaType({ type: 'pdf', url: 'https://example.com/doc.pdf' })).toBe('pdf');
      expect(detectMediaType(new File([''], 'catalogue.pdf', { type: 'application/pdf' }))).toBe('pdf');
    });

    it('detects invoice-pdf for invoice objects and invoice files', () => {
      expect(detectMediaType({ type: 'invoice', invoiceNumber: 'INV-TEST-001' })).toBe('invoice-pdf');
      expect(detectMediaType({ isInvoice: true, invoiceNumber: 'INV-999' })).toBe('invoice-pdf');
      expect(detectMediaType({ invoiceNumber: 'INV-TEST-001' })).toBe('invoice-pdf');
      expect(detectMediaType(new File([''], 'invoice-INV-TEST-001.pdf', { type: 'application/pdf' }))).toBe('invoice-pdf');
    });

    it('detects text for plain text or product with no images', () => {
      expect(detectMediaType(null)).toBe('text');
      expect(detectMediaType({ slug: 'test-slug', images: [] })).toBe('text');
    });
  });

  describe('Test 1 — Single Image Sharing', () => {
    const singleProduct = {
      name: 'Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border',
      sku: 'NH-PS-001',
      price: 12999,
      slug: 'rani-pink-kanjivaram-pattu-silk-saree',
      description: 'Pure and regular pattu silk sarees, handwoven with Kanchi, temple, and scallop border.',
      images: [
        { url: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink-peacock.jpg' },
      ],
    };

    it('shares single image via Web Share API when supported', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      const mockCanShare = vi.fn().mockReturnValue(true);
      navigator.share = mockShare;
      navigator.canShare = mockCanShare;

      // Mock fetch for image URL
      const mockBlob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      }));

      const res = await shareToWhatsApp(singleProduct, { isProd: true });

      expect(res.success).toBe(true);
      expect(res.method).toBe('web-share');
      expect(res.mediaType).toBe('single-image');
      expect(mockShare).toHaveBeenCalledTimes(1);

      const shareArgs = mockShare.mock.calls[0][0];
      expect(shareArgs.files).toHaveLength(1);
      expect(shareArgs.files[0].name).toBe('kanjivaram-rani-pink-peacock.jpg');
      expect(shareArgs.text).toContain('Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border');
      expect(shareArgs.text).toContain('Groviews');
      expect(shareArgs.text).toContain('Product ID: NH-PS-001');
      expect(shareArgs.text).toContain('Price: ₹12,999');
      expect(shareArgs.text).toContain('https://groviews.com/product/rani-pink-kanjivaram-pattu-silk-saree');
    });

    it('falls back gracefully to WhatsApp Click-to-Chat when direct sharing is unsupported', async () => {
      delete navigator.share;
      navigator.canShare = vi.fn().mockReturnValue(false);
      const openSpy = vi.fn();
      window.open = openSpy;

      const res = await shareToWhatsApp(singleProduct, { isProd: true });

      expect(res.success).toBe(true);
      expect(res.method).toBe('fallback-click-to-chat');
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.mock.calls[0][0]).toContain('https://wa.me/916301151166?text=');
    });
  });

  describe('Test 2 — Multiple Image Sharing', () => {
    const multiProduct = {
      name: 'Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border',
      sku: 'NH-PS-001',
      price: 12999,
      slug: 'rani-pink-kanjivaram-pattu-silk-saree',
      description: 'Pure and regular pattu silk sarees, handwoven with Kanchi.',
      images: [
        { url: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink-peacock.jpg' },
        { url: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink-peacock-pallu.jpg' },
        { url: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink-peacock-border.jpg' },
      ],
    };

    it('shares all available images together in correct order', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      navigator.share = mockShare;
      navigator.canShare = vi.fn().mockReturnValue(true);

      vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob([`bytes-${url}`], { type: 'image/jpeg' })),
        });
      }));

      const res = await shareToWhatsApp(multiProduct, { shareAllImages: true, isProd: true });

      expect(res.success).toBe(true);
      expect(res.method).toBe('web-share');
      expect(res.mediaType).toBe('multiple-images');
      expect(mockShare).toHaveBeenCalledTimes(1);

      const shareArgs = mockShare.mock.calls[0][0];
      expect(shareArgs.files).toHaveLength(3);
      expect(shareArgs.files[0].name).toBe('kanjivaram-rani-pink-peacock.jpg');
      expect(shareArgs.files[1].name).toBe('kanjivaram-rani-pink-peacock-pallu.jpg');
      expect(shareArgs.files[2].name).toBe('kanjivaram-rani-pink-peacock-border.jpg');
      expect(shareArgs.text).toContain('Rani Pink Kanjivaram Pattu Silk Saree');
    });

    it('skips invalid/missing image URLs and shares remaining valid images', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      navigator.share = mockShare;
      navigator.canShare = vi.fn().mockReturnValue(true);

      // Second image returns 404
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
        if (url.includes('pallu')) {
          return Promise.resolve({ ok: false, status: 404 });
        }
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['ok-bytes'], { type: 'image/jpeg' })),
        });
      }));

      const res = await shareToWhatsApp(multiProduct, { shareAllImages: true, isProd: true });

      expect(res.success).toBe(true);
      expect(mockShare).toHaveBeenCalledTimes(1);
      const shareArgs = mockShare.mock.calls[0][0];
      // Failed image skipped, remaining 2 images shared
      expect(shareArgs.files).toHaveLength(2);
    });

    it('deduplicates duplicate image URLs', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      navigator.share = mockShare;
      navigator.canShare = vi.fn().mockReturnValue(true);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['bytes'], { type: 'image/jpeg' })),
      }));

      const duplicateList = [
        'https://example.com/same.jpg',
        'https://example.com/same.jpg',
        'https://example.com/unique.jpg',
      ];

      await shareToWhatsApp(duplicateList);

      const shareArgs = mockShare.mock.calls[0][0];
      expect(shareArgs.files).toHaveLength(2);
    });
  });

  describe('Test 3 — PDF Sharing', () => {
    it('generates valid dummy catalogue PDF and preserves filename', () => {
      const dummyCat = generateDummyCataloguePdf({ title: 'Summer Collection' });
      expect(dummyCat.filename).toBe('groviews-catalogue.pdf');
      expect(dummyCat.blob.type).toBe('application/pdf');
      expect(dummyCat.file).toBeInstanceOf(File);
      expect(dummyCat.file.name).toBe('groviews-catalogue.pdf');
    });

    it('builds standard catalogue PDF message', () => {
      const msg = buildPdfMessage({ title: 'Product Catalogue' });
      expect(msg).toBe(
        'Groviews\nProduct Catalogue\n\nPlease find the attached catalogue.'
      );
    });

    it('shares PDF document with caption via Web Share API', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      navigator.share = mockShare;
      navigator.canShare = vi.fn().mockReturnValue(true);

      const testFile = new File(['%PDF-1.4\n%%EOF'], 'catalogue.pdf', { type: 'application/pdf' });
      const res = await shareToWhatsApp(testFile);

      expect(res.success).toBe(true);
      expect(res.mediaType).toBe('pdf');
      expect(mockShare).toHaveBeenCalledTimes(1);

      const shareArgs = mockShare.mock.calls[0][0];
      expect(shareArgs.files[0].name).toBe('catalogue.pdf');
      expect(shareArgs.files[0].type).toBe('application/pdf');
      expect(shareArgs.text).toContain('Please find the attached catalogue.');
    });
  });

  describe('Test 4 — Dummy Invoice PDF Sharing', () => {
    it('generates a valid PDF with INV-TEST-001 and realistic dummy data (no real customer data)', () => {
      const invoice = generateDummyInvoicePdf({
        invoiceNumber: 'INV-TEST-001',
        customerName: 'Test Customer',
        productName: 'Rani Pink Kanjivaram Pattu Silk Saree',
        productId: 'NH-PS-001',
        quantity: 1,
        price: 12999,
        total: 12999,
      });

      expect(invoice.invoiceNumber).toBe('INV-TEST-001');
      expect(invoice.customerName).toBe('Test Customer');
      expect(invoice.filename).toBe('invoice-INV-TEST-001.pdf');
      expect(invoice.blob.type).toBe('application/pdf');
      expect(invoice.file).toBeInstanceOf(File);
      expect(invoice.file.name).toBe('invoice-INV-TEST-001.pdf');
    });

    it('builds standard invoice caption matching required format', () => {
      const caption = buildInvoiceMessage({ invoiceNumber: 'INV-TEST-001' });
      expect(caption).toBe(
        'Groviews\n\nInvoice: INV-TEST-001\n\nPlease find your invoice attached.'
      );
    });

    it('shares invoice PDF document with exact caption via Web Share API', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      navigator.share = mockShare;
      navigator.canShare = vi.fn().mockReturnValue(true);

      const res = await shareToWhatsApp({
        type: 'invoice',
        invoiceNumber: 'INV-TEST-001',
        customerName: 'Test Customer',
        productName: 'Rani Pink Kanjivaram Pattu Silk Saree',
        productId: 'NH-PS-001',
        quantity: 1,
        price: 12999,
        total: 12999,
      });

      expect(res.success).toBe(true);
      expect(res.mediaType).toBe('invoice-pdf');
      expect(mockShare).toHaveBeenCalledTimes(1);

      const shareArgs = mockShare.mock.calls[0][0];
      expect(shareArgs.files).toHaveLength(1);
      expect(shareArgs.files[0].name).toBe('invoice-INV-TEST-001.pdf');
      expect(shareArgs.files[0].type).toBe('application/pdf');
      expect(shareArgs.text).toBe(
        'Groviews\n\nInvoice: INV-TEST-001\n\nPlease find your invoice attached.'
      );
    });

    it('triggers file download and opens WhatsApp Click-to-Chat in fallback mode', async () => {
      delete navigator.share;
      navigator.canShare = vi.fn().mockReturnValue(false);
      const openSpy = vi.fn();
      window.open = openSpy;

      const res = await shareToWhatsApp({
        type: 'invoice',
        invoiceNumber: 'INV-TEST-001',
      });

      expect(res.success).toBe(true);
      expect(res.method).toBe('fallback-click-to-chat');
      expect(res.mediaType).toBe('invoice-pdf');
      expect(res.downloaded).toBe(true);
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.mock.calls[0][0]).toContain('https://wa.me/916301151166?text=');
    });

    it('never appends View/download: or raw media URLs to the WhatsApp message in fallback mode', async () => {
      delete navigator.share;
      navigator.canShare = vi.fn().mockReturnValue(false);
      const openSpy = vi.fn();
      window.open = openSpy;

      const res = await shareToWhatsApp({
        name: 'Pink Diamond Jaal Pattu Silk Saree with Peacock Motif Border',
        slug: 'pink-diamond-jaal-peacock-pattu-saree',
        productId: 'NH-PS-003',
        price: 12999,
        description: 'Pure and regular pattu silk sarees, handwoven with Kanchi, temple, and scallop ...',
        images: ['https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/banarasi-pink-diamond-jaal.jpg'],
      });

      expect(res.success).toBe(true);
      expect(res.caption).not.toContain('View/download');
      expect(res.caption).not.toContain('View/download:');
      expect(res.caption).toContain('View Product\nhttps://groviews.com/product/pink-diamond-jaal-peacock-pattu-saree');
      expect(openSpy).toHaveBeenCalledTimes(1);
      const openedUrl = decodeURIComponent(openSpy.mock.calls[0][0]);
      expect(openedUrl).not.toContain('View/download');
      expect(openedUrl).not.toContain('banarasi-pink-diamond-jaal.jpg');
    });
  });
});
