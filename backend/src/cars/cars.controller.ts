// src/cars/cars.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CarsService } from './cars.service';
import { JwtAuthGuard } from '../jwt.guard';
import type { AuthPayload } from '../auth/auth.service';
import { CreateCarDto } from './dto/create-car.dto';

@Controller('cars')
@UseGuards(JwtAuthGuard)
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Get()
  findAll(@Req() req: Request) {
    const user = (req as any).authUser as AuthPayload;
    return this.carsService.findAllForUser(user);
  }

  @Post()
create(@Req() req: Request, @Body() dto: CreateCarDto) {
  const user = (req as any).authUser as AuthPayload;
  return this.carsService.createForUser(user, {
    ...dto,
    customerId: Number(dto.customerId),
  });
}
}
