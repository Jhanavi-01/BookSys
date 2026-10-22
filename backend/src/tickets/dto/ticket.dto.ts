import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResendTicketDto {
  @ApiProperty()
  @IsString()
  orderId: string;
}
