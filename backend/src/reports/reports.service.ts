import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Role, OrderStatus, TicketStatus, ScanResult } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRevenueStats(showtimeId: string, userId: string, userRole: Role) {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id: showtimeId },
      include: { event: true },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');

    if (userRole === Role.ORGANIZER && showtime.event.organizerId !== userId) {
      throw new ForbiddenException('You can only view reports for your own events');
    }

    const [orders, ticketStats, categoryStats] = await Promise.all([
      this.prisma.order.aggregate({
        where: { showtimeId, status: OrderStatus.PAID },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { showtimeId },
        _count: true,
      }),
      this.prisma.orderItem.groupBy({
        by: ['categoryId'],
        where: {
          order: { showtimeId, status: OrderStatus.PAID },
        },
        _sum: { unitPrice: true },
        _count: true,
      }),
    ]);

    // Get category names
    const categories = await this.prisma.seatCategory.findMany({
      where: { showtimeId },
      select: { id: true, name: true, nameVi: true, price: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const totalSeats = await this.prisma.seat.count({
      where: { showtimeId, isActive: true },
    });

    const soldTickets = ticketStats
      .filter((s) => s.status === TicketStatus.ACTIVE || s.status === TicketStatus.USED)
      .reduce((sum, s) => sum + s._count, 0);

    return {
      revenue: {
        total: orders._sum.totalAmount || 0,
        currency: 'VND',
        orderCount: orders._count,
      },
      tickets: {
        total: totalSeats,
        sold: soldTickets,
        available: totalSeats - soldTickets,
        occupancyRate: totalSeats > 0 ? Math.round((soldTickets / totalSeats) * 100) : 0,
        byStatus: ticketStats.map((s) => ({
          status: s.status,
          count: s._count,
        })),
      },
      byCategory: categoryStats.map((cs) => {
        const cat = categoryMap.get(cs.categoryId);
        return {
          categoryId: cs.categoryId,
          categoryName: cat?.name || 'Unknown',
          ticketsSold: cs._count,
          revenue: cs._sum.unitPrice || 0,
        };
      }),
    };
  }

  async getEntryStats(showtimeId: string, userId: string, userRole: Role) {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id: showtimeId },
      include: { event: true },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');

    if (userRole === Role.ORGANIZER && showtime.event.organizerId !== userId) {
      throw new ForbiddenException('You can only view reports for your own events');
    }

    const [totalTickets, usedTickets, scanStats, recentScans] = await Promise.all([
      this.prisma.ticket.count({
        where: { showtimeId, status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] } },
      }),
      this.prisma.ticket.count({
        where: { showtimeId, status: TicketStatus.USED },
      }),
      this.prisma.entryScan.groupBy({
        by: ['result'],
        where: {
          scanSession: { showtimeId },
        },
        _count: true,
      }),
      this.prisma.entryScan.findMany({
        where: {
          scanSession: { showtimeId },
        },
        orderBy: { scannedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          result: true,
          gate: true,
          scannedAt: true,
          isOffline: true,
        },
      }),
    ]);

    // Scans per gate
    const gateStats = await this.prisma.entryScan.groupBy({
      by: ['gate'],
      where: {
        scanSession: { showtimeId },
        result: ScanResult.VALID,
      },
      _count: true,
    });

    return {
      entryRate: {
        totalTickets,
        entered: usedTickets,
        remaining: totalTickets - usedTickets,
        percentage: totalTickets > 0 ? Math.round((usedTickets / totalTickets) * 100) : 0,
      },
      scanResults: scanStats.map((s) => ({
        result: s.result,
        count: s._count,
      })),
      byGate: gateStats.map((g) => ({
        gate: g.gate,
        entries: g._count,
      })),
      recentScans,
    };
  }

  async reconcile(
    showtimeId: string,
    gatewayTransactions: Array<{
      transactionId: string;
      amount: number;
      status: string;
      date: string;
    }>,
  ) {
    // Get our payment records
    const payments = await this.prisma.paymentAttempt.findMany({
      where: {
        order: { showtimeId },
      },
      include: {
        order: { select: { orderNumber: true, totalAmount: true } },
      },
    });

    const paymentByTxnId = new Map(
      payments.filter((p) => p.providerTxnId).map((p) => [p.providerTxnId, p]),
    );

    const matched: any[] = [];
    const unmatchedGateway: any[] = [];
    const unmatchedSystem: any[] = [];
    const mismatches: any[] = [];

    for (const gtx of gatewayTransactions) {
      const payment = paymentByTxnId.get(gtx.transactionId);
      if (payment) {
        paymentByTxnId.delete(gtx.transactionId);
        if (payment.amount === gtx.amount) {
          matched.push({
            transactionId: gtx.transactionId,
            amount: gtx.amount,
            orderNumber: payment.order.orderNumber,
          });
        } else {
          mismatches.push({
            transactionId: gtx.transactionId,
            gatewayAmount: gtx.amount,
            systemAmount: payment.amount,
            orderNumber: payment.order.orderNumber,
          });
        }
      } else {
        unmatchedGateway.push(gtx);
      }
    }

    for (const [txnId, payment] of paymentByTxnId) {
      unmatchedSystem.push({
        transactionId: txnId,
        amount: payment.amount,
        orderNumber: payment.order.orderNumber,
        status: payment.status,
      });
    }

    return {
      summary: {
        matched: matched.length,
        unmatchedGateway: unmatchedGateway.length,
        unmatchedSystem: unmatchedSystem.length,
        mismatches: mismatches.length,
      },
      matched,
      unmatchedGateway,
      unmatchedSystem,
      mismatches,
    };
  }

  async getAbandonmentReport(showtimeId: string) {
    const [totalHoldsCreated, totalOrders, paidOrders, expiredOrders, cancelledOrders] =
      await Promise.all([
        // Approximate holds created from audit logs
        this.prisma.auditLog.count({
          where: {
            action: 'SEATS_HELD',
            details: { path: ['showtimeId'], equals: showtimeId },
          },
        }),
        this.prisma.order.count({ where: { showtimeId } }),
        this.prisma.order.count({ where: { showtimeId, status: OrderStatus.PAID } }),
        this.prisma.order.count({ where: { showtimeId, status: OrderStatus.EXPIRED } }),
        this.prisma.order.count({ where: { showtimeId, status: OrderStatus.CANCELLED } }),
      ]);

    return {
      showtimeId,
      metrics: {
        holdSessions: totalHoldsCreated,
        ordersCreated: totalOrders,
        ordersPaid: paidOrders,
        ordersExpired: expiredOrders,
        ordersCancelled: cancelledOrders,
        holdToOrderRate: totalHoldsCreated > 0
          ? Math.round((totalOrders / totalHoldsCreated) * 100)
          : 0,
        orderToPaymentRate: totalOrders > 0
          ? Math.round((paidOrders / totalOrders) * 100)
          : 0,
        overallConversionRate: totalHoldsCreated > 0
          ? Math.round((paidOrders / totalHoldsCreated) * 100)
          : 0,
      },
    };
  }

  async exportEntryListCsv(showtimeId: string): Promise<string> {
    const entries = await this.prisma.entryScan.findMany({
      where: {
        scanSession: { showtimeId },
      },
      include: {
        ticket: { select: { ticketCode: true, seatLabel: true } },
        scanSession: { select: { gate: true } },
      },
      orderBy: { scannedAt: 'asc' },
    });

    const header = 'Ticket Code,Seat,Gate,Result,Scanned At,Offline,Device ID\n';
    const rows = entries
      .map(
        (e) =>
          `${e.ticket?.ticketCode || 'N/A'},${e.ticket?.seatLabel || 'N/A'},${e.gate || ''},${e.result},${e.scannedAt.toISOString()},${e.isOffline},${e.deviceId || ''}`,
      )
      .join('\n');

    return header + rows;
  }
}
