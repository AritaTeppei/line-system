// frontend/app/billing/success/page.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import TenantLayout from '../../components/TenantLayout';
import { useEffect, useState } from 'react';

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get('session_id');
    if (id) {
      setSessionId(id);
    }
  }, [searchParams]);

  return (
    <TenantLayout>
      <div className="p-4 space-y-6">
        <h1 className="text-xl font-bold">ご契約ありがとうございます</h1>

        <p className="text-sm text-gray-700 whitespace-pre-line">
          サブスクリプションの決済が完了しました。
          {'\n'}
          現在はテスト環境のため、実際の請求は発生していません。
        </p>

        {sessionId && (
          <div className="text-xs text-gray-500">
            Checkout Session ID:{' '}
            <span className="font-mono break-all">{sessionId}</span>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-semibold"
            onClick={() => router.push('/dashboard')}
          >
            ダッシュボードへ戻る
          </button>
          <button
            className="px-4 py-2 rounded-md bg-gray-200 text-sm"
            onClick={() => router.push('/billing')}
          >
            プラン画面に戻る
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          ※ 後ほど、Stripe Webhook を利用してテナントのプラン状態を自動更新する仕組みを追加します。
          現時点では UI のみの動作確認フェーズです。
        </p>
      </div>
    </TenantLayout>
  );
}
