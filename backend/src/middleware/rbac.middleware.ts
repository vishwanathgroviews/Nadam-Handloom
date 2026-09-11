import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export const requireRoles = (...allowed: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!req.user.roles.some((role) => allowed.includes(role))) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
};

export const requirePermissions = (...allowed: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!req.user.permissions.some((permission) => allowed.includes(permission))) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
};
