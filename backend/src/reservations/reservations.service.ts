import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HoldSeatsDto, ReleaseSeatsDto } from './dto/hold-seats.dto';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async holdSeats(dto: HoldSeatsDto, userId: string) {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id: dto.showtimeId },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');

    if (showtime.saleStatus !== SaleStatus.ON_SALE) {
      throw new BadRequestException('Tickets are not currently on sale for this showtime');
    }

    const now = new Date();
    const holdDurationMs = showtime.holdDurationMinutes * 60 * 1000;

    // Check user's existing holds + tickets for max per user
    const existingHoldCount = await this.prisma.seatHold.count({
      where: {
        userId,
        showtimeId: dto.showtimeId,
        expiresAt: { gt: now },
      },
    });

    const existingTicketCount = await this.prisma.ticket.count({
      where: {
        userId,
        showtimeId: dto.showtimeId,
        status: { in: ['ACTIVE', 'USED'] },
      },
    });

    const totalAfterHold = existingHoldCount + existingTicketCount + dto.seatIds.length;
    if (totalAfterHold > showtime.maxTicketsPerUser) {
      throw new BadRequestException(
        `Maximum ${showtime.maxTicketsPerUser} tickets per user. You have ${existingHoldCount + existingTicketCount} already.`,
      );
    }

    // Verify all seats exist and belong to this showtime
    const seats = await this.prisma.seat.findMany({
      where: {
        id: { in: dto.seatIds },
        showtimeId: dto.showtimeId,
        isActive: true,
      },
    });

    if (seats.length !== dto.seatIds.length) {
      throw new BadRequestException('One or more seats not found or inactive');
    }

    // Check if user already has an active hold expiry for this showtime
    const existingHold = await this.prisma.seatHold.findFirst({
      where: {
        userId,
        showtimeId: dto.showtimeId,
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'asc' },
    });

    // Additional seats share existing hold expiry
    const expiresAt = existingHold ? existingHold.expiresAt : new Date(now.getTime() + holdDurationMs);

    // Atomic all-or-nothing: use transaction with database-level constraint
    try {
      const holds = await this.prisma.$transaction(async (tx) => {
        // Check for existing holds or sold tickets (non-expired)
        const conflicting = await tx.seatHold.findMany({
          where: {
            seatId: { in: dto.seatIds },
            showtimeId: dto.showtimeId,
            expiresAt: { gt: now },
          },
        });

        if (conflicting.length > 0) {
          const conflictSeatIds = conflicting.map((h) => h.seatId);
          // Filter out holds by the same user (they already hold these)
          const otherUserHolds = conflicting.filter((h) => h.userId !== userId);
          if (otherUserHolds.length > 0) {
            throw new ConflictException(
              `Some seats are already held by another user`,
            );
          }
          // If all conflicts are from the same user, those seats are already held
          const alreadyHeldByUser = conflicting.filter((h) => h.userId === userId);
          if (alreadyHeldByUser.length === dto.seatIds.length) {
            // All seats already held by this user, just extend
            await tx.seatHold.updateMany({
              where: {
                seatId: { in: dto.seatIds },
                showtimeId: dto.showtimeId,
                userId,
              },
              data: { expiresAt },
            });
            return alreadyHeldByUser;
          }
        }

        // Check for sold tickets
        const soldTickets = await tx.ticket.findMany({
          where: {
            seatId: { in: dto.seatIds },
            showtimeId: dto.showtimeId,
            status: { in: ['ACTIVE', 'USED'] },
          },
        });

        if (soldTickets.length > 0) {
          throw new ConflictException('Some seats are already sold');
        }

        // Create holds for seats not already held
        const existingHeldSeatIds = new Set(
          conflicting.filter((h) => h.userId === userId).map((h) => h.seatId),
        );
        const newSeatIds = dto.seatIds.filter((id) => !existingHeldSeatIds.has(id));

        if (newSeatIds.length > 0) {
          // Use createMany with skipDuplicates for atomic insertion
          // The unique constraint on [seatId, showtimeId] prevents double-holding
          await tx.seatHold.createMany({
            data: newSeatIds.map((seatId) => ({
              seatId,
              showtimeId: dto.showtimeId,
              userId,
              expiresAt,
            })),
            skipDuplicates: true,
          });
        }

        return tx.seatHold.findMany({
          where: {
            userId,
            showtimeId: dto.showtimeId,
            expiresAt: { gt: now },
          },
          include: {
            seat: {
              include: {
                category: { select: { id: true, name: true, price: true, currency: true } },
              },
            },
          },
        });
      });

      await this.auditService.log({
        userId,
        action: 'SEATS_HELD',
        entityType: 'SeatHold',
        details: {
          showtimeId: dto.showtimeId,
          seatIds: dto.seatIds,
          expiresAt,
        },
      });

      return {
        holds,
        expiresAt,
        holdDurationMinutes: showtime.holdDurationMinutes,
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      // Database unique constraint violation
      if ((error as any)?.code === 'P2002') {
        throw new ConflictException('One or more seats were just taken by another user');
      }
      throw error;
    }
  }

  async releaseSeats(dto: ReleaseSeatsDto, userId: string) {
    const deleted = await this.prisma.seatHold.deleteMany({
      where: {
        seatId: { in: dto.seatIds },
        showtimeId: dto.showtimeId,
        userId,
      },
    });

    await this.auditService.log({
      userId,
      action: 'SEATS_RELEASED',
      entityType: 'SeatHold',
      details: {
        showtimeId: dto.showtimeId,
        seatIds: dto.seatIds,
        releasedCount: deleted.count,
      },
    });

    return { released: deleted.count };
  }

  async getUserHolds(showtimeId: string, userId: string) {
    const now = new Date();
    return this.prisma.seatHold.findMany({
      where: {
        userId,
        showtimeId,
        expiresAt: { gt: now },
      },
      include: {
        seat: {
          include: {
            category: { select: { id: true, name: true, price: true, currency: true, color: true } },
            section: { select: { id: true, name: true, nameVi: true } },
          },
        },
      },
      orderBy: { seat: { row: 'asc' } },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredHolds() {
    const now = new Date();
    const result = await this.prisma.seatHold.deleteMany({
      where: {
        expiresAt: { lte: now },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired seat holds`);
    }
  }
}
