import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AnnouncementsController],
  providers: [PrismaService],
})
export class AnnouncementsModule {}
