import { Router, Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { AuthController } from '../auth/auth.controller';
import { adminProvisionSchema } from '../auth/auth.schema';
import { authenticateJWT } from '../../middleware/jwt.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';

const router = Router();

const validate = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
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
router.post(
  '/users',
  authenticateJWT,
  requireRoles(['ADMIN']),
  validate(adminProvisionSchema),
  AuthController.adminProvision
);

export const adminRoutes = router;
