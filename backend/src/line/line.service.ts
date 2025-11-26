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

    // ★ ここを追加：本番で何を見ているかをログに出す
    this.logger.log(
      `[LineService] frontendBaseUrl = ${this.frontendBaseUrl}`,
    );
  }


  /**
   * URLセーフなランダムトークンを生成する
   */
  generateSecureToken(length: number = 32): string {
    const randomString = crypto.randomBytes(length).toString('base64url');
    return randomString.replace(/[^a-zA-Z0-9]/g, '').slice(0, length);
  }

  /**
   * パブリックな登録用 URL を生成
   */
  private generatePublicRegisterUrl(token: string): string {
  // constructor で決めた frontendBaseUrl を使う
  const normalizedBaseUrl = this.frontendBaseUrl.replace(/\/$/, '');

  return `${normalizedBaseUrl}/public/customer-register/${token}`;
}


  /**
   * 顧客を LINE UID で検索する
   */
  async findCustomerByLineUid(tenantId: number, lineUid: string) {
    return this.prisma.customer.findFirst({
      where: {
        tenantId,
        lineUid,
      },
    });
  }

  /**
   * 顧客に LINE UID を紐づける
   */
  async linkCustomerWithLineUid(
    tenantId: number,
    lineUid: string,
    customerId: number,
  ) {
    return this.prisma.customer.updateMany({
      where: {
        tenantId,
        id: customerId,
      },
      data: {
        lineUid,
      },
    });
  }

  /**
   * 顧客の LINE UID 紐付けを解除する
   */
  async unlinkCustomerLineUid(tenantId: number, customerId: number) {
    return this.prisma.customer.updateMany({
      where: {
        tenantId,
        id: customerId,
      },
      data: {
        lineUid: null,
      },
    });
  }

  /**
   * LINE UID が未紐付けの顧客一覧
   */
  async findUnlinkedCustomers(tenantId: number) {
    return this.prisma.customer.findMany({
      where: {
        tenantId,
        lineUid: null,
      },
      orderBy: {
        id: 'desc',
      },
    });
  }

  /**
   * 友だち登録時などに登録フォームURLを送る
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

    const token = this.generateSecureToken(40);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7日後まで有効

    await this.prisma.customerRegisterToken.create({
      data: {
        tenantId,
        lineUid,
        token,
        expiresAt,
      },
    });

    const url = this.generatePublicRegisterUrl(token);
    const message = `お客様情報の登録はこちらからお願いします。\n${url}`;

    try {
      await this.lineSettingsService.sendTestMessage(tenantId, {
        to: lineUid,
        message,
      });
      this.logger.log(
        `Sent register form link to lineUid=${lineUid} for tenant=${tenantId}`,
      );
    } catch (e: any) {
      this.logger.error(
        `Failed to send register form link to lineUid=${lineUid} for tenant=${tenantId}: ${
          e?.message ?? e
        }`,
      );
    }
  }

  /**
   * 顧客IDの配列から LINE UID を取得する
   */
  private async getLineUidsForCustomers(
    tenantId: number,
    customerIds: number[],
  ): Promise<{ customerId: number; lineUid: string }[]> {
    if (!customerIds.length) return [];

    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        id: { in: customerIds },
        lineUid: { not: null },
      },
      select: {
        id: true,
        lineUid: true,
      },
    });

    return customers
      .filter((c) => !!c.lineUid)
      .map((c) => ({ customerId: c.id, lineUid: c.lineUid! }));
  }

  /**
   * 車両IDの配列から LINE UID を取得する
   * - car.customerId 経由で顧客を引き、その顧客の lineUid を使う
   */
  private async getLineUidsForCars(
    tenantId: number,
    carIds: number[],
  ): Promise<{ carId: number; lineUid: string }[]> {
    if (!carIds.length) return [];

    const cars = await this.prisma.car.findMany({
      where: {
        tenantId,
        id: { in: carIds },
      },
      select: {
        id: true,
        customerId: true,
      },
    });

    const customerIds = Array.from(
      new Set(cars.map((c) => c.customerId).filter((id) => id != null)),
    ) as number[];

    if (!customerIds.length) return [];

    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        id: { in: customerIds },
        lineUid: { not: null },
      },
      select: {
        id: true,
        lineUid: true,
      },
    });

    const customerMap = new Map<number, string>();
    for (const c of customers) {
      if (c.lineUid) customerMap.set(c.id, c.lineUid);
    }

    const result: { carId: number; lineUid: string }[] = [];
    for (const car of cars) {
      const uid = customerMap.get(car.customerId);
      if (uid) {
        result.push({ carId: car.id, lineUid: uid });
      }
    }

    return result;
  }

  /**
   * 管理画面からの「顧客向け一括送信」
   */
  async sendMessageToCustomers(
    tenantId: number,
    customerIds: number[],
    message: string,
  ): Promise<void> {
    const targets = await this.getLineUidsForCustomers(tenantId, customerIds);

    if (!targets.length) {
      this.logger.warn(
        `[LineService] No LINE UIDs found for customers in tenant ${tenantId}`,
      );
      return;
    }

    for (const target of targets) {
      try {
        await this.lineSettingsService.sendTestMessage(tenantId, {
          to: target.lineUid,
          message,
        });
        this.logger.log(
          `[LineService] Sent text message to user ${target.lineUid} for tenant ${tenantId}`,
        );
      } catch (error: any) {
        this.logger.error(
          `[LineService] Failed to send text message to user ${target.lineUid} for tenant ${tenantId}: ${
            error?.message ?? error
          }`,
        );
      }
    }
  }

  /**
   * 単発テキスト送信用（既存の messages.service.ts から利用されている）
   * - 引数は lineUid とメッセージだけ
   * - lineUid から tenantId を特定して、LineSettingsService 経由で送信する
   */
  async sendText(lineUid: string, message: string): Promise<void> {
    if (!lineUid) {
      this.logger.warn('sendText called without lineUid');
      return;
    }

    // 1) lineUid から顧客を特定（＝テナントを特定）
    const customer = await this.prisma.customer.findFirst({
      where: { lineUid },
      select: { id: true, tenantId: true },
    });

    if (!customer) {
      this.logger.warn(
        `sendText: customer not found for lineUid=${lineUid}`,
      );
      return;
    }

    const tenantId = customer.tenantId;

    // 2) いつものルートで送信（/customers などと同じ）
    try {
      await this.lineSettingsService.sendTestMessage(tenantId, {
        to: lineUid,
        message,
      });

      this.logger.log(
        `[LineService] Sent text message to user ${lineUid} for tenant ${tenantId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `[LineService] Failed to send text message to user ${lineUid} for tenant ${tenantId}: ${
          error?.message ?? error
        }`,
      );
    }
  }

  /**
   * 管理画面からの「車両向け一括送信」
   */
  async sendMessageToCars(
    tenantId: number,
    carIds: number[],
    message: string,
  ): Promise<void> {
    const targets = await this.getLineUidsForCars(tenantId, carIds);

    if (!targets.length) {
      this.logger.warn(
        `[LineService] No LINE UIDs found for cars in tenant ${tenantId}`,
      );
      return;
    }

    for (const target of targets) {
      try {
        await this.lineSettingsService.sendTestMessage(tenantId, {
          to: target.lineUid,
          message,
        });
        this.logger.log(
          `[LineService] Sent text message to user ${target.lineUid} for tenant ${tenantId}`,
        );
      } catch (error: any) {
        this.logger.error(
          `[LineService] Failed to send text message to user ${target.lineUid} for tenant ${tenantId}: ${
            error?.message ?? error
          }`,
        );
      }
    }
  }

  /**
   * リマインダー（/reminders）用の一括送信
   * - RemindersService.previewForDate の結果(preview)をもとに送信
   */
  async sendRemindersForTenant(
    tenantId: number,
    preview: {
      birthdayTargets: any[];
      shakenTwoMonths: any[];
      shakenOneWeek: any[];
      inspectionOneMonth: any[];
      custom: any[];
    },
  ): Promise<void> {
    const allTargets = [
      ...preview.birthdayTargets,
      ...preview.shakenTwoMonths,
      ...preview.shakenOneWeek,
      ...preview.inspectionOneMonth,
      ...preview.custom,
    ];

    if (!allTargets.length) {
      this.logger.log(
        `sendRemindersForTenant: no targets for tenantId=${tenantId}`,
      );
      return;
    }

    for (const target of allTargets) {
      const lineUid: string | null =
        target.lineUid ?? target.lineUserId ?? target.uid ?? null;
      const message: string | undefined = target.messageText;

      if (!lineUid || !message) {
        continue;
      }

      try {
        await this.lineSettingsService.sendTestMessage(tenantId, {
          to: lineUid,
          message,
        });
        this.logger.log(
          `[LineService] Sent reminder message to user ${lineUid} for tenant ${tenantId}`,
        );
      } catch (error: any) {
        this.logger.error(
          `[LineService] Failed to send reminder to user ${lineUid} for tenant ${tenantId}: ${
            error?.message ?? error
          }`,
        );
      }
    }
  }

  /**
   * 登録用トークンを検証し、まだ有効ならレコードを返す
   */
  async verifyCustomerRegisterToken(token: string) {
    const now = new Date();

    const record = await this.prisma.customerRegisterToken.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
    });

    return record;
  }

  /**
   * 登録用トークンを使用済みにする
   */
  async markRegisterTokenAsUsed(id: number) {
    return this.prisma.customerRegisterToken.update({
      where: { id },
      data: {
        usedAt: new Date(),
      },
    });
  }


    /**
   * LINE Webhook の各イベントを処理する
   * ひとまずはログを出すだけの安全な実装にしておく
   */
    /**
   * LINE Webhook の各イベントを処理する
   * - ここで follow / message / unfollow などを振り分ける
   */
  async handleWebhookEvent(tenantId: number, event: any): Promise<void> {
    const userId = event?.source?.userId;
    const type = event?.type;

    this.logger.log(
      `[LineService] handleWebhookEvent: tenantId=${tenantId}, type=${type}, userId=${userId}`,
    );

    // userId が無いイベント（グループ系など）は今回は無視
    if (!userId) {
      this.logger.warn(
        `[LineService] handleWebhookEvent: userId が無いためスキップ (tenantId=${tenantId}, type=${type})`,
      );
      return;
    }

    // 1) 友だち登録（follow）のときに「顧客登録URL」を送る
    if (type === 'follow') {
      // まず、この UID がすでに既存顧客に紐づいているか確認
      const existingCustomer = await this.findCustomerByLineUid(
        tenantId,
        userId,
      );

      if (existingCustomer) {
        this.logger.log(
          `[LineService] handleWebhookEvent: lineUid=${userId} は既存顧客(id=${existingCustomer.id})に紐づいているため、登録URLは送信しません`,
        );
        return;
      }

      // まだ誰にも紐づいていない UID なら、登録用URLを送る
      await this.sendRegisterFormLink(tenantId, userId);
      return;
    }

    // 2) それ以外のイベントはとりあえずログだけ
    //    必要になったらここに message / postback などの処理を追加していく
    this.logger.log(
      `[LineService] handleWebhookEvent: type=${type} は今のところ特別な処理をしていません`,
    );
  }

  /**
   * LINE Webhook の destination から tenantId を特定する
   * - destination: LINE 側のボットユーザーID（チャネルごとに固有）
   * - LineSettings 側に channelId として保存されている想定
   */
  async resolveTenantIdFromDestination(destination: string): Promise<number | null> {
  this.logger.log(
    `resolveTenantIdFromDestination: destination=${destination}`,
  );

  const settings = await this.prisma.lineSettings.findFirst({
    where: {
      destination,
      isActive: true,    // ← これだけで十分
      // tenant: { isActive: true } ← 削除（これが原因）
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
