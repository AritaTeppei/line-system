'use client';

import { FormEvent, useState, useMemo } from 'react';

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
  const [bookingDate, setBookingDate] = useState<string>(dateParam ?? '');
  const [timeSlot, setTimeSlot] = useState<string>('MORNING');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const baseError = useMemo(() => {
    if (!tenantIdParam || !customerIdParam || !carIdParam) {
      return 'リンクの情報が不足しています。お手数ですが店舗までお電話にてご連絡ください。';
    }
    return null;
  }, [tenantIdParam, customerIdParam, carIdParam]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (baseError) {
      setErrorMsg(baseError);
      return;
    }

    if (!bookingDate) {
      setErrorMsg('ご希望の日付を選択してください。');
      return;
    }

    if (!tenantIdParam || !customerIdParam || !carIdParam) {
      setErrorMsg(
        '予約に必要な情報が不足しています。店舗までお電話にてご連絡ください。',
      );
      return;
    }

    const tenantId = Number(tenantIdParam);
    const customerId = Number(customerIdParam);
    const carId = Number(carIdParam);

    if (
      Number.isNaN(tenantId) ||
      Number.isNaN(customerId) ||
      Number.isNaN(carId)
    ) {
      setErrorMsg(
        '予約に必要な情報が正しく取得できませんでした。店舗までお電話にてご連絡ください。',
      );
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
          timeSlot, // "MORNING" | "AFTERNOON" | "EVENING"
          note,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | ApiResponse
        | null;

      if (!res.ok || (data && data.ok === false)) {
        const msg =
          (data && 'message' in data && data.message) ||
          '予約の送信に失敗しました。時間をおいて再度お試しください。';
        setErrorMsg(msg);
        alert(msg);
        return;
      }

      alert('ご予約を送信しました。ありがとうございます。');
      setNote('');
    } catch (err) {
      console.error(err);
      const msg =
        '通信エラーが発生しました。時間をおいて再度お試しください。';
      setErrorMsg(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="bg-white shadow-md rounded-xl border border-slate-200 p-6 sm:p-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-2 text-center">
            車検・点検のご予約
          </h1>
          <p className="text-sm text-slate-700 mb-6 text-center">
            日付と時間帯をお選びいただき、必要事項をご記入のうえ送信してください。
          </p>

          {baseError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
              {baseError}
            </div>
          )}

          {errorMsg && !baseError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5 text-slate-900"
          >
            <div>
              <label className="block text-sm font-medium mb-1">
                ご希望日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-slate-600">
                メッセージ内の日付があらかじめ選択されています。変更も可能です。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                ご希望時間帯
              </label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="MORNING">午前（MORNING）</option>
                <option value="AFTERNOON">午後（AFTERNOON）</option>
                <option value="EVENING">夕方（EVENING）</option>
              </select>
              <p className="mt-1 text-xs text-slate-600">
                正確な入庫時間は店舗からの折り返し連絡にてご相談させていただきます。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                ご要望・連絡事項（任意）
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                placeholder="例）代車希望、仕事の都合で午後からが希望 など"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !!baseError}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 transition-colors px-4 py-2.5 text-sm sm:text-base font-semibold text-white shadow-sm"
              >
                {loading ? '送信中…' : 'この内容で予約を送信する'}
              </button>
            </div>

            <p className="mt-3 text-[11px] sm:text-xs text-slate-500 leading-relaxed">
              送信後、店舗スタッフが内容を確認のうえご連絡いたします。
              送信だけではご予約はまだ確定していませんのでご注意ください。
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
