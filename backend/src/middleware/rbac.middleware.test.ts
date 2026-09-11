import { describe, expect, it, vi } from 'vitest';
import { requireRoles, requirePermissions } from './rbac.middleware';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import type { AuthenticatedRequest } from './auth.middleware';

const makeReq = (user?: AuthenticatedRequest['user']) => ({ user }) as AuthenticatedRequest;

describe('rbac.middleware', () => {
  it('requireRoles allows a matching role', () => {
    const next = vi.fn();
    requireRoles('ADMIN', 'STAFF')(makeReq({ id: '1', roles: ['STAFF'], permissions: [] }), {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('requireRoles rejects a non-matching role', () => {
    const next = vi.fn();
    requireRoles('ADMIN')(makeReq({ id: '1', roles: ['STAFF'], permissions: [] }), {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('requireRoles rejects when unauthenticated', () => {
    const next = vi.fn();
    requireRoles('ADMIN')(makeReq(undefined), {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('requirePermissions allows a matching permission', () => {
    const next = vi.fn();
    requirePermissions('users:read')(makeReq({ id: '1', roles: [], permissions: ['users:read'] }), {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('requirePermissions rejects a missing permission', () => {
    const next = vi.fn();
    requirePermissions('users:delete')(makeReq({ id: '1', roles: [], permissions: ['users:read'] }), {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
