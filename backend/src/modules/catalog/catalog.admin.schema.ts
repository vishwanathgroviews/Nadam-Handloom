import { z } from 'zod';

export const CHANNEL_VISIBILITY = ['online_only', 'store_only', 'both', 'hidden'] as const;
export const TRACKING_MODE = ['quantity', 'serialized'] as const;

// A category is purely organizational now — name/description/image/sort.
// Price, per-item description, and hide/unhide all live one level down, on
// Subcategory (see createSubcategorySchema below). imageUrl is deliberately
// NOT settable here — it can only be written by the dedicated S3 upload
// endpoint (POST /categories/:id/image, see uploadCategoryImage), the same
// way Subcategory images already work, so every category/subcategory photo
// is guaranteed to come from S3 rather than an arbitrary external URL.
export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100),
  description: z.string().trim().min(1, 'Description is required').max(2000),
  sortOrder: z.coerce.number().int().optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Subcategories own price + description — see catalog.admin.service.ts.
// Every product listed under a subcategory sells at that subcategory's price
// and shares its description; there is no per-product override.
export const createSubcategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().trim().min(1, 'Description is required').max(2000),
  onlinePrice: z.coerce.number().positive('Online price must be greater than 0'),
  storePrice: z.coerce.number().positive('Store price must be greater than 0'),
  mrp: z.coerce.number().positive().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const updateSubcategorySchema = createSubcategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listAdminProductsQuerySchema = z.object({
  category: z.string().uuid().optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const attributeField = () => z.string().trim().max(100).optional();

export const createProductSchema = z.object({
  // Optional — left blank, the product takes its subcategory's name (see
  // catalog.admin.service.ts's createProduct), since most listings under a
  // single-item subcategory don't need a distinct name of their own.
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(200).optional(),
  categoryId: z.string().uuid('A category is required'),
  subcategoryId: z.string().uuid('A subcategory is required'),
  technique: attributeField(),
  borderStyle: attributeField(),
  purity: attributeField(),
  zariTier: attributeField(),
  blouseType: attributeField(),
  pattern: attributeField(),
  color: attributeField(),
  fabric: attributeField(),
  occasion: z.array(z.string().trim().max(50)).max(20).optional(),
  channelVisibility: z.enum(CHANNEL_VISIBILITY).default('both'),
  // Display-only now — every product can carry both legacy `stock` and
  // scanned Piece rows at once (see Piece/Product schema comments). New
  // stock always arrives via receivePieces, never a client-supplied number.
  trackingMode: z.enum(TRACKING_MODE).default('quantity'),
  isFeatured: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  // The physical units staff scanned while filling in this form. Assigned in
  // the same transaction that creates the product (see createProduct), so a
  // new product is never listed with zero stock because a follow-up call
  // failed. Same shape/limits as receivePieces' batch.
  barcodes: z.array(z.string().trim().min(3).max(64)).max(200).optional(),
});

// Barcodes are deliberately not updatable here — an existing product's units
// are added and removed through the inventory endpoints, which keep the stock
// ledger straight.
export const updateProductSchema = createProductSchema.omit({ barcodes: true }).partial();
