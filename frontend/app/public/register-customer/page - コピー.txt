'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

type PreviewResponse = {
  tenantName: string;
  lineUidMasked: string;
};

type ZipCloudResponse = {
  status: number;
  message: string | null;
  results:
    | {
        address1: string; // 都道府県
        address2: string; // 市区町村
        address3: string; // 町域
      }[]
    | null;
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

  // 住所検索用
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState<string | null>(
    null,
  );
  const [addressCandidates, setAddressCandidates] = useState<string[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // 完了画面表示用
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('このURLは無効です（トークンが指定されていません）');
      setLoading(false);
      return;
    }

    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/public/customer-register/${token}`,
    )
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
      const msg =
        'ご登録ありがとうございました。これでLINE連携が完了しました。';
      setSubmitSuccess(msg);
      setCompleted(true);
    } catch (err: any) {
      setSubmitError(err.message ?? '登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearchAddress = async () => {
    setAddressSearchError(null);

    const raw = postalCode.replace(/\D/g, '');
    if (raw.length !== 7) {
      setAddressSearchError('郵便番号は7桁の数字で入力してください');
      return;
    }

    setAddressSearching(true);
    try {
      const res = await fetch(
        `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${raw}`,
      );
      const data: ZipCloudResponse = await res.json();

      if (data.status !== 200 || !data.results || data.results.length === 0) {
        setAddressSearchError('住所が見つかりませんでした');
        return;
      }

      const candidates = data.results.map(
        (r) => `${r.address1}${r.address2}${r.address3}`,
      );

      if (candidates.length === 1) {
        setAddress1(candidates[0]);
      } else {
        setAddressCandidates(candidates);
        setShowAddressModal(true);
      }
    } catch (e) {
      setAddressSearchError('住所検索に失敗しました。時間をおいてお試しください。');
    } finally {
      setAddressSearching(false);
    }
  };

  const handleSelectCandidate = (candidate: string) => {
    setAddress1(candidate);
    setShowAddressModal(false);
  };

  const handleCloseCompleted = () => {
    if (typeof window !== 'undefined') {
      // LINEアプリ内ブラウザなどでは close できる場合あり
      window.close();
    }
    // window.close() が効かなくても、この画面だけ表示されていれば
    // 「フォームを閉じた」状態としてはOK
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-gray-700">読み込み中...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="border border-red-300 text-red-700 px-4 py-3 rounded-xl max-w-md w-full bg-white shadow-sm">
          <p className="font-semibold mb-2 text-sm">リンクエラー</p>
          <p className="text-xs leading-relaxed whitespace-pre-line">{error}</p>
        </div>
      </main>
    );
  }

  // ★ 登録完了後の画面（フォームを閉じるイメージ）
  if (completed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-5 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
            <span className="text-2xl">🎉</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2 text-center">
            ご登録ありがとうございました
          </h1>
          <p className="text-xs text-gray-700 text-center leading-relaxed mb-4">
            {preview?.tenantName ?? '店舗'} の車検・点検通知サービスへのご登録が完了しました。
            <br />
            今後、こちらのLINEアカウント宛にご案内をお届けします。
          </p>
          {submitSuccess && (
            <p className="text-[11px] text-emerald-700 text-center mb-4 whitespace-pre-line">
              {submitSuccess}
            </p>
          )}
          <button
            type="button"
            onClick={handleCloseCompleted}
            className="w-full py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold shadow-sm active:scale-[0.99] transition-transform"
          >
            OK
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center bg-slate-50 p-3">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-md px-4 py-5 mt-4">
        <h1 className="text-lg font-bold mb-2 text-gray-900 text-center">
          お客様情報のご登録
        </h1>
        {preview && (
          <p className="text-xs text-gray-700 mb-4 leading-relaxed text-center">
            {preview.tenantName}
            の車検・点検お知らせサービスにご登録いただきありがとうございます。
            <br />
            このフォームは、LINE ID:{' '}
            <span className="font-mono">{preview.lineUidMasked}</span>
            のお客様に紐づいています。
          </p>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* 姓・名 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-800 mb-1">
                姓 <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="山田"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-800 mb-1">
                名 <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="太郎"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>
          </div>

          {/* 郵便番号＋住所検索 */}
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">
              郵便番号
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="ハイフンなし 例）8120011"
                value={postalCode}
                inputMode="numeric"
                pattern="\d*"
                onChange={(e) => setPostalCode(e.target.value)}
              />
              <button
                type="button"
                onClick={handleSearchAddress}
                disabled={addressSearching || !postalCode}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold whitespace-nowrap disabled:bg-gray-300 disabled:text-gray-600"
              >
                {addressSearching ? '検索中...' : '住所を検索'}
              </button>
            </div>
            {addressSearchError && (
              <p className="mt-1 text-[11px] text-red-600">
                {addressSearchError}
              </p>
            )}
          </div>

          {/* 携帯番号 */}
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">
              携帯番号 <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="ハイフン無し 例）09012345678"
              value={mobilePhone}
              onChange={(e) => setMobilePhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel-national"
            />
          </div>

          {/* 住所1 */}
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">
              住所1（市区町村〜番地）
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="例）福岡県福岡市博多区博多駅前1-1-1"
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
              autoComplete="street-address"
            />
          </div>

          {/* 住所2 */}
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">
              住所2（建物名など）
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="例）〇〇ビル1F"
              value={address2}
              onChange={(e) => setAddress2(e.target.value)}
            />
          </div>

          {submitError && (
            <p className="text-xs text-red-600 whitespace-pre-line">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-2.5 rounded-full text-white text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm active:scale-[0.99] transition-transform"
          >
            {submitting ? '送信中...' : '登録する'}
          </button>
        </form>
      </div>

      {/* 郵便番号候補のモーダル */}
      {showAddressModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-lg p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">
              住所候補を選択してください
            </h2>
            <p className="text-[11px] text-gray-600 mb-3">
              該当する住所をタップすると、「住所1」に反映されます。
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {addressCandidates.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleSelectCandidate(c)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-emerald-50"
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 bg-white"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// useSearchParams を使うコンポーネントを Suspense で包む
export default function PublicRegisterCustomerPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">読み込み中...</div>}>
      <PublicRegisterCustomerInner />
    </Suspense>
  );
}
