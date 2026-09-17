import PDFDocument from 'pdfkit';
import { prisma } from '../../config/prisma';
import { AppError, BadRequestError, NotFoundError } from '../../utils/errors';
import { storageProvider } from '../../providers/storage';
import { fetchImageBuffer } from '../../utils/fetchImageBuffer';
import { logAuthEvent } from '../auth/auditLog.service';

// A customer-shareable PDF catalog per subcategory — one product photo per
// page on the "Nandam Soft Premium" brand skin (warm ivory ground, maroon +
// gold accents). Distinct from the barcode label PDFs in ../labels, which
// are for sticker sheets, not sharing with customers. Only in-stock products
// with a photo are included — out-of-stock products get neither a page nor
// an image.
//
// Each page carries the subcategory name once, at the top, and then the
// photo. Deliberately nothing else: the shop name (it is being sent by the
// shop, to a customer who is already talking to them), the name repeated
// under the photo, and the price are all off the page at the owner's
// request — prices move, and a shared PDF outlives the price it was
// generated with.

const PAGE_WIDTH = 595.28; // A4, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 26;
const CARD_RADIUS = 20;
// Breathing room between the photo and the bottom edge of the card.
const BOTTOM_INSET = 24;

const IVORY = '#FAF6F1';
const CARD_SHADOW = '#EFE6DC';
const MAROON = '#7A1F2B';
const GOLD = '#B07C2A';
const IMAGE_MAT = '#F6F1EB';

export interface CatalogItem {
  name: string;
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

// Exported so a caller with its own item list (name + image, not necessarily
// a real Subcategory row — e.g. a placeholder/preview catalog for photos not
// uploaded into the app yet) can reuse the exact approved rendering — same
// page per call as generateCatalogPdf below, no duplicated layout code.
export const renderCatalogPdf = async (items: CatalogItem[]): Promise<Buffer> => {
  const doc = new PDFDocument({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  items.forEach((item, index) => {
    if (index > 0) doc.addPage();
    const { contentX, contentWidth, y: bodyTop } = drawPageFrame(doc, item.name);

    // No caption block any more (see the header comment), so the photo runs
    // to the bottom of the card rather than stopping short of a footer.
    const imageBottom = MARGIN + (PAGE_HEIGHT - MARGIN * 2) - BOTTOM_INSET;
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


  const items: CatalogItem[] = [];
  for (const product of inStock) {
    try {
      const imageBuffer = await fetchImageBuffer(product.images[0]!.url);
      items.push({ name: subcategory.name, imageBuffer });
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
