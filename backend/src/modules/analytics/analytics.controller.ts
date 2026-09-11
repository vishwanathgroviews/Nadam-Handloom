import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { QueryValidatedRequest } from '../../middleware/validate.middleware';
import * as analyticsService from './analytics.service';

export const getSummary = async (req: AuthenticatedRequest & QueryValidatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await analyticsService.getSummary(req.validatedQuery);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getTopSubcategories = async (req: AuthenticatedRequest & QueryValidatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await analyticsService.getTopSubcategories(req.validatedQuery);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
