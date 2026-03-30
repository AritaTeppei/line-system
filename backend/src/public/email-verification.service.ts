import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

const CODE_EXPIRES_MINUTES = 10;
const TOKEN_EXPIRES_MINUTES = 60;
const RESEND_INTERVAL_MS = 2 * 60 * 1000; // 2分に1回まで

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** 認証コードを生成してメール送信 */
  async sendCode(email: string): Promise<void> {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('メールアドレスの形式が不正です。');
    }

    // 短時間での連続送信を防ぐ
    const recent = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        createdAt: { gte: new Date(Date.now() - RESEND_INTERVAL_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new BadRequestException(
        '認証コードは2分間隔でのみ送信できます。しばらくお待ちください。',
      );
    }

    const code = String(Math.floor(1000 + Math.random() * 9000)); // 4桁
    const expiresAt = new Date(Date.now() + CODE_EXPIRES_MINUTES * 60 * 1000);

    await this.prisma.emailVerification.create({
      data: { email, code, expiresAt },
    });

    await this.mail.sendEmailVerificationCode({ to: email, code });
    this.logger.log(`Verification code sent to ${email}`);
  }

  /** コードを検証してトークンを返す */
  async verifyCode(email: string, code: string): Promise<{ token: string }> {
    const record = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.code !== code) {
      throw new BadRequestException('認証コードが正しくないか、期限切れです。');
    }

    const token = crypto.randomBytes(24).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRES_MINUTES * 60 * 1000);

    await this.prisma.emailVerification.update({
      where: { id: record.id },
      data: { verified: true, token, expiresAt: tokenExpiresAt },
    });

    return { token };
  }

  /** 登録時にトークンが有効かチェック（使用後は無効化） */
  async consumeToken(token: string): Promise<{ email: string }> {
    const record = await this.prisma.emailVerification.findUnique({
      where: { token },
    });

    if (!record || !record.verified || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'メールアドレスの認証が完了していないか、セッションが期限切れです。再度認証してください。',
      );
    }

    await this.prisma.emailVerification.update({
      where: { id: record.id },
      data: { token: null },
    });

    return { email: record.email };
  }
}
