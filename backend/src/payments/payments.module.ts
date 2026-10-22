import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { SandboxPaymentProvider } from './providers/sandbox-payment.provider';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [AuditModule, NotificationsModule, TicketsModule],
  providers: [
    PaymentsService,
    MockPaymentProvider,
    SandboxPaymentProvider,
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
