import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles(Role.CUSTOMER)
  @Post()
  @ApiOperation({ summary: 'Create order from held seats (single transaction)' })
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.createOrder(dto, userId);
  }

  @Roles(Role.CUSTOMER)
  @Get()
  @ApiOperation({ summary: 'Get my order history with pagination' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getMyOrders(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.getMyOrders(userId, page, limit);
  }

  @Roles(Role.CUSTOMER)
  @Get(':id')
  @ApiOperation({ summary: 'Get order detail (owner only)' })
  async getOrderDetail(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.getOrderDetail(id, userId);
  }

  @Roles(Role.CUSTOMER)
  @Get(':id/status')
  @ApiOperation({ summary: 'Poll order status (lightweight)' })
  async getOrderStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.getOrderStatus(id, userId);
  }

  @Roles(Role.CUSTOMER)
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending order' })
  async cancelOrder(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.cancelOrder(id, userId);
  }
}
