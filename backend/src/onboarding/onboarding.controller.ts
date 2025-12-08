// src/onboarding/onboarding.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { GetOnboardingStatusDto } from './dto/get-onboarding-status.dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * テナントのオンボーディング状態を返す
   */
  @Post('status')
  async getStatus(@Body() dto: GetOnboardingStatusDto) {
    const tenantId = Number(dto.tenantId);
    const status = await this.onboardingService.getStatus(tenantId);
    return { status };
  }
}
