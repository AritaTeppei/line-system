import { Module } from '@nestjs/common';
import { LineWebhookController } from './line-webhook.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LineWebhookController],
})
export class LineWebhookModule {}
