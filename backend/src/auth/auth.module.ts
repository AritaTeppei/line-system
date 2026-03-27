// backend/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService], // ★ 他のモジュールから AuthService を使えるようにする
})
export class AuthModule {}
