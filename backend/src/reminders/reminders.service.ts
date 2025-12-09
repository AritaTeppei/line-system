// src/reminders/reminders.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload } from '../auth/auth.service';
import { LineService } from '../line/line.service';
import { ReminderMessageType, ReminderCategory, Prisma } from '@prisma/client';
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

  // ------------------------------
  // テンプレート CRUD
  // ------------------------------
  async upsertTemplateForTenant(
    tenantId: number,
    dto: UpsertReminderTemplateDto,
  ) {
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

  async getTemplateForTenantByType(
    tenantId: number,
    type: ReminderMessageType,
  ) {
    return this.prisma.reminderMessageTemplate.findUnique({
      where: {
        tenantId_type: {
          tenantId,
          type,
        },
      },
    });
  }

  // ------------------------------
  // テナント確定ロジック
  // ------------------------------
  private ensureTenant(user: AuthPayload, tenantIdFromQuery?: number): number {
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

  // ------------------------------
  // 共通ユーティリティ
  // ------------------------------
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

  private buildCustomerAddress(customer: any): string | null {
    if (!customer) return null;

    const parts: string[] = [];

    if (customer.zipCode) {
      parts.push(`〒${customer.zipCode}`);
    }
    if (customer.prefecture) {
      parts.push(customer.prefecture);
    }
    if (customer.address1) {
      parts.push(customer.address1);
    }
    if (customer.address2) {
      parts.push(customer.address2);
    }
    if (customer.address3) {
      parts.push(customer.address3);
    }

    if (parts.length === 0) return null;
    return parts.join(' ');
  }

  private buildBookingUrl(args: {
    tenantId: number;
    customerId: number;
    carId: number;
    date: Date;
  }): string {
    const { tenantId, customerId, carId, date } = args;

    const frontendBase =
      process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

    const baseUrl = `${frontendBase.replace(/\/$/, '')}/public/booking`;

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
   * ReminderKind → ログ用 category 文字列
   * Prisma の enum があるなら、ここを合わせればOK
   */
  private toLogCategoryFromKind(kind: ReminderKind): string {
    switch (kind) {
      case 'BIRTHDAY':
        return 'birthday';
      case 'SHAKEN_2M':
        return 'shakenTwoMonths';
      case 'SHAKEN_1W':
        return 'shakenOneWeek';
      case 'INSPECTION_1M':
        return 'inspectionOneMonth';
      case 'CUSTOM':
        return 'custom';
      default:
        return 'custom';
    }
  }

  // ------------------------------
  // テンプレ適用
  // ------------------------------
  private renderTemplateIfExists(
    templateMap: Map<ReminderMessageType, string>,
    params: {
      kind: ReminderKind;
      customerName: string;
      carName?: string;
      registrationNumber?: string;
      mainDate?: string;
      bookingUrl?: string | null;
      daysBefore?: number | null;
    },
    shopName?: string | null,
  ): string | null {
    const {
      kind,
      customerName,
      carName,
      registrationNumber,
      mainDate,
      bookingUrl,
      daysBefore,
    } = params;

    const kindToType: Record<ReminderKind, ReminderMessageType> = {
      BIRTHDAY: ReminderMessageType.BIRTHDAY,
      SHAKEN_2M: ReminderMessageType.SHAKEN_TWO_MONTHS,
      SHAKEN_1W: ReminderMessageType.SHAKEN_ONE_WEEK,
      INSPECTION_1M: ReminderMessageType.INSPECTION_ONE_MONTH,
      CUSTOM: ReminderMessageType.CUSTOM,
    };

    const type = kindToType[kind];
    const templateBody = templateMap.get(type);
    if (!templateBody) return null;

    let text = templateBody;

    text = text.replace(/{{\s*customerName\s*}}/g, customerName ?? '');
    text = text.replace(/\{customerName\}/g, customerName ?? '');

    text = text.replace(/{{\s*carName\s*}}/g, carName ?? '');
    text = text.replace(/\{carName\}/g, carName ?? '');

    text = text.replace(
      /{{\s*registrationNumber\s*}}/g,
      registrationNumber ?? '',
    );
    text = text.replace(/\{registrationNumber\}/g, registrationNumber ?? '');

    text = text.replace(/{{\s*mainDate\s*}}/g, mainDate ?? '');
    text = text.replace(/\{mainDate\}/g, mainDate ?? '');

    text = text.replace(/{{\s*bookingUrl\s*}}/g, bookingUrl ?? '');
    text = text.replace(/\{bookingUrl\}/g, bookingUrl ?? '');

    text = text.replace(
      /{{\s*daysBefore\s*}}/g,
      daysBefore != null ? String(daysBefore) : '',
    );
    text = text.replace(
      /\{daysBefore\}/g,
      daysBefore != null ? String(daysBefore) : '',
    );

    text = text.replace(/{{\s*shopName\s*}}/g, shopName ?? '');
    text = text.replace(/\{shopName\}/g, shopName ?? '');

    return text;
  }

  private buildReminderMessage(params: {
    kind: ReminderKind;
    customerName: string;
    carName?: string;
    registrationNumber?: string;
    mainDate?: string;
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
        : (mainDate ?? '');

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

  // ------------------------------
  // 日別プレビュー
  // ------------------------------
  async previewForDate(
    user: AuthPayload,
    baseDateStr: string,
    tenantIdFromQuery?: number,
  ) {
    const tenantId = this.ensureTenant(user, tenantIdFromQuery);

    const [templates, tenant] = await Promise.all([
      this.getTemplatesForTenant(tenantId),
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
    ]);

    const templateMap = new Map<ReminderMessageType, string>();
    for (const t of templates) {
      if (t.body) {
        templateMap.set(t.type, t.body);
      }
    }
    const shopName = tenant?.name ?? '';

    const date = new Date(baseDateStr);
    if (Number.isNaN(date.getTime())) {
      throw new Error('date の形式が不正です');
    }

    const targetDate = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );

    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        birthday: { not: null },
      },
    });

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

    const birthdayTargets = customers
      .filter((c) => {
        if (!c.birthday) return false;
        const b = c.birthday;
        return (
          b.getUTCMonth() === targetDate.getUTCMonth() &&
          b.getUTCDate() === targetDate.getUTCDate()
        );
      })
      .map((c) => {
        const customerName = `${c.lastName} ${c.firstName}`;

        const messageText =
          this.renderTemplateIfExists(
            templateMap,
            {
              kind: 'BIRTHDAY',
              customerName,
            },
            shopName,
          ) ??
          this.buildReminderMessage({
            kind: 'BIRTHDAY',
            customerName,
          });

        return {
          kind: 'BIRTHDAY' as const,
          customerId: c.id,
          customerName,
          lineUid: (c as any).lineUid ?? null,
          messageText,
          customerPhone: (c as any).mobilePhone ?? null,
          customerAddress: this.buildCustomerAddress(c),
        };
      });

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
        customerPhone: customer.mobilePhone ?? null,
        customerAddress: this.buildCustomerAddress(customer),
      };

      if (car.shakenDate) {
        const shakenDate = car.shakenDate;
        const diff = this.diffInDays(targetDate, shakenDate);
        const shakenDateStr = shakenDate.toISOString().slice(0, 10);

        if (diff === 60) {
          const bookingUrl = this.buildBookingUrl({
            tenantId,
            customerId: customer.id,
            carId: car.id,
            date: shakenDate,
          });

          const messageText =
            this.renderTemplateIfExists(
              templateMap,
              {
                kind: 'SHAKEN_2M',
                customerName: baseInfo.customerName,
                carName: baseInfo.carName,
                registrationNumber: baseInfo.registrationNumber,
                mainDate: shakenDateStr,
                bookingUrl,
                daysBefore: null,
              },
              shopName,
            ) ??
            this.buildReminderMessage({
              kind: 'SHAKEN_2M',
              customerName: baseInfo.customerName,
              carName: baseInfo.carName,
              registrationNumber: baseInfo.registrationNumber,
              mainDate: shakenDateStr,
              bookingUrl,
              daysBefore: null,
            });

          shakenTwoMonths.push({
            ...baseInfo,
            kind: 'SHAKEN_2M' as const,
            shakenDate: shakenDateStr,
            bookingUrl,
            messageText,
          });
        }

        if (diff === 7) {
          const bookingUrl = this.buildBookingUrl({
            tenantId,
            customerId: customer.id,
            carId: car.id,
            date: shakenDate,
          });

          const messageText =
            this.renderTemplateIfExists(
              templateMap,
              {
                kind: 'SHAKEN_1W',
                customerName: baseInfo.customerName,
                carName: baseInfo.carName,
                registrationNumber: baseInfo.registrationNumber,
                mainDate: shakenDateStr,
                bookingUrl,
                daysBefore: null,
              },
              shopName,
            ) ??
            this.buildReminderMessage({
              kind: 'SHAKEN_1W',
              customerName: baseInfo.customerName,
              carName: baseInfo.carName,
              registrationNumber: baseInfo.registrationNumber,
              mainDate: shakenDateStr,
              bookingUrl,
              daysBefore: null,
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

      if (car.inspectionDate) {
        const inspectionDate = car.inspectionDate;
        const diff = this.diffInDays(targetDate, inspectionDate);
        const inspectionDateStr = inspectionDate.toISOString().slice(0, 10);

        if (diff === 30) {
          const bookingUrl = this.buildBookingUrl({
            tenantId,
            customerId: customer.id,
            carId: car.id,
            date: inspectionDate,
          });

          const messageText =
            this.renderTemplateIfExists(
              templateMap,
              {
                kind: 'INSPECTION_1M',
                customerName: baseInfo.customerName,
                carName: baseInfo.carName,
                registrationNumber: baseInfo.registrationNumber,
                mainDate: inspectionDateStr,
                bookingUrl,
                daysBefore: null,
              },
              shopName,
            ) ??
            this.buildReminderMessage({
              kind: 'INSPECTION_1M',
              customerName: baseInfo.customerName,
              carName: baseInfo.carName,
              registrationNumber: baseInfo.registrationNumber,
              mainDate: inspectionDateStr,
              bookingUrl,
              daysBefore: null,
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

      if (car.customReminderDate && car.customDaysBefore != null) {
        const customDate = car.customReminderDate;
        const diff = this.diffInDays(targetDate, customDate);
        const customDateStr = customDate.toISOString().slice(0, 10);

        if (diff === car.customDaysBefore) {
          const bookingUrl = this.buildBookingUrl({
            tenantId,
            customerId: customer.id,
            carId: car.id,
            date: customDate,
          });

          const messageText =
            this.renderTemplateIfExists(
              templateMap,
              {
                kind: 'CUSTOM',
                customerName: baseInfo.customerName,
                carName: baseInfo.carName,
                registrationNumber: baseInfo.registrationNumber,
                mainDate: customDateStr,
                bookingUrl,
                daysBefore: car.customDaysBefore,
              },
              shopName,
            ) ??
            this.buildReminderMessage({
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
      `previewForDate: tenantId=${tenantId}, date=${targetDate
        .toISOString()
        .slice(
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

  // ------------------------------
  // 月別プレビュー
  // ------------------------------
  async previewForMonth(
    user: AuthPayload,
    monthStr: string,
    tenantIdFromQuery?: number,
  ) {
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
      throw new Error('month は YYYY-MM 形式で指定してください');
    }

    const tenantId = this.ensureTenant(user, tenantIdFromQuery);

    const [yStr, mStr] = monthStr.split('-');
    const year = Number(yStr);
    const month = Number(mStr);

    if (!year || !month || month < 1 || month > 12) {
      throw new Error('month の値が不正です');
    }

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const allDays: {
      date: string;
      birthdayCount: number;
      shakenTwoMonthsCount: number;
      shakenOneWeekCount: number;
      inspectionOneMonthCount: number;
      customCount: number;
      totalCount: number;
    }[] = [];

    const allItems: {
      id: number;
      date: string;
      category:
        | 'birthday'
        | 'shakenTwoMonths'
        | 'shakenOneWeek'
        | 'inspectionOneMonth'
        | 'custom';
      customerName: string;
      carName?: string | null;
      plateNumber?: string | null;

      customerId?: number | null;
      carId?: number | null;

      customerPhone?: string | null;
      customerAddress?: string | null;
      shakenDate?: string | null;
      inspectionDate?: string | null;

      lineUid: string | null;
      messageText: string;

      sent?: boolean;
    }[] = [];

    let nextItemId = 1;

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(Date.UTC(year, month - 1, day));
      const dateStr = d.toISOString().slice(0, 10);

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

      for (const t of preview.birthdayTargets as any[]) {
        allItems.push({
          id: nextItemId++,
          date: dateStr,
          category: 'birthday',
          customerName: t.customerName,
          carName: null,
          plateNumber: null,
          customerId: t.customerId ?? null,
          carId: null,
          customerPhone: t.customerPhone ?? null,
          customerAddress: t.customerAddress ?? null,
          shakenDate: null,
          inspectionDate: null,
          lineUid: t.lineUid ?? null,
          messageText: t.messageText,
          sent: false,
        });
      }

      for (const t of preview.shakenTwoMonths) {
        allItems.push({
          id: nextItemId++,
          date: dateStr,
          category: 'shakenTwoMonths',
          customerName: t.customerName,
          carName: t.carName ?? null,
          plateNumber: t.registrationNumber ?? null,
          customerId: t.customerId ?? null,
          carId: t.carId ?? null,
          customerPhone: t.customerPhone ?? null,
          customerAddress: t.customerAddress ?? null,
          shakenDate: t.shakenDate ?? null,
          inspectionDate: t.inspectionDate ?? null,
          lineUid: t.lineUid ?? null,
          messageText: t.messageText,
          sent: false,
        });
      }

      for (const t of preview.shakenOneWeek) {
        allItems.push({
          id: nextItemId++,
          date: dateStr,
          category: 'shakenOneWeek',
          customerName: t.customerName,
          carName: t.carName ?? null,
          plateNumber: t.registrationNumber ?? null,
          customerId: t.customerId ?? null,
          carId: t.carId ?? null,
          customerPhone: t.customerPhone ?? null,
          customerAddress: t.customerAddress ?? null,
          shakenDate: t.shakenDate ?? null,
          inspectionDate: t.inspectionDate ?? null,
          lineUid: t.lineUid ?? null,
          messageText: t.messageText,
          sent: false,
        });
      }

      for (const t of preview.inspectionOneMonth) {
        allItems.push({
          id: nextItemId++,
          date: dateStr,
          category: 'inspectionOneMonth',
          customerName: t.customerName,
          carName: t.carName ?? null,
          plateNumber: t.registrationNumber ?? null,
          customerId: t.customerId ?? null,
          carId: t.carId ?? null,
          customerPhone: t.customerPhone ?? null,
          customerAddress: t.customerAddress ?? null,
          shakenDate: t.shakenDate ?? null,
          inspectionDate: t.inspectionDate ?? null,
          lineUid: t.lineUid ?? null,
          messageText: t.messageText,
          sent: false,
        });
      }

      for (const t of preview.custom) {
        allItems.push({
          id: nextItemId++,
          date: dateStr,
          category: 'custom',
          customerName: t.customerName,
          carName: t.carName ?? null,
          plateNumber: t.registrationNumber ?? null,
          customerId: t.customerId ?? null,
          carId: t.carId ?? null,
          customerPhone: t.customerPhone ?? null,
          customerAddress: t.customerAddress ?? null,
          shakenDate: t.shakenDate ?? null,
          inspectionDate: t.inspectionDate ?? null,
          lineUid: t.lineUid ?? null,
          messageText: t.messageText,
          sent: false,
        });
      }
    }

    // ▼ 送信済みログ取得（重複判定は tenantId + customerId + carId だけ）
    const sentLogs = await this.prisma.reminderSentLog.findMany({
      where: {
        tenantId,
      },
      select: {
        customerId: true,
        carId: true,
      },
    });

    const sentKeySet = new Set<string>();
    for (const log of sentLogs) {
      const key = `${log.customerId ?? ''}|${log.carId ?? ''}`;
      sentKeySet.add(key);
    }

    for (const item of allItems) {
      const key = `${item.customerId ?? ''}|${item.carId ?? ''}`;
      if (sentKeySet.has(key)) {
        item.sent = true;
      }
    }

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

  // ------------------------------
  // 月別一括送信
  // ------------------------------
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

    // DEVELOPER ロールはプレビューのみ（実送信なし & ログも残さない）
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

    // ★ ここで Prisma 用の型を明示
    const logsToCreate: Prisma.ReminderSentLogCreateManyInput[] = [];

    for (const item of selectedItems) {
      const lineUid = item.lineUid as string | null;
      const message = item.messageText as string;

      // ログ用 category（string → enum ReminderCategory に変換）
      let categoryEnum: ReminderCategory;
      switch (item.category as string) {
        case 'birthday':
          categoryEnum = ReminderCategory.birthday;
          break;
        case 'shakenTwoMonths':
          categoryEnum = ReminderCategory.shakenTwoMonths;
          break;
        case 'shakenOneWeek':
          categoryEnum = ReminderCategory.shakenOneWeek;
          break;
        case 'inspectionOneMonth':
          categoryEnum = ReminderCategory.inspectionOneMonth;
          break;
        case 'custom':
          categoryEnum = ReminderCategory.custom;
          break;
        default:
          // 想定外の値は custom 扱いに逃がす
          categoryEnum = ReminderCategory.custom;
          break;
      }

      // 送信ログ（重複は skipDuplicates 側で調整）
      logsToCreate.push({
        tenantId,
        customerId: item.customerId ?? null,
        carId: item.carId ?? null,
        // Prisma 的には string("YYYY-MM-DD") でも OK
        date: new Date(item.date),
        category: categoryEnum,
      });

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

    // ★ ここでまとめてログ保存（型は Prisma.ReminderSentLogCreateManyInput[] なので OK）
    if (logsToCreate.length > 0) {
      await this.prisma.reminderSentLog.createMany({
        data: logsToCreate,
        skipDuplicates: true,
      });
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

  // ------------------------------
  // 指定日一括送信 (/reminders/run)
  // ------------------------------
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

    // ★ ログ用配列（Prisma 型を明示）
    const logsToCreate: Prisma.ReminderSentLogCreateManyInput[] = [];

    // kind → enum ReminderCategory に変換する小さいヘルパー
    const pushLogs = (items: any[], kind: ReminderKind) => {
      let categoryEnum: ReminderCategory;
      switch (kind) {
        case 'BIRTHDAY':
          categoryEnum = ReminderCategory.birthday;
          break;
        case 'SHAKEN_2M':
          categoryEnum = ReminderCategory.shakenTwoMonths;
          break;
        case 'SHAKEN_1W':
          categoryEnum = ReminderCategory.shakenOneWeek;
          break;
        case 'INSPECTION_1M':
          categoryEnum = ReminderCategory.inspectionOneMonth;
          break;
        case 'CUSTOM':
        default:
          categoryEnum = ReminderCategory.custom;
          break;
      }

      for (const t of items) {
        logsToCreate.push({
          tenantId,
          customerId: t.customerId ?? null,
          carId: t.carId ?? null,
          date: new Date(baseDateStr),
          category: categoryEnum,
        });
      }
    };

    // 各グループごとにログを積む
    pushLogs(preview.birthdayTargets as any[], 'BIRTHDAY');
    pushLogs(preview.shakenTwoMonths, 'SHAKEN_2M');
    pushLogs(preview.shakenOneWeek, 'SHAKEN_1W');
    pushLogs(preview.inspectionOneMonth, 'INSPECTION_1M');
    pushLogs(preview.custom, 'CUSTOM');

    // ここから実際の LINE 送信ループ（元の挙動そのまま）
    for (const t of allTargets) {
      const lineUid: string | null = t.lineUid ?? t.lineUserId ?? t.uid ?? null;
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
      }
    }

    // ★ 最後にまとめてログ保存
    if (logsToCreate.length > 0) {
      await this.prisma.reminderSentLog.createMany({
        data: logsToCreate,
        skipDuplicates: true,
      });
    }
  }
}
