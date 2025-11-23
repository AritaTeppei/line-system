// src/customers/customers.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../jwt.guard';
import type { AuthPayload } from '../auth/auth.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(@Req() req: Request) {
    const user = (req as any).authUser as AuthPayload;
    return this.customersService.findAllForUser(user);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateCustomerDto) {
    const user = (req as any).authUser as AuthPayload;
    return this.customersService.createForUser(user, dto);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const user = (req as any).authUser as AuthPayload;
    return this.customersService.updateForUser(user, Number(id), dto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).authUser as AuthPayload;
    return this.customersService.removeForUser(user, Number(id));
  }
}
