import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import * as notificationsService from './notifications.service';

export const registerDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await notificationsService.registerDevice(req.user!.id, req.body.expoPushToken, req.body.platform);
    res.status(200).json({ success: true, data: { registered: true } });
  } catch (error) {
    next(error);
  }
};

export const unregisterDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await notificationsService.unregisterDevice(req.body.expoPushToken);
    res.status(200).json({ success: true, data: { unregistered: true } });
  } catch (error) {
    next(error);
  }
};
