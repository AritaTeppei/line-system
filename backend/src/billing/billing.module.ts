// backend/src/billing/billing.module.ts
import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, PrismaService],
})
export class BillingModule {}
