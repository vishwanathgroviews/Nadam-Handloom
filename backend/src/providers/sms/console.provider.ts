import { SmsProvider } from './sms.provider';

export class ConsoleSmsProvider implements SmsProvider {
  async sendOtp(mobile: string, code: string): Promise<void> {
    console.log(`[SMS:console] OTP for ${mobile} is ${code}`);
  }
}
