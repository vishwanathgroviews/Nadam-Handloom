import { formatPrice } from './format.js';

/**
 * Canonical production Customer Web base URL.
 * Sourced from DEPLOYMENT.md and backend/.env.production.example.
 */
export const PRODUCTION_SITE_URL = 'https://nandamhandlooms.com';

/**
 * Configured dummy owner WhatsApp number for product inquiries.
 * Indian format (10-digit): 6301151166
 * Country code: 91
 * WhatsApp click-to-chat recipient format: 916301151166 (no +, no dashes, no spaces)
 */
export const OWNER_WHATSAPP_NUMBER = '6301151166';
export const OWNER_WHATSAPP_COUNTRY_CODE = '91';
export const DEFAULT_OWNER_WHATSAPP_RECIPIENT = '916301151166';

/**
 * Normalizes a phone number to WhatsApp international click-to-chat format (digits only, no +).
 * Defaults to Indian country code (91) for 10-digit mobile numbers.
 */
export function formatWhatsAppRecipient(phone) {
  if (!phone || typeof phone !== 'string') {
    return DEFAULT_OWNER_WHATSAPP_RECIPIENT;
  }
  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return DEFAULT_OWNER_WHATSAPP_RECIPIENT;
  }
  if (digits.length === 10) {
    return `${OWNER_WHATSAPP_COUNTRY_CODE}${digits}`;
  }
  return digits;
}

/**
 * Resolves the target recipient number for WhatsApp Click-to-Chat.
 * Priority:
 * 1. options.recipient / options.phone (explicit caller override)
 * 2. VITE_OWNER_WHATSAPP_NUMBER / VITE_WHATSAPP_NUMBER (environment variable)
 * 3. OWNER_WHATSAPP_NUMBER ('6301151166' -> '916301151166')
 */
export function getWhatsAppRecipient(options = {}) {
  const envPhone = (
    import.meta.env?.VITE_OWNER_WHATSAPP_NUMBER ||
    import.meta.env?.VITE_WHATSAPP_NUMBER ||
    ''
  ).trim();

  const raw = options.recipient || options.phone || envPhone || OWNER_WHATSAPP_NUMBER;
  return formatWhatsAppRecipient(raw);
}

/**
 * Returns whether a given URL string or origin points to a localhost/loopback address.
 */
export function isLocalhostUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/.*)?$/i.test(url.trim());
}

/**
 * Resolves the appropriate Customer Web base URL for the current environment.
 */
export function getSiteBaseUrl(options = {}) {
  const isProd = options.isProd !== undefined ? Boolean(options.isProd) : Boolean(import.meta.env?.PROD);
  const allowLocalhost = !isProd && Boolean(options.allowLocalhost);

  // 1. Explicit baseUrl in options
  if (options.baseUrl && typeof options.baseUrl === 'string') {
    const custom = options.baseUrl.trim().replace(/\/$/, '');
    if (!allowLocalhost && isLocalhostUrl(custom)) {
      return PRODUCTION_SITE_URL;
    }
    return custom;
  }

  // 2. Environment variable
  const envUrl = (
    import.meta.env?.VITE_SITE_URL ||
    import.meta.env?.VITE_PUBLIC_URL ||
    import.meta.env?.VITE_CUSTOMER_WEB_URL ||
    import.meta.env?.VITE_FRONTEND_URL ||
    ''
  ).trim().replace(/\/$/, '');

  if (envUrl) {
    if (!allowLocalhost && isLocalhostUrl(envUrl)) {
      return PRODUCTION_SITE_URL;
    }
    return envUrl;
  }

  const browserOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin.trim().replace(/\/$/, '')
      : '';

  const isLocal = isLocalhostUrl(browserOrigin);

  // When allowLocalhost is explicitly enabled, allow it
  if (allowLocalhost && browserOrigin) {
    return browserOrigin;
  }

  // In standard execution, if browserOrigin is a real non-localhost domain, use it
  if (browserOrigin && !isLocal) {
    return browserOrigin;
  }

  // WhatsApp messages must NEVER share localhost/127.0.0.1 URLs.
  // Always fall back to the canonical production URL.
  return PRODUCTION_SITE_URL;
}

