import { prisma } from '../../config/prisma';
import { planReposition, nextPosition } from './displayOrder';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError, BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { PAID_STATUSES } from '../../utils/constants';
import { slugify } from '../../utils/slug';
import { logAuthEvent } from '../auth/auditLog.service';
import { storageProvider } from '../../providers/storage';
import { withAvailability, withAvailabilityOne } from './catalog.availability';
import { claimPiecesForProduct } from '../inventory/inventory.service';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateSubcategoryInput,
  UpdateSubcategoryInput,
  CreateProductInput,
  UpdateProductInput,
  ListAdminProductsQuery,
} from './catalog.admin.types';

// SOW hard constraint: max 5,000 active listings.
export const ACTIVE_PRODUCT_CAP = 5000;

const uniqueSlug = async (model: 'category' | 'product', base: string, excludeId?: string): Promise<string> => {
  const root = slugify(base);
  let candidate = root;
  let n = 2;
  const exists = async (slug: string) => {
    const row =
      model === 'category'
        ? await prisma.category.findUnique({ where: { slug } })
        : await prisma.product.findUnique({ where: { slug } });
    return Boolean(row) && row!.id !== excludeId;
  };
  while (await exists(candidate)) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
};

// ─────────────────────────────────────────────────────────────────
// Categories — purely organizational (name/description/image/sort). Price,
// per-item description, and hide/unhide all live on Subcategory instead.
// ─────────────────────────────────────────────────────────────────

// Display order: moving a category or subcategory to a position another
// sibling holds swaps the two (see displayOrder.ts). Runs in the caller's
// transaction so the pair is never visible half-swapped.
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const repositionCategory = async (tx: Tx, categoryId: string, requested: number) => {
  const siblings = await tx.category.findMany({ select: { id: true, sortOrder: true, name: true } });
  for (const update of planReposition(siblings, categoryId, requested)) {
    await tx.category.update({ where: { id: update.id }, data: { sortOrder: update.sortOrder } });
  }
};

const repositionSubcategory = async (tx: Tx, parentCategoryId: string, subcategoryId: string, requested: number) => {
  const siblings = await tx.subcategory.findMany({
    where: { categoryId: parentCategoryId },
    select: { id: true, sortOrder: true, name: true },
  });
  for (const update of planReposition(siblings, subcategoryId, requested)) {
    await tx.subcategory.update({ where: { id: update.id }, data: { sortOrder: update.sortOrder } });
  }
};

export const listAllCategories = async () => {
  return prisma.category.findMany({
    // Name breaks ties so the order is always the same order, including for
    // older rows that still share a position.
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true, subcategories: true } } },
  });
};

export const createCategory = async (data: CreateCategoryInput, req: AuthenticatedRequest) => {
  const slug = await uniqueSlug('category', data.name);

  // Added at the end, then moved into the requested position (swapping with
  // whoever holds it) — so a new row can never land on a taken position.
  const category = await prisma.$transaction(async (tx) => {
    const siblings = await tx.category.findMany({ select: { id: true, sortOrder: true, name: true } });
    const created = await tx.category.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        sortOrder: nextPosition(siblings),
      },
    });
    if (data.sortOrder !== undefined) await repositionCategory(tx, created.id, data.sortOrder);
    return tx.category.findUniqueOrThrow({ where: { id: created.id } });
  });

  await logAuthEvent({
    authAccountId: req.user!.id,
    eventType: 'category_created',
    source: 'staff_app',
    req,
    metadata: { categoryId: category.id, name: category.name },
  });

  return category;
};

export const updateCategory = async (categoryId: string, data: UpdateCategoryInput, req: AuthenticatedRequest) => {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) throw new NotFoundError('Category not found');

  const slug = data.name !== undefined && data.name !== existing.name
    ? await uniqueSlug('category', data.name, categoryId)
    : undefined;

  const category = await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id: categoryId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    if (data.sortOrder !== undefined) await repositionCategory(tx, categoryId, data.sortOrder);
    return tx.category.findUniqueOrThrow({ where: { id: categoryId } });
  });

  await logAuthEvent({
    authAccountId: req.user!.id,
    eventType: 'category_updated',
    source: 'staff_app',
    req,
    metadata: { categoryId },
  });

  return category;
};

