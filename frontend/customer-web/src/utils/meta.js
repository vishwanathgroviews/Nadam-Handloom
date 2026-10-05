import { PRODUCTION_SITE_URL, getShortProductDescription } from './whatsapp';

export const DEFAULT_PAGE_TITLE = 'Groviews — Handwoven Sarees Online';
export const DEFAULT_SITE_NAME = 'Groviews';

/**
 * Resolves a product's primary image to an absolute URL suitable for Open Graph crawlers.
 * Guarantees that localhost URLs are never used.
 */
export function resolveProductImageUrl(imageInput, siteUrl = PRODUCTION_SITE_URL) {
  if (!imageInput) return '';

  const rawUrl = typeof imageInput === 'string' ? imageInput : imageInput.url;
  if (!rawUrl || typeof rawUrl !== 'string') return '';

  const trimmed = rawUrl.trim();
  const base = (siteUrl || PRODUCTION_SITE_URL).replace(/\/$/, '');

  // Strictly avoid localhost in Open Graph metadata
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(trimmed)) {
    return trimmed.replace(/^https?:\/\/[^/]+/i, base);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${cleanPath}`;
}

/**
 * Builds the canonical Open Graph and Twitter metadata object for a product.
 * Used by both client-side DOM updates and server-side crawler rendering.
 */
export function getProductMeta(product, options = {}) {
  if (!product) {
    return null;
  }

  const name = (product.name || product.title || 'Handloom Product').trim();
  const slug = product.slug || '';
  const siteUrl = (options.siteUrl || PRODUCTION_SITE_URL).replace(/\/$/, '');
  const productUrl = `${siteUrl}/product/${slug}`;

  const activeIndex = typeof options.activeImageIndex === 'number' ? options.activeImageIndex : 0;
  const imageObj = Array.isArray(product.images)
    ? product.images[activeIndex] || product.images[0]
    : null;
  const imageUrl = resolveProductImageUrl(imageObj || product.imageUrl, siteUrl);

  const title = name;
  const documentTitle = `${name} | ${DEFAULT_SITE_NAME}`;
  const description =
    getShortProductDescription(product, 80) || `View ${name} at ${DEFAULT_SITE_NAME}.`;

  return {
    title,
    documentTitle,
    description,
    image: imageUrl,
    url: productUrl,
    type: 'product',
    siteName: DEFAULT_SITE_NAME,
    twitterCard: 'summary_large_image',
  };
}

/**
 * Sets or updates a <meta> tag in document.head.
 * @param {string} attrName 'property' or 'name'
 * @param {string} attrValue e.g. 'og:title'
 * @param {string} content
 */
function setMetaTag(attrName, attrValue, content) {
  if (typeof document === 'undefined') return;

  let element = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    element.setAttribute('data-dynamic-meta', 'true');
    document.head.appendChild(element);
  }
  element.setAttribute('content', content || '');
}

/**
 * Dynamically updates document.title and Open Graph / Twitter meta tags in the DOM.
 */
export function updateProductMeta(product, activeImageIndex = 0, options = {}) {
  if (typeof document === 'undefined' || !product) return;

  const meta = getProductMeta(product, { ...options, activeImageIndex });
  if (!meta) return;

  document.title = meta.documentTitle || `${meta.title} | ${DEFAULT_SITE_NAME}`;

  // Open Graph metadata
  setMetaTag('property', 'og:title', meta.title);
  setMetaTag('property', 'og:description', meta.description);
  setMetaTag('property', 'og:image', meta.image);
  if (meta.image) {
    setMetaTag('property', 'og:image:secure_url', meta.image);
    setMetaTag('property', 'og:image:type', 'image/jpeg');
    setMetaTag('property', 'og:image:width', '1200');
    setMetaTag('property', 'og:image:height', '630');
    setMetaTag('property', 'og:image:alt', meta.title);
  }
  setMetaTag('property', 'og:url', meta.url);
  setMetaTag('property', 'og:type', meta.type);
  setMetaTag('property', 'og:site_name', meta.siteName);

  // Twitter metadata
  setMetaTag('name', 'twitter:card', meta.twitterCard);
  setMetaTag('name', 'twitter:title', meta.title);
  setMetaTag('name', 'twitter:description', meta.description);
  if (meta.image) {
    setMetaTag('name', 'twitter:image', meta.image);
  }
}

/**
 * Resets document.title and removes dynamically injected product meta tags on unmount.
 */
export function resetProductMeta() {
  if (typeof document === 'undefined') return;

  document.title = DEFAULT_PAGE_TITLE;

  const dynamicTags = document.head.querySelectorAll('meta[data-dynamic-meta="true"]');
  dynamicTags.forEach((tag) => tag.remove());
}
