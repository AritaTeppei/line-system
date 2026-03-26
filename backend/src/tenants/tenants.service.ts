// src/tenants/tenants.service.ts
import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
        name: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  /** プランごとのクライアントアカウント上限 */
  private getMaxClients(plan: string | null): number {
    switch ((plan ?? 'BASIC').toUpperCase()) {
      case 'PRO': return 3;
      case 'STANDARD': return 1;
      default: return 0; // BASIC / TRIAL
    }
  }

  /** テナントのプランを取得 */
  async getTenantPlan(tenantId: number): Promise<string> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    return t?.plan ?? 'BASIC';
  }

  /** CLIENTアカウント追加（プラン上限チェック付き） */
  async createClientUser(
    user: AuthPayload,
    body: { email: string; name?: string | null; password: string },
  ) {
    if (user.role !== 'MANAGER') throw new ForbiddenException('MANAGERのみ操作可能です');
    if (!user.tenantId) throw new BadRequestException('テナント情報がありません');

    const plan = await this.getTenantPlan(user.tenantId);
    const maxClients = this.getMaxClients(plan);

    if (maxClients === 0) {
      throw new ForbiddenException('現在のプランではクライアントアカウントを追加できません');
    }

    const currentCount = await this.prisma.user.count({
      where: { tenantId: user.tenantId, role: 'CLIENT' },
    });

    if (currentCount >= maxClients) {
      throw new ForbiddenException(
        `現在のプランでは最大 ${maxClients} アカウントまでです`,
      );
    }

    const email = body.email.trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('このメールアドレスは既に使用されています');

    const passwordHash = await bcrypt.hash(body.password, 10);

    return this.prisma.user.create({
      data: {
        email,
        name: body.name?.trim() || null,
        password: passwordHash,
        role: 'CLIENT',
        tenantId: user.tenantId,
      },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  /** CLIENTアカウント削除 */
  async deleteClientUser(user: AuthPayload, userId: number) {
    if (user.role !== 'MANAGER') throw new ForbiddenException('MANAGERのみ操作可能です');
    if (!user.tenantId) throw new BadRequestException('テナント情報がありません');

    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.tenantId !== user.tenantId || target.role !== 'CLIENT') {
      throw new NotFoundException('対象ユーザーが見つかりません');
    }

    // セッションも合わせて削除
    await this.prisma.userSession.deleteMany({ where: { userId } });
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  /** CLIENTパスワードリセット（MANAGER操作） */
  async resetClientPassword(
    user: AuthPayload,
    userId: number,
    newPassword: string,
  ) {
    if (user.role !== 'MANAGER') throw new ForbiddenException('MANAGERのみ操作可能です');
    if (!user.tenantId) throw new BadRequestException('テナント情報がありません');

    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.tenantId !== user.tenantId || target.role !== 'CLIENT') {
      throw new NotFoundException('対象ユーザーが見つかりません');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash } as any,
    });

    return { success: true };
  }

  /** プランとクライアント上限情報を返す */
  async getClientLimits(user: AuthPayload) {
    if (!user.tenantId) return { plan: 'BASIC', maxClients: 0, currentCount: 0 };

    const plan = await this.getTenantPlan(user.tenantId);
    const maxClients = this.getMaxClients(plan);
    const currentCount = await this.prisma.user.count({
      where: { tenantId: user.tenantId, role: 'CLIENT' },
    });

    return { plan, maxClients, currentCount };
  }
}
