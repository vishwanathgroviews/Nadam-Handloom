"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = exports.requirePermissions = void 0;
const requirePermissions = (requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const userPermissions = req.user.permissions || [];
        const hasAllPermissions = requiredPermissions.every(perm => userPermissions.includes(perm));
        if (!hasAllPermissions) {
            res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
            return;
        }
        next();
    };
};
exports.requirePermissions = requirePermissions;
const requireRoles = (requiredRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const userRoles = req.user.roles || [];
        const hasRole = requiredRoles.some(role => userRoles.includes(role));
        if (!hasRole) {
            res.status(403).json({ error: 'Forbidden: Insufficient roles' });
            return;
        }
        next();
    };
};
exports.requireRoles = requireRoles;
//# sourceMappingURL=rbac.middleware.js.map