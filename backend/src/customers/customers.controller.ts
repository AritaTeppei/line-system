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
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../jwt.guard';
import type { AuthPayload } from '../auth/auth.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';

type ImportStrategy = 'skip' | 'rollback';

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

  /**
   * 顧客CSVインポート
   * POST /customers/import-csv
   * Content-Type: multipart/form-data
   *   - file: CSV ファイル
   *   - strategy: 'skip' | 'rollback' （任意 / デフォルト skip）
   */
    /**
   * 顧客CSVインポート
   * POST /customers/import-csv
   */
  @Post('import-csv')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @Req() req: Request,
    @UploadedFile() file: any, // まずは any でOK（型でハマらないように）
    @Query('strategy') strategy: ImportStrategy = 'skip',
  ) {
    const user = (req as any).authUser as AuthPayload;
    return this.customersService.importFromCsv(user, file, strategy);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).authUser as AuthPayload;
    return this.customersService.removeForUser(user, Number(id));
  }
}
