import { Module } from '@nestjs/common';
import { LineSettingsService } from './line-settings.service';
import { LineSettingsController } from './line-settings.controller';
import { PrismaService } from '../prisma/prisma.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [LineSettingsController],
  providers: [LineSettingsService, PrismaService],
  exports: [LineSettingsService],
})
export class LineSettingsModule {}
