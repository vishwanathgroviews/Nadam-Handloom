// The website's catalogue queries (W2–W4). Visibility comes from services/shop/visibility.js.
import { prisma } from '../config/database.js';

// What a saree card needs.
export const CARD_SELECT = {
  id: true, slug: true, sku: true, name: true, createdAt: true, stock: true, subcategoryId: true,
  category: { select: { slug: true, name: true } },
  subcategory: { select: { id: true, name: true, onlinePrice: true } },
  images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: 1, select: { url: true, altText: true } },
  _count: { select: { pieces: { where: { status: 'in_stock' } } } },
};

// Every visible saree, briefly: the base of every count on the website.
export const visibleSummary = (where, db = prisma) =>
  db.product.findMany({
    where,
    select: { id: true, subcategoryId: true, categoryId: true, createdAt: true, stock: true, _count: { select: { pieces: { where: { status: 'in_stock' } } } } },
  });

export const activeCategories = (db = prisma) =>
  db.category.findMany({ where: { isActive: true, status: 'active' }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, slug: true, name: true, description: true, imageUrl: true, sortOrder: true } });

export const activeCollections = (db = prisma) =>
  db.subcategory.findMany({
    where: { isActive: true, status: 'active', category: { is: { isActive: true, status: 'active' } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, categoryId: true, name: true, description: true, imageUrl: true, onlinePrice: true, sortOrder: true },
  });

// The newest visible saree of each collection (its photo stands in for a collection photo).
export const newestPerCollection = (where, db = prisma) =>
  db.product.findMany({
    where,
    distinct: ['subcategoryId'],
    orderBy: [{ subcategoryId: 'asc' }, { createdAt: 'desc' }],
    select: { subcategoryId: true, images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: 1, select: { url: true } } },
  });

export const cards = ({ where, orderBy, skip = 0, take }, db = prisma) =>
  db.product.findMany({ where, orderBy, skip, take, select: CARD_SELECT });

export const count = (where, db = prisma) => db.product.count({ where });

export const groupByCollection = (where, db = prisma) =>
  db.product.groupBy({ by: ['subcategoryId'], where, _count: { _all: true } });

export const findBySlug = (slug, db = prisma) =>
  db.product.findUnique({
    where: { slug },
    select: {
      ...CARD_SELECT,
      isActive: true, deletedAt: true, channelVisibility: true,
      technique: true, borderStyle: true, purity: true, zariTier: true, blouseType: true, pattern: true, color: true, fabric: true, occasion: true,
      category: { select: { slug: true, name: true, description: true, isActive: true, status: true } },
      subcategory: { select: { id: true, name: true, description: true, onlinePrice: true, isActive: true, status: true } },
      images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { url: true, altText: true } },
      pieces: { where: { status: 'in_stock' }, select: { status: true } },
    },
  });
