import { randomUUID } from 'crypto';
import { SUBCATEGORIES_BY_CATEGORY_SLUG } from '../../prisma/subcategorySeedData';

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'nandamhandlooms-media';
const S3_REGION = process.env.S3_REGION || 'ap-south-1';
const IMG = (path: string) => `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/site/${path}`;

export const CATEGORIES = [
  { name: 'Handloom Pattu Saree', slug: 'handloom-pattu-saree', sortOrder: 1, image: IMG('categories/handloom-pattu-saree.jpg'), description: 'Pure and regular pattu silk sarees, handwoven with Kanchi, temple, and scallop zari borders.' },
  { name: 'Handloom Cotton Saree', slug: 'handloom-cotton-saree', sortOrder: 2, image: IMG('categories/handloom-cotton-saree.jpg'), description: 'Breathable handloom cotton sarees in checks, stripes, and block prints for daily and festive wear.' },
  { name: 'Handloom Pattu Dress Material', slug: 'handloom-pattu-dress-material', sortOrder: 3, image: IMG('categories/handloom-pattu-dress-material.jpg'), description: 'Pattu silk dress materials with applique, Tanjore painting, Shibori, and Kalamkari work.' },
  { name: 'Handloom Cotton Dress Material', slug: 'handloom-cotton-dress-material', sortOrder: 4, image: IMG('categories/handloom-cotton-dress-material.jpg'), description: 'Handloom cotton dress materials in plain weaves, embossed prints, and temple borders.' },
  { name: 'Pattu Lehanga Sets', slug: 'pattu-lehanga-sets', sortOrder: 5, image: IMG('categories/pattu-lehanga-sets.jpg'), description: 'Pattu lehanga sets with digital prints, Kalamkari voni, Kutch embroidery, and hand-painted work.' },
  { name: 'Fabrics', slug: 'fabrics', sortOrder: 6, image: IMG('categories/fabrics.jpg'), description: 'Handloom fabric yardage — pure and regular pattu and cotton material sold by the piece for tailoring.' },
] as const;

export const CATEGORY_DEFAULT_PRICING: Record<string, { onlinePrice: number; storePrice: number; mrp: number }> = {
  'handloom-pattu-saree': { onlinePrice: 12999, storePrice: 11999, mrp: 16999 },
  'handloom-cotton-saree': { onlinePrice: 2999, storePrice: 2799, mrp: 4499 },
  'handloom-pattu-dress-material': { onlinePrice: 6999, storePrice: 6499, mrp: 8999 },
  'handloom-cotton-dress-material': { onlinePrice: 2199, storePrice: 1999, mrp: 2999 },
  'pattu-lehanga-sets': { onlinePrice: 1999, storePrice: 1799, mrp: 2999 },
  fabrics: { onlinePrice: 1499, storePrice: 1349, mrp: 1999 },
};

