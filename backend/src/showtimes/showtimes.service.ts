import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SaleStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateShowtimeDto,
  UpdateShowtimeDto,
  UpdateSaleStatusDto,
  CloneShowtimeDto,
} from './dto/create-showtime.dto';

@Injectable()
export class ShowtimesService {
  private readonly logger = new Logger(ShowtimesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateShowtimeDto, userId: string, userRole: Role) {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
    });
    if (!event) throw new NotFoundException('Event not found');

    if (userRole === Role.ORGANIZER && event.organizerId !== userId) {
      throw new ForbiddenException('You can only manage your own events');
    }

    const venue = await this.prisma.venue.findUnique({
      where: { id: dto.venueId },
    });
    if (!venue) throw new NotFoundException('Venue not found');

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt <= startsAt) {
      throw new BadRequestException('End time must be after start time');
    }

    const showtime = await this.prisma.showtime.create({
      data: {
        eventId: dto.eventId,
        venueId: dto.venueId,
        startsAt,
        endsAt,
        timezone: dto.timezone || 'Asia/Ho_Chi_Minh',
        maxTicketsPerUser: dto.maxTicketsPerUser || 10,
        holdDurationMinutes: dto.holdDurationMinutes || 10,
        paymentTimeoutMinutes: dto.paymentTimeoutMinutes || 15,
      },
      include: {
        event: { select: { id: true, title: true } },
        venue: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      userId,
      action: 'SHOWTIME_CREATED',
      entityType: 'Showtime',
      entityId: showtime.id,
      newState: { eventId: dto.eventId, startsAt: dto.startsAt },
    });

    return showtime;
  }

  async findByEvent(eventId: string) {
    return this.prisma.showtime.findMany({
      where: { eventId },
      include: {
        venue: true,
        _count: {
          select: { seats: true, tickets: true, orders: true },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async findById(id: string) {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id },
      include: {
        event: {
          include: {
            organizer: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        venue: true,
        seatCategories: {
          include: { section: true },
        },
        _count: {
          select: { seats: true, tickets: true, orders: true, seatHolds: true },
        },
      },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');
    return showtime;
  }

  async update(id: string, dto: UpdateShowtimeDto, userId: string, userRole: Role) {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id },
      include: { event: true },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');

    if (userRole === Role.ORGANIZER && showtime.event.organizerId !== userId) {
      throw new ForbiddenException('You can only manage your own events');
    }

    if (showtime.saleStatus === SaleStatus.ON_SALE) {
      throw new BadRequestException('Cannot update a showtime that is on sale');
    }

    const data: any = {};
    if (dto.startsAt) data.startsAt = new Date(dto.startsAt);
    if (dto.endsAt) data.endsAt = new Date(dto.endsAt);
    if (dto.timezone) data.timezone = dto.timezone;
    if (dto.maxTicketsPerUser !== undefined) data.maxTicketsPerUser = dto.maxTicketsPerUser;
    if (dto.holdDurationMinutes !== undefined) data.holdDurationMinutes = dto.holdDurationMinutes;
    if (dto.paymentTimeoutMinutes !== undefined) data.paymentTimeoutMinutes = dto.paymentTimeoutMinutes;

    const updated = await this.prisma.showtime.update({
      where: { id },
      data,
      include: {
        event: { select: { id: true, title: true } },
        venue: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      userId,
      action: 'SHOWTIME_UPDATED',
      entityType: 'Showtime',
      entityId: id,
    });

    return updated;
  }

  async updateSaleStatus(id: string, dto: UpdateSaleStatusDto, userId: string, userRole: Role) {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id },
      include: {
        event: true,
        _count: { select: { seats: true, seatCategories: true } },
      },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');

    if (userRole === Role.ORGANIZER && showtime.event.organizerId !== userId) {
      throw new ForbiddenException('You can only manage your own events');
    }

    // Valid transitions: DRAFT -> ON_SALE -> CLOSED, ON_SALE <-> CLOSED
    const validTransitions: Record<string, SaleStatus[]> = {
      [SaleStatus.DRAFT]: [SaleStatus.ON_SALE],
      [SaleStatus.ON_SALE]: [SaleStatus.CLOSED],
      [SaleStatus.CLOSED]: [SaleStatus.ON_SALE],
    };

    if (!validTransitions[showtime.saleStatus]?.includes(dto.saleStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${showtime.saleStatus} to ${dto.saleStatus}`,
      );
    }

    // Validate: must have seats and prices before ON_SALE
    if (dto.saleStatus === SaleStatus.ON_SALE) {
      if (showtime._count.seats === 0) {
        throw new BadRequestException('Cannot go on sale without seats configured');
      }
      if (showtime._count.seatCategories === 0) {
        throw new BadRequestException('Cannot go on sale without seat categories/prices configured');
      }
    }

    const updated = await this.prisma.showtime.update({
      where: { id },
      data: { saleStatus: dto.saleStatus },
    });

    await this.auditService.log({
      userId,
      action: 'SHOWTIME_SALE_STATUS_CHANGED',
      entityType: 'Showtime',
      entityId: id,
      previousState: { saleStatus: showtime.saleStatus },
      newState: { saleStatus: dto.saleStatus },
    });

    return updated;
  }

  async clone(id: string, dto: CloneShowtimeDto, userId: string, userRole: Role) {
    const source = await this.prisma.showtime.findUnique({
      where: { id },
      include: {
        event: true,
        seatCategories: true,
        seats: true,
      },
    });
    if (!source) throw new NotFoundException('Showtime not found');

    if (userRole === Role.ORGANIZER && source.event.organizerId !== userId) {
      throw new ForbiddenException('You can only clone your own showtimes');
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('End time must be after start time');
    }

    // Clone in a transaction
    const cloned = await this.prisma.$transaction(async (tx) => {
      const newShowtime = await tx.showtime.create({
        data: {
          eventId: source.eventId,
          venueId: source.venueId,
          startsAt,
          endsAt,
          timezone: source.timezone,
          maxTicketsPerUser: source.maxTicketsPerUser,
          holdDurationMinutes: source.holdDurationMinutes,
          paymentTimeoutMinutes: source.paymentTimeoutMinutes,
          saleStatus: SaleStatus.DRAFT,
        },
      });

      // Clone seat categories
      const categoryMap = new Map<string, string>();
      for (const cat of source.seatCategories) {
        const newCat = await tx.seatCategory.create({
          data: {
            showtimeId: newShowtime.id,
            sectionId: cat.sectionId,
            name: cat.name,
            nameVi: cat.nameVi,
            price: cat.price,
            currency: cat.currency,
            color: cat.color,
          },
        });
        categoryMap.set(cat.id, newCat.id);
      }

      // Clone seats in bulk
      if (source.seats.length > 0) {
        await tx.seat.createMany({
          data: source.seats.map((seat) => ({
            showtimeId: newShowtime.id,
            sectionId: seat.sectionId,
            categoryId: categoryMap.get(seat.categoryId)!,
            row: seat.row,
            number: seat.number,
            label: seat.label,
            x: seat.x,
            y: seat.y,
            isActive: seat.isActive,
          })),
        });
      }

      return newShowtime;
    });

    await this.auditService.log({
      userId,
      action: 'SHOWTIME_CLONED',
      entityType: 'Showtime',
      entityId: cloned.id,
      details: { sourceId: id },
    });

    return this.findById(cloned.id);
  }

  async delete(id: string, userId: string, userRole: Role) {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id },
      include: { event: true, _count: { select: { orders: true } } },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');

    if (userRole === Role.ORGANIZER && showtime.event.organizerId !== userId) {
      throw new ForbiddenException('You can only delete your own showtimes');
    }

    if (showtime.saleStatus !== SaleStatus.DRAFT) {
      throw new BadRequestException('Only draft showtimes can be deleted');
    }

    if (showtime._count.orders > 0) {
      throw new BadRequestException('Cannot delete showtime with existing orders');
    }

    // Delete related data first
    await this.prisma.$transaction(async (tx) => {
      await tx.seatHold.deleteMany({ where: { showtimeId: id } });
      await tx.seat.deleteMany({ where: { showtimeId: id } });
      await tx.seatCategory.deleteMany({ where: { showtimeId: id } });
      await tx.showtime.delete({ where: { id } });
    });

    await this.auditService.log({
      userId,
      action: 'SHOWTIME_DELETED',
      entityType: 'Showtime',
      entityId: id,
    });

    return { message: 'Showtime deleted successfully' };
  }
}
