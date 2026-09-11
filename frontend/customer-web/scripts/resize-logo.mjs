// One-off/on-demand tool: resizes/compresses the source brand logo
// (repo-root Images/NH_Logo_HD_Transparent.png) into a web-and-print-ready
// PNG. Kept separate from optimize-images.mjs because the logo needs a
// transparent background (PNG), not JPEG. Writes next to the source file —
// upload the result to s3://nandamhandlooms-media/site/brand/logo.png by
// hand (or via a small script using @aws-sdk/client-s3) after running this.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(REPO_ROOT, 'Images', 'NH_Logo_HD_Transparent.png');
const OUT = path.join(REPO_ROOT, 'Images', '_logo-optimized.png');

async function run() {
  const source = readFileSync(SRC);
  const optimized = await sharp(source)
    .resize({ width: 512, withoutEnlargement: true })
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();
  writeFileSync(OUT, optimized);
  console.log(`${SRC}: ${source.length} bytes -> ${OUT}: ${optimized.length} bytes`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
