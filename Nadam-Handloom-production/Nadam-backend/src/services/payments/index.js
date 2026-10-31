// The payment service in use: Razorpay, or the stand-in for tests.
import { env } from '../../config/env.js';
import * as razorpay from './razorpay.provider.js';
import * as fake from './fake.provider.js';

export const gateway = () => (env.payments.provider === 'fake' ? fake : razorpay);
export { RazorpayError } from './razorpay.provider.js';
