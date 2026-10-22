import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OrganizerService } from './organizer.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('organizer')
@ApiBearerAuth()
@Controller('organizer')
export class OrganizerController {
  constructor(private readonly organizerService: OrganizerService) {}

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('stats')
  @ApiOperation({ summary: 'Get organizer dashboard statistics' })
  async getStats(@CurrentUser('id') userId: string, @CurrentUser('role') role: Role) {
    return this.organizerService.getStats(userId, role);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('orders/recent')
  @ApiOperation({ summary: 'Get recent orders for organizer events' })
  async getRecentOrders(@CurrentUser('id') userId: string, @CurrentUser('role') role: Role) {
    return this.organizerService.getRecentOrders(userId, role);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('events')
  @ApiOperation({ summary: 'Get organizer events list' })
  async getEvents(@CurrentUser('id') userId: string, @CurrentUser('role') role: Role) {
    return this.organizerService.getEvents(userId, role);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('venues')
  @ApiOperation({ summary: 'Get all venues for event creation' })
  async getVenues() {
    return this.organizerService.getVenues();
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post('venues')
  @ApiOperation({ summary: 'Create a venue' })
  async createVenue(@Body() body: any) {
    return this.organizerService.createVenue(body);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Put('venues/:id')
  @ApiOperation({ summary: 'Update a venue' })
  async updateVenue(@Param('id') id: string, @Body() body: any) {
    return this.organizerService.updateVenue(id, body);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Delete('venues/:id')
  @ApiOperation({ summary: 'Delete a venue' })
  async deleteVenue(@Param('id') id: string) {
    return this.organizerService.deleteVenue(id);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('showtimes/:showtimeId/pricing')
  @ApiOperation({ summary: 'Get seat categories and pricing for a showtime' })
  async getShowtimePricing(@Param('showtimeId') showtimeId: string) {
    return this.organizerService.getShowtimePricing(showtimeId);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Put('showtimes/:showtimeId/pricing')
  @ApiOperation({ summary: 'Update pricing for showtime categories' })
  async updateShowtimePricing(
    @Param('showtimeId') showtimeId: string,
    @Body() body: any,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.organizerService.updateShowtimePricing(showtimeId, body.pricing, userId, role);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post('showtimes/:showtimeId/seat-map')
  @ApiOperation({ summary: 'Upload seat map JSON for a showtime' })
  async uploadSeatMap(
    @Param('showtimeId') showtimeId: string,
    @Body() body: any,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.organizerService.uploadSeatMap(showtimeId, body, userId, role);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('reports/revenue')
  @ApiOperation({ summary: 'Get revenue report across all organizer events' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getRevenueReport(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.organizerService.getRevenueReport(userId, role, from, to);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('reports/revenue/export')
  @ApiOperation({ summary: 'Export revenue report as CSV' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async exportRevenue(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.organizerService.exportRevenueCsv(userId, role, from, to);
  }
}
