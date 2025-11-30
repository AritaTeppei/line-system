// src/admin/dto/update-tenant-user.dto.ts
import { IsEmail, IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateTenantUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
