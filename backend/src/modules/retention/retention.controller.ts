import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import * as retentionService from './retention.service';

export const getPurgePreview = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await retentionService.previewPurge();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const runPurge = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await retentionService.purgeOldOrders();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const exportCsv = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const csv = await retentionService.generateOrdersCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
