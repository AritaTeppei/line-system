import {
  BadRequestException,
  Controller,
  Post,
  Req,
  Res,
  Headers,
  Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2025-11-17.clover',
  });

  constructor(private readonly billingService: BillingService) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // STRIPE_WEBHOOK_SECRET が未設定の場合は署名検証をスキップ（開発環境向け）
    let event: Stripe.Event;
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET が未設定のため署名検証をスキップします（開発環境）');
      event = req.body as unknown as Stripe.Event;
    } else {
      const rawBody = req.rawBody;
      if (!rawBody) {
        this.logger.error('rawBody が取得できませんでした');
        return res.status(400).json({ error: 'rawBody missing' });
      }

      try {
        event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch (err: any) {
        this.logger.warn(`Webhook 署名検証失敗: ${err.message}`);
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
      }
    }

    this.logger.log(`Webhook received: type=${event?.type}, id=${event?.id}`);

    try {
      await this.billingService.handleStripeWebhook(event);
      return res.status(200).json({ received: true });
    } catch (e) {
      this.logger.error('Webhook handling failed', e as any);
      return res.status(500).json({ error: 'Webhook failed' });
    }
  }
}
