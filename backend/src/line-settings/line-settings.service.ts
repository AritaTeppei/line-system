import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLineSettingsDto } from './dto/update-line-settings.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SendLineTestDto } from './dto/send-line-test.dto';

@Injectable()
export class LineSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  async getByTenantId(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { lineSettings: true },
    });

    if (!tenant) {
      throw new NotFoundException('テナントが見つかりません');
    }

    // lineSettings がまだなければ空で返す
    return (
      tenant.lineSettings ?? {
        tenantId,
        channelId: null,
        channelSecret: null,
        accessToken: null,
        webhookUrl: null,
        isActive: false,
      }
    );
  }

  async upsertByTenantId(tenantId: number, dto: UpdateLineSettingsDto) {
    // テナント存在チェック
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('テナントが見つかりません');
    }

    const existing = await this.prisma.lineSettings.findUnique({
      where: { tenantId },
    });

    if (!existing) {
      // 新規作成
      return this.prisma.lineSettings.create({
        data: {
          tenantId,
          ...dto,
        },
      });
    }

    // 更新
    return this.prisma.lineSettings.update({
      where: { tenantId },
      data: {
        ...dto,
      },
    });
  }

  async sendTestMessage(tenantId: number, dto: SendLineTestDto) {
    const settings = await this.prisma.lineSettings.findUnique({
      where: { tenantId },
    });

    if (!settings || !settings.accessToken) {
      throw new BadRequestException('このテナントにはLINEアクセストークンが設定されていません');
    }

    if (!settings.isActive) {
      throw new BadRequestException('このテナントではLINE連携が無効になっています');
    }

    const url = 'https://api.line.me/v2/bot/message/push';

    const body = {
      to: dto.to,
      messages: [
        {
          type: 'text',
          text: dto.message,
        },
      ],
    };

    try {
      const res$ = this.http.post(url, body, {
        headers: {
          Authorization: `Bearer ${settings.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      await firstValueFrom(res$);

      return { success: true };
        } catch (e: any) {
      const lineError = e?.response?.data ?? e?.message ?? e;

      console.error('LINE push error:', lineError);

      // 一時的に詳細を返す（デバッグ用）
      throw new BadRequestException({
        message: 'LINEへのテスト送信に失敗しました',
        lineError,
      });
    }

  }

}
