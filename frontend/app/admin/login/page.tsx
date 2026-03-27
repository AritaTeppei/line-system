'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type LoginResponse = {
  token: string;
  role: string;
};

export default function DevLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 既にログイン済みのDEVELOPERなら即リダイレクト
  useEffect(() => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
    if (!token) return;
    fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.role === 'DEVELOPER') router.replace('/admin/overview');
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null) as LoginResponse | null;

      if (!res.ok || !data?.token) {
        setError((data as any)?.message ?? 'ログインに失敗しました。');
        return;
      }
      if (data.role !== 'DEVELOPER') {
        setError('このページは開発者アカウント専用です。');
        return;
      }
      window.localStorage.setItem('auth_token', data.token);
      router.replace('/admin/overview');
    } catch {
      setError('サーバーに接続できませんでした。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">

      {/* Logo area */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-900/50 border border-green-700 mb-3">
          <span className="text-3xl">🛠️</span>
        </div>
        <h1 className="text-xl font-black text-white">PitLink</h1>
        <p className="text-xs text-gray-500 mt-0.5">Developer Console</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 space-y-5">

          <div>
            <h2 className="text-base font-black text-white">開発者ログイン</h2>
            <p className="text-xs text-gray-500 mt-0.5">DEVELOPER アカウントでサインイン</p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-950/60 border border-red-800 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="dev@example.com"
                className="w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 placeholder-gray-600 outline-none focus:border-green-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 placeholder-gray-600 outline-none focus:border-green-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-3 transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  ログイン中...
                </span>
              ) : 'ログイン'}
            </button>

            <div className="text-center">
              <Link
                href="/forgot-password"
                className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2"
              >
                パスワードをお忘れですか？
              </Link>
            </div>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-700">
          一般ユーザーは{' '}
          <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-300 underline underline-offset-2">
            通常ログイン
          </button>
          {' '}をご利用ください
        </p>
      </div>
    </div>
  );
}
