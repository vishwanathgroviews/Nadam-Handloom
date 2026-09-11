import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { AppError } from '../utils/errors';

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) console.error(err);
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // A rejected upload (oversized file, wrong field name, etc.) is a client
  // mistake, not a server failure — without this it fell through to the
  // generic 500 below, showing "Internal Server Error" for what's really a
  // "your photo is too large" case.
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 8MB or smaller' : `Upload error: ${err.message}`;
    return res.status(400).json({ success: false, message, code: err.code });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A record with these details already exists',
      code: 'CONFLICT',
    });
  }

  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
