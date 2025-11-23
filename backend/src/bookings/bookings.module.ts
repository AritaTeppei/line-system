// backend/src/bookings/bookings.module.ts
import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module'; // ★ 追加

@Module({
  imports: [
    PrismaModule,
    AuthModule, // ★ AuthService を提供しているモジュールをここで読み込む
  ],
  providers: [BookingsService],
  controllers: [BookingsController],
})
export class BookingsModule {}
