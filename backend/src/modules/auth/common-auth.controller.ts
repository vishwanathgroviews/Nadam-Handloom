import { Request, Response, NextFunction } from 'express';
import { rotateSession, revokeCurrentSession } from './session.service';

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokens = await rotateSession(req, res);
    res.status(200).json({ success: true, data: { tokens } });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeCurrentSession(req, res);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};
