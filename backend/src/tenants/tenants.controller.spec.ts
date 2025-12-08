// src/tenants/tenants.controller.ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../jwt.guard';
import type { AuthPayload } from '../auth/auth.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  async findAll(@Req() req: Request) {
    const user = (req as any).authUser as AuthPayload;
    return this.tenantsService.findForUser(user);
  }
}
