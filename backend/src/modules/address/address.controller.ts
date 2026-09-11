import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { UnauthorizedError } from '../../utils/errors';
import * as addressService from './address.service';

export const list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const addresses = await addressService.listAddresses(req.user.id);
    res.status(200).json({ success: true, data: addresses });
  } catch (error) {
    next(error);
  }
};

export const create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const address = await addressService.createAddress(req.user.id, req.body);
    res.status(201).json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

export const update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    const address = await addressService.updateAddress(req.user.id, req.params.id as string, req.body);
    res.status(200).json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError();
    await addressService.deleteAddress(req.user.id, req.params.id as string);
    res.status(200).json({ success: true, message: 'Address deleted' });
  } catch (error) {
    next(error);
  }
};
