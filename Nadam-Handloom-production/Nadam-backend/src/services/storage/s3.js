// The shop's Amazon S3 bucket (production). Same folders and public addresses as
// the old backend, so the website keeps showing every photo.
// prefix (test server only, e.g. "v2-test"): every new file goes under that folder, and
// remove() refuses any key outside it, so a test copy of the data can never delete a
// live photo or PDF it points at.
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export function s3Storage({ bucket, region, publicUrl, accessKeyId, secretAccessKey, prefix = null, client: given = null }) {
  const client = given || new S3Client({ region, ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}) });
  const lead = prefix ? `${prefix}/` : '';
  const base = (publicUrl || `https://${bucket}.s3.${region}.amazonaws.com`).replace(/\/$/, '');
  return {
    name: 's3',
    async upload({ buffer, contentType, folder, ext }) {
      const key = `${lead}${folder}/${crypto.randomUUID()}.${ext}`;
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
      return { key, url: `${base}/${key}` };
    },
    async remove(key) {
      if (!key) return false;
      if (lead && !String(key).startsWith(lead)) {
        console.log(`[storage] kept ${key}: not a ${prefix} file`);
        return false;
      }
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    },
    // A stored file (an invoice PDF for its customer, W7): null when the key isn't there.
    // Reading never changes anything, so it isn't limited to the prefix.
    async read(key) {
      if (!key) return null;
      try {
        const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return Buffer.from(await r.Body.transformToByteArray());
      } catch (err) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
        throw err;
      }
    },
    async readByUrl() {
      return null; // photos are fetched by their public address
    },
  };
}
