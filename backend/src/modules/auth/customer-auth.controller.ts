import { Request, Response, NextFunction } from 'express';
import * as customerAuthService from './customer-auth.service';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await customerAuthService.registerCustomer(req.body, req);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await customerAuthService.verifyCustomerOtp(req.body.phone, req.body.code, req);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await customerAuthService.resendCustomerOtp(req.body.phone);
    res.status(200).json({ success: true, message: 'If an account exists, a new code has been sent', data: result });
  } catch (error) {
    next(error);
  }
};

export const mpinSetup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tokens, user } = await customerAuthService.setupCustomerMpin(req.body, req, res);
    res.status(200).json({ success: true, data: { tokens, user } });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tokens, user } = await customerAuthService.loginCustomer(req.body, req, res);
    res.status(200).json({ success: true, data: { tokens, user } });
  } catch (error) {
    next(error);
  }
};

export const mpinForgot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await customerAuthService.requestCustomerMpinReset(req.body.phone);
    res.status(200).json({
      success: true,
      message: 'If an account with that mobile number exists, a reset code has been sent',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const mpinReset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await customerAuthService.confirmCustomerMpinReset(req.body.phone, req.body.code, req.body.newMpin, req);
    res.status(200).json({ success: true, message: 'MPIN reset successfully' });
  } catch (error) {
    next(error);
  }
};
