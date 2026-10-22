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
import { SeatsService } from './seats.service';
import { UploadSeatMapDto, UpdateCategoryPriceDto } from './dto/seat-map.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('seats')
@Controller('seats')
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post('showtime/:showtimeId/upload')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload seat map for a showtime (validates fully, single transaction)' })
  async uploadSeatMap(
    @Param('showtimeId') showtimeId: string,
    @Body() dto: UploadSeatMapDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.seatsService.uploadSeatMap(showtimeId, dto, userId, userRole);
  }

  @Public()
  @Get('showtime/:showtimeId/status')
  @ApiOperation({ summary: 'Get seat status for a showtime (single query, not per-seat)' })
  async getSeatStatus(@Param('showtimeId') showtimeId: string) {
    return this.seatsService.getSeatStatus(showtimeId);
  }

  @Public()
  @Get('showtime/:showtimeId/categories')
  @ApiOperation({ summary: 'Get seat categories and prices for a showtime' })
  async getCategories(@Param('showtimeId') showtimeId: string) {
    return this.seatsService.getCategories(showtimeId);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Patch('category/:categoryId/price')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update price for a seat category' })
  async updateCategoryPrice(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryPriceDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.seatsService.updateCategoryPrice(categoryId, dto, userId, userRole);
  }
}
