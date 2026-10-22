import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ScanResult, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TicketsService } from '../tickets/tickets.service';
import {
  StartScanSessionDto,
  ScanTicketDto,
  OverrideScanDto,
  SyncOfflineScansDto,
} from './dto/scanner.dto';

@Injectable()
export class ScannerService {
  private readonly logger = new Logger(ScannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ticketsService: TicketsService,
  ) {}

  async startSession(dto: StartScanSessionDto, staffId: string) {
    const showtime = await this.prisma.showtime.findUnique({
      where: { id: dto.showtimeId },
    });
    if (!showtime) throw new NotFoundException('Showtime not found');

    // End any existing active session for this staff
    await this.prisma.scanSession.updateMany({
      where: { staffId, isActive: true },
      data: { isActive: false, endedAt: new Date() },
    });

    const session = await this.prisma.scanSession.create({
      data: {
        staffId,
        showtimeId: dto.showtimeId,
        gate: dto.gate,
        deviceId: dto.deviceId,
        isActive: true,
      },
      include: {
        showtime: {
          include: {
            event: { select: { title: true } },
            venue: { select: { name: true } },
          },
        },
      },
    });

    await this.auditService.log({
      userId: staffId,
      action: 'SCAN_SESSION_STARTED',
      entityType: 'ScanSession',
      entityId: session.id,
      details: { gate: dto.gate, deviceId: dto.deviceId },
    });

    return session;
  }

  async endSession(sessionId: string, staffId: string) {
    const session = await this.prisma.scanSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.staffId !== staffId) throw new BadRequestException('Not your session');

    await this.prisma.scanSession.update({
      where: { id: sessionId },
      data: { isActive: false, endedAt: new Date() },
    });

