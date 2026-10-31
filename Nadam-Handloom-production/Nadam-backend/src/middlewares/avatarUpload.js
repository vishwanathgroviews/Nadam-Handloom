// Website (W1): one profile picture from a multipart form (field "photo"), in memory,
// up to 5 MB; JPEG, PNG or WebP (iPhones send JPEG when a photo is picked in the browser).
// The profile service checks it really is a picture.
import multer from 'multer';
import { SHOP } from '../config/constants.js';
import { badRequest } from '../utils/errors.js';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SHOP.AVATAR_MAX_BYTES, files: 1, fields: 2 },
  fileFilter: (_req, file, cb) => (TYPES.includes(file.mimetype) ? cb(null, true) : cb(badRequest('PHOTO_TYPE', 'Use a JPEG, PNG or WebP photo.'))),
}).single('photo');

export function avatarUpload(req, res, next) {
  parser(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return next(badRequest('PHOTO_TOO_LARGE', 'The photo is larger than 5 MB. Please choose a smaller one.'));
    if (err) return next(err.status ? err : badRequest('PHOTO_UPLOAD_FAILED', 'The photo could not be received. Please try again.'));
    if (!req.file) return next(badRequest('PHOTO_MISSING', 'Choose a photo first.'));
    return next();
  });
}
