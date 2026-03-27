// frontend/app/billing/page.tsx
'use client';

import { useEffect, useState } from 'react';
import TenantLayout from '../components/TenantLayout';
import { useRouter } from 'next/navigation';

type Role = 'DEVELOPER' | 'MANAGER' | 'CLIENT';

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
};

type BillingStatus = {
  id: number;
  name: string;
  email: string;
  plan: string;
  isActive: boolean;
  validUntil: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  nextPlan: string | null;
  nextPlanStartAt: string | null;
  trialEnd: string | null;
} | null;

type Plan = 'BASIC' | 'STANDARD' | 'PRO';
const PLAN_RANK: Record<Plan, number> = { BASIC: 1, STANDARD: 2, PRO: 3 };
const VALID_PLANS: Plan[] = ['BASIC', 'STANDARD', 'PRO'];

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** APIエラーメッセージからStripeのAPIキー等の機密情報を除去する */
function sanitizeErrorMessage(msg: unknown): string {
  if (typeof msg !== 'string') return '予期しないエラーが発生しました。';
  // sk_test_ / sk_live_ を含む場合はマスクする
  if (/sk_(test|live)_/.test(msg)) {
    return '決済サービスの設定にエラーがあります（管理者に連絡してください）。';
  }
  return msg;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const fromSession = window.sessionStorage.getItem('auth_token');
  if (fromSession) return fromSession;
  return window.localStorage.getItem('auth_token');
}