/**
 * Resolves a raw image URL to a fully qualified absolute URL.
 * Preserves already-absolute URLs and resolves relative paths against site base URL.
 */
export function getAbsoluteImageUrl(rawImage, options = {}) {
  if (!rawImage || typeof rawImage !== 'string') return '';
  const trimmed = rawImage.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const baseUrl = getSiteBaseUrl(options);
  return `${baseUrl}/${trimmed.replace(/^\//, '')}`;
}

/**
 * Generates the public product detail page URL using the project's standard route (/product/:slug).
 * Ensures localhost is never used in production.
 */
export function getProductPageUrl(slug, options = {}) {
  const baseUrl = getSiteBaseUrl(options);
  const cleanSlug = String(slug || '').trim();
  if (cleanSlug) {
    return `${baseUrl}/product/${cleanSlug}`;
  }
  return baseUrl;
}

/**
 * Truncates a description string into a short meaningful excerpt.
 */
export function getShortProductDescription(product, maxLength = 80) {
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

/**
 * Builds the structured WhatsApp share message text dynamically from the product object.
 *
 * Required format:
 * <Product Name>
 *
 * Nadam Handloom
 * <Short Product Description>
 *
 * Product ID: <Product ID>
 * Barcode ID: <Barcode ID>        ← only if available
 * Price: ₹<Price>
 *
 * View Product
 * <Production Product URL>
 */
export function buildWhatsAppProductMessage(product, options = {}) {
  if (!product || typeof product !== 'object') return '';

  const name = (product.name || product.title || '').trim();
  const brand = 'Nadam Handloom';
  const shortDescription = getShortProductDescription(product, options.maxDescriptionLength ?? 80);

  // Product ID: prefers productId or SKU if available, falls back to id
  const rawProductId = product.productId || product.sku || product.id || '';
  const productId =
    typeof rawProductId === 'string' || typeof rawProductId === 'number'
      ? String(rawProductId).trim()
      : '';

  // Barcode ID: if available with a valid value from product or piece data
  const rawBarcode =
    product.barcodeId ||
    product.barcode ||
    product.pieces?.[0]?.barcode ||
    product.piece?.barcode ||
    '';
  const barcodeId =
    typeof rawBarcode === 'string' || typeof rawBarcode === 'number'
      ? String(rawBarcode).trim()
      : '';

  // Price formatting
  const rawPrice =
    product.subcategory?.onlinePrice ??
    product.onlinePrice ??
    product.price ??
    product.storePrice;
  let formattedPrice = '';
  if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
    const formatted = formatPrice(rawPrice);
    formattedPrice = formatted.startsWith('₹') ? formatted : `₹${formatted}`;
  }

  // Product URL resolution (environment-aware, never localhost in production)
  const productUrl = getProductPageUrl(product.slug, options);

  const sections = [];

  // 1. Product Name (no "Product:" prefix)
  if (name) {
    sections.push(name);
  }

  // 2. Business Name & Short Product Description
  if (shortDescription) {
    sections.push(`${brand}\n${shortDescription}`);
  } else {
    sections.push(brand);
  }

  // 3. Product ID, Barcode ID (only if available), and Price
  const detailLines = [];
  if (
    productId &&
    productId.toLowerCase() !== 'n/a' &&
    productId.toLowerCase() !== 'null' &&
    productId.toLowerCase() !== 'undefined'
  ) {
    detailLines.push(`Product ID: ${productId}`);
  }
  if (
    barcodeId &&
    barcodeId.toLowerCase() !== 'n/a' &&
    barcodeId.toLowerCase() !== 'null' &&
    barcodeId.toLowerCase() !== 'undefined'
  ) {
    detailLines.push(`Barcode ID: ${barcodeId}`);
  }
  if (formattedPrice) {
    detailLines.push(`Price: ${formattedPrice}`);
  }
  if (detailLines.length > 0) {
    sections.push(detailLines.join('\n'));
  }

  // 4. View Product and production product URL
  if (productUrl) {
    sections.push(`View Product\n${productUrl}`);
  }

  return sections.join('\n\n');
}

/**
 * Builds the complete click-to-chat WhatsApp share URL directed to the configured owner recipient.
 * Format: https://wa.me/916301151166?text=<ENCODED_MESSAGE>
 */
