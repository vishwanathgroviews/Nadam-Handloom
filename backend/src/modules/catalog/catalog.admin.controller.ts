import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { QueryValidatedRequest } from '../../middleware/validate.middleware';
import { BadRequestError } from '../../utils/errors';
import * as catalogAdminService from './catalog.admin.service';

export const getCategories = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await catalogAdminService.listAllCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const category = await catalogAdminService.createCategory(req.body, req);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const category = await catalogAdminService.updateCategory(req.params.categoryId as string, req.body, req);
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const getSubcategories = async (req: AuthenticatedRequest & QueryValidatedRequest, res: Response, next: NextFunction) => {
  try {
    const query = req.validatedQuery;
    const data = query.page
      ? await catalogAdminService.listSubcategoriesPage(req.params.categoryId as string, query)
      : await catalogAdminService.listSubcategories(req.params.categoryId as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createSubcategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subcategory = await catalogAdminService.createSubcategory(req.params.categoryId as string, req.body, req);
    res.status(201).json({ success: true, data: subcategory });
  } catch (error) {
    next(error);
  }
};

export const updateSubcategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subcategory = await catalogAdminService.updateSubcategory(req.params.subcategoryId as string, req.body, req);
    res.status(200).json({ success: true, data: subcategory });
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (req: AuthenticatedRequest & QueryValidatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await catalogAdminService.listAllProducts(req.validatedQuery);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getProductStats = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await catalogAdminService.getProductStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const getProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const product = await catalogAdminService.getProductById(req.params.productId as string);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const product = await catalogAdminService.createProduct(req.body, req);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const product = await catalogAdminService.updateProduct(req.params.productId as string, req.body, req);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const uploadProductImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const file = (req as any).file;
    if (!file) throw new BadRequestError('No image file was uploaded');
    const image = await catalogAdminService.uploadProductImage(req.params.productId as string, file, req);
    res.status(200).json({ success: true, data: image });
  } catch (error) {
    next(error);
  }
};

export const uploadCategoryImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const file = (req as any).file;
    if (!file) throw new BadRequestError('No image file was uploaded');
    const category = await catalogAdminService.uploadCategoryImage(req.params.categoryId as string, file, req);
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const deleteSubcategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await catalogAdminService.deleteSubcategory(req.params.subcategoryId as string, req);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const uploadSubcategoryImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const file = (req as any).file;
    if (!file) throw new BadRequestError('No image file was uploaded');
    const subcategory = await catalogAdminService.uploadSubcategoryImage(req.params.subcategoryId as string, file, req);
    res.status(200).json({ success: true, data: subcategory });
  } catch (error) {
    next(error);
  }
};
