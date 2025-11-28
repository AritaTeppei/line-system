// src/public-bookings/public-bookings.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type SlotKey = 'MORNING' | 'AFTERNOON' | 'EVENING';

// ★ いまは枠ごとの上限台数を「1台」に固定
//    → 将来、テナントごとに設定できるように拡張予定
const SLOT_CAPACITY = 1;

@Controller('public/bookings')
export class PublicBookingsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 対象車両情報を返す
   * GET /public/bookings/info?tenantId=1&customerId=1&carId=1
   */
  @Get('info')
  async getInfo(
    @Query('tenantId') tenantIdParam?: string,
    @Query('customerId') customerIdParam?: string,
    @Query('carId') carIdParam?: string,
  ) {
    const tenantId = tenantIdParam ? Number(tenantIdParam) : NaN;
    const customerId = customerIdParam ? Number(customerIdParam) : NaN;
    const carId = carIdParam ? Number(carIdParam) : NaN;

    if (
      Number.isNaN(tenantId) ||
      Number.isNaN(customerId) ||
      Number.isNaN(carId)
    ) {
      throw new BadRequestException(
        'tenantId / customerId / carId が不正です',
      );
    }

    const prisma = this.prisma as any;

    const car = await prisma.car.findFirst({
      where: {
        id: carId,
        tenantId,
        customerId,
      },
      include: {
        customer: true,
      },
    });

    if (!car || !car.customer) {
      throw new BadRequestException('対象の車両が見つかりません');
    }

    const customer = car.customer;

    return {
      tenantId,
      customerId: customer.id,
      carId: car.id,
      customerName: `${customer.lastName} ${customer.firstName}`,
      lineUid: customer.lineUid ?? null,
      carName: car.carName,
      registrationNumber: car.registrationNumber,
      vin: car.vin ?? null,
      shakenDate: car.shakenDate
        ? (car.shakenDate as Date).toISOString().slice(0, 10)
        : null,
      inspectionDate: car.inspectionDate
        ? (car.inspectionDate as Date).toISOString().slice(0, 10)
        : null,
    };
  }

  /**
   * timeSlot を "午前/午後/夕方 or 時刻 or 英語" から正規化する
   */
  private normalizeSlot(
    rawSlot: string | undefined,
    bookingDate: Date,
  ): SlotKey {
    if (rawSlot) {
      const upper = rawSlot.toUpperCase();
      if (upper === 'MORNING' || upper === 'AFTERNOON' || upper === 'EVENING') {
        return upper as SlotKey;
      }

      const lower = rawSlot.toLowerCase();
      if (lower.includes('午前')) return 'MORNING';
      if (lower.includes('午後')) return 'AFTERNOON';
      if (lower.includes('夕方') || lower.includes('夕')) return 'EVENING';
    }

    // 時刻から推定（10〜12: 午前 / 13〜15: 午後 / 15〜17: 夕方）
    const hour = bookingDate.getHours();
    if (hour >= 10 && hour < 12) return 'MORNING';
    if (hour >= 13 && hour < 15) return 'AFTERNOON';
    if (hour >= 15 && hour < 17) return 'EVENING';

    // それ以外はとりあえず午前扱い（将来UIを固定していく想定）
    return 'MORNING';
  }

  /**
   * 公開予約フォームからの予約作成
   * 認証なし（LINE からのリンクを前提）
   *
   * - 同じテナント / 同じ日付 / 同じ枠(timeSlot) で
   *   PENDING or CONFIRMED の予約が枠上限を超えている場合はエラー
   */
  @Post()
  async createBooking(
    @Body()
    body: {
      tenantId: number;
      customerId: number;
      carId: number;
      bookingDate: string; // ISO or yyyy-mm-ddTHH:mm
      timeSlot?: string; // "MORNING" | "AFTERNOON" | "EVENING" | 自由入力（暫定）
      note?: string;
    },
  ) {
    const { tenantId, customerId, carId } = body;
    if (!tenantId || !customerId || !carId || !body.bookingDate) {
      throw new BadRequestException(
        'tenantId, customerId, carId, bookingDate は必須です',
      );
    }

    const date = new Date(body.bookingDate);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('bookingDate の形式が不正です');
    }

    // 枠の正規化（午前 / 午後 / 夕方）
    const slotKey = this.normalizeSlot(body.timeSlot, date);

    const prisma = this.prisma as any;

    // テナントチェック
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new BadRequestException('テナントが存在しません');
    }

    // 顧客がそのテナントに属しているか
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer) {
      throw new BadRequestException(
        '顧客が見つからないか、指定されたテナントの顧客ではありません',
      );
    }

    // 車両がそのテナント＋顧客に属しているか
    const car = await prisma.car.findFirst({
      where: { id: carId, tenantId, customerId },
    });
    if (!car) {
      throw new BadRequestException(
        '車両が見つからないか、指定された顧客・テナントの車両ではありません',
      );
    }

    // ==== 枠の空き状況チェック ====
    // 1テナントあたり 1枠=1台 からスタート
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const nextDay = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1,
      ),
    );

    const sameSlotCount = await prisma.booking.count({
      where: {
        tenantId,
        bookingDate: {
          gte: dayStart,
          lt: nextDay,
        },
        timeSlot: slotKey,
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
    });

    if (sameSlotCount >= SLOT_CAPACITY) {
      throw new BadRequestException(
        'この日付のこの時間帯はすでに予約でいっぱいです。他の時間帯をお選びください。',
      );
    }

    // 予約作成
    const booking = await prisma.booking.create({
      data: {
        tenantId,
        customerId,
        carId,
        bookingDate: date,
        timeSlot: slotKey, // 正規化した枠を保存
        note: body.note || null,
        status: 'PENDING', // BookingStatus.PENDING と同じ文字列
        source: 'LINE_PUBLIC_FORM',
      },
    });

    return {
      ok: true,
      bookingId: booking.id,
    };
  }

  /**
   * 指定月の「枠の空き状況」を返す
   * GET /public/bookings/availability?tenantId=1&month=2025-12
   */
  @Get('availability')
  async getAvailability(
    @Query('tenantId') tenantIdParam?: string,
    @Query('month') monthParam?: string, // "YYYY-MM"
  ) {
    const tenantId = tenantIdParam ? Number(tenantIdParam) : NaN;
    if (Number.isNaN(tenantId)) {
      throw new BadRequestException('tenantId が不正です');
    }

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      throw new BadRequestException(
        'month は "YYYY-MM" 形式で指定してください（例: 2025-12）',
      );
    }

    const year = Number(monthParam.slice(0, 4));
    const monthIndex = Number(monthParam.slice(5, 7)) - 1; // 0-11

    const monthStart = new Date(Date.UTC(year, monthIndex, 1));
    const nextMonth = new Date(Date.UTC(year, monthIndex + 1, 1));

    const prisma = this.prisma as any;

    // 指定月の予約を全部取得（PENDING / CONFIRMED のみ）
    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        bookingDate: {
          gte: monthStart,
          lt: nextMonth,
        },
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
    });

    // 日付ごと ＋ 枠ごとに件数を集計
    const dayMap = new Map<
      string,
      { MORNING: number; AFTERNOON: number; EVENING: number }
    >();

    for (const b of bookings) {
      const dt = b.bookingDate as Date;
      const dateKey = dt.toISOString().slice(0, 10); // YYYY-MM-DD（UTC基準）

      const slot = this.normalizeSlot(b.timeSlot, dt);

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { MORNING: 0, AFTERNOON: 0, EVENING: 0 });
      }
      const counts = dayMap.get(dateKey)!;
      counts[slot] += 1;
    }

    // レスポンス用に整形
    const days = Array.from(dayMap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, counts]) => {
        const slots: Record<SlotKey, 'AVAILABLE' | 'FULL'> = {
          MORNING:
            counts.MORNING >= SLOT_CAPACITY ? 'FULL' : 'AVAILABLE',
          AFTERNOON:
            counts.AFTERNOON >= SLOT_CAPACITY ? 'FULL' : 'AVAILABLE',
          EVENING:
            counts.EVENING >= SLOT_CAPACITY ? 'FULL' : 'AVAILABLE',
        };
        return { date, slots };
      });

    return {
      tenantId,
      month: monthParam,
      capacityPerSlot: SLOT_CAPACITY,
      days,
    };
  }
}