    return { message: 'Session ended' };
  }

  async scanTicket(dto: ScanTicketDto, staffId: string) {
    const session = await this.prisma.scanSession.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session || !session.isActive) {
      throw new BadRequestException('Invalid or inactive scan session');
    }
    if (session.staffId !== staffId) {
      throw new BadRequestException('Not your session');
    }

    // Parse QR data
    let qrParsed: { payload: string; signature: string };
    try {
      qrParsed = JSON.parse(dto.qrData);
    } catch {
      // Record invalid scan
      const scan = await this.prisma.entryScan.create({
        data: {
          scannedCode: dto.qrData,
          result: ScanResult.INVALID,
          scanSessionId: session.id,
          gate: session.gate,
          note: 'Invalid QR format',
        },
      });
      return { result: ScanResult.INVALID, message: 'Invalid QR code format', scan };
    }

    // Verify HMAC signature
    const isValidSignature = this.ticketsService.verifyTicketSignature(
      qrParsed.payload,
      qrParsed.signature,
    );

    if (!isValidSignature) {
      const scan = await this.prisma.entryScan.create({
        data: {
          scannedCode: dto.qrData,
          result: ScanResult.INVALID,
          scanSessionId: session.id,
          gate: session.gate,
          note: 'Invalid signature',
        },
      });
      return { result: ScanResult.INVALID, message: 'Invalid ticket signature', scan };
    }

    // Parse ticket payload
    let ticketPayload: { ticketCode: string; showtimeId: string; seatLabel: string };
    try {
      ticketPayload = JSON.parse(qrParsed.payload);
    } catch {
      const scan = await this.prisma.entryScan.create({
        data: {
          scannedCode: dto.qrData,
          result: ScanResult.INVALID,
          scanSessionId: session.id,
          gate: session.gate,
          note: 'Invalid payload format',
        },
      });
      return { result: ScanResult.INVALID, message: 'Invalid ticket payload', scan };
    }

    // Find ticket
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode: ticketPayload.ticketCode },
      include: {
        showtime: { select: { id: true, startsAt: true, endsAt: true } },
      },
    });

    if (!ticket) {
      const scan = await this.prisma.entryScan.create({
        data: {
          scannedCode: dto.qrData,
          result: ScanResult.NOT_FOUND,
          scanSessionId: session.id,
          gate: session.gate,
        },
      });
      return { result: ScanResult.NOT_FOUND, message: 'Ticket not found', scan };
    }

    // Check if ticket is for this showtime
    if (ticket.showtimeId !== session.showtimeId) {
      const scan = await this.prisma.entryScan.create({
        data: {
          ticketId: ticket.id,
          scannedCode: dto.qrData,
          result: ScanResult.WRONG_SHOWTIME,
          scanSessionId: session.id,
          gate: session.gate,
        },
      });
      return { result: ScanResult.WRONG_SHOWTIME, message: 'Ticket is for a different showtime', scan };
    }

    // Check ticket status
    if (ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.REFUNDED) {
      const scan = await this.prisma.entryScan.create({
        data: {
          ticketId: ticket.id,
          scannedCode: dto.qrData,
          result: ScanResult.CANCELLED,
          scanSessionId: session.id,
          gate: session.gate,
        },
      });
      return { result: ScanResult.CANCELLED, message: 'Ticket has been cancelled', scan };
    }

    if (ticket.status === TicketStatus.USED) {
      // Find when/where it was used
      const previousScan = await this.prisma.entryScan.findFirst({
        where: { ticketId: ticket.id, result: ScanResult.VALID },
        orderBy: { scannedAt: 'desc' },
      });

      const scan = await this.prisma.entryScan.create({
        data: {
          ticketId: ticket.id,
          scannedCode: dto.qrData,
          result: ScanResult.ALREADY_USED,
          scanSessionId: session.id,
          gate: session.gate,
          note: previousScan
            ? `Previously used at ${previousScan.gate} on ${previousScan.scannedAt.toISOString()}`
            : undefined,
        },
      });

      return {
        result: ScanResult.ALREADY_USED,
        message: 'Ticket has already been used',
        previousScan: previousScan
          ? { gate: previousScan.gate, scannedAt: previousScan.scannedAt }
          : null,
        scan,
      };
    }

    // Mark ticket as used - with DB constraint for single use
    try {
      await this.prisma.$transaction(async (tx) => {
        // Re-check status inside transaction to handle concurrent scans
        const currentTicket = await tx.ticket.findUnique({
          where: { id: ticket.id },
        });
        if (currentTicket!.status !== TicketStatus.ACTIVE) {
          throw new ConflictException('Ticket status changed during processing');
        }

        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.USED,
            usedAt: new Date(),
          },
        });
      });

      const scan = await this.prisma.entryScan.create({
        data: {
          ticketId: ticket.id,
          scannedCode: dto.qrData,
          result: ScanResult.VALID,
          scanSessionId: session.id,
          gate: session.gate,
        },
      });

      return {
        result: ScanResult.VALID,
        message: 'Valid ticket - entry granted',
        ticket: {
          ticketCode: ticket.ticketCode,
          seatLabel: ticket.seatLabel,
        },
        scan,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        const scan = await this.prisma.entryScan.create({
          data: {
            ticketId: ticket.id,
            scannedCode: dto.qrData,
            result: ScanResult.ALREADY_USED,
            scanSessionId: session.id,
            gate: session.gate,
            note: 'Concurrent scan conflict',
          },
        });
        return { result: ScanResult.ALREADY_USED, message: 'Ticket was just used by another scanner', scan };
      }
      throw error;
    }
  }

  async overrideEntry(dto: OverrideScanDto, staffId: string) {
    const session = await this.prisma.scanSession.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session || !session.isActive || session.staffId !== staffId) {
      throw new BadRequestException('Invalid session');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode: dto.ticketCode },
    });

    const scan = await this.prisma.entryScan.create({
      data: {
        ticketId: ticket?.id,
        scannedCode: dto.ticketCode,
        result: ScanResult.VALID,
        scanSessionId: session.id,
        gate: session.gate,
        staffNote: dto.staffNote,
        overrideBy: staffId,
        note: 'Manual override by staff',
      },
    });

    if (ticket && ticket.status === TicketStatus.ACTIVE) {
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: TicketStatus.USED, usedAt: new Date() },
      });
    }

    await this.auditService.log({
      userId: staffId,
      action: 'ENTRY_OVERRIDE',
      entityType: 'EntryScan',
      entityId: scan.id,
      details: { ticketCode: dto.ticketCode, staffNote: dto.staffNote },
    });

    return { result: ScanResult.VALID, message: 'Override entry granted', scan };
  }

  async downloadTicketList(showtimeId: string) {
    // Only ticket codes and statuses, no PII
    const tickets = await this.prisma.ticket.findMany({
      where: { showtimeId },
      select: {
        ticketCode: true,
        seatLabel: true,
        status: true,
        qrPayload: true,
        qrSignature: true,
      },
      orderBy: { seatLabel: 'asc' },
    });

    return tickets;
  }

  async syncOfflineScans(dto: SyncOfflineScansDto, staffId: string) {
    const session = await this.prisma.scanSession.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.staffId !== staffId) throw new BadRequestException('Not your session');

    const results = [];

    for (const offlineScan of dto.scans) {
      // Idempotent via offlineScanId
      const existing = await this.prisma.entryScan.findUnique({
        where: { offlineScanId: offlineScan.offlineScanId },
      });
      if (existing) {
        results.push({
          offlineScanId: offlineScan.offlineScanId,
          status: 'already_synced',
          result: existing.result,
        });
        continue;
      }

      // Process the scan
      let qrParsed: any;
      let ticketPayload: any;
      let ticket: any = null;

      try {
        qrParsed = JSON.parse(offlineScan.qrData);
        const isValid = this.ticketsService.verifyTicketSignature(
          qrParsed.payload,
          qrParsed.signature,
        );

        if (isValid) {
          ticketPayload = JSON.parse(qrParsed.payload);
          ticket = await this.prisma.ticket.findUnique({
            where: { ticketCode: ticketPayload.ticketCode },
          });
        }
      } catch {
        // Invalid QR data
      }

      let result: ScanResult = ScanResult.INVALID;
      let note = '';

      if (ticket) {
        if (ticket.showtimeId !== session.showtimeId) {
          result = ScanResult.WRONG_SHOWTIME;
        } else if (ticket.status === TicketStatus.USED) {
          // Check for conflict: was it used at a different gate?
          const previousScan = await this.prisma.entryScan.findFirst({
            where: { ticketId: ticket.id, result: ScanResult.VALID },
          });
          if (previousScan && previousScan.gate !== offlineScan.gate) {
            result = ScanResult.CONFLICT;
            note = `Conflict: used at ${previousScan.gate}, offline scan at ${offlineScan.gate}`;
          } else {
            result = ScanResult.ALREADY_USED;
          }
        } else if (ticket.status === TicketStatus.ACTIVE) {
          result = ScanResult.OFFLINE_VALID;
          // Mark as used
          await this.prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: TicketStatus.USED, usedAt: new Date(offlineScan.scannedAt) },
          });
        } else {
          result = ScanResult.CANCELLED;
        }
      } else if (qrParsed && ticketPayload) {
        result = ScanResult.NOT_FOUND;
      }

      const scan = await this.prisma.entryScan.create({
        data: {
          ticketId: ticket?.id,
          scannedCode: offlineScan.qrData,
          result,
          scanSessionId: session.id,
          gate: offlineScan.gate || session.gate,
          scannedAt: new Date(offlineScan.scannedAt),
          isOffline: true,
          syncedAt: new Date(),
          deviceId: offlineScan.deviceId || session.deviceId,
          offlineScanId: offlineScan.offlineScanId,
          note: note || undefined,
        },
      });

      results.push({
        offlineScanId: offlineScan.offlineScanId,
        status: 'synced',
        result: scan.result,
        note,
      });
    }

    await this.auditService.log({
      userId: staffId,
      action: 'OFFLINE_SCANS_SYNCED',
      entityType: 'ScanSession',
      entityId: dto.sessionId,
      details: { scanCount: dto.scans.length },
    });

    return { synced: results.length, results };
  }

  async getSessionScans(sessionId: string, staffId: string) {
    const session = await this.prisma.scanSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.staffId !== staffId) throw new BadRequestException('Not your session');

    return this.prisma.entryScan.findMany({
      where: { scanSessionId: sessionId },
      orderBy: { scannedAt: 'desc' },
      take: 100,
    });
  }
}
