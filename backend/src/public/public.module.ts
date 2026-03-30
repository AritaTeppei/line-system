// src/public/public.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SmsService } from '../sms/sms.service';

import { PublicService } from './public.service';
import { PublicController } from './public.controller';

import { PublicTenantsService } from './public.tenants.service';
import { PublicTenantsController } from './public.tenants.controller';
import { PhoneVerificationService } from './phone-verification.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    PublicController,
    PublicTenantsController,
  ],
  providers: [
    PublicService,
    PublicTenantsService,
    PhoneVerificationService,
    SmsService,
  ],
})
export class PublicModule {}
