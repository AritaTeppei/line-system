// src/reminders/reminders.controller.ts
import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../jwt.guard';
import type { AuthPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  private getUser(req: Request): AuthPayload {
    return (req as any).authUser as AuthPayload;
  }

  /**
   * GET /reminders/preview
   * ?date=YYYY-MM-DD or ISO文字列
   * ?tenantId=1 （DEVELOPER が他テナントを指定する場合）
   */
  @Get('preview')
  async preview(
    @Req() req: Request,
    @Query('date') date?: string,
    @Query('tenantId') tenantIdParam?: string,
  ) {
    const user = this.getUser(req);

    // service 側は string 想定なので、ここでは string に固定する
    // date が来てなければ「今」の ISO 文字列を渡す
    const baseDate: string = date ?? new Date().toISOString();

    const tenantId = tenantIdParam ? Number(tenantIdParam) : undefined;

    return this.remindersService.previewForDate(user, baseDate, tenantId);
  }

  /**
   * POST /reminders/run
   * body は不要。任意で ?date / ?tenantId を付けてもよい設計にする。
   */
  @Post('run')
  async run(
    @Req() req: Request,
    @Query('date') date?: string,
    @Query('tenantId') tenantIdParam?: string,
  ) {
    const user = this.getUser(req);

    const baseDate: string = date ?? new Date().toISOString();
    const tenantId = tenantIdParam ? Number(tenantIdParam) : undefined;

    return this.remindersService.sendForDate(user, baseDate, tenantId);
  }
}
