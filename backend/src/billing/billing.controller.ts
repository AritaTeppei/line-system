// backend/src/billing/billing.controller.ts
import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { GetBillingStatusDto } from './dto/get-billing-status.dto';
import { JwtAuthGuard } from '../jwt.guard';
import type { AuthPayload } from '../auth/auth.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('create-checkout-session')
  async createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    const { tenantId, plan, fromLogin } = dto;

    const session = await this.billingService.createCheckoutSession(
      Number(tenantId),
      plan,
      fromLogin ?? false, // 未指定なら false
    );

    return session; // { url: "..." }
  }

  /**
   * Stripe カスタマーポータル用 URL を発行する
   * （解約・カード変更などの管理画面）
   */
  @Post('create-portal-session')
  @UseGuards(JwtAuthGuard)
  async createPortalSession(@Req() req: Request) {
    const user = (req as any).authUser as AuthPayload | undefined;

    if (!user || !user.tenantId) {
      throw new BadRequestException('テナント情報が取得できません。');
    }

    // BillingService 側のロジックをそのまま使う
    const result = await this.billingService.createPortalSession(user.tenantId);
    // result は { url: string } 形式
    return result;
  }

  @Post('webhook')
  async handleWebhook(@Body() event: any) {
    await this.billingService.handleStripeWebhook(event);
    return { received: true };
  }

  /**
   * テナントの現在の課金状態を返す（UI用読み取りAPI）
   */
  @Post('status')
  async getStatus(@Body() dto: GetBillingStatusDto) {
    const tenantId = Number(dto.tenantId);
    const status = await this.billingService.getBillingStatus(tenantId);
    return { tenant: status };
  }
}
