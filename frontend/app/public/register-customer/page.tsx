'use client';

import { FormEvent, useEffect, useState, Suspense } from 'react';
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
        address1: string;
        address2: string;
        address3: string;
      }[]
    | null;
};

function PublicRegisterCustomerInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const [addressSearching, setAddressSearching] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null);
  const [addressCandidates, setAddressCandidates] = useState<string[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [completed, setCompleted] = useState(false);

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
      .then((data: PreviewResponse) => setPreview(data))
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

    if (!token) { setSubmitError('トークンがありません'); return; }
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

      await res.json();
      setSubmitSuccess('ご登録ありがとうございました。これでLINE連携が完了しました。');
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
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${raw}`);
      const data: ZipCloudResponse = await res.json();
      if (data.status !== 200 || !data.results || data.results.length === 0) {
        setAddressSearchError('住所が見つかりませんでした');
        return;
      }
      const candidates = data.results.map((r) => `${r.address1}${r.address2}${r.address3}`);
      if (candidates.length === 1) {
        setAddress1(candidates[0]);
      } else {
        setAddressCandidates(candidates);
        setShowAddressModal(true);
      }
    } catch {
      setAddressSearchError('住所検索に失敗しました。時間をおいてお試しください。');
    } finally {
      setAddressSearching(false);
    }
  };

  const handleSelectCandidate = (candidate: string) => {
    setAddress1(candidate);
    setShowAddressModal(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
        <div className="w-10 h-10 rounded-full border-4 border-green-400 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-gray-500">読み込み中...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-red-50 to-white px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-red-100 p-6 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-base font-bold text-gray-900 mb-2">リンクエラー</h1>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{error}</p>
          <p className="mt-4 text-xs text-gray-400">
            お困りの場合は店舗スタッフにお声がけください。
          </p>
        </div>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-green-100 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h1 className="text-lg font-extrabold text-gray-900 mb-2">
            ご登録ありがとうございます！
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            <span className="font-semibold text-green-700">{preview?.tenantName ?? '店舗'}</span>{' '}
            の車検・点検お知らせサービスへのご登録が完了しました。
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            今後、このLINEアカウントから車検・点検のご案内やお知らせをお届けします。<br />
            このページは閉じていただいて構いません。
          </p>
          {submitSuccess && (
            <p className="mt-3 text-xs text-green-700 font-semibold">{submitSuccess}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 via-white to-white">
      {/* ヘッダー */}
      <div className="bg-green-600 text-white px-5 pt-10 pb-8">
        <div className="max-w-sm mx-auto">
          <p className="text-green-200 text-xs font-semibold mb-1 tracking-wide">
            LINE お客様登録フォーム
          </p>
          <h1 className="text-2xl font-extrabold leading-tight">
            お客様情報の<br />ご登録
          </h1>
          {preview && (
            <div className="mt-3 bg-green-700/50 rounded-xl px-4 py-2.5">
              <p className="text-sm font-bold text-white">{preview.tenantName}</p>
              <p className="text-xs text-green-200 mt-0.5">
                車検・点検リマインドサービス
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 説明文 */}
      <div className="max-w-sm mx-auto px-4 mt-5 mb-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-xl flex-shrink-0 mt-0.5">ℹ️</span>
          <p className="text-xs text-amber-800 leading-relaxed">
            車検・点検の時期が近づいた際にLINEでお知らせするため、お客様情報のご登録をお願いしています。
            ご入力いただいた情報は整備・予約管理にのみ利用します。
          </p>
        </div>
      </div>

      {/* フォーム */}
      <div className="max-w-sm mx-auto px-4 pb-10">
        <form className="space-y-4" onSubmit={handleSubmit}>

          {/* 氏名 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 pt-4 pb-5">
            <h2 className="text-xs font-bold text-gray-500 mb-3 tracking-wide">
              氏名 <span className="text-red-500">（必須）</span>
            </h2>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[11px] text-gray-600 mb-1 font-medium">姓</label>
                <input
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition"
                  placeholder="山田"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] text-gray-600 mb-1 font-medium">名</label>
                <input
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition"
                  placeholder="太郎"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
            </div>
          </div>

          {/* 携帯番号 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 pt-4 pb-5">
            <h2 className="text-xs font-bold text-gray-500 mb-3 tracking-wide">
              携帯番号 <span className="text-red-500">（必須）</span>
            </h2>
            <input
              className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition"
              placeholder="09012345678（ハイフンなし）"
              value={mobilePhone}
              onChange={(e) => setMobilePhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel-national"
            />
            <p className="mt-1.5 text-[11px] text-gray-400">
              ハイフンなしで入力してください
            </p>
          </div>

          {/* 住所 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 pt-4 pb-5">
            <h2 className="text-xs font-bold text-gray-500 mb-3 tracking-wide">
              住所 <span className="text-gray-400 font-normal">（任意）</span>
            </h2>

            {/* 郵便番号 */}
            <div className="mb-3">
              <label className="block text-[11px] text-gray-600 mb-1 font-medium">郵便番号</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition"
                  placeholder="8120011（ハイフンなし）"
                  value={postalCode}
                  inputMode="numeric"
                  pattern="\d*"
                  onChange={(e) => setPostalCode(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleSearchAddress}
                  disabled={addressSearching || !postalCode}
                  className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold whitespace-nowrap disabled:bg-gray-300 disabled:text-gray-500 transition active:scale-95"
                >
                  {addressSearching ? '検索中...' : '住所を検索'}
                </button>
              </div>
              {addressSearchError && (
                <p className="mt-1 text-[11px] text-red-500">{addressSearchError}</p>
              )}
            </div>

            {/* 住所1 */}
            <div className="mb-3">
              <label className="block text-[11px] text-gray-600 mb-1 font-medium">
                住所1（市区町村〜番地）
              </label>
              <input
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition"
                placeholder="福岡県福岡市博多区博多駅前1-1-1"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                autoComplete="street-address"
              />
            </div>

            {/* 住所2 */}
            <div>
              <label className="block text-[11px] text-gray-600 mb-1 font-medium">
                住所2（建物名・部屋番号など）
              </label>
              <input
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition"
                placeholder="〇〇ビル1F"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
              />
            </div>
          </div>

          {/* エラー */}
          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              ❌ {submitError}
            </div>
          )}

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-2xl text-white text-base font-extrabold bg-green-600 hover:bg-green-700 active:scale-[0.98] disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md transition-all"
          >
            {submitting ? '⏳ 送信中...' : '✅ 登録する'}
          </button>

          <p className="text-center text-[11px] text-gray-400 leading-relaxed px-2">
            ご入力いただいた情報は、車検・点検・整備などのご案内と予約管理のためにのみ利用します。
          </p>
        </form>
      </div>

      {/* 住所候補モーダル */}
      {showAddressModal && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-t-3xl bg-white shadow-xl p-5 pb-8">
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
            <h2 className="text-sm font-bold text-gray-900 mb-1">住所を選択</h2>
            <p className="text-xs text-gray-500 mb-4">
              該当する住所をタップすると「住所1」に反映されます。
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {addressCandidates.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleSelectCandidate(c)}
                  className="w-full text-left text-sm px-4 py-3 rounded-xl border border-gray-200 hover:bg-green-50 hover:border-green-300 transition"
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAddressModal(false)}
              className="mt-4 w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 font-bold bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function PublicRegisterCustomerPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex flex-col items-center justify-center bg-green-50">
        <div className="w-10 h-10 rounded-full border-4 border-green-400 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-gray-500">読み込み中...</p>
      </main>
    }>
      <PublicRegisterCustomerInner />
    </Suspense>
  );
}
