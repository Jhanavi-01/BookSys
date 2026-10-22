import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto, ChangeRoleDto } from './dto/create-user.dto';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createStaffAccount(dto: CreateUserDto, createdBy: string, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        emailVerified: true, // Staff accounts are pre-verified
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.auditService.log({
      userId: createdBy,
      action: 'STAFF_ACCOUNT_CREATED',
      entityType: 'User',
      entityId: user.id,
      newState: { email: user.email, role: user.role },
      ipAddress,
    });

    return user;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    role?: Role;
    isActive?: boolean;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.role) where.role = params.role;
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: 'insensitive' } },
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          emailVerified: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        preferredLanguage: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.preferredLanguage && { preferredLanguage: dto.preferredLanguage }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        preferredLanguage: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      userId,
      action: 'PROFILE_UPDATED',
      entityType: 'User',
      entityId: userId,
      previousState: { firstName: user.firstName, lastName: user.lastName },
      newState: { firstName: updated.firstName, lastName: updated.lastName },
    });

    return updated;
  }

  async changeRole(targetUserId: string, dto: ChangeRoleDto, changedBy: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    const previousRole = user.role;
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    await this.auditService.log({
      userId: changedBy,
      action: 'USER_ROLE_CHANGED',
      entityType: 'User',
      entityId: targetUserId,
      previousState: { role: previousRole },
      newState: { role: dto.role },
      ipAddress,
    });

    return updated;
  }

  async deactivate(targetUserId: string, deactivatedBy: string, reason?: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) throw new BadRequestException('User is already inactive');

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: false },
    });

    await this.auditService.log({
      userId: deactivatedBy,
      action: 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: targetUserId,
      details: { reason },
      ipAddress,
    });

    return { message: 'User deactivated successfully' };
  }

  async reactivate(targetUserId: string, reactivatedBy: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isActive) throw new BadRequestException('User is already active');

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: true },
    });

    await this.auditService.log({
      userId: reactivatedBy,
      action: 'USER_REACTIVATED',
      entityType: 'User',
      entityId: targetUserId,
      ipAddress,
    });

    return { message: 'User reactivated successfully' };
  }

  async gdprDeleteUser(userId: string, requestedBy: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Generate a random invalid password hash so login becomes impossible
    const randomHash = `$invalidated$${require('crypto').randomBytes(32).toString('hex')}`;

    // Wrap everything in a transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // Anonymize PII but keep financial records (orders, tickets, payments untouched)
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${userId}@anonymized.local`,
          firstName: 'Deleted',
          lastName: 'User',
          passwordHash: randomHash,
          emailVerified: false,
          emailVerifyToken: null,
          emailVerifyExpires: null,
          passwordResetToken: null,
          passwordResetExpires: null,
          isActive: false,
          consentWithdrawnAt: new Date(),
        },
      });

      // Delete notifications (non-financial)
      await tx.notification.deleteMany({ where: { userId } });

      // Anonymize consent records
      await tx.consentRecord.updateMany({
        where: { userId },
        data: { ipAddress: null },
      });
    });

    await this.auditService.log({
      userId: requestedBy,
      action: 'GDPR_DATA_DELETION',
      entityType: 'User',
      entityId: userId,
      details: { reason: 'GDPR data deletion request' },
      ipAddress,
    });

    return { message: 'User data has been anonymized per GDPR requirements' };
  }
}
