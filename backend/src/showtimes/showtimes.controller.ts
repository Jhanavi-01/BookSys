import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ShowtimesService } from './showtimes.service';
import { SeatsService } from '../seats/seats.service';
import {
  CreateShowtimeDto,
  UpdateShowtimeDto,
  UpdateSaleStatusDto,
  CloneShowtimeDto,
} from './dto/create-showtime.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('showtimes')
@Controller('showtimes')
export class ShowtimesController {
  constructor(
    private readonly showtimesService: ShowtimesService,
    private readonly seatsService: SeatsService,
  ) {}

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a showtime for an event' })
  async create(
    @Body() dto: CreateShowtimeDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.showtimesService.create(dto, userId, userRole);
  }

  @Public()
  @Get('event/:eventId')
  @ApiOperation({ summary: 'List showtimes for an event' })
  async findByEvent(@Param('eventId') eventId: string) {
    return this.showtimesService.findByEvent(eventId);
  }

  @Public()
  @Get(':id/seats')
  @ApiOperation({ summary: 'Get seat map with status for a showtime' })
  async getSeats(@Param('id') id: string) {
    const rawSeats = await this.seatsService.getSeatStatus(id);
    const seats = rawSeats.map((s: any) => ({
      id: s.id,
      row: s.row,
      number: s.number,
      label: s.label,
      x: s.x,
      y: s.y,
      status: s.status,
      category: s.category?.name || '',
      price: s.category?.price || 0,
      color: s.category?.color || '#22c55e',
      section: s.section?.name || '',
      holdExpiresAt: s.holdExpiresAt,
      holdUserId: s.holdUserId,
    }));
    return { seats };
  }

  @Public()
  @Get(':id/my-holds')
  @ApiOperation({ summary: 'Get current user held seats for a showtime' })
  async getMyHolds(@Param('id') id: string) {
    // Returns empty when not authenticated (public route)
    return { seats: [], expiresAt: null };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get showtime details' })
  async findById(@Param('id') id: string) {
    return this.showtimesService.findById(id);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a showtime' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShowtimeDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.showtimesService.update(id, dto, userId, userRole);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Patch(':id/sale-status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update showtime sale status (DRAFT -> ON_SALE -> CLOSED)' })
  async updateSaleStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSaleStatusDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.showtimesService.updateSaleStatus(id, dto, userId, userRole);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post(':id/clone')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clone a showtime with seats and prices' })
  async clone(
    @Param('id') id: string,
    @Body() dto: CloneShowtimeDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.showtimesService.clone(id, dto, userId, userRole);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a draft showtime' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.showtimesService.delete(id, userId, userRole);
  }
}
