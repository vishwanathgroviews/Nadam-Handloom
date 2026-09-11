// Base URL for static app imagery (currently just the brand logo). Same S3
// bucket/prefix the customer web app and backend catalog images use — see
// frontend/customer-web/src/utils/media.js. Override via EXPO_PUBLIC_MEDIA_URL
// if the bucket/region/CDN ever changes; no code depends on a bundled/local
// image file.
const MEDIA_BASE_URL = (
  process.env.EXPO_PUBLIC_MEDIA_URL || 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site'
).replace(/\/$/, '');

export const mediaUrl = (path: string) => `${MEDIA_BASE_URL}/${path.replace(/^\//, '')}`;

export const BRAND_LOGO_URL = mediaUrl('brand/logo.png');
