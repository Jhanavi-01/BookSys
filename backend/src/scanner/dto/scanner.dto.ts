import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartScanSessionDto {
  @ApiProperty()
  @IsString()
  showtimeId: string;

  @ApiProperty({ example: 'Gate A' })
  @IsString()
  gate: string;

  @ApiProperty({ example: 'DEVICE-001' })
  @IsString()
  deviceId: string;
}

export class ScanTicketDto {
  @ApiProperty({ description: 'Raw QR code data' })
  @IsString()
  qrData: string;

  @ApiProperty()
  @IsString()
  sessionId: string;
}

export class OverrideScanDto {
  @ApiProperty()
  @IsString()
  ticketCode: string;

  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty({ example: 'Customer showed physical ID' })
  @IsString()
  staffNote: string;
}

export class OfflineScanEntry {
  @ApiProperty()
  @IsString()
  qrData: string;

  @ApiProperty()
  @IsString()
  offlineScanId: string;

  @ApiProperty()
  @IsString()
  scannedAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class SyncOfflineScansDto {
  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty({ type: [OfflineScanEntry] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineScanEntry)
  scans: OfflineScanEntry[];
}
