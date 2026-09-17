import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { NotFoundError } from '../../utils/errors';
import { ListProductsQuery } from './catalog.schema';
import { withAvailability, withAvailabilityOne } from './catalog.availability';

// Products a customer may ever see: active, not store-only/hidden, and its
// subcategory (and category) aren't hidden from the customer web.
const CATEGORY_SELECT = { name: true, slug: true, description: true } as const;
const SUBCATEGORY_SELECT = { id: true, name: true, description: true, onlinePrice: true, mrp: true, isActive: true } as const;
const CUSTOMER_VISIBLE_CHANNELS = ['online_only', 'both'];

/**
 * Only products that can actually be bought right now.
 *
 * Every listing is a single handloom piece, so "out of stock" means "this
 * exact saree has been sold" — showing it greyed out offers the customer
 * something that will never come back. It is a real filter rather than a
 * post-query one so paging and totals stay honest: filtering after the fact
 * would return short pages and a count that disagreed with them.
 *
 * Mirrors catalog.availability.ts's definition of availability: the legacy
 * bulk counter, or at least one in_stock Piece.
 */
const IN_STOCK: Prisma.ProductWhereInput = {
  OR: [{ stock: { gt: 0 } }, { pieces: { some: { status: 'in_stock' } } }],
};

export const listCategories = async () => {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
};

export const getCategoryBySlug = async (slug: string) => {
  const category = await prisma.category.findFirst({ where: { slug, isActive: true } });
  if (!category) throw new NotFoundError('Category not found');
  return category;
};

// A subcategory shows the photo uploaded for that subcategory, or nothing.
// It does not inherit the category's photo and does not borrow a product's:
// both were tried, and both meant one upload silently changed the picture on
// rows nobody had edited. The storefront card renders a placeholder when
// there is no photo yet.
export const listSubcategoriesForCategory = async (categorySlug: string) => {
  const category = await prisma.category.findFirst({ where: { slug: categorySlug, isActive: true } });
  if (!category) throw new NotFoundError('Category not found');

  const subcategories = await prisma.subcategory.findMany({
    where: { categoryId: category.id, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  return {
    category: { id: category.id, name: category.name, slug: category.slug, description: category.description, imageUrl: category.imageUrl },
    subcategories: subcategories.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      onlinePrice: s.onlinePrice,
      mrp: s.mrp,
      imageUrl: s.imageUrl ?? null,
    })),
  };
};

const buildProductWhere = (query: ListProductsQuery, categoryId?: string) => {
  const where: any = {
    isActive: true,
    channelVisibility: { in: CUSTOMER_VISIBLE_CHANNELS },
    category: { is: { isActive: true } },
    subcategory: { is: { isActive: true } },
  };
  // AND, not a second top-level OR — `q` search below already owns where.OR,
  // and merging the two would turn "in stock" into "or matches the search".
  where.AND = [IN_STOCK];
  if (categoryId) where.categoryId = categoryId;
  if (query.subcategoryId) where.subcategoryId = query.subcategoryId;
  if (query.featured) where.isFeatured = true;

  const attributeFilters: [keyof ListProductsQuery, string][] = [
    ['technique', 'technique'],
    ['borderStyle', 'borderStyle'],
    ['purity', 'purity'],
    ['zariTier', 'zariTier'],
    ['blouseType', 'blouseType'],
    ['pattern', 'pattern'],
    ['color', 'color'],
  ];
  for (const [queryKey, field] of attributeFilters) {
    const values = query[queryKey] as string[] | undefined;
    if (values?.length) where[field] = { in: values };
  }

  if (query.subCategory?.length) {
    where.subcategory = { is: { ...where.subcategory.is, name: { in: query.subCategory } } };
  }

  if (query.occasion?.length) where.occasion = { hasSome: query.occasion };

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.subcategory = {
      is: {
        ...where.subcategory.is,
        onlinePrice: {
          ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
          ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
        },
      },
    };
  }

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { technique: { contains: query.q, mode: 'insensitive' } },
      { pattern: { contains: query.q, mode: 'insensitive' } },
      { color: { contains: query.q, mode: 'insensitive' } },
      { category: { is: { description: { contains: query.q, mode: 'insensitive' } } } },
      { subcategory: { is: { name: { contains: query.q, mode: 'insensitive' } } } },
      { subcategory: { is: { description: { contains: query.q, mode: 'insensitive' } } } },
    ];
  }

  return where;
};

const SORT_MAP: Record<ListProductsQuery['sort'], any> = {
  newest: { createdAt: 'desc' },
  price_asc: { subcategory: { onlinePrice: 'asc' } },
  price_desc: { subcategory: { onlinePrice: 'desc' } },
  featured: { isFeatured: 'desc' },
};

export const listProducts = async (query: ListProductsQuery) => {
  let categoryId: string | undefined;
  if (query.category) {
    const category = await prisma.category.findFirst({ where: { slug: query.category, isActive: true } });
    if (!category) return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
    categoryId = category.id;
  }

  const where = buildProductWhere(query, categoryId);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: SORT_MAP[query.sort],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        category: { select: CATEGORY_SELECT },
        subcategory: { select: SUBCATEGORY_SELECT },
        images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { items: await withAvailability(items), total, page: query.page, pageSize: query.pageSize };
};

export const getProductBySlug = async (slug: string) => {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      isActive: true,
      channelVisibility: { in: CUSTOMER_VISIBLE_CHANNELS },
      category: { is: { isActive: true } },
      subcategory: { is: { isActive: true } },
      // A sold piece is gone for good, so its page is genuinely not found
      // rather than a listing with the buttons greyed out. An old link or a
      // stale tab lands on the storefront's "no longer available" state.
      AND: [IN_STOCK],
    },
    include: {
      category: { select: CATEGORY_SELECT },
      subcategory: { select: SUBCATEGORY_SELECT },
      images: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!product) throw new NotFoundError('Product not found');
  // A unit received via the barcode intake flow only ever creates a Piece
  // row and never touches `stock` — availableCount is what "in stock" must
  // mean here, not the raw counter (see catalog.availability.ts).
  return withAvailabilityOne(product);
};

/**
 * Live availability for a set of products, for the cart and checkout.
 *
 * The cart lives in the browser's localStorage and can sit there for days,
 * so what it remembers about a product is only ever a snapshot. Checkout
 * asks this before letting the customer pay: the authoritative claim still
 * happens atomically in reserveItemsForOrder, but failing at the Razorpay
 * step is a bad way to learn an item sold out.
 *
 * Unknown ids come back as unavailable rather than being dropped, so a
 * product deleted since it was added to the cart is still reported on.
 */
export const getAvailabilityForProducts = async (productIds: string[]) => {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, isActive: true, channelVisibility: true, stock: true },
  });

  const withCounts = await withAvailability(products);
  const byId = new Map(withCounts.map((p) => [p.id, p]));

  return unique.map((id) => {
    const product = byId.get(id);
    if (!product) {
      return { productId: id, name: null, availableCount: 0, isPurchasable: false };
    }
    const sellableOnline = product.isActive && CUSTOMER_VISIBLE_CHANNELS.includes(product.channelVisibility);
    return {
      productId: id,
      name: product.name,
      availableCount: sellableOnline ? product.availableCount : 0,
      isPurchasable: sellableOnline && product.availableCount > 0,
    };
  });
};
