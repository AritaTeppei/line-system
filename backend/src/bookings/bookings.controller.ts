// backend/src/bookings/bookings.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Delete,
  Patch,
  Post,
  Req,
  ParseIntPipe, // ★ これを追加
} from '@nestjs/common';
import type { Request } from 'express';
import { BookingsService, BookingStatus } from './bookings.service';
import { AuthService } from '../auth/auth.service';
import type { AuthPayload } from '../auth/auth.service';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(@Req() req: Request) {
    const payload = await this.auth.getPayloadFromRequestWithTenantCheck(req);
    return this.bookingsService.listBookings(payload);
  }

  @Post()
  async create(
    @Req() req: Request,
    @Body()
    body: {
      customerId: number;
      carId: number;
      bookingDate: string; // "YYYY-MM-DD"
      timeSlot?: string;
      note?: string;
    },
  ) {
    const payload = await this.auth.getPayloadFromRequestWithTenantCheck(req);

    const { customerId, carId, bookingDate, timeSlot, note } = body;

    const d = new Date(bookingDate);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('bookingDate の形式が不正です。');
    }

    return this.bookingsService.createBooking(payload, {
      customerId: Number(customerId),
      carId: Number(carId),
      bookingDate: d,
      timeSlot,
      note,
    });
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: Request,
    @Param('id') idParam: string,
    @Body() body: { status: BookingStatus | string },
  ) {
    const payload = await this.auth.getPayloadFromRequestWithTenantCheck(req);

    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('予約IDが不正です。');
    }

    const statusValue =
      typeof body.status === 'string'
        ? (body.status.toUpperCase() as BookingStatus)
        : body.status;

    if (
      ![
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELED,
      ].includes(statusValue)
    ) {
      throw new BadRequestException('ステータスの値が不正です。');
    }

    return this.bookingsService.updateStatus(payload, id, statusValue);
  }

  @Patch(':id')
  async updateBooking(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      bookingDate?: string; // "YYYY-MM-DD"
      timeSlot?: string;
      note?: string;
      carId?: number; // ★ 追加！
    },
  ) {
    const payload = await this.auth.getPayloadFromRequestWithTenantCheck(req);

    return this.bookingsService.updateBooking(payload, id, body);
  }

  /**
   * 確定LINEを送る（任意メッセージも指定可能）
   * POST /bookings/:id/send-confirmation-line
   * body: { message?: string }
   */
  @Post(':id/send-confirmation-line')
  async sendConfirmationLine(
    @Req() req: Request,
    @Param('id') idParam: string,
    @Body() body: { message?: string },
  ) {
    const payload = await this.auth.getPayloadFromRequestWithTenantCheck(req);

    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('予約IDが不正です。');
    }

    return this.bookingsService.sendConfirmationLine(payload, id, body.message);
  }

  @Delete(':id')
  async deleteBooking(
    @Req() req: Request,
    @Param('id', ParseIntPipe) idParam: number,
  ) {
    // ログイン情報（テナント情報つき）を取得
    const payload = await this.auth.getPayloadFromRequestWithTenantCheck(req);

    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('予約IDが不正です。');
    }

    await this.bookingsService.deleteBooking(payload, id);

    // フロント側はレスポンス内容を特に見ていないので、シンプルに success だけ返す
    return { success: true };
  }
}
