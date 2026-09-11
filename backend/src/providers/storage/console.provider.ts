import { StorageProvider, UploadImageInput, UploadedImage } from './storage.provider';

// Dev/test-only placeholder: it cannot actually serve a file, so
// isConfigured() reports false — callers get the same clear "not configured"
// error the payment/tracking providers give when unset, instead of a
// confusing runtime failure mid-upload.
export class ConsoleStorageProvider implements StorageProvider {
  isConfigured(): boolean {
    return false;
  }

  async upload(input: UploadImageInput): Promise<UploadedImage> {
    console.log(`[console storage] would upload "${input.filename}" (${input.buffer.length} bytes)`);
    throw new Error('Object storage is not configured (STORAGE_PROVIDER=console is a dev placeholder)');
  }

  async deleteObject(): Promise<void> {
    // no-op
  }

  getPublicUrl(): string {
    throw new Error('Object storage is not configured (STORAGE_PROVIDER=console is a dev placeholder)');
  }
}