// ─────────────────────────────────────────────────────────────────
// Subcategories — the real pricing/description/visibility unit. Every
// itemized entry in Categories.md (e.g. "300k Ikkath Border Check Saree")
// is a subcategory row scoped to a parent category.
// ─────────────────────────────────────────────────────────────────

export const listSubcategories = async (categoryId: string) => {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new NotFoundError('Category not found');
  const subcategories = await prisma.subcategory.findMany({
    where: { categoryId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true } } },
  });

  // Every entity shows its OWN photo and nothing else. No inheriting from
  // the parent category, no borrowing the newest product's picture — both
  // were tried, and both meant editing one thing silently changed the
  // picture on others: replace a category photo and every subcategory under
  // it changed; add a product photo and the subcategory's changed. A photo
  // belongs to the row it was uploaded for. A subcategory with none renders
  // a placeholder, and `hasOwnImage` drives the "Needs photo" flag so the
  // gap is visible and fixable instead of silently papered over.
  return subcategories.map((s) => ({ ...s, hasOwnImage: Boolean(s.imageUrl) }));
};

/**
 * One page of a category's subcategories, optionally narrowed by a name
 * search — so the list loads ten at a time instead of all at once, and the
 * search covers every subcategory rather than only the ones already loaded.
 */
export const listSubcategoriesPage = async (
  categoryId: string,
  query: { page: number; pageSize: number; q?: string }
) => {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new NotFoundError('Category not found');

  const where = {
    categoryId,
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.subcategory.findMany({
      where,
      // id last so a page boundary can never fall between two rows the
      // database considers equal (see listAllProducts).
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { _count: { select: { products: true } } },
    }),
    prisma.subcategory.count({ where }),
  ]);

  return {
    items: rows.map((s) => ({ ...s, hasOwnImage: Boolean(s.imageUrl) })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
};

export const createSubcategory = async (
  categoryId: string,
  data: CreateSubcategoryInput,
  req: AuthenticatedRequest
) => {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new NotFoundError('Category not found');

  const subcategory = await prisma.$transaction(async (tx) => {
    const siblings = await tx.subcategory.findMany({
      where: { categoryId },
      select: { id: true, sortOrder: true, name: true },
    });
    const created = await tx.subcategory.create({
      data: {
        categoryId,
        name: data.name,
        description: data.description,
        onlinePrice: data.onlinePrice,
        storePrice: data.storePrice,
        mrp: data.mrp ?? null,
        sortOrder: nextPosition(siblings),
      },
    });
    if (data.sortOrder !== undefined) await repositionSubcategory(tx, categoryId, created.id, data.sortOrder);
    return tx.subcategory.findUniqueOrThrow({ where: { id: created.id } });
  });

  await logAuthEvent({
    authAccountId: req.user!.id,
    eventType: 'subcategory_created',
    source: 'staff_app',
    req,
    metadata: { categoryId, subcategoryId: subcategory.id, name: subcategory.name },
  });

  return { ...subcategory, hasOwnImage: false };
};

export const updateSubcategory = async (
  subcategoryId: string,
  data: UpdateSubcategoryInput,
  req: AuthenticatedRequest
) => {
  const existing = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
  if (!existing) throw new NotFoundError('Subcategory not found');

  const priceOrDescriptionChanged =
    (data.onlinePrice !== undefined && Number(data.onlinePrice) !== Number(existing.onlinePrice)) ||
    (data.storePrice !== undefined && Number(data.storePrice) !== Number(existing.storePrice)) ||
    (data.mrp !== undefined && Number(data.mrp) !== Number(existing.mrp ?? 0)) ||
    (data.description !== undefined && data.description !== existing.description);

  const subcategory = await prisma.$transaction(async (tx) => {
    await tx.subcategory.update({
      where: { id: subcategoryId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.onlinePrice !== undefined ? { onlinePrice: data.onlinePrice } : {}),
        ...(data.storePrice !== undefined ? { storePrice: data.storePrice } : {}),
        ...(data.mrp !== undefined ? { mrp: data.mrp } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    if (data.sortOrder !== undefined) {
      await repositionSubcategory(tx, existing.categoryId, subcategoryId, data.sortOrder);
    }
    return tx.subcategory.findUniqueOrThrow({ where: { id: subcategoryId } });
  });

  if (priceOrDescriptionChanged) {
    await logAuthEvent({
      authAccountId: req.user!.id,
      eventType: 'subcategory_price_changed',
      source: 'staff_app',
      req,
      metadata: {
        subcategoryId,
        before: { onlinePrice: existing.onlinePrice, storePrice: existing.storePrice, mrp: existing.mrp, description: existing.description },
        after: { onlinePrice: subcategory.onlinePrice, storePrice: subcategory.storePrice, mrp: subcategory.mrp, description: subcategory.description },
      },
    });
  }
  if (data.isActive !== undefined && data.isActive !== existing.isActive) {
    await logAuthEvent({
      authAccountId: req.user!.id,
      eventType: data.isActive ? 'subcategory_shown_on_web' : 'subcategory_hidden_from_web',
      source: 'staff_app',
      req,
      metadata: { subcategoryId },
    });
  }

  return { ...subcategory, hasOwnImage: Boolean(subcategory.imageUrl) };
};

/**
 * Permanently removes a subcategory, its products, their photos and their
 * barcoded pieces.
 *
 * Hiding (isActive: false) remains the everyday tool — it takes something
 * off the storefront while every record behind it stays intact. This is the
 * other thing: for a subcategory created by mistake, or a line the shop has
 * genuinely stopped carrying and does not want cluttering the catalogue.
 *
 * It refuses whenever deleting would destroy a business record:
 *   - a product that has been part of a paid order (real sales history,
 *     referenced by an invoice), or
 *   - a piece that has actually been sold, or
 *   - stock that is reserved by a checkout still in flight.
 * In each case the admin is told to hide it instead.
 *
 * Abandoned checkouts are not business records. An unpaid order whose hold
 * has already lapsed is a dead cart, and leaving it in place would make a
 * mistyped subcategory impossible to ever clean up — those are removed
 * along with the products, and named in the audit log.
 */
export const deleteSubcategory = async (subcategoryId: string, req: AuthenticatedRequest) => {
  const subcategory = await prisma.subcategory.findUnique({
    where: { id: subcategoryId },
    include: {
      products: {
        include: {
          images: true,
          pieces: true,
          orderItems: { include: { order: true } },
        },
      },
    },
  });
  if (!subcategory) throw new NotFoundError('Subcategory not found');

  const soldProducts = subcategory.products.filter(
    (p) =>
      p.orderItems.some((item) => PAID_STATUSES.includes(item.order.status)) ||
      p.pieces.some((piece) => piece.status === 'sold_online' || piece.status === 'sold_offline')
  );
  if (soldProducts.length) {
    throw new ConflictError(
      `"${subcategory.name}" can't be deleted — ${soldProducts.length === 1 ? 'a product in it has' : `${soldProducts.length} products in it have`} ` +
        'already been sold, and deleting would remove that sales history. Hide it instead.'
    );
  }

  const productIds = subcategory.products.map((p) => p.id);
  const heldNow = productIds.length
    ? await prisma.reservation.count({
        where: { productId: { in: productIds }, status: 'active', expiresAt: { gt: new Date() } },
      })
    : 0;
  if (heldNow > 0) {
    throw new ConflictError(
      `"${subcategory.name}" can't be deleted right now — a checkout is in progress for one of its products. Try again in a few minutes.`
    );
  }

  // Dead carts: unpaid orders that only ever contained these products.
  const abandonedOrderIds = [
    ...new Set(subcategory.products.flatMap((p) => p.orderItems.map((item) => item.orderId))),
  ];
  const abandonedOrders = abandonedOrderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: abandonedOrderIds } },
        select: { id: true, orderNumber: true, status: true },
      })
    : [];

  const imageKeys = [
    ...subcategory.products.flatMap((p) => p.images.map((img) => img.storageKey)),
    subcategory.storageKey,
  ].filter((key): key is string => Boolean(key));

  await prisma.$transaction(async (tx) => {
    if (productIds.length) {
      // Order matters: every one of these has a Restrict foreign key onto
      // Product, so nothing may still point at a product when it goes.
      await tx.stockLedger.deleteMany({ where: { productId: { in: productIds } } });
      await tx.reservation.deleteMany({ where: { productId: { in: productIds } } });
      if (abandonedOrders.length) {
        // OrderItem and Payment cascade from Order.
        await tx.order.deleteMany({ where: { id: { in: abandonedOrders.map((o) => o.id) } } });
      }
      await tx.piece.deleteMany({ where: { productId: { in: productIds } } });
      // ProductImage cascades from Product.
      await tx.product.deleteMany({ where: { id: { in: productIds } } });
    }
    // SubcategoryCatalogPdf cascades from Subcategory.
    await tx.subcategory.delete({ where: { id: subcategoryId } });
  });

  // Only once the rows are gone — an orphaned object costs pennies, a
  // deleted object the database still points at is a broken image.
  for (const key of imageKeys) {
    storageProvider.deleteObject(key).catch((err) => {
      console.error('Failed to delete stored image for a deleted subcategory:', key, err);
    });
  }

  await logAuthEvent({
    authAccountId: req.user!.id,
    eventType: 'subcategory_deleted',
    source: 'staff_app',
    req,
    metadata: {
      subcategoryId,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      productsDeleted: subcategory.products.map((p) => p.sku),
      abandonedOrdersDeleted: abandonedOrders.map((o) => o.orderNumber),
    },
  });

  return {
    id: subcategoryId,
    name: subcategory.name,
    productsDeleted: productIds.length,
    abandonedOrdersDeleted: abandonedOrders.length,
  };
};

