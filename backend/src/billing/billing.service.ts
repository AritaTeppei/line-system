// backend/src/billing/billing.service.ts
import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
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

  private planToPriceId(plan: Plan): string {
  const priceId =
    plan === 'BASIC'
      ? process.env.STRIPE_PRICE_BASIC
      : plan === 'STANDARD'
        ? process.env.STRIPE_PRICE_STANDARD
        : process.env.STRIPE_PRICE_PRO;

  if (!priceId) throw new BadRequestException(`priceId 未設定: ${plan}`);
  return priceId;
}

private readonly PLAN_RANK: Record<Plan, number> = {
  BASIC: 1,
  STANDARD: 2,
  PRO: 3,
};


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
   * Stripe エラーをサニタイズして安全なメッセージのみ返す。
   * API キー（sk_test_... / sk_live_...）を含む文字列を除去する。
   */
  private sanitizeStripeError(err: unknown): never {
    let message = '決済処理中にエラーが発生しました。しばらくしてから再度お試しください。';
    if (err instanceof Stripe.errors.StripeError) {
      // キータイプ別に日本語メッセージに変換
      if (err.type === 'StripeAuthenticationError') {
        message = 'Stripe APIキーが無効または期限切れです（管理者に連絡してください）。';
      } else if (err.type === 'StripeConnectionError') {
        message = 'Stripeへの接続に失敗しました。ネットワーク状態を確認してください。';
      } else if (err.type === 'StripeRateLimitError') {
        message = 'リクエストが集中しています。しばらくしてから再度お試しください。';
      } else if (err.message) {
        // API キーが含まれる場合はデフォルトメッセージを使用、含まれない場合のみ表示
        const hasSensitiveData = /sk_(test|live)_/.test(err.message);
        if (!hasSensitiveData) {
          message = err.message;
        }
      }
      this.logger.error(`Stripe error [${err.type}]: ${err.message}`);
    } else if (err instanceof Error) {
      this.logger.error(`Unexpected error: ${err.message}`);
    }
    throw new InternalServerErrorException(message);
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
    // eslint-disable-next-line prefer-const
    let session: Stripe.Checkout.Session = null as any;
    try {
      session = await this.stripe.checkout.sessions.create({
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
          plan,
          fromLogin: fromLogin ? '1' : '0',
        },
      });
    } catch (err) {
      this.sanitizeStripeError(err);
    }

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
        nextPlan: true,
        nextPlanStartAt: true,
        trialEnd: true,
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
      nextPlan: tenant.nextPlan,
      nextPlanStartAt: tenant.nextPlanStartAt,
      trialEnd: tenant.trialEnd,
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

    let portalSession: Stripe.BillingPortal.Session = null as any;
    try {
      portalSession = await this.stripe.billingPortal.sessions.create({
        customer: tenant.stripeCustomerId,
        return_url: `${frontendBaseUrl}/billing`,
      });
    } catch (err) {
      this.sanitizeStripeError(err);
    }

    if (!portalSession.url) {
      this.logger.error(
        `Stripe ポータルセッションに url が含まれていません。sessionId=${portalSession.id}`,
      );
      throw new Error('サブスク管理画面のURLの取得に失敗しました。');
    }

    return { url: portalSession.url };
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

  // ダウングレード予約があった場合、次期請求時に plan を確定・予約情報クリア
  const tenantForInvoice = customerId
    ? await this.prisma.tenant.findFirst({ where: { stripeCustomerId: customerId } })
    : null;

  const hasScheduledDowngrade =
    tenantForInvoice?.nextPlanStartAt &&
    periodEnd &&
    tenantForInvoice.nextPlanStartAt <= periodEnd;

  await this.prisma.tenant.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      currentPeriodEnd: periodEnd,
      validUntil: periodEnd,
      isActive: true,
      // 請求から取得したプランで更新（ダウングレード予約があれば nextPlan を使う）
      ...(hasScheduledDowngrade && tenantForInvoice?.nextPlan
        ? { plan: tenantForInvoice.nextPlan as Plan, nextPlan: null, nextPlanStartAt: null }
        : planFromInvoice
          ? { plan: planFromInvoice }
          : {}),
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

  // ダウングレード予約中（nextPlanStartAt が未来）の場合は plan を上書きしない
  // scheduleDowngrade が proration:none で Stripe の price を変更するため
  // webhook が飛んでくるが、今期末まで現在プランを維持するために skip する
  const shouldUpdatePlan =
    mappedPlan &&
    (!tenant.nextPlanStartAt || tenant.nextPlanStartAt <= new Date());

  await this.prisma.tenant.update({
  where: { id: tenant.id },
  data: {
    subscriptionStatus: subscription.status,
    currentPeriodEnd: currentPeriodEndDate ?? undefined,
    validUntil: currentPeriodEndDate ?? undefined,
    ...(shouldUpdatePlan ? { plan: mappedPlan! } : {}),
    isActive: shouldBeActive,
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
  if (!tenantId || isNaN(tenantId)) throw new BadRequestException('tenantId が不正です');

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

  let sub: Stripe.Subscription;
  try {
    sub = await this.stripe.subscriptions.retrieve(
      tenant.stripeSubscriptionId,
    );
  } catch (err) {
    this.sanitizeStripeError(err);
  }

  const item = sub!.items.data[0];
  if (!item) throw new BadRequestException('subscription item 不正');

  // ① 既存のダウングレードスケジュールがあればリリース（解除）してから即時変更
  const existingScheduleId =
    typeof (sub! as any).schedule === 'string'
      ? ((sub! as any).schedule as string)
      : ((sub! as any).schedule?.id as string | undefined);

  if (existingScheduleId) {
    this.logger.log(
      `upgradeNow: releasing existing schedule=${existingScheduleId}`,
    );
    try {
      await this.stripe.subscriptionSchedules.release(existingScheduleId);
    } catch (err) {
      this.sanitizeStripeError(err);
    }
    // アプリ側の予約情報もクリア
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { nextPlan: null, nextPlanStartAt: null },
    });
  }

  // ② 即時アップグレード（差額生成）
  let updated: Stripe.Subscription;
  try {
    updated = await this.stripe.subscriptions.update(sub!.id, {
      items: [{ id: item.id, price: nextPriceId }],
      proration_behavior: 'create_prorations',
    });
  } catch (err) {
    this.sanitizeStripeError(err);
  }

  // ③ 差額を即時請求（0円の場合はスキップ）
  let invoiceId: string | null = null;
  let amountPaid = 0;

  try {
    const invoice = await this.stripe.invoices.create({
      customer: tenant.stripeCustomerId,
      subscription: updated!.id,
      auto_advance: false,
    });

    const finalized = await this.stripe.invoices.finalizeInvoice(invoice.id);

    if (finalized.amount_due > 0) {
      const paid = await this.stripe.invoices.pay(finalized.id);
      invoiceId = paid.id;
      amountPaid = paid.amount_paid;
    } else {
      invoiceId = finalized.id;
      amountPaid = 0;
    }
  } catch (e: any) {
    // 請求額0円などで invoice 作成が失敗する場合は無視して進む
    this.logger.warn(`upgradeNow: invoice step skipped. reason=${e?.message}`);
  }

  // ④ アプリ即時反映（nextPlan/nextPlanStartAt もクリア）
  await this.prisma.tenant.update({
    where: { id: tenantId },
    data: { plan, nextPlan: null, nextPlanStartAt: null },
  });

  return {
    ok: true,
    invoiceId,
    amountPaid,
  };
}

