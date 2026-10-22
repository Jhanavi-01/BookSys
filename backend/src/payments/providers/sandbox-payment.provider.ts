import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  WebhookVerification,
} from './payment-provider.interface';

@Injectable()
export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = 'sandbox';
  private readonly logger = new Logger(SandboxPaymentProvider.name);
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret = configService.get<string>('PAYMENT_WEBHOOK_SECRET', 'sandbox-secret');
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    // In a real implementation, this would call the sandbox API
    const providerTxnId = `SBX-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    this.logger.log(
      `[SANDBOX] Payment created: ${providerTxnId} for ${request.orderNumber}`,
    );

    // Simulated sandbox gateway URL
    const redirectUrl = `https://sandbox.payment-gateway.example.com/pay?txn=${providerTxnId}&amount=${request.amount}&currency=${request.currency}&return=${encodeURIComponent(request.returnUrl)}&cancel=${encodeURIComponent(request.cancelUrl)}`;

    return {
      providerTxnId,
      redirectUrl,
      providerData: {
        sandboxMode: true,
        createdAt: new Date().toISOString(),
      },
    };
  }

  verifySignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }

  parseWebhookResult(payload: any): WebhookVerification {
    return {
      isValid: true,
      eventType: payload.event_type || 'payment.completed',
      transactionId: payload.transaction_id || payload.transactionId,
      amount: parseInt(payload.amount, 10),
      status: this.mapStatus(payload.status),
      rawData: payload,
    };
  }

  private mapStatus(status: string): 'succeeded' | 'failed' | 'pending' {
    switch (status) {
      case 'completed':
      case 'success':
      case 'succeeded':
        return 'succeeded';
      case 'failed':
      case 'declined':
      case 'error':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
