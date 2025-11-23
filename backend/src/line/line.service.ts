import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { LineSettingsService } from '../line-settings/line-settings.service';

@Injectable()
export class LineService {
  private readonly logger = new Logger(LineService.name);
  private readonly frontendBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lineSettingsService: LineSettingsService,
  ) {
    this.frontendBaseUrl =
      process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000';
  }

  /**
   * 友だち登録/メッセージ受信時に、登録フォームURLを送信する
   * - tenantIdごとに customerRegisterToken を発行
   * - フロントの /public/register-customer?token=... へ誘導
   * - 実際の送信は LineSettingsService（テナントごとのアクセストークン）に委譲
   */
  async sendRegisterFormLink(
    tenantId: number,
    lineUid: string,
  ): Promise<void> {
    if (!lineUid) {
      this.logger.warn(
        `sendRegisterFormLink called without lineUid (tenantId=${tenantId})`,
      );
      return;
    }

    // 1. 登録用トークンを発行してDBに保存
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7日後

    await this.prisma.customerRegisterToken.create({
      data: {
        tenantId,
        lineUid,
        token,
        expiresAt,
      },
    });

    // 2. フロント側の登録フォームURLを生成
    const url = `${this.frontendBaseUrl}/public/register-customer?token=${token}`;
    const text =
      '車検通知システムの登録フォームです。以下のURLからお客様情報の入力をお願いします。\n' +
      url;

    // 3. テナントごとの LINE設定（アクセストークン）を使って push 送信
    try {
      await this.lineSettingsService.sendTestMessage(tenantId, {
        to: lineUid,
        message: text,
      });

      this.logger.log(
        `Sent register form link to user ${lineUid} for tenant ${tenantId}`,
      );
    } catch (e: any) {
      this.logger.error(
        `Failed to send register form link to user ${lineUid} for tenant ${tenantId}: ${
          e?.message ?? e
        }`,
      );
      // Webhook側から呼ばれるので、throwせず「ログだけ」にしておく
    }
  }

  /**
   * 任意のテキストメッセージを送信する汎用メソッド
   * 既存の messages.service.ts から利用される想定
   * - lineUid から Customer を引いて tenantId を動的に取得
   * - tenantId ごとの LineSettings を使って送信
   */
  async sendText(lineUid: string, message: string): Promise<void> {
    if (!lineUid) {
      this.logger.warn('sendText called without lineUid');
      return;
    }

    // schema 側で lineUid 単体はユニークではなく、
    // tenantId + lineUid の複合ユニークになっているため findFirst を使う
    const customer = await this.prisma.customer.findFirst({
      where: { lineUid },
      select: { tenantId: true },
    });

    if (!customer || !customer.tenantId) {
      this.logger.error(`No customer found for lineUid=${lineUid}`);
      return;
    }

    const tenantId = customer.tenantId;

    try {
      await this.lineSettingsService.sendTestMessage(tenantId, {
        to: lineUid,
        message,
      });

      this.logger.log(
        `Sent text message to user ${lineUid} for tenant ${tenantId}`,
      );
    } catch (e: any) {
      this.logger.error(
        `Failed to send text message to user ${lineUid} for tenant ${tenantId}: ${
          e?.message ?? e
        }`,
      );
    }
  }
    /**
   * LINE Webhook の destination から tenantId を特定する
   * - destination: LINE 側のボットユーザーID（チャネルごとに固有）
   * - LineSettings 側に channelId として保存されている想定
   */
  async resolveTenantIdFromDestination(
    destination?: string | null,
  ): Promise<number | null> {
    if (!destination) {
      this.logger.warn(
        'resolveTenantIdFromDestination: destination が空です',
      );
      return null;
    }

    const settings = await this.prisma.lineSettings.findFirst({
      where: {
        channelId: destination,
      },
      select: {
        tenantId: true,
      },
    });

    if (!settings?.tenantId) {
      this.logger.error(
        `resolveTenantIdFromDestination: destination=${destination} に対応する LineSettings が見つかりません`,
      );
      return null;
    }

    return settings.tenantId;
  }
}
