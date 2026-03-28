// backend/src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.from = process.env.SMTP_FROM ?? 'noreply@seibisystem.com';
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
      await this.resend.emails.send({ from: this.from, to, subject, text });
      this.logger.log(`TrialEndNotice sent to ${to}`);
    } catch (e: any) {
      this.logger.error(`Failed to send trial end mail: ${e?.message ?? e}`);
    }
  }

  async sendPasswordResetEmail(params: { to: string; resetUrl: string; userName?: string | null }) {
    const { to, resetUrl, userName } = params;
    const subject = '【PitLink】パスワード再設定のご案内';
    const text = [
      userName ? `${userName} 様` : 'お客様',
      '',
      'PitLinkへのパスワード再設定リクエストを受け付けました。',
      '',
      '以下のリンクをクリックしてパスワードを再設定してください。',
      'リンクは1時間有効です。',
      '',
      resetUrl,
      '',
      '※ このメールに心当たりがない場合は、このまま無視していただいて構いません。',
      '',
      '――――――――――――――――',
      'PitLink 運営',
    ].join('\n');

    try {
      await this.resend.emails.send({ from: this.from, to, subject, text });
      this.logger.log(`PasswordResetEmail sent to ${to}`);
    } catch (e: any) {
      this.logger.error(`Failed to send password reset mail: ${e?.message ?? e}`);
      throw e;
    }
  }
}
