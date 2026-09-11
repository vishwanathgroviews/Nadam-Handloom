import { Request, Response, NextFunction } from 'express';
import { paymentProvider } from '../../providers/payment';
import { handleRazorpayWebhookEvent } from '../orders/orders.service';
import { AppError, UnauthorizedError } from '../../utils/errors';

export const razorpayWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!paymentProvider.isWebhookConfigured()) {
      throw new AppError('Razorpay webhook is not configured', 503, 'WEBHOOK_NOT_CONFIGURED');
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!req.rawBody || typeof signature !== 'string' || !paymentProvider.verifyWebhookSignature(req.rawBody, signature)) {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    // Once the signature checks out, every outcome here is a 200 — an event
    // type we don't handle, or an order we don't recognize, isn't a failure
    // and shouldn't make Razorpay retry it forever. Only a bad signature
    // (rejected above) is actually an error response.
    await handleRazorpayWebhookEvent(req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
