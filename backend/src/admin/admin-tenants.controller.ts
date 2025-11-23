// backend/src/admin/admin-tenants.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// 新規作成用 DTO（email / plan は Prisma 側に合わせて必須）
type CreateTenantDto = {
  name: string;
  email: string;
  plan: string;
  isActive?: boolean;
  validUntil?: string | null; // "2025-12-31" などの文字列

   // ★ 契約者情報（任意）
  companyName?: string | null;
  companyAddress1?: string | null;
  companyAddress2?: string | null;
  representativeName?: string | null;
  contactPhone?: string | null;
  contactMobile?: string | null;

};

// 更新用 DTO（全部任意。来たものだけ反映）
type UpdateTenantDto = {
  name?: string;
  email?: string;
  plan?: string;
  isActive?: boolean;
  validUntil?: string | null;

  // ★ こっちにも同じプロパティを定義する
  companyName?: string | null;
  companyAddress1?: string | null;
  companyAddress2?: string | null;
  representativeName?: string | null;
  contactPhone?: string | null;
  contactMobile?: string | null;
};

@Controller('admin/tenants')
export class AdminTenantsController {
  constructor(private readonly prisma: PrismaService) {}

  // 既存：一覧（overview）
  @Get('overview')
  async getOverview() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { id: 'asc' },
      include: {
        _count: {
          select: {
            customers: true,
            cars: true,
            bookings: true,
          },
        },
      },
    });

    return tenants.map((t: any) => ({
      id: t.id,
      name: t.name,
      email: t.email ?? null,
      plan: t.plan ?? null,
      isActive: t.isActive ?? true,
      validUntil: t.validUntil ?? null,
      customersCount: t._count?.customers ?? 0,
      carsCount: t._count?.cars ?? 0,
      bookingsCount: t._count?.bookings ?? 0,

      // ★ 契約者情報（一覧で使うかどうかはフロント次第）
      companyName: t.companyName ?? null,
      companyAddress1: t.companyAddress1 ?? null,
      companyAddress2: t.companyAddress2 ?? null,
      representativeName: t.representativeName ?? null,
      contactPhone: t.contactPhone ?? null,
      contactMobile: t.contactMobile ?? null,

    }));
  }

    // ★ 編集用：単一テナント取得
  @Get(':id')
  async getTenant(@Param('id') id: string) {
    const tenantId = Number(id);
    if (Number.isNaN(tenantId)) {
      throw new BadRequestException('ID が不正です');
    }

    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            customers: true,
            cars: true,
            bookings: true,
          },
        },
      },
    });

    if (!t) {
      throw new NotFoundException('テナントが見つかりません');
    }

    // overview と同じ形で1件だけ返す
    return {
      id: t.id,
      name: t.name,
      email: t.email ?? null,
      plan: t.plan ?? null,
      isActive: t.isActive ?? true,
      validUntil: t.validUntil ?? null,
      customersCount: t._count?.customers ?? 0,
      carsCount: t._count?.cars ?? 0,
      bookingsCount: t._count?.bookings ?? 0,

            // ★ 契約者情報
      companyName: t.companyName ?? null,
      companyAddress1: t.companyAddress1 ?? null,
      companyAddress2: t.companyAddress2 ?? null,
      representativeName: t.representativeName ?? null,
      contactPhone: t.contactPhone ?? null,
      contactMobile: t.contactMobile ?? null,

    };
  }


  // 既存：新規作成
  @Post()
  async createTenant(@Body() body: CreateTenantDto) {
    if (!body.name?.trim()) {
      throw new BadRequestException('テナント名は必須です');
    }
    if (!body.email?.trim()) {
      throw new BadRequestException('メールアドレスは必須です');
    }
    if (!body.plan?.trim()) {
      throw new BadRequestException('プランは必須です');
    }

    const validUntil =
      body.validUntil && body.validUntil.trim()
        ? new Date(body.validUntil)
        : null;

    if (validUntil && Number.isNaN(validUntil.getTime())) {
      throw new BadRequestException('validUntil の日付形式が不正です');
    }

    const data: Prisma.TenantCreateInput = {
      name: body.name.trim(),
      email: body.email.trim(),
      plan: body.plan.trim(),
      isActive: body.isActive ?? true,
      validUntil,

      // ★ 契約者情報（空文字は null に寄せる）
      companyName: body.companyName?.trim() || null,
      companyAddress1: body.companyAddress1?.trim() || null,
      companyAddress2: body.companyAddress2?.trim() || null,
      representativeName: body.representativeName?.trim() || null,
      contactPhone: body.contactPhone?.trim() || null,
      contactMobile: body.contactMobile?.trim() || null,

    };

    const tenant = await this.prisma.tenant.create({ data });

    return {
      id: tenant.id,
      name: tenant.name,
      email: tenant.email ?? null,
      plan: tenant.plan ?? null,
      isActive: tenant.isActive ?? true,
      validUntil: tenant.validUntil ?? null,
      customersCount: 0,
      carsCount: 0,
      bookingsCount: 0,

      companyName: tenant.companyName ?? null,
      companyAddress1: tenant.companyAddress1 ?? null,
      companyAddress2: tenant.companyAddress2 ?? null,
      representativeName: tenant.representativeName ?? null,
      contactPhone: tenant.contactPhone ?? null,
      contactMobile: tenant.contactMobile ?? null,
    };
  }

  // ★追加：既存テナントの編集
  @Patch(':id')
  async updateTenant(
    @Param('id') id: string,
    @Body() body: UpdateTenantDto,
  ) {
    const tenantId = Number(id);
    if (Number.isNaN(tenantId)) {
      throw new BadRequestException('ID が不正です');
    }

    const data: Prisma.TenantUpdateInput = {};

    if (body.name && body.name.trim()) {
      data.name = body.name.trim();
    }

    if (body.email && body.email.trim()) {
      data.email = body.email.trim();
    }

    if (body.plan && body.plan.trim()) {
      data.plan = body.plan.trim();
    }

    if (typeof body.isActive === 'boolean') {
      data.isActive = body.isActive;
    }

    // validUntil が undefined でなければ、「更新対象」として扱う
    if (body.validUntil !== undefined) {
      if (!body.validUntil) {
        // 空文字 or null → null にクリア
        data.validUntil = null;
      } else {
        const v = new Date(body.validUntil);
        if (Number.isNaN(v.getTime())) {
          throw new BadRequestException('validUntil の日付形式が不正です');
        }
        data.validUntil = v;
      }
    }

    // ★ 契約者情報の更新（undefined の場合は触らない／null or "" でクリア）
    if (body.companyName !== undefined) {
      data.companyName = body.companyName?.trim() || null;
    }
    if (body.companyAddress1 !== undefined) {
      data.companyAddress1 = body.companyAddress1?.trim() || null;
    }
    if (body.companyAddress2 !== undefined) {
      data.companyAddress2 = body.companyAddress2?.trim() || null;
    }
    if (body.representativeName !== undefined) {
      data.representativeName = body.representativeName?.trim() || null;
    }
    if (body.contactPhone !== undefined) {
      data.contactPhone = body.contactPhone?.trim() || null;
    }
    if (body.contactMobile !== undefined) {
      data.contactMobile = body.contactMobile?.trim() || null;
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });

    return {
      id: tenant.id,
      name: tenant.name,
      email: tenant.email ?? null,
      plan: tenant.plan ?? null,
      isActive: tenant.isActive ?? true,
      validUntil: tenant.validUntil ?? null,
      // カウントはここでは取っていないので 0 固定
      customersCount: 0,
      carsCount: 0,
      bookingsCount: 0,

      companyName: tenant.companyName ?? null,
      companyAddress1: tenant.companyAddress1 ?? null,
      companyAddress2: tenant.companyAddress2 ?? null,
      representativeName: tenant.representativeName ?? null,
      contactPhone: tenant.contactPhone ?? null,
      contactMobile: tenant.contactMobile ?? null,
    };
  }

  // ★追加：既存テナントの削除
  @Delete(':id')
  async deleteTenant(@Param('id') id: string) {
    const tenantId = Number(id);
    if (Number.isNaN(tenantId)) {
      throw new BadRequestException('ID が不正です');
    }

    const tenant = await this.prisma.tenant.delete({
      where: { id: tenantId },
    });

    // とりあえず「削除したテナント情報」を軽く返す
    return {
      id: tenant.id,
      name: tenant.name,
      email: tenant.email ?? null,
      plan: tenant.plan ?? null,
    };
  }
}
