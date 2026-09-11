export interface UploadImageInput {
  buffer: Buffer;
  contentType: string;
  filename: string;
  folder?: string; // e.g. 'products', 'labels' — defaults to 'products'
}

export interface UploadedImage {
  url: string;
  key: string;
}

export interface StorageProvider {
  isConfigured(): boolean;
  upload(input: UploadImageInput): Promise<UploadedImage>;
  deleteObject(key: string): Promise<void>;
  // Reconstructs the public URL for a previously-uploaded object's key —
  // used to re-link a stored object (e.g. an archived label PDF) without
  // re-uploading or needing a signed-URL round trip, since the bucket is
  // public-read.
  getPublicUrl(key: string): string;
}
