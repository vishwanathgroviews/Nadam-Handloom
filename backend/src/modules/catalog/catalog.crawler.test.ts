import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

import * as prismaModule from '../../config/prisma';
import { seedCatalogFixture } from '../../test/fakePrisma';
import app from '../../app';
import {
  isCrawlerRequest,
  escapeHtml,
  buildOpenGraphMetaTags,
  injectProductMetaIntoHtml,
} from './catalog.crawler';

const fake = (prismaModule as any).__fake;

describe('catalog.crawler — Open Graph metadata for WhatsApp and crawlers', () => {
  const sampleProduct = {
    name: 'Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border',
    slug: 'rani-pink-kanjivaram-pattu-silk-saree',
    images: [
      { url: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink.jpg' },
    ],
  };

  beforeEach(() => {
    for (const key of Object.keys(fake.db)) fake.db[key] = [];
    seedCatalogFixture(fake.db);
  });

  it('detects WhatsApp and other link preview crawler User-Agents', () => {
    expect(isCrawlerRequest('WhatsApp/2.21.12.21 A')).toBe(true);
    expect(isCrawlerRequest('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true);
    expect(isCrawlerRequest('Facebot')).toBe(true);
    expect(isCrawlerRequest('Twitterbot/1.0')).toBe(true);
    expect(isCrawlerRequest('TelegramBot (like TwitterBot)')).toBe(true);
    expect(isCrawlerRequest('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')).toBe(false);
    expect(isCrawlerRequest(undefined)).toBe(false);
  });

  it('escapes HTML special characters properly', () => {
    expect(escapeHtml('Silk & Zari <Peacock> "Special" \'Edition\'')).toBe(
      'Silk &amp; Zari &lt;Peacock&gt; &quot;Special&quot; &#039;Edition&#039;'
    );
  });

  it('builds complete Open Graph and Twitter meta tags matching requirements', () => {
    const meta = buildOpenGraphMetaTags(sampleProduct);

    expect(meta).toContain('<meta property="og:title" content="Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border" />');
    expect(meta).toContain('<meta property="og:description" content="View Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border at Groviews." />');
    expect(meta).toContain('<meta property="og:image" content="https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink.jpg" />');
    expect(meta).toContain('<meta property="og:image:secure_url" content="https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink.jpg" />');
    expect(meta).toContain('<meta property="og:image:width" content="1200" />');
    expect(meta).toContain('<meta property="og:image:height" content="630" />');
    expect(meta).toContain('<meta property="og:url" content="https://groviews.com/product/rani-pink-kanjivaram-pattu-silk-saree" />');
    expect(meta).toContain('<meta property="og:type" content="product" />');
    expect(meta).toContain('<meta property="og:site_name" content="Groviews" />');
    expect(meta).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(meta).toContain('<meta name="twitter:title" content="Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border" />');
  });

  it('injects metadata into HTML and replaces title', () => {
    const baseHtml = '<html><head><title>Default Title</title></head><body><div id="root"></div></body></html>';
    const result = injectProductMetaIntoHtml(baseHtml, sampleProduct);

    expect(result).toContain('<title>Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border | Groviews</title>');
    expect(result).not.toContain('<title>Default Title</title>');
    expect(result).toContain('property="og:image"');
  });

  it('serves HTML with Open Graph tags via GET /product/:slug', async () => {
    const res = await request(app).get('/product/rani-pink-kanjivaram');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('property="og:title"');
    expect(res.text).toContain('property="og:image"');
    expect(res.text).toContain('https://groviews.com/product/rani-pink-kanjivaram');
    expect(res.text).toContain('Groviews');
  });

  it('returns 404 for nonexistent product slug', async () => {
    const res = await request(app).get('/product/nonexistent-saree-slug-404');
    expect(res.status).toBe(404);
  });
});