// ─────────────────────────────────────────────────────────────────
// Products — everything that varies per physical item: name, images,
// filterable attributes, stock, channel visibility, tracking mode.
// ─────────────────────────────────────────────────────────────────

const deriveCategoryCode = (categorySlug: string): string => {
  const code = categorySlug
    .split('-')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return code.slice(0, 4) || 'GEN';
};

const nextSku = async (categoryId: string, categorySlug: string): Promise<string> => {
  const code = deriveCategoryCode(categorySlug);
  let seq = (await prisma.product.count({ where: { categoryId } })) + 1;
  let sku = `NH-${code}-${String(seq).padStart(3, '0')}`;
  while (await prisma.product.findUnique({ where: { sku } })) {
    seq += 1;
    sku = `NH-${code}-${String(seq).padStart(3, '0')}`;
  }
  return sku;
};

const assertActivationAllowed = async () => {
  const activeCount = await prisma.product.count({ where: { isActive: true } });
  if (activeCount >= ACTIVE_PRODUCT_CAP) {
    throw new BadRequestError(`Cannot activate — the ${ACTIVE_PRODUCT_CAP}-active-listing cap has been reached`, {
      activeCount,
      cap: ACTIVE_PRODUCT_CAP,
    });
  }
};

export const getProductStats = async () => {
  const activeCount = await prisma.product.count({ where: { isActive: true } });
  return { activeCount, cap: ACTIVE_PRODUCT_CAP, remaining: Math.max(0, ACTIVE_PRODUCT_CAP - activeCount) };
};

