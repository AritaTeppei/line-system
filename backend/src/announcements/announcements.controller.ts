import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../jwt.guard';

type CreateAnnouncementDto = {
  title: string;
  body: string;
  publishAt: string; // ISO string
  isActive?: boolean;
};

type UpdateAnnouncementDto = Partial<CreateAnnouncementDto>;

@Controller('announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 全認証ユーザー向け: publishAt <= now かつ isActive=true のお知らせを返す
   */
  @Get('active')
  async getActive() {
    return this.prisma.announcement.findMany({
      where: {
        isActive: true,
        publishAt: { lte: new Date() },
      },
      orderBy: { publishAt: 'desc' },
      take: 20,
      select: { id: true, title: true, body: true, publishAt: true, createdAt: true },
    });
  }

  /**
   * 開発者専用: 全お知らせ取得（予定含む）
   */
  @Get()
  async getAll(@Req() req: Request) {
    if ((req as any).authUser?.role !== 'DEVELOPER') throw new ForbiddenException();
    return this.prisma.announcement.findMany({
      orderBy: { publishAt: 'desc' },
    });
  }

  /**
   * 開発者専用: お知らせ作成
   */
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateAnnouncementDto) {
    if ((req as any).authUser?.role !== 'DEVELOPER') throw new ForbiddenException();
    if (!dto.title?.trim()) throw new BadRequestException('タイトルは必須です');
    if (!dto.body?.trim()) throw new BadRequestException('本文は必須です');
    if (!dto.publishAt) throw new BadRequestException('配信日時は必須です');

    return this.prisma.announcement.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        publishAt: new Date(dto.publishAt),
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * 開発者専用: お知らせ更新
   */
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    if ((req as any).authUser?.role !== 'DEVELOPER') throw new ForbiddenException();
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('お知らせが見つかりません');

    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.body !== undefined && { body: dto.body.trim() }),
        ...(dto.publishAt !== undefined && { publishAt: new Date(dto.publishAt) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  /**
   * 開発者専用: お知らせ削除
   */
  @Delete(':id')
  async remove(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    if ((req as any).authUser?.role !== 'DEVELOPER') throw new ForbiddenException();
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('お知らせが見つかりません');
    await this.prisma.announcement.delete({ where: { id } });
    return { deleted: true };
  }
}
