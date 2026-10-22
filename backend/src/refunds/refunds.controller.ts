import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RefundsService } from './refunds.service';
import { RequestRefundDto, BulkRefundDto, ProcessRefundDto } from './dto/refund.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('refunds')
@ApiBearerAuth()
@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Roles(Role.CUSTOMER)
  @Post('request')
  @ApiOperation({ summary: 'Request a refund (customer cancel before deadline)' })
  async requestRefund(
    @Body() dto: RequestRefundDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.refundsService.requestRefund(dto, userId);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post('bulk')
  @ApiOperation({ summary: 'Bulk refund for cancelled showtime' })
  async bulkRefund(
    @Body() dto: BulkRefundDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.refundsService.bulkRefundForShowtime(dto, userId);
  }

  @Roles(Role.ACCOUNTANT, Role.ADMIN)
  @Get('queue')
  @ApiOperation({ summary: 'Accountant review queue for pending/failed refunds' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getRefundQueue(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.refundsService.getRefundQueue(page, limit);
  }

  @Roles(Role.ACCOUNTANT, Role.ADMIN)
  @Post('process')
  @ApiOperation({ summary: 'Process a refund (approve/reject)' })
  async processRefund(
    @Body() dto: ProcessRefundDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.refundsService.processRefund(dto.refundId, dto.action, userId, dto.note);
  }
}
