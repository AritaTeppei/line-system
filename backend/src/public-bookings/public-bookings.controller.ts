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
import { BookingStatus } from '@prisma/client'; // ★ これを追加

type SlotKey = 'MORNING' | 'AFTERNOON' | 'EVENING';

type SlotStatus = 'FULL' | 'AVAILABLE';

type DayAvailability = {
  date: string;
  slots: {
    MORNING: SlotStatus;
    AFTERNOON: SlotStatus;
    EVENING: SlotStatus;
  };
};

// いまは枠ごとの上限台数を「1台」に固定
// 将来的にテナントごとの設定にしたい場合はここをテーブル参照に変える
const SLOT_CAPACITY = 1;

@Controller('public/bookings')
export class PublicBookingsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * timeSlot の文字列を内部的に使う 3 パターンに正規化する
   */
  private normalizeSlot(raw?: string | null): SlotKey {
    const v = (raw ?? '').toUpperCase();

    if (v === 'AFTERNOON' || v === 'PM') return 'AFTERNOON';
    if (v === 'EVENING' || v === 'NIGHT') return 'EVENING';
    return 'MORNING';
  }

  /**
   * 公開フォームからの予約登録
   * POST /public/bookings
   *
   * body: {
   *   tenantId: number;
   *   customerId: number;
   *   carId: number;
   *   bookingDate: string; // "YYYY-MM-DD"
   *   timeSlot: string;    // "MORNING" | "AFTERNOON" | "EVENING"
   *   note?: string;
   * }
   */
  @Post()
  async createPublicBooking(
    @Body()
    body: {
      tenantId: number;
      customerId: number;
      carId: number;
      bookingDate: string;
      timeSlot: string;
      note?: string;
    },
  ) {
    const { tenantId, customerId, carId, bookingDate, timeSlot, note } = body;

    if (!tenantId || !customerId || !carId) {
      throw new BadRequestException(
        'tenantId / customerId / carId は必須です。',
      );
    }

    if (!bookingDate) {
      throw new BadRequestException('bookingDate は必須です。');
    }

    // "YYYY-MM-DD" 想定でパース
    const date = new Date(bookingDate);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('bookingDate の形式が不正です');
    }

    const slotKey = this.normalizeSlot(timeSlot);

    const prisma: any = this.prisma;

    // テナント存在チェック
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new BadRequestException('テナントが存在しません。');
    }

    // 顧客チェック（テナントも合わせて見る）
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId,
      },
    });
    if (!customer) {
      throw new BadRequestException(
        '顧客情報が見つかりません。店舗までお問い合わせください。',
      );
    }

    // 車両チェック
    const car = await prisma.car.findFirst({
      where: {
        id: carId,
        tenantId,
        customerId,
      },
    });
    if (!car) {
      throw new BadRequestException(
        '車両情報が見つかりません。店舗までお問い合わせください。',
      );
    }

    // ★ ここから重複チェックを挿入する ★

    // ★ ここから「1か月以内の重複予約チェック（同じ車両）」★

    // 予約日の1か月前〜1か月後
    const oneMonthBefore = new Date(date);
    oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);

    const oneMonthAfter = new Date(date);
    oneMonthAfter.setMonth(oneMonthAfter.getMonth() + 1);

    // 同じ車両（carId）で、1か月以内に PENDING または CONFIRMED があるか
    const duplicate = await prisma.booking.findFirst({
      where: {
        tenantId,
        carId: car.id, // 「同じ車両」（車台番号1台分）を car レコード単位で判定
        bookingDate: {
          gte: oneMonthBefore,
          lte: oneMonthAfter,
        },
        status: {
          in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        },
      },
    });

    if (duplicate) {
      throw new BadRequestException(
        '同じお車で1か月以内にすでに予約が登録されています。店舗までお問い合わせください。',
      );
    }

    // ★ 重複チェックここまで ★

    // 予約レコードを作成
    const booking = await prisma.booking.create({
      data: {
        tenantId,
        customerId,
        carId,
        bookingDate: date,
        timeSlot: slotKey, // schema.prisma の timeSlot(String?) に対応
        status: 'PENDING', // BookingStatus.PENDING
        source: 'LINE_PUBLIC_FORM', // 「どこから来たか」
        note: note ?? null,
      },
    });

    return {
      ok: true,
      bookingId: booking.id,
    };
  }

  /**
   * （オマケ）月別の空き状況取得
   * GET /public/bookings/availability?tenantId=1&carId=1&month=2026-01
   */
  @Get('availability')
  async getAvailability(
    @Query('tenantId') tenantIdParam: string,
    @Query('carId') carIdParam: string,
    @Query('month') monthParam: string, // "YYYY-MM"
  ) {
    const tenantId = Number(tenantIdParam);
    const carId = Number(carIdParam);

    if (!tenantId || Number.isNaN(tenantId)) {
      throw new BadRequestException('tenantId が不正です');
    }
    if (!carId || Number.isNaN(carId)) {
      throw new BadRequestException('carId が不正です');
    }
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      throw new BadRequestException('month は YYYY-MM 形式で指定してください');
    }

    const [yStr, mStr] = monthParam.split('-');
    const year = Number(yStr);
    const month = Number(mStr); // 1〜12

    if (!year || !month || month < 1 || month > 12) {
      throw new BadRequestException('month の値が不正です');
    }

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const prisma: any = this.prisma;

    const days: DayAvailability[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
      const dateStr = start.toISOString().slice(0, 10);

      const bookings = await prisma.booking.findMany({
        where: {
          tenantId,
          carId,
          bookingDate: {
            gte: start,
            lt: end,
          },
        },
      });

      const counts: Record<SlotKey, number> = {
        MORNING: 0,
        AFTERNOON: 0,
        EVENING: 0,
      };

      for (const b of bookings) {
        const key = this.normalizeSlot(b.timeSlot);
        counts[key] += 1;
      }

      const slots = {
        MORNING: counts.MORNING >= SLOT_CAPACITY ? 'FULL' : 'AVAILABLE',
        AFTERNOON: counts.AFTERNOON >= SLOT_CAPACITY ? 'FULL' : 'AVAILABLE',
        EVENING: counts.EVENING >= SLOT_CAPACITY ? 'FULL' : 'AVAILABLE',
      } as const;

      days.push({
        date: dateStr,
        slots,
      });
    }

    return {
      tenantId,
      carId,
      month: monthParam,
      capacityPerSlot: SLOT_CAPACITY,
      days,
    };
  }
}
