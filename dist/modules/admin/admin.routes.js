"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const express_1 = require("express");
const auth_controller_1 = require("../auth/auth.controller");
const auth_schema_1 = require("../auth/auth.schema");
const jwt_middleware_1 = require("../../middleware/jwt.middleware");
const rbac_middleware_1 = require("../../middleware/rbac.middleware");
const router = (0, express_1.Router)();
const validate = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        }
        catch (error) {
            res.status(400).json(error);
        }
    };
};
/**
 * @openapi
 * /admin/users:
 *   post:
 *     summary: Provision an admin/staff account (ADMIN only). Sends a password-set invite email.
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, roleId]
 *             properties:
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               roleId: { type: string, format: uuid }
 *               employeeId: { type: string }
 *               department: { type: string }
 *               jobTitle: { type: string }
 *     responses:
 *       201: { description: User provisioned, invite email sent }
 *       400: { description: Validation error or account already exists }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (not ADMIN) }
 */
router.post('/users', jwt_middleware_1.authenticateJWT, (0, rbac_middleware_1.requireRoles)(['ADMIN']), validate(auth_schema_1.adminProvisionSchema), auth_controller_1.AuthController.adminProvision);
exports.adminRoutes = router;
//# sourceMappingURL=admin.routes.js.map