export function getWhatsAppShareUrl(product, options = {}) {
  const message = buildWhatsAppProductMessage(product, options);
  if (!message) return '';
  const recipient = getWhatsAppRecipient(options);
  return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
}

/**
 * Synchronous / baseline WhatsApp Click-to-Chat trigger.
 * Opens the WhatsApp Web/App click-to-chat conversation in a new tab.
 */
export function openWhatsAppShare(product, options = {}) {
  const url = getWhatsAppShareUrl(product, options);
  if (!url) return false;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}

/* ==========================================================================
   AUTOMATIC MEDIA DETECTION & MULTI-TYPE WHATSAPP SHARING
   ========================================================================== */

/**
 * Automatically detects the media type from the given input.
 * Returns one of:
 * - 'single-image'
 * - 'multiple-images'
 * - 'pdf'
 * - 'invoice-pdf'
 * - 'text'
 */
export function detectMediaType(input, options = {}) {
  if (options.mediaType) {
    return options.mediaType;
  }
  if (!input) return 'text';

  // 1. Invoice PDF Detection
  if (
    input.type === 'invoice' ||
    input.type === 'invoice-pdf' ||
    input.isInvoice ||
    (typeof input.invoiceNumber === 'string' && input.invoiceNumber.trim()) ||
    (typeof input.name === 'string' && /invoice/i.test(input.name) && input.name.toLowerCase().endsWith('.pdf')) ||
    (typeof input.url === 'string' && /invoice/i.test(input.url) && input.url.toLowerCase().split('?')[0].endsWith('.pdf')) ||
    (typeof input === 'string' && /invoice/i.test(input) && input.toLowerCase().split('?')[0].endsWith('.pdf'))
  ) {
    return 'invoice-pdf';
  }

  // 2. General PDF Document Detection
  if (
    input.type === 'pdf' ||
    input.documentType === 'pdf' ||
    (typeof input.type === 'string' && input.type.includes('application/pdf')) ||
    (typeof input.name === 'string' && input.name.toLowerCase().endsWith('.pdf')) ||
    (typeof input.url === 'string' && input.url.toLowerCase().split('?')[0].endsWith('.pdf')) ||
    (typeof input === 'string' && input.toLowerCase().split('?')[0].endsWith('.pdf'))
  ) {
    return 'pdf';
  }

  // 3. Array of Media Items
  if (Array.isArray(input)) {
    if (input.length === 0) return 'text';
    if (input.length === 1) return 'single-image';
    return 'multiple-images';
  }

  // 4. Product Object
  if (typeof input === 'object' && (input.slug || input.name || input.productId || input.sku)) {
    const images = Array.isArray(input.images)
      ? input.images
      : (input.imageUrl || input.image ? [input.imageUrl || input.image] : []);

    if (options.shareAllImages === true && images.length > 1) {
      return 'multiple-images';
    }
    if (images.length > 1 && !options.activeImageOnly && options.activeImageIndex === undefined) {
      return 'multiple-images';
    }
    if (images.length >= 1) {
      return 'single-image';
    }
    return 'text';
  }

  // 5. Image File / Blob / URL
  if (
    (typeof input.type === 'string' && input.type.startsWith('image/')) ||
    (typeof input.url === 'string' && /\.(jpe?g|png|webp|svg|gif)(\?.*)?$/i.test(input.url)) ||
    (typeof input === 'string' && (/\.(jpe?g|png|webp|svg|gif)(\?.*)?$/i.test(input) || /^data:image\//i.test(input))) ||
    input.type === 'image'
  ) {
    return 'single-image';
  }

  return 'text';
}

/**
 * Builds the standard WhatsApp message with direct PDF link for an invoice.
 *
 * Example format:
 * Nadam Handloom
 *
 * Invoice: INV-TEST-001
 * Total: ₹12,999
 *
 * View Invoice (PDF)
 * https://nandamhandlooms.com/invoices/invoice-INV-TEST-001.pdf
 */
export function buildInvoiceMessage(invoiceData = {}, options = {}) {
  const invoiceNumber = invoiceData.invoiceNumber || 'INV-TEST-001';
  const baseUrl = getSiteBaseUrl(options);

  const lines = ['Nadam Handloom', '', `Invoice: ${invoiceNumber}`];

  if (invoiceData.customerName) {
    lines.push(`Customer: ${invoiceData.customerName}`);
  }

  if (invoiceData.total !== undefined && invoiceData.total !== null && invoiceData.total !== '') {
    lines.push(`Total: ${formatPrice(invoiceData.total)}`);
  }

  const invoiceUrl = invoiceData.url
    ? getAbsoluteImageUrl(invoiceData.url, options)
    : `${baseUrl}/invoices/invoice-${invoiceNumber}.pdf`;

  lines.push('', 'View Invoice (PDF)', invoiceUrl);

  return lines.join('\n');
}

/**
 * Builds the standard WhatsApp message with direct PDF link for a catalogue document.
 *
 * Example format:
 * Nadam Handloom
 * Product Catalogue
 *
 * View Catalogue (PDF)
 * https://nandamhandlooms.com/catalogue/nadam-handloom-catalogue.pdf
 */
export function buildPdfMessage(pdfData = {}, options = {}) {
  const title = pdfData.title || pdfData.documentTitle || 'Product Catalogue';
  const baseUrl = getSiteBaseUrl(options);

  const pdfUrl = pdfData.url
    ? getAbsoluteImageUrl(pdfData.url, options)
    : `${baseUrl}/catalogue/nadam-handloom-catalogue.pdf`;

  return `Nadam Handloom\n${title}\n\nView Catalogue (PDF)\n${pdfUrl}`;
}

/**
 * Generates a valid standard PDF 1.4 Tax Invoice document using realistic dummy data.
 * Zero external dependencies: pure standard PDF construction.
 *
 * Dummy data structure:
 * - Invoice Number: INV-TEST-001
 * - Customer: Test Customer
 * - Product: Rani Pink Kanjivaram Pattu Silk Saree
 * - Product ID: NH-PS-001
 * - Quantity: 1
 * - Price: ₹12,999
 * - Total: ₹12,999
 */
export function generateDummyInvoicePdf(invoiceData = {}) {
  const invoiceNumber = invoiceData.invoiceNumber || 'INV-TEST-001';
  const customerName = invoiceData.customerName || 'Test Customer';
  const productName = invoiceData.productName || 'Rani Pink Kanjivaram Pattu Silk Saree';
  const productId = invoiceData.productId || 'NH-PS-001';
  const quantity = Number(invoiceData.quantity || 1);
  const price = Number(invoiceData.price || 12999);
  const total = Number(invoiceData.total || price * quantity);
  const dateStr = invoiceData.date || new Date().toLocaleDateString('en-IN');

  const escapePdfText = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  };

  const streamLines = [
    'BT',
    '/F2 20 Tf 50 780 Td (Nadam Handloom) Tj',
    '/F1 10 Tf 0 -20 Td (Authentic Handwoven Sarees - Mangalagiri, Andhra Pradesh) Tj',
    '/F1 9 Tf 0 -14 Td (GSTIN: 37AAAAA0000A1Z5 | Mobile: +91 6301151166) Tj',
    `/F2 13 Tf 0 -30 Td (TAX INVOICE: ${escapePdfText(invoiceNumber)}) Tj`,
    `/F1 10 Tf 0 -18 Td (Date: ${escapePdfText(dateStr)}) Tj`,
    `/F1 10 Tf 0 -16 Td (Customer: ${escapePdfText(customerName)}) Tj`,
    '/F1 10 Tf 0 -22 Td (----------------------------------------------------------------------------------------------------) Tj',
    '/F2 10 Tf 0 -16 Td (Product Description                     Product ID        Qty    Price          Total) Tj',
    '/F1 10 Tf 0 -14 Td (----------------------------------------------------------------------------------------------------) Tj',
    `/F1 10 Tf 0 -18 Td (${escapePdfText(productName.slice(0, 32).padEnd(35, ' '))}${escapePdfText(productId.padEnd(18, ' '))}${escapePdfText(String(quantity).padEnd(7, ' '))}${escapePdfText(('Rs. ' + price.toLocaleString('en-IN')).padEnd(15, ' '))}${escapePdfText('Rs. ' + total.toLocaleString('en-IN'))}) Tj`,
    '/F1 10 Tf 0 -18 Td (----------------------------------------------------------------------------------------------------) Tj',
    `/F2 12 Tf 0 -24 Td (Grand Total: Rs. ${escapePdfText(total.toLocaleString('en-IN'))}) Tj`,
    '/F1 9 Tf 0 -35 Td (This is a computer generated dummy tax invoice for Nadam Handloom.) Tj',
    '/F1 9 Tf 0 -14 Td (Thank you for your purchase! For WhatsApp support contact +91 6301151166.) Tj',
    'ET',
  ].join('\n');

  const streamBytes = new TextEncoder().encode(streamLines);

  let pdfString = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];

  function addObj(content) {
    offsets.push(new TextEncoder().encode(pdfString).length);
    pdfString += content;
  }

  addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  addObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  addObj('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n');
  addObj(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${streamLines}\nendstream\nendobj\n`);
  addObj('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  addObj('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');

  const startXref = new TextEncoder().encode(pdfString).length;
  pdfString += `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < offsets.length; i++) {
    pdfString += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfString += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  const blob = new Blob([new TextEncoder().encode(pdfString)], { type: 'application/pdf' });
  const filename = `invoice-${invoiceNumber}.pdf`;
  const file = typeof File !== 'undefined' ? new File([blob], filename, { type: 'application/pdf' }) : blob;

  return {
    blob,
    file,
    filename,
    invoiceNumber,
    customerName,
    productName,
    productId,
    quantity,
    price,
    total,
  };
}

/**
 * Generates a valid standard PDF 1.4 Product Catalogue document for testing.
 */
export function generateDummyCataloguePdf(catalogueData = {}) {
  const title = catalogueData.title || 'Product Catalogue';
  const filename = catalogueData.filename || 'nadam-handloom-catalogue.pdf';

  const escapePdfText = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  };

  const streamLines = [
    'BT',
    '/F2 22 Tf 50 780 Td (Nadam Handloom) Tj',
    `/F2 14 Tf 0 -24 Td (${escapePdfText(title)}) Tj`,
    '/F1 10 Tf 0 -18 Td (Handwoven Pure Silk & Pattu Sarees Collection) Tj',
    '/F1 10 Tf 0 -25 Td (Mangalagiri, Andhra Pradesh | Contact: +91 6301151166) Tj',
    '/F1 10 Tf 0 -22 Td (----------------------------------------------------------------------------------------------------) Tj',
    '/F2 11 Tf 0 -20 Td (Featured Handwoven Sarees:) Tj',
    '/F1 10 Tf 0 -18 Td (1. Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border - Rs. 12,999) Tj',
    '/F1 10 Tf 0 -16 Td (2. Pink Diamond Jaal Pattu Silk Saree with Peacock Motif Border - Rs. 12,999) Tj',
    '/F1 10 Tf 0 -16 Td (3. Magenta Pure Pattu Silk Saree with Pinstripe Checks - Rs. 12,999) Tj',
    '/F1 10 Tf 0 -25 Td (----------------------------------------------------------------------------------------------------) Tj',
    '/F1 9 Tf 0 -25 Td (Browse our complete collection online at https://nandamhandlooms.com) Tj',
    'ET',
  ].join('\n');

  const streamBytes = new TextEncoder().encode(streamLines);

  let pdfString = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];

  function addObj(content) {
    offsets.push(new TextEncoder().encode(pdfString).length);
    pdfString += content;
  }

  addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  addObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  addObj('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n');
  addObj(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${streamLines}\nendstream\nendobj\n`);
  addObj('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  addObj('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');

  const startXref = new TextEncoder().encode(pdfString).length;
  pdfString += `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < offsets.length; i++) {
    pdfString += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfString += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  const blob = new Blob([new TextEncoder().encode(pdfString)], { type: 'application/pdf' });
  const file = typeof File !== 'undefined' ? new File([blob], filename, { type: 'application/pdf' }) : blob;

  return { blob, file, filename };
}

