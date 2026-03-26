'use client';

import { FormEvent, useState, useMemo, useEffect } from 'react';

type ApiResponse =
  | { ok: true }
  | { ok?: false; message?: string };

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Props = {
  tenantIdParam: string | null;
  customerIdParam: string | null;
  carIdParam: string | null;
  dateParam: string | null;
};

export default function PublicBookingForm({
  tenantIdParam,
  customerIdParam,
  carIdParam,
  dateParam,
}: Props) {
  const computeInitialDate = () => {
    if (dateParam) return dateParam;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [bookingDate, setBookingDate] = useState<string>(computeInitialDate);
  const [timeSlot, setTimeSlot] = useState<string>('MORNING');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loanerCar, setLoanerCar] = useState<'NEED' | 'NO' | ''>('');

  const reservationKey =
    tenantIdParam && customerIdParam && carIdParam
      ? `booking_submitted_${tenantIdParam}_${customerIdParam}_${carIdParam}`
      : null;

  useEffect(() => {
    if (!reservationKey) return;
    if (typeof window === 'undefined') return;
    const flag = window.localStorage.getItem(reservationKey);
    if (flag === '1') {
      setSubmitted(true);
    }
  }, [reservationKey]);

  const baseError = useMemo(() => {
    if (!tenantIdParam || !customerIdParam || !carIdParam) {
      return 'リンクの情報が不足しています。お手数ですが店舗までお電話にてご連絡ください。';
    }
    return null;
  }, [tenantIdParam, customerIdParam, carIdParam]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (submitted) return;

    if (!loanerCar) {
      setErrorMsg('代車の有無を選択してください。');
      return;
    }

    if (baseError) {
      setErrorMsg(baseError);
      return;
    }

    if (!bookingDate) {
      setErrorMsg('ご希望の日付を選択してください。');
      return;
    }

    if (!tenantIdParam || !customerIdParam || !carIdParam) {
      setErrorMsg('予約に必要な情報が不足しています。店舗までお電話にてご連絡ください。');
      return;
    }

    const tenantId = Number(tenantIdParam);
    const customerId = Number(customerIdParam);
    const carId = Number(carIdParam);

    if (Number.isNaN(tenantId) || Number.isNaN(customerId) || Number.isNaN(carId)) {
      setErrorMsg('予約に必要な情報が正しく取得できませんでした。店舗までお電話にてご連絡ください。');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/public/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          customerId,
          carId,
          bookingDate,
          timeSlot,
          needsLoanerCar: loanerCar === 'NEED',
          note,
        }),
      });

      const data = (await res.json().catch(() => null)) as ApiResponse | null;

      if (!res.ok || (data && data.ok === false)) {
        const msg =
          (data && 'message' in data && data.message) ||
          '予約の送信に失敗しました。時間をおいて再度お試しください。';
        setErrorMsg(msg);
        return;
      }

      setSubmitted(true);
      setNote('');
      if (reservationKey && typeof window !== 'undefined') {
        window.localStorage.setItem(reservationKey, '1');
      }
    } catch {
      setErrorMsg('通信エラーが発生しました。時間をおいて再度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  // 完了画面
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* ヘッダー */}
        <div className="bg-green-600 px-5 pt-10 pb-8 text-white">
          <div className="text-3xl font-black tracking-tight">🎉</div>
          <h1 className="mt-2 text-xl font-extrabold">仮予約が完了しました！</h1>
          <p className="mt-1 text-sm text-green-100">ありがとうございます</p>
        </div>

        <div className="flex-1 px-4 py-6 space-y-4">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-bold text-gray-900 mb-1">仮予約を受け付けました</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  店舗スタッフが内容を確認のうえ、あらためてご連絡いたします。
                  まだ予約は「確定」ではありませんのでご注意ください。
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-800 leading-relaxed">
              📞 数日経っても連絡がない場合は、お手数ですが店舗までお電話にてお問い合わせください。
            </p>
          </div>

          <p className="text-center text-sm text-gray-400 pt-2">
            このページは閉じていただいて構いません
          </p>
        </div>
      </div>
    );
  }

  // エラー画面（baseError）
  if (baseError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-red-500 px-5 pt-10 pb-8 text-white">
          <div className="text-3xl font-black">⚠️</div>
          <h1 className="mt-2 text-xl font-extrabold">リンクが無効です</h1>
        </div>
        <div className="flex-1 px-4 py-6">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-700 leading-relaxed">{baseError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-green-600 px-5 pt-10 pb-8 text-white">
        <div className="text-3xl font-black">🚗</div>
        <h1 className="mt-2 text-xl font-extrabold">車検・点検のご予約</h1>
        <p className="mt-1 text-sm text-green-100">仮予約フォーム</p>
      </div>

      {/* 案内バナー */}
      <div className="mx-4 -mt-4 rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          📋 ご希望の日程をお選びいただき、送信してください。
          送信後、店舗スタッフが内容を確認のうえご連絡いたします。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-4 py-5 space-y-4">
        {/* エラー */}
        {errorMsg && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* 日付カード */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-green-50 border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide">📅 ご希望日</p>
          </div>
          <div className="px-4 py-4 space-y-2">
            <input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              required
              className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
            />
            <p className="text-xs text-gray-500">
              メッセージに記載の日程に合わせて変更いただけます
            </p>
          </div>
        </div>

        {/* 時間帯カード */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-green-50 border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide">🕐 ご希望時間帯</p>
          </div>
          <div className="px-4 py-4 space-y-3">
            {[
              { value: 'MORNING', label: '午前中', sub: '9:00〜12:00 ごろ' },
              { value: 'AFTERNOON', label: '午後', sub: '13:00〜17:00 ごろ' },
              { value: 'EVENING', label: '夕方', sub: '17:00〜19:00 ごろ' },
            ].map((opt) => (
              <div
                key={opt.value}
                onClick={() => setTimeSlot(opt.value)}
                className={`flex items-center gap-4 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${
                  timeSlot === opt.value
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  timeSlot === opt.value ? 'border-green-500' : 'border-gray-300'
                }`}>
                  {timeSlot === opt.value && (
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.sub}</p>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-500 pt-1">
              正確な入庫時間は折り返しのご連絡にてご相談いたします
            </p>
          </div>
        </div>

        {/* 代車カード */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-green-50 border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide">🚙 代車</p>
          </div>
          <div className="px-4 py-4 space-y-3">
            {[
              { value: 'NEED', label: '必要', sub: '代車をご利用希望' },
              { value: 'NO', label: '不要', sub: '代車は必要ありません' },
            ].map((opt) => (
              <div
                key={opt.value}
                onClick={() => setLoanerCar(opt.value as 'NEED' | 'NO')}
                className={`flex items-center gap-4 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${
                  loanerCar === opt.value
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  loanerCar === opt.value ? 'border-green-500' : 'border-gray-300'
                }`}>
                  {loanerCar === opt.value && (
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* メモカード */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-green-50 border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide">
              💬 ご要望・連絡事項
              <span className="ml-2 font-normal text-gray-400">任意</span>
            </p>
          </div>
          <div className="px-4 py-4">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 resize-none"
              placeholder="例）タイヤ交換もお願いしたい、午後の早い時間が希望 など"
            />
          </div>
        </div>

        {/* 送信ボタン */}
        <div className="pt-2 pb-8">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-300 disabled:text-gray-400 transition-colors px-4 py-4 text-base font-extrabold text-white shadow-md"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                送信中...
              </span>
            ) : (
              'この内容で仮予約を送信する →'
            )}
          </button>
          <p className="mt-3 text-xs text-center text-gray-400 leading-relaxed">
            送信後、店舗スタッフからご連絡いたします。
            送信だけではご予約はまだ確定していません。
          </p>
        </div>
      </form>
    </div>
  );
}
