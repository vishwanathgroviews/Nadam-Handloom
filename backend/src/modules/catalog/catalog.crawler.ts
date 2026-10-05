import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import * as catalogService from './catalog.service';

export const CRAWLER_USER_AGENTS = [
  'facebookexternalhit',
  'WhatsApp',
  'Facebot',
  'Twitterbot',
  'TelegramBot',
  'LinkedInBot',
  'Discordbot',
  'Slackbot',
];

export function isCrawlerRequest(userAgent?: string): boolean {
  if (!userAgent) return false;
  const lower = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((crawler) => lower.includes(crawler.toLowerCase()));
}

export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getShortProductDescription(product: any, maxLength = 80): string {
  if (!product || typeof product !== 'object') return '';
  const raw =
    product.shortDescription ||
    product.description ||
    product.subcategory?.description ||
    product.category?.description ||
    '';
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const sliced = cleaned.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');
  const truncated = lastSpace > 20 ? sliced.slice(0, lastSpace) : sliced;
  const stripped = truncated.replace(/[.,;:\-\s]+$/, '');
  return `${stripped} ...`;
}

const isLocalhost = (url?: string) =>
  !url || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(url.trim());

export function buildOpenGraphMetaTags(product: any, siteUrl = 'https://groviews.com'): string {
  if (!product) return '';

  const name = escapeHtml(product.name || 'Handloom Product');
  const shortDescription = escapeHtml(
    getShortProductDescription(product, 80) || `View ${name} at Groviews.`
  );
  const slug = encodeURIComponent(product.slug || '');
  const canonicalBase = (siteUrl && !isLocalhost(siteUrl) ? siteUrl : 'https://groviews.com').replace(/\/$/, '');
  const url = `${canonicalBase}/product/${slug}`;

  const rawImage = product.images?.[0]?.url || product.imageUrl || '';
  let imageUrl = typeof rawImage === 'string' ? rawImage.trim() : '';
  if (imageUrl) {
    if (isLocalhost(imageUrl)) {
      imageUrl = imageUrl.replace(/^https?:\/\/[^/]+/i, canonicalBase);
    } else if (!/^https?:\/\//i.test(imageUrl)) {
      const cleanPath = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      imageUrl = `${canonicalBase}${cleanPath}`;
    }
  }
  const escapedImageUrl = escapeHtml(imageUrl) || `${canonicalBase}/og-image.png`;

  return [
    `<meta property="og:title" content="${name}" />`,
    `<meta property="og:description" content="${shortDescription}" />`,
    `<meta property="og:image" content="${escapedImageUrl}" />`,
    `<meta property="og:image:secure_url" content="${escapedImageUrl}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${name}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:site_name" content="Groviews" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${name}" />`,
    `<meta name="twitter:description" content="${shortDescription}" />`,
    `<meta name="twitter:image" content="${escapedImageUrl}" />`,
  ]
    .filter(Boolean)
    .join('\n    ');
}

export function injectProductMetaIntoHtml(html: string, product: any, siteUrl = 'https://groviews.com'): string {
  const metaTags = buildOpenGraphMetaTags(product, siteUrl);
  const title = `${escapeHtml(product.name)} | Groviews`;

  // Replace existing <title>
  let modified = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);

  // Insert Open Graph tags right before </head>
  if (modified.includes('</head>')) {
    modified = modified.replace('</head>', `    ${metaTags}\n  </head>`);
  } else {
    modified = `${metaTags}\n${modified}`;
  }

  return modified;
}

const DEFAULT_HTML_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Groviews — Handwoven Sarees & Apparel</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

export const handleProductPage = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  try {
    const product = await catalogService.getProductBySlug(slug);

    const candidates = [
      process.env.CUSTOMER_WEB_DIST_PATH,
      path.resolve(process.cwd(), '../frontend/customer-web/dist/index.html'),
      path.resolve(process.cwd(), '../frontend/customer-web/index.html'),
      path.resolve(__dirname, '../../../../frontend/customer-web/dist/index.html'),
      path.resolve(__dirname, '../../../../frontend/customer-web/index.html'),
      '/var/www/groviews/app/frontend/customer-web/dist/index.html',
    ].filter(Boolean) as string[];
    const templatePath = candidates.find((p) => fs.existsSync(p));
    const baseHtml = templatePath ? fs.readFileSync(templatePath, 'utf8') : DEFAULT_HTML_TEMPLATE;

    const siteUrl = !isLocalhost(process.env.FRONTEND_URL)
      ? (process.env.FRONTEND_URL as string)
      : 'https://groviews.com';
    const enrichedHtml = injectProductMetaIntoHtml(baseHtml, product, siteUrl);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(enrichedHtml);
  } catch (error) {
    const fallbackPath = path.resolve(process.cwd(), '../frontend/customer-web/dist/index.html');
    if (fs.existsSync(fallbackPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).sendFile(fallbackPath);
    }
    return res.status(404).send('Product not found');
  }
};
