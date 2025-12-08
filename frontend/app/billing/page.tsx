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
} | null;

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// 認証トークン取得
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

  const [creating, setCreating] = useState<'BASIC' | 'STANDARD' | 'PRO' | null>(
    null,
  );

  // ログインユーザー情報の取得
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setError('先にログインしてください（トップページからログイン）');
      setLoading(false);
      return;
    }

    const fetchMe = async () => {
      try {
        const res = await fetch(`${apiBase}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          setError('ユーザー情報が取得できません。再ログインしてください。');
          setLoading(false);
          return;
        }

        const data = (await res.json()) as Me;
        setMe(data);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError('ユーザー情報の取得中にエラーが発生しました。');
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  // 課金状態の取得
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    if (!me?.tenantId) return;

    const fetchStatus = async () => {
      try {
        setBillingLoading(true);
        const res = await fetch(`${apiBase}/billing/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`, // 認証付きにしたくなったとき用
          },
          body: JSON.stringify({ tenantId: me.tenantId }),
        });

        if (!res.ok) {
          console.error('billing/status error', await res.text());
          setBillingStatus(null);
          setBillingLoading(false);
          return;
        }

        const data = (await res.json()) as { tenant: BillingStatus };
        setBillingStatus(data.tenant);
        setBillingLoading(false);
      } catch (e) {
        console.error(e);
        setBillingStatus(null);
        setBillingLoading(false);
      }
    };

    fetchStatus();
  }, [me]);

  // サブスク開始ボタン押下時の処理
  const handleStartSubscription = async (
    plan: 'BASIC' | 'STANDARD' | 'PRO',
  ) => {
    const token = getAuthToken();
    if (!token) {
      setError('ログイン情報が見つかりません。再ログインしてください。');
      return;
    }

    if (!me?.tenantId) {
      setError('テナント情報が取得できません。管理者に連絡してください。');
      return;
    }

    setCreating(plan);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/billing/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenantId: me.tenantId,
          plan,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error('create-checkout-session error', data);
        setError(
          data?.message ??
            '決済用セッションの作成に失敗しました。時間をおいて再度お試しください。',
        );
        setCreating(null);
        return;
      }

      const data = (await res.json()) as { url?: string };

      if (!data.url) {
        setError('決済画面のURLが取得できませんでした。');
        setCreating(null);
        return;
      }

      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      setError('決済処理の開始中にエラーが発生しました。');
      setCreating(null);
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="p-4">読み込み中...</div>
      </TenantLayout>
    );
  }

  if (error) {
    return (
      <TenantLayout>
        <div className="p-4 text-red-600 whitespace-pre-line">{error}</div>
      </TenantLayout>
    );
  }

  if (!me) {
    return (
      <TenantLayout>
        <div className="p-4">ユーザー情報が取得できませんでした。</div>
      </TenantLayout>
    );
  }

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('ja-JP');
  };

  return (
    <TenantLayout>
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">サブスクリプション管理</h1>
            <p className="text-sm text-gray-600 mt-1">
              テナントID: {me.tenantId ?? '-'} / ログインユーザー:{' '}
              {me.email}（{me.role}）
            </p>
          </div>

          <button
            className="text-sm text-blue-600 underline"
            onClick={() => router.push('/dashboard')}
          >
            ダッシュボードに戻る
          </button>
        </div>

        {/* 現在のサブスク状態 */}
        <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
          <h2 className="text-sm font-semibold">現在の契約状態</h2>
          {billingLoading && <p className="text-sm">取得中...</p>}
          {!billingLoading && !billingStatus && (
            <p className="text-sm text-gray-600">
              契約情報がまだ登録されていません。
              Stripe 決済後に順次反映される予定です。
            </p>
          )}
          {!billingLoading && billingStatus && (
            <div className="text-sm space-y-1">
              <p>
                プラン（アプリ内）: <b>{billingStatus.plan}</b>
              </p>
              <p>
                Stripe ステータス:{' '}
                <b>{billingStatus.subscriptionStatus ?? '-'}</b>
              </p>
              <p>
                有効期限（アプリ側 validUntil）:{' '}
                {formatDateTime(billingStatus.validUntil)}
              </p>
              <p>
                課金期間終了予定（Stripe currentPeriodEnd）:{' '}
                {formatDateTime(billingStatus.currentPeriodEnd)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ※ まだ Webhook 連携前の場合は、値が空のまま表示されます。
              </p>
            </div>
          )}
        </div>

        {/* プラン一覧 */}
        <div className="grid gap-4 md:grid-cols-3">
          <PlanCard
            name="BASIC"
            priceLabel="月額 9,800円（例）"
            description="まずはお試し用の基本プラン。リマインド機能・予約管理などのコア機能を利用可能。"
            disabled={creating !== null}
            loading={creating === 'BASIC'}
            onClick={() => handleStartSubscription('BASIC')}
          />
          <PlanCard
            name="STANDARD"
            priceLabel="月額 15,000円（例）"
            description="メッセージ配信などを強化した標準プラン。今後の拡張もこのプランを前提に検討。"
            disabled={creating !== null}
            loading={creating === 'STANDARD'}
            onClick={() => handleStartSubscription('STANDARD')}
          />
          <PlanCard
            name="PRO"
            priceLabel="月額 20,000円（例）"
            description="大型店舗・複数拠点向けの上位プラン。将来的に機能制限と連動させる予定。"
            disabled={creating !== null}
            loading={creating === 'PRO'}
            onClick={() => handleStartSubscription('PRO')}
          />
        </div>

        <p className="text-xs text-gray-500">
          ※ 現時点ではテスト決済環境です。実運用前に金額・プラン内容・利用規約などを必ず確認してください。
        </p>
      </div>
    </TenantLayout>
  );
}

type PlanCardProps = {
  name: 'BASIC' | 'STANDARD' | 'PRO';
  priceLabel: string;
  description: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
};

function PlanCard({
  name,
  priceLabel,
  description,
  disabled,
  loading,
  onClick,
}: PlanCardProps) {
  return (
    <div className="border rounded-lg p-4 flex flex-col justify-between h-full">
      <div>
        <h2 className="text-lg font-semibold mb-1">{name} プラン</h2>
        <p className="font-bold mb-2">{priceLabel}</p>
        <p className="text-sm text-gray-600 whitespace-pre-line">
          {description}
        </p>
      </div>

      <button
        className="mt-4 w-full py-2 rounded-md bg-green-600 text-white text-sm font-semibold disabled:opacity-60"
        onClick={onClick}
        disabled={disabled}
      >
        {loading ? '決済画面へ遷移中...' : `${name} プランで契約手続きへ`}
      </button>
    </div>
  );
}
