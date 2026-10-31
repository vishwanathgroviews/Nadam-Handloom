// A test server shares the shop's S3 bucket: every new file goes under its folder, and it
// never deletes a file outside that folder (its copied data points at live photos).
import { describe, it, expect } from 'vitest';
import { s3Storage } from '../../src/services/storage/s3.js';

const fakeClient = () => {
  const sent = [];
  return { sent, send: async (cmd) => { sent.push({ name: cmd.constructor.name, key: cmd.input.Key }); return {}; } };
};

describe('S3 storage with a folder prefix (test server)', () => {
  it('uploads under the prefix, with the public address', async () => {
    const client = fakeClient();
    const s = s3Storage({ bucket: 'shop-media', region: 'ap-south-1', prefix: 'v2-test', client });
    const r = await s.upload({ buffer: Buffer.from('x'), contentType: 'image/jpeg', folder: 'products', ext: 'jpg' });
    expect(r.key).toMatch(/^v2-test\/products\/[0-9a-f-]{36}\.jpg$/);
    expect(r.url).toBe(`https://shop-media.s3.ap-south-1.amazonaws.com/${r.key}`);
    expect(client.sent).toEqual([{ name: 'PutObjectCommand', key: r.key }]);
  });

  it('deletes its own files only; a live photo key is kept', async () => {
    const client = fakeClient();
    const s = s3Storage({ bucket: 'shop-media', region: 'ap-south-1', prefix: 'v2-test', client });
    expect(await s.remove('v2-test/products/a.jpg')).toBe(true);
    expect(await s.remove('products/live-photo.jpg')).toBe(false);
    expect(await s.remove('v2-testing/products/b.jpg')).toBe(false);
    expect(await s.remove('catalogs/x.pdf')).toBe(false);
    expect(client.sent).toEqual([{ name: 'DeleteObjectCommand', key: 'v2-test/products/a.jpg' }]);
  });

  it('without a prefix (the real server): the usual folders, deletes as before', async () => {
    const client = fakeClient();
    const s = s3Storage({ bucket: 'shop-media', region: 'ap-south-1', client });
    const r = await s.upload({ buffer: Buffer.from('x'), contentType: 'application/pdf', folder: 'invoices', ext: 'pdf' });
    expect(r.key).toMatch(/^invoices\//);
    expect(await s.remove('products/p.jpg')).toBe(true);
  });
});
