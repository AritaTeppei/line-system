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
  // 初期値: URL の dateParam があればそれを使い、なければ「今日」
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
  const [submitted, setSubmitted] = useState(false); // ★ 仮予約済みフラグ

  // この予約リンク用の localStorage キー（同じリンクからの二重利用を防ぐ）
  const reservationKey =
    tenantIdParam && customerIdParam && carIdParam
      ? `booking_submitted_${tenantIdParam}_${customerIdParam}_${carIdParam}`
      : null;

  // 初期表示時に「すでにこのリンクから予約送信済みか」をチェック
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

    // すでに送信済みなら完全にブロック
    if (submitted) {
      alert('すでに仮予約を送信済みです。店舗からの連絡をお待ちください。');
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

      // 成功
      setSubmitted(true);
      setNote('');

      if (reservationKey && typeof window !== 'undefined') {
        window.localStorage.setItem(reservationKey, '1');
      }

      alert('ご予約を送信しました。ありがとうございます。');
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
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-3 py-6 sm:px-4 sm:py-10">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-md rounded-2xl border border-slate-200 p-5 sm:p-6">
          {/* 仮予約済みのときは完了画面だけ表示 */}
          {submitted ? (
            <>
              <h1 className="text-2xl font-semibold text-slate-900 mb-2 text-center">
                仮予約が完了しました 🎉
              </h1>
              <p className="text-sm text-slate-800 mb-4 text-center leading-relaxed">
                ご入力いただいた内容で仮予約を受け付けました。
                <br />
                店舗スタッフが内容を確認のうえ、
                <br className="hidden sm:block" />
                あらためてご連絡いたします。
              </p>

              <div className="rounded-2xl bg-blue-50 border border-blue-200 px-4 py-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-2xl">✅</div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">
                      仮予約完了！
                    </p>
                    <p className="text-xs sm:text-sm text-blue-900 leading-relaxed">
                      LINEからのリンクをご利用いただきありがとうございます。
                      <br />
                      まだ予約は「確定」ではありません。
                      <br />
                      日程やお車の状態について確認させていただくため、
                      <br className="hidden sm:block" />
                      スタッフからの折り返し連絡をお待ちください。
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-[11px] sm:text-xs text-slate-600 text-center leading-relaxed">
                画面を閉じていただいて大丈夫です。
                <br />
                万が一、数日経っても連絡がない場合は、
                <br className="hidden sm:block" />
                お手数ですが店舗までお電話にてお問い合わせください。
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-slate-900 mb-2 text-center">
                車検・点検のご予約
              </h1>
              <p className="text-sm text-slate-800 mb-5 text-center leading-relaxed">
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
                {/* 日付 */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    ご希望日 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {/* スマホでも見えるカレンダーアイコン */}
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <span className="text-lg text-slate-400">📅</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-700">
                    本日の日付があらかじめ選択されています。
                    メッセージの内容に合わせて変更も可能です。
                  </p>
                </div>

                {/* 時間帯 */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    ご希望時間帯
                  </label>
                  <select
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="MORNING">午前（MORNING）</option>
                    <option value="AFTERNOON">午後（AFTERNOON）</option>
                    <option value="EVENING">夕方（EVENING）</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-700">
                    正確な入庫時間は店舗からの折り返し連絡にてご相談させていただきます。
                  </p>
                </div>

                {/* メモ */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    ご要望・連絡事項（任意）
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                    placeholder="例）代車希望、仕事の都合で午後からが希望 など"
                  />
                </div>

                {/* ボタン */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading || !!baseError}
                    className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 transition-colors px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                  >
                    {loading ? '送信中…' : 'この内容で予約を送信する'}
                  </button>
                </div>

                <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  送信後、店舗スタッフが内容を確認のうえご連絡いたします。
                  送信だけではご予約はまだ確定していませんのでご注意ください。
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
