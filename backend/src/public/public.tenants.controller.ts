// backend/src/public/public.tenants.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PublicTenantsService } from './public.tenants.service';
import { EmailVerificationService } from './email-verification.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';

@Controller('public')
export class PublicTenantsController {
  constructor(
    private readonly publicTenantsService: PublicTenantsService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  /** メール認証コード送信 */
  @Post('email/send-code')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 120000, limit: 3 } }) // 2分に3回まで
  async sendCode(@Body() body: { email: string }) {
    if (!body.email) {
      return { error: 'メールアドレスは必須です。' };
    }
    await this.emailVerification.sendCode(body.email);
    return { ok: true };
  }

  /** メール認証コード確認 */
  @Post('email/verify-code')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async verifyCode(@Body() body: { email: string; code: string }) {
    if (!body.email || !body.code) {
      return { error: 'メールアドレスと認証コードは必須です。' };
    }
    const result = await this.emailVerification.verifyCode(body.email, body.code);
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
