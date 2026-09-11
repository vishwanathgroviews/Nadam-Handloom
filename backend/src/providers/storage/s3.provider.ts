import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env';
import { StorageProvider, UploadImageInput, UploadedImage } from './storage.provider';

export class S3StorageProvider implements StorageProvider {
  private client: S3Client | null;

  constructor() {
    this.client = env.S3_BUCKET_NAME && env.S3_REGION ? new S3Client({ region: env.S3_REGION }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async upload({ buffer, contentType, filename, folder }: UploadImageInput): Promise<UploadedImage> {
    if (!this.client) throw new Error('S3 storage is not configured');

    const ext = filename.includes('.') ? filename.split('.').pop() : 'jpg';
    const key = `${folder || 'products'}/${randomUUID()}.${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET_NAME as string,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return { url: this.getPublicUrl(key), key };
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET_NAME as string, Key: key }));
  }

  getPublicUrl(key: string): string {
    const base = env.S3_PUBLIC_URL || `https://${env.S3_BUCKET_NAME}.s3.${env.S3_REGION}.amazonaws.com`;
    return `${base.replace(/\/$/, '')}/${key}`;
  }
}
