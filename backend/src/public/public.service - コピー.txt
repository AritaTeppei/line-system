// src/public/public.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * トークンの事前確認用（有効かどうか）
   */
  async previewRegisterToken(token: string) {
    const record = await this.prisma.customerRegisterToken.findUnique({
      where: { token },
      include: {
        tenant: true,
      },
    });

    if (!record) {
      throw new NotFoundException('このリンクは無効です');
    }

    if (record.usedAt) {
      throw new BadRequestException('このリンクはすでに使用済みです');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('このリンクは有効期限が切れています');
    }

    return {
      tenantName: record.tenant.name,
      lineUidMasked:
        record.lineUid.slice(0, 4) + '****' + record.lineUid.slice(-4),
    };
  }

  /**
   * トークン＋入力情報から顧客を作成 or 更新
   */
  async completeRegister(token: string, data: {
    lastName: string;
    firstName: string;
    postalCode?: string;
    address1?: string;
    address2?: string;
    mobilePhone?: string;
  }) {
    const record = await this.prisma.customerRegisterToken.findUnique({
      where: { token },
    });

    if (!record) {
      throw new NotFoundException('このリンクは無効です');
    }
    if (record.usedAt) {
      throw new BadRequestException('このリンクはすでに使用済みです');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('このリンクは有効期限が切れています');
    }

    const tenantId = record.tenantId;
    const lineUid = record.lineUid;

    try {
      // すでにこのUIDで顧客がいれば更新、いなければ新規作成
      const existing = await this.prisma.customer.findFirst({
        where: { tenantId, lineUid },
      });

      let customer;
      if (existing) {
        customer = await this.prisma.customer.update({
          where: { id: existing.id },
          data: {
            lastName: data.lastName,
            firstName: data.firstName,
            postalCode: data.postalCode,
            address1: data.address1,
            address2: data.address2,
            mobilePhone: data.mobilePhone,
          },
        });
      } else {
        customer = await this.prisma.customer.create({
          data: {
            tenantId,
            lineUid,
            lastName: data.lastName,
            firstName: data.firstName,
            postalCode: data.postalCode,
            address1: data.address1,
            address2: data.address2,
            mobilePhone: data.mobilePhone,
          },
        });
      }

      // トークンを使用済みにする
      await this.prisma.customerRegisterToken.update({
        where: { token },
        data: { usedAt: new Date() },
      });

      return customer;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = (e.meta?.target as string[]) ?? [];
        if (target.includes('mobilePhone')) {
          throw new BadRequestException(
            'この携帯番号は既に登録されています',
          );
        }
        if (target.includes('lineUid')) {
          throw new BadRequestException(
            'このLINE UIDは既に登録されています',
          );
        }
      }
      throw e;
    }
  }
}
