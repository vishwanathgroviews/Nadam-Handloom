export interface SmsProvider {
  sendOtp(mobile: string, code: string): Promise<void>;
}
