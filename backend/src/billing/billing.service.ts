// backend/src/billing/billing.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  // backend/src/billing/billing.service.ts の constructor 内

constructor(private readonly prisma: PrismaService) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    this.logger.warn(
      'STRIPE_SECRET_KEY が設定されていません。BillingService はまだ本番動作しません。',
    );
    // apiVersion を指定せずに初期化
    this.stripe = new Stripe('sk_test_dummy');
  } else {
    this.stripe = new Stripe(secretKey);
  }
}

  /**
   * Stripe の Checkout セッションを作成して URL を返す
   */
  async createCheckoutSession(tenantId: number, plan: string) {
    this.logger.log(
      `createCheckoutSession called. tenantId=${tenantId}, plan=${plan}`,
    );

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      this.logger.error('STRIPE_SECRET_KEY が .env に設定されていません。');
      throw new Error('Stripe が未設定です（管理者に連絡してください）。');
    }

    const frontendBaseUrl =
      process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000';

    // プラン名 → Price ID の対応表
    const priceIdMap: Record<string, string | undefined> = {
      BASIC: process.env.STRIPE_PRICE_BASIC,
      STANDARD: process.env.STRIPE_PRICE_STANDARD,
      PRO: process.env.STRIPE_PRICE_PRO,
    };

    const priceId = priceIdMap[plan];
    if (!priceId) {
      this.logger.error(`対応していない plan が指定されました: ${plan}`);
      throw new Error('指定されたプランは現在利用できません。');
    }

    // テナント存在チェック（今はログ用・将来ここで stripeCustomerId とか紐づける）
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      this.logger.error(`tenant not found. tenantId=${tenantId}`);
      throw new Error('テナントが存在しません。');
    }

    const clientReferenceId = String(tenantId);

    // 実際に Stripe Checkout セッションを作成
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${frontendBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBaseUrl}/billing/cancel`,
      client_reference_id: clientReferenceId,
    });

    if (!session.url) {
      this.logger.error(
        `Stripe Checkout Session に url が含まれていません。session.id=${session.id}`,
      );
      throw new Error('決済画面のURLの取得に失敗しました。');
    }

    this.logger.log(
      `Stripe Checkout Session created. sessionId=${session.id}, url=${session.url}`,
    );

    return {
      url: session.url,
    };
  }

    /**
   * テナントの現在の課金状態を返す（読み取り専用）
   */
  async getBillingStatus(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        isActive: true,
        validUntil: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
      },
    });

    if (!tenant) {
      this.logger.warn(`getBillingStatus: tenant not found. id=${tenantId}`);
      return null;
    }

    return {
      id: tenant.id,
      name: tenant.name,
      email: tenant.email,
      plan: tenant.plan,
      isActive: tenant.isActive,
      validUntil: tenant.validUntil,
      stripeCustomerId: tenant.stripeCustomerId,
      stripeSubscriptionId: tenant.stripeSubscriptionId,
      subscriptionStatus: tenant.subscriptionStatus,
      currentPeriodEnd: tenant.currentPeriodEnd,
    };
  }

  /**
   * Webhook 受け取り（今はログ出しだけ）
   */
  async handleStripeWebhook(event: any) {
    this.logger.log(
      `Stripe webhook received. id=${event.id}, type=${event.type}`,
    );

    switch (event.type) {
    case 'checkout.session.completed': {
      // Checkout セッション
      const session = event.data.object as Stripe.Checkout.Session;

      const clientRef = session.client_reference_id;
      const tenantId = clientRef ? Number(clientRef) : NaN;

      if (!tenantId || Number.isNaN(tenantId)) {
        this.logger.error(
          `checkout.session.completed だが tenantId が取得できません。client_reference_id=${clientRef}`,
        );
        break;
      }
    // customer / subscription は string or object のどちらか
      const customerId =
        typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id ?? null;

      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? null;

      this.logger.log(
        `checkout.session.completed for tenantId=${tenantId}, customer=${customerId}, subscription=${subscriptionId}`,
      );

      // テナントに Stripe の情報を書き込む
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
          // とりあえずステータスは "active" 固定で入れておく（後で subscription.updated で上書き）
          subscriptionStatus: subscriptionId ? 'active' : undefined,
        },
      });

      break;
    }

    // ここは将来使う用（とりあえずログだけ）
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      this.logger.log(
        `${event.type}: subId=${subscription.id}, status=${subscription.status}`,
      );
      // 次のターンで、ここから currentPeriodEnd などを Tenant に反映させる。
      break;
    }

    default:
      this.logger.log(`Unhandled Stripe event type: ${event.type}`);
  }
}
}

