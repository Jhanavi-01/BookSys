import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Roles(Role.ORGANIZER, Role.ADMIN, Role.ACCOUNTANT)
  @Get('showtime/:showtimeId/revenue')
  @ApiOperation({ summary: 'Revenue and ticket stats per showtime' })
  async getRevenueStats(
    @Param('showtimeId') showtimeId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.reportsService.getRevenueStats(showtimeId, userId, userRole);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN, Role.ENTRY_STAFF)
  @Get('showtime/:showtimeId/entry')
  @ApiOperation({ summary: 'Entry stats real-time (for organizer during event)' })
  async getEntryStats(
    @Param('showtimeId') showtimeId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.reportsService.getEntryStats(showtimeId, userId, userRole);
  }

  @Roles(Role.ACCOUNTANT, Role.ADMIN)
  @Post('showtime/:showtimeId/reconcile')
  @ApiOperation({ summary: 'Reconciliation: upload gateway statement, match by transaction ID' })
  async reconcile(
    @Param('showtimeId') showtimeId: string,
    @Body() body: { transactions: Array<{ transactionId: string; amount: number; status: string; date: string }> },
  ) {
    return this.reportsService.reconcile(showtimeId, body.transactions);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('showtime/:showtimeId/abandonment')
  @ApiOperation({ summary: 'Abandonment rate report' })
  async getAbandonmentReport(@Param('showtimeId') showtimeId: string) {
    return this.reportsService.getAbandonmentReport(showtimeId);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN, Role.ENTRY_STAFF)
  @Get('showtime/:showtimeId/entry-list/csv')
  @ApiOperation({ summary: 'Export entry list as CSV' })
  async exportEntryListCsv(
    @Param('showtimeId') showtimeId: string,
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.exportEntryListCsv(showtimeId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=entry-list-${showtimeId}.csv`);
    res.send(csv);
  }
}