const PRODUCT_ADMIN_INCLUDE = {
  category: { select: { id: true, name: true, slug: true, isActive: true } },
  subcategory: { select: { id: true, name: true, onlinePrice: true, storePrice: true, isActive: true } },
  images: { orderBy: { sortOrder: 'asc' as const } },
} as const;

export const listAllProducts = async (query: ListAdminProductsQuery) => {
  const where: any = {};
  if (query.category) where.categoryId = query.category;
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { sku: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const [items, total, stats] = await Promise.all([
    prisma.product.findMany({
      where,
      // id breaks ties. Products created in the same instant (a bulk import,
      // a seed) have no defined order by createdAt alone, so Postgres is free
      // to return them differently on each page request — which skips some
      // and repeats others once the list is paged through.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: PRODUCT_ADMIN_INCLUDE,
    }),
    prisma.product.count({ where }),
    getProductStats(),
  ]);

  return { items: await withAvailability(items), total, page: query.page, pageSize: query.pageSize, ...stats };
};

export const getProductById = async (productId: string) => {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: PRODUCT_ADMIN_INCLUDE });
  if (!product) throw new NotFoundError('Product not found');
  const [withCount] = await withAvailability([product]);
  return withCount!;
};

const assertSubcategoryBelongsToCategory = async (subcategoryId: string, categoryId: string) => {
  const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
  if (!subcategory) throw new BadRequestError('Subcategory not found');
  if (subcategory.categoryId !== categoryId) {
    throw new BadRequestError('That subcategory does not belong to the selected category');
  }
  return subcategory;
};

