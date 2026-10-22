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
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ChangeRoleDto, DeactivateUserDto } from './dto/create-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a staff account (admin only)' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    return this.usersService.createStaffAccount(dto, userId, req.ip);
  }

  @Roles(Role.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: Role,
    @Query('isActive') isActive?: boolean,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll({ page, limit, role, isActive, search });
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Roles()
  @Put('profile')
  @ApiOperation({ summary: 'Update own profile' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/role')
  @ApiOperation({ summary: 'Change user role (admin only, immediate effect)' })
  async changeRole(
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    return this.usersService.changeRole(id, dto, userId, req.ip);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a user (admin only)' })
  async deactivate(
    @Param('id') id: string,
    @Body() dto: DeactivateUserDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    return this.usersService.deactivate(id, userId, dto.reason, req.ip);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a user (admin only)' })
  async reactivate(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    return this.usersService.reactivate(id, userId, req.ip);
  }

  @Roles()
  @Delete(':id/gdpr')
  @ApiOperation({ summary: 'GDPR data deletion (anonymize PII, keep financial records). Allowed for the user themselves or ADMIN.' })
  async gdprDelete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Req() req: Request,
  ) {
    // Only the user themselves or an ADMIN can request GDPR deletion
    if (id !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException('You can only delete your own data');
    }
    return this.usersService.gdprDeleteUser(id, userId, req.ip);
  }
}
