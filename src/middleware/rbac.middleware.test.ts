import { describe, it, expect, vi } from 'vitest';
import { requirePermissions, requireRoles } from './rbac.middleware';
import { AuthenticatedRequest } from './jwt.middleware';

const makeRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('rbac.middleware', () => {
  describe('requirePermissions', () => {
    it('calls next() when the user has all required permissions', () => {
      const req = { user: { id: '1', roles: [], permissions: ['users:read', 'users:write'] } } as AuthenticatedRequest;
      const res = makeRes();
      const next = vi.fn();

      requirePermissions(['users:read'])(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('responds 403 when a required permission is missing', () => {
      const req = { user: { id: '1', roles: [], permissions: ['users:read'] } } as AuthenticatedRequest;
      const res = makeRes();
      const next = vi.fn();

      requirePermissions(['users:delete'])(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('responds 401 when there is no authenticated user', () => {
      const req = {} as AuthenticatedRequest;
      const res = makeRes();
      const next = vi.fn();

      requirePermissions(['users:read'])(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireRoles', () => {
    it('calls next() when the user has one of the required roles', () => {
      const req = { user: { id: '1', roles: ['ADMIN'], permissions: [] } } as AuthenticatedRequest;
      const res = makeRes();
      const next = vi.fn();

      requireRoles(['ADMIN', 'STAFF'])(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('responds 403 when the user has none of the required roles', () => {
      const req = { user: { id: '1', roles: ['CUSTOMER'], permissions: [] } } as AuthenticatedRequest;
      const res = makeRes();
      const next = vi.fn();

      requireRoles(['ADMIN'])(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
