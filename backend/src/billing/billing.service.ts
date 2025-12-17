// backend/src/billing/billing.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

// billing.service.ts
type Plan = 'BASIC' | 'STANDARD' | 'PRO';

// // billing.service.ts の上の方（importsの直下 / classの外）
// const PRICE_TO_PLAN: Record<string, 'BASIC' | 'STANDARD' | 'PRO'> = {
//   // ※いまの “正” のPriceIDに合わせて（画像のやつ）
//   'price_1SbheO3mSiSNFTaeUrRGDQYW': 'BASIC',
//   'price_1SdTvo3mSiSNFTaeCtYBMrPp': 'STANDARD',
//   'price_1SdTwO3mSiSNFTaeB0BJklvB': 'PRO',
// } as const;


@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  // ★ 追加：PriceId → Plan の逆引き（ENVから生成）
  private readonly priceToPlan: Record<string, Plan> = {};

  constructor(private readonly prisma: PrismaService) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY が設定されていません。');
      this.stripe = new Stripe('sk_test_dummy');
    } else {
      this.stripe = new Stripe(secretKey);
    }

    // ★ ここでENVから逆引きマップを作る（Renderの設定が正）
    const basic = process.env.STRIPE_PRICE_BASIC;
    const standard = process.env.STRIPE_PRICE_STANDARD;
    const pro = process.env.STRIPE_PRICE_PRO;

    if (basic) this.priceToPlan[basic] = 'BASIC';
    if (standard) this.priceToPlan[standard] = 'STANDARD';
    if (pro) this.priceToPlan[pro] = 'PRO';

    this.logger.log(
      `priceToPlan loaded: ${Object.entries(this.priceToPlan)
        .map(([k, v]) => `${v}=${k}`)
        .join(', ')}`,
    );
  }
  /**
   * Stripe の Checkout セッションを作成して URL を返す
   */
  async createCheckoutSession(
    tenantId: number,
    plan: string,
    fromLogin = false, // ★ 追加：ログイン画面からかどうか
  ) {
    this.logger.log(
      `createCheckoutSession called. tenantId=${tenantId}, plan=${plan}, fromLogin=${fromLogin}`,
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

    // ★ ログイン画面からかどうかで戻り先を変える
    const successPath = fromLogin ? '/' : '/billing/success';
    const cancelPath = fromLogin ? '/' : '/billing/cancel';

    // 実際に Stripe Checkout セッションを作成（ここで1回だけ呼ぶ）
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${frontendBaseUrl}${successPath}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBaseUrl}${cancelPath}?billing=cancel`,
      client_reference_id: clientReferenceId,
      metadata: {
        tenantId: clientReferenceId,
        plan, // BASIC / STANDARD / PRO がそのまま入る
        fromLogin: fromLogin ? '1' : '0',
      },
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
   * Stripe カスタマーポータル用セッション作成
   * - 解約やカード変更はここから
   */
  async createPortalSession(tenantId: number) {
    // 対象テナントを取得（stripeCustomerId があるかチェック）
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        stripeCustomerId: true,
      },
    });

    if (!tenant || !tenant.stripeCustomerId) {
      throw new BadRequestException(
        'このテナントにはサブスク登録がありません。',
      );
    }

    const frontendBaseUrl =
      process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000';

    const session = await this.stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${frontendBaseUrl}/billing`,
    });

    if (!session.url) {
      this.logger.error(
        `Stripe ポータルセッションに url が含まれていません。sessionId=${session.id}`,
      );
      throw new Error('サブスク管理画面のURLの取得に失敗しました。');
    }

    return { url: session.url };
  }

  /**
   * Webhook 受け取り
   */
  async handleStripeWebhook(event: any) {
    this.logger.log(
      `Stripe webhook received. id=${event.id}, type=${event.type}`,
    );

    switch (event.type) {
      // ① Stripe Checkout セッション完了
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const clientRef = session.client_reference_id;
        const tenantId = clientRef ? Number(clientRef) : NaN;

        if (!tenantId || Number.isNaN(tenantId)) {
          this.logger.error(
            `checkout.session.completed だが tenantId が取得できません。client_reference_id=${clientRef}`,
          );
          break;
        }

        // createCheckoutSession で埋め込んだ metadata.plan
        const planFromMetadata = session.metadata?.plan ?? null;

        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : (session.customer?.id ?? null);

        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription?.id ?? null);

        this.logger.log(
          `checkout.session.completed for tenantId=${tenantId}, customer=${customerId}, subscription=${subscriptionId}, plan=${planFromMetadata}`,
        );

        // テナントに Stripe の基本情報を書き込む
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: {
            stripeCustomerId: customerId ?? undefined,
            stripeSubscriptionId: subscriptionId ?? undefined,
            subscriptionStatus: subscriptionId ? 'active' : undefined,
            plan: planFromMetadata ?? undefined,
            isActive: subscriptionId ? true : undefined,
          },
        });

        break;
      }

case 'invoice.payment_succeeded': {
  const invoice = event.data.object as Stripe.Invoice;

  const rawCustomer = (invoice as any).customer;
  const customerId =
    typeof rawCustomer === 'string' ? rawCustomer : (rawCustomer?.id ?? null);

const lines = invoice.lines?.data ?? [];
const mainLine =
  (lines as any[]).find((l) => l?.proration === false && l?.period?.end) ??
  (lines as any[]).find((l) => l?.period?.end) ??
  null;

const periodEndUnix = mainLine?.period?.end ?? null;
const periodEnd = periodEndUnix != null ? new Date(periodEndUnix * 1000) : null;


  // priceIdも mainLine から取る（proration行を避ける）
  const priceId: string | null =
    mainLine?.price?.id ??
    mainLine?.plan?.id ??
    null;

  const planFromInvoice = priceId ? this.priceToPlan[priceId] : undefined;

  this.logger.log(
    `invoice.payment_succeeded: customer=${customerId}, priceId=${priceId}, mappedPlan=${planFromInvoice ?? '-'}, periodEnd=${periodEnd?.toISOString() ?? '-'}`,
  );

  if (!customerId || !periodEnd) break;

  await this.prisma.tenant.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      currentPeriodEnd: periodEnd,
      validUntil: periodEnd,
      isActive: true,

      // ★ ここでplanも更新してOK（ただし planは基本 subscription.updated の方が信頼できる）
      ...(planFromInvoice ? { plan: planFromInvoice } : {}),
    },
  });

  break;
}

