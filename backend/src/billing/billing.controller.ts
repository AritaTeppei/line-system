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
    const { tenantId, plan, fromLogin } = dto; // ★ fromLogin を受け取る

    const session = await this.billingService.createCheckoutSession(
      Number(tenantId),
      plan,
      fromLogin ?? false, // ★ 第3引数で渡す（未指定なら false）
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
