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
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockPaymentProvider.name);
  private readonly webhookSecret: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret = configService.get<string>('PAYMENT_WEBHOOK_SECRET', 'mock-secret');
    this.frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const providerTxnId = `MOCK-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    this.logger.log(
      `[MOCK] Payment created: ${providerTxnId} for order ${request.orderNumber}, amount ${request.amount} ${request.currency}`,
    );

    // In mock mode, redirect to a simulated payment page
    // Use /en/ locale prefix for Next.js i18n routing
    const redirectUrl = `${this.frontendUrl}/en/mock-payment?txnId=${providerTxnId}&amount=${request.amount}&orderNumber=${request.orderNumber}&returnUrl=${encodeURIComponent(request.returnUrl)}`;

    return {
      providerTxnId,
      redirectUrl,
      providerData: {
        mockMode: true,
        createdAt: new Date().toISOString(),
      },
    };
  }

  verifySignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Timing-safe comparison
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
      eventType: payload.eventType || 'payment.completed',
      transactionId: payload.transactionId,
      amount: payload.amount,
      status: payload.status || 'succeeded',
      rawData: payload,
    };
  }

  // Helper method to generate a valid webhook signature for testing
  generateWebhookSignature(body: string): string {
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');
  }
}
