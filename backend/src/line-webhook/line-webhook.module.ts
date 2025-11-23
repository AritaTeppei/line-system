import { Module } from '@nestjs/common';
import { LineWebhookController } from './line-webhook.controller';

@Module({
  controllers: [LineWebhookController],
})
export class LineWebhookModule {}
