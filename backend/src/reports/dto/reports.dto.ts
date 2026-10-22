import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReconciliationUploadDto {
  @ApiProperty({ description: 'Array of gateway transactions' })
  transactions: Array<{
    transactionId: string;
    amount: number;
    status: string;
    date: string;
  }>;
}
