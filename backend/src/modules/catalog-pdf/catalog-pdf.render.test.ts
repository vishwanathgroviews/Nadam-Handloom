import { describe, expect, it } from 'vitest';
import { renderCatalogPdf } from './catalog-pdf.service';

// A real (tiny) PNG, so the image embed succeeds and the page composes the
// way it does in production rather than falling into the error path.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFUlEQVR4nGP8//8/AzJgYkAFgxwAAJ1OAx8v1nMIAAAAAElFTkSuQmCC',
  'base64'
);

/**
 * PDFKit deflates its content streams, so the bytes of the file say nothing
 * about what is printed on the page — pdfjs has to lay the page out to
 * answer that. Worth the dev dependency: this catalog is sent to customers,
 * and "what text is on it" is exactly the thing the owner asked us to change.
 */
const textOf = async (pdf: Buffer): Promise<string> => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
  let out = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    out += content.items.map((item: any) => item.str).join('') + '\n';
  }
  return out;
};

describe('catalog PDF page content', () => {
  it('prints the subcategory name and nothing else', async () => {
    const text = await textOf(await renderCatalogPdf([{ name: 'Handloom Pattu Saree', imageBuffer: PNG }]));

    expect(text).toContain('HANDLOOM PATTU SAREE');
    // The shop name was removed from the page: this PDF is sent by the shop
    // to someone already talking to them, so it only competed with the
    // subcategory heading.
    expect(text).not.toMatch(/nandam/i);
    // Prices move, and a shared PDF outlives the price it was generated with.
    expect(text).not.toMatch(/rs\.?\s/i);
    expect(text).not.toMatch(/mrp/i);
    // The name used to be repeated again under the photo.
    expect(text.match(/HANDLOOM PATTU SAREE/g)).toHaveLength(1);
  });

  it('gives every item its own page', async () => {
    const pdf = await renderCatalogPdf([
      { name: 'Cotton Saree', imageBuffer: PNG },
      { name: 'Pattu Saree', imageBuffer: PNG },
    ]);
    const text = await textOf(pdf);

    expect(text).toContain('COTTON SAREE');
    expect(text).toContain('PATTU SAREE');
    expect(text.trim().split('\n')).toHaveLength(2);
  });

  it('still produces a page when the photo cannot be embedded', async () => {
    const pdf = await renderCatalogPdf([{ name: 'Broken Photo', imageBuffer: Buffer.from('not an image') }]);
    expect(await textOf(pdf)).toContain('BROKEN PHOTO');
  });
});
