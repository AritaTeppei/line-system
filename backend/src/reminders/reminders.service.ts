// src/reminders/reminders.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload } from '../auth/auth.service';
import { LineService } from '../line/line.service';
import { ReminderMessageType } from '@prisma/client'; // ← ここ
import { UpsertReminderTemplateDto } from './dto/upsert-reminder-template.dto';

type ReminderKind =
  | 'BIRTHDAY'
  | 'SHAKEN_2M'
  | 'SHAKEN_1W'
  | 'INSPECTION_1M'
  | 'CUSTOM';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lineService: LineService,
  ) {}

   async upsertTemplateForTenant(tenantId: number, dto: UpsertReminderTemplateDto) {
    return this.prisma.reminderMessageTemplate.upsert({
      where: {
        tenantId_type: {
          tenantId,
          type: dto.type,
        },
      },
      update: {
        title: dto.title,
        body: dto.body,
        note: dto.note,
      },
      create: {
        tenantId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        note: dto.note,
      },
    });
  }

  async getTemplatesForTenant(tenantId: number) {
    return this.prisma.reminderMessageTemplate.findMany({
      where: { tenantId },
      orderBy: { type: 'asc' },
    });
  }

  async getTemplateForTenantByType(tenantId: number, type: ReminderMessageType) {
    return this.prisma.reminderMessageTemplate.findUnique({
      where: {
        tenantId_type: {
          tenantId,
          type,
        },
      },
    });
  }
  /**
   * テナントIDの決定ロジック
   * - DEVELOPER: tenantIdFromQuery が必須
   * - MANAGER / CLIENT: user.tenantId をそのまま使用
   */
  private ensureTenant(user: AuthPayload, tenantIdFromQuery?: number): number {
        // ★ この3行を追加
    if (!user) {
      throw new Error(
        'ユーザー情報が取得できません。認証ガードや controller からの引数を確認してください。',
      );
    }
    
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
   * base→event の日数差分（event - base）を日単位で計算
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
   * 指定日のリマインド対象を抽出して preview 用のデータを返す
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

    // 車検日・点検日・任意日付を持っている車
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

      // 車検日
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

    this.logger.log(
      `previewForDate: tenantId=${tenantId}, date=${targetDate.toISOString().slice(
        0,
        10,
      )}, birthday=${birthdayTargets.length}, shaken2m=${shakenTwoMonths.length}, shaken1w=${shakenOneWeek.length}, inspection1m=${inspectionOneMonth.length}, custom=${custom.length}`,
    );

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
   * 指定月のリマインド対象件数を、日付ごとにまとめて返す
   * - month: "YYYY-MM" 形式（例: "2025-11"）
   * - 内部的には 1日〜月末まで既存 previewForDate を呼び出して集計
   * - その月の中で「1件以上ヒットした日だけ」を days に含める
   */
    /**
   * 指定月のリマインド対象件数＋対象者一覧を返す
   * - monthStr: "YYYY-MM"
   * - days: 日別サマリ（今まで通り）
   * - items: 対象者＆対象車両一覧（送信用の情報付き）
   */
  async previewForMonth(
    user: AuthPayload,
    monthStr: string,
    tenantIdFromQuery?: number,
  ) {
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
      throw new Error('month は YYYY-MM 形式で指定してください');
    }

    const [yStr, mStr] = monthStr.split('-');
    const year = Number(yStr);
    const month = Number(mStr); // 1〜12

    if (!year || !month || month < 1 || month > 12) {
      throw new Error('month の値が不正です');
    }

    // その月の日数（28〜31）
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    // 日別サマリ
    const allDays: {
      date: string;
      birthdayCount: number;
      shakenTwoMonthsCount: number;
      shakenOneWeekCount: number;
      inspectionOneMonthCount: number;
      customCount: number;
      totalCount: number;
    }[] = [];

    // 一覧用アイテム（送信用情報も抱えておく）
    const allItems: {
      id: number;
      date: string; // "YYYY-MM-DD"
      category:
        | 'birthday'
        | 'shakenTwoMonths'
        | 'shakenOneWeek'
        | 'inspectionOneMonth'
        | 'custom';
      customerName: string;
      carName?: string | null;
      plateNumber?: string | null;
      lineUid: string | null;
      messageText: string;
    }[] = [];

    let nextItemId = 1;

    // 1日〜月末までループして、既存 previewForDate を使って集計
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(Date.UTC(year, month - 1, day));
      const dateStr = d.toISOString().slice(0, 10); // "YYYY-MM-DD"

      const preview = await this.previewForDate(
        user,
        dateStr,
        tenantIdFromQuery,
      );

      const birthdayCount = preview.birthdayTargets.length;
      const shakenTwoMonthsCount = preview.shakenTwoMonths.length;
      const shakenOneWeekCount = preview.shakenOneWeek.length;
      const inspectionOneMonthCount = preview.inspectionOneMonth.length;
      const customCount = preview.custom.length;
      const totalCount =
        birthdayCount +
        shakenTwoMonthsCount +
        shakenOneWeekCount +
        inspectionOneMonthCount +
        customCount;

      allDays.push({
        date: dateStr,
        birthdayCount,
        shakenTwoMonthsCount,
        shakenOneWeekCount,
        inspectionOneMonthCount,
        customCount,
        totalCount,
      });

      // ── 一覧用 items 作成（送信用の lineUid / messageText も持っておく） ──

      // 誕生日
      for (const t of preview.birthdayTargets as any[]) {
        allItems.push({
          id: nextItemId++,
          date: dateStr,
          category: 'birthday',
          customerName: t.customerName,
          carName: null,
          plateNumber: null,
          lineUid: t.lineUid ?? null,
          messageText: t.messageText,
        });
      }

      // 車検2ヶ月前
      for (const t of preview.shakenTwoMonths as any[]) {
        allItems.push({
          id: nextItemId++,
          date: dateStr,
          category: 'shakenTwoMonths',
          customerName: t.customerName,
          carName: t.carName ?? null,
          plateNumber: t.registrationNumber ?? null,
          lineUid: t.lineUid ?? null,
          messageText: t.messageText,
        });
      }

      // 車検1週間前
      for (const t of preview.shakenOneWeek as any[]) {
        allItems.push({
          id: nextItemId++,
          date: dateStr,
          category: 'shakenOneWeek',
          customerName: t.customerName,
          carName: t.carName ?? null,
          plateNumber: t.registrationNumber ?? null,
          lineUid: t.lineUid ?? null,
          messageText: t.messageText,
        });
      }

      // 点検1ヶ月前
      for (const t of preview.inspectionOneMonth as any[]) {
        allItems.push({
          id: nextItemId++,
          date: dateStr,
          category: 'inspectionOneMonth',
          customerName: t.customerName,
          carName: t.carName ?? null,
          plateNumber: t.registrationNumber ?? null,
          lineUid: t.lineUid ?? null,
          messageText: t.messageText,
        });
      }

      // 任意日付
      for (const t of preview.custom as any[]) {
        allItems.push({
          id: nextItemId++,
          date: dateStr,
          category: 'custom',
          customerName: t.customerName,
          carName: t.carName ?? null,
          plateNumber: t.registrationNumber ?? null,
          lineUid: t.lineUid ?? null,
          messageText: t.messageText,
        });
      }
    }

    const tenantId = this.ensureTenant(user, tenantIdFromQuery);

    // 「1件以上ヒットした日」だけ days に載せる
    const hitDays = allDays.filter((d) => d.totalCount > 0);

    this.logger.log(
      `previewForMonth: tenantId=${tenantId}, month=${monthStr}, totalDays=${allDays.length}, hitDays=${hitDays.length}, totalItems=${allItems.length}`,
    );

    return {
      month: monthStr,
      tenantId,
      days: hitDays,
      items: allItems,
    };
  }

  /**
   * 月別プレビューで選択された行だけまとめて送る
   * - monthStr: "YYYY-MM"
   * - itemIds: previewForMonth が返した items の id 配列
   */
  async sendBulkForMonth(
    user: AuthPayload,
    monthStr: string,
    itemIds: number[],
    tenantIdFromQuery?: number,
  ) {
    const tenantId = this.ensureTenant(user, tenantIdFromQuery);

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      this.logger.log(
        `sendBulkForMonth: tenantId=${tenantId}, month=${monthStr}, itemIds が空なので何もしません`,
      );
      return {
        month: monthStr,
        tenantId,
        totalSelected: 0,
        sentCount: 0,
        sent: false,
      };
    }

    // 最新の previewForMonth から items を取り直して、その中から id で絞る
    const monthPreview = (await this.previewForMonth(
      user,
      monthStr,
      tenantIdFromQuery,
    )) as any;

    const itemMap = new Map<number, any>();
    for (const item of monthPreview.items ?? []) {
      itemMap.set(item.id, item);
    }

    const selectedItems: any[] = [];
    for (const id of itemIds) {
      const hit = itemMap.get(id);
      if (hit) {
        selectedItems.push(hit);
      }
    }

    this.logger.log(
      `sendBulkForMonth: tenantId=${tenantId}, month=${monthStr}, selected=${selectedItems.length}/${itemIds.length}`,
    );

    // DEVELOPER ロールはプレビューのみ（実送信なし）
    if (user.role === 'DEVELOPER') {
      this.logger.log('sendBulkForMonth: DEVELOPER ロールなので送信はスキップ');
      return {
        month: monthStr,
        tenantId,
        totalSelected: selectedItems.length,
        sentCount: 0,
        sent: false,
      };
    }

    let sentCount = 0;

    for (const item of selectedItems) {
      const lineUid = item.lineUid as string | null;
      const message = item.messageText as string;

      if (!lineUid) {
        this.logger.warn(
          `sendBulkForMonth: lineUid が無いのでスキップ date=${item.date}, customer=${item.customerName}`,
        );
        continue;
      }

      try {
        await this.lineService.sendText(lineUid, message);
        sentCount++;
      } catch (e: any) {
        this.logger.error(
          `sendBulkForMonth: LINE送信失敗 lineUid=${lineUid}, error=${
            e?.message ?? e
          }`,
        );
        // 必要なら throw してフロントに失敗を返す
      }
    }

    this.logger.log(
      `sendBulkForMonth: 送信完了 tenantId=${tenantId}, month=${monthStr}, sentCount=${sentCount}`,
    );

    return {
      month: monthStr,
      tenantId,
      totalSelected: selectedItems.length,
      sentCount,
      sent: true,
    };
  }

  /**
   * 実際に送信まで行う
   * /reminders/run から呼ばれる想定
   */
  async sendForDate(
    user: AuthPayload,
    baseDateStr: string,
    tenantIdFromQuery?: number,
  ) {
    const tenantId = this.ensureTenant(user, tenantIdFromQuery);

    this.logger.log(
      `sendForDate: user.role=${user.role}, tenantId=${tenantId}, baseDate=${baseDateStr}`,
    );

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

    this.logger.log(
      `sendForDate: totalCount=${totalCount} (birthday=${preview.birthdayTargets.length}, shaken2m=${preview.shakenTwoMonths.length}, shaken1w=${preview.shakenOneWeek.length}, inspection1m=${preview.inspectionOneMonth.length}, custom=${preview.custom.length})`,
    );

    // ★ DEVELOPER からはプレビューのみ（送信しない仕様にしたいならここで止める）
    //   送信もできてほしいなら、この if ブロックを削除してOK
    if (user.role === 'DEVELOPER') {
      this.logger.log('sendForDate: DEVELOPER ロールなので送信はスキップ');
      return {
        ...preview,
        totalCount,
        sent: false,
      };
    }

    // 実際の送信処理：preview 内の lineUid / messageText をそのまま使う
    const allTargets = [
      ...preview.birthdayTargets,
      ...preview.shakenTwoMonths,
      ...preview.shakenOneWeek,
      ...preview.inspectionOneMonth,
      ...preview.custom,
    ];

    for (const t of allTargets) {
      const lineUid: string | null =
        t.lineUid ?? t.lineUserId ?? t.uid ?? null;
      const message: string | undefined = t.messageText;

      if (!lineUid || !message) {
        continue;
      }

      try {
        await this.lineService.sendText(lineUid, message);
      } catch (e: any) {
        this.logger.error(
          `sendForDate: LINE送信失敗 lineUid=${lineUid}, error=${e?.message ?? e}`,
        );
        // 必要ならここで throw してフロントに「失敗」を返しても良い
      }
    }

    this.logger.log(
      `sendForDate: LINE送信処理完了 tenantId=${tenantId}, totalTargets=${allTargets.length}`,
    );

    return {
      ...preview,
      totalCount,
      sent: true,
    };
  }
}
