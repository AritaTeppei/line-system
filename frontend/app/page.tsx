'use client';

import { FormEvent, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type Role = 'DEVELOPER' | 'MANAGER' | 'CLIENT';

type LoginResponse = {
  token: string;
  email: string;
  tenantId: number | null;
  role: Role;
  message?: string;
};

type MeResponse = {
  id: number;
  email: string;
  tenantId: number | null;
  role: Role;
};

const SAVED_EMAIL_KEY = 'pitlink_saved_login_email';


export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // ★ サブスク関連エラー用の情報（billingError はやめて一本化）
  const [tenantErrorInfo, setTenantErrorInfo] = useState<{
    errorCode: 'TENANT_INACTIVE' | 'TENANT_EXPIRED';
    tenantId: number;
    tenantName?: string;
    plan?: string | null;
    validUntil?: string | null;
    rawMessage: string;
  } | null>(null);


  // すでにトークンがある場合は自動遷移
      useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = window.localStorage.getItem(SAVED_EMAIL_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }

      // ★ Stripe 決済の戻りクエリを window.location.search から読む
      const qs = new URLSearchParams(window.location.search);
      const billingStatus = qs.get('billing');

      if (billingStatus === 'success') {
        setInfoMessage(
          'サブスク登録・お支払いが完了しました。\nありがとうございました。\n再度ログインしてご利用を開始してください。',
        );
      } else if (billingStatus === 'cancel') {
        setInfoMessage(
          '決済がキャンセルされました。\n必要に応じて、もう一度サブスク登録をお試しください。',
        );
      } else {
        // クエリが無ければメッセージはクリア
        setInfoMessage(null);
      }
    } else {
      // SSR中など window がないときは一旦クリア
      setInfoMessage(null);
    }

    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;

    if (!token) return;

    const run = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const data = (await res.json()) as MeResponse;

        if (data.role === 'DEVELOPER') {
          router.replace('/admin/tenants');
        } else {
          router.replace('/dashboard');
        }
      } catch {}
    };

    run();
  }, [router]); // ★ searchParams を依存配列から削除


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setTenantErrorInfo(null);

    if (typeof window !== 'undefined') {
      if (rememberEmail) {
        window.localStorage.setItem(SAVED_EMAIL_KEY, email);
      } else {
        window.localStorage.removeItem(SAVED_EMAIL_KEY);
      }
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const raw = (await res.json().catch(() => null)) as any;

// ★ 1) TENANT_INACTIVE / TENANT_EXPIRED を最初に判定
      if (
        res.status === 403 &&
        raw &&
        (raw.error === 'TENANT_INACTIVE' || raw.error === 'TENANT_EXPIRED') &&
        raw.tenantId
      ) {
        setTenantErrorInfo({
          errorCode: raw.error,
          tenantId: Number(raw.tenantId),
          tenantName: raw.tenantName,
          plan: raw.plan ?? null,
          validUntil: raw.validUntil ?? null,
          rawMessage:
            raw.message ??
            'このテナントは現在ご利用いただけません。サブスク再開で利用できます。',
        });

        // 赤いエラーは一応メッセージだけ見せておく
        setError(
          raw.message ??
            'このテナントは現在ご利用いただけません。サブスク再開で利用できます。',
        );

        setLoading(false);
        return; // ★ ここで終了（通常のログイン処理には進まない）
      }

      // ★ ここから下は「今まで通りの判定」に少し書き換えるだけ
      const data = raw as LoginResponse | { message?: string } | null;

       if (!res.ok || !data || (data as any).token === undefined) {
      const anyData = data as any;

      // ★ テナント停止 or 期限切れのときだけ専用処理
      if (
        anyData &&
        (anyData.error === 'TENANT_INACTIVE' ||
          anyData.error === 'TENANT_EXPIRED') &&
        anyData.tenantId
      ) {
        setTenantErrorInfo({
          errorCode: anyData.error,
          tenantId: Number(anyData.tenantId),
          tenantName: anyData.tenantName,
          plan: anyData.plan,
          validUntil: anyData.validUntil,
          rawMessage:
            anyData.message ??
            'このテナントは現在ご利用いただけません。サブスク再開で利用できます。',
        });

        // 通常のエラーメッセージも一応セット
        setError(
          anyData.message ??
            'このテナントは現在ご利用いただけません。サブスク再開で利用できます。',
        );

        setLoading(false);
        return; // ★ ここで終了（例外は投げない）
      }

        const msg =
          (data as any)?.message ||
          (Array.isArray((data as any)?.message)
            ? (data as any).message.join(', ')
            : null) ||
          'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
        throw new Error(msg);
      }

      const loginData = data as LoginResponse;

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('auth_token', loginData.token);
      }

      if (loginData.role === 'DEVELOPER') {
        router.replace('/admin/tenants');
      } else {
        router.replace('/dashboard');
      }


    } catch (err: any) {
      console.error(err);
      if (err?.name === 'TypeError') {
        setError(
          'サーバーに接続できませんでした。\nbackend が起動しているかを確認してください。',
        );
      } else {
        setError(err?.message || 'ログイン処理中にエラーが発生しました。');
      }
    } finally {
      setLoading(false);
    }
  };

    const handleStartSubscriptionFromLogin = async (
    plan: 'BASIC' | 'STANDARD' | 'PRO' = 'BASIC',
  ) => {
    if (!tenantErrorInfo) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/billing/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // ★ いまは「期限切れでログインできていない状態」から叩く想定なので
            // Authorization ヘッダーは付けていない。
            // もしここで 401 が出るようなら、次のステップで backend 側の Guard を調整する。
          },
          body: JSON.stringify({
            tenantId: tenantErrorInfo.tenantId,
            plan,
            fromLogin: true, 
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error('create-checkout-session error', data);
        setError(
          data?.message ??
            '決済用セッションの作成に失敗しました。時間をおいて再度お試しください。',
        );
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { url?: string };

      if (!data.url) {
        setError('決済画面のURLが取得できませんでした。');
        setLoading(false);
        return;
      }

      // Stripe のチェックアウト画面へ遷移
      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      setError('決済処理の開始中にエラーが発生しました。');
      setLoading(false);
    }
  };

  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-gray-600">読み込み中です...</p>
        </main>
      }
    >
      <main className="min-h-screen flex flex-col items-center justify-between px-4 py-6">
            <div className="w-full max-w-md">
        {/* ロゴ・タイトル */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-[200px] mx-auto mb-4">
            <Image
              src="/pitlink-logo.png"
              alt="PitLink ロゴ"
              width={200}
              height={200}
              className="w-full h-auto"
              priority
            />
          </div>
          <p className="text-sm text-gray-700">
            自動車業界向け LINE 連携プラットフォーム
          </p>
        </div>

        {/* ログインカード */}
        <div className="w-full bg-white shadow-lg rounded-2xl p-6 border border-green-100">
          <h1 className="text-lg font-bold mb-4 text-center text-gray-800">
            ログイン
          </h1>

           {/* ★ 追加：サブスク完了/キャンセルのお知らせ */}
          {infoMessage && (
            <div className="mb-4 border border-blue-300 bg-blue-50 text-xs text-blue-900 rounded px-3 py-3 whitespace-pre-wrap">
              <div className="font-semibold text-[13px] mb-2">
                サブスク登録手続きの結果
              </div>
              <p className="mb-3">{infoMessage}</p>

              <button
                type="button"
                className="w-full border border-blue-400 text-blue-700 rounded-lg py-2 text-xs font-semibold hover:bg-blue-100 transition-colors"
                onClick={() => {
                  // クエリを消して「素のログイン画面」に戻す
                  setInfoMessage(null);
                  router.replace('/');
                }}
              >
                ログイン画面に戻る
              </button>
            </div>
          )}

                    {tenantErrorInfo && (
            <div className="mb-4 border border-yellow-300 bg-yellow-50 text-xs text-gray-800 rounded px-3 py-2 whitespace-pre-wrap">
              <div className="font-semibold text-[13px] mb-1">
                ご契約の有効期限をご確認ください
              </div>
              <p className="mb-2">
                {tenantErrorInfo.rawMessage}
              </p>

              {tenantErrorInfo.tenantName && (
                <p className="mb-1">
                  対象テナント：
                  <span className="font-semibold">
                    {tenantErrorInfo.tenantName}
                  </span>
                </p>
              )}
              {tenantErrorInfo.plan && (
                <p className="mb-1">
                  契約プラン：
                  <span className="font-semibold">{tenantErrorInfo.plan}</span>
                </p>
              )}
              {tenantErrorInfo.validUntil && (
                <p className="mb-2">
                  有効期限：
                  <span className="font-semibold">
                    {new Date(
                      tenantErrorInfo.validUntil,
                    ).toLocaleString('ja-JP')}
                  </span>
                </p>
              )}

                            <button
                type="button"
                className="w-full mt-2 bg-[#00C300] text-white rounded-lg py-2 text-xs font-semibold hover:bg-green-500 transition-colors"
                onClick={() => handleStartSubscriptionFromLogin('BASIC')}
              >
                サブスク登録・再開手続きへ進む
              </button>

            </div>
          )}

                    {/* ★ 通常のログインエラー表示 */}
          {error && (
            <div className="mb-4 border border-red-300 bg-red-50 text-xs text-red-800 rounded px-3 py-2 whitespace-pre-wrap">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
  <label className="block text-sm mb-1">メールアドレス</label>
  <input
    type="email"
    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C300]"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    autoComplete="username"
    // ★ ここから追加
    inputMode="email"          // モバイルなどで英数キーボードを優先
    autoCapitalize="off"       // 自動で大文字にしない
    autoCorrect="off"          // 自動補正しない
    lang="en"                  // フィールドとして英語扱い
    style={{ imeMode: 'disabled' }} // IME 無効のヒント（対応ブラウザで有効）
    // ★ ここまで追加
    required
  />
</div>


            <div>
              <label className="block text-sm mb-1">パスワード</label>
              <input
                type="password"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C300]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {/* メールアドレス記憶 */}
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <input
                id="remember-email"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-[#00C300] focus:ring-[#00C300]"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
              />
              <label htmlFor="remember-email" className="select-none">
                メールアドレスを記憶する
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00C300] text-white rounded-lg py-2 text-sm font-semibold 
                disabled:opacity-50 hover:bg-green-500 transition-colors"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          {/* ★ 新規登録ボタン（追加） */}
          <div className="mt-4 border-t pt-4">
            <p className="text-[11px] text-gray-600 mb-1">
              初めてご利用の整備工場様はこちら
            </p>
            <button
              className="w-full py-2 border border-[#00C300] text-[#00C300] rounded-lg text-sm font-semibold hover:bg-green-50 transition-colors"
              onClick={() => router.push('/signup')}
            >
              新規登録（無料ではじめる）
            </button>
          </div>
        </div>
      </div>

      {/* ★ コピーライト（追加） */}
      <footer className="text-[11px] text-gray-500 mt-6">
        © 556
      </footer>
    </main>
    </Suspense>
  );
}
