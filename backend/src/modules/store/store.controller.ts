import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import * as storeService from './store.service';

export const getStoreContact = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await storeService.getStoreContact();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateStoreSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await storeService.updateStorePhone(req.body.phone, req);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Store phone number updated successfully',
    });
  } catch (error) {
    next(error);
  }
};
