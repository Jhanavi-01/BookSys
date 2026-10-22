import { Module } from '@nestjs/common';
import { ShowtimesService } from './showtimes.service';
import { ShowtimesController } from './showtimes.controller';
import { AuditModule } from '../audit/audit.module';
import { SeatsModule } from '../seats/seats.module';

@Module({
  imports: [AuditModule, SeatsModule],
  providers: [ShowtimesService],
  controllers: [ShowtimesController],
  exports: [ShowtimesService],
})
export class ShowtimesModule {}
