// src/cars/cars.service.ts
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
export class CarsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 車両操作を行う前に「どのテナントか」を確定させる
   * - DEVELOPER → 車両操作は不可（管理画面から見るだけ想定）
   * - tenantId がないユーザーも不可
   */
  private ensureTenant(user: AuthPayload): number {
    if (user.role === 'DEVELOPER') {
      throw new ForbiddenException(
        '車両の登録・編集はテナントユーザーで行ってください',
      );
    }
    if (!user.tenantId) {
      throw new ForbiddenException('テナントが特定できません');
    }
    return user.tenantId;
  }

  /**
   * ログインユーザーに紐づくテナントの車両一覧
   * customer も一緒に返す（フロントで顧客名表示用）
   */
  async findAllForUser(user: AuthPayload) {
    const tenantId = this.ensureTenant(user);

    return this.prisma.car.findMany({
      where: { tenantId },
      orderBy: { id: 'asc' },
      include: {
        customer: true, // ★ ここが重要：顧客も一緒に返す
      },
    });
  }

  /**
   * 車両登録
   * - 車両は必ず同一テナント内の顧客に紐づく
   * - 車台番号（chassisNumber）は一意制約
   */
  async createForUser(user: AuthPayload, data: {
    customerId: number;
    registrationNumber: string;
    chassisNumber: string;
    carName: string;
    shakenDate?: string;
    inspectionDate?: string;
    customReminderDate?: string;
    customDaysBefore?: number;
  }) {
    const tenantId = this.ensureTenant(user);

    // 顧客が同じテナントに属しているか確認
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: data.customerId,
        tenantId,
      },
    });

    if (!customer) {
      throw new NotFoundException('顧客が見つかりません（または別テナントです）');
    }

    try {
      return await this.prisma.car.create({
        data: {
          tenantId,
          customerId: data.customerId,
          registrationNumber: data.registrationNumber,
          chassisNumber: data.chassisNumber,
          carName: data.carName,
          shakenDate: data.shakenDate ? new Date(data.shakenDate) : undefined,
        inspectionDate: data.inspectionDate
          ? new Date(data.inspectionDate)
          : undefined,
        customReminderDate: data.customReminderDate
          ? new Date(data.customReminderDate)
          : undefined,
        customDaysBefore: data.customDaysBefore ?? null,
        },
        include: {
          customer: true, // ★ 作成直後の戻り値にも customer を含める
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = (e.meta?.target as string[]) ?? [];

        // chassisNumber 一意制約エラー
        if (target.some((t) => t.includes('chassisNumber'))) {
          throw new BadRequestException('この車台番号はすでに登録されています');
        }

        throw new BadRequestException('一意制約エラーが発生しました');
      }
      throw e;
    }
  }

  /**
   * 車両更新（必要に応じて使う）
   * - 顧客を変更する場合は、その顧客も同一テナントかチェック
   */
  async updateForUser(
    user: AuthPayload,
    id: number,
    data: {
      registrationNumber?: string;
      chassisNumber?: string;
      carName?: string;
      customerId?: number;
    },
  ) {
    const tenantId = this.ensureTenant(user);

    const existing = await this.prisma.car.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('車両が見つかりません');
    }

    let customerIdToUse = existing.customerId;

    // customerId が変更される場合は、その顧客が同じテナントか確認
    if (data.customerId && data.customerId !== existing.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: data.customerId, tenantId },
      });
      if (!customer) {
        throw new NotFoundException('顧客が見つかりません（または別テナントです）');
      }
      customerIdToUse = data.customerId;
    }

    try {
      return await this.prisma.car.update({
        where: { id },
        data: {
          registrationNumber: data.registrationNumber ?? existing.registrationNumber,
          chassisNumber: data.chassisNumber ?? existing.chassisNumber,
          carName: data.carName ?? existing.carName,
          customerId: customerIdToUse,
        },
        include: {
          customer: true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = (e.meta?.target as string[]) ?? [];
        if (target.some((t) => t.includes('chassisNumber'))) {
          throw new BadRequestException('この車台番号はすでに登録されています');
        }
        throw new BadRequestException('一意制約エラーが発生しました');
      }
      throw e;
    }
  }

  /**
   * 車両削除
   */
  async removeForUser(user: AuthPayload, id: number) {
    const tenantId = this.ensureTenant(user);

    const existing = await this.prisma.car.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('車両が見つかりません');
    }

    return this.prisma.car.delete({
      where: { id },
    });
  }
}
