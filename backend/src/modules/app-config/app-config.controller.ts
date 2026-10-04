import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import * as appConfigService from './app-config.service';

export const getAppConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await appConfigService.getAppConfig();
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

export const updateAppConfig = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const config = await appConfigService.updateAppConfig(req.body, req.user!.id, req);
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};
