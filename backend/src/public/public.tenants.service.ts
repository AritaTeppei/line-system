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
    const { companyName, adminName, email, password, phone } = dto;

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

    // テナント＋ユーザーをトランザクションで作成
    const [tenant, user] = await this.prisma
      .$transaction([
          this.prisma.tenant.create({
          data: {
            name: companyName,
            email,
            // ★ 新規登録は TRIAL プランで開始
            plan: 'TRIAL',
            isActive: true,
            contactPhone: phone ?? null,
            representativeName: adminName ?? null,

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
            name: adminName ?? companyName,
            password: hashed,
            role: UserRole.MANAGER,
            isActive: true,
            plan: null, // 必要なら Plan.BASIC などにする
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
