import { env } from '../config/env';

// Shared by every PDF generator that embeds a remote image (product photos,
// the brand logo). Product images are usually absolute S3 URLs, but
// seed/demo data and any legacy relative path (meant for the browser to
// resolve against the customer-web origin) need resolving before a
// server-side fetch can reach them.
export const fetchImageBuffer = async (url: string): Promise<Buffer> => {
  const absoluteUrl = /^https?:\/\//i.test(url) ? url : `${env.FRONTEND_URL.replace(/\/$/, '')}${url}`;
  const res = await fetch(absoluteUrl);
  if (!res.ok) throw new Error(`Failed to fetch image (status ${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
};
