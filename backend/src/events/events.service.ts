import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEventDto, UpdateEventDto, UpdateEventStatusDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateEventDto, organizerId: string) {
    const event = await this.prisma.event.create({
      data: {
        ...dto,
        organizerId,
        status: EventStatus.DRAFT,
      },
      include: {
        organizer: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    await this.auditService.log({
      userId: organizerId,
      action: 'EVENT_CREATED',
      entityType: 'Event',
      entityId: event.id,
      newState: { title: event.title, status: event.status },
    });

    return event;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    status?: EventStatus;
    category?: string;
    search?: string;
    userId?: string;
    userRole?: Role;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    // Organizer sees own events, admin sees all
    if (params.userRole === Role.ORGANIZER) {
      where.organizerId = params.userId;
    } else if (params.userRole === Role.CUSTOMER) {
      where.status = EventStatus.PUBLISHED;
    }

    if (params.status) where.status = params.status;
    if (params.category) where.category = params.category;
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { titleVi: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [rawItems, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          organizer: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: { select: { showtimes: true } },
          showtimes: {
            orderBy: { startsAt: 'asc' },
            include: {
              venue: { select: { name: true, nameVi: true } },
              seatCategories: { select: { price: true } },
              _count: { select: { seats: true, tickets: true } },
            },
          },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    const items = rawItems.map((event) => {
      const firstShowtime = event.showtimes[0];
      const allPrices = event.showtimes.flatMap((s) =>
        s.seatCategories.map((c) => c.price),
      );
      const totalSeats = event.showtimes.reduce((sum, s) => sum + s._count.seats, 0);
      const totalTickets = event.showtimes.reduce((sum, s) => sum + s._count.tickets, 0);

      const { showtimes, ...rest } = event;
      return {
        ...rest,
        startDate: firstShowtime?.startsAt || null,
        venueName: firstShowtime?.venue?.name || null,
        venueNameVi: firstShowtime?.venue?.nameVi || null,
        coverImage: event.imageUrl,
        minPrice: allPrices.length > 0 ? Math.min(...allPrices) : 0,
        maxPrice: allPrices.length > 0 ? Math.max(...allPrices) : 0,
        featured: false,
        soldOut: totalSeats > 0 && totalTickets >= totalSeats,
      };
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        showtimes: {
          include: {
            venue: true,
            seatCategories: { select: { price: true } },
            _count: { select: { seats: true, tickets: true } },
          },
          orderBy: { startsAt: 'asc' },
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found');

    const firstShowtime = event.showtimes[0];
    const showtimes = event.showtimes.map((s) => {
      const prices = s.seatCategories.map((c) => c.price);
      const availableSeats = s._count.seats - s._count.tickets;
      return {
        id: s.id,
        dateTime: s.startsAt,
        endsAt: s.endsAt,
        saleStatus: s.saleStatus === 'ON_SALE' ? 'OPEN' : s.saleStatus === 'DRAFT' ? 'PENDING' : 'CLOSED',
        availableSeats: Math.max(0, availableSeats),
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        saleStart: s.createdAt,
      };
    });

    return {
      id: event.id,
      title: event.title,
      titleVi: event.titleVi,
      description: event.description,
      descriptionVi: event.descriptionVi,
      category: event.category,
      coverImage: event.imageUrl,
      status: event.status,
      startDate: firstShowtime?.startsAt || null,
      endDate: event.showtimes[event.showtimes.length - 1]?.endsAt || null,
      venueName: firstShowtime?.venue?.name || '',
      venueAddress: firstShowtime?.venue?.address || '',
      organizerName: `${event.organizer.firstName || ''} ${event.organizer.lastName || ''}`.trim(),
      organizer: event.organizer,
      showtimes,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  async update(id: string, dto: UpdateEventDto, userId: string, userRole: Role) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    if (userRole === Role.ORGANIZER && event.organizerId !== userId) {
      throw new ForbiddenException('You can only update your own events');
    }

    if (event.status === EventStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a cancelled event');
    }

    const previousState = { title: event.title, description: event.description };

    const updated = await this.prisma.event.update({
      where: { id },
      data: dto,
      include: {
        organizer: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    await this.auditService.log({
      userId,
      action: 'EVENT_UPDATED',
      entityType: 'Event',
      entityId: id,
      previousState,
      newState: { title: updated.title, description: updated.description },
    });

    return updated;
  }

  async updateStatus(id: string, dto: UpdateEventStatusDto, userId: string, userRole: Role) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    if (userRole === Role.ORGANIZER && event.organizerId !== userId) {
      throw new ForbiddenException('You can only manage your own events');
    }

    const validTransitions: Record<string, EventStatus[]> = {
      [EventStatus.DRAFT]: [EventStatus.PUBLISHED, EventStatus.CANCELLED],
      [EventStatus.PUBLISHED]: [EventStatus.CANCELLED, EventStatus.COMPLETED],
      [EventStatus.CANCELLED]: [],
      [EventStatus.COMPLETED]: [],
    };

    if (!validTransitions[event.status]?.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${event.status} to ${dto.status}`,
      );
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.auditService.log({
      userId,
      action: 'EVENT_STATUS_CHANGED',
      entityType: 'Event',
      entityId: id,
      previousState: { status: event.status },
      newState: { status: dto.status },
    });

    return updated;
  }

  async delete(id: string, userId: string, userRole: Role) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    if (userRole === Role.ORGANIZER && event.organizerId !== userId) {
      throw new ForbiddenException('You can only delete your own events');
    }

    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException('Only draft events can be deleted');
    }

    await this.prisma.event.delete({ where: { id } });

    await this.auditService.log({
      userId,
      action: 'EVENT_DELETED',
      entityType: 'Event',
      entityId: id,
      previousState: { title: event.title, status: event.status },
    });

    return { message: 'Event deleted successfully' };
  }
}
