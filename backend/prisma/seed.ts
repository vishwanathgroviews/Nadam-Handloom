import 'dotenv/config';
import argon2, { argon2id, type HashOptions } from 'argon2';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashSecret } from '../src/utils/hash';
import { SUBCATEGORIES_BY_CATEGORY_SLUG } from './subcategorySeedData';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const roleNames = ['ADMIN', 'STAFF', 'CUSTOMER'] as const;
  const roles: Record<string, { id: string }> = {};

  for (const roleName of roleNames) {
    roles[roleName] = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  // Define some core permissions
  const permissionNames = [
    'users:read',
    'users:write',
    'users:delete',
    'roles:read',
    'roles:write',
  ];

  const permissions: Record<string, { id: string }> = {};

  for (const permName of permissionNames) {
    permissions[permName] = await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: { name: permName },
    });
  }

  // Link roles to permissions
  const rolePermissionMap: Record<string, string[]> = {
    ADMIN: permissionNames,
    STAFF: ['users:read', 'users:write', 'roles:read'],
    CUSTOMER: [],
  };

  for (const [roleName, permNames] of Object.entries(rolePermissionMap)) {
    const role = roles[roleName];
    if (!role) continue;
    for (const permName of permNames) {
      const permission = permissions[permName];
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  await seedBootstrapAdmin(roles.ADMIN!.id);
  await seedCatalog();
  await seedDemoCustomerAndOrder();

  console.log('Database seeded successfully.');
}

// Seed imagery lives in S3 under site/... (uploaded once via `aws s3 sync`
// from frontend/customer-web's former public/images/ folder — see
// prisma/migrate-images-to-s3.ts for the one-off migration of any
// already-seeded rows). A fresh seed on an empty database gets these URLs
// directly, so nothing ever depends on a local image file.
const IMG = (path: string) => `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/site/${path}`;

// Six main categories the storefront navigates by. Categories are purely
// organizational now (name/description/image/sort) — price, per-item
// description, and hide/unhide all live on Subcategory instead (see
// SUBCATEGORIES_BY_CATEGORY_SLUG, imported from subcategorySeedData.ts —
// the same canonical list used for the live-database backfill). Fabrics is
// the newest category and deliberately has zero subcategories yet — admin
// adds them as stock arrives, same as every other category did before
// Categories.md existed.
const CATEGORIES = [
  { name: 'Handloom Pattu Saree', slug: 'handloom-pattu-saree', sortOrder: 1, image: IMG('categories/handloom-pattu-saree.jpg'), description: 'Pure and regular pattu silk sarees, handwoven with Kanchi, temple, and scallop zari borders.' },
  { name: 'Handloom Cotton Saree', slug: 'handloom-cotton-saree', sortOrder: 2, image: IMG('categories/handloom-cotton-saree.jpg'), description: 'Breathable handloom cotton sarees in checks, stripes, and block prints for daily and festive wear.' },
  { name: 'Handloom Pattu Dress Material', slug: 'handloom-pattu-dress-material', sortOrder: 3, image: IMG('categories/handloom-pattu-dress-material.jpg'), description: 'Pattu silk dress materials with applique, Tanjore painting, Shibori, and Kalamkari work.' },
  { name: 'Handloom Cotton Dress Material', slug: 'handloom-cotton-dress-material', sortOrder: 4, image: IMG('categories/handloom-cotton-dress-material.jpg'), description: 'Handloom cotton dress materials in plain weaves, embossed prints, and temple borders.' },
  { name: 'Pattu Lehanga Sets', slug: 'pattu-lehanga-sets', sortOrder: 5, image: IMG('categories/pattu-lehanga-sets.jpg'), description: 'Pattu lehanga sets with digital prints, Kalamkari voni, Kutch embroidery, and hand-painted work.' },
  { name: 'Fabrics', slug: 'fabrics', sortOrder: 6, image: IMG('categories/fabrics.jpg'), description: 'Handloom fabric yardage — pure and regular pattu and cotton material sold by the piece for tailoring.' },
] as const;

// Starting price for every subcategory seeded under a category — mirrors
// exactly what the live-database backfill used (each new Subcategory row
// inherits its parent category's former price as a starting point; admin
// edits real per-subcategory prices afterward in the app).
const CATEGORY_DEFAULT_PRICING: Record<string, { onlinePrice: number; storePrice: number; mrp: number }> = {
  'handloom-pattu-saree': { onlinePrice: 12999, storePrice: 11999, mrp: 16999 },
  'handloom-cotton-saree': { onlinePrice: 2999, storePrice: 2799, mrp: 4499 },
  'handloom-pattu-dress-material': { onlinePrice: 6999, storePrice: 6499, mrp: 8999 },
  'handloom-cotton-dress-material': { onlinePrice: 2199, storePrice: 1999, mrp: 2999 },
  'pattu-lehanga-sets': { onlinePrice: 1999, storePrice: 1799, mrp: 2999 },
  fabrics: { onlinePrice: 1499, storePrice: 1349, mrp: 1999 },
};

// Every product now points at a real Subcategory by name (resolved to an id
// during seeding, same as CATEGORIES above). The 5 Handloom Pattu Saree
// products have no natural subcategory tag of their own (that category was
// originally filtered by technique/border/zari attributes only) — assigned
// to "Double Zari lines" (the first Pattu Saree subcategory), mirroring the
// exact placeholder decision used for the live-database backfill.
const PRODUCTS = [
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

async function seedCatalog() {
  const existingCategoryCount = await prisma.category.count();
  if (existingCategoryCount > 0) {
    console.log('Catalog already seeded, skipping.');
    return;
  }

  const categoryIds: Record<string, string> = {};
  for (const category of CATEGORIES) {
    const created = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.image,
        sortOrder: category.sortOrder,
      },
    });
    categoryIds[category.slug] = created.id;
  }

  let subcategoryCount = 0;
  const subcategoryIdsByCategorySlug: Record<string, Record<string, string>> = {};
  for (const category of CATEGORIES) {
    const categoryId = categoryIds[category.slug]!;
    const names = SUBCATEGORIES_BY_CATEGORY_SLUG[category.slug] ?? [];
    const pricing = CATEGORY_DEFAULT_PRICING[category.slug]!;
    const byName: Record<string, string> = {};
    for (let i = 0; i < names.length; i++) {
      const created = await prisma.subcategory.create({
        data: {
          categoryId,
          name: names[i]!,
          description: category.description,
          onlinePrice: pricing.onlinePrice,
          storePrice: pricing.storePrice,
          mrp: pricing.mrp,
          sortOrder: i,
        },
      });
      byName[names[i]!] = created.id;
      subcategoryCount++;
    }
    subcategoryIdsByCategorySlug[category.slug] = byName;
  }

  for (const product of PRODUCTS) {
    const categoryId = categoryIds[product.category];
    const subcategoryId = subcategoryIdsByCategorySlug[product.category]?.[product.subCategory];
    if (!categoryId || !subcategoryId) continue;
    await prisma.product.create({
      data: {
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        categoryId,
        subcategoryId,
        technique: product.technique,
        borderStyle: product.borderStyle,
        purity: product.purity ?? null,
        zariTier: 'zariTier' in product ? product.zariTier : null,
        blouseType: 'blouseType' in product ? product.blouseType : null,
        pattern: product.pattern,
        color: product.color,
        fabric: product.fabric,
        occasion: [...product.occasion],
        stock: product.stock,
        isFeatured: product.isFeatured,
        images: {
          create: product.images.map((url, index) => ({ url, sortOrder: index, altText: product.name })),
        },
      },
    });
  }

  console.log(`Seeded ${CATEGORIES.length} categories, ${subcategoryCount} subcategories, and ${PRODUCTS.length} products.`);
}

