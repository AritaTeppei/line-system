import { Body, Controller, HttpCode, Post } from '@nestjs/common';

@Controller('debug-line')
export class LineWebhookController {
  @Post('webhook-test')
  @HttpCode(200)
  handleWebhook(@Body() body: any) {
    const events = body?.events ?? [];

    console.log('=== DEBUG LINE Webhook Received ===');
    console.log(JSON.stringify(body, null, 2));

    for (const event of events) {
      const userId = event?.source?.userId;
      if (userId) {
        console.log('### DEBUG LINE USER ID:', userId);
      }
    }

    // Nest にレスポンスを任せるスタイル（デバッグ用）
    return 'DEBUG-OK';
  }
}
