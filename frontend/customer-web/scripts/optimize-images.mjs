// One-off/on-demand tool: resizes and compresses source photography from the
// repo-root `Images/` and `assets/` folders into public/images/, so raw
// 13-20MB camera originals never ship to the browser. Re-run whenever new
// source photos are added (see MANIFEST below).
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_ROOT = path.resolve(__dirname, '../public/images');

const src = (...p) => path.join(REPO_ROOT, ...p);

// The brand logo isn't in this MANIFEST: it needs PNG output (transparent
// background) while everything below is JPEG, and it's resized/uploaded to
// S3 directly via a dedicated one-off script (see resize-logo.mjs in this
// same scripts/ folder) rather than through public/images/.
const MANIFEST = [
  // Category banners/thumbnails — sourced from the curated `Images/catagories/`
  // folder (the brand's real category photography). Handloom Pattu Saree and
  // Fabrics have no photo in that folder yet, so they use a ChatGPT-generated
  // stand-in (a folded pattu silk piece with a zari peacock border, and
  // folded checked silk yardage respectively) until real photography exists.
  { in: src('Images/ChatGPT Image Aug 17_ 2026_ 03_37_38 PM.png'), out: 'categories/handloom-pattu-saree.jpg', width: 900 },
  { in: src('Images/catagories/handloom cotton saree.jpg'), out: 'categories/handloom-cotton-saree.jpg', width: 900 },
  { in: src('Images/catagories/handloom pattu dress materail.png'), out: 'categories/handloom-pattu-dress-material.jpg', width: 900 },
  { in: src('Images/catagories/handloom cotton dress materail.png'), out: 'categories/handloom-cotton-dress-material.jpg', width: 900 },
  { in: src('Images/catagories/pattu lehanga sets.png'), out: 'categories/pattu-lehanga-sets.jpg', width: 900 },
  { in: src('Images/ChatGPT Image Aug 17_ 2026_ 11_20_44 AM 1.png'), out: 'categories/fabrics.jpg', width: 900 },

  // Hero carousel — sourced from the curated `Images/Hero carousel/` folder.
  { in: src('Images/Hero carousel/DSC00825.png'), out: 'hero/hero-pattu-zari-border.jpg', width: 1920 },
  { in: src('Images/Hero carousel/DSC01041.jpg'), out: 'hero/hero-bridal-brocade.jpg', width: 1920 },
  { in: src('Images/Hero carousel/DSC01107.png'), out: 'hero/hero-cotton-checks.jpg', width: 1920 },
  { in: src('Images/Hero carousel/DSC01135.png'), out: 'hero/hero-kalamkari-border.jpg', width: 1920 },
  { in: src('Images/Hero carousel/edb513ec-352c-472f-8752-2c61932ce038.png'), out: 'hero/hero-craft-story.jpg', width: 1920 },

  // Craft story texture details
  { in: src('Images/DSC00815.JPG'), out: 'craft/texture-gold-border-1.jpg', width: 1400 },
  { in: src('Images/DSC00825.JPG'), out: 'craft/texture-silver-border-1.jpg', width: 1400 },
  { in: src('Images/DSC00833.JPG'), out: 'craft/texture-mint-embroidery.jpg', width: 1400 },
  { in: src('Images/DSC00850.JPG'), out: 'craft/texture-mint-border.jpg', width: 1400 },

  // Product images (full + thumb) — Handloom Pattu Saree
  { in: src('Images/ChatGPT Image Aug 17_ 2026_ 03_37_38 PM.png'), out: 'products/kanjivaram-rani-pink-peacock.jpg', width: 1200 },
  { in: src('Images/ChatGPT Image Aug 17_ 2026_ 03_37_38 PM.png'), out: 'products/thumb/kanjivaram-rani-pink-peacock.jpg', width: 600 },

  { in: src('Images/DSC00974.JPG'), out: 'products/kanjivaram-magenta-plain-gold.jpg', width: 1200 },
  { in: src('Images/DSC00974.JPG'), out: 'products/thumb/kanjivaram-magenta-plain-gold.jpg', width: 600 },

  { in: src('Images/ChatGPT Image Aug 17_ 2026_ 05_02_53 PM.png'), out: 'products/banarasi-pink-diamond-jaal.jpg', width: 1200 },
  { in: src('Images/ChatGPT Image Aug 17_ 2026_ 05_02_53 PM.png'), out: 'products/thumb/banarasi-pink-diamond-jaal.jpg', width: 600 },

  { in: src('Images/DSC00879.JPG'), out: 'products/pattu-saree-stack-assorted.jpg', width: 1200 },
  { in: src('Images/DSC00879.JPG'), out: 'products/thumb/pattu-saree-stack-assorted.jpg', width: 600 },

  { in: src('Images/ChatGPT Image Aug 17_ 2026_ 11_20_44 AM 1.png'), out: 'products/magenta-pinstripe-checks-saree.jpg', width: 1200 },
  { in: src('Images/ChatGPT Image Aug 17_ 2026_ 11_20_44 AM 1.png'), out: 'products/thumb/magenta-pinstripe-checks-saree.jpg', width: 600 },
  { in: src('Images/ChatGPT Image Aug 17_ 2026_ 11_20_45 AM 2.png'), out: 'products/magenta-pinstripe-checks-saree-detail.jpg', width: 1200 },

  // Handloom Cotton Saree
  { in: src('Images/IMG_1327.PNG'), out: 'products/khadi-black-checks-silver.jpg', width: 1200 },
  { in: src('Images/IMG_1327.PNG'), out: 'products/thumb/khadi-black-checks-silver.jpg', width: 600 },

  { in: src('Images/IMG_1328.PNG'), out: 'products/khadi-navy-checks-silver.jpg', width: 1200 },
  { in: src('Images/IMG_1328.PNG'), out: 'products/thumb/khadi-navy-checks-silver.jpg', width: 600 },

  // Handloom Pattu Dress Material
  { in: src('Images/ChatGPT Image Aug 17_ 2026_ 04_01_55 PM.png'), out: 'products/designer-mint-embroidered-organza.jpg', width: 1200 },
  { in: src('Images/ChatGPT Image Aug 17_ 2026_ 04_01_55 PM.png'), out: 'products/thumb/designer-mint-embroidered-organza.jpg', width: 600 },
  { in: src('Images/DSC00833.JPG'), out: 'products/mint-dress-material-detail-1.jpg', width: 1200 },
  { in: src('Images/DSC00850.JPG'), out: 'products/mint-dress-material-detail-2.jpg', width: 1200 },

  { in: src('Images/DSC00967.JPG'), out: 'products/red-handpainted-applique-dress-material.jpg', width: 1200 },
  { in: src('Images/DSC00967.JPG'), out: 'products/thumb/red-handpainted-applique-dress-material.jpg', width: 600 },

  // Handloom Cotton Dress Material — no real photography yet, generic placeholders
  { in: src('assets/ikat.jpg'), out: 'products/ikat-indigo-diamond-dupatta.jpg', width: 1200 },
  { in: src('assets/ikat.jpg'), out: 'products/thumb/ikat-indigo-diamond-dupatta.jpg', width: 600 },

  { in: src('assets/jamdani.jpg'), out: 'products/jamdani-ivory-shawl.jpg', width: 1200 },
  { in: src('assets/jamdani.jpg'), out: 'products/thumb/jamdani-ivory-shawl.jpg', width: 600 },

  // Pattu Lehanga Sets — no real photography yet, generic placeholders
  { in: src('assets/shawl.jpg'), out: 'products/shawl-green-floral.jpg', width: 1200 },
  { in: src('assets/shawl.jpg'), out: 'products/thumb/shawl-green-floral.jpg', width: 600 },

  { in: src('assets/throwb.jpg'), out: 'products/throw-rust-orange.jpg', width: 1200 },
  { in: src('assets/throwb.jpg'), out: 'products/thumb/throw-rust-orange.jpg', width: 600 },
];

async function run() {
  let ok = 0;
  for (const entry of MANIFEST) {
    const outPath = path.join(OUT_ROOT, entry.out);
    await mkdir(path.dirname(outPath), { recursive: true });
    await sharp(entry.in)
      .resize({ width: entry.width, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(outPath);
    ok += 1;
    console.log(`✓ ${entry.out}`);
  }
  console.log(`\nOptimized ${ok}/${MANIFEST.length} images into ${OUT_ROOT}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
