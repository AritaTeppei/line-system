// src/public/public.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

import { PublicService } from './public.service';
import { PublicController } from './public.controller';

import { PublicTenantsService } from './public.tenants.service';
import { PublicTenantsController } from './public.tenants.controller';
import { EmailVerificationService } from './email-verification.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [
    PublicController,
    PublicTenantsController,
  ],
  providers: [
    PublicService,
    PublicTenantsService,
    EmailVerificationService,
  ],
})
export class PublicModule {}
