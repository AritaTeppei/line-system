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
    /**
   * トークン＋入力情報から顧客を作成 or 更新
   * - まず lineUid で既存顧客がいないか確認
   * - いなければ「tenantId + mobilePhone」で既存顧客を探してマージ
   * - どちらも無ければ新規作成
   */
  async completeRegister(
    token: string,
    data: {
      lastName: string;
      firstName: string;
      postalCode?: string;
      address1?: string;
      address2?: string;
      mobilePhone?: string;
    },
  ) {
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
      let customer: any = null;

      // 1. まず「この UID で既に顧客がいるか」を確認
      const existingByUid = await this.prisma.customer.findFirst({
        where: { tenantId, lineUid },
      });

      if (existingByUid) {
        // → その顧客の情報を更新（従来の動き）
        customer = await this.prisma.customer.update({
          where: { id: existingByUid.id },
          data: {
            lastName: data.lastName,
            firstName: data.firstName,
            postalCode: data.postalCode,
            address1: data.address1,
            address2: data.address2,
            mobilePhone: data.mobilePhone,
          },
        });
      } else if (data.mobilePhone) {
        // 2. UID では見つからなかった場合、
        //    「tenantId + mobilePhone」で既存顧客を探してマージ
        const existingByPhone = await this.prisma.customer.findFirst({
          where: {
            tenantId,
            mobilePhone: data.mobilePhone,
          },
        });

        if (existingByPhone) {
          customer = await this.prisma.customer.update({
            where: { id: existingByPhone.id },
            data: {
              lastName: data.lastName,
              firstName: data.firstName,
              postalCode: data.postalCode,
              address1: data.address1,
              address2: data.address2,
              mobilePhone: data.mobilePhone,
              // ★ ここで LINE UID を紐づける
              lineUid,
            },
          });
        }
      }

      // 3. UID でも電話番号でも既存が見つからなかった場合 → 新規作成
      if (!customer) {
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

      // 4. トークンを使用済みにする
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
