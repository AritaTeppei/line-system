// backend/src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // ★ 環境変数は自分のSMTPに合わせて
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendTrialEndNotice(params: {
    to: string;
    tenantName: string;
    trialEndsAt: Date;
  }) {
    const { to, tenantName, trialEndsAt } = params;

    const dateStr = trialEndsAt.toISOString().slice(0, 10).replace(/-/g, '/');

    const subject = `【PitLink】お試し期間が本日で終了します（${tenantName} 様）`;
    const text = [
      `${tenantName} 様`,
      '',
      'いつも PitLink（LINE通知システム）をご利用いただきありがとうございます。',
      '',
      `お試し期間が本日（${dateStr}）で終了となります。`,
      '',
      'このままご利用を継続される場合は、管理画面左メニュー「サブスク登録」より',
      'クレジットカードのご登録とプラン選択をお願いいたします。',
      '',
      'お試し期間終了後はログインできなくなりますので、ご注意ください。',
      '',
      'ご不明点がございましたら、このメールへのご返信または担当者までご連絡ください。',
      '',
      '――――――――――――――――',
      'PitLink 運営',
    ].join('\n');

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'no-reply@pitlink.example',
        to,
        subject,
        text,
      });
      this.logger.log(`TrialEndNotice sent to ${to}`);
    } catch (e: any) {
      this.logger.error(`Failed to send trial end mail: ${e?.message ?? e}`);
    }
  }
}
