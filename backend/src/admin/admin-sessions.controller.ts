// backend/src/admin/admin-sessions.controller.ts
import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/sessions')
@UseGuards(JwtAuthGuard)
export class AdminSessionsController {
  constructor(private readonly prisma: PrismaService) {}

  private requireDeveloper(req: Request) {
    const user = (req as any).authUser;
    if (!user || user.role !== 'DEVELOPER') {
      throw new ForbiddenException('DEVELOPER のみアクセスできます。');
    }
  }

  /** アクティブセッション一覧 */
  @Get()
  async listActiveSessions(@Req() req: Request) {
    this.requireDeveloper(req);

    const sessions = await this.prisma.userSession.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            tenantId: true,
            tenant: { select: { id: true, name: true, plan: true } },
          },
        },
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      userEmail: s.user.email,
      userName: s.user.name,
      userRole: s.user.role,
      tenantId: s.user.tenantId,
      tenantName: s.user.tenant?.name ?? null,
      tenantPlan: s.user.tenant?.plan ?? null,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      // sessionToken は秘匿（末尾6文字のみ）
      tokenSuffix: s.sessionToken ? `...${s.sessionToken.slice(-6)}` : null,
    }));
  }

  /** ユーザー単位で全セッションを強制ログアウト */
  @Delete('user/:userId')
  async revokeUserSessions(
    @Req() req: Request,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    this.requireDeveloper(req);

    const result = await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { revoked: result.count };
  }

  /** セッション単体を強制ログアウト */
  @Delete(':sessionId')
  async revokeSession(
    @Req() req: Request,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    this.requireDeveloper(req);

    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { ok: true };
  }
}
