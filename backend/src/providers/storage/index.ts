import { env } from '../../config/env';
import { StorageProvider } from './storage.provider';
import { ConsoleStorageProvider } from './console.provider';
import { S3StorageProvider } from './s3.provider';

function createStorageProvider(): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    case 'console':
      return new ConsoleStorageProvider();
    case 's3':
      return new S3StorageProvider();
    default:
      throw new Error(`Unknown STORAGE_PROVIDER "${env.STORAGE_PROVIDER}". Supported: "console", "s3".`);
  }
}

export const storageProvider: StorageProvider = createStorageProvider();
export type { StorageProvider, UploadedImage, UploadImageInput } from './storage.provider';
