// src/reminders/dto/upsert-reminder-template.dto.ts
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ReminderMessageType } from '@prisma/client';

export class UpsertReminderTemplateDto {
  @IsEnum(ReminderMessageType)
  type: ReminderMessageType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsNotEmpty()
  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  note?: string;
}
