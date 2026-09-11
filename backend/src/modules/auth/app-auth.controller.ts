import { Request, Response, NextFunction } from 'express';
import * as appAuthService from './app-auth.service';

export const activate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await appAuthService.requestAppActivation(req.body, req);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await appAuthService.verifyAppActivationOtp(req.body.mobile, req.body.code, req);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const mpinSetup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tokens, user } = await appAuthService.setupAppMpin(req.body, req, res);
    res.status(200).json({ success: true, data: { tokens, user } });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tokens, user } = await appAuthService.loginAppUser(req.body, req, res);
    res.status(200).json({ success: true, data: { tokens, user } });
  } catch (error) {
    next(error);
  }
};

export const mpinForgot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await appAuthService.requestAppMpinReset(req.body.mobile);
    res.status(200).json({ success: true, message: 'A reset code has been sent to your mobile number', data: result });
  } catch (error) {
    next(error);
  }
};

export const mpinReset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await appAuthService.confirmAppMpinReset(req.body.mobile, req.body.code, req.body.newMpin, req);
    res.status(200).json({ success: true, message: 'MPIN reset successfully' });
  } catch (error) {
    next(error);
  }
};
