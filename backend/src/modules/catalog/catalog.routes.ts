import { Router } from 'express';
import * as controller from './catalog.controller';
import { validateQuery, validateBody } from '../../middleware/validate.middleware';
import { listProductsQuerySchema, availabilityBodySchema } from './catalog.schema';

const router = Router();

router.get('/categories', controller.getCategories);
router.get('/categories/:slug/subcategories', controller.getSubcategoriesForCategory);
router.get('/products', validateQuery(listProductsQuerySchema), controller.getProducts);
router.get('/products/:slug', controller.getProductBySlug);
// POST rather than GET: a cart can hold more ids than belong in a query string.
router.post('/availability', validateBody(availabilityBodySchema), controller.getAvailability);

export default router;
