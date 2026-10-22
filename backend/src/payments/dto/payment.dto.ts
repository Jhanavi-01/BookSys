import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty()
  @IsString()
  orderId: string;

  @ApiPropertyOptional({ example: 'http://localhost:5173/payment/return' })
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @ApiPropertyOptional({ example: 'http://localhost:5173/payment/cancel' })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
