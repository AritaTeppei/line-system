// frontend/app/billing/cancel/page.tsx
'use client';

import TenantLayout from '../../components/TenantLayout';
import { useRouter } from 'next/navigation';

export default function BillingCancelPage() {
  const router = useRouter();

  return (
    <TenantLayout>
      <div className="p-4 space-y-6">
        <h1 className="text-xl font-bold">決済をキャンセルしました</h1>

        <p className="text-sm text-gray-700 whitespace-pre-line">
          Stripe の決済画面でキャンセルが選択されたか、ウィンドウが閉じられました。
          {'\n'}
          現時点ではサブスクリプション契約は行われていません。
        </p>

        <div className="flex gap-3 mt-4">
          <button
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold"
            onClick={() => router.push('/billing')}
          >
            プラン選択画面に戻る
          </button>
          <button
            className="px-4 py-2 rounded-md bg-gray-200 text-sm"
            onClick={() => router.push('/dashboard')}
          >
            ダッシュボードへ戻る
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          ※ 実際の運用では「キャンセル理由のヒアリング」や「別プランの提案」などの
          導線をここに追加することも検討できます。
        </p>
      </div>
    </TenantLayout>
  );
}
