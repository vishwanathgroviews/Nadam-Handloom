export interface SmsProvider {
  // Most gateways deliver the `code` we generated and resolve with nothing.
  // A gateway that insists on generating the code itself ignores `code` and
  // resolves with the reference it needs to check the customer's entry later
  // — such a provider must implement verifyOtp as well.
  sendOtp(mobile: string, code: string): Promise<void | { reference: string }>;
  verifyOtp?(reference: string, code: string): Promise<boolean>;
}
