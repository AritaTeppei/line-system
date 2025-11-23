// src/tenants/tenants.module.ts
import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';  // ★ 追加

@Module({
  imports: [PrismaModule, AuthModule],        // ★ ここ
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
