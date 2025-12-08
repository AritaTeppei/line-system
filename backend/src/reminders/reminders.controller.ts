// src/reminders/reminders.controller.ts
import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  Body,   // ★ 追加
  Put,
  BadRequestException // ★ ついでに追加（tenantId 無い場合用）
} from '@nestjs/common';
import type { Request } from 'express';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../jwt.guard';
import { AuthService, AuthPayload } from '../auth/auth.service';
import { PreviewMonthResponseDto } from './dto/preview-month.dto';
import { UpsertReminderTemplateDto } from './dto/upsert-reminder-template.dto';

@UseGuards(JwtAuthGuard)
@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly authService: AuthService, // ★ これを追加
) {}

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
   * 指定月のリマインド対象件数を取得する
   * GET /reminders/preview-month?month=YYYY-MM&tenantId=1
   * - month を省略した場合は「今月」を使う
   * - DEVELOPER のときだけ tenantId クエリが必須（中身の ensureTenant ロジックは既存どおり）
   */
  // ✅ 修正版
    @Get('preview-month')
  async previewMonth(
    @Req() req: Request,
    @Query('month') monthStr: string,
    @Query('tenantId') tenantIdFromQuery?: string,
  ): Promise<PreviewMonthResponseDto> {
    // ★ /auth/change-password と同じやり方で JWT → AuthPayload を取り出す
    const user: AuthPayload =
      await this.authService.getPayloadFromRequestWithTenantCheck(req);

    const tenantId = tenantIdFromQuery ? Number(tenantIdFromQuery) : undefined;

    return this.remindersService.previewForMonth(
      user,       // ← ここでもう undefined じゃない
      monthStr,
      tenantId,
    );
  }

  @Post('send-bulk')
  async sendBulkForMonth(
    @Req() req: Request,
    @Body()
    body: {
      month: string;
      itemIds: number[];
    },
    @Query('tenantId') tenantIdFromQuery?: string,
  ) {
    // preview-month と同じく AuthService からユーザー情報を取得している前提
    const user: AuthPayload =
      await this.authService.getPayloadFromRequestWithTenantCheck(req);

    const tenantId = tenantIdFromQuery ? Number(tenantIdFromQuery) : undefined;

    return this.remindersService.sendBulkForMonth(
      user,
      body.month,
      body.itemIds ?? [],
      tenantId,
    );
  }

@Get('templates')
  async getTemplates(@Req() req: Request) {
    // AuthService を使って、今ログイン中のユーザー情報を取る
    const user = this.getUser(req);

    if (!user.tenantId) {
      // 開発者(DEVELOPER) など tenantId が null のユーザーは弾く
      throw new BadRequestException('テナントが選択されていません。');
    }

    return this.remindersService.getTemplatesForTenant(user.tenantId);
  }

  @Put('templates')
  async upsertTemplate(
    @Req() req: Request,
    @Body() dto: UpsertReminderTemplateDto,
  ) {
    const user = this.getUser(req);

    if (!user.tenantId) {
      throw new BadRequestException('テナントが選択されていません。');
    }

    return this.remindersService.upsertTemplateForTenant(user.tenantId, dto);
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
