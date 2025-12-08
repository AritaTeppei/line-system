// src/public/public.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

// 既存の Public 系（あなたの元コード）
import { PublicService } from './public.service';
import { PublicController } from './public.controller';

// ★ 新規追加したテナント登録用
import { PublicTenantsService } from './public.tenants.service';
import { PublicTenantsController } from './public.tenants.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    PublicController,        // ← 元からある
    PublicTenantsController, // ← ★ 追加
  ],
  providers: [
    PublicService,           // ← 元からある
    PublicTenantsService,    // ← ★ 追加
  ],
})
export class PublicModule {}
