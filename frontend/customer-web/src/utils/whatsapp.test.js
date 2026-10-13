import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildProductCustomerShareMessage,
  getCustomerWhatsAppShareUrl,
  shareProductOnWhatsApp,
  PRODUCTION_SITE_URL,
} from './whatsapp';

describe('WhatsApp Customer Share Utilities', () => {
  const sampleProductWithDiscount = {
    id: 'prod-123',
    slug: 'rani-pink-kanjivaram-pattu-silk-saree',
    name: 'Rani Pink Kanjivaram Pattu Silk Saree',
    subcategory: {
      onlinePrice: 12999,
      mrp: 15999,
    },
    images: [{ url: 'https://images.example.com/saree-1.jpg' }],
  };

  const sampleProductWithoutDiscount = {
    id: 'prod-456',
    slug: 'pure-mangalagiri-cotton-saree',
    name: 'Pure Mangalagiri Cotton Saree',
    subcategory: {
      onlinePrice: 4500,
      mrp: 4500,
    },
    images: [{ url: 'https://images.example.com/cotton-1.jpg' }],
  };

  it('builds structured share message with offer price when MRP is higher than onlinePrice', () => {
    const msg = buildProductCustomerShareMessage(sampleProductWithDiscount);
    expect(msg).toContain('Beautiful saree from Nandam Handlooms!');
    expect(msg).toContain('Product: Rani Pink Kanjivaram Pattu Silk Saree');
    expect(msg).toContain('Price: ₹15,999');
    expect(msg).toContain('Offer Price: ₹12,999');
    expect(msg).toContain('View this product:');
    expect(msg).toContain(`${PRODUCTION_SITE_URL}/product/rani-pink-kanjivaram-pattu-silk-saree`);
  });

  it('builds structured share message without offer price when there is no discount', () => {
    const msg = buildProductCustomerShareMessage(sampleProductWithoutDiscount);
    expect(msg).toContain('Beautiful saree from Nandam Handlooms!');
    expect(msg).toContain('Product: Pure Mangalagiri Cotton Saree');
    expect(msg).toContain('Price: ₹4,500');
    expect(msg).not.toContain('Offer Price:');
    expect(msg).toContain('View this product:');
    expect(msg).toContain(`${PRODUCTION_SITE_URL}/product/pure-mangalagiri-cotton-saree`);
  });

  it('generates universal WhatsApp share URL with encoded message and no hardcoded recipient', () => {
    const url = getCustomerWhatsAppShareUrl(sampleProductWithoutDiscount);
    expect(url.startsWith('https://api.whatsapp.com/send?text=')).toBe(true);
    expect(url).not.toContain('916301151166'); // Does not lock in owner number
    expect(url).toContain(encodeURIComponent('Pure Mangalagiri Cotton Saree'));
  });

  describe('shareProductOnWhatsApp', () => {
    let originalNavigator;
    let originalWindowOpen;
    let originalFetch;

    beforeEach(() => {
      originalNavigator = globalThis.navigator;
      originalWindowOpen = globalThis.window?.open;
      originalFetch = globalThis.fetch;
      globalThis.window.open = vi.fn();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['fake image data'], { type: 'image/jpeg' }),
      });
    });

    afterEach(() => {
      globalThis.navigator = originalNavigator;
      if (globalThis.window) {
        globalThis.window.open = originalWindowOpen;
      }
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('falls back to window.open with universal WhatsApp link when Web Share API is unsupported', async () => {
      globalThis.navigator = {}; // No canShare, no share

      const result = await shareProductOnWhatsApp(sampleProductWithDiscount);
      expect(result.success).toBe(true);
      expect(result.method).toBe('whatsapp-link');
      expect(result.imageAttached).toBe(false);
      expect(globalThis.window.open).toHaveBeenCalledTimes(1);
      const openedUrl = globalThis.window.open.mock.calls[0][0];
      expect(openedUrl.startsWith('https://api.whatsapp.com/send?text=')).toBe(true);
    });

    it('uses navigator.share when files are supported', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      const mockCanShare = vi.fn().mockReturnValue(true);

      globalThis.navigator = {
        canShare: mockCanShare,
        share: mockShare,
      };

      // Mock fetch to return a fake image blob
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['fake image data'], { type: 'image/jpeg' }),
      });

      const result = await shareProductOnWhatsApp(sampleProductWithDiscount);
      expect(mockShare).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.imageAttached).toBe(true);
      expect(globalThis.window.open).not.toHaveBeenCalled();
    });

    it('handles AbortError gracefully when user dismisses the native share sheet', async () => {
      const abortError = new Error('Share canceled');
      abortError.name = 'AbortError';

      globalThis.navigator = {
        canShare: vi.fn().mockReturnValue(true),
        share: vi.fn().mockRejectedValue(abortError),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['fake image data'], { type: 'image/jpeg' }),
      });

      const result = await shareProductOnWhatsApp(sampleProductWithDiscount);
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
      expect(globalThis.window.open).not.toHaveBeenCalled(); // Must not trigger fallback on cancel!
    });
  });
});
