// Refuses the request unless the signed-in person's role has the permission.
// Runs after authenticate, which reads the role from the database on every request.
import { can } from '../config/permissions.js';
import { forbidden } from '../utils/errors.js';

export const requirePermission = (permission) => (req, _res, next) =>
  next(can(req.auth?.role, permission) ? undefined : forbidden('FORBIDDEN', 'Only owners can do this.', { permission }));
