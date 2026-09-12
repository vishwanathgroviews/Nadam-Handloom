import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { env } from '../../config/env';
import { StorageProvider, UploadImageInput, UploadedImage } from './storage.provider';

/**
 * Writes uploads to a folder on disk and serves them back over HTTP.
 *
 * This exists so a fresh clone works end to end with no cloud account: set
 * `STORAGE_PROVIDER=local` and image upload, the catalog PDF and invoices
 * all function on any machine. `console` cannot do that — it reports
 * `isConfigured() === false` and every upload fails — and `s3` needs real
 * AWS credentials, which is exactly what a second laptop does not have.
 *
 * Not for production: the files live on one server's local disk, so they do
 * not survive a redeploy and are not shared between instances. Production
 * uses `s3`.
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor() {
    this.root = resolve(process.cwd(), env.LOCAL_STORAGE_DIR);
  }

  isConfigured(): boolean {
    return true;
  }

  async upload({ buffer, filename, folder }: UploadImageInput): Promise<UploadedImage> {
    const ext = filename.includes('.') ? filename.split('.').pop() : 'jpg';
    const key = `${folder || 'products'}/${randomUUID()}.${ext}`;
    const target = join(this.root, key);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, buffer);
    return { url: this.getPublicUrl(key), key };
  }

  async deleteObject(key: string): Promise<void> {
    // Never let a key escape the storage root, however it was stored.
    const target = resolve(this.root, key);
    if (!target.startsWith(this.root)) return;
    if (existsSync(target)) unlinkSync(target);
  }

  getPublicUrl(key: string): string {
    // Absolute, because these URLs are stored in the database and handed to
    // the mobile app and the PDF renderer, none of which share an origin
    // with the API.
    const base = env.PUBLIC_API_URL || `http://localhost:${env.PORT}`;
    return `${base.replace(/\/$/, '')}/uploads/${key}`;
  }
}