export const PRODUCTS = [
  // Handloom Pattu Saree
  {
    slug: 'rani-pink-kanjivaram-pattu-silk-saree', sku: 'NH-PS-001', category: 'handloom-pattu-saree',
    subCategory: 'Double Zari lines',
    name: 'Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border',
    technique: 'Butta', borderStyle: 'Kanchi Border', purity: 'Pure Pattu', zariTier: '300k', blouseType: 'Plain Blouse', pattern: 'Butta', color: 'Rani Pink', fabric: 'Pure Silk',
    occasion: ['Wedding', 'Festive'], stock: 6, isFeatured: true,
    images: [IMG('products/kanjivaram-rani-pink-peacock.jpg')],
  },
  {
    slug: 'magenta-pattu-silk-saree-gold-border', sku: 'NH-PS-002', category: 'handloom-pattu-saree',
    subCategory: 'Double Zari lines',
    name: 'Magenta Pure Pattu Silk Saree with Pinstripe Checks and Gold Temple Border',
    technique: 'Checks', borderStyle: 'Temple Border', purity: 'Pure Pattu', zariTier: '350/50', blouseType: 'Plain Blouse', pattern: 'Checks', color: 'Magenta', fabric: 'Pure Silk',
    occasion: ['Wedding', 'Gifting'], stock: 4, isFeatured: true,
    images: [IMG('products/kanjivaram-magenta-plain-gold.jpg')],
  },
  {
    slug: 'pink-diamond-jaal-peacock-pattu-saree', sku: 'NH-PS-003', category: 'handloom-pattu-saree',
    subCategory: 'Double Zari lines',
    name: 'Pink Diamond Jaal Pattu Silk Saree with Peacock Motif Border',
    technique: 'Butta', borderStyle: 'Small Border', purity: 'Pure Pattu', zariTier: '250k', blouseType: 'Embroidery Blouse', pattern: 'Butta', color: 'Pink', fabric: 'Pure Silk',
    occasion: ['Wedding', 'Festive'], stock: 5, isFeatured: true,
    images: [IMG('products/banarasi-pink-diamond-jaal.jpg')],
  },
  {
    slug: 'magenta-pinstripe-checks-pattu-saree', sku: 'NH-PS-004', category: 'handloom-pattu-saree',
    subCategory: 'Double Zari lines',
    name: 'Magenta Pattu Silk Saree with Gold Pinstripe Checks and Mirror Border',
    technique: 'Checks', borderStyle: 'Small Border', purity: 'Pure Pattu', zariTier: '200k', blouseType: 'Plain Blouse', pattern: 'Checks', color: 'Magenta', fabric: 'Pure Silk',
    occasion: ['Festive', 'Gifting'], stock: 6, isFeatured: true,
    images: [IMG('products/magenta-pinstripe-checks-saree.jpg'), IMG('products/magenta-pinstripe-checks-saree-detail.jpg')],
  },
  {
    slug: 'pattu-saree-collection-assorted-borders', sku: 'NH-PS-005', category: 'handloom-pattu-saree',
    subCategory: 'Double Zari lines',
    name: 'Pattu Silk Saree Collection — Assorted Zari Borders',
    technique: 'Checks', borderStyle: 'Kanchi Border', purity: 'Pure Pattu', zariTier: '300k', blouseType: 'Plain Blouse', pattern: 'Checks', color: 'Assorted', fabric: 'Pure Silk',
    occasion: ['Wedding', 'Festive', 'Gifting'], stock: 8, isFeatured: true,
    images: [IMG('products/pattu-saree-stack-assorted.jpg')],
  },

  // Handloom Cotton Saree
  {
    slug: 'black-cotton-saree-silver-checks', sku: 'NH-CS-001', category: 'handloom-cotton-saree',
    subCategory: 'Cotton Checks Saree',
    name: 'Black Handloom Cotton Saree with Silver Zari Checks',
    technique: 'Checks', borderStyle: 'Temple Border', purity: 'Regular Pattu', zariTier: '150/50', blouseType: 'Plain Blouse', pattern: 'Checks', color: 'Black', fabric: 'Khadi Cotton',
    occasion: ['Daily wear'], stock: 12, isFeatured: true,
    images: [IMG('products/khadi-black-checks-silver.jpg')],
  },
  {
    slug: 'navy-plain-cotton-saree', sku: 'NH-CS-002', category: 'handloom-cotton-saree',
    subCategory: 'Plain Cotton Saree',
    name: 'Navy Blue Handloom Cotton Saree with Silver Zari Border',
    technique: 'Plain', borderStyle: 'Temple Border', purity: 'Regular Pattu', zariTier: '150/50', blouseType: 'Plain Blouse', pattern: 'Plain', color: 'Navy Blue', fabric: 'Khadi Cotton',
    occasion: ['Daily wear'], stock: 9, isFeatured: true,
    images: [IMG('products/khadi-navy-checks-silver.jpg')],
  },

  // Handloom Pattu Dress Material
  {
    slug: 'mint-applique-pattu-dress-material', sku: 'NH-PD-001', category: 'handloom-pattu-dress-material',
    subCategory: 'Applique Work Dress Materials',
    name: 'Mint Green Applique Pattu Dress Material with Sequin Work',
    technique: 'Applique', borderStyle: 'Scallop', purity: 'Regular Pattu', zariTier: '50/50', pattern: 'Flower Bunch', color: 'Mint Green', fabric: 'Pattu Silk',
    occasion: ['Festive', 'Gifting'], stock: 7, isFeatured: true,
    images: [
      IMG('products/designer-mint-embroidered-organza.jpg'),
      IMG('products/mint-dress-material-detail-1.jpg'),
      IMG('products/mint-dress-material-detail-2.jpg'),
    ],
  },
  {
    slug: 'red-handpainted-applique-dress-material', sku: 'NH-PD-002', category: 'handloom-pattu-dress-material',
    subCategory: 'Real Tanjore Painted Dress Material',
    name: 'Red Hand-Painted Tanjavour Applique Pattu Dress Material',
    technique: 'Hand Painted', borderStyle: 'No border/Plain', purity: 'Pure Pattu', pattern: 'Flower Bunch', color: 'Red', fabric: 'Pattu Silk',
    occasion: ['Festive', 'Gifting'], stock: 5, isFeatured: true,
    images: [IMG('products/red-handpainted-applique-dress-material.jpg')],
  },

  // Handloom Cotton Dress Material
  {
    slug: 'indigo-ikat-cotton-dress-material', sku: 'NH-CD-001', category: 'handloom-cotton-dress-material',
    subCategory: '50/50 Plain Dress Materials',
    name: 'Indigo Ikat Handloom Cotton Dress Material',
    technique: 'Ikkat', borderStyle: 'No border/Plain', purity: 'Regular Pattu', zariTier: '50/50', pattern: 'Ikkat design', color: 'Indigo', fabric: 'Cotton',
    occasion: ['Daily wear', 'Gifting'], stock: 15, isFeatured: false,
    images: [IMG('products/ikat-indigo-diamond-dupatta.jpg')],
  },
  {
    slug: 'ivory-embossing-print-dress-material', sku: 'NH-CD-002', category: 'handloom-cotton-dress-material',
    subCategory: 'Gap Border Embossing Print',
    name: 'Ivory Handloom Cotton Dress Material with Floral Motifs',
    technique: 'Plain', borderStyle: 'Gap Border', purity: 'Regular Pattu', zariTier: '50/50', pattern: 'Flower Bunch', color: 'Ivory', fabric: 'Cotton',
    occasion: ['Gifting', 'Daily wear'], stock: 8, isFeatured: false,
    images: [IMG('products/jamdani-ivory-shawl.jpg')],
  },

  // Pattu Lehanga Sets
  {
    slug: 'emerald-kalamkari-lehanga-set', sku: 'NH-LS-001', category: 'pattu-lehanga-sets',
    subCategory: 'Kalamkari Lehanga Sets',
    name: 'Emerald Green Kalamkari Pattu Lehanga Set',
    technique: 'Kalamkari', borderStyle: 'Big Border', purity: 'Regular Pattu', pattern: 'Flower Bunch', color: 'Emerald Green', fabric: 'Pattu Silk',
    occasion: ['Gifting', 'Festive'], stock: 10, isFeatured: false,
    images: [IMG('products/shawl-green-floral.jpg')],
  },
  {
    slug: 'rust-orange-250k-lehanga-set', sku: 'NH-LS-002', category: 'pattu-lehanga-sets',
    subCategory: '250k Lehanga Sets',
    name: 'Rust Orange Handloom Pattu Lehanga Set with Zari Border',
    technique: 'Plain', borderStyle: 'No border/Plain', purity: 'Regular Pattu', zariTier: '250k', pattern: 'Plain', color: 'Rust Orange', fabric: 'Pattu Silk',
    occasion: ['Gifting'], stock: 20, isFeatured: false,
    images: [IMG('products/throw-rust-orange.jpg')],
  },
] as const;

