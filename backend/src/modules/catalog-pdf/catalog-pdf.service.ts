import PDFDocument from 'pdfkit';
import { prisma } from '../../config/prisma';
import { COMPANY } from '../../config/company';
import { AppError, BadRequestError, NotFoundError } from '../../utils/errors';
import { storageProvider } from '../../providers/storage';
import { fetchImageBuffer } from '../../utils/fetchImageBuffer';
import { logAuthEvent } from '../auth/auditLog.service';

// A customer-shareable PDF catalog per subcategory — one product photo per
// page on the "Nandam Soft Premium" brand skin (warm ivory ground, maroon +
// gold accents), with the shop's logo+name on every page. Distinct from the
// barcode label PDFs in ../labels, which are for sticker sheets, not sharing
// with customers. Only in-stock products with a photo are included —
// out-of-stock products get neither a page nor an image. The caption under
// each photo is the subcategory's name, not the individual product's own
// name — this business prices and labels by subcategory (every product in
// one subcategory shares its price), and most products carry no name of
// their own beyond that (Product.name defaults to the subcategory's name
// unless staff type something more specific).

const PAGE_WIDTH = 595.28; // A4, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 26;
const CARD_RADIUS = 20;
const FOOTER_HEIGHT = 78;

const IVORY = '#FAF6F1';
const CARD_SHADOW = '#EFE6DC';
const MAROON = '#7A1F2B';
const GOLD = '#B07C2A';
const TEXT = '#241E1B';
const TEXT_MUTED = '#7C716A';
const IMAGE_MAT = '#F6F1EB';

export interface CatalogItem {
  name: string;
  storePrice: number;
  mrp: number | null;
  imageBuffer: Buffer;
}

/**
 * Ivory ground, gold-bordered rounded card, subcategory name as the header,
 * gold divider with a diamond accent.
 *
 * No logo: the subcategory name is what a customer is being shown, and the
 * mark above it only competed with it for the top of the page.
 */
const drawPageFrame = (doc: PDFKit.PDFDocument, subcategoryName: string) => {
  const cardX = MARGIN;
  const cardY = MARGIN;
  const cardW = PAGE_WIDTH - MARGIN * 2;
  const cardH = PAGE_HEIGHT - MARGIN * 2;
  const contentX = cardX + 24;
  const contentWidth = cardW - 48;

  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(IVORY);
  doc.roundedRect(cardX + 4, cardY + 6, cardW, cardH, CARD_RADIUS).fill(CARD_SHADOW);
  doc.roundedRect(cardX, cardY, cardW, cardH, CARD_RADIUS).fillAndStroke('#FFFFFF', GOLD);
  doc.lineWidth(1.2).roundedRect(cardX, cardY, cardW, cardH, CARD_RADIUS).stroke(GOLD);

  let y = cardY + 34;

  // The subcategory name is the headline now — large, maroon, letter-spaced,
  // and given room to wrap for the longer names in this catalog.
  doc
    .font('Times-Bold')
    .fontSize(23)
    .fillColor(MAROON)
    .text(subcategoryName.toUpperCase(), contentX, y, {
      width: contentWidth,
      align: 'center',
      characterSpacing: 1.6,
      lineGap: 2,
    });
  y = doc.y + 6;

  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(TEXT_MUTED)
    .text(COMPANY.name.toUpperCase(), contentX, y, { width: contentWidth, align: 'center', characterSpacing: 1.4 });
  y += 16;

  const dividerY = y;
  doc.moveTo(contentX, dividerY).lineTo(contentX + contentWidth / 2 - 10, dividerY).lineWidth(0.75).strokeColor(GOLD).stroke();
  doc.moveTo(contentX + contentWidth / 2 + 10, dividerY).lineTo(contentX + contentWidth, dividerY).lineWidth(0.75).strokeColor(GOLD).stroke();
  doc.save();
  doc.translate(contentX + contentWidth / 2, dividerY);
  doc.rotate(45);
  doc.rect(-3, -3, 6, 6).fill(GOLD);
  doc.restore();
  y += 18;

  return { contentX, contentWidth, y };
};

