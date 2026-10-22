import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ReservationsService } from './reservations.service';
import { HoldSeatsDto, ReleaseSeatsDto } from './dto/hold-seats.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Roles(Role.CUSTOMER)
  @Post('hold')
  @ApiOperation({ summary: 'Hold seats (atomic, all-or-nothing, 10 min expiry)' })
  async holdSeats(
    @Body() dto: HoldSeatsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reservationsService.holdSeats(dto, userId);
  }

  @Roles(Role.CUSTOMER)
  @Delete('release')
  @ApiOperation({ summary: 'Release individual held seats' })
  async releaseSeats(
    @Body() dto: ReleaseSeatsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reservationsService.releaseSeats(dto, userId);
  }

  @Roles(Role.CUSTOMER)
  @Get('showtime/:showtimeId')
  @ApiOperation({ summary: 'Get current holds for user in a showtime' })
  async getUserHolds(
    @Param('showtimeId') showtimeId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.reservationsService.getUserHolds(showtimeId, userId);
  }
}
