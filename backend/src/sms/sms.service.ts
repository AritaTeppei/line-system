import { Injectable, Logger } from '@nestjs/common';
import twilio from 'twilio';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: ReturnType<typeof twilio> | null;
  private readonly fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER ?? '';

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    } else {
      this.client = null;
      this.logger.warn('TWILIO credentials not set — SMS will be logged only');
    }
  }

  /** 日本の電話番号を E.164 形式に正規化 (09012345678 → +819012345678) */
  normalizeJpPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('81')) return `+${digits}`;
    if (digits.startsWith('0')) return `+81${digits.slice(1)}`;
    return `+81${digits}`;
  }

  async sendSms(to: string, body: string): Promise<void> {
    const toE164 = this.normalizeJpPhone(to);

    if (!this.client) {
      // 開発環境: コンソールにコードを表示
      this.logger.log(`[DEV SMS] to=${toE164} body="${body}"`);
      return;
    }

    await this.client.messages.create({
      body,
      from: this.fromNumber,
      to: toE164,
    });
  }
}
