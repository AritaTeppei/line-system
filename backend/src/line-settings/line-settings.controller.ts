import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Body,
  Post,
  // UseGuards,
} from '@nestjs/common';
import { LineSettingsService } from './line-settings.service';
import { UpdateLineSettingsDto } from './dto/update-line-settings.dto';
import { SendLineTestDto } from './dto/send-line-test.dto';

// 🔽 ここは一旦コメントアウト（まだファイルが無い or パスが違う）
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';
// import { Role } from '../auth/role.enum';

@Controller('tenants/:tenantId/line-settings')
// 🔽 ここも一旦コメントアウト
// @UseGuards(JwtAuthGuard, RolesGuard)
export class LineSettingsController {
  constructor(private readonly lineSettingsService: LineSettingsService) {}

  // 🔽 ここも後で戻す
  // @Roles(Role.DEVELOPER)
  @Get()
  async getLineSettings(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.lineSettingsService.getByTenantId(tenantId);
  }

  // @Roles(Role.DEVELOPER)
  @Put()
  async updateLineSettings(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: UpdateLineSettingsDto,
  ) {
    return this.lineSettingsService.upsertByTenantId(tenantId, dto);
  }

  // 🧪 テスト送信用
  // @Roles(Role.DEVELOPER)
  @Post('test-message')
  async sendTestMessage(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: SendLineTestDto,
  ) {
    return this.lineSettingsService.sendTestMessage(tenantId, dto);
  }
}
