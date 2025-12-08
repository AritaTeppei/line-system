// backend/src/billing/billing.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { GetBillingStatusDto } from './dto/get-billing-status.dto'; // ★ 追加

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('create-checkout-session')
  async createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    const { tenantId, plan } = dto;

    const session = await this.billingService.createCheckoutSession(
      Number(tenantId),
      plan,
    );

    return session; // { url: "..." }
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
