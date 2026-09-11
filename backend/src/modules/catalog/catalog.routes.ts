import { Router } from 'express';
import * as controller from './catalog.controller';
import { validateQuery } from '../../middleware/validate.middleware';
import { listProductsQuerySchema } from './catalog.schema';

const router = Router();

router.get('/categories', controller.getCategories);
router.get('/categories/:slug/subcategories', controller.getSubcategoriesForCategory);
router.get('/products', validateQuery(listProductsQuerySchema), controller.getProducts);
router.get('/products/:slug', controller.getProductBySlug);

export default router;
