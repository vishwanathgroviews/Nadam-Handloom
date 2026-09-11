import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import * as billingService from './billing.service';

export const completeSale = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await billingService.completeSale(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
