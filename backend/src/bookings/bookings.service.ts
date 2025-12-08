// backend/src/bookings/bookings.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload } from '../auth/auth.service';
import { LineService } from '../line/line.service';

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELED = 'CANCELED',
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineService: LineService,
  ) {}

  /**
   * 同じ車両(carId)が基準日 ±30日以内に予約されていないかチェック
   * CANCELED 以外が 1 件でもあれば BadRequestException
   */
  private async ensureNoDuplicateWithin1Month(params: {
    tenantId: number;
    carId: number;
    bookingDate: Date; // ★ ここは「ちゃんと Date にしたもの」が渡ってくる前提
  }): Promise<void> {
    const { tenantId, carId, bookingDate } = params;

    const base = new Date(bookingDate);
    const from = new Date(base);
    from.setDate(from.getDate() - 30);
    const to = new Date(base);
    to.setDate(to.getDate() + 30);

    const exist = await this.prisma.booking.findFirst({
      where: {
        tenantId,
        carId,
        bookingDate: {
          gte: from,
          lte: to,
        },
        status: {
          not: BookingStatus.CANCELED,
        },
      },
    });

    if (exist) {
      throw new BadRequestException(
        'このお車は1か月以内に既に予約が登録されています。',
      );
    }
  }

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
   * フロントからは bookingDate: "YYYY-MM-DD" が送られてくる想定
   */
  async createBooking(
    user: AuthPayload,
    params: {
      customerId: number;
      carId: number;
      bookingDate: string | Date; // ★ string でも Date でもOKにする
      timeSlot?: string;
      note?: string;
    },
  ) {
    const tenantId = this.ensureTenant(user);
    const prisma = this.prisma as any;

    // まず bookingDate を Date 型に変換しておく（string / Date 両対応）
const raw = params.bookingDate;
const bookingDate =
  raw instanceof Date ? raw : new Date(raw);

if (Number.isNaN(bookingDate.getTime())) {
  throw new BadRequestException(
    'bookingDate の形式が不正です。（YYYY-MM-DD 形式で送信してください）',
  );
}


    // 顧客チェック
    const customer = await prisma.customer.findFirst({
      where: { id: params.customerId, tenantId },
    });
    if (!customer) {
      throw new Error(
        '指定された顧客が見つからないか、他テナントのデータです',
      );
    }

    // 車両チェック
    const car = await prisma.car.findFirst({
      where: { id: params.carId, tenantId },
    });
    if (!car) {
      throw new Error(
        '指定された車両が見つからないか、他テナントのデータです',
      );
    }

    // ★ 1か月以内の重複予約チェック
    await this.ensureNoDuplicateWithin1Month({
      tenantId,
      carId: car.id,
      bookingDate, // ここで Date 渡す
    });

    return prisma.booking.create({
      data: {
        tenantId,
        customerId: customer.id,
        carId: car.id,
        bookingDate, // Prisma 的には DateTime として保存される
        timeSlot: params.timeSlot,
        note: params.note,
        status: BookingStatus.PENDING,
        source: 'TENANT_MANUAL',
      },
    });
  }

  /**
   * 予約ステータスの変更（CONFIRMED / CANCELED など）
   * ※ここでは「ステータス変更のみ」。LINE送信は sendConfirmationLine で行う。
   */
  async updateStatus(
    user: AuthPayload,
    bookingId: number,
    status: BookingStatus,
  ) {
    const prisma = this.prisma as any;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        car: true,
      },
    });

    if (!booking) {
      throw new Error('予約が見つかりません。');
    }

    if (user.role !== 'DEVELOPER' && booking.tenantId !== user.tenantId) {
      throw new Error('他テナントの予約は操作できません。');
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status,
      },
      include: {
        customer: true,
        car: true,
      },
    });

    return updated;
  }

  /**
   * 予約の日程（日時）を変更する
   * - ADMIN / TENANT_MANUAL 由来の予約だけ変更可
   */
  async updateBooking(
    user: AuthPayload,
    bookingId: number,
    params: {
      bookingDate?: string; // "YYYY-MM-DD"
      timeSlot?: string;
      note?: string;
      carId?: number;  
    },
  ) {
    const prisma = this.prisma as any;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        car: true,
      },
    });

    if (!booking) {
      throw new BadRequestException('予約が見つかりません。');
    }

    if (
      user.role !== 'DEVELOPER' &&
      booking.tenantId !== user.tenantId
    ) {
      throw new BadRequestException(
        '他テナントの予約は変更できません。',
      );
    }

    // 受付経路チェック（ADMIN / TENANT_MANUAL だけ許可）
    if (
      booking.source !== 'ADMIN' &&
      booking.source !== 'TENANT_MANUAL'
    ) {
      throw new BadRequestException(
        'この予約の日時は変更できない種別です。',
      );
    }

    const data: any = {};

    if (params.bookingDate) {
      const d = new Date(params.bookingDate);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('bookingDate の形式が不正です。');
      }
      data.bookingDate = d;
    }

    if (params.timeSlot) {
      data.timeSlot = params.timeSlot;
    }

    if (typeof params.note === 'string') {
      data.note = params.note;
    }

    // ★ 追加：車両を選び直した場合はcarIdを更新する
    if (typeof params.carId === 'number') {
      // この予約が属しているテナントの車だけ許可
      const car = await prisma.car.findFirst({
        where: {
          id: params.carId,
          tenantId: booking.tenantId,
        },
      });

      if (!car) {
        throw new BadRequestException(
          '指定された車両が見つからないか、他テナントのデータです。',
        );
      }

      data.carId = car.id;
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data,
      include: {
        customer: true,
        car: true,
      },
    });

    return updated;
  }

  /**
   * デフォルトの「ご予約確定」メッセージを組み立てる
   */
  private buildDefaultConfirmationMessage(booking: any): string {
    const customerName = `${booking.customer?.lastName ?? ''} ${
      booking.customer?.firstName ?? ''
    }`.trim();

    const dateStr = booking.bookingDate
      ? booking.bookingDate.toISOString().slice(0, 10).replace(/-/g, '/')
      : '';

    const carName = booking.car?.carName ?? '';
    const plate = booking.car?.registrationNumber ?? '';

    const carLine =
      carName && plate
        ? `対象のお車：${carName}（${plate}）`
        : carName
        ? `対象のお車：${carName}`
        : '';

    let timeLabel = '';
    switch ((booking.timeSlot ?? '').toUpperCase()) {
      case 'MORNING':
        timeLabel = '午前';
        break;
      case 'AFTERNOON':
        timeLabel = '午後';
        break;
      case 'EVENING':
        timeLabel = '夕方';
        break;
    }

    const timeLine = timeLabel
      ? `ご希望時間帯：${timeLabel}（${booking.timeSlot}）`
      : booking.timeSlot
      ? `ご希望時間帯：${booking.timeSlot}`
      : '';

    const lines = [
      customerName ? `${customerName} 様` : '',
      '',
      'このたびはご予約ありがとうございます。',
      '以下の内容でご予約を承りました。',
      '',
      dateStr ? `ご予約日：${dateStr}` : '',
      timeLine,
      carLine,
      '',
      '内容に変更がある場合は、お手数ですが店舗までご連絡ください。',
    ].filter(Boolean);

    return lines.join('\n');
  }

  /**
   * 「確定LINEを送る」専用メソッド
   * - 予約ステータスが CONFIRMED のときだけ送信
   * - 任意メッセージがあればそれを使う
   * - 送信日時＆本文を booking に保存
   */
  async sendConfirmationLine(
    user: AuthPayload,
    bookingId: number,
    customMessage?: string,
  ) {
    const prisma = this.prisma as any;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        car: true,
      },
    });

    if (!booking) {
      throw new BadRequestException('予約が見つかりません。');
    }

    if (
      user.role !== 'DEVELOPER' &&
      booking.tenantId !== user.tenantId
    ) {
      throw new BadRequestException(
        '他テナントの予約には確定メッセージを送信できません。',
      );
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'ステータスが「確定」の予約にのみメッセージを送信できます。',
      );
    }

    const lineUid = booking.customer?.lineUid;
    if (!lineUid) {
      throw new BadRequestException(
        'この予約にはLINE IDが登録されていません。',
      );
    }

    const message =
      customMessage && customMessage.trim().length > 0
        ? customMessage.trim()
        : this.buildDefaultConfirmationMessage(booking);

    try {
      await this.lineService.sendText(lineUid, message);
    } catch (e: any) {
      console.error(
        `sendConfirmationLine: LINE送信失敗 bookingId=${bookingId}, error=${
          e?.message ?? e
        }`,
      );
      throw new BadRequestException(
        'LINEメッセージの送信に失敗しました。時間をおいて再度お試しください。',
      );
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        confirmationLineSentAt: new Date(),
        confirmationLineMessage: message,
      },
      include: {
        customer: true,
        car: true,
      },
    });

    return updated;
  }

  async deleteBooking(me: AuthPayload, bookingId: number) {
    const tenantId = this.ensureTenant(me);

    // 自分のテナントの予約のみ削除OK
    const existing = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException('予約が見つかりません');
    }

    await this.prisma.booking.delete({
      where: { id: bookingId },
    });

    return { success: true };
  }
}
