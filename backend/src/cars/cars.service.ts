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
    /**
   * 車両更新
   * - 顧客を変更する場合は、その顧客も同一テナントかチェック
   */
    /**
   * 車両更新
   * - 顧客を変更する場合は、その顧客も同一テナントかチェック
   * - 日付を空欄にした場合は null に更新できるようにする
   */
  async updateForUser(
    user: AuthPayload,
    id: number,
    data: {
      registrationNumber?: string;
      chassisNumber?: string;
      carName?: string;
      customerId?: number;
      shakenDate?: string | null;
      inspectionDate?: string | null;
      customReminderDate?: string | null;
      customDaysBefore?: number | null;
    },
  ) {
    const tenantId = this.ensureTenant(user);

    // 1. 自テナントの車両か確認
    const existing = await this.prisma.car.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('車両が見つかりません');
    }

    // 2. 顧客変更が指定されている場合は、その顧客も同一テナントか確認
    let customerIdToUse = existing.customerId;

    if (
      typeof data.customerId === 'number' &&
      data.customerId !== existing.customerId
    ) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: data.customerId, tenantId },
      });
      if (!customer) {
        throw new NotFoundException(
          '顧客が見つかりません（または別テナントです）',
        );
      }
      customerIdToUse = data.customerId;
    }

    // 日付更新用ヘルパー
    const normalizeDate = (
      value: string | null | undefined,
      current: Date | null,
    ): Date | null => {
      // undefined → そのフィールドは「変更なし」
      if (value === undefined) return current;
      // null or '' → 明示的に空にしたい → null 保存
      if (value === null || value === '') return null;
      // それ以外は日付に変換
      return new Date(value);
    };

    // 数値(任意何日前)の更新用ヘルパー
    const normalizeNumber = (
      value: number | null | undefined,
      current: number | null,
    ): number | null => {
      if (value === undefined) return current; // 変更なし
      if (value === null) return null;         // 空でクリア
      return value;                            // 新しい数値
    };

    // 3. 更新本体
    try {
      return await this.prisma.car.update({
        where: { id },
        data: {
          registrationNumber:
            data.registrationNumber ?? existing.registrationNumber,
          chassisNumber: data.chassisNumber ?? existing.chassisNumber,
          carName: data.carName ?? existing.carName,

          // ★ 外部キーの代わりにリレーションで connect する
          customer: {
            connect: { id: customerIdToUse },
          },

          // ★ 日付系：undefined=そのまま / null or ''=null にクリア / それ以外は新しい日付
          shakenDate: normalizeDate(
            data.shakenDate,
            existing.shakenDate,
          ),
          inspectionDate: normalizeDate(
            data.inspectionDate,
            existing.inspectionDate,
          ),
          customReminderDate: normalizeDate(
            data.customReminderDate,
            existing.customReminderDate,
          ),

          // ★ 任意何日前：同じく null でクリア可能
          customDaysBefore: normalizeNumber(
            data.customDaysBefore,
            existing.customDaysBefore,
          ),
        },
        include: {
          customer: true, // フロントで名前を出したいので顧客も返す
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
          throw new BadRequestException(
            'この車台番号はすでに登録されています',
          );
        }

        throw new BadRequestException('一意制約エラーが発生しました');
      }
      throw e;
    }
  }



  /**
   * 車両削除
   */
    /**
   * 車両削除
   * - 今日以降に「確定」ステータスの予約がある場合は削除NG
   */
  async removeForUser(user: AuthPayload, id: number) {
    const tenantId = this.ensureTenant(user);

    // 1. 対象車両が自テナントに存在するか確認
    const existing = await this.prisma.car.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('車両が見つかりません');
    }

    // 2. 今日以降の「確定」予約をチェック
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 「今日から先」

    const futureConfirmedBookings = await this.prisma.booking.findMany({
      where: {
        tenantId,
        carId: id,
        status: 'CONFIRMED',
        bookingDate: {
          gte: today,
        },
      },
    });

    if (futureConfirmedBookings.length > 0) {
      const count = futureConfirmedBookings.length;
      throw new BadRequestException(
        `この車両には今日以降の確定予約が ${count} 件あります。\n` +
          '該当する予約を変更または削除してから、車両を削除してください。',
      );
    }

    // 3. 問題なければ削除
    return this.prisma.car.delete({
      where: { id },
    });
  }
}
