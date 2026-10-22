import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { REDIS_CLIENT } from '../common/redis/redis.module';
import { ConfigureWaitingRoomDto } from './dto/waiting-room.dto';

@Injectable()
export class WaitingRoomService {
  private readonly logger = new Logger(WaitingRoomService.name);
  private readonly passDurationSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.passDurationSeconds = configService.get<number>(
      'WAITING_ROOM_PASS_DURATION_SECONDS',
      300,
    );
  }

  private queueKey(showtimeId: string) {
    return `waiting_room:queue:${showtimeId}`;
  }

  private activeKey(showtimeId: string) {
    return `waiting_room:active:${showtimeId}`;
  }

  private passKey(showtimeId: string, userId: string) {
    return `waiting_room:pass:${showtimeId}:${userId}`;
  }

  async configure(dto: ConfigureWaitingRoomDto, userId: string) {
    const waitingRoom = await this.prisma.waitingRoom.upsert({
      where: { showtimeId: dto.showtimeId },
      update: {
        isActive: dto.isActive ?? true,
        maxConcurrent: dto.maxConcurrent ?? 100,
      },
      create: {
        showtimeId: dto.showtimeId,
        isActive: dto.isActive ?? true,
        maxConcurrent: dto.maxConcurrent ?? 100,
      },
    });

    await this.auditService.log({
      userId,
      action: 'WAITING_ROOM_CONFIGURED',
      entityType: 'WaitingRoom',
      entityId: waitingRoom.id,
      newState: { isActive: waitingRoom.isActive, maxConcurrent: waitingRoom.maxConcurrent },
    });

    return waitingRoom;
  }

  async join(showtimeId: string, userId: string) {
    const waitingRoom = await this.prisma.waitingRoom.findUnique({
      where: { showtimeId },
    });

    if (!waitingRoom || !waitingRoom.isActive) {
      // No waiting room active - allow direct access
      return { status: 'direct_access', position: 0, estimatedWaitSeconds: 0 };
    }

    // Check if user already has an active pass
    const existingPass = await this.redis.get(this.passKey(showtimeId, userId));
    if (existingPass) {
      const ttl = await this.redis.ttl(this.passKey(showtimeId, userId));
      return {
        status: 'has_pass',
        passExpiresIn: ttl,
        position: 0,
      };
    }

    // Check current active count
    const activeCount = await this.redis.scard(this.activeKey(showtimeId));

    if (activeCount < waitingRoom.maxConcurrent) {
      // Admit directly
      const passId = uuidv4();
      await this.redis.set(
        this.passKey(showtimeId, userId),
        passId,
        'EX',
        this.passDurationSeconds,
      );
      await this.redis.sadd(this.activeKey(showtimeId), userId);

      return {
        status: 'admitted',
        passId,
        passExpiresIn: this.passDurationSeconds,
        position: 0,
      };
    }

    // Add to FIFO queue
    const queueEntry = JSON.stringify({ userId, joinedAt: Date.now() });
    await this.redis.rpush(this.queueKey(showtimeId), queueEntry);

    // Get position
    const queueLength = await this.redis.llen(this.queueKey(showtimeId));

    // Estimate wait: assume each person takes 2 minutes
    const estimatedWaitSeconds = queueLength * 120;

    return {
      status: 'queued',
      position: queueLength,
      estimatedWaitSeconds,
    };
  }

  async checkPosition(showtimeId: string, userId: string) {
    // Check if user has a pass
    const existingPass = await this.redis.get(this.passKey(showtimeId, userId));
    if (existingPass) {
      const ttl = await this.redis.ttl(this.passKey(showtimeId, userId));
      return {
        status: 'has_pass',
        passExpiresIn: ttl,
        position: 0,
      };
    }

    // Find position in queue
    const queue = await this.redis.lrange(this.queueKey(showtimeId), 0, -1);
    const position = queue.findIndex((entry) => {
      try {
        const parsed = JSON.parse(entry);
        return parsed.userId === userId;
      } catch {
        return false;
      }
    });

    if (position === -1) {
      return { status: 'not_in_queue', position: -1 };
    }

    return {
      status: 'queued',
      position: position + 1,
      estimatedWaitSeconds: (position + 1) * 120,
    };
  }

  async admitNext(showtimeId: string) {
    const waitingRoom = await this.prisma.waitingRoom.findUnique({
      where: { showtimeId },
    });
    if (!waitingRoom) return null;

    const activeCount = await this.redis.scard(this.activeKey(showtimeId));
    if (activeCount >= waitingRoom.maxConcurrent) {
      return null;
    }

    // Pop from queue (FIFO)
    const entry = await this.redis.lpop(this.queueKey(showtimeId));
    if (!entry) return null;

    try {
      const parsed = JSON.parse(entry);
      const passId = uuidv4();

      await this.redis.set(
        this.passKey(showtimeId, parsed.userId),
        passId,
        'EX',
        this.passDurationSeconds,
      );
      await this.redis.sadd(this.activeKey(showtimeId), parsed.userId);

      return { userId: parsed.userId, passId };
    } catch {
      return null;
    }
  }

  async leave(showtimeId: string, userId: string) {
    await this.redis.del(this.passKey(showtimeId, userId));
    await this.redis.srem(this.activeKey(showtimeId), userId);

    // Try to admit next person
    await this.admitNext(showtimeId);

    return { message: 'Left waiting room' };
  }

  async hasValidPass(showtimeId: string, userId: string): Promise<boolean> {
    const waitingRoom = await this.prisma.waitingRoom.findUnique({
      where: { showtimeId },
    });
    if (!waitingRoom || !waitingRoom.isActive) return true;

    const pass = await this.redis.get(this.passKey(showtimeId, userId));
    return !!pass;
  }

  async getStatus(showtimeId: string) {
    const waitingRoom = await this.prisma.waitingRoom.findUnique({
      where: { showtimeId },
    });

    if (!waitingRoom) {
      return { isActive: false, queueLength: 0, activeCount: 0 };
    }

    const [queueLength, activeCount] = await Promise.all([
      this.redis.llen(this.queueKey(showtimeId)),
      this.redis.scard(this.activeKey(showtimeId)),
    ]);

    return {
      isActive: waitingRoom.isActive,
      maxConcurrent: waitingRoom.maxConcurrent,
      queueLength,
      activeCount,
    };
  }
}
