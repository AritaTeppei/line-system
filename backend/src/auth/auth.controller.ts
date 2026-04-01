import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express'; // ★ TS1272 対策で type import
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
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
            name: true,
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
      id: payload.id,
      email: payload.email,
      name: (payload as any).name ?? null,
      tenantId: payload.tenantId ?? null,
      role: payload.role,
      tenantName: tenant?.name ?? null,
      tenantPlan,
      trialRemainingDays,
      trialExpired,
    };
  }


  @Post('request-password-reset')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  async requestPasswordReset(@Body() body: { email: string }) {
    if (!body.email) throw new BadRequestException('メールアドレスは必須です。');
    await this.auth.requestPasswordReset(body.email);
    // 存在しなくても同じレスポンス（enumeration attack防止）
    return { message: 'メールアドレスが登録されている場合、パスワード再設定メールを送信しました。' };
  }

  @Post('verify-reset-token')
  async verifyResetToken(@Body() body: { token: string }) {
    if (!body.token) throw new BadRequestException('トークンは必須です。');
    const result = await this.auth.verifyPasswordResetToken(body.token);
    if (!result.valid) throw new BadRequestException('このリンクは無効または期限切れです。');
    return { valid: true, email: result.email };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    if (!body.token) throw new BadRequestException('トークンは必須です。');
    if (!body.newPassword) throw new BadRequestException('新しいパスワードは必須です。');
    await this.auth.resetPasswordWithToken(body.token, body.newPassword);
    return { message: 'パスワードを再設定しました。新しいパスワードでログインしてください。' };
  }

  /**
   * 管理者2FA STEP1: メール＋パスワード検証 → OTPメール送信
   * POST /auth/admin/request-otp
   */
  @Post('admin/request-otp')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async adminRequestOtp(@Body() body: { email: string; password: string }) {
    if (!body.email || !body.password) {
      throw new BadRequestException('メールアドレスとパスワードは必須です。');
    }
    await this.auth.issueAdminOtp(body.email, body.password);
    return { message: '認証コードをメールで送信しました。' };
  }

  /**
   * 管理者2FA STEP2: OTP検証 → JWT発行
   * POST /auth/admin/verify-otp
   */
  @Post('admin/verify-otp')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async adminVerifyOtp(@Body() body: { email: string; code: string }) {
    if (!body.email || !body.code) {
      throw new BadRequestException('メールアドレスとコードは必須です。');
    }
    const token = await this.auth.verifyAdminOtp(body.email, body.code);
    return { token, role: 'DEVELOPER' };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    // JWT から payload を取り出す（トークンが無くてもエラーにはしない）
    const payload = this.auth.getPayloadFromRequest(req);

    // payload が取れた場合のみ、現在のセッションだけを無効化
    if (payload) {
      await this.auth.logoutSession(payload.id, payload.sessionToken);
    }

    // クッキーは今まで通り全部消す
    res.clearCookie('Authentication');
    res.clearCookie('access_token');

    // フロント用にシンプルなレスポンス
    return res.json({ ok: true });
  }
}
