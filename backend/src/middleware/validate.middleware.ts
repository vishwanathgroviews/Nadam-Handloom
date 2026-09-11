import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { BadRequestError } from '../utils/errors';

export const validateBody =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new BadRequestError('Validation failed', details));
    }
    req.body = result.data;
    next();
  };

export interface QueryValidatedRequest extends Request {
  validatedQuery?: any;
}

// Express 5 makes req.query a read-only getter, so validated query params are
// stashed on req.validatedQuery instead of reassigning req.query.
export const validateQuery =
  (schema: ZodType) => (req: QueryValidatedRequest, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new BadRequestError('Validation failed', details));
    }
    req.validatedQuery = result.data;
    next();
  };
