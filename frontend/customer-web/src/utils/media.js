// Base URL for static site imagery (hero, category, craft, brand) that isn't
// already an absolute URL from the catalog API. Configurable via
// VITE_MEDIA_BASE_URL (see .env.example) so a bucket/region/CDN change never
// requires touching component code — defaults to the real S3 bucket, never a
// local project-directory path.
const MEDIA_BASE_URL = (
  import.meta.env.VITE_MEDIA_BASE_URL || 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site'
).replace(/\/$/, '');

export const mediaUrl = (path) => `${MEDIA_BASE_URL}/${String(path).replace(/^\//, '')}`;
