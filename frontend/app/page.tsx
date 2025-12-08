'use client';

import { FormEvent, useEffect, useState } from 'react';
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

  // すでにトークンがある場合は自動遷移
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = window.localStorage.getItem(SAVED_EMAIL_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }
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
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

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

      const data = (await res.json().catch(() => null)) as
        | LoginResponse
        | { message?: string }
        | null;

      if (!res.ok || !data || (data as any).token === undefined) {
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

  return (
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

          {error && (
            <div className="mb-4 border border-red-300 bg-red-50 text-sm text-red-800 rounded px-3 py-2 whitespace-pre-wrap">
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
  );
}
