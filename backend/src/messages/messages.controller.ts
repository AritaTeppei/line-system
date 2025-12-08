// src/messages/messages.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Query, // ★ これを追加
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../jwt.guard';
import type { AuthPayload } from '../auth/auth.service';
import { MessagesService } from './messages.service';
import { BroadcastTarget } from '@prisma/client';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * 顧客に対する一括送信
   * POST /messages/send-to-customers
   * body: { customerIds: number[], message: string }
   */
  @Post('send-to-customers')
  async sendToCustomers(
    @Req() req: Request,
    @Body()
    body: {
      customerIds: number[];
      message: string;
    },
  ) {
    const user = (req as any).authUser as AuthPayload;
    const { customerIds, message } = body;

    const result = await this.messagesService.sendToCustomers(
      user,
      customerIds,
      message,
    );

    return result; // { sentCount, targetCount }
  }

  /**
   * 車両に対する一括送信
   * POST /messages/send-to-cars
   * body: { carIds: number[], message: string }
   */
  @Post('send-to-cars')
  async sendToCars(
    @Req() req: Request,
    @Body()
    body: {
      carIds: number[];
      message: string;
    },
  ) {
    const user = (req as any).authUser as AuthPayload;
    const { carIds, message } = body;

    const result = await this.messagesService.sendToCars(
      user,
      carIds,
      message,
    );

    return result; // { sentCount, targetCount }
  }

  /**
   * 既存：メッセージ履歴取得
   * GET /messages/logs
   */
  @Get('logs')
  async getLogs(@Req() req: Request) {
    const user = (req as any).authUser as AuthPayload;
    return this.messagesService.getLogsForUser(user);
  }

  /**
   * 追加：一括送信のまとめ履歴
   * GET /messages/broadcast-logs?target=CUSTOMER | CAR
   *
   * - target 指定なし    → 全て
   * - target=CUSTOMER    → 顧客管理からの一括送信だけ
   * - target=CAR         → 車両管理からの一括送信だけ
   */
  @Get('broadcast-logs')
  async getBroadcastLogs(
    @Req() req: Request,
    @Query('target') target?: 'CUSTOMER' | 'CAR',
  ) {
    const user = (req as any).authUser as AuthPayload;

    let targetEnum: BroadcastTarget | undefined;
    if (target === 'CUSTOMER') {
      targetEnum = BroadcastTarget.CUSTOMER;
    } else if (target === 'CAR') {
      targetEnum = BroadcastTarget.CAR;
    }

    return this.messagesService.getBroadcastLogsForUser(user, targetEnum);
  }
}
