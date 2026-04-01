'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function DevLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 既にログイン済みなら即リダイレクト
  useEffect(() => {
    const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('auth_token') : null;
    if (!token) return;
    fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.role === 'DEVELOPER') router.replace('/admin/overview'); })
      .catch(() => {});
  }, [router]);

  // STEP1: メール＋パスワード → OTPメール送信
  const handleCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/admin/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? 'ログインに失敗しました。');
        return;
      }
      setStep('otp');
    } catch {
      setError('サーバーに接続できませんでした。');
    } finally {
      setLoading(false);
    }
  };

  // STEP2: 6桁コード検証 → JWT取得
  const handleOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/admin/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.token) {
        setError(data?.message ?? '認証コードが正しくありません。');
        return;
      }
      window.sessionStorage.setItem('auth_token', data.token);
      router.replace('/admin/overview');
    } catch {
      setError('サーバーに接続できませんでした。');
    } finally {
      setLoading(false);
    }
  };

  const Spinner = () => (
    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">

      {/* Logo */}
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

          {/* ステップ表示 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'credentials' ? 'bg-green-600 text-white' : 'bg-emerald-800 text-emerald-300'}`}>
                {step === 'credentials' ? '1' : '✓'}
              </span>
              <span className={`text-xs font-semibold ${step === 'credentials' ? 'text-white' : 'text-emerald-400'}`}>
                パスワード確認
              </span>
            </div>
            <div className="w-6 h-px bg-gray-700 flex-shrink-0" />
            <div className="flex items-center gap-2 flex-1">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'otp' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                2
              </span>
              <span className={`text-xs font-semibold ${step === 'otp' ? 'text-white' : 'text-gray-600'}`}>
                認証コード入力
              </span>
            </div>
          </div>

          <div className="border-t border-gray-800" />

          {/* エラー */}
          {error && (
            <div className="rounded-xl bg-red-950/60 border border-red-800 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* STEP 1: メール＋パスワード */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div>
                <h2 className="text-base font-black text-white">開発者ログイン</h2>
                <p className="text-xs text-gray-500 mt-0.5">メールアドレスとパスワードを入力</p>
              </div>
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
                  <span className="flex items-center justify-center gap-2"><Spinner />送信中...</span>
                ) : '次へ → 認証コードを送信'}
              </button>
            </form>
          )}

          {/* STEP 2: OTP入力 */}
          {step === 'otp' && (
            <form onSubmit={handleOtp} className="space-y-4">
              <div>
                <h2 className="text-base font-black text-white">認証コードを入力</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="text-green-400 font-semibold">{email}</span> に送信した
                  6桁のコードを入力してください（有効期限10分）
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400">認証コード（6桁）</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-xl font-mono text-center tracking-[0.5em] px-4 py-3 placeholder-gray-600 outline-none focus:border-green-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-3 transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2"><Spinner />確認中...</span>
                ) : 'ログイン'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('credentials'); setCode(''); setError(null); }}
                className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                ← メールアドレス入力に戻る
              </button>
            </form>
          )}
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
