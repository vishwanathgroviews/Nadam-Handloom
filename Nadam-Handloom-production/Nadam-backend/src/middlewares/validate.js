// Checks req.body / req.query / req.params against a zod schema; the clean result is req.valid.
// Control and invisible characters are removed first (utils/text.js), so they can never
// reach the database (which refuses NUL) or a customer's screen.
import { badRequest } from '../utils/errors.js';
import { cleanDeep } from '../utils/text.js';

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(cleanDeep(req[source] ?? {}));
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(badRequest('VALIDATION_FAILED', issues[0]?.message || 'Some details are missing or wrong.', { issues }));
  }
  req.valid = { ...(req.valid || {}), ...result.data };
  return next();
};
