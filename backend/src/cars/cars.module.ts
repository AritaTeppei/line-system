// src/cars/cars.module.ts
import { Module } from '@nestjs/common';
import { CarsService } from './cars.service';
import { CarsController } from './cars.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module'; // ★ 追加

@Module({
  imports: [PrismaModule, AuthModule], // ★ ここ
  controllers: [CarsController],
  providers: [CarsService],
})
export class CarsModule {}
