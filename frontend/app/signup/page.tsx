// frontend/app/signup/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function SignupPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName || !email || !password) {
      setError('会社名・メールアドレス・パスワードは必須です。');
      return;
    }

    if (password !== passwordConfirm) {
      setError('パスワードが一致しません。');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/public/tenants/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          adminName: adminName || companyName,
          email,
          phone: phone || undefined,
          password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.message ??
            '登録に失敗しました。時間をおいて再度お試しください。',
        );
        setLoading(false);
        return;
      }

      await res.json(); // tenantId など返るけど、今は使わない

      setDone(true);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setError('登録処理中にエラーが発生しました。');
      setLoading(false);
    }
  };

  // 完了画面
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-lg shadow p-6 w-full max-w-md space-y-4">
          <h1 className="text-xl font-bold text-center">登録が完了しました</h1>
          <p className="text-sm text-gray-700 whitespace-pre-line text-center">
            ご登録ありがとうございます。
            {'\n'}
            先ほど登録したメールアドレスとパスワードでログインしてください。
          </p>
          <button
            className="w-full py-2 rounded-md bg-green-600 text-white text-sm font-semibold"
            onClick={() => router.push('/')}
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  // フォーム画面
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-lg shadow p-6 w-full max-w-md">
        <h1 className="text-xl font-bold mb-4 text-center">
          新規利用登録（整備工場様向け）
        </h1>

        {error && (
          <div className="mb-4 text-sm text-red-600 whitespace-pre-line">
            {error}
          </div>
        )}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-semibold mb-1">
              会社名（屋号）
            </label>
            <input
              type="text"
              className="w-full border rounded px-2 py-1 text-sm"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              担当者名（任意）
            </label>
            <input
              type="text"
              className="w-full border rounded px-2 py-1 text-sm"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="例：松本 竜也"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              電話番号（任意）
            </label>
            <input
              type="tel"
              className="w-full border rounded px-2 py-1 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="例：090-xxxx-xxxx"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              メールアドレス（ログインID）
            </label>
            <input
              type="email"
              className="w-full border rounded px-2 py-1 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="example@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              パスワード
            </label>
            <input
              type="password"
              className="w-full border rounded px-2 py-1 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              パスワード（確認）
            </label>
            <input
              type="password"
              className="w-full border rounded px-2 py-1 text-sm"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 rounded-md bg-green-600 text-white text-sm font-semibold disabled:opacity-60 mt-2"
            disabled={loading}
          >
            {loading ? '登録中...' : '登録する'}
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-500 text-center">
          すでにアカウントをお持ちの場合は、
          <button
            type="button"
            className="text-blue-600 underline ml-1"
            onClick={() => router.push('/')}
          >
            ログイン画面
          </button>
          からログインしてください。
        </p>
      </div>
    </div>
  );
}
