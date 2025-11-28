// frontend/app/bookings/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import TenantLayout from '../components/TenantLayout';

type Role = 'DEVELOPER' | 'MANAGER' | 'CLIENT';

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
};

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELED';

async function updateBookingStatus(
  id: number,
  status: BookingStatus,
  token: string,
) {
  const res = await fetch(`${apiBase}/bookings/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg =
      (data && (data.message as string)) ||
      '予約ステータスの更新に失敗しました。';
    throw new Error(msg);
  }

  return (await res.json().catch(() => null)) ?? null;
}

type TimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING' | string;

type Booking = {
  id: number;
  bookingDate: string; // ISO文字列 "2026-01-26T00:00:00.000Z" など
  timeSlot: TimeSlot;
  status: BookingStatus;
  note?: string | null;
  source?: string | null;
  customer?: {
    lastName: string;
    firstName: string;
  } | null;
  car?: {
    carName?: string | null;
    registrationNumber?: string | null;
  } | null;
};

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// 日付キーを "YYYY-MM-DD" にそろえるヘルパー
function toDateKey(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 日本語の曜日
const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

export default function BookingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // カレンダー用：現在表示している「月」の先頭日
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // カレンダー用：選択中の日付（"YYYY-MM-DD"）
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(
    null,
  );

  // --- 初期ロード（ログインユーザー & 予約一覧） ---
  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;

    if (!token) {
      setLoading(false);
      setErrorMsg('ログイン情報が見つかりません。再ログインしてください。');
      return;
    }

    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
    };

    // /auth/me と /bookings を並列で取りに行く
    const fetchMe = fetch(`${apiBase}/auth/me`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('auth/me api error');
        return res.json();
      })
      .then((data: Me) => setMe(data));

    const fetchBookings = fetch(`${apiBase}/bookings`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('bookings api error');
        return res.json();
      })
      .then((data: Booking[]) => setBookings(data));

    Promise.all([fetchMe, fetchBookings])
      .catch((err) => {
        console.error(err);
        setErrorMsg('予約一覧の取得に失敗しました。時間をおいて再度お試しください。');
      })
      .finally(() => setLoading(false));
  }, []);

  // --- 予約を日付ごとにグルーピング ---
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (!b.bookingDate) continue;
      const key = toDateKey(b.bookingDate);
      const existing = map.get(key) ?? [];
      existing.push(b);
      map.set(key, existing);
    }
    return map;
  }, [bookings]);

  // 選択中の日の予約一覧（なければ空配列）
  const selectedBookings: Booking[] = useMemo(() => {
    if (!selectedDateKey) return [];
    return bookingsByDate.get(selectedDateKey) ?? [];
  }, [selectedDateKey, bookingsByDate]);

  // 月のメタ情報（表示ヘッダー用）
  const monthInfo = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth(); // 0-based
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = firstDay.getDay(); // 0:日

    // カレンダーセル用の配列を作る
    const cells: {
      key: string;
      dayNumber: number | null;
      dateKey: string | null;
      totalCount: number;
      pendingCount: number;
    }[] = [];

    // 先頭の空セル
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({
        key: `empty-${i}`,
        dayNumber: null,
        dateKey: null,
        totalCount: 0,
        pendingCount: 0,
      });
    }

    // 1日〜月末
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const key = toDateKey(d);
      const list = bookingsByDate.get(key) ?? [];
      const totalCount = list.length;
      const pendingCount = list.filter(
        (b) => b.status === 'PENDING',
      ).length;

      cells.push({
        key,
        dayNumber: day,
        dateKey: key,
        totalCount,
        pendingCount,
      });
    }

    return {
      year,
      month, // 0-based
      daysInMonth,
      cells,
    };
  }, [currentMonth, bookingsByDate]);

  const todayKey = toDateKey(new Date());

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      return new Date(y, m - 1, 1);
    });
    setSelectedDateKey(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      return new Date(y, m + 1, 1);
    });
    setSelectedDateKey(null);
  };

  // テキスト表示用
  const monthLabel = `${monthInfo.year}年 ${monthInfo.month + 1}月`;

  // 一覧の並び順（時間帯の表示用）
  const timeSlotLabel = (slot: TimeSlot) => {
    switch (slot) {
      case 'MORNING':
        return '午前';
      case 'AFTERNOON':
        return '午後';
      case 'EVENING':
        return '夕方';
      default:
        return String(slot || '');
    }
  };

  const statusLabel = (s: BookingStatus) => {
    switch (s) {
      case 'PENDING':
        return '未確認';
      case 'CONFIRMED':
        return '確定';
      case 'CANCELED':
        return 'キャンセル';
    }
  };

  const statusBadgeClass = (s: BookingStatus) => {
    switch (s) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'CANCELED':
        return 'bg-gray-100 text-gray-500 border-gray-300';
    }
  };

  // ★ ここから追加：ステータス変更ハンドラ
  const handleChangeStatus = async (
    bookingId: number,
    nextStatus: BookingStatus,
  ) => {
    // ログイン情報（JWT）を localStorage から取得
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;

    if (!token) {
      alert('ログイン情報が見つかりません。再ログインしてください。');
      return;
    }

    try {
      setUpdatingId(bookingId);

      // バックエンドに PATCH /bookings/:id/status を送る
      await updateBookingStatus(bookingId, nextStatus, token);

      // 成功したらフロント側の state を更新
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: nextStatus } : b,
        ),
      );

      // 確定のときだけ文言を変える（バックエンドでLINE送信済み前提）
      if (nextStatus === 'CONFIRMED') {
        alert(
          '予約を「確定」に更新しました。お客様へご予約確定メッセージを送信しました。',
        );
      } else {
        alert('予約ステータスを更新しました。');
      }
    } catch (e: any) {
      console.error(e);
      alert(
        e?.message ?? '予約ステータスの更新に失敗しました。時間をおいて再度お試しください。',
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="text-sm text-gray-600">読み込み中...</div>
      </TenantLayout>
    );
  }

  if (errorMsg) {
    return (
      <TenantLayout>
        <div className="max-w-xl mx-auto mt-8">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              予約カレンダー
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              カレンダー上で予約の件数と重複状況を確認できます。日付をクリックすると、その日の予約一覧が下に表示されます。
            </p>
          </div>
          {me && (
            <div className="text-xs text-slate-500 text-right">
              ログイン中:{' '}
              <span className="font-medium text-slate-700">
                {me.email}
              </span>
              <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5">
                {me.role === 'DEVELOPER'
                  ? '開発者'
                  : me.role === 'MANAGER'
                  ? '管理者'
                  : 'スタッフ'}
              </span>
            </div>
          )}
        </header>

        {/* カレンダー部分 */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="px-2 py-1 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                ＜ 前の月
              </button>
              <div className="text-sm sm:text-base font-semibold text-slate-900">
                {monthLabel}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="px-2 py-1 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                次の月 ＞
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500">
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-blue-100 border border-blue-300" />
                <span>本日</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-100 border border-emerald-300" />
                <span>予約あり</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] w-4 h-4">
                  !
                </span>
                <span>未確認予約あり</span>
              </div>
            </div>
          </div>

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 text-center text-[11px] sm:text-xs text-slate-500 mb-1">
            {weekdayLabels.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          {/* 日付セル */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-xs">
            {monthInfo.cells.map((cell) => {
              if (cell.dayNumber == null) {
                return (
                  <div
                    key={cell.key}
                    className="h-14 sm:h-16 rounded-lg bg-transparent"
                  />
                );
              }

              const isToday = cell.dateKey === todayKey;
              const isSelected = cell.dateKey === selectedDateKey;
              const hasBooking = cell.totalCount > 0;
              const hasPending = cell.pendingCount > 0;

              let baseClass =
                'h-14 sm:h-16 rounded-lg border flex flex-col items-stretch justify-between px-1.5 py-1 cursor-pointer transition-colors';
              if (isSelected) {
                baseClass += ' border-blue-500 bg-blue-50';
              } else if (isToday) {
                baseClass += ' border-blue-400 bg-blue-50/60';
              } else if (hasBooking) {
                baseClass += ' border-emerald-300 bg-emerald-50';
              } else {
                baseClass +=
                  ' border-slate-200 bg-slate-50 hover:bg-slate-100';
              }

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() =>
                    cell.dateKey && setSelectedDateKey(cell.dateKey)
                  }
                  className={baseClass}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-700">
                    <span className="font-semibold text-[11px]">
                      {cell.dayNumber}
                    </span>
                    {isToday && (
                      <span className="text-[10px] text-blue-600">
                        今日
                      </span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col items-start justify-end gap-0.5">
                    {hasBooking && (
                      <span className="inline-flex items-center rounded-full bg-emerald-600 text-white text-[10px] px-1.5">
                        予約 {cell.totalCount}件
                      </span>
                    )}
                    {hasPending && (
                      <span className="inline-flex items-center rounded-full bg-red-500 text-white text-[10px] px-1.5">
                        未確認 {cell.pendingCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 sm:mt-4 text-[11px] text-slate-500 sm:hidden">
            日付をタップすると、その日の予約一覧が画面下部に表示されます。
          </div>
        </section>

        {/* 選択した日の予約一覧 */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900 mb-3">
            {selectedDateKey
              ? `${selectedDateKey} の予約一覧`
              : '日付を選択すると、その日の予約が表示されます'}
          </h2>

          {selectedDateKey && selectedBookings.length === 0 && (
            <p className="text-xs text-slate-500">
              この日には予約が登録されていません。
            </p>
          )}

          {selectedDateKey && selectedBookings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[11px] sm:text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="px-2 py-1 border border-slate-200 text-left">
                      時間帯
                    </th>
                    <th className="px-2 py-1 border border-slate-200 text-left">
                      顧客
                    </th>
                    <th className="px-2 py-1 border border-slate-200 text-left">
                      車両
                    </th>
                    <th className="px-2 py-1 border border-slate-200 text-left">
                      ステータス
                    </th>
                    <th className="px-2 py-1 border border-slate-200 text-left">
                      メモ
                    </th>
                    <th className="px-2 py-1 border border-slate-200 text-left">
                      受付経路
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBookings
                    .slice()
                    .sort((a, b) =>
                      (a.timeSlot || '').localeCompare(
                        b.timeSlot || '',
                      ),
                    )
                    .map((b) => {
                      const customerName = b.customer
                        ? `${b.customer.lastName ?? ''} ${
                            b.customer.firstName ?? ''
                          }`.trim()
                        : '-';

                      const carLabel = b.car
                        ? `${b.car.carName ?? ''}${
                            b.car.registrationNumber
                              ? `（${b.car.registrationNumber}）`
                              : ''
                          }`
                        : '-';

                      return (
                        <tr key={b.id} className="text-slate-800">
                          <td className="px-2 py-1 border border-slate-200 whitespace-nowrap">
                            {timeSlotLabel(b.timeSlot)}
                          </td>
                          <td className="px-2 py-1 border border-slate-200 whitespace-nowrap">
                            {customerName || '-'}
                          </td>
                          <td className="px-2 py-1 border border-slate-200 whitespace-nowrap">
                            {carLabel || '-'}
                          </td>
                          <td className="px-2 py-1 border border-slate-200 whitespace-nowrap">
  <div className="flex flex-col items-start gap-1">
    {/* 現在ステータスのバッジ表示（見た目はほぼそのまま） */}
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${statusBadgeClass(
        b.status,
      )}`}
    >
      {statusLabel(b.status)}
    </span>

    {/* ステータス変更用セレクト（スマホでも押しやすいよう幅広め） */}
    <select
      value={b.status}
      onChange={(e) =>
        handleChangeStatus(
          b.id,
          e.target.value as BookingStatus,
        )
      }
      disabled={updatingId === b.id}
      className="mt-0.5 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] sm:text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="PENDING">未確認</option>
      <option value="CONFIRMED">確定</option>
      <option value="CANCELED">キャンセル</option>
    </select>
  </div>
</td>

                          <td className="px-2 py-1 border border-slate-200">
                            {b.note || ''}
                          </td>
                          <td className="px-2 py-1 border border-slate-200 whitespace-nowrap">
                            {b.source === 'LINE_PUBLIC_FORM'
                              ? 'LINE予約フォーム'
                              : b.source || ''}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {!selectedDateKey && (
            <p className="text-xs text-slate-500">
              上のカレンダーから日付をクリックすると、その日の予約一覧と重複状況が確認できます。
            </p>
          )}
        </section>
      </div>
    </TenantLayout>
  );
}
