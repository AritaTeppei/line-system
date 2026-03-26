// frontend/app/signup/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const TERMS_TEXT = `■ 個人情報の取り扱いについて

お客様からご提供いただいた氏名・住所・電話番号・メールアドレスなどの個人情報は、本サービスの提供・運営・改善を目的として利用します。法令に基づく場合を除き、お客様の同意なく第三者に提供することはありません。個人情報は適切なセキュリティ対策を講じたサーバーで管理し、不要になった時点で速やかに削除します。

■ お客様（顧客）情報の取り扱いについて

本サービスを通じて登録・管理するお客様（整備工場のエンドユーザー）の個人情報（氏名・車両情報・LINE ID等）についても、利用規約および関連法令に従って適切に取り扱う責任をご契約者（整備工場）が負うものとします。情報の取り扱いに際しては、個人情報保護法その他の関連法規を遵守してください。

■ 情報漏洩リスクについて

本サービスはセキュリティ対策を講じておりますが、インターネットを介したサービスの性質上、完全な安全性を保証することはできません。万が一、不正アクセス・ハッキング・第三者による情報漏洩が発生した場合、当社は合理的な範囲での対策・通知を行いますが、漏洩によって生じた損害について当社の故意または重大な過失がない限り、賠償責任を負いかねます。

■ サービス停止・障害について

本サービスは可能な限り安定した運用を目指しておりますが、定期メンテナンス・設備障害・外部サービス（LINE・Stripe等）の障害・天災・その他やむを得ない事情によりサービスを一時停止または終了する場合があります。停止・障害によって生じた損害について、当社の故意または重大な過失がない限り、賠償責任を負いかねます。重大な障害が発生した場合は、公式サイトまたはメールにてお知らせします。

■ サービスの変更・終了について

当社は、事前に通知することで本サービスの内容変更・料金変更・サービス終了を行う場合があります。契約者はこれに同意したものとみなします。

■ 免責事項