/**
 * Triggers a programmatic browser download of a File or Blob.
 */
export function downloadFile(fileOrBlob, filename = 'document.pdf') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const url = URL.createObjectURL(fileOrBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || fileOrBlob.name || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches a media item (URL string, Blob, File, or Object) and resolves it to a File object.
 * Returns null if the item is invalid or cannot be fetched, allowing caller to gracefully skip.
 */
export async function fetchMediaAsFile(mediaItem, fallbackFilename = 'image.jpg', options = {}) {
  if (!mediaItem) return null;

  // 1. Already a File
  if (typeof File !== 'undefined' && mediaItem instanceof File) {
    return mediaItem;
  }

  // 2. Blob
  if (typeof Blob !== 'undefined' && mediaItem instanceof Blob) {
    const type = mediaItem.type || 'image/jpeg';
    return new File([mediaItem], fallbackFilename, { type });
  }

  // 3. Object with file or blob property
  if (typeof mediaItem === 'object') {
    if (typeof File !== 'undefined' && mediaItem.file instanceof File) {
      return mediaItem.file;
    }
    if (typeof Blob !== 'undefined' && mediaItem.blob instanceof Blob) {
      const type = mediaItem.blob.type || 'image/jpeg';
      return new File([mediaItem.blob], mediaItem.filename || fallbackFilename, { type });
    }
  }

  // 4. URL string or object with url property
  const rawUrl = typeof mediaItem === 'string' ? mediaItem : (mediaItem.url || mediaItem.secure_url || '');
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Data URL support
  if (trimmed.startsWith('data:')) {
    try {
      const res = await fetch(trimmed);
      const blob = await res.blob();
      return new File([blob], fallbackFilename, { type: blob.type || 'image/jpeg' });
    } catch {
      return null;
    }
  }

  // Remote HTTP/HTTPS URL
  const resolvedUrl = getAbsoluteImageUrl(trimmed, options);
  const cleanPath = resolvedUrl.split('?')[0].split('#')[0];
  const urlFilename = cleanPath.split('/').pop() || fallbackFilename;
  const filename = (mediaItem.filename || urlFilename).replace(/[^a-zA-Z0-9._-]/g, '_');

  const ext = filename.toLowerCase().split('.').pop();
  let mimeType = 'image/jpeg';
  if (ext === 'png') mimeType = 'image/png';
  else if (ext === 'webp') mimeType = 'image/webp';
  else if (ext === 'svg') mimeType = 'image/svg+xml';
  else if (ext === 'pdf') mimeType = 'application/pdf';

  if (typeof fetch === 'undefined') {
    return null;
  }

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), options.timeoutMs ?? 10000);

    const response = await fetch(resolvedUrl, {
      signal: controller?.signal,
      mode: 'cors',
      credentials: 'omit',
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const finalType = blob.type && blob.type !== 'application/octet-stream' ? blob.type : mimeType;
    return new File([blob], filename, { type: finalType });
  } catch {
    return null;
  }
}

