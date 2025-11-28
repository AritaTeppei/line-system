import { Module } from '@nestjs/common';
import { PublicBookingsController } from './public-bookings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PublicBookingsController],
})
export class PublicBookingsModule {}
