// Turns every error into { error: { code, message, details } } with the right status.
// Unknown errors are logged and never leak internals to the app.
import { AppError } from '../utils/errors.js';

export function notFound(_req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', 'This address does not exist.'));
}

// The database refused a character (NUL, bad UTF-8). Input is cleaned before it is checked
// (utils/text.js), so this is only a safety net: the person gets a message, not a 500.
const BAD_TEXT_CODES = ['22021', '22P05'];
const isBadText = (err) => BAD_TEXT_CODES.includes(err?.meta?.driverAdapterError?.cause?.code);

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let e = err;
  if (err?.type === 'entity.parse.failed') e = new AppError(400, 'BAD_JSON', 'The request was not valid JSON.');
  else if (err?.type === 'entity.too.large') e = new AppError(413, 'TOO_LARGE', 'The request is too large.');
  else if (isBadText(err)) e = new AppError(400, 'BAD_TEXT', 'Some text has a character we can\'t save. Remove it and try again.');
  else if (!(err instanceof AppError)) {
    // The reference is shown to the person, so they can quote it; the log has the details.
    const reference = String(req.id || '').slice(0, 8).toUpperCase() || undefined;
    console.error(`[error] ${reference || '-'} ${req.method} ${req.originalUrl}:`, err);
    e = new AppError(500, 'INTERNAL', 'Something went wrong on our side. Please try again.', reference ? { reference } : undefined);
  }
  if (e.status === 429 && e.details?.retryAfterSeconds) res.set('Retry-After', String(e.details.retryAfterSeconds));
  res.status(e.status).json({ error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } });
}
