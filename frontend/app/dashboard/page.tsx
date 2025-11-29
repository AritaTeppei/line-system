// frontend/app/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import TenantLayout from '../components/TenantLayout';
import { useRouter } from 'next/navigation';   // ★追加

type Role = 'DEVELOPER' | 'MANAGER' | 'CLIENT';

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
};

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELED';
type TimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING' | string;

type Booking = {
  id: number;
  bookingDate: string; // ISO
  timeSlot: TimeSlot;
  status: BookingStatus;
  note?: string | null;
  source?: string | null;
  customer?: {
    lastName: string;
    firstName: string;
    mobilePhone?: string | null;
  } | null;
  car?: {
    carName?: string | null;
    registrationNumber?: string | null;
    shakenDate?: string | null;
    inspectionDate?: string | null;
  } | null;
};

type Customer = {
  id: number;
  lastName: string;
  firstName: string;
};

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// 共通ヘルパー
function toDateKey(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function timeSlotLabel(slot: TimeSlot) {
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
}

function statusLabel(s: BookingStatus) {
  switch (s) {
    case 'PENDING':
      return '未確認';
    case 'CONFIRMED':
      return '確定';
    case 'CANCELED':
      return 'キャンセル';
  }
}

function statusBadgeClass(s: BookingStatus) {
  switch (s) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-900 border-amber-300';
    case 'CONFIRMED':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    case 'CANCELED':
      return 'bg-gray-100 text-gray-700 border-gray-300';
  }
}

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const router = useRouter();  // ★追加

  // 初期ロード：auth/me + bookings + customers
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

    const fetchCustomers = fetch(`${apiBase}/customers`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('customers api error');
        return res.json();
      })
      .then((data: Customer[]) => setCustomers(data));

    Promise.all([fetchMe, fetchBookings, fetchCustomers])
      .catch((err) => {
        console.error(err);
        setErrorMsg(
          'ダッシュボード情報の取得に失敗しました。時間をおいて再度お試しください。',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const today = new Date();
  const todayKey = toDateKey(today);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-index

  // 今日の予約
  const todayBookings = useMemo(
    () =>
      bookings.filter(
        (b) => toDateKey(b.bookingDate) === todayKey,
      ),
    [bookings, todayKey],
  );

  const todayPendingCount = todayBookings.filter(
    (b) => b.status === 'PENDING',
  ).length;
  const todayConfirmedCount = todayBookings.filter(
    (b) => b.status === 'CONFIRMED',
  ).length;

  // 今月の予約
  const monthBookings = useMemo(
    () =>
      bookings.filter((b) => {
        const d = new Date(b.bookingDate);
        return (
          d.getFullYear() === currentYear &&
          d.getMonth() === currentMonth
        );
      }),
    [bookings, currentYear, currentMonth],
  );

  const monthTotal = monthBookings.length;
  const monthPending = monthBookings.filter(
    (b) => b.status === 'PENDING',
  ).length;
  const monthConfirmed = monthBookings.filter(
    (b) => b.status === 'CONFIRMED',
  ).length;

  // 全体の未確認件数
  const totalPending = bookings.filter(
    (b) => b.status === 'PENDING',
  ).length;

  // 今日を含めた先の7日分の簡易グラフデータ
  const last7Days = useMemo(() => {
    const result: {
      key: string;
      label: string;
      weekday: string;
      count: number;
    }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + i, // 今日〜6日後
      );
      const key = toDateKey(d);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const weekday = weekdayLabels[d.getDay()];
      const count = bookings.filter(
        (b) => toDateKey(b.bookingDate) === key,
      ).length;

      result.push({ key, label, weekday, count });
    }

    return result;
  }, [bookings, today]);

  const maxCountForGraph = Math.max(
    1,
    ...last7Days.map((d) => d.count),
  );

  // 直近予約（新しい順で5件）
  const recentBookings = useMemo(
    () =>
      bookings
        .slice()
        .sort(
          (a, b) =>
            new Date(b.bookingDate).getTime() -
            new Date(a.bookingDate).getTime(),
        )
        .slice(0, 5),
    [bookings],
  );

  if (loading) {
    return (
      <TenantLayout>
        <div className="text-sm text-gray-800">読み込み中...</div>
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

  const monthLabel = `${currentYear}年 ${currentMonth + 1}月`;

  return (
    <TenantLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-green-700 tracking-wide drop-shadow-sm">
              ダッシュボード
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-600 mt-1">
              本日の予約状況や今月の予約件数、直近の動きをひと目で確認できます。
              詳細は左メニューから各画面へ移動してください。
            </p>
          </div>

          {me && (
            <div className="text-xs text-gray-600 text-right space-y-1">
              <div>
                ログイン中:{' '}
                <span className="font-medium text-gray-900">
                  {me.email}
                </span>
              </div>
              <div>
                ロール:{' '}
                <span className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-50 px-2 py-0.5 text-emerald-800 text-[11px]">
                  {me.role === 'DEVELOPER'
                    ? '開発者'
                    : me.role === 'MANAGER'
                    ? '管理者'
                    : 'スタッフ'}
                </span>
              </div>
            </div>
          )}
        </header>

        {/* サマリカード */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* 本日の予約 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-2">
            <div className="text-[11px] font-semibold text-gray-500">
              本日の予約
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {todayBookings.length}
              </span>
              <span className="text-[11px] text-gray-500">
                件（{todayKey}）
              </span>
            </div>
            <div className="mt-1 text-[11px] text-gray-600 space-y-0.5">
              <div>
                ・未確認：{' '}
                <span className="font-semibold text-amber-700">
                  {todayPendingCount}件
                </span>
              </div>
              <div>
                ・確定：{' '}
                <span className="font-semibold text-emerald-700">
                  {todayConfirmedCount}件
                </span>
              </div>
            </div>
          </div>

          {/* 今月の予約 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-2">
            <div className="text-[11px] font-semibold text-gray-500">
              今月の予約（{monthLabel}）
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {monthTotal}
              </span>
              <span className="text-[11px] text-gray-500">件</span>
            </div>
            <div className="mt-1 text-[11px] text-gray-600 space-y-0.5">
              <div>
                ・未確認：{' '}
                <span className="font-semibold text-amber-700">
                  {monthPending}件
                </span>
              </div>
              <div>
                ・確定：{' '}
                <span className="font-semibold text-emerald-700">
                  {monthConfirmed}件
                </span>
              </div>
            </div>
          </div>

          {/* 顧客・未確認など */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-2">
            <div className="text-[11px] font-semibold text-gray-500">
              全体状況
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {customers.length}
              </span>
              <span className="text-[11px] text-gray-500">
                件の顧客
              </span>
            </div>
            <div className="mt-1 text-[11px] text-gray-600 space-y-0.5">
              <div>
                ・未確認予約：{' '}
                <span className="font-semibold text-amber-700">
                  {totalPending}件
                </span>
              </div>
              <div>
                ・全予約件数：{' '}
                <span className="font-semibold text-gray-900">
                  {bookings.length}件
                </span>
              </div>
            </div>
          </div>
        </section>

                        {/* 簡易グラフ：直近7日間の予約件数 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">
              直近7日間の予約件数
            </h2>
            <p className="text-[11px] text-gray-500">
              今日を含めた7日間の予約件数を、棒グラフで表示します。
            </p>
          </div>

          <div className="mt-2">
            {/* ★ h-48 に対して、子要素も h-full を渡すのがポイント */}
            <div className="h-48 flex items-end gap-2 sm:gap-3 border-b border-gray-200 pb-3">
              {last7Days.map((d) => {
                // 件数から高さを決める（分かりやすさ優先）
                // 0件 → 5%
                // 1件 → 40%
                // 2件以上 → 70%
                let heightPercent: number;
                if (d.count === 0) {
                  heightPercent = 5;
                } else if (d.count === 1) {
                  heightPercent = 40;
                } else {
                  heightPercent = 70;
                }

                const isToday = d.key === todayKey;

                const barBaseClass =
                  'w-full rounded-t-md transition-all duration-300 border';
                const barColorClass = isToday
                  ? 'bg-emerald-600 border-emerald-700'
                  : d.count > 0
                  ? 'bg-emerald-300 border-emerald-400'
                  : 'bg-gray-100 border-gray-200';

                return (
                  <div
                    key={d.key}
                    className="flex-1 h-full flex flex-col items-center justify-end gap-1"
                  >
                    {/* ★ ここも h-full を付ける */}
                    <div className="w-full h-full flex items-end">
                      <div
                        className={`${barBaseClass} ${barColorClass}`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-gray-600 text-center">
                      {d.label}
                    </div>
                    <div className="text-[10px] text-gray-400 text-center">
                      {d.weekday}
                    </div>
                    <div className="text-[10px] text-gray-700 text-center">
                      {d.count}件
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 text-[10px] text-gray-500">
              
            </div>
          </div>
        </section>

        {/* 直近の予約一覧 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">
            直近の予約（最新5件）
          </h2>

          {recentBookings.length === 0 ? (
            <p className="text-xs text-gray-600">
              まだ予約が登録されていません。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[11px] sm:text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-900">
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      予約日
                    </th>
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      時間帯
                    </th>
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      顧客
                    </th>
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      車両
                    </th>
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      ステータス
                    </th>
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      何の予約か
                    </th>
                  </tr>
                </thead>
                                <tbody>
                  {recentBookings.map((b) => {
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

                    const rawNote = (b.note ?? '').trim();
                    const purpose =
                      rawNote === ''
                        ? '未入力'
                        : rawNote.length > 20
                        ? rawNote.slice(0, 20) + '…'
                        : rawNote;

                    const dateLabel = formatDateLabel(
                      b.bookingDate,
                    );

                    // ★ クリック時に /bookings?date=YYYY-MM-DD へ遷移
                    const handleRowClick = () => {
                      const dateKey = toDateKey(b.bookingDate);
                      router.push(
                        `/bookings?date=${encodeURIComponent(dateKey)}`,
                      );
                    };

                    return (
                      <tr
                        key={b.id}
                        onClick={handleRowClick}
                        className="text-gray-900 align-top cursor-pointer hover:bg-emerald-50"
                      >
                        <td className="px-2 py-1 border border-gray-300 whitespace-nowrap">
                          {dateLabel}
                        </td>
                        <td className="px-2 py-1 border border-gray-300 whitespace-nowrap">
                          {timeSlotLabel(b.timeSlot)}
                        </td>
                        <td className="px-2 py-1 border border-gray-300 whitespace-nowrap">
                          {customerName || '-'}
                        </td>
                        <td className="px-2 py-1 border border-gray-300 whitespace-nowrap">
                          {carLabel || '-'}
                        </td>
                        <td className="px-2 py-1 border border-gray-300 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${statusBadgeClass(
                              b.status,
                            )}`}
                          >
                            {statusLabel(b.status)}
                          </span>
                        </td>
                        <td className="px-2 py-1 border border-gray-300 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full border border-gray-500 bg-white px-2 py-0.5 text-[10px] sm:text-[11px] text-gray-900">
                            {purpose}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          )}

          <p className="mt-3 text-[11px] text-gray-500">
            予約の詳細な確認や日付別の重複状況は、
            左メニュー「予約一覧」からカレンダー画面で確認できます。
          </p>
        </section>
      </div>
    </TenantLayout>
  );
}