// ②の invoice.payment_succeeded の下あたりに追加でOK
case 'invoice.payment_failed': {
  const invoice = event.data.object as Stripe.Invoice;

  const rawCustomer = (invoice as any).customer;
  const customerId =
    typeof rawCustomer === 'string' ? rawCustomer : (rawCustomer?.id ?? null);

  const lines = invoice.lines?.data ?? [];
  const mainLine =
    (lines as any[]).find((l) => l?.proration === false && l?.period?.end) ??
    (lines as any[]).find((l) => l?.period?.end) ??
    null;

  const periodEndUnix = mainLine?.period?.end ?? null;
  const periodEnd = periodEndUnix != null ? new Date(periodEndUnix * 1000) : null;

  this.logger.warn(
    `invoice.payment_failed: customer=${customerId}, periodEnd=${periodEnd?.toISOString() ?? '-'}`,
  );

  if (!customerId) break;

  await this.prisma.tenant.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionStatus: 'past_due',
      ...(periodEnd ? { currentPeriodEnd: periodEnd, validUntil: periodEnd } : {}),
      // ★isActiveは触らない
    },
  });

  break;
}


case 'customer.subscription.created':
case 'customer.subscription.updated':
case 'customer.subscription.deleted': {
  const subscription = event.data.object as Stripe.Subscription;

  const currentPeriodEndUnix = (subscription as any).current_period_end ?? null;
  const currentPeriodEndDate = currentPeriodEndUnix
    ? new Date(currentPeriodEndUnix * 1000)
    : null;

    const now = new Date();

const shouldBeActive =
  !!currentPeriodEndDate && currentPeriodEndDate.getTime() > now.getTime()
    ? true
    : (subscription.status === 'active' || subscription.status === 'trialing');


  const currentPriceId =
    subscription.items?.data?.[0]?.price?.id ?? null;

const mappedPlan =
  currentPriceId ? this.priceToPlan[currentPriceId] : undefined;

// ログだけ出しておく（未登録ならここで気づける）
if (currentPriceId && !mappedPlan) {
  this.logger.warn(`Unknown priceId: ${currentPriceId} (priceToPlan not mapped)`);
}


  this.logger.log(
    `${event.type}: subId=${subscription.id}, status=${subscription.status}, current_period_end=${currentPeriodEndUnix}, priceId=${currentPriceId}`,
  );

  const subscriptionId = subscription.id;

  const tenant = await this.prisma.tenant.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!tenant) {
    this.logger.warn(
      `${event.type}: tenant not found for subscriptionId=${subscriptionId}`,
    );
    break;
  }

  await this.prisma.tenant.update({
  where: { id: tenant.id },
  data: {
    subscriptionStatus: subscription.status,
    currentPeriodEnd: currentPeriodEndDate ?? undefined,
    validUntil: currentPeriodEndDate ?? undefined,
    ...(mappedPlan ? { plan: mappedPlan } : {}),
    isActive: shouldBeActive, // ★ここ必須
  },
});


  break;
}

      default: {
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
        break;
      }
    }
  }

  /**
   * 即時アップグレード（即時反映 + 差額を即時請求）
   * - 既存サブスクの price を差し替え
   * - プロレーション(差額)を作り、即時に請求書を確定→支払い実行
   */
async upgradeNow(tenantId: number, plan: 'BASIC' | 'STANDARD' | 'PRO') {
  if (!tenantId) throw new BadRequestException('tenantId が不正です');

  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });

  if (!tenant?.stripeCustomerId || !tenant.stripeSubscriptionId) {
    throw new BadRequestException('有効なサブスクがありません');
  }

  const priceIdMap = {
    BASIC: process.env.STRIPE_PRICE_BASIC,
    STANDARD: process.env.STRIPE_PRICE_STANDARD,
    PRO: process.env.STRIPE_PRICE_PRO,
  };

  const nextPriceId = priceIdMap[plan];
  if (!nextPriceId) throw new BadRequestException('priceId 未設定');

  const sub = await this.stripe.subscriptions.retrieve(
    tenant.stripeSubscriptionId,
  );

  const item = sub.items.data[0];
  if (!item) throw new BadRequestException('subscription item 不正');

  // ① 即時アップグレード（差額生成）
  const updated = await this.stripe.subscriptions.update(sub.id, {
    items: [{ id: item.id, price: nextPriceId }],
    proration_behavior: 'create_prorations',
  });

  // ② 差額を即時請求（ここがポイント）
const invoice = await this.stripe.invoices.create({
  customer: tenant.stripeCustomerId,
  subscription: updated.id,
  auto_advance: false,
});

const finalized = await this.stripe.invoices.finalizeInvoice(invoice.id);
const paid = await this.stripe.invoices.pay(finalized.id);


  // ③ アプリ即時反映（Webhookでも最終同期される）
  await this.prisma.tenant.update({
    where: { id: tenantId },
    data: { plan },
  });

  return {
    ok: true,
    invoiceId: paid.id,
    amountPaid: paid.amount_paid,
  };
}
}


