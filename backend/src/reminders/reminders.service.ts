// src/reminders/reminders.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload } from '../auth/auth.service';

type ReminderKind =
  | 'BIRTHDAY'
  | 'SHAKEN_2M'
  | 'SHAKEN_1W'
  | 'INSPECTION_1M'
  | 'CUSTOM';

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * テナントIDの決定ロジック
   * - DEVELOPER: tenantIdFromQuery が必須（どのテナントを見るか指定）
   * - MANAGER/CLIENT: 自分の tenantId 固定
   */
  private ensureTenant(user: AuthPayload, tenantIdFromQuery?: number): number {
    if (user.role === 'DEVELOPER') {
      if (!tenantIdFromQuery) {
        throw new Error(
          'DEVELOPER は tenantId クエリパラメータを指定してください',
        );
      }
      return tenantIdFromQuery;
    }

    if (!user.tenantId) {
      throw new Error('テナントが特定できません');
    }
    return user.tenantId;
  }

  /**
   * 日付差分（日数）を計算（時刻は無視して日単位で比較）
   * diff = (eventDate - baseDate) [日]
   */
  private diffInDays(base: Date, event: Date): number {
    const utcBase = Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
    );
    const utcEvent = Date.UTC(
      event.getUTCFullYear(),
      event.getUTCMonth(),
      event.getUTCDate(),
    );
    const diffMs = utcEvent - utcBase;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * 公開予約フォームのURLを組み立てる
   * （LINE リマインドから予約フォームへ飛ばすため）
   */
  private buildBookingUrl(args: {
    tenantId: number;
    customerId: number;
    carId: number;
    date: Date;
  }): string {
    const { tenantId, customerId, carId, date } = args;

    const baseUrl =
      process.env.PUBLIC_BOOKING_URL || 'http://localhost:3000/public/booking';

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const query =
      `tenantId=${tenantId}` +
      `&customerId=${customerId}` +
      `&carId=${carId}` +
      `&date=${dateStr}`;

    return `${baseUrl}?${query}`;
  }

  /**
   * LINE に送る本文テンプレート
   */
  private buildReminderMessage(params: {
    kind: ReminderKind;
    customerName: string;
    carName?: string;
    registrationNumber?: string;
    mainDate?: string; // "YYYY-MM-DD"
    bookingUrl?: string | null;
    daysBefore?: number | null;
  }): string {
    const {
      kind,
      customerName,
      carName,
      registrationNumber,
      mainDate,
      bookingUrl,
      daysBefore,
    } = params;

    // 日付の表示用（YYYY-MM-DD → YYYY/MM/DD）
    const dateForDisplay =
      mainDate && /^\d{4}-\d{2}-\d{2}$/.test(mainDate)
        ? mainDate.replace(/-/g, '/')
        : mainDate ?? '';

    const carLine =
      carName && registrationNumber
        ? `対象のお車：${carName}（${registrationNumber}）`
        : carName
          ? `対象のお車：${carName}`
          : '';

    const urlLine = bookingUrl ? `\n▼ご予約はこちら\n${bookingUrl}` : '';

    switch (kind) {
      case 'BIRTHDAY':
        return [
          '【お誕生日おめでとうございます】',
          `${customerName} 様`,
          '',
          'いつもご利用いただきありがとうございます。',
          'ささやかではございますが、お誕生日のお祝いとしてご案内をお送りしました。',
          '',
          '今後ともよろしくお願いいたします。',
        ].join('\n');

      case 'SHAKEN_2M':
        return [
          '【車検2ヶ月前のお知らせ】',
          `${customerName} 様`,
          '',
          'いつも当店をご利用いただきありがとうございます。',
          carLine,
          dateForDisplay
            ? `車検の満了日が ${dateForDisplay} に近づいております。`
            : 'お車の車検満了日が近づいております。',
          '',
          'お早めのご予約をおすすめしております。',
          urlLine,
        ]
          .filter(Boolean)
          .join('\n');

      case 'SHAKEN_1W':
        return [
          '【車検1週間前のお知らせ】',
          `${customerName} 様`,
          '',
          carLine,
          dateForDisplay
            ? `車検の満了日（${dateForDisplay}）まであと1週間となりました。`
            : '車検満了日まであと1週間となりました。',
          '',
          'まだご予約がお済みでない場合は、お早めにご連絡ください。',
          urlLine,
        ]
          .filter(Boolean)
          .join('\n');

      case 'INSPECTION_1M':
        return [
          '【点検1ヶ月前のお知らせ】',
          `${customerName} 様`,
          '',
          carLine,
          dateForDisplay
            ? `点検のご予定日が ${dateForDisplay} に近づいております。`
            : '点検のご予定日が近づいております。',
          '',
          '安全・安心のため、事前のご予約をお願いいたします。',
          urlLine,
        ]
          .filter(Boolean)
          .join('\n');

      case 'CUSTOM':
        return [
          '【お車に関するお知らせ】',
          `${customerName} 様`,
          '',
          carLine,
          daysBefore != null && dateForDisplay
            ? `${dateForDisplay} に設定していたお知らせの${daysBefore}日前となりました。`
            : '事前に設定されていたお知らせのタイミングになりました。',
          '',
          'ご不明点やご相談がございましたら、お気軽にご返信ください。',
          urlLine,
        ]
          .filter(Boolean)
          .join('\n');

      default:
        // 万が一のフォールバック
        return [
          '【お知らせ】',
          `${customerName} 様`,
          '',
          carLine,
          dateForDisplay ? `対象日：${dateForDisplay}` : '',
          urlLine,
        ]
          .filter(Boolean)
          .join('\n');
    }
  }

  /**
   * 指定日付の「だれが対象か」を洗い出すメイン処理
   * baseDateStr: ISO文字列 or "YYYY-MM-DD"
   */
  async previewForDate(
    user: AuthPayload,
    baseDateStr: string,
    tenantIdFromQuery?: number,
  ) {
    const tenantId = this.ensureTenant(user, tenantIdFromQuery);

    const date = new Date(baseDateStr);
    if (Number.isNaN(date.getTime())) {
      throw new Error('date の形式が不正です');
    }

    // targetDate は「その日の 00:00 UTC」として扱う（純粋に日だけ比較）
    const targetDate = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );

    // 誕生日を持っている顧客
    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        birthday: { not: null },
      },
    });

    // 何かしら日付を持っている車両
    const cars = await this.prisma.car.findMany({
      where: {
        tenantId,
        OR: [
          { shakenDate: { not: null } },
          { inspectionDate: { not: null } },
          { customReminderDate: { not: null } },
        ],
      },
      include: {
        customer: true,
      },
    });

    // --- 誕生日ターゲット ---
    const birthdayTargets = customers
      .filter((c) => {
        if (!c.birthday) return false;
        const b = c.birthday as Date;
        return (
          b.getUTCMonth() === targetDate.getUTCMonth() &&
          b.getUTCDate() === targetDate.getUTCDate()
        );
      })
      .map((c) => {
        const customerName = `${c.lastName} ${c.firstName}`;
        const messageText = this.buildReminderMessage({
          kind: 'BIRTHDAY',
          customerName,
        });

        return {
          kind: 'BIRTHDAY' as const,
          customerId: c.id,
          customerName,
          lineUid: (c as any).lineUid ?? null,
          messageText,
        };
      });

    // --- 車両ターゲット ---
    const shakenTwoMonths: any[] = [];
    const shakenOneWeek: any[] = [];
    const inspectionOneMonth: any[] = [];
    const custom: any[] = [];

    for (const car of cars) {
      const customer = (car as any).customer;
      if (!customer) continue;

      const baseInfo = {
        carId: car.id,
        carName: car.carName,
        registrationNumber: car.registrationNumber,
        customerId: customer.id,
        customerName: `${customer.lastName} ${customer.firstName}`,
        lineUid: customer.lineUid ?? null,
      };

      // 車検日：2ヶ月前 / 1週間前
      if (car.shakenDate) {
        const shakenDate = car.shakenDate as Date;
        const diff = this.diffInDays(targetDate, shakenDate);
        const shakenDateStr = shakenDate.toISOString().slice(0, 10);

        // 2ヶ月前（≒60日）
        if (diff === 60) {
          const bookingUrl = this.buildBookingUrl({
            tenantId,
            customerId: customer.id,
            carId: car.id,
            date: shakenDate,
          });
          const messageText = this.buildReminderMessage({
            kind: 'SHAKEN_2M',
            customerName: baseInfo.customerName,
            carName: baseInfo.carName,
            registrationNumber: baseInfo.registrationNumber,
            mainDate: shakenDateStr,
            bookingUrl,
          });

          shakenTwoMonths.push({
            ...baseInfo,
            kind: 'SHAKEN_2M' as const,
            shakenDate: shakenDateStr,
            bookingUrl,
            messageText,
          });
        }

        // 1週間前
        if (diff === 7) {
          const bookingUrl = this.buildBookingUrl({
            tenantId,
            customerId: customer.id,
            carId: car.id,
            date: shakenDate,
          });
          const messageText = this.buildReminderMessage({
            kind: 'SHAKEN_1W',
            customerName: baseInfo.customerName,
            carName: baseInfo.carName,
            registrationNumber: baseInfo.registrationNumber,
            mainDate: shakenDateStr,
            bookingUrl,
          });

          shakenOneWeek.push({
            ...baseInfo,
            kind: 'SHAKEN_1W' as const,
            shakenDate: shakenDateStr,
            bookingUrl,
            messageText,
          });
        }
      }

      // 点検日：1ヶ月前（30日）
      if (car.inspectionDate) {
        const inspectionDate = car.inspectionDate as Date;
        const diff = this.diffInDays(targetDate, inspectionDate);
        const inspectionDateStr = inspectionDate.toISOString().slice(0, 10);

        if (diff === 30) {
          const bookingUrl = this.buildBookingUrl({
            tenantId,
            customerId: customer.id,
            carId: car.id,
            date: inspectionDate,
          });
          const messageText = this.buildReminderMessage({
            kind: 'INSPECTION_1M',
            customerName: baseInfo.customerName,
            carName: baseInfo.carName,
            registrationNumber: baseInfo.registrationNumber,
            mainDate: inspectionDateStr,
            bookingUrl,
          });

          inspectionOneMonth.push({
            ...baseInfo,
            kind: 'INSPECTION_1M' as const,
            inspectionDate: inspectionDateStr,
            bookingUrl,
            messageText,
          });
        }
      }

      // 任意日付：customDaysBefore 日前
      if (car.customReminderDate && car.customDaysBefore != null) {
        const customDate = car.customReminderDate as Date;
        const diff = this.diffInDays(targetDate, customDate);
        const customDateStr = customDate.toISOString().slice(0, 10);

        if (diff === car.customDaysBefore) {
          const bookingUrl = this.buildBookingUrl({
            tenantId,
            customerId: customer.id,
            carId: car.id,
            date: customDate,
          });
          const messageText = this.buildReminderMessage({
            kind: 'CUSTOM',
            customerName: baseInfo.customerName,
            carName: baseInfo.carName,
            registrationNumber: baseInfo.registrationNumber,
            mainDate: customDateStr,
            bookingUrl,
            daysBefore: car.customDaysBefore,
          });

          custom.push({
            ...baseInfo,
            kind: 'CUSTOM' as const,
            customDate: customDateStr,
            daysBefore: car.customDaysBefore,
            bookingUrl,
            messageText,
          });
        }
      }
    }

    return {
      date: targetDate.toISOString().slice(0, 10),
      tenantId,
      birthdayTargets,
      shakenTwoMonths,
      shakenOneWeek,
      inspectionOneMonth,
      custom,
    };
  }

  /**
   * 実際に「送るつもりで」対象を洗い出す処理。
   * いまはまだ LINE 実送信はせず、カウントだけ返す。
   */
  async sendForDate(
    user: AuthPayload,
    baseDateStr: string,
    tenantIdFromQuery?: number,
  ) {
    const preview = await this.previewForDate(
      user,
      baseDateStr,
      tenantIdFromQuery,
    );

    const totalCount =
      preview.birthdayTargets.length +
      preview.shakenTwoMonths.length +
      preview.shakenOneWeek.length +
      preview.inspectionOneMonth.length +
      preview.custom.length;

    return {
      ...preview,
      totalCount,
    };
  }
}
