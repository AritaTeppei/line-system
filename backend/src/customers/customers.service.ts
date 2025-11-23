// src/customers/customers.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload } from '../auth/auth.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * テナントIDを取り出すヘルパー
   * - DEVELOPER はここでは禁止（顧客操作はテナントで行う想定）
   * - MANAGER / CLIENT は tenantId 必須
   */
  private ensureTenant(user: AuthPayload): number {
    if (user.role === 'DEVELOPER') {
      throw new ForbiddenException(
        '顧客の操作はテナントユーザーで行ってください',
      );
    }
    if (!user.tenantId) {
      throw new ForbiddenException('テナントが特定できません');
    }
    return user.tenantId;
  }

  /**
   * ログインユーザーに紐づく顧客一覧
   */
  async findAllForUser(user: AuthPayload) {
    const tenantId = this.ensureTenant(user);

    return this.prisma.customer.findMany({
      where: { tenantId },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * 顧客新規作成
   * - tenantId はログインユーザーから決定
   * - mobilePhone / lineUid の一意制約違反時は分かりやすいメッセージに変換
   * - birthday は "YYYY-MM-DD" 文字列で受け取り Date に変換
   */
  async createForUser(
    user: AuthPayload,
    data: {
      lastName: string;
      firstName: string;
      postalCode?: string;
      address1?: string;
      address2?: string;
      mobilePhone?: string;
      lineUid?: string;
      birthday?: string;
    },
  ) {
    const tenantId = this.ensureTenant(user);

    try {
      return await this.prisma.customer.create({
        data: {
          tenantId,
          lastName: data.lastName,
          firstName: data.firstName,
          postalCode: data.postalCode,
          address1: data.address1,
          address2: data.address2,
          mobilePhone: data.mobilePhone,
          lineUid: data.lineUid,
          birthday: data.birthday ? new Date(data.birthday) : undefined,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // 一意制約違反
        const rawTarget = e.meta?.target as string[] | string | undefined;
        const targets =
          typeof rawTarget === 'string' ? [rawTarget] : rawTarget ?? [];

        if (targets.some((t) => t.includes('mobilePhone'))) {
          throw new BadRequestException(
            'この携帯番号は既に登録されています',
          );
        }

        if (targets.some((t) => t.includes('lineUid'))) {
          throw new BadRequestException(
            'このLINE UIDは既に登録されています',
          );
        }

        throw new BadRequestException('顧客情報の一意制約エラーが発生しました');
      }

      throw e;
    }
  }

  /**
   * 単一顧客の取得（テナントチェック付き）
   */
  async findOneForUser(user: AuthPayload, id: number) {
    const tenantId = this.ensureTenant(user);

    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('顧客が見つかりません');
    }

    return customer;
  }

  /**
   * 顧客更新
   * - テナントチェック
   * - 一意制約違反も create と同様にハンドリング
   * - birthday があれば Date に変換して保存
   */
  async updateForUser(
    user: AuthPayload,
    id: number,
    data: {
      lastName?: string;
      firstName?: string;
      postalCode?: string;
      address1?: string;
      address2?: string;
      mobilePhone?: string;
      lineUid?: string;
      birthday?: string;
    },
  ) {
    const tenantId = this.ensureTenant(user);

    const existing = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('顧客が見つかりません');
    }

    // birthday だけ Date に変換した updateData を組み立てる
    const updateData: any = { ...data };
    if (data.birthday !== undefined) {
      updateData.birthday = data.birthday ? new Date(data.birthday) : null;
    }

    try {
      return await this.prisma.customer.update({
        where: { id },
        data: updateData,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const rawTarget = e.meta?.target as string[] | string | undefined;
        const targets =
          typeof rawTarget === 'string' ? [rawTarget] : rawTarget ?? [];

        if (targets.some((t) => t.includes('mobilePhone'))) {
          throw new BadRequestException(
            'この携帯番号は既に登録されています',
          );
        }

        if (targets.some((t) => t.includes('lineUid'))) {
          throw new BadRequestException(
            'このLINE UIDは既に登録されています',
          );
        }

        throw new BadRequestException('顧客情報の一意制約エラーが発生しました');
      }

      throw e;
    }
  }

  /**
   * 顧客削除
   * - 将来的に車両が紐づいている場合の扱い（論理削除など）は要検討
   */
  async removeForUser(user: AuthPayload, id: number) {
    const tenantId = this.ensureTenant(user);

    const existing = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('顧客が見つかりません');
    }

    return this.prisma.customer.delete({
      where: { id },
    });
  }
}
