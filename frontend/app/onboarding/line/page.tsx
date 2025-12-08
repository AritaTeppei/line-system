// frontend/app/onboarding/line/page.tsx
'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TenantLayout from '../../components/TenantLayout';

type Role = 'DEVELOPER' | 'MANAGER' | 'CLIENT';

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
};

type LineSettingsForm = {
  channelId: string;
  channelSecret: string;
  accessToken: string;
  webhookUrl: string;
  destination: string;
  isActive: boolean;
};

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  const fromSession = window.sessionStorage.getItem('auth_token');
  if (fromSession) return fromSession;

  return window.localStorage.getItem('auth_token');
}

export default function LineOnboardingPage() {
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<LineSettingsForm>({
    channelId: '',
    channelSecret: '',
    accessToken: '',
    webhookUrl: '',
    destination: '',
    isActive: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 画面全体を止める系
  const [pageError, setPageError] = useState<string | null>(null);
  // 入力エラーや保存失敗
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 初期ロード：auth/me → tenantId 確定 → /tenants/:tenantId/line-settings を取得
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setPageError('ログイン情報が見つかりません。再ログインしてください。');
      setLoading(false);
      return;
    }

    const headersBase: HeadersInit = {
      Authorization: `Bearer ${token}`,
    };

    (async () => {
      try {
        // ① /auth/me で自分を取得
        const meRes = await fetch(`${apiBase}/auth/me`, {
          headers: headersBase,
        });
        if (!meRes.ok) throw new Error('auth/me api error');
        const meData: Me = await meRes.json();
        setMe(meData);

        if (!meData.tenantId) {
          throw new Error('テナント情報が見つかりません。');
        }

        // ② そのテナントの LINE 設定を取得
        const lsRes = await fetch(
          `${apiBase}/tenants/${meData.tenantId}/line-settings`,
          {
            headers: headersBase,
          },
        );

        if (!lsRes.ok) {
          // 404 等なら「未設定」として空フォーム
          console.warn('line-settings fetch error', lsRes.status);
          setForm({
            channelId: '',
            channelSecret: '',
            accessToken: '',
            webhookUrl: '',
            destination: '',
            isActive: false,
          });
        } else {
          const data = await lsRes.json();
          setForm({
            channelId: data.channelId ?? '',
            channelSecret: data.channelSecret ?? '',
            accessToken: data.accessToken ?? '',
            webhookUrl: data.webhookUrl ?? '',
            destination: data.destination ?? '',
            isActive: data.isActive ?? false,
          });
        }
      } catch (err: any) {
        console.error(err);
        setPageError(
          err?.message ??
            '初期設定画面の読み込みに失敗しました。時間をおいて再度お試しください。',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (
    key: keyof LineSettingsForm,
    value: string | boolean,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]:
        key === 'isActive'
          ? Boolean(value)
          : (value as string),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setMessage(null);

    const token = getAuthToken();
    if (!token) {
      setFormError('ログイン情報が見つかりません。再ログインしてください。');
      return;
    }

    if (!me?.tenantId) {
      setFormError('テナント情報が取得できていません。');
      return;
    }

    // 必須入力チェック（必要最低限）
    if (!form.channelId.trim()) {
      setFormError('チャネルIDは必須です。');
      return;
    }
    if (!form.channelSecret.trim()) {
      setFormError('チャネルシークレットは必須です。');
      return;
    }
    if (!form.accessToken.trim()) {
      setFormError('アクセストークンは必須です。');
      return;
    }
    if (form.webhookUrl && !form.webhookUrl.startsWith('https://')) {
      setFormError('Webhook URLは https:// から始まる必要があります。');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(
        `${apiBase}/tenants/${me.tenantId}/line-settings`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        },
      );

      if (!res.ok) {
        const text = await res.text();
        console.error('line-settings update error', text);
        throw new Error('LINE設定の保存に失敗しました。');
      }

      setMessage('LINE設定を保存しました。');
    } catch (err: any) {
      console.error(err);
      setFormError(
        err?.message ??
          'LINE設定の保存中にエラーが発生しました。',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="p-4 text-sm text-gray-700">読み込み中...</div>
      </TenantLayout>
    );
  }

  if (pageError) {
    return (
      <TenantLayout>
        <div className="max-w-3xl mx-auto p-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {pageError}
          </div>
          <button
            className="mt-4 px-3 py-1 text-xs border rounded"
            onClick={() => router.push('/dashboard')}
          >
            ダッシュボードへ戻る
          </button>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-green-700">
            初期設定：LINE連携
          </h1>
          <p className="text-xs sm:text-sm text-gray-600">
            自社のLINE公式アカウントとこのシステムを連携するための設定を行います。
            下記にチャネル情報とWebhook URLを入力し、「保存」を押してください。
          </p>
        </header>

        {/* メッセージ表示 */}
        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {formError}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {message}
          </div>
        )}

        {/* 設定フォーム */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4 text-xs sm:text-sm text-gray-800">
          <h2 className="font-semibold text-gray-900">
            LINEチャネル設定
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                チャネルID
              </label>
              <input
                type="text"
                className="w-full border rounded px-2 py-1 text-xs"
                value={form.channelId}
                onChange={(e) =>
                  handleChange('channelId', e.target.value)
                }
                placeholder="LINE Developers のチャネルID"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                チャネルシークレット
              </label>
              <input
                type="text"
                className="w-full border rounded px-2 py-1 text-xs"
                value={form.channelSecret}
                onChange={(e) =>
                  handleChange('channelSecret', e.target.value)
                }
                placeholder="LINE Developers のチャネルシークレット"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                アクセストークン（長期）
              </label>
              <textarea
                className="w-full border rounded px-2 py-1 text-xs h-20"
                value={form.accessToken}
                onChange={(e) =>
                  handleChange('accessToken', e.target.value)
                }
                placeholder="発行した長期アクセストークンを貼り付け"
              />
            </div>

            {/* <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Webhook URL
              </label>
              <input
                type="text"
                className="w-full border rounded px-2 py-1 text-xs"
                value={form.webhookUrl}
                onChange={(e) =>
                  handleChange('webhookUrl', e.target.value)
                }
                placeholder="https://.../line/webhook のようなURL"
              />
              <p className="mt-1 text-[10px] text-gray-500">
                ※ 実際には環境ごとに固定の Webhook URL をここに表示させ、
                LINE 側の設定画面にコピーしてもらう運用にしていきます。
              </p>
            </div> */}

            <div>
  <label className="block text-xs font-semibold text-gray-700 mb-1">
    LINE Bot ユーザーID（destination）
  </label>
  <input
    type="text"
    className="w-full border rounded px-2 py-1 text-xs bg-gray-100 text-gray-700"
    value={form.destination}
    readOnly
  />
  <p className="mt-1 text-[10px] text-gray-500">
    ※ チャネルのアクセストークン保存時に自動取得されます。
    手動での編集はできません。
  </p>
</div>


            <div className="flex items-center gap-2">
              <input
                id="ls-active"
                type="checkbox"
                className="w-3 h-3"
                checked={form.isActive}
                onChange={(e) =>
                  handleChange('isActive', e.target.checked)
                }
              />
              <label
                htmlFor="ls-active"
                className="text-[11px] text-gray-700"
              >
                このテナントでLINE連携を有効にする
              </label>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-green-600 text-white text-xs sm:text-sm font-semibold disabled:opacity-60"
                disabled={saving}
              >
                {saving ? '保存中...' : '設定を保存する'}
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-md border border-gray-300 text-xs sm:text-sm"
                onClick={() => router.push('/dashboard')}
              >
                ダッシュボードへ戻る
              </button>
            </div>
          </form>
        </section>

        {/* ガイドは前と同じノリで残す */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 space-y-3 text-xs sm:text-sm text-gray-800">
          <h2 className="font-semibold text-gray-900">
            STEP1：LINE公式アカウントの準備
          </h2>
          <ol className="list-decimal list-inside space-y-1">
            <li>LINE Official Account Manager にログインします。</li>
            <li>このシステムで利用したいLINE公式アカウントを選択します。</li>
            <li>「Messaging API」タブから、チャネルID・チャネルシークレット・アクセストークンを確認できます。</li>
          </ol>
        </section>
      </div>
    </TenantLayout>
  );
}
