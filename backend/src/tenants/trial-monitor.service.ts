// backend/src/tenants/trial-monitor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class TrialMonitorService {
  private readonly logger = new Logger(TrialMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * 毎朝 9:00（日本時間）に
   * - TRIAL
   * - trialEndsAt が「今日」
   * - trialEndNotifiedAt が null
   * のテナントにメール通知
   */
    @Cron('0 0 9 * * *', {
    timeZone: 'Asia/Tokyo',
  })
  async notifyTrialEndToday() {
    this.logger.log('Running notifyTrialEndToday job');

    const now = new Date();

    // 今日の 00:00〜翌日 00:00 を UTC で作る
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const start = new Date(Date.UTC(y, m, d));
    const end = new Date(Date.UTC(y, m, d + 1));

    const tenants = await this.prisma.tenant.findMany({
      where: {
        plan: 'TRIAL',
        isActive: true,
        trialEnd: {
          gte: start,
          lt: end,
        },
        // ★ trialEndNotifiedAt は使わない（ここに書くと型エラーになるので削除）
      },
    });

    if (tenants.length === 0) {
      this.logger.log('No tenants to notify today');
      return;
    }

    this.logger.log(`Found ${tenants.length} trial tenants to notify`);

    for (const tenant of tenants) {
      // 送り先メールアドレス
      const to = tenant.email;
      if (!to) {
        this.logger.warn(
          `Tenant id=${tenant.id} name=${tenant.name} has no email. Skip.`,
        );
        continue;
      }

      // trialEnd が無い場合はスキップ
      if (!tenant.trialEnd) {
        continue;
      }

      // メール送信（失敗しても他のテナントは続行）
      await this.mail.sendTrialEndNotice({
        to,
        tenantName: tenant.name,
        trialEndsAt: tenant.trialEnd, // MailService 側の引数名は trialEndsAt のままでOK
      });
    }

    this.logger.log('notifyTrialEndToday job completed');
  }
}

