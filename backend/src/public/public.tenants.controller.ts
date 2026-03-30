// backend/src/public/public.tenants.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PublicTenantsService } from './public.tenants.service';
import { PhoneVerificationService } from './phone-verification.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';

@Controller('public')
export class PublicTenantsController {
  constructor(
    private readonly publicTenantsService: PublicTenantsService,
    private readonly phoneVerification: PhoneVerificationService,
  ) {}

  /** SMS認証コード送信 */
  @Post('phone/send-code')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 300000, limit: 3 } }) // 5分に3回まで
  async sendCode(@Body() body: { phone: string }) {
    if (!body.phone) {
      return { error: '電話番号は必須です。' };
    }
    await this.phoneVerification.sendCode(body.phone);
    return { ok: true };
  }

  /** SMS認証コード確認 */
  @Post('phone/verify-code')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async verifyCode(@Body() body: { phone: string; code: string }) {
    if (!body.phone || !body.code) {
      return { error: '電話番号と認証コードは必須です。' };
    }
    const result = await this.phoneVerification.verifyCode(body.phone, body.code);
    return { ok: true, token: result.token };
  }

  /** 新規テナント＋管理者ユーザーの登録 */
  @Post('tenants/register')
  async register(@Body() dto: RegisterTenantDto) {
    const result = await this.publicTenantsService.registerTenant(dto);
    return {
      message: 'テナント登録が完了しました。',
      ...result,
    };
  }
}
