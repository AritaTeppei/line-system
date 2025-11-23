// backend/src/bookings/bookings.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload } from '../auth/auth.service';

// Prisma 側の enum BookingStatus と文字列だけ合わせたローカル定義
export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELED = 'CANCELED',
}

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ログインユーザーからテナントIDを決定
   */
  private ensureTenant(user: AuthPayload): number {
    if (!user.tenantId) {
      throw new Error('テナントが特定できません');
    }
    return user.tenantId;
  }

  /**
   * 自テナントの予約一覧（最新順）
   */
  async listBookings(user: AuthPayload) {
    const tenantId = this.ensureTenant(user);

    // PrismaService の型が古くて booking を知らないので any キャストで逃がす
    const prisma = this.prisma as any;

    return prisma.booking.findMany({
      where: { tenantId },
      orderBy: { bookingDate: 'desc' },
      include: {
        customer: true,
        car: true,
      },
    });
  }

  /**
   * 管理画面から新規予約を作成（PENDING）
   */
  async createBooking(
    user: AuthPayload,
    params: {
      customerId: number;
      carId: number;
      bookingDate: Date;
      timeSlot?: string;
      note?: string;
    },
  ) {
    const tenantId = this.ensureTenant(user);
    const prisma = this.prisma as any;

    // 念のため、顧客と車両が自テナントのものかチェック
    const customer = await prisma.customer.findFirst({
      where: { id: params.customerId, tenantId },
    });
    if (!customer) {
      throw new Error('指定された顧客が見つからないか、他テナントのデータです');
    }

    const car = await prisma.car.findFirst({
      where: { id: params.carId, tenantId },
    });
    if (!car) {
      throw new Error('指定された車両が見つからないか、他テナントのデータです');
    }

    return prisma.booking.create({
      data: {
        tenantId,
        customerId: customer.id,
        carId: car.id,
        bookingDate: params.bookingDate,
        timeSlot: params.timeSlot,
        note: params.note,
        status: BookingStatus.PENDING, // ← ここはローカル enum
        source: 'ADMIN',
      },
    });
  }

  /**
   * 予約ステータスの変更（CONFIRMED / CANCELED など）
   */
  async updateStatus(
    user: AuthPayload,
    bookingId: number,
    status: BookingStatus,
  ) {
    const tenantId = this.ensureTenant(user);
    const prisma = this.prisma as any;

    // 自テナントの予約かチェック
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
    });
    if (!booking) {
      throw new Error('予約が見つからないか、他テナントのデータです');
    }

    return prisma.booking.update({
      where: { id: bookingId },
      data: {
        status,
      },
    });
  }
}
