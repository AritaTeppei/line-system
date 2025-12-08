// backend/src/public/public.tenants.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { PublicTenantsService } from './public.tenants.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';

@Controller('public/tenants')
export class PublicTenantsController {
  constructor(private readonly publicTenantsService: PublicTenantsService) {}

  /**
   * 新規テナント＋管理者ユーザーの登録
   * 未ログインで叩ける公開用エンドポイント
   */
  @Post('register')
  async register(@Body() dto: RegisterTenantDto) {
    const result = await this.publicTenantsService.registerTenant(dto);
    return {
      message: 'テナント登録が完了しました。',
      ...result,
    };
  }
}