export default function BillingPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [billingStatus, setBillingStatus] = useState<BillingStatus>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  const [creating, setCreating] = useState<Plan | null>(null);
  const [changing, setChanging] = useState<Plan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [changeResult, setChangeResult] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setError('先にログインしてください（トップページからログイン）');
      setLoading(false);
      return;
    }

    fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error('ユーザー情報が取得できません。再ログインしてください。');
        return res.json();
      })
      .then((data: Me) => { setMe(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const fetchBillingStatus = async (tenantId: number) => {
    const token = getAuthToken();
    if (!token) return;
    setBillingLoading(true);
    try {
      const res = await fetch(`${apiBase}/billing/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) { setBillingStatus(null); return; }
      const data = (await res.json()) as { tenant: BillingStatus };
      setBillingStatus(data.tenant);
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    if (me?.tenantId) fetchBillingStatus(me.tenantId);
  }, [me]);

  const handleStartSubscription = async (plan: Plan) => {
    const token = getAuthToken();
    if (!token || !me?.tenantId) { setError('ログイン情報が見つかりません。'); return; }
    setCreating(plan);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/billing/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: me.tenantId, plan }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(sanitizeErrorMessage(data?.message ?? '決済用セッションの作成に失敗しました。'));
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) { setError('決済画面のURLが取得できませんでした。'); return; }
      window.location.href = data.url;
    } catch { setError('決済処理の開始中にエラーが発生しました。'); }
    finally { setCreating(null); }
  };

  const handleChangePlan = async (plan: Plan) => {
    const token = getAuthToken();
    if (!token) { setError('ログイン情報が見つかりません。'); return; }
    if (!billingStatus) return;

    const currentPlan = billingStatus.plan as Plan;
    const isUpgrade = PLAN_RANK[plan] > PLAN_RANK[currentPlan];
    const endpoint = isUpgrade ? '/billing/upgrade-now' : '/billing/downgrade-next';

    setChanging(plan);
    setChangeResult(null);
    setError(null);

    try {
      const res = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(sanitizeErrorMessage(data?.message ?? 'プラン変更に失敗しました。'));
        return;
      }
      const msg = isUpgrade
        ? `✅ ${plan}プランへのアップグレードが完了しました。`
        : `📅 ${plan}プランへのダウングレードを次回更新時に適用予定で登録しました。`;
      setChangeResult(msg);
      if (me?.tenantId) await fetchBillingStatus(me.tenantId);
    } catch { setError('プラン変更中にエラーが発生しました。'); }
    finally { setChanging(null); }
  };

  const handleOpenPortal = async () => {
    const token = getAuthToken();
    if (!token) { setError('ログイン情報が見つかりません。'); return; }
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/billing/create-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(sanitizeErrorMessage(data?.message ?? 'サブスク管理画面の起動に失敗しました。'));
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) { setError('サブスク管理画面のURLが取得できませんでした。'); return; }
      window.location.href = data.url;
    } catch { setError('サブスク管理画面への遷移中にエラーが発生しました。'); }
    finally { setPortalLoading(false); }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-500 text-sm animate-pulse">読み込み中...</div>
        </div>
      </TenantLayout>
    );
  }

  if (error && !me) {
    return (
      <TenantLayout>
        <div className="max-w-xl mx-auto mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">{error}</div>
      </TenantLayout>
    );
  }

  if (!me) return null;

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('ja-JP');
  };

  const isSubscriptionActive =
    !!billingStatus?.subscriptionStatus === true &&
    billingStatus?.subscriptionStatus === 'active' &&
    !!billingStatus?.stripeSubscriptionId;

  const isTrial = billingStatus?.plan === 'TRIAL' || !isSubscriptionActive;

  const currentPlan = (billingStatus?.plan ?? '') as Plan;
  const isValidPlan = VALID_PLANS.includes(currentPlan);

  let trialRemainingDays: number | null = null;
  if (billingStatus?.trialEnd) {
    const end = new Date(billingStatus.trialEnd);
    trialRemainingDays = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  return (
    <TenantLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              💳 サブスクリプション管理
            </h1>
            <p className="text-sm text-gray-500 mt-1">プランの確認・変更・解約はこちらから</p>
          </div>
          <button className="text-sm text-green-600 font-semibold hover:text-green-700" onClick={() => router.push('/dashboard')}>
            ← ダッシュボードへ
          </button>
        </div>

        {/* エラー・結果メッセージ */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}
        {changeResult && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-semibold">{changeResult}</div>
        )}

        {/* トライアル中バナー */}
        {isTrial && (
          <div className="rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 p-px shadow-lg">
            <div className="rounded-2xl bg-white/95 px-5 py-4 flex flex-col sm:flex-row items-center gap-4">
              <div className="text-4xl">⏳</div>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-black text-xl text-gray-900">
                  トライアル期間中
                  {trialRemainingDays !== null && (
                    <span className="ml-2 text-orange-500">残り <span className="text-3xl">{Math.max(0, trialRemainingDays)}</span> 日</span>
                  )}
                </p>
                <p className="text-sm text-gray-600 mt-1">プランに登録すると件数制限が外れフル機能が使えます！</p>
              </div>
            </div>
          </div>
        )}

        {/* 現在の契約状態 */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">📋 現在の契約状態</h2>
          </div>
          <div className="px-5 py-4">
            {billingLoading && <p className="text-sm text-gray-400 animate-pulse">取得中...</p>}
            {!billingLoading && billingStatus && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-[10px] text-gray-500 font-medium">現在のプラン</p>
                  <p className="font-black text-gray-900 text-sm mt-0.5">{billingStatus.plan}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-[10px] text-gray-500 font-medium">ステータス</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold mt-0.5 ${
                    billingStatus.subscriptionStatus === 'active' ? 'bg-emerald-100 text-emerald-700'
                    : billingStatus.subscriptionStatus === 'past_due' ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}>
                    {billingStatus.subscriptionStatus ?? 'トライアル中'}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-[10px] text-gray-500 font-medium">有効期限</p>
                  <p className="font-bold text-gray-900 text-xs mt-0.5">{formatDateTime(billingStatus.validUntil)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-[10px] text-gray-500 font-medium">次回課金</p>
                  <p className="font-bold text-gray-900 text-xs mt-0.5">{formatDateTime(billingStatus.currentPeriodEnd)}</p>
                </div>
              </div>
            )}
            {/* ダウングレード予約表示 */}
            {billingStatus?.nextPlan && billingStatus.nextPlanStartAt && (
              <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                📅 <b>{billingStatus.nextPlan}プラン</b>へのダウングレードが {formatDateTime(billingStatus.nextPlanStartAt)} から適用予定です。
              </div>
            )}
          </div>
        </div>

        {/* ===== サブスク未登録：新規契約 ===== */}
        {!isSubscriptionActive && (
          <div id="plans">
            <h2 className="text-lg font-black text-gray-900 mb-4">🎯 プランを選んで始める</h2>
            <div className="grid gap-5 md:grid-cols-3">
              <PlanCard name="BASIC" price="9,800" tagline="まずはここから"
                features={['顧客・車両・予約管理', 'LINEリマインド送信', '基本メッセージ機能', 'スタッフ1名ログイン', 'ダッシュボード確認']}
                disabled={creating !== null} loading={creating === 'BASIC'}
                onClick={() => handleStartSubscription('BASIC')} />
              <PlanCard name="STANDARD" price="15,000" tagline="一番人気のプラン" recommended
                features={['BASICの全機能', 'スタッフ2名ログイン', '高度なメッセージ配信', '予約の一括管理', 'カスタムリマインド']}
                disabled={creating !== null} loading={creating === 'STANDARD'}
                onClick={() => handleStartSubscription('STANDARD')} />
              <PlanCard name="PRO" price="20,000" tagline="大型店舗・多店舗向け"
                features={['STANDARDの全機能', 'スタッフ3名ログイン', '複数拠点対応', '優先サポート', '大量データ対応']}
                disabled={creating !== null} loading={creating === 'PRO'}
                onClick={() => handleStartSubscription('PRO')} />
            </div>
            <p className="mt-4 text-xs text-gray-400 text-center">
              ※ 現時点ではテスト決済環境です。実運用前に金額・プラン内容・利用規約などを必ず確認してください。
            </p>
          </div>
        )}

        {/* ===== サブスク契約中：プラン変更 ===== */}
        {isSubscriptionActive && isValidPlan && (
          <div>
            <h2 className="text-lg font-black text-gray-900 mb-2">🔄 プランを変更する</h2>
            <p className="text-xs text-gray-500 mb-4">
              アップグレードは即時反映・差額請求。ダウングレードは次回更新時に適用されます。
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {VALID_PLANS.map((plan) => {
                const isCurrent = plan === currentPlan;
                const isUpgrade = PLAN_RANK[plan] > PLAN_RANK[currentPlan];
                const prices: Record<Plan, string> = { BASIC: '9,800', STANDARD: '15,000', PRO: '20,000' };
                return (
                  <div key={plan} className={`rounded-2xl border-2 p-4 flex flex-col gap-3 ${
                    isCurrent ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-black text-gray-900">{plan}</p>
                        <p className="text-xs text-gray-500">月額 {prices[plan]}円</p>
                      </div>
                      {isCurrent && (
                        <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">現在のプラン</span>
                      )}
                    </div>
                    {!isCurrent && (
                      <button
                        className={`w-full py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                          isUpgrade
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                        }`}
                        onClick={() => handleChangePlan(plan)}
                        disabled={changing !== null}
                      >
                        {changing === plan ? '⏳ 処理中...' : isUpgrade ? `⬆️ ${plan}にアップグレード` : `⬇️ ${plan}にダウングレード`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 解約・支払い方法変更 */}
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <h2 className="text-sm font-bold text-red-700 flex items-center gap-2 mb-2">⚠️ 解約・お支払い情報の変更</h2>
          <p className="text-xs text-red-600 mb-3">解約やクレジットカード情報の変更は、Stripeの管理画面から行います。</p>
          <button
            type="button"
            onClick={handleOpenPortal}
            disabled={portalLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors"
          >
            {portalLoading ? '⏳ 遷移中...' : '🔧 解約・お支払い管理（Stripe）'}
          </button>
        </div>
      </div>
    </TenantLayout>
  );
}

type PlanCardProps = {
  name: Plan;
  price: string;
  tagline: string;
  features: string[];
  recommended?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
};

function PlanCard({ name, price, tagline, features, recommended, disabled, loading, onClick }: PlanCardProps) {
  const s = {
    BASIC: { border: 'border-gray-200', bg: 'bg-white', icon: '🔵', btn: 'bg-gray-700 hover:bg-gray-800 text-white', priceColor: 'text-gray-900', tagColor: 'text-gray-500' },
    STANDARD: { border: 'border-green-300', bg: 'bg-gradient-to-b from-green-50 to-white', icon: '⭐', btn: 'bg-green-500 hover:bg-green-600 text-white', priceColor: 'text-green-700', tagColor: 'text-green-600' },
    PRO: { border: 'border-purple-200', bg: 'bg-gradient-to-b from-purple-50 to-white', icon: '💎', btn: 'bg-purple-600 hover:bg-purple-700 text-white', priceColor: 'text-purple-700', tagColor: 'text-purple-500' },
  }[name];

  return (
    <div className={`relative rounded-2xl border-2 ${s.border} ${s.bg} p-5 flex flex-col justify-between ${recommended ? 'shadow-xl scale-[1.02]' : 'shadow-sm'}`}>
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-green-500 text-white text-xs font-black px-4 py-1 rounded-full shadow-sm whitespace-nowrap">🌟 一番人気</span>
        </div>
      )}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{s.icon}</span>
          <h2 className="text-lg font-black text-gray-900">{name}</h2>
        </div>
        <p className={`text-xs font-semibold ${s.tagColor} mb-3`}>{tagline}</p>
        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-gray-400">月額</span>
            <span className={`text-3xl font-black ${s.priceColor}`}>{price}</span>
            <span className="text-xs text-gray-400">円</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">（税別 / 例）</p>
        </div>
        <ul className="space-y-1.5 mb-5">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <span className="text-emerald-500 flex-shrink-0 font-bold">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
      <button
        className={`w-full py-3 rounded-xl font-bold text-sm ${s.btn} disabled:opacity-50 transition-all`}
        onClick={onClick}
        disabled={disabled}
      >
        {loading ? '⏳ 決済画面へ遷移中...' : `✨ ${name}プランで始める`}
      </button>
    </div>
  );
}
