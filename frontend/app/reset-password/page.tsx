'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError('このリンクは無効または期限切れです。');
      setVerifying(false);
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`${apiBase}/auth/verify-reset-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (res.ok) {
          setTokenValid(true);
        } else {
          setTokenError('このリンクは無効または期限切れです。');
        }
      } catch {
        setTokenError('サーバーに接続できませんでした。');
      } finally {
        setVerifying(false);
      }
    };

    verify();
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('パスワードと確認用パスワードが一致しません。');
      return;
    }

    if (newPassword.length < 8) {
      setError('パスワードは8文字以上で設定してください。');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? 'エラーが発生しました。時間をおいて再度お試しください。');
        return;
      }

      setSuccess(true);
    } catch {
      setError('サーバーに接続できませんでした。');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">リンクを確認中...</p>
    );
  }

  if (tokenError) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-700">
          {tokenError}
        </div>
        <div className="text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-green-700 hover:text-green-900 font-medium underline underline-offset-2"
          >
            パスワード再設定メールを再送する
          </Link>
        </div>
        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
          >
            ログインに戻る
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-800">
          パスワードを再設定しました。新しいパスワードでログインしてください。
        </div>
        <Link
          href="/"
          className="block text-center w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 text-sm font-bold transition-colors shadow-sm"
        >
          ログインページへ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            新しいパスワード
          </label>
          <input
            type="password"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="8文字以上"
            required
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            新しいパスワード（確認）
          </label>
          <input
            type="password"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="もう一度入力"
            required
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-xl py-3 text-sm font-bold transition-colors shadow-sm"
        >
          {loading ? '設定中...' : 'パスワードを再設定する'}
        </button>
      </form>

      <div className="border-t border-gray-100 pt-4 text-center">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
        >
          ログインに戻る
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
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
          <div className="w-full bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
            <div className="bg-green-600 px-6 py-4">
              <h1 className="text-base font-bold text-white">パスワード再設定</h1>
              <p className="text-xs text-green-100 mt-0.5">新しいパスワードを入力してください</p>
            </div>

            <div className="px-6 py-6">
              <ResetPasswordForm />
            </div>
          </div>

          <footer className="text-xs text-gray-400 mt-8 text-center">© 556</footer>
        </div>
      </main>
    </Suspense>
  );
}
