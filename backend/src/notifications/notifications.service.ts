import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;
  private readonly isDev: boolean;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.isDev = configService.get<string>('NODE_ENV') !== 'production';
    this.fromAddress = configService.get<string>('EMAIL_FROM', 'noreply@ticketbooking.vn');
    this.fromName = configService.get<string>('EMAIL_FROM_NAME', 'Ticket Booking VN');
    this.frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:5173');

    if (this.isDev) {
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    } else {
      this.transporter = nodemailer.createTransport({
        host: configService.get<string>('SMTP_HOST'),
        port: configService.get<number>('SMTP_PORT', 587),
        secure: configService.get<string>('SMTP_SECURE') === 'true',
        auth: {
          user: configService.get<string>('SMTP_USER'),
          pass: configService.get<string>('SMTP_PASS'),
        },
      });
    }
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    notificationData?: {
      userId: string;
      type: any;
      language?: string;
    },
  ): Promise<void> {
    const idempotencyKey = uuidv4();

    // Create notification record
    if (notificationData) {
      await this.prisma.notification.create({
        data: {
          userId: notificationData.userId,
          type: notificationData.type,
          subject,
          body: html,
          language: notificationData.language || 'en',
          channel: 'EMAIL',
          idempotencyKey,
        },
      });
    }

    // Retry up to 3 times with exponential backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (this.isDev) {
          this.logger.log(`[DEV EMAIL] To: ${to}, Subject: ${subject}`);
          this.logger.debug(`[DEV EMAIL] Body: ${html.substring(0, 200)}...`);
        }

        await this.transporter.sendMail({
          from: `"${this.fromName}" <${this.fromAddress}>`,
          to,
          subject,
          html,
        });

        // Mark as sent
        if (notificationData) {
          await this.prisma.notification.updateMany({
            where: { idempotencyKey },
            data: { sentAt: new Date() },
          });
        }

        return;
      } catch (error) {
        this.logger.error(
          `Failed to send email (attempt ${attempt + 1}/3): ${error}`,
        );

        if (notificationData) {
          await this.prisma.notification.updateMany({
            where: { idempotencyKey },
            data: {
              retryCount: attempt + 1,
              lastError: String(error),
            },
          });
        }

        if (attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000),
          );
        }
      }
    }
  }

  async sendEmailVerification(
    user: { id: string; email: string; firstName: string },
    token: string,
  ) {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;
    const html = `
      <h2>Xin chao ${user.firstName}! / Hello ${user.firstName}!</h2>
      <p>Please verify your email by clicking the link below:</p>
      <p>Vui long xac nhan email cua ban bang cach nhan vao lien ket ben duoi:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours. / Lien ket nay het han sau 24 gio.</p>
    `;

    await this.sendEmail(user.email, 'Verify your email / Xac nhan email', html, {
      userId: user.id,
      type: 'EMAIL_VERIFICATION',
    });
  }

  async sendPasswordReset(
    user: { id: string; email: string; firstName: string },
    token: string,
  ) {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    const html = `
      <h2>Password Reset / Dat lai mat khau</h2>
      <p>Hello ${user.firstName},</p>
      <p>You requested a password reset. Click the link below:</p>
      <p>Ban da yeu cau dat lai mat khau. Nhan vao lien ket ben duoi:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 1 hour. If you did not request this, please ignore this email.</p>
    `;

    await this.sendEmail(user.email, 'Password Reset / Dat lai mat khau', html, {
      userId: user.id,
      type: 'PASSWORD_RESET',
    });
  }

  async sendOrderConfirmation(
    user: { id: string; email: string; firstName: string },
    order: { orderNumber: string; totalAmount: number; currency: string },
  ) {
    const formattedAmount = new Intl.NumberFormat('vi-VN').format(order.totalAmount);
    const html = `
      <h2>Order Confirmation / Xac nhan don hang</h2>
      <p>Hello ${user.firstName},</p>
      <p>Your order <strong>${order.orderNumber}</strong> has been received.</p>
      <p>Total: ${formattedAmount} ${order.currency}</p>
      <p>Please complete payment within the allotted time.</p>
    `;

    await this.sendEmail(user.email, `Order ${order.orderNumber} Confirmation`, html, {
      userId: user.id,
      type: 'ORDER_CONFIRMATION',
    });
  }

  async sendPaymentSuccess(
    user: { id: string; email: string; firstName: string },
    order: { orderNumber: string; totalAmount: number; currency: string },
  ) {
    const formattedAmount = new Intl.NumberFormat('vi-VN').format(order.totalAmount);
    const html = `
      <h2>Payment Successful / Thanh toan thanh cong</h2>
      <p>Hello ${user.firstName},</p>
      <p>Payment for order <strong>${order.orderNumber}</strong> has been received.</p>
      <p>Amount: ${formattedAmount} ${order.currency}</p>
      <p>Your tickets will be delivered shortly.</p>
    `;

    await this.sendEmail(user.email, `Payment Confirmed - ${order.orderNumber}`, html, {
      userId: user.id,
      type: 'PAYMENT_SUCCESS',
    });
  }

  async sendPaymentFailed(
    user: { id: string; email: string; firstName: string },
    order: { orderNumber: string },
  ) {
    const html = `
      <h2>Payment Failed / Thanh toan that bai</h2>
      <p>Hello ${user.firstName},</p>
      <p>Payment for order <strong>${order.orderNumber}</strong> has failed.</p>
      <p>Please try again or contact support.</p>
    `;

    await this.sendEmail(user.email, `Payment Failed - ${order.orderNumber}`, html, {
      userId: user.id,
      type: 'PAYMENT_FAILED',
    });
  }

  async sendTicketDelivery(
    user: { id: string; email: string; firstName: string },
    tickets: Array<{ ticketCode: string; seatLabel: string }>,
    eventTitle: string,
    showtimeDate: string,
  ) {
    const ticketList = tickets
      .map((t) => `<li>Seat ${t.seatLabel} - Code: ${t.ticketCode}</li>`)
      .join('');
    const html = `
      <h2>Your Tickets / Ve cua ban</h2>
      <p>Hello ${user.firstName},</p>
      <p>Here are your tickets for <strong>${eventTitle}</strong> on ${showtimeDate}:</p>
      <ul>${ticketList}</ul>
      <p>Please present the QR code at the venue entrance.</p>
      <p>Vui long trinh ma QR tai loi vao dia diem.</p>
    `;

    await this.sendEmail(user.email, `Your Tickets - ${eventTitle}`, html, {
      userId: user.id,
      type: 'TICKET_DELIVERY',
    });
  }

  async sendCancellationNotice(
    user: { id: string; email: string; firstName: string },
    eventTitle: string,
    reason?: string,
  ) {
    const html = `
      <h2>Event Cancellation / Huy su kien</h2>
      <p>Hello ${user.firstName},</p>
      <p>We regret to inform you that <strong>${eventTitle}</strong> has been cancelled.</p>
      ${reason ? `<p>Reason: ${reason}</p>` : ''}
      <p>A refund will be processed automatically.</p>
    `;

    await this.sendEmail(user.email, `Event Cancelled - ${eventTitle}`, html, {
      userId: user.id,
      type: 'CANCELLATION',
    });
  }

  async sendRefundNotice(
    user: { id: string; email: string; firstName: string },
    order: { orderNumber: string },
    amount: number,
    currency: string,
  ) {
    const formattedAmount = new Intl.NumberFormat('vi-VN').format(amount);
    const html = `
      <h2>Refund Processed / Hoan tien</h2>
      <p>Hello ${user.firstName},</p>
      <p>A refund of ${formattedAmount} ${currency} has been processed for order <strong>${order.orderNumber}</strong>.</p>
      <p>Please allow 5-10 business days for the refund to appear in your account.</p>
    `;

    await this.sendEmail(user.email, `Refund - ${order.orderNumber}`, html, {
      userId: user.id,
      type: 'REFUND',
    });
  }

  async sendEventReminder(
    user: { id: string; email: string; firstName: string },
    eventTitle: string,
    showtimeDate: string,
    venueName: string,
  ) {
    const html = `
      <h2>Event Reminder / Nhac nho su kien</h2>
      <p>Hello ${user.firstName},</p>
      <p>Reminder: <strong>${eventTitle}</strong> is happening on ${showtimeDate} at ${venueName}.</p>
      <p>Don't forget to bring your tickets!</p>
    `;

    await this.sendEmail(user.email, `Reminder: ${eventTitle}`, html, {
      userId: user.id,
      type: 'EVENT_REMINDER',
    });
  }

  async sendBulkCancellation(
    users: Array<{ id: string; email: string; firstName: string }>,
    eventTitle: string,
    reason?: string,
  ) {
    const promises = users.map((user) =>
      this.sendCancellationNotice(user, eventTitle, reason),
    );
    await Promise.allSettled(promises);
  }
}
