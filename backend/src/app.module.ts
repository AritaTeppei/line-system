import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { CarsModule } from './cars/cars.module';
import { BookingsModule } from './bookings/bookings.module';
import { RemindersModule } from './reminders/reminders.module';
import { MessagesModule } from './messages/messages.module';
import { PublicModule } from './public/public.module';
import { AdminModule } from './admin/admin.module';
import { LineSettingsModule } from './line-settings/line-settings.module';
import { LineWebhookModule } from './line-webhook/line-webhook.module';
import { TenantsModule } from './tenants/tenants.module'; // ★ 追加
import { PublicBookingsModule } from './public-bookings/public-bookings.module';
import { BillingModule } from './billing/billing.module'; // ★ ここ追加
import { OnboardingModule } from './onboarding/onboarding.module'; // ★追加
import { TrialMonitorService } from './tenants/trial-monitor.service'; // ★ 追加
import { MailModule } from './mail/mail.module';
import { CarScanModule } from './car-scan/car-scan.module';
import { AnnouncementsModule } from './announcements/announcements.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    AuthModule,
    CustomersModule,
    CarsModule,
    BookingsModule,
    RemindersModule,
    MessagesModule,
    PublicModule,
    LineSettingsModule,
    LineWebhookModule,
    TenantsModule,
    BillingModule,
    OnboardingModule,
    AdminModule,
    PublicBookingsModule,
    MailModule,
    CarScanModule,
    AnnouncementsModule,
  ],
  providers: [TrialMonitorService], // ★ 追加
})
export class AppModule {}
