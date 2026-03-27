import { Module } from '@nestjs/common';
import { CarScanController } from './car-scan.controller';

@Module({
  controllers: [CarScanController],
})
export class CarScanModule {}
