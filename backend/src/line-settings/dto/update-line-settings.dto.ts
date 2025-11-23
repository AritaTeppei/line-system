import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateLineSettingsDto {
  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsString()
  channelSecret?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsUrl({}, { message: 'webhookUrl は有効なURLを指定してください' })
  webhookUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
