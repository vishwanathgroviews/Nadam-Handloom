import { Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { UnauthorizedError } from '../../utils/errors';

const userService = new UserService();

export class UserController {
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const profile = await userService.getProfile(req.user.id);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const profile = await userService.getStaffProfile(req.user.id);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const profile = await userService.updateProfile(req.user.id, req.body);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
}