async function seedBootstrapAdmin(adminRoleId: string) {
  const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_MOBILE, SEED_ADMIN_MPIN } = process.env;

  if (!SEED_ADMIN_NAME || !SEED_ADMIN_EMAIL || !SEED_ADMIN_MOBILE || !SEED_ADMIN_MPIN) {
    console.log('Skipping bootstrap admin (SEED_ADMIN_* env vars not fully set).');
    return;
  }

  const existingAdmin = await prisma.userRole.findFirst({ where: { roleId: adminRoleId } });
  if (existingAdmin) {
    console.log('An ADMIN account already exists, skipping bootstrap admin.');
    return;
  }

  const nameParts = SEED_ADMIN_NAME.trim().split(/\s+/);
  const firstName = nameParts[0] ?? SEED_ADMIN_NAME;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;
  const hashOptions: HashOptions = { type: argon2id, memoryCost: 2 ** 16, timeCost: 3, parallelism: 1 };
  const mpinHash = await argon2.hash(SEED_ADMIN_MPIN, hashOptions);

  await prisma.$transaction(async (tx) => {
    const account = await tx.authAccount.create({
      data: {
        email: SEED_ADMIN_EMAIL,
        phone: SEED_ADMIN_MOBILE,
        mpinHash,
        mpinSetAt: new Date(),
        status: 'active',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        adminProfile: { create: { firstName, lastName } },
      },
    });
    await tx.userRole.create({ data: { authAccountId: account.id, roleId: adminRoleId } });
  });

  console.log(`Bootstrap ADMIN account created for ${SEED_ADMIN_MOBILE}.`);
}

const DEMO_CUSTOMER_EMAIL = 'gorantlasaisiddartha12@gmail.com';
const DEMO_CUSTOMER_PHONE = '9876543210';
const DEMO_CUSTOMER_MPIN = '284759';

