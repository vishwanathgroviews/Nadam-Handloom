export interface CreateOrderInput {
  amount: number; // in rupees
  currency: string;
  receipt: string;
}

export interface CreateOrderResult {
  providerOrderId: string;
  amount: number;
  currency: string;
}

export interface VerifySignatureInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface PaymentProvider {
  isConfigured(): boolean;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyPaymentSignature(input: VerifySignatureInput): boolean;
  /** Verifies a server-to-server webhook call — a different secret and signing scheme than the client checkout callback above. */
  isWebhookConfigured(): boolean;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}
