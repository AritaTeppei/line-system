// src/tenants/tenants.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Req,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
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

  /** CLIENT 一覧 */
  @Get('clients')
  async findClients(@Req() req: Request) {
    const user = (req as any).authUser as AuthPayload;
    return this.tenantsService.findClientsForManager(user);
  }

  /** プラン別クライアント上限情報 */
  @Get('client-limits')
  async getClientLimits(@Req() req: Request) {
    const user = (req as any).authUser as AuthPayload;
    return this.tenantsService.getClientLimits(user);
  }

  /** CLIENTアカウント追加 */
  @Post('clients')
  async createClient(
    @Req() req: Request,
    @Body() body: { email: string; name?: string; password: string },
  ) {
    const user = (req as any).authUser as AuthPayload;
    return this.tenantsService.createClientUser(user, body);
  }

  /** CLIENTアカウント削除 */
  @Delete('clients/:userId')
  async deleteClient(
    @Req() req: Request,
    @Param('userId') userIdParam: string,
  ) {
    const user = (req as any).authUser as AuthPayload;
    return this.tenantsService.deleteClientUser(user, Number(userIdParam));
  }

  /** CLIENTパスワードリセット */
  @Patch('clients/:userId/reset-password')
  async resetClientPassword(
    @Req() req: Request,
    @Param('userId') userIdParam: string,
    @Body() body: { newPassword: string },
  ) {
    const user = (req as any).authUser as AuthPayload;
    return this.tenantsService.resetClientPassword(
      user,
      Number(userIdParam),
      body.newPassword,
    );
  }
}
