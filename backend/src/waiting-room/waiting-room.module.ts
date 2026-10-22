import { Module } from '@nestjs/common';
import { WaitingRoomService } from './waiting-room.service';
import { WaitingRoomController } from './waiting-room.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [WaitingRoomService],
  controllers: [WaitingRoomController],
  exports: [WaitingRoomService],
})
export class WaitingRoomModule {}