// Exported so a caller with its own item list (name + price + image, not
// necessarily a real Subcategory row — e.g. a placeholder/preview catalog
// for photos not uploaded into the app yet) can reuse the exact approved
// rendering — same page per call as generateCatalogPdf below, no
// duplicated layout code.
export const renderCatalogPdf = async (items: CatalogItem[]): Promise<Buffer> => {
  const doc = new PDFDocument({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  items.forEach((item, index) => {
    if (index > 0) doc.addPage();
    const { contentX, contentWidth, y: bodyTop } = drawPageFrame(doc, item.name);

    const imageBottom = MARGIN + (PAGE_HEIGHT - MARGIN * 2) - FOOTER_HEIGHT;
    const imageHeight = imageBottom - bodyTop;

    doc.roundedRect(contentX, bodyTop, contentWidth, imageHeight, 10).fill(IMAGE_MAT);
    try {
      doc.image(item.imageBuffer, contentX + 10, bodyTop + 10, {
        fit: [contentWidth - 20, imageHeight - 20],
        align: 'center',
        valign: 'center',
      });
    } catch (error) {
      console.error(`Failed to embed image for "${item.name}" in catalog PDF, skipping image:`, error);
    }

    let fy = imageBottom + 14;
    doc.font('Times-BoldItalic').fontSize(13).fillColor(TEXT).text(item.name, contentX, fy, { width: contentWidth, align: 'center' });
    fy += 20;

    const priceLabel = `Rs. ${item.storePrice.toLocaleString('en-IN')}`;
    const pillWidth = doc.font('Helvetica-Bold').fontSize(12).widthOfString(priceLabel) + 32;
    const pillX = contentX + (contentWidth - pillWidth) / 2;
    doc.roundedRect(pillX, fy, pillWidth, 22, 11).fill(MAROON);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#FFFFFF').text(priceLabel, pillX, fy + 5, { width: pillWidth, align: 'center' });

    if (item.mrp && item.mrp > item.storePrice) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(TEXT_MUTED)
        .text(`MRP Rs. ${item.mrp.toLocaleString('en-IN')}`, contentX, fy + 28, { width: contentWidth, align: 'center' });
    }
  });

  doc.end();
  return done;
};

export const getCatalogPdfStatus = async (subcategoryId: string) => {
  const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
  if (!subcategory) throw new NotFoundError('Subcategory not found');
  return prisma.subcategoryCatalogPdf.findUnique({ where: { subcategoryId } });
};

export const generateCatalogPdf = async (
  subcategoryId: string,
  actorId: string
): Promise<{ pdf: Buffer; productCount: number; url: string }> => {
  if (!storageProvider.isConfigured()) {
    throw new AppError('Catalog storage is not configured yet. Please contact support.', 503, 'STORAGE_NOT_CONFIGURED');
  }

  const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
  if (!subcategory) throw new NotFoundError('Subcategory not found');

  const products = await prisma.product.findMany({
    where: { subcategoryId, isActive: true },
    include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    orderBy: { createdAt: 'asc' },
  });
  const withImages = products.filter((p) => p.images.length > 0);

  // Only currently-available products get a page — same availability rule
  // as inventory.service.ts's getLowStock: legacy bulk stock plus however
  // many individually-barcoded pieces are still in_stock.
  const inStock: typeof withImages = [];
  for (const product of withImages) {
    const availablePieces = await prisma.piece.count({ where: { productId: product.id, status: 'in_stock' } });
    if (product.stock + availablePieces > 0) inStock.push(product);
  }
  if (inStock.length === 0) {
    throw new BadRequestError('This subcategory has no in-stock products with photos right now');
  }

  const storePrice = Number(subcategory.storePrice);
  const mrp = subcategory.mrp ? Number(subcategory.mrp) : null;

  const items: CatalogItem[] = [];
  for (const product of inStock) {
    try {
      const imageBuffer = await fetchImageBuffer(product.images[0]!.url);
      items.push({ name: subcategory.name, storePrice, mrp, imageBuffer });
    } catch (error) {
      console.error(`Failed to fetch photo for product ${product.id}, skipping from catalog:`, error);
    }
  }
  if (items.length === 0) {
    throw new BadRequestError('Could not load any product photos for this subcategory right now');
  }

  const pdf = await renderCatalogPdf(items);

  // Keep the old PDF's key so it can be deleted only after the new upload
  // succeeds — never leave a subcategory with zero live PDFs on a failure.
  const existing = await prisma.subcategoryCatalogPdf.findUnique({ where: { subcategoryId } });

  const uploaded = await storageProvider.upload({
    buffer: pdf,
    contentType: 'application/pdf',
    filename: `catalog-${subcategoryId}-${Date.now()}.pdf`,
    folder: 'catalogs',
  });

  const record = await prisma.subcategoryCatalogPdf.upsert({
    where: { subcategoryId },
    create: {
      subcategoryId,
      storageKey: uploaded.key,
      url: uploaded.url,
      productCount: items.length,
      generatedBy: actorId,
    },
    update: {
      storageKey: uploaded.key,
      url: uploaded.url,
      productCount: items.length,
      generatedAt: new Date(),
      generatedBy: actorId,
    },
  });

  if (existing?.storageKey) {
    storageProvider.deleteObject(existing.storageKey).catch((err) => {
      console.error('Failed to delete replaced subcategory catalog PDF from storage:', err);
    });
  }

  await logAuthEvent({
    authAccountId: actorId,
    eventType: 'subcategory_catalog_pdf_generated',
    source: 'staff_app',
    metadata: { subcategoryId, productCount: items.length },
  });

  return { pdf, productCount: items.length, url: record.url };
};
