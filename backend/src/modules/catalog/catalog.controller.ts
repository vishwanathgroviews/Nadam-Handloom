import { Request, Response, NextFunction } from 'express';
import { QueryValidatedRequest } from '../../middleware/validate.middleware';
import * as catalogService from './catalog.service';

export const getCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await catalogService.listCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

export const getSubcategoriesForCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await catalogService.listSubcategoriesForCategory(req.params.slug as string);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (req: QueryValidatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await catalogService.listProducts(req.validatedQuery);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getProductBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await catalogService.getProductBySlug(req.params.slug as string);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

