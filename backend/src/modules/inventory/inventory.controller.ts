import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { QueryValidatedRequest } from '../../middleware/validate.middleware';
import { ForbiddenError } from '../../utils/errors';
import * as inventoryService from './inventory.service';

export const scanLookup = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await inventoryService.scanLookup(req.body.code, { exact: req.body.exact });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const scanSell = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // The schema normalises every sale into items[], so the override flag
    // lives per line — a bill is ADMIN-only if ANY line overrides an online
    // reservation. Reading a top-level req.body.override here would silently
    // let STAFF self-authorize by sending the multi-item form.
    const overridesReservation = Array.isArray(req.body.items)
      ? req.body.items.some((item: { override?: boolean }) => item.override)
      : Boolean(req.body.override);
    if (overridesReservation && !req.user!.roles.includes('ADMIN')) {
      throw new ForbiddenError('Only the owner can override a reserved item');
    }
    const result = await inventoryService.scanSell(req.body, req.user!.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const receivePieces = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const pieces = await inventoryService.receivePieces(req.params.productId as string, req.body.barcodes, req.user!.id);
    res.status(201).json({ success: true, data: pieces });
  } catch (error) {
    next(error);
  }
};

export const listPieces = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const pieces = await inventoryService.listPieces(req.params.productId as string);
    res.status(200).json({ success: true, data: pieces });
  } catch (error) {
    next(error);
  }
};

export const getLedger = async (req: AuthenticatedRequest & QueryValidatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await inventoryService.getStockLedger(req.validatedQuery);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getLowStock = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await inventoryService.getLowStock();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
