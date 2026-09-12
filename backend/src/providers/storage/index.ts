import { env } from '../../config/env';
import { StorageProvider } from './storage.provider';
import { ConsoleStorageProvider } from './console.provider';
import { S3StorageProvider } from './s3.provider';
import { LocalStorageProvider } from './local.provider';

function createStorageProvider(): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    case 'console':
      return new ConsoleStorageProvider();
    case 'local':
      return new LocalStorageProvider();
    case 's3':
      return new S3StorageProvider();
    default:
      throw new Error(
        `Unknown STORAGE_PROVIDER "${env.STORAGE_PROVIDER}". Supported: "console" (no uploads), ` +
          `"local" (files on disk, works with no cloud account), "s3".`
      );
  }
}

export const storageProvider: StorageProvider = createStorageProvider();
export type { StorageProvider, UploadedImage, UploadImageInput } from './storage.provider';
