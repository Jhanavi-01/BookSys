import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  async createOrder(dto: CreateOrderDto, userId: string) {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id: dto.showtimeId },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');

    // Check for existing pending/awaiting payment orders
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        showtimeId: dto.showtimeId,
        status: { in: [OrderStatus.PENDING, OrderStatus.AWAITING_PAYMENT] },
      },
    });
    if (existingOrder) {
      throw new ConflictException(
        'You already have a pending order for this showtime. Please complete or cancel it first.',
      );
    }

    const now = new Date();

    // Get user's active holds
    const holds = await this.prisma.seatHold.findMany({
      where: {
        userId,
        showtimeId: dto.showtimeId,
        expiresAt: { gt: now },
      },
      include: {
        seat: {
          include: {
            category: true,
          },
        },
      },
    });

    if (holds.length === 0) {
      throw new BadRequestException('No held seats found. Please select seats first.');
    }

    // Server-side total calculation (never trust client)
    const totalAmount = holds.reduce(
      (sum, hold) => sum + hold.seat.category.price,
      0,
    );

    const paymentTimeoutAt = new Date(
      now.getTime() + showtime.paymentTimeoutMinutes * 60 * 1000,
    );

    // Single transaction: create order, extend holds
    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = this.generateOrderNumber();

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          showtimeId: dto.showtimeId,
          status: OrderStatus.AWAITING_PAYMENT,
          totalAmount,
          currency: 'VND',
          paymentTimeoutAt,
        },
      });

      // Create order items
      await tx.orderItem.createMany({
        data: holds.map((hold) => ({
          orderId: newOrder.id,
          seatId: hold.seatId,
          categoryId: hold.seat.categoryId,
          seatLabel: hold.seat.label,
          unitPrice: hold.seat.category.price,
          currency: hold.seat.category.currency,
        })),
      });

      // Extend holds to match payment timeout
      await tx.seatHold.updateMany({
        where: {
          userId,
          showtimeId: dto.showtimeId,
        },
        data: {
          expiresAt: paymentTimeoutAt,
        },
      });

      return newOrder;
    });

    const fullOrder = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: {
        orderItems: {
          include: {
            seat: { select: { label: true, row: true, number: true } },
            category: { select: { name: true, price: true } },
          },
        },
        user: { select: { id: true, email: true, firstName: true } },
      },
    });

    await this.notificationsService.sendOrderConfirmation(
      fullOrder!.user,
      { orderNumber: order.orderNumber, totalAmount, currency: 'VND' },
    );

    await this.auditService.log({
      userId,
      action: 'ORDER_CREATED',
      entityType: 'Order',
      entityId: order.id,
      newState: {
        orderNumber: order.orderNumber,
        totalAmount,
        itemCount: holds.length,
      },
    });

    return fullOrder;
  }

  async getMyOrders(userId: string, page: number = 1, limit: number = 20) {
    limit = Math.min(limit, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          showtime: {
            include: {
              event: { select: { id: true, title: true, titleVi: true } },
              venue: { select: { id: true, name: true } },
            },
          },
          _count: { select: { orderItems: true, tickets: true } },
        },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getOrderDetail(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            seat: {
              select: { id: true, label: true, row: true, number: true },
            },
            category: {
              select: { id: true, name: true, nameVi: true, price: true, color: true },
            },
          },
        },
        showtime: {
          include: {
            event: { select: { id: true, title: true, titleVi: true, imageUrl: true } },
            venue: { select: { id: true, name: true, nameVi: true, address: true } },
          },
        },
        tickets: {
          select: {
            id: true,
            ticketCode: true,
            seatLabel: true,
            status: true,
            qrPayload: true,
          },
        },
        paymentAttempts: {
          select: {
            id: true,
            providerName: true,
            amount: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new NotFoundException('Order not found');

    return order;
  }

  async getOrderStatus(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentTimeoutAt: true,
        paidAt: true,
        updatedAt: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    return order;
  }

  async cancelOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new NotFoundException('Order not found');

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException('Only pending orders can be cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      // Release associated seat holds
      const orderItems = await tx.orderItem.findMany({
        where: { orderId },
        select: { seatId: true },
      });

      await tx.seatHold.deleteMany({
        where: {
          seatId: { in: orderItems.map((i) => i.seatId) },
          showtimeId: order.showtimeId,
          userId,
        },
      });
    });

    await this.auditService.log({
      userId,
      action: 'ORDER_CANCELLED',
      entityType: 'Order',
      entityId: orderId,
      previousState: { status: order.status },
      newState: { status: OrderStatus.CANCELLED },
    });

    return { message: 'Order cancelled successfully' };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cancelExpiredOrders() {
    const now = new Date();

    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.AWAITING_PAYMENT,
        paymentTimeoutAt: { lte: now },
      },
      include: {
        orderItems: { select: { seatId: true } },
      },
    });

    for (const order of expiredOrders) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.EXPIRED,
              cancelledAt: now,
            },
          });

          // Release seat holds
          await tx.seatHold.deleteMany({
            where: {
              seatId: { in: order.orderItems.map((i) => i.seatId) },
              showtimeId: order.showtimeId,
              userId: order.userId,
            },
          });
        });

        this.logger.log(`Expired order ${order.orderNumber}`);
      } catch (error) {
        this.logger.error(`Failed to expire order ${order.orderNumber}: ${error}`);
      }
    }

    if (expiredOrders.length > 0) {
      this.logger.log(`Expired ${expiredOrders.length} orders`);
    }
  }
}
