'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

type PreviewResponse = {
  tenantName: string;
  lineUidMasked: string;
};

function PublicRegisterCustomerInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フォーム state
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('このURLは無効です（トークンが指定されていません）');
      setLoading(false);
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/customer-register/${token}`)
      .then((res) => {
        if (!res.ok) throw res;
        return res.json();
      })
      .then((data: PreviewResponse) => {
        setPreview(data);
      })
      .catch(async (err: any) => {
        try {
          const data = await err.json();
          const msg =
            data?.message ||
            (Array.isArray(data?.message) ? data.message.join(', ') : null);
          setError(msg ?? 'このリンクは無効か、使用できません');
        } catch {
          setError('このリンクは無効か、使用できません');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!token) {
      setSubmitError('トークンがありません');
      return;
    }

    if (!lastName || !firstName || !mobilePhone) {
      setSubmitError('姓・名・携帯番号は必須です');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/customer-register/${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lastName,
            firstName,
            postalCode: postalCode || undefined,
            address1: address1 || undefined,
            address2: address2 || undefined,
            mobilePhone: mobilePhone || undefined,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data?.message ||
          (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
          '登録に失敗しました';
        throw new Error(msg);
      }

      await res.json(); // customer が返ってくるが、今は使わない
      setSubmitSuccess(
        'ご登録ありがとうございました。これでLINE連携が完了しました。',
      );
    } catch (err: any) {
      setSubmitError(err.message ?? '登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
          <p className="font-semibold mb-2">リンクエラー</p>
          <p className="text-sm">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <div className="w-full max-w-md border rounded-md p-4 mt-6 bg-white shadow-sm">
        <h1 className="text-xl font-bold mb-2 text-gray-900">お客様情報のご登録</h1>
        {preview && (
          <p className="text-sm text-gray-800 mb-4">
            {preview.tenantName}
            の車検通知サービスにご登録いただきありがとうございます。
            <br />
            このフォームは、LINE ID: {preview.lineUidMasked} のお客様に紐づいています。
          </p>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-800 mb-1">
                姓 <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-800 mb-1">
                名 <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">郵便番号</label>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              携帯番号 <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={mobilePhone}
              onChange={(e) => setMobilePhone(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              住所1（市区町村〜番地）
            </label>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">住所2（建物名など）</label>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={address2}
              onChange={(e) => setAddress2(e.target.value)}
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}
          {submitSuccess && (
            <p className="text-sm text-green-600">{submitSuccess}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`
    w-full mt-4 py-2
    rounded-md text-white text-sm font-medium
    bg-blue-600 hover:bg-blue-700
    disabled:bg-gray-400 disabled:cursor-not-allowed
    transition-colors
  `}
          >
            {submitting ? '送信中...' : '登録する'}
          </button>
        </form>
      </div>
    </main>
  );
}

// useSearchParams を使うコンポーネントを Suspense で包む
export default function PublicRegisterCustomerPage() {
  return (
    <Suspense fallback={<div className="p-4">読み込み中...</div>}>
      <PublicRegisterCustomerInner />
    </Suspense>
  );
}