export const createProduct = async (data: CreateProductInput, req: AuthenticatedRequest) => {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category) throw new BadRequestError('Category not found');
  const subcategory = await assertSubcategoryBelongsToCategory(data.subcategoryId, data.categoryId);

  if (data.isActive) await assertActivationAllowed();

  // Left blank, a product takes its subcategory's name — most subcategories
  // hold a single, visually-distinct listing (see the "one price/description
  // per subcategory" design), so a separate product name is often redundant.
  const name = data.name?.trim() || subcategory.name;
  const slug = await uniqueSlug('product', name);
  const sku = await nextSku(data.categoryId, category.slug);

  // The product and the units staff scanned for it are written together: if a
  // barcode turns out to be taken, the whole creation rolls back rather than
  // leaving a listed product with no stock behind (which is what a separate
  // follow-up call used to do whenever it failed).
  const barcodes = data.barcodes ?? [];
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        slug,
        sku,
        name,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        technique: data.technique ?? null,
        borderStyle: data.borderStyle ?? null,
        purity: data.purity ?? null,
        zariTier: data.zariTier ?? null,
        blouseType: data.blouseType ?? null,
        pattern: data.pattern ?? null,
        color: data.color ?? null,
        fabric: data.fabric ?? null,
        occasion: data.occasion ?? [],
        channelVisibility: data.channelVisibility,
        trackingMode: data.trackingMode,
        isFeatured: data.isFeatured,
        isActive: data.isActive,
      },
      include: PRODUCT_ADMIN_INCLUDE,
    });

    if (barcodes.length) {
      await claimPiecesForProduct(tx, created.id, barcodes, req.user!.id);
    }

    return created;
  });

  await logAuthEvent({
    authAccountId: req.user!.id,
    eventType: 'product_created',
    source: 'staff_app',
    req,
    metadata: { productId: product.id, sku: product.sku, barcodeCount: barcodes.length },
  });

  return withAvailabilityOne(product);
};

export const updateProduct = async (productId: string, data: UpdateProductInput, req: AuthenticatedRequest) => {
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw new NotFoundError('Product not found');

  const effectiveCategoryId = data.categoryId ?? existing.categoryId;
  if (data.categoryId !== undefined) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new BadRequestError('Category not found');
  }
  if (data.subcategoryId !== undefined) {
    await assertSubcategoryBelongsToCategory(data.subcategoryId, effectiveCategoryId);
  } else if (data.categoryId !== undefined) {
    // Category changed without an explicit new subcategory — the existing
    // subcategory almost certainly belongs to the old category, so verify.
    await assertSubcategoryBelongsToCategory(existing.subcategoryId, effectiveCategoryId);
  }
  if (data.isActive === true && existing.isActive === false) {
    await assertActivationAllowed();
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.subcategoryId !== undefined ? { subcategoryId: data.subcategoryId } : {}),
      ...(data.technique !== undefined ? { technique: data.technique } : {}),
      ...(data.borderStyle !== undefined ? { borderStyle: data.borderStyle } : {}),
      ...(data.purity !== undefined ? { purity: data.purity } : {}),
      ...(data.zariTier !== undefined ? { zariTier: data.zariTier } : {}),
      ...(data.blouseType !== undefined ? { blouseType: data.blouseType } : {}),
      ...(data.pattern !== undefined ? { pattern: data.pattern } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.fabric !== undefined ? { fabric: data.fabric } : {}),
      ...(data.occasion !== undefined ? { occasion: data.occasion } : {}),
      ...(data.channelVisibility !== undefined ? { channelVisibility: data.channelVisibility } : {}),
      ...(data.trackingMode !== undefined ? { trackingMode: data.trackingMode } : {}),
      ...(data.isFeatured !== undefined ? { isFeatured: data.isFeatured } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    include: PRODUCT_ADMIN_INCLUDE,
  });

  await logAuthEvent({
    authAccountId: req.user!.id,
    eventType: 'product_updated',
    source: 'staff_app',
    req,
    metadata: { productId },
  });

  return product;
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const uploadProductImage = async (
  productId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  req: AuthenticatedRequest
) => {
  if (!storageProvider.isConfigured()) {
    throw new AppError('Image storage is not configured yet. Please contact support.', 503, 'STORAGE_NOT_CONFIGURED');
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new BadRequestError('Only JPEG, PNG, or WebP images are supported');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new BadRequestError('Image must be 8MB or smaller');
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, include: { images: true } });
  if (!product) throw new NotFoundError('Product not found');

  const uploaded = await storageProvider.upload({
    buffer: file.buffer,
    contentType: file.mimetype,
    filename: file.originalname,
    folder: 'products',
  });

  // Single-image-per-product cap (MAX_IMAGES_PER_PRODUCT=1 per SOW) — a new
  // upload replaces the existing image rather than appending.
  const existingImage = product.images[0];
  const image = await prisma.$transaction(async (tx) => {
    if (existingImage) await tx.productImage.delete({ where: { id: existingImage.id } });
    return tx.productImage.create({
      data: { productId, url: uploaded.url, storageKey: uploaded.key, sortOrder: 0, altText: product.name },
    });
  });

  if (existingImage?.storageKey) {
    storageProvider.deleteObject(existingImage.storageKey).catch((err) => {
      console.error('Failed to delete replaced product image from storage:', err);
    });
  }

  await logAuthEvent({
    authAccountId: req.user!.id,
    eventType: 'product_image_updated',
    source: 'staff_app',
    req,
    metadata: { productId },
  });

  return image;
};