// Demo customer account + a single order in "Order Placed" state (paid, not
// yet shipped — the first step of the tracking timeline), so the My Orders /
// Order Tracking UI has something real to show end-to-end. Customer login is
// phone + MPIN (see customer-auth.service.ts), so this account is seeded
// directly in its already-activated shape rather than going through the
// register -> OTP -> MPIN-setup flow.
async function seedDemoCustomerAndOrder() {
  const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CUSTOMER' } });
  const mpinHash = await hashSecret(DEMO_CUSTOMER_MPIN);

  // Matches on phone OR email: a pre-existing row from before customer auth
  // moved to phone+MPIN has `email` set but `phone`/`mpinHash` still null —
  // matching on email alone (the original dedup key) would keep recognizing
  // that legacy row as "already seeded" forever and skip, leaving a demo
  // account that can never actually log in via the current phone+MPIN flow.
  const existing = await prisma.authAccount.findFirst({
    where: { OR: [{ phone: DEMO_CUSTOMER_PHONE }, { email: DEMO_CUSTOMER_EMAIL }] },
  });

  let account: { id: string };
  if (existing && existing.phone && existing.mpinHash) {
    console.log('Demo customer account already exists, skipping.');
    return;
  } else if (existing) {
    // Backfill the legacy row in place instead of skipping it.
    account = await prisma.$transaction(async (tx) => {
      const updated = await tx.authAccount.update({
        where: { id: existing.id },
        data: {
          phone: DEMO_CUSTOMER_PHONE,
          status: 'active',
          phoneVerifiedAt: new Date(),
          mpinHash,
          mpinSetAt: new Date(),
        },
      });
      await tx.userProfile.upsert({
        where: { authAccountId: existing.id },
        update: {},
        create: {
          authAccountId: existing.id,
          firstName: 'Sai Siddartha', lastName: 'Gorantla', displayName: 'Sai Siddartha',
          preferences: { state: 'Andhra Pradesh', pincode: '522503' },
        },
      });
      await tx.userRole.upsert({
        where: { authAccountId_roleId: { authAccountId: existing.id, roleId: customerRole.id } },
        update: {},
        create: { authAccountId: existing.id, roleId: customerRole.id },
      });
      return updated;
    });
    console.log(`Backfilled legacy demo customer account for ${DEMO_CUSTOMER_PHONE}.`);
  } else {
    account = await prisma.$transaction(async (tx) => {
      const created = await tx.authAccount.create({
        data: {
          email: DEMO_CUSTOMER_EMAIL,
          phone: DEMO_CUSTOMER_PHONE,
          status: 'active',
          emailVerifiedAt: new Date(),
          phoneVerifiedAt: new Date(),
          mpinHash,
          mpinSetAt: new Date(),
          userProfile: {
            create: {
              firstName: 'Sai Siddartha', lastName: 'Gorantla', displayName: 'Sai Siddartha',
              preferences: { state: 'Andhra Pradesh', pincode: '522503' },
            },
          },
        },
      });
      await tx.userRole.create({ data: { authAccountId: created.id, roleId: customerRole.id } });
      return created;
    });
  }

  const existingOrder = await prisma.order.findFirst({ where: { authAccountId: account.id } });
  if (existingOrder) {
    console.log(`Demo customer account created for ${DEMO_CUSTOMER_PHONE} (MPIN ${DEMO_CUSTOMER_MPIN}); it already has an order, skipping.`);
    return;
  }

  const product = await prisma.product.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    include: {
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      subcategory: { select: { onlinePrice: true } },
    },
  });
  if (!product) {
    console.log('No products seeded yet, skipping demo customer order.');
    return;
  }

  const address = await prisma.address.create({
    data: {
      authAccountId: account.id,
      fullName: 'Sai Siddartha Gorantla',
      phone: DEMO_CUSTOMER_PHONE,
      line1: '#10-23, Opp. Brahmam Gari Temple, Hussain Katta',
      line2: 'Old Mangalagiri',
      city: 'Guntur',
      state: 'Andhra Pradesh',
      pincode: '522503',
      isDefault: true,
    },
  });

  const orderNumber = `NH${Math.floor(Math.random() * 100_000_000).toString().padStart(8, '0')}`;
  const subtotal = Number(product.subcategory.onlinePrice);
  const total = subtotal;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      authAccountId: account.id,
      addressId: address.id,
      status: 'processing',
      subtotal,
      total,
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country,
      },
    },
  });

  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      productId: product.id,
      nameSnapshot: product.name,
      priceSnapshot: product.subcategory.onlinePrice,
      imageSnapshot: product.images[0]?.url ?? null,
      quantity: 1,
    },
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      razorpayOrderId: `order_seed_${order.id.slice(0, 18)}`,
      razorpayPaymentId: `pay_seed_${order.id.slice(0, 18)}`,
      status: 'paid',
      amount: total,
    },
  });

  await prisma.shipment.create({ data: { orderId: order.id } });

  console.log(`Demo customer account created for ${DEMO_CUSTOMER_PHONE} (MPIN ${DEMO_CUSTOMER_MPIN}) with order ${orderNumber} (Order Placed).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
