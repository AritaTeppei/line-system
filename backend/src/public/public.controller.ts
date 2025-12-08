// src/public/public.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PublicService } from './public.service';

class PublicRegisterDto {
  lastName!: string;
  firstName!: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
  mobilePhone?: string;
}

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  /**
   * GET /public/customer-register/:token
   * → 事前確認用（店舗名やマスク済みUIDなど）
   */
  @Get('customer-register/:token')
  async preview(@Param('token') token: string) {
    // ★ PublicService 側のメソッド名は「previewRegisterToken」
    return this.publicService.previewRegisterToken(token);
  }

  /**
   * POST /public/customer-register/:token
   * → 顧客情報を受け取り、Customerを追加 or 更新
   */
  @Post('customer-register/:token')
  async complete(
    @Param('token') token: string,
    @Body() body: PublicRegisterDto,
  ) {
    return this.publicService.completeRegister(token, body);
  }
}
