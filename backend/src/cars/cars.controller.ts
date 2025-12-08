// src/cars/cars.controller.ts
import { Patch, Body, Controller, Get, Post, Delete, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
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

  // ★ 追加：車両の更新
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCarDto,
  ) {
    const user = (req as any).authUser as AuthPayload;
    return this.carsService.updateForUser(user, id, {
      ...dto,
      // customerId は数値化。未指定なら undefined のまま渡す
      customerId:
        dto.customerId !== undefined && dto.customerId !== null
          ? Number(dto.customerId)
          : undefined,
    });
  }

@Delete(':id')
  async remove(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = (req as any).authUser as AuthPayload;
    return this.carsService.removeForUser(user, id);
  }
}
