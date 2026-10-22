import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../common/redis/redis.module';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getDashboard() {
    const [
      userCount,
      eventCount,
      orderCount,
      ticketCount,
      recentAuditLogs,
      dbHealthy,
      redisHealthy,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.event.count(),
      this.prisma.order.count(),
      this.prisma.ticket.count(),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { email: true, role: true } },
        },
      }),
      this.prisma.isHealthy(),
      this.checkRedisHealth(),
    ]);

    const usersByRole = await this.prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });

    const ordersByStatus = await this.prisma.order.groupBy({
      by: ['status'],
      _count: true,
    });

    return {
      system: {
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        database: dbHealthy ? 'healthy' : 'unhealthy',
        redis: redisHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
      },
      counts: {
        users: userCount,
        events: eventCount,
        orders: orderCount,
        tickets: ticketCount,
      },
      usersByRole: usersByRole.map((r) => ({ role: r.role, count: r._count })),
      ordersByStatus: ordersByStatus.map((o) => ({ status: o.status, count: o._count })),
      recentActivity: recentAuditLogs,
    };
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
