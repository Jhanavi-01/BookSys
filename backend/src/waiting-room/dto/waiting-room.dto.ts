import { IsString, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JoinWaitingRoomDto {
  @ApiProperty()
  @IsString()
  showtimeId: string;
}

export class ConfigureWaitingRoomDto {
  @ApiProperty()
  @IsString()
  showtimeId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxConcurrent?: number;
}
