import { Module } from '@nestjs/common';
import { ScannerService } from './scanner.service';
import { ScannerController } from './scanner.controller';
import { AuditModule } from '../audit/audit.module';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [AuditModule, TicketsModule],
  providers: [ScannerService],
  controllers: [ScannerController],
  exports: [ScannerService],
})
export class ScannerModule {}
