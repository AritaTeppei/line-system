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

// フィールドエラーの型
type FieldErrors = Partial<Record<
  'companyName' | 'representativeName' | 'postalCode' | 'companyAddress1' | 'contactPhone' | 'email' | 'emailVerified' | 'password' | 'passwordConfirm' | 'agreedToTerms',
  string
>>;

// エラーモーダル
function ErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-red-500 px-5 py-4 flex items-center gap-3">
          <span className="text-white text-xl">⚠️</span>
          <h2 className="text-white font-bold text-sm">入力内容を確認してください</h2>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
          >
            確認しました
          </button>
        </div>
      </div>
    </div>
  );
}

// フィールドエラー表示
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
      <span>▲</span>{message}
    </p>
  );
}

export default function SignupPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState('');
  const [isIndividual, setIsIndividual] = useState(false);
  const [representativeName, setRepresentativeName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [postalCodeSearching, setPostalCodeSearching] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState<string | null>(null);
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

  // メール認証
  const [emailCode, setEmailCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailVerifyError, setEmailVerifyError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const validatePhone = (value: string): boolean => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 11;
  };

  // 郵便番号検索
  const handlePostalCodeSearch = async () => {
    const code = postalCode.replace(/[-－ー\s]/g, '');
    setPostalCodeError(null);
    if (!/^\d{7}$/.test(code)) {
      setPostalCodeError('郵便番号は7桁で入力してください（例：8120034）');
      return;
    }
    setPostalCodeSearching(true);
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${code}`);
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        setPostalCodeError('該当する住所が見つかりませんでした。');
        return;
      }
      const r = data.results[0];
      const address = `${r.address1}${r.address2}${r.address3}`;
      setCompanyAddress1(address);
      setFieldErrors((prev) => ({ ...prev, companyAddress1: undefined, postalCode: undefined }));
    } catch {
      setPostalCodeError('住所の検索に失敗しました。手動で入力してください。');
    } finally {
      setPostalCodeSearching(false);
    }
  };

  const handleSendEmailCode = async () => {
    setEmailVerifyError(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailVerifyError('メールアドレスを正しく入力してください。');
      return;
    }
    setEmailSending(true);
    try {
      const res = await fetch(`${apiBase}/public/email/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setEmailVerifyError(data?.message ?? 'メール送信に失敗しました。');
        return;
      }
      setEmailCodeSent(true);
      setEmailVerified(false);
      setEmailVerificationToken('');
      setEmailCode('');
    } catch {
      setEmailVerifyError('サーバーに接続できませんでした。');
    } finally {
      setEmailSending(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    setEmailVerifyError(null);
    if (!emailCode.trim() || emailCode.replace(/\D/g, '').length !== 4) {
      setEmailVerifyError('4桁の認証コードを入力してください。');
      return;
    }
    setEmailVerifying(true);
    try {
      const res = await fetch(`${apiBase}/public/email/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: emailCode.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setEmailVerifyError(data?.message ?? '認証コードが正しくありません。');
        return;
      }
      setEmailVerified(true);
      setEmailVerificationToken(data.token);
      setFieldErrors((prev) => ({ ...prev, emailVerified: undefined }));
    } catch {
      setEmailVerifyError('サーバーに接続できませんでした。');
    } finally {
      setEmailVerifying(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // バリデーション：全項目を一括チェック
    const errors: FieldErrors = {};
    const errorMessages: string[] = [];

    if (!isIndividual && !companyName.trim()) {
      errors.companyName = '会社名（屋号）を入力してください';
      errorMessages.push('・会社名（屋号）が未入力です');
    }
    if (!representativeName.trim()) {
      errors.representativeName = '代表者名を入力してください';
      errorMessages.push('・代表者名が未入力です');
    }
    if (!companyAddress1.trim()) {
      errors.companyAddress1 = '住所を入力してください';
      errorMessages.push('・住所が未入力です');
    }
    if (!contactPhone.trim() || !validatePhone(contactPhone)) {
      errors.contactPhone = '電話番号を正しく入力してください（10〜11桁）';
      errorMessages.push('・連絡先電話番号が未入力または不正です');
    }
    if (!email.trim()) {
      errors.email = 'メールアドレスを入力してください';
      errorMessages.push('・メールアドレスが未入力です');
    }
    if (!emailVerified || !emailVerificationToken) {
      errors.emailVerified = 'メールアドレスの認証を完了してください';
      errorMessages.push('・メールアドレスの認証が完了していません');
    }
    if (!password) {
      errors.password = 'パスワードを入力してください';
      errorMessages.push('・パスワードが未入力です');
    }
    if (password && password !== passwordConfirm) {
      errors.passwordConfirm = 'パスワードが一致しません';
      errorMessages.push('・パスワードと確認用パスワードが一致しません');
    }
    if (!agreedToTerms) {
      errors.agreedToTerms = '利用規約への同意が必要です';
      errorMessages.push('・利用規約・免責事項への同意が必要です');
    }

    if (errorMessages.length > 0) {
      setFieldErrors(errors);
      setErrorModal(errorMessages.join('\n'));
      return;
    }

    setFieldErrors({});

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
          emailVerificationToken,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorModal(data?.message ?? '登録に失敗しました。時間をおいて再度お試しください。');
        setLoading(false);
        return;
      }

      await res.json();
      setDone(true);
      setLoading(false);
    } catch {
      setErrorModal('登録処理中にエラーが発生しました。');
      setLoading(false);
    }
  };

  // フィールドの枠スタイル
  const fieldCls = (hasError?: string) =>
    `w-full rounded-xl border bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 ${
      hasError ? 'border-red-400 bg-red-50' : 'border-gray-200'
    }`;

  // 完了画面
  if (done) {
    return (
      <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="w-[160px] mx-auto mb-3">
              <Image src="/LOGO_W.png" alt="PitLink ロゴ" width={200} height={67} className="w-full h-auto" priority />
            </div>
            <p className="text-sm text-gray-500">LINE連携予約管理プラットフォーム</p>
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
          <footer className="text-xs text-gray-400 mt-8 text-center">© seibisystem</footer>
        </div>
      </main>
    );
  }

  // フォーム画面
  return (
    <>
      {/* エラーモーダル */}
      {errorModal && (
        <ErrorModal message={errorModal} onClose={() => setErrorModal(null)} />
      )}

      <main className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {/* ロゴ */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-[160px] mx-auto mb-3">
              <Image src="/LOGO_W.png" alt="PitLink ロゴ" width={200} height={67} className="w-full h-auto" priority />
            </div>
            <p className="text-sm text-gray-500">LINE連携予約管理プラットフォーム</p>
          </div>

          {/* カード */}
          <div className="w-full bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
            {/* カードヘッダー */}
            <div className="bg-green-600 px-6 py-4">
              <h1 className="text-base font-bold text-white">新規利用登録</h1>
              <p className="text-xs text-green-100 mt-0.5">無料トライアルで始められます</p>
            </div>

            <div className="px-6 py-6 space-y-6">
              <form className="space-y-6" onSubmit={handleSubmit}>

                {/* セクション①：会社・契約者情報 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs font-bold text-gray-500 tracking-wide">会社・契約者情報</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  {/* 会社名 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">
                        会社名（屋号）{!isIndividual && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isIndividual}
                          onChange={(e) => {
                            setIsIndividual(e.target.checked);
                            if (e.target.checked) setFieldErrors((p) => ({ ...p, companyName: undefined }));
                          }}
                          className="h-3.5 w-3.5 rounded"
                        />
                        個人事業主（会社名なし）
                      </label>
                    </div>
                    <input
                      type="text"
                      className={fieldCls(fieldErrors.companyName)}
                      value={companyName}
                      onChange={(e) => { setCompanyName(e.target.value); setFieldErrors((p) => ({ ...p, companyName: undefined })); }}
                      placeholder="例：PitLink自動車工場"
                      disabled={isIndividual}
                    />
                    <FieldError message={fieldErrors.companyName} />
                  </div>

                  {/* 代表者名 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      代表者名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={fieldCls(fieldErrors.representativeName)}
                      value={representativeName}
                      onChange={(e) => { setRepresentativeName(e.target.value); setFieldErrors((p) => ({ ...p, representativeName: undefined })); }}
                      placeholder="例：山田 太郎"
                    />
                    <FieldError message={fieldErrors.representativeName} />
                  </div>

                  {/* 郵便番号検索 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      郵便番号で住所検索
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`flex-1 rounded-xl border bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 ${postalCodeError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                        value={postalCode}
                        onChange={(e) => { setPostalCode(e.target.value.replace(/[^\d\-－ー]/g, '')); setPostalCodeError(null); }}
                        placeholder="例：8120034（ハイフン不要）"
                        maxLength={8}
                      />
                      <button
                        type="button"
                        onClick={handlePostalCodeSearch}
                        disabled={postalCodeSearching || !postalCode.trim()}
                        className="flex-shrink-0 px-4 py-2 rounded-xl bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 disabled:text-gray-400 text-white text-xs font-bold transition-colors whitespace-nowrap"
                      >
                        {postalCodeSearching ? '検索中...' : '住所を検索'}
                      </button>
                    </div>
                    {postalCodeError && (
                      <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><span>▲</span>{postalCodeError}</p>
                    )}
                  </div>

                  {/* 住所1 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      住所（番地まで） <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={fieldCls(fieldErrors.companyAddress1)}
                      value={companyAddress1}
                      onChange={(e) => { setCompanyAddress1(e.target.value); setFieldErrors((p) => ({ ...p, companyAddress1: undefined })); }}
                      placeholder="例：福岡市博多区◯◯1-2-3"
                    />
                    <FieldError message={fieldErrors.companyAddress1} />
                  </div>

                  {/* 住所2 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      住所（ビル名・号室など）
                    </label>
                    <input
                      type="text"
                      className={fieldCls()}
                      value={companyAddress2}
                      onChange={(e) => setCompanyAddress2(e.target.value)}
                      placeholder="例：◯◯ビル 3F"
                    />
                  </div>

                  {/* 連絡先（代表） */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      連絡先（代表） <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      className={fieldCls(fieldErrors.contactPhone)}
                      value={contactPhone}
                      onChange={(e) => { setContactPhone(e.target.value); setFieldErrors((p) => ({ ...p, contactPhone: undefined })); }}
                      placeholder="例：09012345678"
                      inputMode="tel"
                    />
                    <FieldError message={fieldErrors.contactPhone} />
                  </div>

                  {/* 連絡先（携帯） */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      連絡先（携帯・担当者など）
                    </label>
                    <input
                      type="tel"
                      className={fieldCls()}
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
                      className={fieldCls()}
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

                  {/* メールアドレス + 認証 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      メールアドレス（ログインID） <span className="text-red-500">*</span>
                      {emailVerified && (
                        <span className="ml-2 text-xs text-green-600 font-bold">✓ 認証済み</span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        className={`flex-1 rounded-xl border bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 ${
                          fieldErrors.email || fieldErrors.emailVerified
                            ? 'border-red-400 bg-red-50'
                            : emailVerified
                            ? 'border-green-400 bg-green-50'
                            : 'border-gray-200'
                        }`}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setEmailVerified(false);
                          setEmailCodeSent(false);
                          setEmailVerificationToken('');
                          setEmailVerifyError(null);
                          setFieldErrors((p) => ({ ...p, email: undefined, emailVerified: undefined }));
                        }}
                        placeholder="example@example.com"
                        autoComplete="username"
                        disabled={emailVerified}
                      />
                      {!emailVerified && (
                        <button
                          type="button"
                          onClick={handleSendEmailCode}
                          disabled={emailSending || !email.trim()}
                          className="flex-shrink-0 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-400 text-white text-xs font-bold transition-colors whitespace-nowrap"
                        >
                          {emailSending ? '送信中...' : emailCodeSent ? '再送信' : 'メール認証'}
                        </button>
                      )}
                    </div>
                    <FieldError message={fieldErrors.email ?? fieldErrors.emailVerified} />

                    {/* 認証コード入力 */}
                    {emailCodeSent && !emailVerified && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-gray-500">
                          ✉️ <span className="font-medium">{email}</span> に4桁の認証コードを送信しました。迷惑メールフォルダもご確認ください。
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            className="w-28 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 text-center tracking-[0.3em] font-bold"
                            value={emailCode}
                            onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="0000"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyEmailCode}
                            disabled={emailVerifying || emailCode.length !== 4}
                            className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-400 text-white text-xs font-bold transition-colors"
                          >
                            {emailVerifying ? '確認中...' : 'コードを確認'}
                          </button>
                        </div>
                      </div>
                    )}

                    {emailVerified && (
                      <p className="mt-1 text-xs text-green-600 font-medium">✅ メールアドレスの認証が完了しました。</p>
                    )}
                    {emailVerifyError && (
                      <p className="mt-1 text-xs text-red-600">{emailVerifyError}</p>
                    )}
                  </div>

                  {/* パスワード */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      パスワード <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      className={fieldCls(fieldErrors.password)}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <FieldError message={fieldErrors.password} />
                  </div>

                  {/* パスワード確認 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      パスワード（確認） <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      className={fieldCls(fieldErrors.passwordConfirm)}
                      value={passwordConfirm}
                      onChange={(e) => { setPasswordConfirm(e.target.value); setFieldErrors((p) => ({ ...p, passwordConfirm: undefined })); }}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <FieldError message={fieldErrors.passwordConfirm} />
                  </div>
                </div>

                {/* セクション④：利用規約 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs font-bold text-gray-500 tracking-wide">利用規約・免責事項</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

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

                  <label className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${
                    fieldErrors.agreedToTerms
                      ? 'border-red-400 bg-red-50'
                      : agreedToTerms
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}>
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => { setAgreedToTerms(e.target.checked); setFieldErrors((p) => ({ ...p, agreedToTerms: undefined })); }}
                      className="h-4 w-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-700 leading-relaxed">
                      上記の<span className="font-semibold text-green-700">利用規約・個人情報の取り扱い・免責事項</span>を読み、内容に同意します。
                    </span>
                  </label>
                  <FieldError message={fieldErrors.agreedToTerms} />
                </div>

                {/* 送信ボタン */}
                <button
                  type="submit"
                  disabled={loading}
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

          <footer className="text-xs text-gray-400 mt-8 text-center">© seibisystem</footer>
        </div>
      </main>
    </>
  );
}
