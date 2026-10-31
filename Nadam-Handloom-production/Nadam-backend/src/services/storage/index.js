// Where photos and catalogue PDFs are kept: a local folder (development, tests) or
// the shop's S3 bucket (production). Chosen once from the settings.
import { env } from '../../config/env.js';
import { localStorage } from './local.js';
import { s3Storage } from './s3.js';

let current = null;

export function storage() {
  if (!current) {
    current = env.STORAGE_PROVIDER === 's3'
      ? s3Storage({ bucket: env.S3_BUCKET_NAME, region: env.S3_REGION, publicUrl: env.S3_PUBLIC_URL, accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY, prefix: env.S3_KEY_PREFIX })
      : localStorage({ dir: env.LOCAL_STORAGE_DIR, publicUrl: env.publicUrl });
  }
  return current;
}

// Tests use their own folder.
export const useStorage = (s) => { current = s; };
