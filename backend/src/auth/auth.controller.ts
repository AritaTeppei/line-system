import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express'; // ★ TS1272 対策で type import
import { AuthService, AuthPayload } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';


@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    // ★ 追加
    private readonly prisma: PrismaService,
  ) {}

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

    // ★ ユーザー検証 + テナント有効チェックをまとめて実行
    const { user, payload } = await this.auth.validateUserWithTenantCheck(
      email,
      password,
    );

    // ★ 問題なければトークン発行
    const token = this.auth.issueToken(payload);

    // フロント用に token と最低限の情報を返す
    return {
      token,
      email: user.email,
      tenantId: user.tenantId ?? null,
      role: user.role,
      // 必要なら name も返してOK
      // name: (user as any).name ?? null,
    };
  }

  /**
   * 自分のパスワード変更
   * POST /auth/change-password
   *
   * - MANAGER / DEVELOPER は利用可能
   * - CLIENT は禁止
   */
  @Post('change-password')
  async changePassword(
    @Req() req: Request,
    @Body()
    body: {
      currentPassword: string;
      newPassword: string;
      confirmNewPassword: string;
    },
  ) {
    // まずJWTからログイン中のユーザー情報を取り出す（今の /auth/me と同じやり方）
    const payload = await this.auth.getPayloadFromRequestWithTenantCheck(req);

    // CLIENT は自身でパスワード変更させない仕様
    if (payload.role === 'CLIENT') {
      throw new UnauthorizedException(
        'CLIENT は自身のパスワードを変更できません。管理者にお問い合わせください。',
      );
    }

    await this.auth.changeOwnPassword({
      userId: payload.id,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmNewPassword: body.confirmNewPassword,
    });

    return { ok: true };
  }
  /**
   * MANAGER が CLIENT のパスワードを強制変更する
   * POST /auth/manager/reset-client-password
   */
  @Post('manager/reset-client-password')
  async managerResetClientPassword(
    @Req() req: Request,
    @Body()
    body: {
      clientUserId: number;
      newPassword: string;
      confirmNewPassword: string;
    },
  ) {
    // JWT からログイン中ユーザー情報を取得（/auth/me と同じスタイル）
    const payload = await this.auth.getPayloadFromRequestWithTenantCheck(req);

    // MANAGER 以外は弾く（仕様どおり）
    if (payload.role !== 'MANAGER') {
      throw new UnauthorizedException(
        'MANAGER のみが CLIENT のパスワードを変更できます。',
      );
    }

    await this.auth.managerResetClientPassword(payload, {
      clientUserId: body.clientUserId,
      newPassword: body.newPassword,
      confirmNewPassword: body.confirmNewPassword,
    });

    return { ok: true };
  }

  /**
   * 誰がログインしているか（JWTから復元）
   * GET /auth/me
   */
    @Get('me')
  async me(@Req() req: Request) {
    // まずは今まで通り payload を取得
    const payload = await this.auth.getPayloadFromRequestWithTenantCheck(req);

    // tenant 情報を取得（plan / validUntil / isActive）
    const tenant = payload.tenantId
      ? await this.prisma.tenant.findUnique({
          where: { id: payload.tenantId },
          select: {
            plan: true,
            validUntil: true,
            isActive: true,
          },
        })
      : null;

    let tenantPlan: string | null = tenant?.plan ?? null;
    let trialRemainingDays: number | null = null;
    let trialExpired = false;

    // ★ TRIAL のときだけ残り日数など計算
    if (tenant && tenant.plan === 'TRIAL') {
      tenantPlan = 'TRIAL';

      if (tenant.validUntil) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const until = new Date(tenant.validUntil);
        until.setHours(0, 0, 0, 0);

        const diffMs = until.getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        trialRemainingDays = Math.max(0, diffDays);
        // 0 日以下 or isActive=false → 期限切れ扱い
        trialExpired = diffDays <= 0 || tenant.isActive === false;
      } else {
        // plan=TRIAL なのに validUntil 無し → 安全側で「期限切れ」
        trialRemainingDays = 0;
        trialExpired = true;
      }
    }

    // ★ フロントで使いやすい形で返す
    return {
      // もともとの payload 情報
      id: payload.id,
      email: payload.email,
      name: (payload as any).name ?? null,
      tenantId: payload.tenantId ?? null,
      role: payload.role,

      // 追加情報
      tenantPlan,
      trialRemainingDays,
      trialExpired,
    };
  }


  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    // JWT から payload を取り出す（トークンが無くてもエラーにはしない）
    const payload = this.auth.getPayloadFromRequest(req);

    // payload が取れた場合のみ、そのユーザーのセッションを無効化
    if (payload) {
      await this.auth.logoutAllSessionsForUser(payload.id);
    }

    // クッキーは今まで通り全部消す
    res.clearCookie('Authentication');
    res.clearCookie('access_token');

    // フロント用にシンプルなレスポンス
    return res.json({ ok: true });
  }
}
