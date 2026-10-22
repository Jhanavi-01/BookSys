import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { WaitingRoomService } from './waiting-room.service';
import { JoinWaitingRoomDto, ConfigureWaitingRoomDto } from './dto/waiting-room.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('waiting-room')
@ApiBearerAuth()
@Controller('waiting-room')
export class WaitingRoomController {
  constructor(private readonly waitingRoomService: WaitingRoomService) {}

  @Roles(Role.ADMIN, Role.ORGANIZER)
  @Post('configure')
  @ApiOperation({ summary: 'Configure waiting room for a showtime' })
  async configure(
    @Body() dto: ConfigureWaitingRoomDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.waitingRoomService.configure(dto, userId);
  }

  @Roles(Role.CUSTOMER)
  @Post('join')
  @ApiOperation({ summary: 'Join waiting room queue' })
  async join(
    @Body() dto: JoinWaitingRoomDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.waitingRoomService.join(dto.showtimeId, userId);
  }

  @Roles(Role.CUSTOMER)
  @Get('showtime/:showtimeId/position')
  @ApiOperation({ summary: 'Check queue position' })
  async checkPosition(
    @Param('showtimeId') showtimeId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.waitingRoomService.checkPosition(showtimeId, userId);
  }

  @Roles(Role.CUSTOMER)
  @Delete('showtime/:showtimeId/leave')
  @ApiOperation({ summary: 'Leave the waiting room' })
  async leave(
    @Param('showtimeId') showtimeId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.waitingRoomService.leave(showtimeId, userId);
  }

  @Roles(Role.ADMIN, Role.ORGANIZER)
  @Get('showtime/:showtimeId/status')
  @ApiOperation({ summary: 'Get waiting room status' })
  async getStatus(@Param('showtimeId') showtimeId: string) {
    return this.waitingRoomService.getStatus(showtimeId);
  }
}
