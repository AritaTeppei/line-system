import { Module } from '@nestjs/common';
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
import { TenantsModule } from './tenants/tenants.module';  // ★ 追加

@Module({
  imports: [
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

    // ★ これが無いから /admin/tenants が 404 になってた
    AdminModule,
  ],
})
export class AppModule {}
