// backend/src/billing/billing.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

// billing.service.ts の上の方（classの外でも中でもOK）に追加
const PRICE_TO_PLAN: Record<string, 'BASIC' | 'STANDARD' | 'PRO'> = {
  'price_1SbheO3mSiSNFTaeUrRGDQYW': 'BASIC',
  'price_1SdTvo3mSiSNFTaeCtYBMrPp': 'STANDARD',
  'price_1SdTwO3mSiSNFTaeB0BJklvB': 'PRO',
};

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
      // ② 支払い成功 → そのサイクルの終了日で有効期限を更新
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;

        // ★ ここを customer ベースに変更
        const rawCustomer = (invoice as any).customer;
        const customerId =
          typeof rawCustomer === 'string'
            ? rawCustomer
            : (rawCustomer?.id ?? null);

        // 今回の請求サイクル（最初の行）の period.end（Unix秒）
        const periodEndUnix = invoice.lines?.data?.[0]?.period?.end ?? null;
        const periodEnd =
          periodEndUnix != null ? new Date(periodEndUnix * 1000) : null;

        this.logger.log(
          `invoice.payment_succeeded for customer=${customerId}, periodEnd=${periodEnd?.toISOString()}`,
        );

        if (!customerId || !periodEnd) {
          this.logger.warn(
            'invoice.payment_succeeded だが customerId または periodEnd が取得できません。',
          );
          break;
        }

        // ★ checkout.session.completed で保存した stripeCustomerId と紐付ける
        await this.prisma.tenant.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            currentPeriodEnd: periodEnd,
            validUntil: periodEnd, // ← ダッシュボードの「有効期限」と揃える
            isActive: true, // ← 支払い成功なので有効化
          },
        });

        break;
      }

      // ③ サブスクのライフサイクルイベント（とりあえずログ＋ステータス更新）
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        const currentPeriodEndUnix =
          (subscription as any).current_period_end ?? null;
        const currentPeriodEndDate = currentPeriodEndUnix
          ? new Date(currentPeriodEndUnix * 1000)
          : null;

            // ★ 追加：いま有効な priceId を取る（subscription.items の先頭でOK。基本1つのはず）
  const currentPriceId =
    subscription.items?.data?.[0]?.price?.id ?? null;

  // ★ 追加：priceId からアプリの plan へ変換
  const mappedPlan =
    currentPriceId ? PRICE_TO_PLAN[currentPriceId] : undefined;

        this.logger.log(
          `${event.type}: subId=${subscription.id}, status=${subscription.status}, current_period_end(unix)=${currentPeriodEndUnix}, date=${currentPeriodEndDate?.toISOString()}`,
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
            // ここは「とりあえず Stripe 側の状態を反映」くらいの役割
            currentPeriodEnd: currentPeriodEndDate ?? undefined,
            // 必要なら validUntil もここで書き換えられる
            validUntil: currentPeriodEndDate ?? undefined,

                  // ★ 追加：Stripe 側の “現在のprice” に合わせて plan を同期
      ...(mappedPlan ? { plan: mappedPlan } : {}),

            isActive: subscription.status === 'active',
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
}
