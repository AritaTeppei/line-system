// backend/src/car-scan/car-scan.controller.ts
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

type ScanSession = {
  rawData?: string;
  createdAt: Date;
};

// インメモリセッションストア（10分TTL）
const sessions = new Map<string, ScanSession>();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt.getTime() > 10 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 60 * 1000);

@Controller('public/car-scan')
export class CarScanController {
  /** PC側: セッション作成 */
  @Post('session')
  createSession() {
    const sessionId = uuidv4();
    sessions.set(sessionId, { createdAt: new Date() });
    return { sessionId };
  }

  /** スマホ側: QRデータを送信 */
  @Post(':sessionId/result')
  submitResult(
    @Param('sessionId') sessionId: string,
    @Body() body: { rawData: string },
  ) {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('セッションが見つかりません（有効期限切れかもしれません）');
    }
    sessions.set(sessionId, { ...session, rawData: body.rawData });
    return { ok: true };
  }

  /** PC側: 結果をポーリング */
  @Get(':sessionId')
  getResult(@Param('sessionId') sessionId: string) {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('セッションが見つかりません（有効期限切れかもしれません）');
    }
    return {
      ready: !!session.rawData,
      rawData: session.rawData ?? null,
    };
  }
}
