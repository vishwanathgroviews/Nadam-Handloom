import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { QueryValidatedRequest } from '../../middleware/validate.middleware';
import { UnauthorizedError } from '../../utils/errors';
import * as ordersService from './orders.service';
import { getInvoiceByOrderId } from '../invoices/invoices.service';

export const checkout = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const result = await ordersService.checkout(req.user.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const result = await ordersService.verifyPayment(req.user.id, req.params.orderId as string, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const listOrders = async (req: AuthenticatedRequest & QueryValidatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { page, pageSize } = req.validatedQuery;
    const result = await ordersService.listOrders(req.user.id, page, pageSize);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const order = await ordersService.getOrder(req.user.id, req.params.orderId as string);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const getOrderTracking = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const tracking = await ordersService.getOrderTracking(req.user.id, req.params.orderId as string);
    res.status(200).json({ success: true, data: tracking });
  } catch (error) {
    next(error);
  }
};

export const getOrderInvoice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const invoice = await getInvoiceByOrderId(req.params.orderId as string, req.user.id);
    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};
