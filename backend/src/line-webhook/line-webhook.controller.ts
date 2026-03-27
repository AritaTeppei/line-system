import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

async function sendLineReply(
  replyToken: string,
  accessToken: string,
  text: string,
): Promise<void> {
  try {
    const res = await fetch(LINE_REPLY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`LINE reply API error: ${res.status} ${body}`);
    }
  } catch (err) {
    console.error('LINE reply fetch error:', err);
  }
}

@Controller('line')
export class LineWebhookController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() body: any) {
    const events: any[] = body?.events ?? [];
    const destination: string | undefined = body?.destination;

    console.log('=== LINE Webhook Received ===');
    console.log('destination:', destination);

    // Look up tenant: first try by destination, then fall back to first configured lineSettings
    let lineSettings = destination
      ? await (this.prisma as any).lineSettings.findFirst({
          where: { destination },
        })
      : null;

    if (!lineSettings) {
      // Fallback: find any lineSettings with an accessToken (single-tenant or first match)
      lineSettings = await (this.prisma as any).lineSettings.findFirst({
        where: { accessToken: { not: null } },
      });
    }

    if (!lineSettings) {
      console.warn(`No lineSettings found for destination: ${destination}`);
      return 'OK';
    }

    // Update destination if it was missing
    if (destination && !lineSettings.destination) {
      await (this.prisma as any).lineSettings.update({
        where: { id: lineSettings.id },
        data: { destination },
      });
    }

    const tenantId: number = lineSettings.tenantId;
    const accessToken: string | null = lineSettings.accessToken;

    for (const event of events) {
      const type: string = event?.type;
      const userId: string | undefined = event?.source?.userId;
      const replyToken: string | undefined = event?.replyToken;

      console.log(`LINE EVENT: type=${type}, userId=${userId}`);

      // Handle follow events: send a welcome message with booking URL
      if (type === 'follow' && userId && replyToken && accessToken) {
        const url = `${FRONTEND_BASE_URL}/public/booking/line?t=${tenantId}&u=${encodeURIComponent(userId)}`;
        const text = `ご登録ありがとうございます！\n\nご予約はこちらのフォームからお気軽にどうぞ。\n${url}\n\nご希望の日時・目的をご入力ください。`;
        await sendLineReply(replyToken, accessToken, text);
        continue;
      }

      // Handle message events
      if (type === 'message' && event?.message?.type === 'text') {
        const text: string = (event.message.text ?? '').trim();
        const isBookingRequest =
          text.includes('予約') || text.toLowerCase().includes('予約したい');

        if (isBookingRequest && userId && replyToken && accessToken) {
          const url = `${FRONTEND_BASE_URL}/public/booking/line?t=${tenantId}&u=${encodeURIComponent(userId)}`;
          const replyText = `ご予約フォームはこちらです 👇\n${url}\n\nご希望の日時・目的をご入力ください。`;
          await sendLineReply(replyToken, accessToken, replyText);
        }
      }
    }

    return 'OK';
  }
}
