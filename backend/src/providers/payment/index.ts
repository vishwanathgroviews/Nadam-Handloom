import { RazorpayPaymentProvider } from './razorpay.provider';
import { PaymentProvider } from './payment.provider';

export const paymentProvider: PaymentProvider = new RazorpayPaymentProvider();
export type { PaymentProvider } from './payment.provider';
