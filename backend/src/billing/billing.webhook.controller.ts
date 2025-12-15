import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express'; // ★ここだけ import type
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(private readonly billingService: BillingService) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    // いまは署名検証しない（次のステップで必ずやる）
    const event = req.body as any;

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
