import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Role, OrderStatus, EventStatus, RefundStatus, TicketStatus, SaleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrganizerService {
  private readonly logger = new Logger(OrganizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private eventWhereClause(userId: string, role: Role) {
    return role === Role.ADMIN ? {} : { organizerId: userId };
  }

  async getStats(userId: string, role: Role) {
    const eventWhere = this.eventWhereClause(userId, role);

    const [totalEvents, activeEvents, ticketsSoldResult, revenueResult] =
      await Promise.all([
        this.prisma.event.count({ where: eventWhere }),
        this.prisma.event.count({
          where: { ...eventWhere, status: EventStatus.PUBLISHED },
        }),
        this.prisma.ticket.count({
          where: {
            showtime: { event: eventWhere },
            status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] },
          },
        }),
        this.prisma.order.aggregate({
          where: {
            showtime: { event: eventWhere },
            status: OrderStatus.PAID,
          },
          _sum: { totalAmount: true },
        }),
      ]);

    return {
      totalEvents,
      activeEvents,
      ticketsSold: ticketsSoldResult,
      totalRevenue: revenueResult._sum.totalAmount || 0,
    };
  }

  async getRecentOrders(userId: string, role: Role) {
    const eventWhere = this.eventWhereClause(userId, role);

    const orders = await this.prisma.order.findMany({
      where: {
        showtime: { event: eventWhere },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        currency: true,
        status: true,
        createdAt: true,
        user: {
          select: { firstName: true, lastName: true },
        },
        showtime: {
          select: {
            startsAt: true,
            event: { select: { title: true } },
          },
        },
      },
    });

    return orders;
  }

  async getEvents(userId: string, role: Role) {
    const eventWhere = this.eventWhereClause(userId, role);

    const events = await this.prisma.event.findMany({
      where: eventWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        showtimes: {
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            saleStatus: true,
            _count: {
              select: {
                tickets: true,
                orders: true,
              },
            },
          },
        },
        _count: {
          select: { showtimes: true },
        },
      },
    });

    return events;
  }

  async getRevenueReport(userId: string, role: Role, from?: string, to?: string) {
    const eventWhere = this.eventWhereClause(userId, role);

    const dateFilter: Record<string, any> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const hasDateFilter = from || to;

    const events = await this.prisma.event.findMany({
      where: eventWhere,
      select: {
        id: true,
        title: true,
        status: true,
        showtimes: {
          select: { id: true },
        },
      },
    });

    const eventReports = await Promise.all(
      events.map(async (event) => {
        const showtimeIds = event.showtimes.map((s) => s.id);
        if (showtimeIds.length === 0) {
          return {
            eventId: event.id,
            title: event.title,
            status: event.status,
            ticketsSold: 0,
            revenue: 0,
            fees: 0,
            refunds: 0,
          };
        }

        const orderWhere: Record<string, any> = {
          showtimeId: { in: showtimeIds },
          status: OrderStatus.PAID,
        };
        if (hasDateFilter) {
          orderWhere.paidAt = dateFilter;
        }

        const [revenueAgg, ticketCount, refundAgg] = await Promise.all([
          this.prisma.order.aggregate({
            where: orderWhere,
            _sum: { totalAmount: true },
          }),
          this.prisma.ticket.count({
            where: {
              showtimeId: { in: showtimeIds },
              status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] },
              ...(hasDateFilter ? { issuedAt: dateFilter } : {}),
            },
          }),
          this.prisma.refund.aggregate({
            where: {
              order: {
                showtimeId: { in: showtimeIds },
              },
              status: RefundStatus.SUCCEEDED,
              ...(hasDateFilter ? { processedAt: dateFilter } : {}),
            },
            _sum: { amount: true },
          }),
        ]);

        return {
          eventId: event.id,
          title: event.title,
          status: event.status,
          ticketsSold: ticketCount,
          revenue: revenueAgg._sum.totalAmount || 0,
          fees: 0,
          refunds: refundAgg._sum.amount || 0,
        };
      }),
    );

    const totalRevenue = eventReports.reduce((sum, e) => sum + e.revenue, 0);
    const totalRefunds = eventReports.reduce((sum, e) => sum + e.refunds, 0);
    const totalFees = eventReports.reduce((sum, e) => sum + e.fees, 0);

    return {
      totalRevenue,
      netRevenue: totalRevenue - totalRefunds - totalFees,
      totalFees,
      totalRefunds,
      events: eventReports,
    };
  }

  async exportRevenueCsv(userId: string, role: Role, from?: string, to?: string) {
    const report = await this.getRevenueReport(userId, role, from, to);

    const header = 'Event,Status,Tickets Sold,Revenue,Fees,Refunds,Net Revenue';
    const rows = report.events.map(
      (e) =>
        `"${e.title.replace(/"/g, '""')}",${e.status},${e.ticketsSold},${e.revenue},${e.fees},${e.refunds},${e.revenue - e.refunds - e.fees}`,
    );

    const summaryRow = `"TOTAL",,${report.events.reduce((s, e) => s + e.ticketsSold, 0)},${report.totalRevenue},${report.totalFees},${report.totalRefunds},${report.netRevenue}`;

    const csv = [header, ...rows, summaryRow].join('\n');

    return { csv };
  }

  async getVenues() {
    return this.prisma.venue.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { sections: true } },
      },
    });
  }

  async createVenue(data: { name: string; address: string; city: string; capacity: number }) {
    return this.prisma.venue.create({
      data: {
        name: data.name,
        address: data.address || '',
        city: data.city || '',
        capacity: data.capacity || 0,
      },
    });
  }

  async updateVenue(id: string, data: { name?: string; address?: string; city?: string; capacity?: number }) {
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    return this.prisma.venue.update({ where: { id }, data });
  }

  async deleteVenue(id: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    const showtimeCount = await this.prisma.showtime.count({ where: { venueId: id } });
    if (showtimeCount > 0) throw new BadRequestException('Cannot delete venue with existing showtimes');
    await this.prisma.venue.delete({ where: { id } });
    return { message: 'Venue deleted' };
  }

  async getShowtimePricing(showtimeId: string) {
    const categories = await this.prisma.seatCategory.findMany({
      where: { showtimeId },
      include: {
        _count: { select: { seats: true } },
      },
      orderBy: { price: 'desc' },
    });
    return categories.map((c) => ({
      id: c.id,
      category: c.name,
      price: c.price,
      currency: c.currency,
      color: c.color,
      seatCount: c._count.seats,
    }));
  }

  async updateShowtimePricing(
    showtimeId: string,
    pricing: { category: string; price: number }[],
    userId: string,
    role: Role,
  ) {
    const categories = await this.prisma.seatCategory.findMany({
      where: { showtimeId },
    });

    for (const p of pricing) {
      const cat = categories.find((c) => c.name === p.category);
      if (cat && p.price >= 0) {
        await this.prisma.seatCategory.update({
          where: { id: cat.id },
          data: { price: Math.round(p.price) },
        });
      }
    }

    await this.auditService.log({
      userId,
      action: 'PRICING_UPDATED',
      entityType: 'Showtime',
      entityId: showtimeId,
      newState: { pricing },
    });

    return { message: 'Pricing updated' };
  }

  async uploadSeatMap(showtimeId: string, seatMapData: any, userId: string, role: Role) {
    // Delegate to the seats service upload endpoint
    // The frontend sends the JSON seat map, we forward it to POST /seats/showtime/:id/upload
    const showtime = await this.prisma.showtime.findUnique({
      where: { id: showtimeId },
      include: { event: true },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');
    if (role === Role.ORGANIZER && showtime.event.organizerId !== userId) {
      throw new BadRequestException('Not your event');
    }
    if (showtime.saleStatus !== SaleStatus.DRAFT) {
      throw new BadRequestException('Cannot modify seat map after sales started');
    }

    // Process seat map - expect { sections, categories } format
    await this.prisma.$transaction(async (tx) => {
      await tx.seatHold.deleteMany({ where: { showtimeId } });
      await tx.seat.deleteMany({ where: { showtimeId } });
      await tx.seatCategory.deleteMany({ where: { showtimeId } });

      if (seatMapData.categories && seatMapData.sections) {
        // Create categories
        const catMap = new Map<string, string>();
        for (const cat of seatMapData.categories) {
          const created = await tx.seatCategory.create({
            data: {
              showtimeId,
              sectionId: cat.sectionId,
              name: cat.name,
              nameVi: cat.nameVi,
              price: cat.price || 0,
              currency: cat.currency || 'VND',
              color: cat.color,
            },
          });
          catMap.set(cat.name, created.id);
        }

        // Create seats
        for (const section of seatMapData.sections) {
          const categoryId = catMap.get(section.categoryName) || catMap.values().next().value;
          if (!categoryId) continue;
          const seats = section.seats.map((s: any) => ({
            showtimeId,
            sectionId: section.sectionId,
            categoryId,
            row: s.row,
            number: s.number?.toString() || '1',
            label: s.label || `${s.row}${s.number}`,
            x: s.x || 0,
            y: s.y || 0,
            isActive: true,
          }));
          if (seats.length > 0) {
            await tx.seat.createMany({ data: seats });
          }
        }
      }
    });

    await this.auditService.log({
      userId,
      action: 'SEAT_MAP_UPLOADED',
      entityType: 'Showtime',
      entityId: showtimeId,
    });

    return { message: 'Seat map uploaded' };
  }
}