/**
 * Checks whether the current browser/device supports Web Share API with files.
 */
export function canShareFiles(files) {
  if (!files || (Array.isArray(files) && files.length === 0)) return false;
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  const fileArray = Array.isArray(files) ? files : [files];
  try {
    return navigator.canShare({ files: fileArray });
  } catch {
    return false;
  }
}

/**
 * Unified WhatsApp sharing utility that automatically detects media type:
 * 1. Single Image
 * 2. Multiple Images
 * 3. PDF
 * 4. Invoice PDF
 *
 * Direct media sharing via Web Share API is prioritized on supporting devices/browsers.
 * When direct file sharing is unsupported or fails, falls back gracefully to
 * WhatsApp Click-to-Chat with pre-filled message, preserving all existing functionality.
 */
export async function shareToWhatsApp(input, options = {}) {
  const mediaType = detectMediaType(input, options);
  let filesToShare = [];
  let caption = '';
  let title = 'Nadam Handloom';
  let product = null;

  // 1. Invoice PDF Sharing
  if (mediaType === 'invoice-pdf') {
    title = 'Invoice';
    caption = options.caption || buildInvoiceMessage(input, options);

    if (typeof File !== 'undefined' && input instanceof File) {
      filesToShare = [input];
    } else if (input && typeof File !== 'undefined' && input.file instanceof File) {
      filesToShare = [input.file];
    } else {
      const dummy = generateDummyInvoicePdf(input || {});
      filesToShare = [dummy.file];
    }
  }

  // 2. General PDF Document Sharing
  else if (mediaType === 'pdf') {
    title = input?.title || 'Product Catalogue';
    caption = options.caption || buildPdfMessage(input, options);

    if (typeof File !== 'undefined' && input instanceof File) {
      filesToShare = [input];
    } else if (input && typeof File !== 'undefined' && input.file instanceof File) {
      filesToShare = [input.file];
    } else if (typeof input === 'string' || input?.url) {
      const fetched = await fetchMediaAsFile(input, input?.filename || 'document.pdf', options);
      if (fetched) {
        filesToShare = [fetched];
      }
    } else {
      const dummy = generateDummyCataloguePdf(input || {});
      filesToShare = [dummy.file];
    }
  }

  // 3. Multiple Images Sharing
  else if (mediaType === 'multiple-images') {
    let rawImages = [];
    if (Array.isArray(input)) {
      rawImages = input;
    } else if (input && Array.isArray(input.images)) {
      product = input;
      rawImages = input.images;
    }

    if (product) {
      title = product.name || 'Nadam Handloom';
      caption = options.caption || buildWhatsAppProductMessage(product, options);
    } else {
      caption = options.caption || '';
    }

    // Deduplicate while strictly preserving order
    const seen = new Set();
    const uniqueItems = [];
    for (const item of rawImages) {
      const u = typeof item === 'string' ? item : (item?.url || item?.secure_url || '');
      if (u) {
        if (!seen.has(u)) {
          seen.add(u);
          uniqueItems.push(item);
        }
      } else if (item) {
        uniqueItems.push(item);
      }
    }

    const fetchedFiles = [];
    for (let i = 0; i < uniqueItems.length; i++) {
      const item = uniqueItems[i];
      const fallbackName = `${product?.slug || 'product'}-${i + 1}.jpg`;
      const f = await fetchMediaAsFile(item, fallbackName, options);
      if (f) {
        fetchedFiles.push(f);
      }
    }
    filesToShare = fetchedFiles;
  }

  // 4. Single Image Sharing
  else if (mediaType === 'single-image') {
    let rawItem = input;
    if (input && (input.images || input.slug)) {
      product = input;
      const idx = options.activeImageIndex ?? 0;
      rawItem = input.images?.[idx] || input.images?.[0] || input.imageUrl || input.image;
      title = product.name || 'Nadam Handloom';
      caption = options.caption || buildWhatsAppProductMessage(product, options);
    } else {
      caption = options.caption || '';
    }

    const fallbackName = `${product?.slug || 'product'}-1.jpg`;
    const f = await fetchMediaAsFile(rawItem, fallbackName, options);
    if (f) {
      filesToShare = [f];
    }
  }

  // 5. Text-Only Sharing
  else {
    if (input && (input.name || input.slug)) {
      product = input;
      title = product.name || 'Nadam Handloom';
      caption = options.caption || buildWhatsAppProductMessage(product, options);
    } else {
      caption = options.caption || String(input || '');
    }
  }

  // Attempt Direct Media Share via Web Share API
  if (filesToShare.length > 0 && canShareFiles(filesToShare)) {
    try {
      await navigator.share({
        title,
        text: caption,
        files: filesToShare,
      });
      return {
        success: true,
        method: 'web-share',
        mediaType,
        sharedCount: filesToShare.length,
        files: filesToShare,
        caption,
      };
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') {
        return {
          success: false,
          cancelled: true,
          method: 'web-share',
          mediaType,
        };
      }
      // Native sharing failed, proceed to fallback
    }
  }

  // Fallback Flow (when direct file share is unsupported or failed)
  // For PDFs & Invoices, trigger download so the customer has the file ready to attach
  if ((mediaType === 'invoice-pdf' || mediaType === 'pdf') && filesToShare.length > 0) {
    downloadFile(filesToShare[0], filesToShare[0].name);
  }

  const fallbackMessage = caption;

  const recipient = getWhatsAppRecipient(options);
  const waUrl = `https://wa.me/${recipient}?text=${encodeURIComponent(fallbackMessage)}`;
  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  return {
    success: true,
    method: 'fallback-click-to-chat',
    mediaType,
    url: waUrl,
    downloaded: mediaType.includes('pdf'),
    files: filesToShare,
    caption: fallbackMessage,
  };
}
