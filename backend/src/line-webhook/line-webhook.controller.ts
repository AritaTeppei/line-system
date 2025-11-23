import { Body, Controller, HttpCode, Post } from '@nestjs/common';

@Controller('line')
export class LineWebhookController {
  @Post('webhook')
  @HttpCode(200)
  handleWebhook(@Body() body: any) {
    const events = body?.events ?? [];

    console.log('=== LINE Webhook Received ===');
    console.log(JSON.stringify(body, null, 2));

    for (const event of events) {
      const userId = event?.source?.userId;
      if (userId) {
        console.log('### LINE USER ID:', userId);
      }
    }

    // Nest にレスポンスを任せるスタイル
    return 'OK';
  }
}
