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

type OnboardingStatus = {
  tenantId: number;
  tenantName: string;
  plan: string;
  hasLineSettings: boolean;
  lineSettingsActive: boolean;
  hasSubscription: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
} | null;

type MeExtended = Me & {
  tenantPlan?: string | null;
  trialEnd?: string | null;
};

type Customer = {
  id: number;
  lastName: string;
  firstName: string;
};

type Announcement = {
  id: number;
  title: string;
  body: string;
  publishAt: string;
};

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // 認証トークン取得（今後 sessionStorage に移行しやすいように共通化）
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  // ① まず sessionStorage を優先（あとでここに保存するように変える前提）
  const fromSession = window.sessionStorage.getItem('auth_token');
  if (fromSession) return fromSession;

  // ② まだ localStorage を使っているページもあるので一応見る
  return window.localStorage.getItem('auth_token');
}

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
  const [me, setMe] = useState<MeExtended | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ★ 追加：オンボーディング状態
  const [onboardingStatus, setOnboardingStatus] =
    useState<OnboardingStatus>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // お知らせモーダル
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const [announcementOpen, setAnnouncementOpen] = useState(false);

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
      .then((data: MeExtended) => setMe(data));

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

  // ★ 追加：オンボーディング状態の取得
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    if (!me?.tenantId) return;

    const fetchOnboarding = async () => {
      try {
        setOnboardingLoading(true);

        const res = await fetch(`${apiBase}/onboarding/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tenantId: me.tenantId }),
        });

        if (!res.ok) {
          console.error('onboarding/status error', await res.text());
          setOnboardingStatus(null);
          setOnboardingLoading(false);
          return;
        }

        const data = (await res.json()) as {
          status: OnboardingStatus;
        };

        setOnboardingStatus(data.status);
        setOnboardingLoading(false);
      } catch (e) {
        console.error(e);
        setOnboardingStatus(null);
        setOnboardingLoading(false);
      }
    };

    fetchOnboarding();
  }, [me]);

  // お知らせ取得（ログイン後に未読があればモーダル表示）
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    fetch(`${apiBase}/announcements/active`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.ok ? res.json() : [])
      .then((data: Announcement[]) => {
        if (!data.length) return;
        const seen: number[] = JSON.parse(
          localStorage.getItem('seenAnnouncementIds') ?? '[]'
        );
        const unseen = data.filter((a) => !seen.includes(a.id));
        if (unseen.length > 0) {
          setAnnouncements(unseen);
          setAnnouncementIdx(0);
          setAnnouncementOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleCloseAnnouncement = () => {
    // 表示済みIDを保存
    const seen: number[] = JSON.parse(
      localStorage.getItem('seenAnnouncementIds') ?? '[]'
    );
    const newSeen = Array.from(new Set([...seen, ...announcements.map((a) => a.id)]));
    localStorage.setItem('seenAnnouncementIds', JSON.stringify(newSeen));
    setAnnouncementOpen(false);
  };

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

  // トライアル残り日数（ダッシュボード用）
  const isTrial = (me as MeExtended | null)?.tenantPlan?.toUpperCase() === 'TRIAL';
  let trialRemainingDays: number | null = null;
  const trialEndStr = (me as MeExtended | null)?.trialEnd;
  if (isTrial && trialEndStr) {
    const end = new Date(trialEndStr);
    const now = new Date();
    trialRemainingDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return (
    <TenantLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <header>
          <h1 className="text-2xl font-extrabold text-green-700 flex items-center gap-2">
            📊 ダッシュボード
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            本日の予約状況や今月の動きをひと目で確認できます。
          </p>
        </header>

        {/* ★ トライアル中アップグレードバナー */}
        {isTrial && me?.role === 'MANAGER' && (
          <div className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 p-px shadow-lg">
            <div className="rounded-2xl bg-white/95 px-5 py-4 flex flex-col sm:flex-row items-center gap-3">
              <div className="text-3xl flex-shrink-0">⏳</div>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-black text-gray-900 text-base">
                  トライアル中
                  {trialRemainingDays !== null && (
                    <span className="text-orange-500 ml-2">
                      — あと <span className="text-2xl font-black">{Math.max(0, trialRemainingDays)}</span> 日
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  プランに登録すると顧客・車両・予約の件数制限が外れ、フル機能が使えます！
                </p>
              </div>
              <a
                href="/billing"
                className="flex-shrink-0 inline-flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow hover:shadow-md hover:from-green-600 hover:to-emerald-700 transition-all"
              >
                ✨ プランを登録する
              </a>
            </div>
          </div>
        )}

        {/* サマリカード */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 本日の予約 */}
          <div className="rounded-2xl border-l-4 border-l-blue-400 border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col gap-2">
            <div className="text-xs font-bold text-blue-500 flex items-center gap-1">
              📆 本日の予約
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-gray-900">
                {todayBookings.length}
              </span>
              <span className="text-sm text-gray-400">件</span>
            </div>
            <div className="text-sm text-gray-500">
              {todayKey}
            </div>
            <div className="mt-1 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">未確認</span>
                <span className="font-bold text-amber-600">{todayPendingCount}件</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">確定</span>
                <span className="font-bold text-emerald-600">{todayConfirmedCount}件</span>
              </div>
            </div>
          </div>

          {/* 今月の予約 */}
          <div className="rounded-2xl border-l-4 border-l-green-400 border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col gap-2">
            <div className="text-xs font-bold text-green-600 flex items-center gap-1">
              📈 今月の予約
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-gray-900">
                {monthTotal}
              </span>
              <span className="text-sm text-gray-400">件</span>
            </div>
            <div className="text-sm text-gray-500">
              {monthLabel}
            </div>
            <div className="mt-1 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">未確認</span>
                <span className="font-bold text-amber-600">{monthPending}件</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">確定</span>
                <span className="font-bold text-emerald-600">{monthConfirmed}件</span>
              </div>
            </div>
          </div>

          {/* 全体状況 */}
          <div className="rounded-2xl border-l-4 border-l-purple-400 border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col gap-2">
            <div className="text-xs font-bold text-purple-500 flex items-center gap-1">
              👥 全体状況
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-gray-900">
                {customers.length}
              </span>
              <span className="text-sm text-gray-400">名の顧客</span>
            </div>
            <div className="text-sm text-gray-500">
              登録済み顧客数
            </div>
            <div className="mt-1 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">未確認予約</span>
                <span className="font-bold text-amber-600">{totalPending}件</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">全予約数</span>
                <span className="font-bold text-gray-700">{bookings.length}件</span>
              </div>
            </div>
          </div>
        </section>

        {/* 簡易グラフ：直近7日間の予約件数 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
              📉 直近7日間の予約件数
            </h2>
            <p className="text-xs text-gray-400 hidden sm:block">
              今日を含めた7日間
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
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-base font-black text-gray-900 mb-4 flex items-center gap-2">
            📋 直近の予約（最新5件）
          </h2>

          {recentBookings.length === 0 ? (
            <p className="text-xs text-gray-600">
              まだ予約が登録されていません。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <th className="px-3 py-2 border border-gray-200 text-left font-bold text-xs">
                      予約日
                    </th>
                    <th className="px-3 py-2 border border-gray-200 text-left font-bold text-xs">
                      時間帯
                    </th>
                    <th className="px-3 py-2 border border-gray-200 text-left font-bold text-xs">
                      顧客
                    </th>
                    <th className="px-3 py-2 border border-gray-200 text-left font-bold text-xs">
                      車両
                    </th>
                    <th className="px-3 py-2 border border-gray-200 text-left font-bold text-xs">
                      ステータス
                    </th>
                    <th className="px-3 py-2 border border-gray-200 text-left font-bold text-xs">
                      内容
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
                        className="text-gray-800 align-middle cursor-pointer hover:bg-green-50 transition-colors"
                      >
                        <td className="px-3 py-2 border border-gray-200 whitespace-nowrap text-sm font-medium">
                          {dateLabel}
                        </td>
                        <td className="px-3 py-2 border border-gray-200 whitespace-nowrap text-sm">
                          {timeSlotLabel(b.timeSlot)}
                        </td>
                        <td className="px-3 py-2 border border-gray-200 whitespace-nowrap text-sm">
                          {customerName || '-'}
                        </td>
                        <td className="px-3 py-2 border border-gray-200 whitespace-nowrap text-sm">
                          {carLabel || '-'}
                        </td>
                        <td className="px-3 py-2 border border-gray-200 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                              b.status,
                            )}`}
                          >
                            {statusLabel(b.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 border border-gray-200 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-700">
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

          <p className="mt-4 text-sm text-gray-400">
            予約の詳細確認・日付別管理は左メニューの「📅 予約一覧」から確認できます。
          </p>
        </section>
      </div>

      {/* お知らせモーダル */}
      {announcementOpen && announcements.length > 0 && (() => {
        const a = announcements[announcementIdx];
        const isMultiple = announcements.length > 1;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              {/* ヘッダー */}
              <div className="bg-gradient-to-r from-green-600 to-green-500 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📢</span>
                  <div>
                    <p className="text-xs font-bold text-green-100">PitLink からのお知らせ</p>
                    {isMultiple && (
                      <p className="text-[10px] text-green-200">{announcementIdx + 1} / {announcements.length}</p>
                    )}
                  </div>
                </div>
                <button type="button" onClick={handleCloseAnnouncement} className="text-white/70 hover:text-white text-lg font-bold transition-colors">✕</button>
              </div>

              {/* コンテンツ */}
              <div className="px-5 py-5 flex-1 space-y-3">
                <h2 className="text-base font-black text-gray-900">{a.title}</h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{a.body}</p>
                <p className="text-[10px] text-gray-400">
                  {new Date(a.publishAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* フッター */}
              <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
                {isMultiple && announcementIdx < announcements.length - 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCloseAnnouncement}
                      className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      すべて閉じる
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnnouncementIdx((i) => i + 1)}
                      className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors"
                    >
                      次のお知らせ →
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleCloseAnnouncement}
                    className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors"
                  >
                    確認しました
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </TenantLayout>
  );
}
