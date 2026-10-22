import {
  IsString,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { SaleStatus } from '@prisma/client';

export class CreateShowtimeDto {
  @ApiProperty()
  @IsString()
  eventId: string;

  @ApiProperty()
  @IsString()
  venueId: string;

  @ApiProperty({ example: '2025-06-15T19:00:00.000Z' })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ example: '2025-06-15T22:00:00.000Z' })
  @IsDateString()
  endsAt: string;

  @ApiPropertyOptional({ default: 'Asia/Ho_Chi_Minh' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxTicketsPerUser?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  holdDurationMinutes?: number;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  paymentTimeoutMinutes?: number;
}

export class UpdateShowtimeDto extends PartialType(CreateShowtimeDto) {}

export class UpdateSaleStatusDto {
  @ApiProperty({ enum: SaleStatus })
  @IsEnum(SaleStatus)
  saleStatus: SaleStatus;
}

export class CloneShowtimeDto {
  @ApiProperty({ example: '2025-06-16T19:00:00.000Z' })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ example: '2025-06-16T22:00:00.000Z' })
  @IsDateString()
  endsAt: string;
}
