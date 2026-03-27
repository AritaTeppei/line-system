'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type SlotStatus = 'FULL' | 'AVAILABLE';

type DayAvailability = {
  date: string; // "YYYY-MM-DD"
  slots: {
    MORNING: SlotStatus;
    AFTERNOON: SlotStatus;
    EVENING: SlotStatus;
  };
};

type TenantAvailabilityResponse = {
  tenantId: number;
  month: string;
  capacityPerSlot: number;
  days: DayAvailability[];
};

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const PURPOSE_OPTIONS = [
  { value: '整備依頼', label: '整備依頼', icon: '🔧', sub: '車検・点検・修理など' },
  { value: '乗換相談', label: '乗換相談', icon: '🚗', sub: '新車・中古車のご相談' },
  { value: 'その他', label: 'その他', icon: '💬', sub: 'ご不明点・お問い合わせ' },
];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function LineBookingFormInner() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams?.get('token') ?? null;

  const [tokenStatus, setTokenStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'used'>('loading');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [lineUid, setLineUid] = useState<string | null>(null);

  // トークン検証
  useEffect(() => {
    if (!tokenParam) {
      setTokenStatus('invalid');
      setTokenError('リンクの情報が不足しています。LINEで「予約」と送って新しいリンクを受け取ってください。');
      return;
    }
    fetch(`${apiBase}/public/bookings/verify-token/${encodeURIComponent(tokenParam)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok) {
          setTenantId(data.tenantId);
          setLineUid(data.lineUid);
          setTokenStatus('valid');
        } else {
          const msg: string = data?.message ?? 'このリンクは無効です。';
          if (msg.includes('使用済み')) setTokenStatus('used');
          else if (msg.includes('有効期限')) setTokenStatus('expired');
          else setTokenStatus('invalid');
          setTokenError(msg);
        }
      })
      .catch(() => {
        setTokenStatus('invalid');
        setTokenError('通信エラーが発生しました。');
      });
  }, [tokenParam]);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, DayAvailability>>(new Map());
  const [availLoading, setAvailLoading] = useState(false);

  // Form state
  const [timeSlot, setTimeSlot] = useState<string>('MORNING');
  const [purpose, setPurpose] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const todayKey = toDateKey(new Date());

  // Fetch availability for current month
  useEffect(() => {
    if (!tenantId) return;
    const monthKey = toMonthKey(currentMonth);
    setAvailLoading(true);
    fetch(`${apiBase}/public/bookings/tenant-availability?tenantId=${tenantId}&month=${monthKey}`)
      .then((res) => {
        if (!res.ok) throw new Error('availability fetch failed');
        return res.json() as Promise<TenantAvailabilityResponse>;
      })
      .then((data) => {
        setAvailabilityMap((prev) => {
          const next = new Map(prev);
          for (const day of data.days) {
            next.set(day.date, day);
          }
          return next;
        });
      })
      .catch((err) => console.error('availability error:', err))
      .finally(() => setAvailLoading(false));
  }, [tenantId, currentMonth]);

  const monthInfo = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = firstDay.getDay();

    type Cell = {
      key: string;
      dayNumber: number | null;
      dateKey: string | null;
      isPast: boolean;
      allFull: boolean;
      dayAvail: DayAvailability | null;
    };

    const cells: Cell[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ key: `empty-${i}`, dayNumber: null, dateKey: null, isPast: false, allFull: false, dayAvail: null });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const key = toDateKey(d);
      const isPast = key < todayKey;
      const dayAvail = availabilityMap.get(key) ?? null;
      const allFull = dayAvail
        ? dayAvail.slots.MORNING === 'FULL' &&
          dayAvail.slots.AFTERNOON === 'FULL' &&
          dayAvail.slots.EVENING === 'FULL'
        : false;

      cells.push({ key, dayNumber: day, dateKey: key, isPast, allFull, dayAvail });
    }

    return { year, month, daysInMonth, cells };
  }, [currentMonth, availabilityMap, todayKey]);

  const selectedDayAvail = selectedDate ? availabilityMap.get(selectedDate) ?? null : null;

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!tenantId) {
      setErrorMsg('リンクの情報が不足しています。');
      return;
    }
    if (!selectedDate) {
      setErrorMsg('ご希望の日付を選択してください。');
      return;
    }
    if (!purpose) {
      setErrorMsg('ご用件を選択してください。');
      return;
    }
    if (!guestName.trim()) {
      setErrorMsg('お名前を入力してください。');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${apiBase}/public/bookings/inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenParam,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim() || undefined,
          bookingDate: selectedDate,
          timeSlot,
          purpose,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = (data && data.message) || '予約の送信に失敗しました。';
        setErrorMsg(msg);
        return;
      }

      setSubmitted(true);
    } catch {
      setErrorMsg('通信エラーが発生しました。時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  // トークン検証中
  if (tokenStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">リンクを確認しています...</p>
      </div>
    );
  }

  // 無効・期限切れ・使用済み
  if (tokenStatus !== 'valid') {
    const icon = tokenStatus === 'used' ? '✅' : '⚠️';
    const title = tokenStatus === 'used' ? 'このリンクは使用済みです' : tokenStatus === 'expired' ? 'リンクの有効期限切れ' : 'リンクが無効です';
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="bg-gray-800 px-5 pt-10 pb-8 text-white">
          <div className="text-3xl font-black">{icon}</div>
          <h1 className="mt-2 text-xl font-extrabold">{title}</h1>
        </div>
        <div className="flex-1 px-4 py-6 space-y-4">
          <div className="rounded-2xl bg-gray-800 border border-gray-700 p-5">
            <p className="text-sm text-gray-300 leading-relaxed">{tokenError}</p>
          </div>
        </div>
      </div>
    );
  }

  // Thank you screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="bg-green-700 px-5 pt-10 pb-8 text-white">
          <div className="text-3xl font-black">🎉</div>
          <h1 className="mt-2 text-xl font-extrabold">仮予約が完了しました！</h1>
          <p className="mt-1 text-sm text-green-200">ありがとうございます</p>
        </div>
        <div className="flex-1 px-4 py-6 space-y-4">
          <div className="rounded-2xl bg-gray-800 border border-gray-700 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-bold text-white mb-1">仮予約を受け付けました</p>
                <p className="text-sm text-gray-300 leading-relaxed">
                  店舗スタッフが内容を確認のうえ、あらためてご連絡いたします。
                  まだ予約は「確定」ではありませんのでご注意ください。
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-amber-900/40 border border-amber-700 p-4">
            <p className="text-sm text-amber-200 leading-relaxed">
              📞 数日経っても連絡がない場合は、お手数ですが店舗までお電話にてお問い合わせください。
            </p>
          </div>
          <p className="text-center text-sm text-gray-500 pt-2">
            このページは閉じていただいて構いません
          </p>
        </div>
      </div>
    );
  }

  const monthLabel = `${monthInfo.year}年 ${monthInfo.month + 1}月`;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-5 pt-10 pb-8 text-white border-b border-gray-700">
        <div className="text-3xl font-black text-green-400">📅</div>
        <h1 className="mt-2 text-xl font-extrabold text-white">ご予約フォーム</h1>
        <p className="mt-1 text-sm text-gray-400">ご希望の日時・ご用件をお選びください</p>
      </div>

      <div className="flex-1 px-4 py-5 space-y-5">
        {/* Error */}
        {errorMsg && (
          <div className="rounded-2xl bg-red-900/50 border border-red-700 p-4">
            <p className="text-sm text-red-300">{errorMsg}</p>
          </div>
        )}

        {/* Calendar Card */}
        <div className="rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <p className="text-xs font-bold text-green-400 uppercase tracking-wide">📅 ご希望日</p>
            {availLoading && <span className="text-xs text-gray-400">読み込み中...</span>}
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-200 text-sm font-bold hover:bg-gray-600 active:bg-gray-500"
            >
              ＜
            </button>
            <span className="text-sm font-bold text-white">{monthLabel}</span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-200 text-sm font-bold hover:bg-gray-600 active:bg-gray-500"
            >
              ＞
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {WEEKDAY_LABELS.map((w, idx) => (
              <div
                key={w}
                className={`text-center text-[11px] font-bold py-1 ${
                  idx === 0 ? 'text-red-400' : idx === 6 ? 'text-blue-400' : 'text-gray-400'
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7 gap-1 px-2 pb-3">
            {monthInfo.cells.map((cell) => {
              if (cell.dayNumber === null) {
                return <div key={cell.key} className="min-h-[3rem]" />;
              }

              const isSelected = cell.dateKey === selectedDate;
              const isPast = cell.isPast;
              const allFull = cell.allFull;
              const isToday = cell.dateKey === todayKey;
              const isDisabled = isPast || allFull;

              let cellClass = 'min-h-[3rem] rounded-xl flex flex-col items-center justify-center text-center text-xs font-bold transition-all ';

              if (isSelected) {
                cellClass += 'bg-green-500 text-white ring-2 ring-green-300';
              } else if (isDisabled) {
                cellClass += allFull
                  ? 'bg-red-900/40 text-red-500 cursor-not-allowed'
                  : 'bg-gray-700/50 text-gray-600 cursor-not-allowed';
              } else {
                cellClass += 'bg-gray-700 text-gray-100 hover:bg-green-700 hover:text-white cursor-pointer active:bg-green-600';
              }

              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled && cell.dateKey) {
                      setSelectedDate(cell.dateKey);
                    }
                  }}
                  className={cellClass}
                >
                  <span>{cell.dayNumber}</span>
                  {isToday && !isSelected && (
                    <span className="text-[8px] text-green-400 leading-none">今日</span>
                  )}
                  {allFull && (
                    <span className="text-[8px] text-red-500 leading-none">満</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="px-4 pb-3 flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> 選択中</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900/60 inline-block" /> 満席</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-700/50 inline-block" /> 選択不可</span>
          </div>
        </div>

        {/* Time slot selector */}
        {selectedDate && (
          <div className="rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <p className="text-xs font-bold text-green-400 uppercase tracking-wide">🕐 ご希望時間帯</p>
              <p className="text-xs text-gray-400 mt-0.5">{selectedDate.replace(/-/g, '/')} の空き状況</p>
            </div>
            <div className="px-4 py-4 space-y-3">
              {[
                { value: 'MORNING', label: '午前', sub: '9:00〜12:00 ごろ', slotKey: 'MORNING' as const },
                { value: 'AFTERNOON', label: '午後', sub: '13:00〜17:00 ごろ', slotKey: 'AFTERNOON' as const },
                { value: 'EVENING', label: '夕方', sub: '17:00〜19:00 ごろ', slotKey: 'EVENING' as const },
              ].map((opt) => {
                const slotStatus = selectedDayAvail?.slots[opt.slotKey] ?? 'AVAILABLE';
                const isFull = slotStatus === 'FULL';
                const isSelected = timeSlot === opt.value;

                return (
                  <div
                    key={opt.value}
                    onClick={() => !isFull && setTimeSlot(opt.value)}
                    className={`flex items-center gap-4 rounded-xl border-2 px-4 py-3 transition-colors ${
                      isFull
                        ? 'border-gray-700 bg-gray-700/30 cursor-not-allowed opacity-50'
                        : isSelected
                        ? 'border-green-500 bg-green-900/30 cursor-pointer'
                        : 'border-gray-600 bg-gray-700 cursor-pointer hover:border-green-600'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-green-400' : 'border-gray-500'
                      }`}
                    >
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-green-400" />}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${isFull ? 'text-gray-500' : 'text-white'}`}>{opt.label}</p>
                      <p className="text-xs text-gray-400">{opt.sub}</p>
                    </div>
                    {isFull && (
                      <span className="text-xs font-bold text-red-400 bg-red-900/40 px-2 py-0.5 rounded-full">満席</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Purpose selector */}
        <div className="rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-xs font-bold text-green-400 uppercase tracking-wide">📋 ご用件</p>
          </div>
          <div className="px-4 py-4 grid grid-cols-1 gap-3">
            {PURPOSE_OPTIONS.map((opt) => {
              const isSelected = purpose === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPurpose(opt.value)}
                  className={`w-full flex items-center gap-4 rounded-xl border-2 px-4 py-4 text-left transition-all ${
                    isSelected
                      ? 'border-green-500 bg-green-900/30'
                      : 'border-gray-600 bg-gray-700 hover:border-green-600'
                  }`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <div>
                    <p className={`font-bold text-base ${isSelected ? 'text-green-300' : 'text-white'}`}>{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.sub}</p>
                  </div>
                  {isSelected && <span className="ml-auto text-green-400 text-lg">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Guest name */}
        <div className="rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-xs font-bold text-green-400 uppercase tracking-wide">
              👤 お名前 <span className="text-red-400 font-bold ml-1">必須</span>
            </p>
          </div>
          <div className="px-4 py-4">
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="例）山田 太郎"
              className="block w-full rounded-xl border border-gray-600 bg-gray-700 px-4 py-3 text-base text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>

        {/* Guest phone */}
        <div className="rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-xs font-bold text-green-400 uppercase tracking-wide">
              📞 電話番号
              <span className="ml-2 font-normal text-gray-400">任意</span>
            </p>
          </div>
          <div className="px-4 py-4">
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="例）090-1234-5678"
              className="block w-full rounded-xl border border-gray-600 bg-gray-700 px-4 py-3 text-base text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>

        {/* Note */}
        <div className="rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-xs font-bold text-green-400 uppercase tracking-wide">
              💬 メッセージ
              <span className="ml-2 font-normal text-gray-400">任意</span>
            </p>
          </div>
          <div className="px-4 py-4">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="例）タイヤ交換もお願いしたい、午前の早い時間が希望 など"
              className="block w-full rounded-xl border border-gray-600 bg-gray-700 px-4 py-3 text-base text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2 pb-10">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-2xl bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:bg-gray-600 disabled:text-gray-400 transition-colors px-4 py-4 text-base font-extrabold text-white shadow-lg"
          >
            {submitting ? (
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
          <p className="mt-3 text-xs text-center text-gray-500 leading-relaxed">
            送信後、店舗スタッフからご連絡いたします。送信だけではご予約はまだ確定していません。
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LineBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    }>
      <LineBookingFormInner />
    </Suspense>
  );
}
