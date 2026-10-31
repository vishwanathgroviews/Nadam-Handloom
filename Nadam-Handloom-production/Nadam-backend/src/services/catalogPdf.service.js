// Catalogue PDF (Module 3, section 6.5): one A4 page per product that is active,
// has a photo and is in stock, oldest first. Each page: the subcategory name, the
// tag numbers of its in-stock pieces ("ID: 3136, 3137") and the photo. No price, no
// shop name. Same design as the old backend's PDFs, which customers already know.
// The client (23 Oct 2026): nothing the customer receives may name the shop or hint at it:
// not the file's name, not the message sent with it, not the PDF's own properties.
import { shopDetails } from './settings.service.js';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import * as Catalog from '../models/catalog.model.js';
import { storage } from './storage/index.js';
import { audit } from './audit.service.js';
import { badRequest, notFound } from '../utils/errors.js';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 26;
const CARD_RADIUS = 20;
const BOTTOM_INSET = 24;
const IVORY = '#FAF6F1';
const CARD_SHADOW = '#EFE6DC';
const MAROON = '#7A1F2B';
const GOLD = '#B07C2A';
const IMAGE_MAT = '#F6F1EB';

// The number customers quote: "3136" for the tag "NANDAM3136"; codes without a letter prefix in full.
export function tagNumber(barcode) {
  const code = String(barcode).replace(/\s+/g, '').toUpperCase();
  const m = /^[A-Z]+([0-9]+)$/.exec(code);
  return m ? m[1] : code;
}

function drawFrame(doc, title) {
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
  doc.font('Times-Bold').fontSize(23).fillColor(MAROON).text(title.toUpperCase(), contentX, y, { width: contentWidth, align: 'center', characterSpacing: 1.6, lineGap: 2 });
  y = doc.y + 6;
  doc.moveTo(contentX, y).lineTo(contentX + contentWidth / 2 - 10, y).lineWidth(0.75).strokeColor(GOLD).stroke();
  doc.moveTo(contentX + contentWidth / 2 + 10, y).lineTo(contentX + contentWidth, y).lineWidth(0.75).strokeColor(GOLD).stroke();
  doc.save().translate(contentX + contentWidth / 2, y).rotate(45).rect(-3, -3, 6, 6).fill(GOLD).restore();
  return { contentX, contentWidth, y: y + 18 };
}

export function renderPdf(items) {
  // The PDF's own properties: only the subcategory's name (PDFKit adds its own name as the maker).
  const doc = new PDFDocument({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0, info: { Title: items[0]?.title || 'Catalogue' } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  items.forEach((item, i) => {
    if (i > 0) doc.addPage();
    const { contentX, contentWidth, y } = drawFrame(doc, item.title);
    let top = y;
    if (item.ids) {
      doc.font('Helvetica-Bold').fontSize(13).fillColor(MAROON).text(`ID: ${item.ids}`, contentX, top - 6, { width: contentWidth, align: 'center', characterSpacing: 0.8 });
      top = doc.y + 8;
    }
    const bottom = MARGIN + (PAGE_HEIGHT - MARGIN * 2) - BOTTOM_INSET;
    doc.roundedRect(contentX, top, contentWidth, bottom - top, 10).fill(IMAGE_MAT);
    try {
      doc.image(item.image, contentX + 10, top + 10, { fit: [contentWidth - 20, bottom - top - 20], align: 'center', valign: 'center' });
    } catch (e) {
      console.error(`[catalogue-pdf] photo could not be placed: ${e.message}`);
    }
  });
  doc.end();
  return done;
}

// A product photo: our own stored file when it's one, else its public address
// (old seed-time paths like /images/x.jpg are on the website).
async function loadPhoto(url) {
  const own = await storage().readByUrl(url);
  if (own) return own;
  const site = (await shopDetails()).website; // Module 11 settings, else the server setting
  const abs = /^https?:\/\//i.test(url) ? url : site ? `${site}${url}` : null;
  if (!abs) throw new Error('no address for this photo');
  const res = await fetch(abs, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`photo download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// The shared file's name: the subcategory's name only ("GAP BORDER DIGITAL PRINT SAREES.pdf").
// A file name can't hold / \ : * ? " < > |: slashes become dashes ("150/50 PLAIN SAREE" →
// "150-50 PLAIN SAREE.pdf"), the others are left out.
export function catalogueFileName(name) {
  const clean = String(name ?? '')
    .replace(/[\\/]+/g, '-')
    .replace(/[:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')
    .slice(0, 120)
    .trim();
  return `${clean || 'Catalogue'}.pdf`;
}

// File name and WhatsApp caption for sharing a subcategory's PDF: no shop name (client's request).
export const shareInfo = (name) => ({
  fileName: catalogueFileName(name),
  caption: `${String(name ?? '').trim()}. Please tell us the ID number of the piece you like.`,
});

export async function makeCataloguePdf({ viewer, id, ctx }) {
  const s = await Catalog.findSubcategory(id);
  if (!s) throw notFound('NOT_FOUND', 'This subcategory isn\'t in the catalogue any more.');
  const products = (await Catalog.pdfProducts(id)).filter((p) => p.images.length && p.stock + p.pieces.length > 0);
  if (!products.length) throw badRequest('NOTHING_TO_SHOW', 'No sarees in this subcategory are in stock with a photo right now.');
  const items = [];
  for (const p of products) {
    try {
      items.push({ title: s.name, image: await loadPhoto(p.images[0].url), ids: p.pieces.map((x) => tagNumber(x.barcode)).join(', ') || null });
    } catch (e) {
      console.error(`[catalogue-pdf] skipped product ${p.id}: ${e.message}`);
    }
  }
  if (!items.length) throw badRequest('PHOTOS_UNAVAILABLE', 'The product photos could not be loaded right now. Please try again.');
  const pdf = await renderPdf(items);
  const stored = await storage().upload({ buffer: pdf, contentType: 'application/pdf', folder: 'catalogs', ext: 'pdf' });
  const old = s.catalogPdf;
  const record = await prisma.subcategoryCatalogPdf.upsert({
    where: { subcategoryId: id },
    create: { subcategoryId: id, storageKey: stored.key, url: stored.url, productCount: items.length, generatedBy: viewer.id },
    update: { storageKey: stored.key, url: stored.url, productCount: items.length, generatedAt: new Date(), generatedBy: viewer.id },
  });
  if (old?.storageKey) storage().remove(old.storageKey).catch((e) => console.error(`[catalogue-pdf] could not remove ${old.storageKey}: ${e.message}`));
  await audit('subcategory_catalog_pdf_generated', { accountId: viewer.id, ctx, metadata: { subcategoryId: id, productCount: items.length, skipped: products.length - items.length, actorId: viewer.id } });
  return {
    catalogue: { url: record.url, productCount: record.productCount, generatedAt: record.generatedAt.toISOString(), ...shareInfo(s.name) },
  };
}
