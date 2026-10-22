import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ScannerService } from './scanner.service';
import {
  StartScanSessionDto,
  ScanTicketDto,
  OverrideScanDto,
  SyncOfflineScansDto,
} from './dto/scanner.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('scanner')
@ApiBearerAuth()
@Controller('scanner')
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  @Roles(Role.ENTRY_STAFF, Role.ADMIN)
  @Post('session/start')
  @ApiOperation({ summary: 'Start a scan session (select showtime and gate)' })
  async startSession(
    @Body() dto: StartScanSessionDto,
    @CurrentUser('id') staffId: string,
  ) {
    return this.scannerService.startSession(dto, staffId);
  }

  @Roles(Role.ENTRY_STAFF, Role.ADMIN)
  @Patch('session/:id/end')
  @ApiOperation({ summary: 'End a scan session' })
  async endSession(
    @Param('id') id: string,
    @CurrentUser('id') staffId: string,
  ) {
    return this.scannerService.endSession(id, staffId);
  }

  @Roles(Role.ENTRY_STAFF, Role.ADMIN)
  @Post('scan')
  @ApiOperation({ summary: 'Scan a ticket QR code (online)' })
  async scanTicket(
    @Body() dto: ScanTicketDto,
    @CurrentUser('id') staffId: string,
  ) {
    return this.scannerService.scanTicket(dto, staffId);
  }

  @Roles(Role.ENTRY_STAFF, Role.ADMIN)
  @Post('override')
  @ApiOperation({ summary: 'Override entry with staff note' })
  async overrideEntry(
    @Body() dto: OverrideScanDto,
    @CurrentUser('id') staffId: string,
  ) {
    return this.scannerService.overrideEntry(dto, staffId);
  }

  @Roles(Role.ENTRY_STAFF, Role.ADMIN)
  @Get('showtime/:showtimeId/ticket-list')
  @ApiOperation({ summary: 'Download ticket list for offline use (codes and statuses only, no PII)' })
  async downloadTicketList(@Param('showtimeId') showtimeId: string) {
    return this.scannerService.downloadTicketList(showtimeId);
  }

  @Roles(Role.ENTRY_STAFF, Role.ADMIN)
  @Post('sync-offline')
  @ApiOperation({ summary: 'Sync offline scans (idempotent via offlineScanId)' })
  async syncOfflineScans(
    @Body() dto: SyncOfflineScansDto,
    @CurrentUser('id') staffId: string,
  ) {
    return this.scannerService.syncOfflineScans(dto, staffId);
  }

  @Roles(Role.ENTRY_STAFF, Role.ADMIN)
  @Get('session/:id/scans')
  @ApiOperation({ summary: 'Get recent scans for a session' })
  async getSessionScans(
    @Param('id') id: string,
    @CurrentUser('id') staffId: string,
  ) {
    return this.scannerService.getSessionScans(id, staffId);
  }
}