export const uploadCategoryImage = async (
  categoryId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  req: AuthenticatedRequest
) => {
  if (!storageProvider.isConfigured()) {
    throw new AppError('Image storage is not configured yet. Please contact support.', 503, 'STORAGE_NOT_CONFIGURED');
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new BadRequestError('Only JPEG, PNG, or WebP images are supported');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new BadRequestError('Image must be 8MB or smaller');
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new NotFoundError('Category not found');

  const uploaded = await storageProvider.upload({
    buffer: file.buffer,
    contentType: file.mimetype,
    filename: file.originalname,
    folder: 'categories',
  });

  const previousStorageKey = category.storageKey;
  const updated = await prisma.category.update({
    where: { id: categoryId },
    data: { imageUrl: uploaded.url, storageKey: uploaded.key },
  });

  if (previousStorageKey) {
    storageProvider.deleteObject(previousStorageKey).catch((err) => {
      console.error('Failed to delete replaced category image from storage:', err);
    });
  }

  await logAuthEvent({
    authAccountId: req.user!.id,
    eventType: 'category_image_updated',
    source: 'staff_app',
    req,
    metadata: { categoryId },
  });

  return updated;
};

export const uploadSubcategoryImage = async (
  subcategoryId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  req: AuthenticatedRequest
) => {
  if (!storageProvider.isConfigured()) {
    throw new AppError('Image storage is not configured yet. Please contact support.', 503, 'STORAGE_NOT_CONFIGURED');
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new BadRequestError('Only JPEG, PNG, or WebP images are supported');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new BadRequestError('Image must be 8MB or smaller');
  }

  const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
  if (!subcategory) throw new NotFoundError('Subcategory not found');

  // Own prefix, separate from category images — see storage provider's
  // folder-parameterized key convention.
  const uploaded = await storageProvider.upload({
    buffer: file.buffer,
    contentType: file.mimetype,
    filename: file.originalname,
    folder: 'subcategories',
  });

  const previousStorageKey = subcategory.storageKey;
  const updated = await prisma.subcategory.update({
    where: { id: subcategoryId },
    data: { imageUrl: uploaded.url, storageKey: uploaded.key },
  });

  if (previousStorageKey) {
    storageProvider.deleteObject(previousStorageKey).catch((err) => {
      console.error('Failed to delete replaced subcategory image from storage:', err);
    });
  }

  await logAuthEvent({
    authAccountId: req.user!.id,
    eventType: 'subcategory_image_updated',
    source: 'staff_app',
    req,
    metadata: { subcategoryId },
  });

  return { ...updated, hasOwnImage: true };
};
