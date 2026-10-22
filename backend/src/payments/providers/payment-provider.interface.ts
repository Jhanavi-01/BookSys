export interface PaymentRequest {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export interface PaymentResponse {
  providerTxnId: string;
  redirectUrl: string;
  providerData?: any;
}

export interface WebhookVerification {
  isValid: boolean;
  eventType: string;
  transactionId: string;
  amount: number;
  status: 'succeeded' | 'failed' | 'pending';
  rawData: any;
}

export interface PaymentProvider {
  name: string;
  createPayment(request: PaymentRequest): Promise<PaymentResponse>;
  verifySignature(rawBody: string, signature: string): boolean;
  parseWebhookResult(payload: any): WebhookVerification;
}
