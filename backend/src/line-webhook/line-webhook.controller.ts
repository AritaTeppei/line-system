import { Body, Controller, HttpCode, Post } from '@nestjs/common';

@Controller('debug-line')
export class LineWebhookController {
  @Post('webhook-test')
  @HttpCode(200)
  handleWebhook(@Body() body: any) {
    const events = body?.events ?? [];
    const destination = body?.destination;

    console.log('=== DEBUG LINE Webhook Received ===');
    console.log('destination:', destination);
    console.log(JSON.stringify(body, null, 2));

    for (const event of events) {
      const userId = event?.source?.userId;
      const type = event?.type;
      if (userId) {
        console.log(
          `### DEBUG LINE EVENT: type=${type}, userId=${userId}, destination=${destination}`,
        );
      } else {
        console.log(
          `### DEBUG LINE EVENT: type=${type}, userId=(なし), destination=${destination}`,
        );
      }
    }

    return 'DEBUG-OK';
  }
}