async scheduleDowngrade(tenantId: number, nextPlan: Plan) {
  if (!tenantId) throw new BadRequestException('tenantId が不正です');

  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      plan: true, // アプリ内の現在プラン（参考）
    },
  });

  if (!tenant?.stripeCustomerId || !tenant.stripeSubscriptionId) {
    throw new BadRequestException('有効なサブスクがありません');
  }

  const nextPriceId = this.planToPriceId(nextPlan);

  // StripeのSubscriptionを取得
  let sub: Stripe.Subscription;
  try {
    sub = await this.stripe.subscriptions.retrieve(
      tenant.stripeSubscriptionId,
    );
  } catch (err) {
    this.sanitizeStripeError(err);
  }

  const currentPriceId = sub!.items?.data?.[0]?.price?.id ?? null;
  const currentPlan = currentPriceId ? this.priceToPlan[currentPriceId] : undefined;

  if (!currentPlan) {
    throw new BadRequestException(
      `現在プランが特定できません（priceToPlan未設定の可能性）。currentPriceId=${currentPriceId}`,
    );
  }

  // ダウングレードだけ許可（同じ/アップは別ルート）
  if (this.PLAN_RANK[nextPlan] >= this.PLAN_RANK[currentPlan]) {
    return {
      ok: true,
      message: 'ダウングレードではありません（アップグレードは upgrade-now を使用）',
      currentPlan,
      nextPlan,
    };
  }

  // current_period_end を取得（API バージョンによって場所が異なる）
  const subAny = sub! as any;
  const item0 = subAny.items?.data?.[0];
  const currentPeriodEndUnix: number | null =
    subAny.current_period_end ?? item0?.current_period_end ?? null;

  this.logger.log(
    `scheduleDowngrade: current_period_end=${currentPeriodEndUnix}, sub.status=${sub.status}`,
  );

  if (!currentPeriodEndUnix) {
    this.logger.error(
      `scheduleDowngrade: period fields missing. sub keys=${Object.keys(subAny).join(', ')}`,
    );
    throw new BadRequestException('current_period_end が取得できません');
  }

  // subscription schedule を使わず直接 price を変更（proration なし）
  // → Stripe 側は次回更新から新プランで請求される
  // → 今期は既に支払い済みなので差額は発生しない
  // → DB 上は nextPlan/nextPlanStartAt で管理し、plan は今期末まで維持する
  const item = sub!.items.data[0];
  try {
    await this.stripe.subscriptions.update(sub!.id, {
      items: [{ id: item.id, price: nextPriceId }],
      proration_behavior: 'none',
    });
  } catch (err) {
    this.sanitizeStripeError(err);
  }

  const effectiveAt = new Date(currentPeriodEndUnix * 1000);

  // DB: plan はそのまま維持、nextPlan/nextPlanStartAt で予約を記録
  await this.prisma.tenant.update({
    where: { id: tenantId },
    data: {
      nextPlan,
      nextPlanStartAt: effectiveAt,
    },
  });

  return {
    ok: true,
    message: '次回更新でダウングレード予約しました',
    currentPlan,
    nextPlan,
    effectiveAt: effectiveAt.toISOString(),
  };
}

}
