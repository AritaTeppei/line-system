import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AnnouncementsController],
  providers: [PrismaService],
})
export class AnnouncementsModule {}
