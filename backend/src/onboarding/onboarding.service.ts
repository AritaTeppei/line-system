// src/onboarding/onboarding.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * テナントのオンボーディング状態を取得（読み取り専用）
   */
  async getStatus(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        lineSettings: true,
      },
    });

    if (!tenant) {
      this.logger.warn(`getStatus: tenant not found. id=${tenantId}`);
      return null;
    }

    const hasLineSettings = !!tenant.lineSettings;
    const lineSettingsActive = !!tenant.lineSettings?.isActive;
    const hasSubscription = tenant.subscriptionStatus === 'active';

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      plan: tenant.plan,
      hasLineSettings,
      lineSettingsActive,
      hasSubscription,
      subscriptionStatus: tenant.subscriptionStatus,
      currentPeriodEnd: tenant.currentPeriodEnd,
    };
  }
}
