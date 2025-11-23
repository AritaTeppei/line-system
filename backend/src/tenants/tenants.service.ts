// src/tenants/tenants.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload } from '../auth/auth.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ログインユーザーに応じたテナント一覧を返す
   * - DEVELOPER: 全テナント
   * - MANAGER/CLIENT: 自分の tenantId のみ
   */
  async findForUser(user: AuthPayload) {
    if (user.role === 'DEVELOPER') {
      // 開発者 → 全テナントを見れる
      return this.prisma.tenant.findMany({
        orderBy: { id: 'asc' },
      });
    }

    // 管理者 / クライアント → 自分のテナントだけ
    if (!user.tenantId) {
      // 本来ここには来ない想定だが、防御的に
      return [];
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });

    return tenant ? [tenant] : [];
  }
}
