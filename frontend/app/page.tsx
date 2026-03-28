'use client';

import { FormEvent, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

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

  const [tenantErrorInfo, setTenantErrorInfo] = useState<{
    errorCode: 'TENANT_INACTIVE' | 'TENANT_EXPIRED';
    tenantId: number;
    tenantName?: string;
    plan?: string | null;
    validUntil?: string | null;
    rawMessage: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = window.localStorage.getItem(SAVED_EMAIL_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }

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
        setInfoMessage(null);
      }
    } else {
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
          router.replace('/admin/overview');
        } else {
          router.replace('/dashboard');
        }
      } catch {}
    };

    run();
  }, [router]);

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
        setError(raw.message ?? 'このテナントは現在ご利用いただけません。サブスク再開で利用できます。');
        setLoading(false);
        return;
      }

      const data = raw as LoginResponse | { message?: string } | null;

      if (!res.ok || !data || (data as any).token === undefined) {
        const anyData = data as any;

        if (
          anyData &&
          (anyData.error === 'TENANT_INACTIVE' || anyData.error === 'TENANT_EXPIRED') &&
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
          setError(anyData.message ?? 'このテナントは現在ご利用いただけません。サブスク再開で利用できます。');
          setLoading(false);
          return;
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
        router.replace('/admin/overview');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      if (err?.name === 'TypeError') {
        setError('サーバーに接続できませんでした。\nbackend が起動しているかを確認してください。');
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: tenantErrorInfo.tenantId,
            plan,
            fromLogin: true,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? '決済用セッションの作成に失敗しました。時間をおいて再度お試しください。');
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { url?: string };

      if (!data.url) {
        setError('決済画面のURLが取得できませんでした。');
        setLoading(false);
        return;
      }

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
        <main className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-sm text-gray-600">読み込み中です...</p>
        </main>
      }
    >
      <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-gray-50 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {/* ロゴ */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-[160px] mx-auto mb-3">
              <Image
                src="/pitlink-logo.png"
                alt="PitLink ロゴ"
                width={160}
                height={160}
                className="w-full h-auto"
                priority
              />
            </div>
            <p className="text-sm text-gray-500 tracking-wide">
              自動車業界向け LINE 連携プラットフォーム
            </p>
          </div>

          {/* ログインカード */}
          <div className="w-full bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
            {/* カードヘッダー */}
            <div className="bg-green-600 px-6 py-4">
              <h1 className="text-base font-bold text-white">ログイン</h1>
              <p className="text-xs text-green-100 mt-0.5">アカウント情報を入力してください</p>
            </div>

            <div className="px-6 py-6 space-y-5">

              {/* サブスク結果お知らせ */}
              {infoMessage && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-4">
                  <p className="text-sm font-semibold text-blue-800 mb-1">サブスク登録手続きの結果</p>
                  <p className="text-sm text-blue-700 whitespace-pre-wrap mb-3">{infoMessage}</p>
                  <button
                    type="button"
                    className="w-full border border-blue-400 text-blue-700 rounded-xl py-2 text-sm font-semibold hover:bg-blue-100 transition-colors"
                    onClick={() => { setInfoMessage(null); router.replace('/'); }}
                  >
                    ログイン画面に戻る
                  </button>
                </div>
              )}

              {/* テナント契約エラー */}
              {tenantErrorInfo && (
                <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-4">
                  <p className="text-sm font-semibold text-amber-800 mb-2">ご契約の有効期限をご確認ください</p>
                  <p className="text-sm text-amber-700 mb-2">{tenantErrorInfo.rawMessage}</p>
                  {tenantErrorInfo.tenantName && (
                    <p className="text-xs text-gray-700 mb-1">対象テナント：<span className="font-semibold">{tenantErrorInfo.tenantName}</span></p>
                  )}
                  {tenantErrorInfo.plan && (
                    <p className="text-xs text-gray-700 mb-1">契約プラン：<span className="font-semibold">{tenantErrorInfo.plan}</span></p>
                  )}
                  {tenantErrorInfo.validUntil && (
                    <p className="text-xs text-gray-700 mb-3">有効期限：<span className="font-semibold">{new Date(tenantErrorInfo.validUntil).toLocaleString('ja-JP')}</span></p>
                  )}
                  <button
                    type="button"
                    className="w-full bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-green-700 transition-colors"
                    onClick={() => handleStartSubscriptionFromLogin('BASIC')}
                  >
                    サブスク登録・再開手続きへ進む
                  </button>
                </div>
              )}

              {/* エラー */}
              {error && !tenantErrorInfo && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">
                  {error}
                </div>
              )}

              {/* フォーム */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    placeholder="example@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {/* メールアドレス記憶 */}
                <div className="flex items-center gap-2">
                  <input
                    id="remember-email"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                  />
                  <label htmlFor="remember-email" className="text-sm text-gray-600 select-none">
                    メールアドレスを記憶する
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-xl py-3 text-sm font-bold transition-colors shadow-sm"
                >
                  {loading ? 'ログイン中...' : 'ログイン'}
                </button>

                <div className="text-center">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-gray-500 hover:text-green-700 underline underline-offset-2"
                  >
                    パスワードをお忘れですか？
                  </Link>
                </div>
              </form>

              {/* 新規登録リンク */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-500 mb-2 text-center">
                  初めてご利用の整備工場様はこちら
                </p>
                <button
                  type="button"
                  className="w-full py-3 border-2 border-green-600 text-green-700 rounded-xl text-sm font-bold hover:bg-green-50 transition-colors"
                  onClick={() => router.push('/signup')}
                >
                  新規登録（無料トライアルではじめる）
                </button>
              </div>

            </div>
          </div>

          {/* プラン比較 */}
          <div className="mt-8 w-full">
            <p className="text-xs text-center text-gray-500 mb-3 font-semibold tracking-wide uppercase">料金プラン</p>
            <div className="grid grid-cols-3 gap-2">
              {/* BASIC */}
              <div className="rounded-xl border border-gray-200 bg-white p-3 flex flex-col gap-1 shadow-sm">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-base">🔵</span>
                  <span className="text-xs font-black text-gray-800">BASIC</span>
                </div>
                <div className="text-sm font-black text-gray-900">¥5,000<span className="text-[10px] font-normal text-gray-400">/月</span></div>
                <ul className="space-y-0.5 mt-1">
                  <li className="text-[10px] text-gray-600">✓ リマインド自動送信</li>
                  <li className="text-[10px] text-gray-400">✗ 一括メッセージ送信</li>
                  <li className="text-[10px] text-gray-400">✗ 外部API連携</li>
                </ul>
              </div>
              {/* STANDARD */}
              <div className="rounded-xl border-2 border-green-400 bg-gradient-to-b from-green-50 to-white p-3 flex flex-col gap-1 shadow-md relative">
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">人気</div>
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-base">⭐</span>
                  <span className="text-xs font-black text-gray-800">STANDARD</span>
                </div>
                <div className="text-sm font-black text-green-700">¥10,000<span className="text-[10px] font-normal text-gray-400">/月</span></div>
                <ul className="space-y-0.5 mt-1">
                  <li className="text-[10px] text-gray-600">✓ LINE送信 1,000通/月</li>
                  <li className="text-[10px] text-gray-600">✓ 基本機能すべて</li>
                  <li className="text-[10px] text-gray-600">✓ 外部API連携</li>
                </ul>
              </div>
              {/* PRO */}
              <div className="rounded-xl border border-purple-200 bg-gradient-to-b from-purple-50 to-white p-3 flex flex-col gap-1 shadow-sm">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-base">💎</span>
                  <span className="text-xs font-black text-gray-800">PRO</span>
                </div>
                <div className="text-sm font-black text-purple-700">¥15,000<span className="text-[10px] font-normal text-gray-400">/月</span></div>
                <ul className="space-y-0.5 mt-1">
                  <li className="text-[10px] text-gray-600">✓ LINE送信 無制限</li>
                  <li className="text-[10px] text-gray-600">✓ 基本機能すべて</li>
                  <li className="text-[10px] text-gray-600">✓ 外部API連携</li>
                </ul>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2">すべてのプランに7日間の無料トライアルが付きます</p>
          </div>

          <footer className="text-xs text-gray-400 mt-6 text-center">
            © 556
          </footer>
        </div>
      </main>
    </Suspense>
  );
}
