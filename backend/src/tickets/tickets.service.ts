import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { TicketStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly signingSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {
    this.signingSecret = configService.get<string>('TICKET_SIGNING_SECRET', 'default-ticket-secret');
  }

  private generateTicketCode(): string {
    return crypto.randomBytes(12).toString('hex').toUpperCase();
  }

  private signTicketPayload(payload: string): string {
    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');
  }

  verifyTicketSignature(payload: string, signature: string): boolean {
    const expected = this.signTicketPayload(payload);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }

  async generateTicketsForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            seat: true,
            category: true,
          },
        },
        user: { select: { id: true, email: true, firstName: true } },
        showtime: {
          include: {
            event: { select: { title: true } },
            venue: { select: { name: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Can only generate tickets for paid orders');
    }

    // Check if tickets already exist
    const existingTickets = await this.prisma.ticket.count({
      where: { orderId },
    });
    if (existingTickets > 0) {
      this.logger.log(`Tickets already generated for order ${orderId}`);
      return this.prisma.ticket.findMany({ where: { orderId } });
    }

    const tickets = [];
    for (const item of order.orderItems) {
      const ticketCode = this.generateTicketCode();

      // QR payload: JSON with ticketCode, showtimeId
      const qrPayload = JSON.stringify({
        ticketCode,
        showtimeId: order.showtimeId,
        seatLabel: item.seatLabel,
      });

      const qrSignature = this.signTicketPayload(qrPayload);

      const ticket = await this.prisma.ticket.create({
        data: {
          ticketCode,
          orderId,
          userId: order.userId,
          showtimeId: order.showtimeId,
          seatId: item.seatId,
          seatLabel: item.seatLabel,
          status: TicketStatus.ACTIVE,
          qrPayload,
          qrSignature,
          issuedAt: new Date(),
        },
      });

      tickets.push(ticket);
    }

    // Send ticket delivery email
    try {
      await this.notificationsService.sendTicketDelivery(
        order.user,
        tickets.map((t) => ({ ticketCode: t.ticketCode, seatLabel: t.seatLabel })),
        order.showtime.event.title,
        order.showtime.startsAt.toISOString(),
      );
    } catch (error) {
      this.logger.error(`Failed to send ticket email: ${error}`);
    }

    await this.auditService.log({
      userId: order.userId,
      action: 'TICKETS_GENERATED',
      entityType: 'Order',
      entityId: orderId,
      details: { ticketCount: tickets.length },
    });

    return tickets;
  }

  async verifyByCode(ticketCode: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode },
      include: {
        showtime: {
          include: {
            event: { select: { title: true, titleVi: true } },
            venue: { select: { name: true, address: true } },
          },
        },
      },
    });

    if (!ticket) {
      return {
        valid: false,
        ticketCode,
        seatLabel: '',
        eventTitle: '',
        showtimeDate: '',
        venueName: '',
        status: 'NOT_FOUND',
        message: 'Ticket not found',
      };
    }

    return {
      valid: ticket.status === 'ACTIVE',
      ticketCode: ticket.ticketCode,
      seatLabel: ticket.seatLabel,
      eventTitle: ticket.showtime.event.title,
      showtimeDate: ticket.showtime.startsAt,
      venueName: ticket.showtime.venue.name,
      status: ticket.status,
    };
  }

  async getMyTickets(userId: string, showtimeId?: string) {
    const where: any = { userId };
    if (showtimeId) where.showtimeId = showtimeId;

    return this.prisma.ticket.findMany({
      where,
      include: {
        showtime: {
          include: {
            event: { select: { id: true, title: true, titleVi: true, imageUrl: true } },
            venue: { select: { id: true, name: true, nameVi: true, address: true } },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async getTicketQr(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new NotFoundException('Ticket not found');

    // Generate QR code as data URL
    const qrData = JSON.stringify({
      payload: ticket.qrPayload,
      signature: ticket.qrSignature,
    });

    const qrDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      width: 300,
      margin: 2,
    });

    return {
      ticketCode: ticket.ticketCode,
      seatLabel: ticket.seatLabel,
      status: ticket.status,
      qrDataUrl,
      qrPayload: ticket.qrPayload,
      qrSignature: ticket.qrSignature,
    };
  }

  async resendTicketEmail(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true, firstName: true } },
        showtime: {
          include: {
            event: { select: { title: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new NotFoundException('Order not found');

    const tickets = await this.prisma.ticket.findMany({
      where: { orderId },
    });

    if (tickets.length === 0) {
      throw new BadRequestException('No tickets found for this order');
    }

    // Resend same tickets, no regeneration
    await this.notificationsService.sendTicketDelivery(
      order.user,
      tickets.map((t) => ({ ticketCode: t.ticketCode, seatLabel: t.seatLabel })),
      order.showtime.event.title,
      order.showtime.startsAt.toISOString(),
    );

    return { message: 'Ticket email resent successfully' };
  }

  /**
   * Calculate the refund percentage based on time until showtime.
   * Policy: 100% if >48h before show, 50% if 24-48h, 0% if <24h.
   */
  private calculateRefundPercentage(showtimeStart: Date): number {
    const now = new Date();
    const hoursUntilShow = (showtimeStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilShow > 48) return 100;
    if (hoursUntilShow > 24) return 50;
    return 0;
  }

  async getRefundPreview(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        showtime: true,
        seat: { include: { category: true } },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new NotFoundException('Ticket not found');

    if (ticket.status !== TicketStatus.ACTIVE) {
      throw new BadRequestException(`Cannot cancel ticket with status ${ticket.status}`);
    }

    const now = new Date();
    if (ticket.showtime.startsAt <= now) {
      throw new BadRequestException('Cannot cancel ticket after the event has started');
    }

    const refundPercentage = this.calculateRefundPercentage(ticket.showtime.startsAt);
    const ticketPrice = ticket.seat.category.price;
    const refundAmount = Math.round(ticketPrice * refundPercentage / 100);

    return {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      seatLabel: ticket.seatLabel,
      ticketPrice,
      refundPercentage,
      refundAmount,
      currency: ticket.seat.category.currency || 'VND',
      showtimeStart: ticket.showtime.startsAt,
    };
  }

  async cancelTicket(ticketId: string, userId: string, reason?: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        showtime: true,
        seat: { include: { category: true } },
        order: true,
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new NotFoundException('Ticket not found');

    if (ticket.status !== TicketStatus.ACTIVE) {
      throw new BadRequestException(`Cannot cancel ticket with status ${ticket.status}`);
    }

    const now = new Date();
    if (ticket.showtime.startsAt <= now) {
      throw new BadRequestException('Cannot cancel ticket after the event has started');
    }

    // Calculate refund based on time-based policy
    const refundPercentage = this.calculateRefundPercentage(ticket.showtime.startsAt);
    const ticketPrice = ticket.seat.category.price;
    const refundAmount = Math.round(ticketPrice * refundPercentage / 100);

    // Use a transaction: cancel ticket, release seat holds, create refund record
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Cancel the ticket (seat becomes available since seats query filters by ACTIVE/USED)
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.CANCELLED,
          cancelledAt: now,
        },
      });

      // 2. Release any seat holds for this seat + showtime
      await tx.seatHold.deleteMany({
        where: {
          seatId: ticket.seatId,
          showtimeId: ticket.showtimeId,
        },
      });

      // 3. Create a refund record if there is an amount to refund
      let refund = null;
      if (refundAmount > 0) {
        refund = await tx.refund.create({
          data: {
            orderId: ticket.orderId,
            ticketId: ticketId,
            amount: refundAmount,
            currency: ticket.seat.category.currency || 'VND',
            reason: reason || `Customer cancellation (${refundPercentage}% refund policy)`,
            status: 'PENDING',
            idempotencyKey: uuidv4(),
            requestedBy: userId,
          },
        });
      }

      return { refund };
    });

    await this.auditService.log({
      userId,
      action: 'TICKET_CANCELLED',
      entityType: 'Ticket',
      entityId: ticketId,
      details: {
        reason,
        refundPercentage,
        refundAmount,
        refundId: result.refund?.id,
      },
    });

    return {
      message: 'Ticket cancelled successfully',
      refundPercentage,
      refundAmount,
      currency: ticket.seat.category.currency || 'VND',
      refundId: result.refund?.id || null,
    };
  }
}
