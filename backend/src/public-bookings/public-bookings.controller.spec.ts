import { Test, TestingModule } from '@nestjs/testing';
import { PublicBookingsController } from './public-bookings.controller';

describe('PublicBookingsController', () => {
  let controller: PublicBookingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicBookingsController],
    }).compile();

    controller = module.get<PublicBookingsController>(PublicBookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