本サービスの利用により生じた損害（逸失利益・データ損失等を含む）について、当社の故意または重大な過失がない限り責任を負いません。`;

export default function SignupPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState('');
  const [isIndividual, setIsIndividual] = useState(false);
  const [representativeName, setRepresentativeName] = useState('');
  const [companyAddress1, setCompanyAddress1] = useState('');
  const [companyAddress2, setCompanyAddress2] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const validatePhone = (value: string): boolean => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return false;
    return digits.length >= 9 && digits.length <= 11;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

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
      setError('連絡先（代表）の電話番号が不正です。');
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

    if (!agreedToTerms) {
      setError('利用規約・免責事項にご同意いただく必要があります。');
      return;
    }

    const finalTenantName =
      tenantName.trim() ||
      companyName.trim() ||
      representativeName.trim();

    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/public/tenants/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: finalTenantName,
          companyName: companyName || null,
          companyAddress1: companyAddress1 || null,
          companyAddress2: companyAddress2 || null,
          representativeName,
          contactPhone,
          contactMobile: contactMobile || null,
          adminName: representativeName,
          email,
          phone: contactPhone,
          password,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? '登録に失敗しました。時間をおいて再度お試しください。');
        setLoading(false);
        return;
      }

      await res.json();
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
      <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-gray-50 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="w-[160px] mx-auto mb-3">
              <Image src="/pitlink-logo.png" alt="PitLink ロゴ" width={160} height={160} className="w-full h-auto" priority />
            </div>
            <p className="text-sm text-gray-500">自動車業界向け LINE 連携プラットフォーム</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-green-600 px-6 py-4">
              <h1 className="text-base font-bold text-white">🎉 登録が完了しました</h1>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-800 leading-relaxed">
                ご登録ありがとうございます。<br />
                登録したメールアドレスとパスワードでログインしてください。
              </div>
              <button
                className="w-full py-3 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors"
                onClick={() => router.push('/')}
              >
                ログイン画面に戻る
              </button>
            </div>
          </div>

          <footer className="text-xs text-gray-400 mt-8 text-center">© 556</footer>
        </div>
      </main>
    );
  }

  // フォーム画面
  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-gray-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* ロゴ */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-[160px] mx-auto mb-3">
            <Image src="/pitlink-logo.png" alt="PitLink ロゴ" width={160} height={160} className="w-full h-auto" priority />
          </div>
          <p className="text-sm text-gray-500">自動車業界向け LINE 連携プラットフォーム</p>
        </div>

        {/* カード */}
        <div className="w-full bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
          {/* カードヘッダー */}
          <div className="bg-green-600 px-6 py-4">
            <h1 className="text-base font-bold text-white">新規利用登録</h1>
            <p className="text-xs text-green-100 mt-0.5">整備工場様向け・無料トライアルで始められます</p>
          </div>

          <div className="px-6 py-6 space-y-6">

            {/* エラー */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">
                {error}
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>

              {/* セクション①：会社・契約者情報 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-bold text-gray-500 tracking-wide">会社・契約者情報</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">
                      会社名（屋号）{!isIndividual && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isIndividual}
                        onChange={(e) => setIsIndividual(e.target.checked)}
                        className="h-3.5 w-3.5 rounded"
                      />
                      個人事業主（会社名なし）
                    </label>
                  </div>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="例：PitLink自動車工場"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    代表者名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    placeholder="例：松本 竜也"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    住所（番地まで） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={companyAddress1}
                    onChange={(e) => setCompanyAddress1(e.target.value)}
                    placeholder="例：福岡市博多区◯◯1-2-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    住所（ビル名・号室など）
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={companyAddress2}
                    onChange={(e) => setCompanyAddress2(e.target.value)}
                    placeholder="例：◯◯ビル 3F"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    連絡先（代表） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="例：0921234567 / 09012345678"
                    inputMode="tel"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    連絡先（携帯・担当者など）
                  </label>
                  <input
                    type="tel"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={contactMobile}
                    onChange={(e) => setContactMobile(e.target.value)}
                    placeholder="例：09012345678"
                    inputMode="tel"
                  />
                </div>
              </div>

              {/* セクション②：テナント名 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-bold text-gray-500 tracking-wide">テナント名（任意）</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="例：◯◯自動車工場 LINEシステム"
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    未入力の場合は会社名（屋号）または代表者名が使われます。
                  </p>
                </div>
              </div>

              {/* セクション③：ログイン情報 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-bold text-gray-500 tracking-wide">ログイン情報</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス（ログインID） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@example.com"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード（確認） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* セクション④：利用規約 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-bold text-gray-500 tracking-wide">利用規約・免責事項</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                {/* 規約折りたたみ */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowTerms((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-gray-700">📄 利用規約・免責事項を確認する</span>
                    <span className="text-gray-400 text-xs">{showTerms ? '▲ 閉じる' : '▼ 開く'}</span>
                  </button>

                  {showTerms && (
                    <div className="px-4 py-4 max-h-64 overflow-y-auto bg-white">
                      <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">
                        {TERMS_TEXT}
                      </pre>
                    </div>
                  )}
                </div>

                {/* 同意チェックボックス */}
                <label className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${agreedToTerms ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="h-4 w-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-700 leading-relaxed">
                    上記の<span className="font-semibold text-green-700">利用規約・個人情報の取り扱い・免責事項</span>を読み、内容に同意します。
                  </span>
                </label>

                {!agreedToTerms && (
                  <p className="text-xs text-gray-400 text-center">
                    規約への同意がないと登録できません
                  </p>
                )}
              </div>

              {/* 送信ボタン */}
              <button
                type="submit"
                disabled={loading || !agreedToTerms}
                className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-400 text-white text-sm font-bold transition-colors shadow-sm"
              >
                {loading ? '登録中...' : '登録する'}
              </button>
            </form>

            {/* ログインへ */}
            <div className="border-t border-gray-100 pt-4 text-center">
              <p className="text-xs text-gray-500">
                すでにアカウントをお持ちの場合は
                <button
                  type="button"
                  className="text-green-600 font-semibold underline ml-1"
                  onClick={() => router.push('/')}
                >
                  ログイン画面
                </button>
                へ
              </p>
            </div>

          </div>
        </div>

        <footer className="text-xs text-gray-400 mt-8 text-center">© 556</footer>
      </div>
    </main>
  );
}
