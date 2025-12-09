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

  /**
   * MANAGER が自分のテナント配下の CLIENT ユーザー一覧を取得する
   * - MANAGER 以外（DEVELOPER / CLIENT）は空配列を返す（仕様を壊さないため）
   */
  // クラスの末尾にこれがいるか？
  async findClientsForManager(user: AuthPayload) {
    if (user.role !== 'MANAGER') {
      return [];
    }
    if (!user.tenantId) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        role: 'CLIENT',
      },
      select: {
        id: true,
        email: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }
}
