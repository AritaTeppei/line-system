// src/messages/messages.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LineService } from '../line/line.service';
import type { AuthPayload } from '../auth/auth.service';
import { MessageType, BroadcastTarget } from '@prisma/client';

/** プランごとの月間LINE送信上限（null = 無制限） */
const MONTHLY_LINE_LIMIT: Record<string, number | null> = {
  TRIAL:    50,
  BASIC:    200,
  STANDARD: 1000,
  PRO:      null,
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineService: LineService,
  ) {}

  /**
   * 今月の送信済み件数を確認し、上限を超えていれば例外を投げる
   */
  async checkMonthlyLineLimit(tenantId: number): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    const plan = tenant?.plan ?? 'TRIAL';
    const limit = MONTHLY_LINE_LIMIT[plan] ?? null;
    if (limit === null) return; // PRO は無制限

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const count = await this.prisma.messageLog.count({
      where: { tenantId, createdAt: { gte: startOfMonth } },
    });

    if (count >= limit) {
      throw new BadRequestException(
        `今月のLINE送信数が上限（${limit}通）に達しました。` +
        `プランをアップグレードすると送信数が増えます。（現在: ${count}通送信済み）`,
      );
    }
  }

  /**
   * 一括送信の「まとめログ」を作る共通ヘルパー
   * - BroadcastLog 本体
   * - 中間テーブル BroadcastLogCustomer（対象顧客ID一覧）
   */
  private async createBroadcastLog(params: {
    tenantId: number;
    message: string;
    sentCount: number;
    targetCount: number;
    customerIds: number[];
    target: BroadcastTarget;
    sentByUserId?: number;
  }) {
    const { tenantId, message, sentCount, targetCount, customerIds, target, sentByUserId } =
      params;

    return this.prisma.broadcastLog.create({
      data: {
        tenantId,
        message,
        sentCount,
        targetCount,
        target,
        sentByUserId: sentByUserId ?? null,
        customers:
          customerIds.length > 0
            ? {
                createMany: {
                  data: customerIds.map((customerId) => ({ customerId })),
                },
              }
            : undefined,
      },
    });
  }

  /**
   * テナントIDを強制的に確定させるヘルパー
   */
  private ensureTenant(user: AuthPayload): number {
    if (!user.tenantId) {
      throw new Error('テナントが特定できません');
    }
    return user.tenantId;
  }

  /**
   * 顧客IDの配列に対して、任意メッセージを一括送信（顧客の lineUid 宛）
   * - MessageLog に MANUAL_CUSTOMER として 1件ずつ履歴を残す
   * - BroadcastLog / BroadcastLogCustomer に「まとめ履歴」も1行残す
   */
  async sendToCustomers(
    user: AuthPayload,
    customerIds: number[],
    message: string,
  ) {
    const tenantId = this.ensureTenant(user);
    await this.checkMonthlyLineLimit(tenantId);

    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        id: { in: customerIds },
        lineUid: { not: null },
      },
    });

    let sentCount = 0;

    for (const c of customers) {
      const lineUid = c.lineUid!;
      // LINE 送信
      await this.lineService.sendText(lineUid, message);

      // 履歴保存（MessageLog は content カラム）
      await this.prisma.messageLog.create({
        data: {
          tenantId,
          customerId: c.id,
          carId: null,
          lineUid,
          messageType: MessageType.MANUAL_CUSTOMER,
          content: message,
        },
      });

      sentCount++;
    }

    const targetCount = customers.length;

    // まとめ用 BroadcastLog も作成（3ヶ月参照用）
    if (targetCount > 0) {
      await this.createBroadcastLog({
        tenantId,
        message,
        sentCount,
        targetCount,
        customerIds: customers.map((c) => c.id),
        target: BroadcastTarget.CUSTOMER,
        sentByUserId: user.id,
      });
    }

    return { sentCount, targetCount };
  }

  /**
   * 車両IDの配列に対して、紐づく顧客の lineUid 宛に一括送信
   * - MessageLog に MANUAL_CAR として 1件ずつ履歴を残す
   * - BroadcastLog / BroadcastLogCustomer にもまとめて1行残す
   */
  async sendToCars(user: AuthPayload, carIds: number[], message: string) {
    const tenantId = this.ensureTenant(user);
    await this.checkMonthlyLineLimit(tenantId);

    const cars = await this.prisma.car.findMany({
      where: {
        tenantId,
        id: { in: carIds },
      },
      include: {
        customer: true,
      },
    });

    let sentCount = 0;
    let targetCount = 0;
    const customerIdsForBroadcast: number[] = [];

    for (const car of cars) {
      const customer = car.customer;
      if (!customer || !customer.lineUid) {
        // LINE 未連携の車両はスキップ
        continue;
      }
      targetCount++;

      const lineUid = customer.lineUid;

      // LINE 送信
      await this.lineService.sendText(lineUid, message);

      // 履歴保存（MessageLog は content カラム）
      await this.prisma.messageLog.create({
        data: {
          tenantId,
          customerId: customer.id,
          carId: car.id,
          lineUid,
          messageType: MessageType.MANUAL_CAR,
          content: message,
        },
      });

      if (!customerIdsForBroadcast.includes(customer.id)) {
        customerIdsForBroadcast.push(customer.id);
      }
      sentCount++;
    }

    // 送信があったときだけまとめログを作成
    if (targetCount > 0) {
      await this.createBroadcastLog({
        tenantId,
        message,
        sentCount,
        targetCount,
        customerIds: customerIdsForBroadcast,
        target: BroadcastTarget.CAR,
        sentByUserId: user.id,
      });
    }

    return { sentCount, targetCount };
  }

  /**
   * （既存）メッセージ履歴の取得
   * - DEVELOPER: 全テナント分（直近200件）
   * - それ以外: 自テナント分（直近200件）
   */
  async getLogsForUser(user: AuthPayload) {
    // 開発者は全テナントの履歴を見られる
    if (user.role === 'DEVELOPER') {
      return this.prisma.messageLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          tenant: true,
          customer: true,
          car: true,
        },
      });
    }

    // 管理者・クライアントは自テナントのみ
    const tenantId = this.ensureTenant(user);

    return this.prisma.messageLog.findMany({
      where: {
        tenantId,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        tenant: true,
        customer: true,
        car: true,
      },
    });
  }

  /**
   * 一括メッセージの「まとめ履歴」（3ヶ月分）取得
   * - 顧客管理画面：target = CUSTOMER
   * - 車両管理画面：target = CAR
   */
  async getBroadcastLogsForUser(user: AuthPayload, target?: BroadcastTarget) {
    const tenantId = this.ensureTenant(user);

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

    const logs = await this.prisma.broadcastLog.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: threeMonthsAgo,
        },
        ...(target ? { target } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        customers: true,
        sentByUser: { select: { id: true, name: true, email: true } },
      },
    });

    // フロントの BroadcastLog 型にそのまま合わせる
    return logs.map((log) => ({
      id: log.id,
      message: log.message,
      sentCount: log.sentCount,
      targetCount: log.targetCount,
      createdAt: log.createdAt.toISOString(),
      customerIds: log.customers.map((c) => c.customerId),
      sentByName: log.sentByUser
        ? (log.sentByUser.name ?? log.sentByUser.email)
        : null,
    }));
  }
}
