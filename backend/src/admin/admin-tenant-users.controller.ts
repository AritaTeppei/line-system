// backend/src/admin/admin-tenant-users.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

// ★ Request / UnauthorizedException はもう使わないので import しない

type TenantUserListItem = {
  id: number;
  email: string;
  name: string | null;
  role: UserRole;
  phone: string | null;
};

type CreateTenantUserDto = {
  email: string;
  name?: string | null;
  phone?: string | null;
  role: 'MANAGER' | 'CLIENT';
  initialPassword: string;
};

type ResetPasswordDto = {
  initialPassword: string;
};

@Controller('admin/tenants')
export class AdminTenantUsersController {
  constructor(private readonly prisma: PrismaService) {}

  // ★ ensureDeveloper は削除

  /**
   * テナント配下の MANAGER / CLIENT ユーザー一覧
   * GET /admin/tenants/:tenantId/users
   */
  @Get(':tenantId/users')
  async listTenantUsers(@Param('tenantId') tenantIdParam: string) {
    const tenantId = Number(tenantIdParam);
    if (Number.isNaN(tenantId)) {
      throw new BadRequestException('tenantId が不正です');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('テナントが見つかりません');
    }

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: {
          in: [UserRole.MANAGER, UserRole.CLIENT],
        },
      },
      orderBy: { id: 'asc' },
    });

    const result: TenantUserListItem[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      phone: (u as any).phone ?? null,
    }));

    return result;
  }

  /**
   * テナントに MANAGER / CLIENT を新規作成
   * POST /admin/tenants/:tenantId/users
   */
  @Post(':tenantId/users')
  async createTenantUser(
    @Param('tenantId') tenantIdParam: string,
    @Body() body: CreateTenantUserDto,
  ) {
    const tenantId = Number(tenantIdParam);
    if (Number.isNaN(tenantId)) {
      throw new BadRequestException('tenantId が不正です');
    }

    if (!body.email?.trim()) {
      throw new BadRequestException('メールアドレスは必須です');
    }
    if (!body.initialPassword?.trim()) {
      throw new BadRequestException('初期パスワードは必須です');
    }
    if (body.role !== 'MANAGER' && body.role !== 'CLIENT') {
      throw new BadRequestException(
        'role は MANAGER または CLIENT を指定してください',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('テナントが見つかりません');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: body.email.trim() },
    });
    if (existing) {
      throw new BadRequestException(
        'すでに同じメールアドレスのユーザーが存在します',
      );
    }

    const passwordHash = await bcrypt.hash(body.initialPassword, 10);

    const created = await this.prisma.user.create({
      data: {
        email: body.email.trim(),
        // ★ Prisma の User モデルの password フィールドに、ハッシュ済み文字列をセット
        password: passwordHash,
        name: body.name?.trim() || null,
        role: body.role,
        tenantId,
        ...(body.phone ? { phone: body.phone.trim() } : {}),
      },
    });

    const result: TenantUserListItem = {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      phone: (created as any).phone ?? null,
    };
    return result;
  }

  /**
   * テナント配下ユーザーの初期パスワードをリセット
   */
  @Patch(':tenantId/users/:userId/reset-password')
  async resetTenantUserPassword(
    @Param('tenantId') tenantIdParam: string,
    @Param('userId') userIdParam: string,
    @Body() body: ResetPasswordDto,
  ) {
    const tenantId = Number(tenantIdParam);
    const userId = Number(userIdParam);
    if (Number.isNaN(tenantId) || Number.isNaN(userId)) {
      throw new BadRequestException('ID が不正です');
    }

    if (!body.initialPassword?.trim()) {
      throw new BadRequestException('初期パスワードは必須です');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException('ユーザーが見つかりません');
    }
    if (user.role !== UserRole.MANAGER && user.role !== UserRole.CLIENT) {
      throw new BadRequestException(
        'DEVELOPER ユーザーのパスワードはここからは変更できません',
      );
    }

    const passwordHash = await bcrypt.hash(body.initialPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
      } as any,
    });

    return { success: true };
  }

  // ★ テナント配下ユーザーの削除
  // ★ テナント配下ユーザーの削除
  @Delete(':tenantId/users/:userId')
  async deleteUser(
    @Param('tenantId') tenantIdParam: string,
    @Param('userId') userIdParam: string,
  ) {
    const tenantId = Number(tenantIdParam);
    const userId = Number(userIdParam);

    if (Number.isNaN(tenantId) || Number.isNaN(userId)) {
      throw new BadRequestException('tenantId / userId が不正です');
    }

    // 対象ユーザーが存在するか＆このテナント配下かをチェック
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    // フロントは success を見てトースト表示
    return { success: true };
  }

  // ★ 追加：テナント単位で customers / cars / bookings / reminders logs をリセット
  @Delete(':id/reset')
  async resetTenantData(@Param('id') id: string) {
    const tenantId = Number(id);
    if (Number.isNaN(tenantId)) {
      throw new BadRequestException('ID が不正です');
    }

    // 対象テナントの存在チェック
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('テナントが存在しません');
    }

    // まとめて削除（トランザクション）
    await this.prisma.$transaction(async (tx) => {
      // 1. リマインド送信ログ
      await tx.reminderSentLog.deleteMany({
        where: { tenantId },
      });

      // 2. 予約
      await tx.booking.deleteMany({
        where: { tenantId },
      });

      // 3. 車両
      await tx.car.deleteMany({
        where: { tenantId },
      });

      // 4. 顧客
      await tx.customer.deleteMany({
        where: { tenantId },
      });
    });

    return {
      success: true,
      tenantId,
      message: '指定テナントのデータをリセットしました',
    };
  }
}
