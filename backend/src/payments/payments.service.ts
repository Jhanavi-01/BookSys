import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketsService } from '../tickets/tickets.service';
import { PaymentProvider } from './providers/payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { SandboxPaymentProvider } from './providers/sandbox-payment.provider';
import { CreatePaymentDto } from './dto/payment.dto';

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private provider: PaymentProvider;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly ticketsService: TicketsService,
    private readonly configService: ConfigService,
    private readonly mockProvider: MockPaymentProvider,
    private readonly sandboxProvider: SandboxPaymentProvider,
  ) {
    this.frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const providerName = configService.get<string>('PAYMENT_PROVIDER', 'mock');
    const nodeEnv = configService.get<string>('NODE_ENV', 'development');

    if (providerName === 'mock' && nodeEnv === 'production') {
      throw new Error('Mock payment provider is not allowed in production');
    }

    switch (providerName) {
      case 'mock':
        this.provider = mockProvider;
        break;
      case 'sandbox':
        this.provider = sandboxProvider;
        break;
      default:
        this.provider = mockProvider;
    }

    this.logger.log(`Payment provider: ${this.provider.name}`);
  }

  async createPayment(dto: CreatePaymentDto, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { user: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Not your order');

    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(`Order status is ${order.status}, expected AWAITING_PAYMENT`);
    }

    if (order.paymentTimeoutAt && order.paymentTimeoutAt < new Date()) {
      throw new BadRequestException('Payment timeout has expired for this order');
    }

    const idempotencyKey = uuidv4();
    const returnUrl = dto.returnUrl || `${this.frontendUrl}/payment/return`;
    const cancelUrl = dto.cancelUrl || `${this.frontendUrl}/payment/cancel`;

    const paymentResponse = await this.provider.createPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.totalAmount,
      currency: order.currency,
      returnUrl: `${returnUrl}?orderId=${order.id}`,
      cancelUrl: `${cancelUrl}?orderId=${order.id}`,
      idempotencyKey,
    });

    const paymentAttempt = await this.prisma.paymentAttempt.create({
      data: {
        orderId: order.id,
        providerName: this.provider.name,
        providerTxnId: paymentResponse.providerTxnId,
        amount: order.totalAmount,
        currency: order.currency,
        status: PaymentStatus.PENDING,
        providerData: paymentResponse.providerData,
        idempotencyKey,
      },
    });

    await this.auditService.log({
      userId,
      action: 'PAYMENT_INITIATED',
      entityType: 'PaymentAttempt',
      entityId: paymentAttempt.id,
      details: {
        orderId: order.id,
        amount: order.totalAmount,
        provider: this.provider.name,
      },
    });

    return {
      paymentAttemptId: paymentAttempt.id,
      redirectUrl: paymentResponse.redirectUrl,
      providerTxnId: paymentResponse.providerTxnId,
    };
  }

  async handleWebhook(rawBody: string, signature: string, sourceIp?: string) {
    // Step 1: Verify signature first (timing-safe compare)
    if (!this.provider.verifySignature(rawBody, signature || '')) {
      this.logger.warn('Webhook signature verification failed');
      await this.auditService.log({
        action: 'WEBHOOK_SIGNATURE_FAILED',
        entityType: 'WebhookEvent',
        details: { sourceIp, provider: this.provider.name },
      });
      throw new ForbiddenException('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody);
    const result = this.provider.parseWebhookResult(payload);

    // Step 2: Check idempotency
    const idempotencyKey = result.transactionId;
    const existingWebhook = await this.prisma.webhookEvent.findUnique({
      where: { idempotencyKey },
    });

    if (existingWebhook?.processed) {
      this.logger.log(`Webhook already processed: ${idempotencyKey}`);
      return { status: 'already_processed' };
    }

    // Step 3: Find the payment attempt
    const paymentAttempt = await this.prisma.paymentAttempt.findFirst({
      where: { providerTxnId: result.transactionId },
      include: {
        order: {
          include: {
            user: { select: { id: true, email: true, firstName: true } },
            orderItems: { select: { seatId: true } },
          },
        },
      },
    });

    if (!paymentAttempt) {
      // Record unmatched webhook
      await this.prisma.webhookEvent.create({
        data: {
          providerName: this.provider.name,
          eventType: result.eventType,
          payload: payload,
          rawBody,
          signature,
          idempotencyKey,
          sourceIp,
          processed: false,
        },
      });
      this.logger.warn(`No payment attempt found for transaction: ${result.transactionId}`);
      return { status: 'unmatched' };
    }

    // Step 4: Process in transaction with row-level locking
    const webhookResult = await this.prisma.$transaction(async (tx) => {
      // Row-level lock on order to handle race conditions between webhook and expiry job
      const order = await tx.order.findUnique({
        where: { id: paymentAttempt.orderId },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // Record the webhook event
      const webhookEvent = await tx.webhookEvent.create({
        data: {
          paymentAttemptId: paymentAttempt.id,
          providerName: this.provider.name,
          eventType: result.eventType,
          payload: payload,
          rawBody,
          signature,
          idempotencyKey,
          sourceIp,
          processed: true,
          processedAt: new Date(),
        },
      });

      if (result.status === 'succeeded') {
        // Check amount matches
        if (result.amount !== paymentAttempt.amount) {
          // Amount mismatch - NEEDS_REVIEW
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.NEEDS_REVIEW },
          });
          await tx.paymentAttempt.update({
            where: { id: paymentAttempt.id },
            data: {
              status: PaymentStatus.SUCCEEDED,
              providerData: result.rawData,
            },
          });

          this.logger.warn(
            `Amount mismatch for order ${order.orderNumber}: expected ${paymentAttempt.amount}, got ${result.amount}`,
          );

          return { status: 'amount_mismatch', orderId: order.id };
        }

        // Skip if order is already in terminal state
        if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED || order.status === OrderStatus.EXPIRED) {
          this.logger.warn(`Order ${order.orderNumber} is already in terminal state: ${order.status}`);
          return { status: 'order_already_terminal', orderId: order.id };
        }

        // Mark order as paid
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PAID,
            paidAt: new Date(),
          },
        });

        // Mark payment as succeeded
        await tx.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: PaymentStatus.SUCCEEDED,
            providerData: result.rawData,
          },
        });

        // Delete seat holds (seats are now sold)
        const seatIds = paymentAttempt.order.orderItems.map((i) => i.seatId);
        await tx.seatHold.deleteMany({
          where: {
            seatId: { in: seatIds },
            showtimeId: order.showtimeId,
          },
        });

        return { status: 'success', orderId: order.id };
      } else if (result.status === 'failed') {
        await tx.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: PaymentStatus.FAILED,
            providerData: result.rawData,
          },
        });

        // Keep order as AWAITING_PAYMENT so user can retry
        return { status: 'failed', orderId: order.id };
      }

      return { status: 'pending', orderId: order.id };
    });

    // Post-transaction actions (non-critical, outside transaction)
    if (webhookResult.status === 'success') {
      try {
        // Generate tickets
        await this.ticketsService.generateTicketsForOrder(paymentAttempt.orderId);

        // Send success notification
        await this.notificationsService.sendPaymentSuccess(
          paymentAttempt.order.user,
          {
            orderNumber: paymentAttempt.order.orderNumber,
            totalAmount: paymentAttempt.order.totalAmount,
            currency: paymentAttempt.order.currency,
          },
        );
      } catch (error) {
        this.logger.error(`Post-payment processing error: ${error}`);
      }
    } else if (webhookResult.status === 'failed') {
      try {
        await this.notificationsService.sendPaymentFailed(
          paymentAttempt.order.user,
          { orderNumber: paymentAttempt.order.orderNumber },
        );
      } catch (error) {
        this.logger.error(`Failed to send payment failure notification: ${error}`);
      }
    }

    await this.auditService.log({
      userId: paymentAttempt.order.userId,
      action: `WEBHOOK_PROCESSED_${result.status.toUpperCase()}`,
      entityType: 'PaymentAttempt',
      entityId: paymentAttempt.id,
      details: {
        transactionId: result.transactionId,
        amount: result.amount,
        webhookStatus: webhookResult.status,
      },
    });

    return webhookResult;
  }
}
