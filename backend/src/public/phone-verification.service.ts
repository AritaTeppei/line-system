import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import * as crypto from 'crypto';

const CODE_EXPIRES_MINUTES = 10;
const TOKEN_EXPIRES_MINUTES = 60;
// 同じ番号へのコード送信は5分に1回まで
const RESEND_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  /** 認証コードを生成してSMS送信 */
  async sendCode(phone: string): Promise<void> {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      throw new BadRequestException('電話番号の形式が不正です。');
    }

    // 短時間での連続送信を防ぐ
    const recent = await this.prisma.phoneVerification.findFirst({
      where: {
        phone,
        createdAt: { gte: new Date(Date.now() - RESEND_INTERVAL_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new BadRequestException(
        '認証コードは5分間隔でのみ送信できます。しばらくお待ちください。',
      );
    }

    const code = String(Math.floor(1000 + Math.random() * 9000)); // 4桁
    const expiresAt = new Date(Date.now() + CODE_EXPIRES_MINUTES * 60 * 1000);

    await this.prisma.phoneVerification.create({
      data: { phone, code, expiresAt },
    });

    await this.sms.sendSms(
      phone,
      `【seibisystem】認証コード: ${code}　※このコードは${CODE_EXPIRES_MINUTES}分間有効です。`,
    );

    this.logger.log(`Verification code sent to ${phone}`);
  }

  /** コードを検証してトークンを返す */
  async verifyCode(phone: string, code: string): Promise<{ token: string }> {
    const record = await this.prisma.phoneVerification.findFirst({
      where: {
        phone,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.code !== code) {
      throw new BadRequestException(
        '認証コードが正しくないか、期限切れです。',
      );
    }

    const token = crypto.randomBytes(24).toString('hex');
    const tokenExpiresAt = new Date(
      Date.now() + TOKEN_EXPIRES_MINUTES * 60 * 1000,
    );

    await this.prisma.phoneVerification.update({
      where: { id: record.id },
      data: { verified: true, token, expiresAt: tokenExpiresAt },
    });

    return { token };
  }

  /** 登録時にトークンが有効かチェック（使用後は削除） */
  async consumeToken(token: string): Promise<{ phone: string }> {
    const record = await this.prisma.phoneVerification.findUnique({
      where: { token },
    });

    if (!record || !record.verified || record.expiresAt < new Date()) {
      throw new BadRequestException(
        '電話番号の認証が完了していないか、セッションが期限切れです。再度認証してください。',
      );
    }

    // 使用済みにする（token をクリア）
    await this.prisma.phoneVerification.update({
      where: { id: record.id },
      data: { token: null },
    });

    return { phone: record.phone };
  }
}
