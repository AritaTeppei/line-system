// src/messages/messages.module.ts
import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LineModule } from '../line/line.module';
import { AuthModule } from '../auth/auth.module'; // ★ これ追加

@Module({
  imports: [
    PrismaModule,
    LineModule,
    AuthModule, // ★ これ追加
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
