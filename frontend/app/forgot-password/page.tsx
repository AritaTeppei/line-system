'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? 'エラーが発生しました。時間をおいて再度お試しください。');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('サーバーに接続できませんでした。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-gray-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="w-full bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
          <div className="bg-green-600 px-6 py-4">
            <h1 className="text-base font-bold text-white">パスワード再設定</h1>
            <p className="text-xs text-green-100 mt-0.5">
              登録済みのメールアドレスを入力してください
            </p>
          </div>

          <div className="px-6 py-6 space-y-5">
            {submitted ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-800">
                  メールを送信しました。メールをご確認ください。
                  <br />
                  <span className="text-xs text-green-700 mt-1 block">
                    ※ 登録されていないメールアドレスの場合、メールは届きません。
                  </span>
                </div>
                <Link
                  href="/"
                  className="block text-center text-sm text-green-700 hover:text-green-900 font-medium underline underline-offset-2"
                >
                  ログインに戻る
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

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
                      placeholder="example@example.com"
                      required
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="off"
                      autoCorrect="off"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-xl py-3 text-sm font-bold transition-colors shadow-sm"
                  >
                    {loading ? '送信中...' : '再設定メールを送信'}
                  </button>
                </form>

                <div className="border-t border-gray-100 pt-4 text-center">
                  <Link
                    href="/"
                    className="text-sm text-green-700 hover:text-green-900 font-medium underline underline-offset-2"
                  >
                    ログインに戻る
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="text-xs text-gray-400 mt-8 text-center">© 556</footer>
      </div>
    </main>
  );
}
