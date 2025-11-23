// src/messages/messages.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LineService } from '../line/line.service';
import type { AuthPayload } from '../auth/auth.service';
import { MessageType } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineService: LineService,
  ) {}

  /**
   * テナントIDを強制的に確定させるヘルパー
   * MANAGER / CLIENT 前提。DEVELOPER は別扱いにする場合はここを分岐させる。
   */
  private ensureTenant(user: AuthPayload): number {
    if (!user.tenantId) {
      throw new Error('テナントが特定できません');
    }
    return user.tenantId;
  }

  /**
   * 顧客IDの配列に対して、任意メッセージを一括送信（顧客の lineUid 宛）
   * MANUAL_CUSTOMER として MessageLog に履歴を残す
   */
  async sendToCustomers(
    user: AuthPayload,
    customerIds: number[],
    message: string,
  ) {
    const tenantId = this.ensureTenant(user);

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

      // 履歴保存
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

    return { sentCount, targetCount: customers.length };
  }

  /**
   * 車両IDの配列に対して、紐づく顧客の lineUid 宛に一括送信
   * MANUAL_CAR として MessageLog に履歴を残す
   */
  async sendToCars(user: AuthPayload, carIds: number[], message: string) {
    const tenantId = this.ensureTenant(user);

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

      // 履歴保存
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

      sentCount++;
    }

    return { sentCount, targetCount };
  }

  /**
   * メッセージ履歴の取得
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
}
