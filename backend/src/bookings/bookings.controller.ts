// backend/src/bookings/bookings.controller.ts
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { BookingsService, BookingStatus } from './bookings.service'; // ← ここポイント
import { JwtAuthGuard } from '../jwt.guard';
import type { AuthPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  private getUser(req: Request): AuthPayload {
    return (req as any).authUser as AuthPayload;
  }

  /**
   * GET /bookings
   * 自テナントの予約一覧
   */
  @Get()
  async list(@Req() req: Request) {
    const user = this.getUser(req);
    return this.bookingsService.listBookings(user);
  }

  /**
   * POST /bookings
   * 管理画面からの新規予約作成
   */
  @Post()
  async create(
    @Req() req: Request,
    @Body()
    body: {
      customerId: number;
      carId: number;
      bookingDate: string; // "2025-11-16" or ISO
      timeSlot?: string;
      note?: string;
    },
  ) {
    const user = this.getUser(req);

    const date = new Date(body.bookingDate);
    if (Number.isNaN(date.getTime())) {
      throw new Error('bookingDate の形式が不正です');
    }

    return this.bookingsService.createBooking(user, {
      customerId: body.customerId,
      carId: body.carId,
      bookingDate: date,
      timeSlot: body.timeSlot,
      note: body.note,
    });
  }

  /**
   * PATCH /bookings/:id/status
   * 予約ステータス変更
   */
  @Patch(':id/status')
  async updateStatus(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      status: BookingStatus;
    },
  ) {
    const user = this.getUser(req);
    return this.bookingsService.updateStatus(user, id, body.status);
  }
}
