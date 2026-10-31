// One photo from a multipart form (field "photo"), kept in memory: up to 8 MB,
// JPEG, PNG or WebP. The photo service checks it really is a picture.
import multer from 'multer';
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from '../services/photo.service.js';
import { badRequest } from '../utils/errors.js';

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => (ACCEPTED_TYPES.includes(file.mimetype) ? cb(null, true) : cb(badRequest('PHOTO_TYPE', 'Use a JPEG, PNG or WebP photo.'))),
}).single('photo');

export function photoUpload(req, res, next) {
  parser(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return next(badRequest('PHOTO_TOO_LARGE', 'The photo is larger than 8 MB.'));
    if (err) return next(err.status ? err : badRequest('PHOTO_UPLOAD_FAILED', 'The photo could not be received. Please try again.'));
    if (!req.file) return next(badRequest('PHOTO_MISSING', 'Choose a photo first.'));
    return next();
  });
}
