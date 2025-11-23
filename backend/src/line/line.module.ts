import { Module } from '@nestjs/common';
import { LineController } from './line.controller';
import { LineService } from './line.service';
import { PrismaService } from '../prisma/prisma.service';
import { LineSettingsModule } from '../line-settings/line-settings.module';

@Module({
  imports: [LineSettingsModule],
  controllers: [LineController],
  providers: [LineService, PrismaService],
  exports: [LineService], // ★ MessagesModule から使えるように公開
})
export class LineModule {}
