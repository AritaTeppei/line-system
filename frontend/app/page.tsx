'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // すでにトークンがある場合は /auth/me で role を確認して自動遷移
  useEffect(() => {
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
        if (!res.ok) {
          // トークンが古いなど → 無視して通常ログイン画面
          return;
        }
        const data = (await res.json()) as MeResponse;

        if (data.role === 'DEVELOPER') {
          router.replace('/admin/tenants');
        } else {
          router.replace('/dashboard');
        }
      } catch {
        // サーバー落ちてる等 → 何もしない（ログイン画面のまま）
      }
    };

    run();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

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

      // ★ ここでロールごとに行き先を分ける
      if (loginData.role === 'DEVELOPER') {
        router.replace('/admin/tenants');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      if (err?.name === 'TypeError') {
        setError(
          'サーバーに接続できませんでした。\n' +
            '・backend が http://localhost:4000 で起動しているか\n' +
            '・CORS 設定が有効か\nを確認してください。',
        );
      } else {
        setError(
          err?.message || 'ログイン処理中にエラーが発生しました。',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white shadow rounded-lg p-6">
        <h1 className="text-xl font-bold mb-4 text-center">
          LINE 車検システム ログイン
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
              className="w-full border rounded px-3 py-2 text-sm"
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
              className="w-full border rounded px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded py-2 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </main>
  );
}
