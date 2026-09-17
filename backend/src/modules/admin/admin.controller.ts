import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { QueryValidatedRequest } from '../../middleware/validate.middleware';
import * as adminService from './admin.service';

export const createUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.provisionUser(req.body, req);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const users = await adminService.listUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const revokeUserAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.revokeUserAccess(
      req.params.userId as string,
      req.user!.id,
      req
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const listOrders = async (req: AuthenticatedRequest & QueryValidatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.listOrdersForAdmin(req.validatedQuery);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const order = await adminService.getOrderForAdmin(req.params.orderId as string);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const updateShipment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.markOrderShipped(req.params.orderId as string, req.body, req);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getAuditLog = async (req: AuthenticatedRequest & QueryValidatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getAuditLog(req.validatedQuery);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getSessions = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sessions = await adminService.listActiveSessions();
    res.status(200).json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
};

export const revokeSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await adminService.revokeSession(req.params.sessionId as string, req);
    res.status(200).json({ success: true, data: { revoked: true } });
  } catch (error) {
    next(error);
  }
};

export const getDashboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await adminService.getDashboardStats(req.user!.roles);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};
