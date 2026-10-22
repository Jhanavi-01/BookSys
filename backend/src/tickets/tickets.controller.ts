import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { ResendTicketDto } from './dto/ticket.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Roles(Role.CUSTOMER)
  @Get()
  @ApiOperation({ summary: 'View my tickets' })
  @ApiQuery({ name: 'showtimeId', required: false })
  async getMyTickets(
    @CurrentUser('id') userId: string,
    @Query('showtimeId') showtimeId?: string,
  ) {
    return this.ticketsService.getMyTickets(userId, showtimeId);
  }

  @Public()
  @Get('verify/:code')
  @ApiOperation({ summary: 'Verify a ticket by code (public, for QR scanning)' })
  async verifyTicket(@Param('code') code: string) {
    return this.ticketsService.verifyByCode(code);
  }

  @Roles(Role.CUSTOMER)
  @Get(':id/qr')
  @ApiOperation({ summary: 'Get QR code for a ticket' })
  async getTicketQr(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.ticketsService.getTicketQr(id, userId);
  }

  @Roles(Role.CUSTOMER)
  @Post('resend')
  @ApiOperation({ summary: 'Resend ticket email (same tickets, no regeneration)' })
  async resendEmail(
    @Body() dto: ResendTicketDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ticketsService.resendTicketEmail(dto.orderId, userId);
  }

  @Roles(Role.CUSTOMER)
  @Get(':id/refund-preview')
  @ApiOperation({ summary: 'Preview refund amount before cancelling a ticket' })
  async getRefundPreview(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.ticketsService.getRefundPreview(id, userId);
  }

  @Roles(Role.CUSTOMER, Role.ADMIN)
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a ticket and initiate refund' })
  async cancelTicket(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.ticketsService.cancelTicket(id, userId);
  }
}
