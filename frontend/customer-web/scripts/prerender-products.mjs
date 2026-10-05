import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const indexHtmlPath = path.resolve(distDir, 'index.html');

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'nandamhandlooms-media';
const S3_REGION = process.env.S3_REGION || 'ap-south-1';
const IMG = (p) => `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/site/${p}`;

export const CATALOG_PRODUCTS = [
  {
    slug: 'rani-pink-kanjivaram-pattu-silk-saree',
    name: 'Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border',
    description: 'Pure and regular pattu silk sarees, handwoven with Kanchi, temple, and scallop ...',
    imageUrl: IMG('products/kanjivaram-rani-pink-peacock.jpg'),
  },
  {
    slug: 'magenta-pattu-silk-saree-gold-border',
    name: 'Magenta Pure Pattu Silk Saree with Pinstripe Checks and Gold Temple Border',
    description: 'Pure and regular pattu silk sarees, handwoven with Kanchi, temple, and scallop ...',
    imageUrl: IMG('products/kanjivaram-magenta-plain-gold.jpg'),
  },
  {
    slug: 'pink-diamond-jaal-peacock-pattu-saree',
    name: 'Pink Diamond Jaal Pattu Silk Saree with Peacock Motif Border',
    description: 'Pure and regular pattu silk sarees, handwoven with Kanchi, temple, and scallop ...',
    imageUrl: IMG('products/banarasi-pink-diamond-jaal.jpg'),
  },
  {
    slug: 'magenta-pinstripe-checks-pattu-saree',
    name: 'Magenta Pattu Silk Saree with Gold Pinstripe Checks and Mirror Border',
    description: 'Pure and regular pattu silk sarees, handwoven with Kanchi, temple, and scallop ...',
    imageUrl: IMG('products/magenta-pinstripe-checks-saree.jpg'),
  },
  {
    slug: 'pattu-saree-collection-assorted-borders',
    name: 'Pattu Silk Saree Collection — Assorted Zari Borders',
    description: 'Pure and regular pattu silk sarees, handwoven with Kanchi, temple, and scallop ...',
    imageUrl: IMG('products/pattu-saree-stack-assorted.jpg'),
  },
  {
    slug: 'black-cotton-saree-silver-checks',
    name: 'Black Handloom Cotton Saree with Silver Zari Checks',
    description: 'Breathable handloom cotton sarees in checks, stripes, and block prints for ...',
    imageUrl: IMG('products/khadi-black-checks-silver.jpg'),
  },
  {
    slug: 'navy-plain-cotton-saree',
    name: 'Navy Blue Handloom Cotton Saree with Silver Zari Border',
    description: 'Breathable handloom cotton sarees in checks, stripes, and block prints for ...',
    imageUrl: IMG('products/khadi-navy-checks-silver.jpg'),
  },
  {
    slug: 'mint-applique-pattu-dress-material',
    name: 'Mint Green Applique Pattu Dress Material with Sequin Work',
    description: 'Pattu silk dress materials with applique, Tanjore painting, Shibori, and ...',
    imageUrl: IMG('products/designer-mint-embroidered-organza.jpg'),
  },
  {
    slug: 'red-handpainted-applique-dress-material',
    name: 'Red Hand-Painted Tanjavour Applique Pattu Dress Material',
    description: 'Pattu silk dress materials with applique, Tanjore painting, Shibori, and ...',
    imageUrl: IMG('products/red-handpainted-applique-dress-material.jpg'),
  },
  {
    slug: 'indigo-ikat-cotton-dress-material',
    name: 'Indigo Ikat Handloom Cotton Dress Material',
    description: 'Handloom cotton dress materials in plain weaves, embossed prints, and ...',
    imageUrl: IMG('products/ikat-indigo-diamond-dupatta.jpg'),
  },
  {
    slug: 'ivory-embossing-print-dress-material',
    name: 'Ivory Handloom Cotton Dress Material with Floral Motifs',
    description: 'Handloom cotton dress materials in plain weaves, embossed prints, and ...',
    imageUrl: IMG('products/jamdani-ivory-shawl.jpg'),
  },
  {
    slug: 'emerald-kalamkari-lehanga-set',
    name: 'Emerald Green Kalamkari Pattu Lehanga Set',
    description: 'Pattu lehanga sets with digital prints, Kalamkari voni, Kutch embroidery, and ...',
    imageUrl: IMG('products/shawl-green-floral.jpg'),
  },
  {
    slug: 'rust-orange-250k-lehanga-set',
    name: 'Rust Orange Handloom Pattu Lehanga Set with Zari Border',
    description: 'Pattu lehanga sets with digital prints, Kalamkari voni, Kutch embroidery, and ...',
    imageUrl: IMG('products/throw-rust-orange.jpg'),
  },
];

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function prerenderProducts() {
  if (!fs.existsSync(indexHtmlPath)) {
    console.error('[prerender] dist/index.html not found, skipping prerender.');
    return;
  }

  const baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  for (const product of CATALOG_PRODUCTS) {
    const name = escapeHtml(product.name);
    const desc = escapeHtml(product.description);
    const img = escapeHtml(product.imageUrl);
    const prodUrl = `https://groviews.com/product/${product.slug}`;

    const metaTags = `
    <title>${name} | Groviews</title>
    <meta property="og:title" content="${name}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:secure_url" content="${img}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${name}" />
    <meta property="og:url" content="${prodUrl}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="Groviews" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${name}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${img}" />`;

    let enrichedHtml = baseHtml.replace(/<title>[\s\S]*?<\/title>/i, '');
    enrichedHtml = enrichedHtml.replace('</head>', `${metaTags}\n  </head>`);

    const productDir = path.resolve(distDir, `product/${product.slug}`);
    fs.mkdirSync(productDir, { recursive: true });
    fs.writeFileSync(path.resolve(productDir, 'index.html'), enrichedHtml, 'utf8');
  }

  console.log(`[prerender] Successfully generated Open Graph preview pages for ${CATALOG_PRODUCTS.length} products in dist/product/`);
}

if (process.argv[1] && process.argv[1].endsWith('prerender-products.mjs')) {
  prerenderProducts();
}
