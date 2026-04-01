// src/customers/customers.controller.ts
import {
  BadRequestException,
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
import { memoryStorage } from 'multer';

type MulterFile = { originalname: string; mimetype: string; buffer: Buffer; size: number };

const CSV_FILE_FILTER = (
  _req: any,
  file: MulterFile,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  const allowedMimeTypes = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (ext !== 'csv' || !allowedMimeTypes.includes(file.mimetype)) {
    return cb(new BadRequestException('CSVファイル（.csv）のみアップロード可能です'), false);
  }
  cb(null, true);
};

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

  @Post('import-csv')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 上限
      fileFilter: CSV_FILE_FILTER,
    }),
  )
  importCsv(
    @Req() req: Request,
    @UploadedFile() file: MulterFile,
    @Query('strategy') strategy: ImportStrategy = 'skip',
  ) {
    if (!file) throw new BadRequestException('ファイルが選択されていません');
    const user = (req as any).authUser as AuthPayload;
    return this.customersService.importFromCsv(user, file, strategy);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).authUser as AuthPayload;
    return this.customersService.removeForUser(user, Number(id));
  }
}
