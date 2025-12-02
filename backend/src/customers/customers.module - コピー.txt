// src/customers/customers.module.ts
import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';  // ★ 追加

@Module({
  imports: [PrismaModule, AuthModule],        // ★ AuthModule を追加
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
