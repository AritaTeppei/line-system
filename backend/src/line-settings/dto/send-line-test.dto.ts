import { IsString, MinLength } from 'class-validator';

export class SendLineTestDto {
  @IsString()
  @MinLength(1, { message: '送信先UIDは必須です' })
  to: string; // LINEのUID（userId）

  @IsString()
  @MinLength(1, { message: 'メッセージは必須です' })
  message: string;
}
