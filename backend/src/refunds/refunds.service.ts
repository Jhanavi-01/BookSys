import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus, TicketStatus, RefundStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestRefundDto, BulkRefundDto } from './dto/refund.dto';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async requestRefund(dto: RequestRefundDto, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        orderItems: true,
        showtime: true,
        user: { select: { id: true, email: true, firstName: true } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Not your order');

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Can only refund paid orders');
    }

    // Check if showtime hasn't started yet (deadline check)
    const now = new Date();
    if (order.showtime.startsAt <= now) {
      throw new BadRequestException('Cannot request refund after the event has started');
    }

    let refundAmount = order.totalAmount;
    let ticketId: string | undefined;

    // If specific ticket refund
    if (dto.ticketId) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: dto.ticketId },
        include: {
          seat: { include: { category: true } },
        },
      });
      if (!ticket || ticket.orderId !== dto.orderId) {
        throw new BadRequestException('Ticket not found in this order');
      }
      if (ticket.status !== TicketStatus.ACTIVE) {
        throw new BadRequestException('Ticket is not in active status');
      }
      refundAmount = ticket.seat.category.price;
      ticketId = dto.ticketId;
    }

    // Check for existing pending refund
    const existingRefund = await this.prisma.refund.findFirst({
      where: {
        orderId: dto.orderId,
        ticketId: ticketId || null,
        status: { in: [RefundStatus.PENDING, RefundStatus.PROCESSING] },
      },
    });
    if (existingRefund) {
      throw new BadRequestException('A refund request is already pending for this order/ticket');
    }

    const refund = await this.prisma.refund.create({
      data: {
        orderId: dto.orderId,
        ticketId: ticketId || null,
        amount: refundAmount,
        currency: order.currency,
        reason: dto.reason,
        status: RefundStatus.PENDING,
        idempotencyKey: uuidv4(),
        requestedBy: userId,
      },
    });

    // Cancel the ticket(s)
    if (ticketId) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.REFUNDED, cancelledAt: now },
      });
    } else {
      // Full order refund - cancel all tickets
      await this.prisma.ticket.updateMany({
        where: { orderId: dto.orderId, status: TicketStatus.ACTIVE },
        data: { status: TicketStatus.REFUNDED, cancelledAt: now },
      });
    }

    await this.auditService.log({
      userId,
      action: 'REFUND_REQUESTED',
      entityType: 'Refund',
      entityId: refund.id,
      details: {
        orderId: dto.orderId,
        amount: refundAmount,
        reason: dto.reason,
      },
    });

    return refund;
  }

  async bulkRefundForShowtime(dto: BulkRefundDto, requestedBy: string) {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id: dto.showtimeId },
      include: {
        event: { select: { title: true } },
      },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');

    // Find all paid orders for this showtime
    const orders = await this.prisma.order.findMany({
      where: {
        showtimeId: dto.showtimeId,
        status: OrderStatus.PAID,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true } },
        tickets: { where: { status: TicketStatus.ACTIVE } },
      },
    });

    const refunds = [];
    const affectedUsers = [];

    for (const order of orders) {
      // Skip if refund already exists
      const existingRefund = await this.prisma.refund.findFirst({
        where: {
          orderId: order.id,
          status: { in: [RefundStatus.PENDING, RefundStatus.PROCESSING, RefundStatus.SUCCEEDED] },
        },
      });
      if (existingRefund) continue;

      const refund = await this.prisma.refund.create({
        data: {
          orderId: order.id,
          amount: order.totalAmount,
          currency: order.currency,
          reason: dto.reason || `Showtime cancelled by organizer`,
          status: RefundStatus.PENDING,
          idempotencyKey: uuidv4(),
          requestedBy,
        },
      });

      // Cancel all tickets
      await this.prisma.ticket.updateMany({
        where: { orderId: order.id, status: TicketStatus.ACTIVE },
        data: { status: TicketStatus.REFUNDED, cancelledAt: new Date() },
      });

      refunds.push(refund);
      affectedUsers.push(order.user);
    }

    // Send bulk cancellation notifications
    await this.notificationsService.sendBulkCancellation(
      affectedUsers,
      showtime.event.title,
      dto.reason,
    );

    await this.auditService.log({
      userId: requestedBy,
      action: 'BULK_REFUND_INITIATED',
      entityType: 'Showtime',
      entityId: dto.showtimeId,
      details: {
        refundCount: refunds.length,
        totalAmount: refunds.reduce((sum, r) => sum + r.amount, 0),
        reason: dto.reason,
      },
    });

    return {
      message: `Initiated ${refunds.length} refunds`,
      refundCount: refunds.length,
      totalAmount: refunds.reduce((sum, r) => sum + r.amount, 0),
    };
  }

  async getRefundQueue(page: number = 1, limit: number = 20) {
    limit = Math.min(limit, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.refund.findMany({
        where: { status: { in: [RefundStatus.PENDING, RefundStatus.FAILED] } },
        orderBy: { requestedAt: 'asc' },
        skip,
        take: limit,
        include: {
          order: {
            select: {
              orderNumber: true,
              userId: true,
              user: { select: { email: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.refund.count({
        where: { status: { in: [RefundStatus.PENDING, RefundStatus.FAILED] } },
      }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async processRefund(refundId: string, action: 'approve' | 'reject', processedBy: string, note?: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        order: {
          include: {
            user: { select: { id: true, email: true, firstName: true } },
          },
        },
      },
    });
    if (!refund) throw new NotFoundException('Refund not found');

    if (action === 'approve') {
      // Simulate processing refund (in production, call payment provider)
      await this.prisma.refund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.SUCCEEDED,
          processedAt: new Date(),
          providerRefundId: `REF-${Date.now()}`,
        },
      });

      await this.notificationsService.sendRefundNotice(
        refund.order.user,
        { orderNumber: refund.order.orderNumber },
        refund.amount,
        refund.currency,
      );
    } else {
      await this.prisma.refund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.FAILED,
          lastError: note || 'Rejected by accountant',
        },
      });
    }

    await this.auditService.log({
      userId: processedBy,
      action: `REFUND_${action.toUpperCase()}D`,
      entityType: 'Refund',
      entityId: refundId,
      details: { action, note },
    });

    return { message: `Refund ${action}d successfully` };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryFailedRefunds() {
    const failedRefunds = await this.prisma.refund.findMany({
      where: {
        status: RefundStatus.FAILED,
        retryCount: { lt: 3 },
      },
      orderBy: { requestedAt: 'asc' },
      take: 10,
    });

    for (const refund of failedRefunds) {
      try {
        // Exponential backoff check
        const lastAttemptTime = refund.processedAt || refund.requestedAt;
        const backoffMs = Math.pow(2, refund.retryCount) * 60 * 1000; // 1min, 2min, 4min
        if (Date.now() - lastAttemptTime.getTime() < backoffMs) {
          continue;
        }

        // Simulate retry (in production, call payment provider)
        this.logger.log(`Retrying refund ${refund.id} (attempt ${refund.retryCount + 1})`);

        await this.prisma.refund.update({
          where: { id: refund.id },
          data: {
            status: RefundStatus.PROCESSING,
            retryCount: refund.retryCount + 1,
            processedAt: new Date(),
          },
        });

        // Simulate: mark as succeeded after retry
        await this.prisma.refund.update({
          where: { id: refund.id },
          data: {
            status: RefundStatus.SUCCEEDED,
            providerRefundId: `REF-RETRY-${Date.now()}`,
          },
        });

        this.logger.log(`Refund ${refund.id} succeeded on retry`);
      } catch (error) {
        this.logger.error(`Retry failed for refund ${refund.id}: ${error}`);
        await this.prisma.refund.update({
          where: { id: refund.id },
          data: {
            status: RefundStatus.FAILED,
            lastError: String(error),
          },
        });
      }
    }
  }
}
