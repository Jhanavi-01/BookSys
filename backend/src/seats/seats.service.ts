import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Role, SaleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UploadSeatMapDto, UpdateCategoryPriceDto } from './dto/seat-map.dto';

@Injectable()
export class SeatsService {
  private readonly logger = new Logger(SeatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async uploadSeatMap(
    showtimeId: string,
    dto: UploadSeatMapDto,
    userId: string,
    userRole: Role,
  ) {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id: showtimeId },
      include: { event: true },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');

    if (userRole === Role.ORGANIZER && showtime.event.organizerId !== userId) {
      throw new ForbiddenException('You can only manage your own events');
    }

    if (showtime.saleStatus !== SaleStatus.DRAFT) {
      throw new BadRequestException('Cannot modify seat map after sales have started');
    }

    // Validate all data before writing (return all errors at once)
    const errors: string[] = [];

    // Validate sections exist
    const sectionIds = new Set<string>();
    for (const cat of dto.categories) {
      sectionIds.add(cat.sectionId);
    }
    for (const section of dto.sections) {
      sectionIds.add(section.sectionId);
    }

    const existingSections = await this.prisma.section.findMany({
      where: { id: { in: Array.from(sectionIds) } },
    });
    const existingSectionIds = new Set(existingSections.map((s) => s.id));

    for (const sid of sectionIds) {
      if (!existingSectionIds.has(sid)) {
        errors.push(`Section ${sid} not found`);
      }
    }

    // Validate no duplicate row+number within a section
    const seatKeys = new Set<string>();
    let totalSeats = 0;
    for (const section of dto.sections) {
      for (const seat of section.seats) {
        const key = `${section.sectionId}:${seat.row}:${seat.number}`;
        if (seatKeys.has(key)) {
          errors.push(`Duplicate seat: section=${section.sectionId} row=${seat.row} number=${seat.number}`);
        }
        seatKeys.add(key);
        totalSeats++;

        // Validate required fields
        if (!seat.row || !seat.number || !seat.label) {
          errors.push(`Seat missing required fields: row=${seat.row} number=${seat.number} label=${seat.label}`);
        }
      }
    }

    // Validate categories have valid section references
    const categoryIds = new Set<string>();
    for (const section of dto.sections) {
      categoryIds.add(section.categoryId);
    }

    // Validate prices are integers (VND)
    for (const cat of dto.categories) {
      if (!Number.isInteger(cat.price) || cat.price < 0) {
        errors.push(`Invalid price for category "${cat.name}": ${cat.price}. Must be a non-negative integer (VND).`);
      }
    }

    // Check size constraint (~5MB estimate)
    const estimatedSize = JSON.stringify(dto).length;
    if (estimatedSize > 5 * 1024 * 1024) {
      errors.push('Seat map data exceeds maximum size of 5MB');
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Seat map validation failed',
        errors,
      });
    }

    // Single transaction: clear existing and insert new
    const result = await this.prisma.$transaction(async (tx) => {
      // Delete existing seats and categories for this showtime
      await tx.seatHold.deleteMany({ where: { showtimeId } });
      await tx.seat.deleteMany({ where: { showtimeId } });
      await tx.seatCategory.deleteMany({ where: { showtimeId } });

      // Create categories
      const categoryMap = new Map<number, string>();
      const createdCategories = [];
      for (let i = 0; i < dto.categories.length; i++) {
        const cat = dto.categories[i];
        const created = await tx.seatCategory.create({
          data: {
            showtimeId,
            sectionId: cat.sectionId,
            name: cat.name,
            nameVi: cat.nameVi,
            price: cat.price,
            currency: cat.currency || 'VND',
            color: cat.color,
          },
        });
        categoryMap.set(i, created.id);
        createdCategories.push(created);
      }

      // Build a lookup from the DTO's implied category reference
      // sections reference categories by their ID in the DTO (which we map by index)
      // Actually, sections use categoryId which is the index-based reference
      // Let's use the section's categoryId field as a reference to the category name or position

      // Create seats in bulk per section
      let totalCreatedSeats = 0;
      for (const section of dto.sections) {
        // Find the category for this section - categoryId in the DTO references the category name
        const matchedCategory = createdCategories.find(
          (c) => c.sectionId === section.sectionId,
        );

        // If categoryId was provided as an index, use that
        const catId = section.categoryId;
        let resolvedCategoryId: string;

        // Try to match by index (if numeric)
        const catIndex = parseInt(catId);
        if (!isNaN(catIndex) && categoryMap.has(catIndex)) {
          resolvedCategoryId = categoryMap.get(catIndex)!;
        } else if (matchedCategory) {
          resolvedCategoryId = matchedCategory.id;
        } else {
          // Fallback: use first category for the section
          resolvedCategoryId = createdCategories[0]?.id;
        }

        if (!resolvedCategoryId) {
          throw new BadRequestException(`No category found for section ${section.sectionId}`);
        }

        const seatData = section.seats.map((seat) => ({
          showtimeId,
          sectionId: section.sectionId,
          categoryId: resolvedCategoryId,
          row: seat.row,
          number: seat.number,
          label: seat.label,
          x: seat.x || 0,
          y: seat.y || 0,
          isActive: seat.isActive !== false,
        }));

        await tx.seat.createMany({ data: seatData });
        totalCreatedSeats += seatData.length;
      }

      return { categoriesCreated: createdCategories.length, seatsCreated: totalCreatedSeats };
    });

    await this.auditService.log({
      userId,
      action: 'SEAT_MAP_UPLOADED',
      entityType: 'Showtime',
      entityId: showtimeId,
      newState: result,
    });

    return {
      message: 'Seat map uploaded successfully',
      ...result,
    };
  }

  async getSeatStatus(showtimeId: string) {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id: showtimeId },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');

    const now = new Date();

    // Single query: get all seats with their hold and ticket status
    const seats = await this.prisma.seat.findMany({
      where: { showtimeId, isActive: true },
      include: {
        category: {
          select: { id: true, name: true, nameVi: true, price: true, currency: true, color: true },
        },
        seatHolds: {
          where: {
            showtimeId,
            expiresAt: { gt: now }, // Only non-expired holds
          },
          select: { id: true, userId: true, expiresAt: true },
        },
        tickets: {
          where: {
            showtimeId,
            status: { in: ['ACTIVE', 'USED'] },
          },
          select: { id: true, status: true },
        },
        section: {
          select: { id: true, name: true, nameVi: true },
        },
      },
      orderBy: [{ section: { sortOrder: 'asc' } }, { row: 'asc' }, { number: 'asc' }],
    });

    return seats.map((seat) => {
      let status: 'available' | 'held' | 'sold' | 'used';
      if (seat.tickets.length > 0) {
        status = seat.tickets[0].status === 'USED' ? 'used' : 'sold';
      } else if (seat.seatHolds.length > 0) {
        status = 'held';
      } else {
        status = 'available';
      }

      return {
        id: seat.id,
        row: seat.row,
        number: seat.number,
        label: seat.label,
        x: seat.x,
        y: seat.y,
        section: seat.section,
        category: seat.category,
        status,
        holdExpiresAt: seat.seatHolds[0]?.expiresAt || null,
        holdUserId: seat.seatHolds[0]?.userId || null,
      };
    });
  }

  async getCategories(showtimeId: string) {
    return this.prisma.seatCategory.findMany({
      where: { showtimeId },
      include: {
        section: { select: { id: true, name: true, nameVi: true } },
        _count: { select: { seats: true } },
      },
      orderBy: { price: 'desc' },
    });
  }

  async updateCategoryPrice(
    categoryId: string,
    dto: UpdateCategoryPriceDto,
    userId: string,
    userRole: Role,
  ) {
    const category = await this.prisma.seatCategory.findUnique({
      where: { id: categoryId },
      include: {
        showtime: { include: { event: true } },
      },
    });
    if (!category) throw new NotFoundException('Category not found');

    if (userRole === Role.ORGANIZER && category.showtime.event.organizerId !== userId) {
      throw new ForbiddenException('You can only manage your own events');
    }

    const previousPrice = category.price;
    const updated = await this.prisma.seatCategory.update({
      where: { id: categoryId },
      data: { price: dto.price },
    });

    await this.auditService.log({
      userId,
      action: 'SEAT_CATEGORY_PRICE_UPDATED',
      entityType: 'SeatCategory',
      entityId: categoryId,
      previousState: { price: previousPrice },
      newState: { price: dto.price },
    });

    return updated;
  }
}