export async function seedFullCatalog(db: any) {
  // Clear any existing dummy categories/products
  db.category = [];
  db.subcategory = [];
  db.product = [];
  db.productImage = [];

  const categoryIds: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    const id = randomUUID();
    db.category.push({
      id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.image,
      sortOrder: cat.sortOrder,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    categoryIds[cat.slug] = id;
  }

  const subcategoryIdsByCategorySlug: Record<string, Record<string, string>> = {};
  for (const cat of CATEGORIES) {
    const categoryId = categoryIds[cat.slug]!;
    const names = SUBCATEGORIES_BY_CATEGORY_SLUG[cat.slug] ?? [];
    const pricing = CATEGORY_DEFAULT_PRICING[cat.slug] || { onlinePrice: 2999, storePrice: 2499, mrp: 3999 };
    const byName: Record<string, string> = {};

    for (let i = 0; i < names.length; i++) {
      const id = randomUUID();
      const subName = names[i]!;
      db.subcategory.push({
        id,
        categoryId,
        name: subName,
        description: cat.description,
        onlinePrice: pricing.onlinePrice,
        storePrice: pricing.storePrice,
        mrp: pricing.mrp,
        sortOrder: i,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      byName[subName] = id;
    }
    subcategoryIdsByCategorySlug[cat.slug] = byName;
  }

  for (const prod of PRODUCTS) {
    const categoryId = categoryIds[prod.category];
    const subcategoryId = subcategoryIdsByCategorySlug[prod.category]?.[prod.subCategory];
    if (!categoryId || !subcategoryId) continue;

    const prodId = randomUUID();
    db.product.push({
      id: prodId,
      slug: prod.slug,
      sku: prod.sku,
      name: prod.name,
      categoryId,
      subcategoryId,
      technique: prod.technique,
      borderStyle: prod.borderStyle,
      purity: prod.purity ?? null,
      zariTier: 'zariTier' in prod ? prod.zariTier : null,
      blouseType: 'blouseType' in prod ? prod.blouseType : null,
      pattern: prod.pattern,
      color: prod.color,
      fabric: prod.fabric,
      occasion: [...prod.occasion],
      stock: prod.stock,
      channelVisibility: 'both',
      trackingMode: 'quantity',
      isFeatured: prod.isFeatured,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    for (let idx = 0; idx < prod.images.length; idx++) {
      db.productImage.push({
        id: randomUUID(),
        productId: prodId,
        url: prod.images[idx],
        altText: prod.name,
        sortOrder: idx,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}
