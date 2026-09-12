import { Router } from 'express';
import multer from 'multer';
import * as controller from './catalog.admin.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import {
  createCategorySchema,
  updateCategorySchema,
  createSubcategorySchema,
  updateSubcategorySchema,
  createProductSchema,
  updateProductSchema,
  listAdminProductsQuerySchema,
} from './catalog.admin.schema';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.use(authenticate);

// Categories are purely organizational (name/description/image/sort) —
// ADMIN only, same permission tier as before.
router.get('/categories', requireRoles('ADMIN', 'STAFF'), controller.getCategories);
router.post('/categories', requireRoles('ADMIN'), validateBody(createCategorySchema), controller.createCategory);
router.patch('/categories/:categoryId', requireRoles('ADMIN'), validateBody(updateCategorySchema), controller.updateCategory);
router.post(
  '/categories/:categoryId/image',
  requireRoles('ADMIN'),
  upload.single('image'),
  controller.uploadCategoryImage
);

// Subcategories carry price + description + hide/unhide — owner (ADMIN)
// only to write, per the doc's "staff can manage catalog but not edit
// prices" rule; STAFF can still read them (needed for the product form).
router.get('/categories/:categoryId/subcategories', requireRoles('ADMIN', 'STAFF'), controller.getSubcategories);
router.post(
  '/categories/:categoryId/subcategories',
  requireRoles('ADMIN'),
  validateBody(createSubcategorySchema),
  controller.createSubcategory
);
router.patch(
  '/subcategories/:subcategoryId',
  requireRoles('ADMIN'),
  validateBody(updateSubcategorySchema),
  controller.updateSubcategory
);
// Permanent removal, ADMIN only — hiding (PATCH isActive:false) stays the
// everyday tool. The service refuses when real sales history is at stake.
router.delete('/subcategories/:subcategoryId', requireRoles('ADMIN'), controller.deleteSubcategory);
router.post(
  '/subcategories/:subcategoryId/image',
  requireRoles('ADMIN'),
  upload.single('image'),
  controller.uploadSubcategoryImage
);

// Products carry no price — ADMIN and STAFF can both manage the catalog.
router.get('/products/stats', requireRoles('ADMIN', 'STAFF'), controller.getProductStats);
router.get('/products', requireRoles('ADMIN', 'STAFF'), validateQuery(listAdminProductsQuerySchema), controller.getProducts);
router.get('/products/:productId', requireRoles('ADMIN', 'STAFF'), controller.getProduct);
router.post('/products', requireRoles('ADMIN', 'STAFF'), validateBody(createProductSchema), controller.createProduct);
router.patch('/products/:productId', requireRoles('ADMIN', 'STAFF'), validateBody(updateProductSchema), controller.updateProduct);
router.post(
  '/products/:productId/image',
  requireRoles('ADMIN', 'STAFF'),
  upload.single('image'),
  controller.uploadProductImage
);

export default router;
