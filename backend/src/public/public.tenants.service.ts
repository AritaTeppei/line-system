// backend/src/public/public.tenants.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class PublicTenantsService {
  private readonly logger = new Logger(PublicTenantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerTenant(dto: RegisterTenantDto) {
    const {
  companyName,
  adminName,
  email,
  password,
  phone,
  tenantName,
  companyAddress1,
  companyAddress2,
  representativeName,
  contactPhone,
  contactMobile,
} = dto;


    // ★ ここを追加：今から7日後を trialEnd にする
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 同じメールアドレスのユーザーがすでに存在しないかチェック
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException(
        'このメールアドレスはすでに登録されています。',
      );
    }

    // パスワードハッシュ化
    const hashed = await bcrypt.hash(password, 10);

        // ▼ 共通の LINE Webhook URL（env 優先、なければ固定値）
    const defaultWebhookUrl =
      process.env.LINE_WEBHOOK_URL ||
      'https://line-system.onrender.com/line/webhook';

    // テナント＋ユーザーをトランザクションで作成
    const [tenant, user] = await this.prisma
      .$transaction([
          this.prisma.tenant.create({
  data: {
    // ★ テナント名の優先順位
    // 1) tenantName があればそれ
    // 2) なければ companyName（会社名）
    // 3) それもなければ adminName（代表者名）
    name: tenantName || companyName || adminName,

    email,
    // ★ 新規登録は TRIAL プランで開始（既存の挙動そのまま）
    plan: 'TRIAL',
    isActive: true,

    // ★ 契約者情報を保存
    companyName: companyName ?? null,
    companyAddress1: companyAddress1 ?? null,
    companyAddress2: companyAddress2 ?? null,
    representativeName: representativeName ?? adminName ?? null,
    contactPhone: contactPhone ?? phone ?? null,
    contactMobile: contactMobile ?? null,

    // ★ お試し終了日（7日後）
    trialEnd,
    // ★ ログイン制御で使っている validUntil も trialEnd に揃える
    validUntil: trialEnd,
  },
}),

        // user は tenant を作ってから
      ])
            .then(async ([tenant]) => {
        const user = await this.prisma.user.create({
  data: {
    tenantId: tenant.id,
    email,
    // ★ 管理者ユーザー名の優先順位
    name: adminName ?? companyName ?? tenantName ?? null,
    password: hashed,
    role: UserRole.MANAGER,
    isActive: true,
    plan: null, // 必要なら Plan.BASIC などにする
  },
});


        // 3) LineSettings を自動作成（webhookUrl を事前にセット）
        await this.prisma.lineSettings.create({
          data: {
            tenantId: tenant.id,
            webhookUrl: defaultWebhookUrl,
            isActive: false, // 初期状態は無効のまま
          },
        });

        return [tenant, user] as const;
      });

    this.logger.log(
      `New tenant registered. tenantId=${tenant.id}, adminUserId=${user.id}, email=${email}`,
    );

    // レスポンスは最低限の情報だけ返す
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      adminUserId: user.id,
      email: user.email,
    };
  }
}
