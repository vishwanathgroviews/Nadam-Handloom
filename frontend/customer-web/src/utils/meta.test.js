import { describe, expect, it, beforeEach } from 'vitest';
import {
  getProductMeta,
  resolveProductImageUrl,
  updateProductMeta,
  resetProductMeta,
  DEFAULT_PAGE_TITLE,
  DEFAULT_SITE_NAME,
} from './meta';

describe('meta utils', () => {
  const productA = {
    name: 'Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border',
    slug: 'rani-pink-kanjivaram-pattu-silk-saree',
    sku: 'NH-PS-001',
    price: 12999,
    images: [
      { url: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink.jpg' },
      { url: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink-detail.jpg' },
    ],
  };

  const productB = {
    name: 'Black Handloom Cotton Saree with Silver Zari Checks',
    slug: 'black-cotton-saree-silver-checks',
    sku: 'NH-CS-001',
    price: 4999,
    images: [
      { url: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/black-cotton-checks.jpg' },
    ],
  };

  beforeEach(() => {
    document.title = DEFAULT_PAGE_TITLE;
    document.head.querySelectorAll('meta[data-dynamic-meta="true"]').forEach((el) => el.remove());
  });

  describe('resolveProductImageUrl', () => {
    it('returns empty string when no image provided', () => {
      expect(resolveProductImageUrl(null)).toBe('');
      expect(resolveProductImageUrl(undefined)).toBe('');
    });

    it('returns absolute HTTPS URL as is', () => {
      const url = 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/saree.jpg';
      expect(resolveProductImageUrl(url)).toBe(url);
      expect(resolveProductImageUrl({ url })).toBe(url);
    });

    it('resolves relative image path against production site URL', () => {
      expect(resolveProductImageUrl('/uploads/saree.jpg')).toBe('https://groviews.com/uploads/saree.jpg');
      expect(resolveProductImageUrl('uploads/saree.jpg')).toBe('https://groviews.com/uploads/saree.jpg');
    });

    it('sanitizes accidental localhost image URLs to production domain', () => {
      expect(resolveProductImageUrl('http://localhost:5173/images/test.jpg')).toBe(
        'https://groviews.com/images/test.jpg'
      );
      expect(resolveProductImageUrl('http://127.0.0.1:4000/uploads/test.jpg')).toBe(
        'https://groviews.com/uploads/test.jpg'
      );
    });
  });

  describe('getProductMeta — Dynamic Metadata per Product', () => {
    it('generates exact required Open Graph metadata for product A', () => {
      const meta = getProductMeta(productA);

      expect(meta).not.toBeNull();
      expect(meta.title).toBe('Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border');
      expect(meta.documentTitle).toBe('Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border | Groviews');
      expect(meta.description).toBe('View Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border at Groviews.');
      expect(meta.image).toBe('https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink.jpg');
      expect(meta.url).toBe('https://groviews.com/product/rani-pink-kanjivaram-pattu-silk-saree');
      expect(meta.type).toBe('product');
      expect(meta.siteName).toBe(DEFAULT_SITE_NAME);
      expect(meta.twitterCard).toBe('summary_large_image');
    });

    it('generates completely distinct, dynamic metadata for product B', () => {
      const meta = getProductMeta(productB);

      expect(meta).not.toBeNull();
      expect(meta.title).toBe('Black Handloom Cotton Saree with Silver Zari Checks');
      expect(meta.documentTitle).toBe('Black Handloom Cotton Saree with Silver Zari Checks | Groviews');
      expect(meta.description).toBe('View Black Handloom Cotton Saree with Silver Zari Checks at Groviews.');
      expect(meta.image).toBe('https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/black-cotton-checks.jpg');
      expect(meta.url).toBe('https://groviews.com/product/black-cotton-saree-silver-checks');
      expect(meta.type).toBe('product');
      expect(meta.siteName).toBe('Groviews');
    });

    it('supports activeImageIndex to select corresponding image', () => {
      const meta = getProductMeta(productA, { activeImageIndex: 1 });
      expect(meta.image).toBe('https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink-detail.jpg');
    });

    it('returns null when product is null or undefined', () => {
      expect(getProductMeta(null)).toBeNull();
      expect(getProductMeta(undefined)).toBeNull();
    });
  });

  describe('DOM manipulation: updateProductMeta and resetProductMeta', () => {
    it('updates document.title and inserts Open Graph and Twitter meta tags into head', () => {
      updateProductMeta(productA);

      expect(document.title).toBe('Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border | Groviews');

      const ogTitle = document.head.querySelector('meta[property="og:title"]');
      expect(ogTitle).not.toBeNull();
      expect(ogTitle.getAttribute('content')).toBe('Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border');

      const ogDesc = document.head.querySelector('meta[property="og:description"]');
      expect(ogDesc.getAttribute('content')).toBe('View Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border at Groviews.');

      const ogImg = document.head.querySelector('meta[property="og:image"]');
      expect(ogImg.getAttribute('content')).toBe('https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink.jpg');

      const ogSecureImg = document.head.querySelector('meta[property="og:image:secure_url"]');
      expect(ogSecureImg.getAttribute('content')).toBe('https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink.jpg');

      const ogWidth = document.head.querySelector('meta[property="og:image:width"]');
      expect(ogWidth.getAttribute('content')).toBe('1200');

      const ogUrl = document.head.querySelector('meta[property="og:url"]');
      expect(ogUrl.getAttribute('content')).toBe('https://groviews.com/product/rani-pink-kanjivaram-pattu-silk-saree');

      const ogType = document.head.querySelector('meta[property="og:type"]');
      expect(ogType.getAttribute('content')).toBe('product');

      const ogSite = document.head.querySelector('meta[property="og:site_name"]');
      expect(ogSite.getAttribute('content')).toBe('Groviews');

      const twitterCard = document.head.querySelector('meta[name="twitter:card"]');
      expect(twitterCard.getAttribute('content')).toBe('summary_large_image');
    });

    it('resets title and cleans up dynamic meta tags when resetProductMeta is called', () => {
      updateProductMeta(productA);
      expect(document.title).toContain('Rani Pink');
      expect(document.head.querySelectorAll('meta[data-dynamic-meta="true"]').length).toBeGreaterThan(0);

      resetProductMeta();
      expect(document.title).toBe(DEFAULT_PAGE_TITLE);
      expect(document.head.querySelectorAll('meta[data-dynamic-meta="true"]').length).toBe(0);
    });
  });
});
