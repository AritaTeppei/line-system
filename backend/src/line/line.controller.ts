// src/line/line.controller.ts
import { Body, Controller, Post, Logger } from '@nestjs/common';
import { LineService } from './line.service';

type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: {
    type: string;
    userId?: string;
  };
};

type LineWebhookRequestBody = {
  destination?: string;
  events: LineWebhookEvent[];
};

@Controller('line')
export class LineController {
  private readonly logger = new Logger(LineController.name);

  constructor(private readonly lineService: LineService) {}

  @Post('webhook')
  async handleWebhook(@Body() body: LineWebhookRequestBody) {
    try {
      this.logger.log('=== /line/webhook を受信 ===');
      this.logger.log(JSON.stringify(body, null, 2));

      const destination = body?.destination;

      // destination の事前チェック
      if (!destination) {
        this.logger.error(
          '[LineController] destination が無いため処理を中断します。',
        );
        return { ok: false, reason: 'missing_destination' };
      }

      // tenant の特定（string 確定済み）
      const tenantId =
        await this.lineService.resolveTenantIdFromDestination(destination);

      if (!tenantId) {
        this.logger.error(
          `[LineController] tenantId を特定できません: destination=${destination}`,
        );
        return { ok: false, reason: 'tenant_not_found' };
      }

      // 本来の既存処理に戻す（handleEvent → handleWebhookEvent）
      for (const event of body.events) {
        await this.lineService.handleWebhookEvent(tenantId, event);
      }

      return { ok: true };

    } catch (e: any) {
      this.logger.error('handleWebhook 内でエラー', e);

      return {
        ok: false,
        error: e?.message ?? String(e),
        name: e?.name ?? undefined,
        stack: e?.stack ?? undefined,
      };
    }
  }  // ← メソッド閉じ

}  // ← class の閉じ（これが無かった）
