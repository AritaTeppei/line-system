import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express'; // ★ TS1272 対策で type import
import { AuthService, AuthPayload } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * ログインAPI
   * POST /auth/login
   * body: { email, password }
   * 戻り値: { token, email, tenantId, role }
   */
  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const { email, password } = body;

    if (!email || !password) {
      throw new UnauthorizedException('メールアドレスとパスワードが必要です');
    }

    // 既存の AuthService を利用（validateUser はプロジェクト側の実装）
    const user = await this.auth.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('認証に失敗しました');
    }

    // ★ AuthPayload の形に揃える
    const payload: AuthPayload = {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId ?? null,
      role: user.role,
    } as AuthPayload;

    // ★ issueToken は 1引数
    const token = this.auth.issueToken(payload);

    // フロント用に token と最低限の情報を返す
    return {
      token,
      email: user.email,
      tenantId: user.tenantId ?? null,
      role: user.role,
    };
  }

  /**
   * 誰がログインしているか（JWTから復元）
   * GET /auth/me
   */
  @Get('me')
  async me(@Req() req: Request) {
    const payload = await this.auth.getPayloadFromRequestWithTenantCheck(req);

    // 返す形（AuthPayload）は今まで通り
    return payload;
  }
}
