// src/reminders/reminders.module.ts
import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LineModule } from '../line/line.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule, // 認証ユーザー情報を使う前提
    LineModule, // 将来ここから LINE 送信を呼ぶ前提（今は使わなくてもOK）
  ],
  providers: [RemindersService],
  controllers: [RemindersController],
})
export class RemindersModule {}
