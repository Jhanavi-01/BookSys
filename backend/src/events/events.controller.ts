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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EventStatus, Role } from '@prisma/client';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, UpdateEventStatusDto } from './dto/create-event.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an event (organizer/admin)' })
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventsService.create(dto, userId);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List events (public for published, filtered for organizer/admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false, enum: EventStatus })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: EventStatus,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    // Public route returns only published events
    return this.eventsService.findAll({
      page, limit, status: status || EventStatus.PUBLISHED, category, search,
      userRole: Role.CUSTOMER,
    });
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my events (organizer sees own, admin sees all)' })
  async findMyEvents(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: EventStatus,
  ) {
    return this.eventsService.findAll({ page, limit, status, userId, userRole });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get event details' })
  async findById(@Param('id') id: string) {
    return this.eventsService.findById(id);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an event' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.eventsService.update(id, dto, userId, userRole);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Patch(':id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEventStatusDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.eventsService.updateStatus(id, dto, userId, userRole);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a draft event' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.eventsService.delete(id, userId, userRole);
  }
}
