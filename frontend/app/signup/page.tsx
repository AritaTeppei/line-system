// frontend/app/signup/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function SignupPage() {
  const router = useRouter();

  // 契約者・会社情報
  const [companyName, setCompanyName] = useState('');
  const [isIndividual, setIsIndividual] = useState(false); // ★ 個人チェック
  const [representativeName, setRepresentativeName] = useState('');
  const [companyAddress1, setCompanyAddress1] = useState('');
  const [companyAddress2, setCompanyAddress2] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMobile, setContactMobile] = useState('');

  // テナント名（任意・未入力なら会社名を流用）
  const [tenantName, setTenantName] = useState('');

  // ログイン用情報
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // ★ 簡易電話番号バリデーション（数字9〜11桁、ハイフン可）
  const validatePhone = (value: string): boolean => {
    const digits = value.replace(/\D/g, ''); // 数字だけに
    if (!digits) return false;
    // 固定・携帯どちらもざっくり 9〜11桁くらいにしておく
    return digits.length >= 9 && digits.length <= 11;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // ★ 必須チェック
    if (!representativeName.trim()) {
      setError('代表者名は必須です。');
      return;
    }

    if (!isIndividual && !companyName.trim()) {
      setError('会社名（屋号）は必須です。個人の場合は「個人事業主です」にチェックしてください。');
      return;
    }

    if (!companyAddress1.trim()) {
      setError('住所1は必須です。');
      return;
    }

    if (!contactPhone.trim() || !validatePhone(contactPhone)) {
      setError('連絡先（代表）の電話番号が不正です。ハイフンありでも構いませんが、正しい番号を入力してください。');
      return;
    }

    if (!email.trim()) {
      setError('メールアドレスは必須です。');
      return;
    }

    if (!password) {
      setError('パスワードは必須です。');
      return;
    }

    if (password !== passwordConfirm) {
      setError('パスワードが一致しません。');
      return;
    }

    // ★ テナント名の決定ロジック
    const finalTenantName =
      tenantName.trim() ||
      companyName.trim() ||
      representativeName.trim();

    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/public/tenants/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Tenant 用
          tenantName: finalTenantName,
          companyName: companyName || null,
          companyAddress1: companyAddress1 || null,
          companyAddress2: companyAddress2 || null,
          representativeName: representativeName,
          contactPhone: contactPhone,
          contactMobile: contactMobile || null,

          // User（管理者）用
          adminName: representativeName,
          email,
          phone: contactPhone, // 代表番号を phone として送る

          // ログイン用
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

      await res.json(); // tenantId など返るが今は未使用

      setDone(true);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setError('登録処理中にエラーが発生しました。');
      setLoading(false);
    }
  };


  
  // ✅ 完了画面（デザインもログインに寄せて少し明るめに）
  if (done) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#FFFFFF] px-4 py-6">
        <div className="w-full max-w-md">
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

          <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-6 space-y-4">
            <h1 className="text-lg font-bold text-center text-gray-800">
              登録が完了しました
            </h1>
            <p className="text-sm text-gray-700 whitespace-pre-line text-center">
              ご登録ありがとうございます。
              {'\n'}
              先ほど登録したメールアドレスとパスワードでログインしてください。
            </p>
            <button
              className="w-full py-2 rounded-lg bg-[#00C300] text-white text-sm font-semibold hover:bg-green-500 transition-colors"
              onClick={() => router.push('/')}
            >
              ログイン画面に戻る
            </button>
          </div>

          <footer className="text-[11px] text-gray-500 mt-6 text-center">
            © 556
          </footer>
        </div>
      </main>
    );
  }

  // ✅ フォーム画面（ログインページ風デザイン）
  return (
    <main className="min-h-screen flex flex-col items-center justify-between px-4 py-6 bg-[#ffffff]">
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

        {/* カード */}
        <div className="w-full bg-white shadow-lg rounded-2xl p-6 border border-green-100">
          <h1 className="text-lg font-bold mb-4 text-center text-gray-800">
            新規利用登録（整備工場様向け）
          </h1>

          {error && (
            <div className="mb-4 border border-red-300 bg-red-50 text-xs text-red-800 rounded px-3 py-2 whitespace-pre-wrap">
              {error}
            </div>
          )}

          <form className="space-y-3" onSubmit={handleSubmit}>
            {/* 会社・契約者情報 */}
            <div className="border-b pb-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-semibold">
                  会社名（屋号）
                  {!isIndividual && (
                    <span className="text-red-600 ml-1">*</span>
                  )}
                </label>
                <label className="flex items-center gap-1 text-[11px] text-gray-600">
                  <input
                    type="checkbox"
                    checked={isIndividual}
                    onChange={(e) => setIsIndividual(e.target.checked)}
                    className="h-3 w-3"
                  />
                  個人事業主（会社名なし）
                </label>
              </div>
              <input
                type="text"
                className="w-full border rounded px-2 py-1 text-sm"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="例：PitLink自動車工場"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                代表者名 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                className="w-full border rounded px-2 py-1 text-sm"
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                placeholder="例：松本 竜也"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                住所1 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                className="w-full border rounded px-2 py-1 text-sm"
                value={companyAddress1}
                onChange={(e) => setCompanyAddress1(e.target.value)}
                placeholder="例：福岡市博多区◯◯1-2-3"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                住所2（ビル名・号室など）
              </label>
              <input
                type="text"
                className="w-full border rounded px-2 py-1 text-sm"
                value={companyAddress2}
                onChange={(e) => setCompanyAddress2(e.target.value)}
                placeholder="例：◯◯ビル 3F"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                連絡先（代表） <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                className="w-full border rounded px-2 py-1 text-sm"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="例：0921234567 / 09012345678"
                inputMode="tel"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                連絡先（携帯・担当者など）
              </label>
              <input
                type="tel"
                className="w-full border rounded px-2 py-1 text-sm"
                value={contactMobile}
                onChange={(e) => setContactMobile(e.target.value)}
                placeholder="例：09012345678"
                inputMode="tel"
              />
            </div>

            {/* テナント名（任意） */}
            <div className="border-t pt-3 mt-3">
              <label className="block text-sm font-semibold mb-1">
                テナント名（任意）
              </label>
              <input
                type="text"
                className="w-full border rounded px-2 py-1 text-sm"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="例：◯◯自動車工場 LINEシステム"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                未入力の場合は「会社名（屋号）」がテナント名として登録されます。
                会社名も未入力で個人事業主の場合は「代表者名」が使われます。
              </p>
            </div>

            {/* ログイン用情報 */}
            <div className="border-t pt-3 mt-3">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  メールアドレス（ログインID）
                  <span className="text-red-600 ml-1">*</span>
                </label>
                <input
                  type="email"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="example@example.com"
                  autoComplete="username"
                />
              </div>

              <div className="mt-2">
                <label className="block text-sm font-semibold mb-1">
                  パスワード <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="mt-2">
                <label className="block text-sm font-semibold mb-1">
                  パスワード（確認） <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-[#00C300] text-white text-sm font-semibold disabled:opacity-60 mt-2 hover:bg-green-500 transition-colors"
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

        <footer className="text-[11px] text-gray-500 mt-6 text-center">
          © 556
        </footer>
      </div>
    </main>
  );
}
