import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../common/redis/redis.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxAttempts: number;
  private readonly lockoutMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.maxAttempts = this.configService.get<number>('LOGIN_MAX_ATTEMPTS', 5);
    this.lockoutMinutes = this.configService.get<number>('LOGIN_LOCKOUT_MINUTES', 15);
  }

  async register(dto: RegisterDto, ipAddress?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Don't reveal whether email exists
    if (existingUser) {
      return {
        message: 'If this email is not already registered, a verification email has been sent.',
      };
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'CUSTOMER',
        emailVerifyToken,
        emailVerifyExpires,
        consentVersion: '1.0',
        consentAt: new Date(),
      },
    });

    // Create consent record
    await this.prisma.consentRecord.create({
      data: {
        userId: user.id,
        version: '1.0',
        consentType: 'TERMS_AND_CONDITIONS',
        grantedAt: new Date(),
        ipAddress,
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      newState: { email: user.email, role: user.role },
      ipAddress,
    });

    // Send verification email
    await this.notificationsService.sendEmailVerification(user, emailVerifyToken);

    return {
      message: 'If this email is not already registered, a verification email has been sent.',
    };
  }

  async validateUser(email: string, password: string) {
    const normalizedEmail = email.toLowerCase();

    // Check Redis for lockout
    const lockKey = `login_lock:${normalizedEmail}`;
    const attemptsKey = `login_attempts:${normalizedEmail}`;

    const lockedUntil = await this.redis.get(lockKey);
    if (lockedUntil) {
      const remainingSeconds = Math.ceil(
        (parseInt(lockedUntil) - Date.now()) / 1000,
      );
      if (remainingSeconds > 0) {
        throw new UnauthorizedException(
          `Account is temporarily locked. Try again in ${Math.ceil(remainingSeconds / 60)} minutes.`,
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      // Increment attempts even for non-existent users to prevent enumeration
      await this.incrementLoginAttempts(normalizedEmail);
      return null;
    }

    // Check DB-level lock (in case Redis was cleared)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        'Account is temporarily locked. Please try again later.',
      );
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      await this.incrementLoginAttempts(normalizedEmail, user.id);
      return null;
    }

    // Reset attempts on success
    await this.redis.del(attemptsKey);
    await this.redis.del(lockKey);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  }

  private async incrementLoginAttempts(email: string, userId?: string) {
    const attemptsKey = `login_attempts:${email}`;
    const lockKey = `login_lock:${email}`;

    const attempts = await this.redis.incr(attemptsKey);
    await this.redis.expire(attemptsKey, this.lockoutMinutes * 60);

    if (attempts >= this.maxAttempts) {
      const lockUntil = Date.now() + this.lockoutMinutes * 60 * 1000;
      await this.redis.set(lockKey, lockUntil.toString(), 'EX', this.lockoutMinutes * 60);

      // Also update DB as a backup
      if (userId) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            loginAttempts: attempts,
            lockedUntil: new Date(lockUntil),
          },
        });
      }

      this.logger.warn(`Account locked for ${email} after ${attempts} failed attempts`);

      await this.auditService.log({
        userId,
        action: 'ACCOUNT_LOCKED',
        entityType: 'User',
        entityId: userId,
        details: { email, attempts, lockoutMinutes: this.lockoutMinutes },
      });
    } else if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { loginAttempts: attempts },
      });
    }
  }

  // The current required consent version. When this changes, users must re-agree on next login.
  private readonly currentConsentVersion = '1.0';

  async login(user: any, ipAddress?: string) {
    // Check if user needs to re-agree to updated policies
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { consentVersion: true, consentWithdrawnAt: true },
    });

    if (fullUser && fullUser.consentVersion !== this.currentConsentVersion) {
      return {
        consentRequired: true,
        requiredVersion: this.currentConsentVersion,
        userId: user.id,
        message: 'You must agree to the updated Terms of Service and Privacy Policy to continue.',
      };
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    await this.auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    };
  }

  async acceptUpdatedConsent(userId: string, version: string, ipAddress?: string) {
    if (version !== this.currentConsentVersion) {
      throw new BadRequestException('Invalid consent version');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        consentVersion: version,
        consentAt: new Date(),
        consentWithdrawnAt: null,
      },
    });

    await this.prisma.consentRecord.create({
      data: {
        userId,
        version,
        consentType: 'TERMS_AND_CONDITIONS',
        grantedAt: new Date(),
        ipAddress,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CONSENT_UPDATED',
      entityType: 'User',
      entityId: userId,
      newState: { consentVersion: version },
      ipAddress,
    });

    // Now complete the login
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    };
  }

  async withdrawMarketingConsent(userId: string, ipAddress?: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { consentWithdrawnAt: new Date() },
    });

    await this.prisma.consentRecord.create({
      data: {
        userId,
        version: this.currentConsentVersion,
        consentType: 'MARKETING_WITHDRAWAL',
        grantedAt: new Date(),
        withdrawnAt: new Date(),
        ipAddress,
      },
    });

    await this.auditService.log({
      userId,
      action: 'MARKETING_CONSENT_WITHDRAWN',
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });

    return { message: 'Marketing consent withdrawn. You will no longer receive marketing emails.' };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'EMAIL_VERIFIED',
      entityType: 'User',
      entityId: user.id,
    });

    return { message: 'Email verified successfully' };
  }

  async resendVerification(email: string) {
    const normalizedEmail = email.toLowerCase();

    // Rate limit: max 5 per hour per email
    const rateLimitKey = `verify_resend:${normalizedEmail}`;
    const count = await this.redis.incr(rateLimitKey);
    if (count === 1) {
      await this.redis.expire(rateLimitKey, 3600);
    }
    if (count > 5) {
      throw new BadRequestException('Too many verification requests. Please try again later.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Don't reveal if email exists
    if (!user || user.emailVerified) {
      return { message: 'If the email exists and is unverified, a verification email has been sent.' };
    }

    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken, emailVerifyExpires },
    });

    await this.notificationsService.sendEmailVerification(user, emailVerifyToken);

    return { message: 'If the email exists and is unverified, a verification email has been sent.' };
  }

  async requestPasswordReset(email: string, ipAddress?: string) {
    const normalizedEmail = email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Always return same response
    const response = { message: 'If the email exists, a password reset link has been sent.' };

    if (!user || !user.isActive) {
      return response;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    await this.notificationsService.sendPasswordReset(user, resetToken);

    await this.auditService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return response;
  }

  async resetPassword(token: string, newPassword: string, ipAddress?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Clear Redis lockout
    await this.redis.del(`login_attempts:${user.email}`);
    await this.redis.del(`login_lock:${user.email}`);

    await this.auditService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return { message: 'Password reset successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
        consentVersion: true,
        consentAt: true,
        consentWithdrawnAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
