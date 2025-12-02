// src/customers/public-customers.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { LineRegisterDto } from './dto/line-register.dto';

@Controller('public/customers')
export class PublicCustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * LINE から送られてきたフォームの内容を元に
   * - 既存顧客を電話番号で探してマージ
   * - なければ新規作成
   */
  @Post('register-from-line')
  async registerFromLine(@Body() dto: LineRegisterDto) {
    return this.customersService.upsertFromLineByMobilePhone(dto.tenantId, {
      mobilePhone: dto.mobilePhone,
      lineUid: dto.lineUid,
      lastName: dto.lastName,
      firstName: dto.firstName,
      postalCode: dto.postalCode,
      address1: dto.address1,
      address2: dto.address2,
      birthday: dto.birthday,
    });
  }
}
