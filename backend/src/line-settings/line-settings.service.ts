import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLineSettingsDto } from './dto/update-line-settings.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SendLineTestDto } from './dto/send-line-test.dto';

@Injectable()
export class LineSettingsService {
  private readonly logger = new Logger(LineSettingsService.name); // ★追加

  private readonly WEBHOOK_URL =
    'https://line-system.onrender.com/line/webhook'; // ★追加

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
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('テナントが見つかりません');
    }

    const existing = await this.prisma.lineSettings.findUnique({
      where: { tenantId },
    });

    // 共通 webhook URL を強制適用（管理画面では非表示）
    const WEBHOOK_URL = this.WEBHOOK_URL;

    // ----------------------------
    // ★ accessToken が変わったら destination を自動更新する
    // ----------------------------

    let destination = existing?.destination ?? null;

    const newAccessToken = dto.accessToken?.trim() ?? '';
    const oldAccessToken = existing?.accessToken ?? '';

    const accessTokenChanged =
      newAccessToken !== '' && newAccessToken !== oldAccessToken;

    if (accessTokenChanged) {
      try {
        const res = await firstValueFrom(
          this.http.get('https://api.line.me/v2/bot/info', {
            headers: {
              Authorization: `Bearer ${newAccessToken}`,
            },
          }),
        );

        if (res?.data?.userId) {
          destination = res.data.userId;
          this.logger.log(
            `destination auto-updated. tenantId=${tenantId}, value=${destination}`,
          );
        } else {
          this.logger.warn(
            `getBotInfo success but no userId. tenantId=${tenantId}`,
          );
        }
      } catch (e: any) {
        this.logger.error(
          `getBotInfo error tenantId=${tenantId}`,
          e?.response?.data ?? e,
        );
      }
    }

    // ----------------------------
    // ここから upsert 本体
    // ----------------------------

    if (!existing) {
      // 新規作成
      return this.prisma.lineSettings.create({
        data: {
          tenantId,
          channelId: dto.channelId ?? null,
          channelSecret: dto.channelSecret ?? null,
          accessToken: dto.accessToken ?? null,
          webhookUrl: WEBHOOK_URL,
          isActive: dto.isActive ?? false,
          destination, // ★自動取得した destination
        },
      });
    }

    // 更新
    return this.prisma.lineSettings.update({
      where: { tenantId },
      data: {
        channelId: dto.channelId ?? existing.channelId,
        channelSecret: dto.channelSecret ?? existing.channelSecret,
        accessToken: dto.accessToken ?? existing.accessToken,
        webhookUrl: WEBHOOK_URL,
        isActive:
          typeof dto.isActive === 'boolean' ? dto.isActive : existing.isActive,
        destination, // ★ここも自動更新
      },
    });
  }

  async sendTestMessage(tenantId: number, dto: SendLineTestDto) {
    const settings = await this.prisma.lineSettings.findUnique({
      where: { tenantId },
    });

    if (!settings || !settings.accessToken) {
      throw new BadRequestException(
        'このテナントにはLINEアクセストークンが設定されていません',
      );
    }

    if (!settings.isActive) {
      throw new BadRequestException(
        'このテナントではLINE連携が無効になっています',
      );
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
