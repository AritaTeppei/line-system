// src/messages/messages.controller.ts
import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
} from '@nestjs/common';
import type { Request } from 'express';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../jwt.guard';
import type { AuthPayload } from '../auth/auth.service';

// DTO: 顧客向け手動送信用
class SendToCustomersDto {
  customerIds!: number[];
  message!: string;
}

// DTO: 車両向け手動送信用
class SendToCarsDto {
  carIds!: number[];
  message!: string;
}

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * 顧客向け手動一括送信
   */
  @Post('send-to-customers')
  sendToCustomers(@Req() req: Request, @Body() body: SendToCustomersDto) {
    const user = (req as any).authUser as AuthPayload;
    return this.messagesService.sendToCustomers(
      user,
      body.customerIds,
      body.message,
    );
  }

  /**
   * 車両向け手動一括送信
   */
  @Post('send-to-cars')
  sendToCars(@Req() req: Request, @Body() body: SendToCarsDto) {
    const user = (req as any).authUser as AuthPayload;
    return this.messagesService.sendToCars(user, body.carIds, body.message);
  }

  /**
   * メッセージ履歴の取得
   */
  @Get('logs')
  getLogs(@Req() req: Request) {
    const user = (req as any).authUser as AuthPayload;
    return this.messagesService.getLogsForUser(user);
  }
}
