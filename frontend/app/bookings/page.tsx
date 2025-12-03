// frontend/app/bookings/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import TenantLayout from '../components/TenantLayout';
import { useSearchParams } from 'next/navigation';  // ★追加

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
  bookingDate: string; // ISO文字列
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
  confirmationLineSentAt?: string | null;
  confirmationLineMessage?: string | null;
};

type Customer = {
  id: number;
  lastName: string;
  firstName: string;
};

type Car = {
  id: number;
  carName?: string | null;
  registrationNumber?: string | null;
  customerId: number;
};

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ---- API ヘルパー ----
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

async function sendConfirmationLine(
  id: number,
  token: string,
  message?: string,
) {
  const res = await fetch(
    `${apiBase}/bookings/${id}/send-confirmation-line`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    },
  );

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg =
      (data && (data.message as string)) ||
      'ご予約確定メッセージの送信に失敗しました。';
    throw new Error(msg);
  }

  return (await res.json().catch(() => null)) as Booking | null;
}

async function createBooking(
  payload: {
    bookingDate: string;
    timeSlot: TimeSlot;
    customerId: number;
    carId: number;
    note?: string;
    source?: string;
  },
  token: string,
) {
  const res = await fetch(`${apiBase}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg =
      (data && (data.message as string)) ||
      '予約の作成に失敗しました。';
    throw new Error(msg);
  }

  return (await res.json().catch(() => null)) as Booking | null;
}

// ★ 予約削除
async function deleteBooking(id: number, token: string) {
  const res = await fetch(`${apiBase}/bookings/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg =
      (data && (data.message as string)) ||
      '予約の削除に失敗しました。';
    throw new Error(msg);
  }

  return;
}

// 日付キーを "YYYY-MM-DD" にそろえる
function toDateKey(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 車検日などの表示用（YYYY/MM/DD）
function formatDateLabel(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

function BookingsPageInner() {
  const [editingBooking, setEditingBooking] = useState<Booking | null>(
    null,
  );
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');  // ★追加
  const [editTimeSlot, setEditTimeSlot] =
    useState<TimeSlot>('MORNING');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [me, setMe] = useState<Me | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [confirmModalBooking, setConfirmModalBooking] =
    useState<Booking | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmSending, setConfirmSending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cars, setCars] = useState<Car[]>([]);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(
    null,
  );

  const searchParams = useSearchParams();   // ★ここで取得

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalDateKey, setModalDateKey] =
    useState<string | null>(null);
  const [modalTimeSlot, setModalTimeSlot] =
    useState<TimeSlot>('MORNING');
  const [modalCustomerId, setModalCustomerId] =
    useState<number | null>(null);
  const [modalCarId, setModalCarId] = useState<number | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  // --- 初期ロード ---
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

    const fetchCars = fetch(`${apiBase}/cars`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('cars api error');
        return res.json();
      })
      .then((data: Car[]) => setCars(data));

    Promise.all([fetchMe, fetchBookings, fetchCustomers, fetchCars])
      .catch((err) => {
        console.error(err);
        setErrorMsg(
          '予約情報の取得に失敗しました。時間をおいて再度お試しください。',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  // ★ ダッシュボードなどから `/bookings?date=YYYY-MM-DD` で来たとき、
  //   該当日の月を開いて、その日を選択状態にする
  useEffect(() => {
    const dateParam = searchParams?.get('date');
    if (!dateParam) return;

    const d = new Date(dateParam);
    if (Number.isNaN(d.getTime())) return;

    const key = toDateKey(d);

    // カレンダーの表示月をその月に
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    // その日付を選択
    setSelectedDateKey(key);
  }, [searchParams]);


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

  const selectedBookings: Booking[] = useMemo(() => {
    if (!selectedDateKey) return [];
    return bookingsByDate.get(selectedDateKey) ?? [];
  }, [selectedDateKey, bookingsByDate]);

  const monthInfo = useMemo(() => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = firstDay.getDay();

  const cells: {
    key: string;
    dayNumber: number | null;
    dateKey: string | null;
    totalCount: number;
    pendingCount: number;
    morningCount: number;
    afternoonCount: number;
    eveningCount: number;
  }[] = [];

  // ★ 月初前の空きマス
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({
      key: `empty-${i}`,
      dayNumber: null,
      dateKey: null,
      totalCount: 0,
      pendingCount: 0,
      morningCount: 0,
      afternoonCount: 0,
      eveningCount: 0,
    });
  }

  // ★ 実データの日
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = toDateKey(d);
    const list = bookingsByDate.get(key) ?? [];

    const totalCount = list.length;
    const pendingCount = list.filter(
      (b) => b.status === 'PENDING',
    ).length;

    const morningCount = list.filter(
      (b) => b.timeSlot === 'MORNING',
    ).length;
    const afternoonCount = list.filter(
      (b) => b.timeSlot === 'AFTERNOON',
    ).length;
    const eveningCount = list.filter(
      (b) => b.timeSlot === 'EVENING',
    ).length;

    cells.push({
      key,
      dayNumber: day,
      dateKey: key,
      totalCount,
      pendingCount,
      morningCount,
      afternoonCount,
      eveningCount,
    });
  }

  return {
    year,
    month,
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

  const monthLabel = `${monthInfo.year}年 ${monthInfo.month + 1}月`;

  const createButtonLabel = selectedDateKey
    ? `${selectedDateKey} の新規予約登録`
    : `${todayKey} の新規予約登録`;

  const openCreateModalForDate = (dateKey: string | null) => {
    if (!dateKey) return;
    setModalDateKey(dateKey);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setModalError(null);
    setModalNote('');
  };

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

  const timeSlotBadgeClass = (slot: TimeSlot) => {
  switch (slot) {
    case 'MORNING':
      return 'bg-sky-50 text-sky-800 border-sky-300';
    case 'AFTERNOON':
      return 'bg-orange-50 text-orange-800 border-orange-300';
    case 'EVENING':
      return 'bg-purple-50 text-purple-800 border-purple-300';
    default:
      return 'bg-gray-50 text-gray-800 border-gray-300';
  }
};

  const openConfirmModal = (booking: Booking) => {
    const dateKey = toDateKey(booking.bookingDate).replace(/-/g, '/');
    const customerName = booking.customer
      ? `${booking.customer.lastName ?? ''} ${
          booking.customer.firstName ?? ''
        }`.trim()
      : '';
    const carLabel = booking.car
      ? `${booking.car.carName ?? ''}${
          booking.car.registrationNumber
            ? `（${booking.car.registrationNumber}）`
            : ''
        }`
      : '';

    const defaultMsgLines = [
      customerName ? `${customerName} 様` : '',
      '',
      'このたびはご予約ありがとうございます。',
      '以下の内容でご予約を承りました。',
      '',
      dateKey ? `ご予約日：${dateKey}` : '',
      booking.timeSlot
        ? `ご希望時間帯：${timeSlotLabel(booking.timeSlot)}`
        : '',
      carLabel ? `対象のお車：${carLabel}` : '',
      '',
      '内容に変更がある場合は、お手数ですが店舗までご連絡ください。',
    ].filter(Boolean);

    setConfirmModalBooking(booking);
    setConfirmMessage(
      booking.confirmationLineMessage || defaultMsgLines.join('\n'),
    );
    setConfirmError(null);
  };

  const handleSendConfirmLine = async () => {
    if (!confirmModalBooking) return;

    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;

    if (!token) {
      alert('ログイン情報が見つかりません。再ログインしてください。');
      return;
    }

    setConfirmSending(true);
    setConfirmError(null);

    try {
      const updated = await sendConfirmationLine(
        confirmModalBooking.id,
        token,
        confirmMessage,
      );

      if (updated) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === updated.id
              ? {
                  ...b,
                  confirmationLineSentAt:
                    updated.confirmationLineSentAt,
                  confirmationLineMessage:
                    updated.confirmationLineMessage,
                }
              : b,
          ),
        );
      }

      alert('ご予約確定メッセージを送信しました。');
      setConfirmModalBooking(null);
    } catch (e: any) {
      console.error(e);
      setConfirmError(
        e?.message ??
          'ご予約確定メッセージの送信に失敗しました。時間をおいて再度お試しください。',
      );
    } finally {
      setConfirmSending(false);
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
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'CONFIRMED':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'CANCELED':
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const openEditModal = (booking: Booking) => {
    setEditingBooking(booking);
    setEditDate(toDateKey(booking.bookingDate));
    setEditTimeSlot(booking.timeSlot as TimeSlot);
    setEditError(null);
    setEditNote(booking.note ?? '');  
  };

  const closeEditModal = () => {
    setEditingBooking(null);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingBooking) return;

    if (!editDate) {
      setEditError('日付を入力してください。');
      return;
    }

    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;

    if (!token) {
      alert('ログイン情報が見つかりません。再ログインしてください。');
      return;
    }

    setEditSaving(true);
    setEditError(null);

    try {
      const res = await fetch(
        `${apiBase}/bookings/${editingBooking.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            bookingDate: editDate,
            timeSlot: editTimeSlot,
            note: editNote,   
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          (data && data.message) ||
          '予約の更新に失敗しました。時間をおいて再度お試しください。';
        setEditError(msg);
        return;
      }

      const updated = (await res.json()) as Booking;

      setBookings((prev) =>
        prev.map((b) => (b.id === updated.id ? updated : b)),
      );

      closeEditModal();
      alert('予約日程を更新しました。');
    } catch (e: any) {
      console.error(e);
      setEditError(
        e?.message ??
          '予約の更新に失敗しました。時間をおいて再度お試しください。',
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleChangeStatus = async (
    bookingId: number,
    nextStatus: BookingStatus,
  ) => {
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

      await updateBookingStatus(bookingId, nextStatus, token);

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: nextStatus } : b,
        ),
      );

      if (nextStatus === 'CONFIRMED') {
        alert('予約を「確定」に更新しました。');
      } else {
        alert('予約ステータスを更新しました。');
      }
    } catch (e: any) {
      console.error(e);
      alert(
        e?.message ??
          '予約ステータスの更新に失敗しました。時間をおいて再度お試しください。',
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteBooking = async (bookingId: number) => {
    const ok = window.confirm(
      'この予約を完全に削除します。\nよろしいですか？',
    );
    if (!ok) return;

    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;

    if (!token) {
      alert('ログイン情報が見つかりません。再ログインしてください。');
      return;
    }

    try {
      setDeletingId(bookingId);
      await deleteBooking(bookingId, token);

      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      alert('予約を削除しました。');
    } catch (e: any) {
      console.error(e);
      alert(
        e?.message ??
          '予約の削除に失敗しました。時間をおいて再度お試しください。',
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateBooking = async () => {
    if (!modalDateKey) {
      setModalError(
        '日付が取得できませんでした。もう一度日付を選択してください。',
      );
      return;
    }
    if (!modalCustomerId) {
      setModalError('顧客を選択してください。');
      return;
    }
    if (!modalCarId) {
      setModalError('車両を選択してください。');
      return;
    }

    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;

    if (!token) {
      alert('ログイン情報が見つかりません。再ログインしてください。');
      return;
    }

    setModalSaving(true);
    setModalError(null);

    try {
      const created = await createBooking(
        {
          bookingDate: modalDateKey,
          timeSlot: modalTimeSlot,
          customerId: modalCustomerId,
          carId: modalCarId,
          note: modalNote,
          source: 'TENANT_MANUAL',
        },
        token,
      );

      if (created) {
        setBookings((prev) => [...prev, created]);
      }

      alert('予約を登録しました。');
      setShowCreateModal(false);
    } catch (e: any) {
      console.error(e);
      setModalError(
        e?.message ??
          '予約の登録に失敗しました。時間をおいて再度お試しください。',
      );
    } finally {
      setModalSaving(false);
    }
  };

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

  return (
    <TenantLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1
              className="text-3xl font-extrabold text-green-700 tracking-wide drop-shadow-sm"
              style={{
                fontFamily: "'M PLUS Rounded 1c', system-ui, sans-serif",
              }}
            >
              予約カレンダー
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-600 mt-1">
              カレンダー上で予約件数と重複状況を確認できます。日付をクリックすると、その日の予約一覧が下に表示されます。
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {me && (
              <div className="text-xs text-gray-600 text-right">
                ログイン中:{' '}
                <span className="font-medium text-gray-900">
                  {me.email}
                </span>
                <span className="ml-2 inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-50 px-2 py-0.5 text-emerald-800 text-[11px]">
                  {me.role === 'DEVELOPER'
                    ? '開発者'
                    : me.role === 'MANAGER'
                    ? '管理者'
                    : 'スタッフ'}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* カレンダー */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="px-2 py-1 text-xs rounded-md border border-gray-500 text-gray-900 hover:bg-gray-100"
              >
                ＜ 前の月
              </button>
              <div className="text-sm sm:text-base font-semibold text-gray-900">
                {monthLabel}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="px-2 py-1 text-xs rounded-md border border-gray-500 text-gray-900 hover:bg-gray-100"
              >
                次の月 ＞
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-[11px] text-gray-600">
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full border border-emerald-500 bg-emerald-50" />
                <span>本日</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center rounded-full bg-emerald-600 text-white text-[9px] px-1">
                  予約
                </span>
                <span>予約あり</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] w-4 h-4">
                  !
                </span>
                <span>未確認予約あり</span>
              </div>
            </div>
          </div>

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 text-center text-[11px] sm:text-xs mb-1 gap-1 sm:gap-1.5">
  {weekdayLabels.map((w, idx) => (
    <div
      key={w}
      className={
        'py-1 rounded-md font-medium ' +
        (idx === 0
          ? 'bg-red-50 text-red-600'   // 日
          : idx === 6
          ? 'bg-sky-50 text-sky-600'   // 土
          : 'bg-gray-50 text-gray-700') // 月〜金
      }
    >
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
        className="min-h-[3.5rem] sm:min-h-[4rem] rounded-lg bg-transparent"
      />
    );
  }

  const isToday = cell.dateKey === todayKey;
const isSelected = cell.dateKey === selectedDateKey;
const hasBooking = cell.totalCount > 0;
const hasPending = cell.pendingCount > 0;
const hasMorning = cell.morningCount > 0;
const hasAfternoon = cell.afternoonCount > 0;
const hasEvening = cell.eveningCount > 0;

let baseClass =
  'min-h-[3.5rem] sm:min-h-[4.25rem] rounded-lg border flex flex-col items-stretch justify-between px-1.5 py-1 cursor-pointer text-left transition-colors';

// ① デフォルト（日付だけのマス）
if (!hasBooking) {
  baseClass += ' border-gray-200 bg-slate-50 hover:bg-slate-100';
}
// ② 予約あり（確定だけ or 全部）
if (hasBooking && !hasPending) {
  baseClass += ' border-emerald-500 bg-emerald-50 hover:bg-emerald-100';
}
// ③ 未確認あり（優先表示）
if (hasPending) {
  baseClass += ' border-amber-500 bg-amber-50 hover:bg-amber-100';
}

// ④ 選択／今日の枠線
if (isSelected) {
  baseClass += ' ring-2 ring-emerald-600';
} else if (isToday) {
  baseClass += ' ring-2 ring-sky-400';
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
      <div className="flex items-center justify-between text-[11px] text-gray-900">
        <span className="font-semibold text-[11px]">
          {cell.dayNumber}
        </span>
        {isToday && (
          <span className="text-[10px] text-emerald-700">
            今日
          </span>
        )}
      </div>

      <div className="mt-0.5 flex-1 flex flex-col items-start justify-end gap-0.5">
        {hasBooking && (
          <span className="inline-flex items-center rounded-full bg-emerald-600 text-white text-[10px] px-1.5 shadow-sm">
            予約 {cell.totalCount}件
          </span>
        )}
        {hasPending && (
          <span className="inline-flex items-center rounded-full bg-amber-500 text-white text-[10px] px-1.5">
            未確認 {cell.pendingCount}
          </span>
        )}

        {/* 時間帯ごとの件数ラベル（小さめ＆折り返し） */}
        <div className="flex flex-wrap gap-[2px] mt-0.5">
          {hasMorning && (
            <span className="inline-flex items-center rounded-full border border-sky-300 bg-sky-50 text-sky-800 text-[9px] px-1">
              午前 {cell.morningCount}
            </span>
          )}
          {hasAfternoon && (
            <span className="inline-flex items-center rounded-full border border-orange-300 bg-orange-50 text-orange-800 text-[9px] px-1">
              午後 {cell.afternoonCount}
            </span>
          )}
          {hasEvening && (
            <span className="inline-flex items-center rounded-full border border-purple-300 bg-purple-50 text-purple-800 text-[9px] px-1">
              夕方 {cell.eveningCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
})}

          </div>

          <div className="mt-3 sm:mt-4 text-[11px] text-gray-600 sm:hidden">
            日付をタップすると、その日の予約一覧が画面下部に表示されます。
          </div>
        </section>

        {/* カレンダーの下の新規予約ボタン */}
        <div className="flex justify-end mt-3 sm:mt-4">
          <button
            type="button"
            onClick={() => {
              const baseKey = selectedDateKey ?? todayKey;
              openCreateModalForDate(baseKey);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-3 py-1.5 shadow-sm"
          >
            <span className="text-[14px]">＋</span>
            <span>{createButtonLabel}</span>
          </button>
        </div>

        {/* 選択した日の予約一覧 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">
            {selectedDateKey
              ? `${selectedDateKey} の予約一覧`
              : '日付を選択すると、その日の予約が表示されます'}
          </h2>

          {selectedDateKey && selectedBookings.length === 0 && (
            <p className="text-xs text-gray-600">
              この日には予約が登録されていません。
            </p>
          )}

          {selectedDateKey && selectedBookings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[11px] sm:text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-900">
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      時間帯
                    </th>
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      顧客
                    </th>
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      連絡先
                    </th>
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      車両 / 車検・点検
                    </th>
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      ステータス
                    </th>
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      何の予約か
                    </th>
                    <th className="px-2 py-1 border border-gray-300 text-left">
                      受付経路 / 操作
                    </th>
                  </tr>
                </thead>
                <tbody>
  {selectedBookings
    .slice()
    .sort((a, b) =>
      (a.timeSlot || '').localeCompare(b.timeSlot || ''),
    )
    .map((b) => {
      const customerName = b.customer
        ? `${b.customer.lastName ?? ''} ${
            b.customer.firstName ?? ''
          }`.trim()
        : '-';

      const tel =
        (b.customer?.mobilePhone ?? '').trim() || '—';

      const carLabel = b.car
        ? `${b.car.carName ?? ''}${
            b.car.registrationNumber
              ? `（${b.car.registrationNumber}）`
              : ''
          }`
        : '-';

      const shakenLabel = formatDateLabel(b.car?.shakenDate);
      const inspectionLabel = formatDateLabel(
        b.car?.inspectionDate,
      );

      const rawNote = (b.note ?? '').trim();
      const purpose =
        rawNote === ''
          ? '未入力'
          : rawNote.length > 20
          ? rawNote.slice(0, 20) + '…'
          : rawNote;

      const sourceLabel =
        b.source === 'LINE_PUBLIC_FORM'
          ? 'LINE予約フォーム'
          : b.source === 'ADMIN'
          ? '管理画面（ADMIN）'
          : b.source === 'TENANT_MANUAL'
          ? '店舗入力（手動）'
          : b.source || '不明';

      return (
        <tr key={b.id} className="text-gray-900 align-top">
          {/* 時間帯 */}
          <td className="px-2 py-1 border border-gray-300 whitespace-nowrap">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] ${timeSlotBadgeClass(
                b.timeSlot,
              )}`}
            >
              {timeSlotLabel(b.timeSlot)}
            </span>
          </td>

          {/* 顧客 */}
          <td className="px-2 py-1 border border-gray-300 whitespace-nowrap">
            <div className="flex flex-col text-[10px] sm:text-[11px]">
              <span className="font-semibold">
                {customerName || '-'}
              </span>
            </div>
          </td>

          {/* 連絡先 */}
          <td className="px-2 py-1 border border-gray-300 whitespace-nowrap">
            <div className="text-[10px] sm:text-[11px]">
              {tel === '—' ? (
                '—'
              ) : (
                <a
                  href={`tel:${tel}`}
                  className="text-emerald-700 hover:underline"
                >
                  {tel}
                </a>
              )}
            </div>
          </td>

          {/* 車両 / 車検・点検 */}
          <td className="px-2 py-1 border border-gray-300 align-top">
            <div className="flex flex-col gap-0.5 text-[10px] sm:text-[11px] text-gray-900">
              <span className="font-semibold">
                {carLabel || '-'}
              </span>

              {shakenLabel && (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-flex items-center rounded-full bg-white border border-gray-400 px-1.5 py-[1px] text-[9px] font-semibold text-gray-900">
                    車検
                  </span>
                  <span>{shakenLabel}</span>
                </span>
              )}

              {inspectionLabel && (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-flex items-center rounded-full bg-white border border-gray-400 px-1.5 py-[1px] text-[9px] font-semibold text-gray-900">
                    点検
                  </span>
                  <span>{inspectionLabel}</span>
                </span>
              )}
            </div>
          </td>

          {/* ステータス / LINE送信 / 削除 */}
          <td className="px-2 py-1 border border-gray-300 whitespace-nowrap">
            <div className="flex flex-col items-start gap-1">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${statusBadgeClass(
                  b.status,
                )}`}
              >
                {statusLabel(b.status)}
              </span>

              <select
                value={b.status}
                onChange={(e) =>
                  handleChangeStatus(
                    b.id,
                    e.target.value as BookingStatus,
                  )
                }
                disabled={updatingId === b.id}
                className="mt-0.5 rounded-md border border-gray-500 bg-white px-1.5 py-0.5 text-[10px] sm:text-[11px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="PENDING">未確認</option>
                <option value="CONFIRMED">確定</option>
              </select>

              {b.status === 'CONFIRMED' && (
                <button
                  type="button"
                  onClick={() => openConfirmModal(b)}
                  className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold shadow-sm hover:bg-emerald-700"
                >
                  <span>📲</span>
                  <span>
                    {b.confirmationLineSentAt
                      ? 'LINE確定メッセージ再送'
                      : 'LINE確定メッセージ送信'}
                  </span>
                </button>
              )}

              {b.confirmationLineSentAt && (
                <span className="mt-0.5 text-[10px] text-gray-600">
                  確定LINE送信済み
                </span>
              )}

              <button
                type="button"
                onClick={() => handleDeleteBooking(b.id)}
                disabled={deletingId === b.id}
                className="mt-1 inline-flex items-center gap-1 rounded-md border border-red-500 bg-white px-2.5 py-1 text-[10px] sm:text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                <span>🗑</span>
                <span>
                  {deletingId === b.id ? '削除中...' : '予約を削除'}
                </span>
              </button>
            </div>
          </td>

          {/* 何の予約か */}
          <td className="px-2 py-1 border border-gray-300 whitespace-nowrap">
            <span className="inline-flex items-center rounded-full border border-gray-500 bg-white px-2 py-0.5 text-[10px] sm:text-[11px] text-gray-900">
              {purpose}
            </span>
          </td>

          {/* 受付経路 / 日程変更ボタン */}
          <td className="px-2 py-1 border border-gray-300 whitespace-nowrap">
            <div className="flex flex-col gap-1 text-[11px]">
              {b.source === 'ADMIN' ? (
                <span className="font-bold text-gray-900">
                  {sourceLabel}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-gray-400 bg-white px-2 py-0.5 text-[10px] text-gray-900">
                  {sourceLabel}
                </span>
              )}

              {(b.source === 'ADMIN' ||
                b.source === 'TENANT_MANUAL') && (
                <button
                  type="button"
                  onClick={() => openEditModal(b)}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold shadow-sm hover:bg-emerald-700"
                >
                  <span>🗓</span>
                  <span>予定日を変更</span>
                </button>
              )}
            </div>
          </td>
        </tr>
      );
    })}
</tbody>

              </table>
            </div>
          )}

          {!selectedDateKey && (
            <p className="text-xs text-gray-600">
              上のカレンダーから日付をクリックすると、その日の予約一覧と重複状況が確認できます。
            </p>
          )}
        </section>
      </div>

      {/* カレンダーからの手入力予約モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
              新規予約を追加
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              {modalDateKey
                ? `${modalDateKey} の予約を登録します。`
                : '日付が選択されていません。'}
            </p>

            {modalError && (
              <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-[11px] text-red-800">
                {modalError}
              </div>
            )}

            <div className="space-y-3 text-[12px] sm:text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1">
                  時間帯
                </label>
                <select
                  value={modalTimeSlot}
                  onChange={(e) =>
                    setModalTimeSlot(e.target.value as TimeSlot)
                  }
                  className="w-full rounded-md border border-gray-500 bg-white px-2 py-2 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="MORNING">午前</option>
                  <option value="AFTERNOON">午後</option>
                  <option value="EVENING">夕方</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1">
                  顧客
                </label>
                <select
                  value={modalCustomerId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setModalCustomerId(v ? Number(v) : null);
                    setModalCarId(null);
                  }}
                  className="w-full rounded-md border border-gray-500 bg-white px-2 py-2 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">選択してください</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {`${c.lastName ?? ''} ${
                        c.firstName ?? ''
                      }`.trim() || `ID: ${c.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1">
                  車両
                </label>
                <select
                  value={modalCarId ?? ''}
                  onChange={(e) =>
                    setModalCarId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  disabled={!modalCustomerId}
                  className="w-full rounded-md border border-gray-500 bg-white px-2 py-2 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100"
                >
                  <option value="">
                    {modalCustomerId
                      ? '車両を選択してください'
                      : '先に顧客を選択してください'}
                  </option>
                  {cars
                    .filter(
                      (car) =>
                        modalCustomerId != null &&
                        car.customerId === modalCustomerId,
                    )
                    .map((car) => (
                      <option key={car.id} value={car.id}>
                        {car.carName ?? '車両'}{' '}
                        {car.registrationNumber
                          ? `（${car.registrationNumber}）`
                          : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1">
                  メモ（任意）
                </label>
                <textarea
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-500 bg-white px-2 py-2 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y"
                  placeholder="例）代車希望、午後からの入庫希望 など"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={modalSaving}
                className="px-3 py-1.5 rounded-md border border-gray-500 text-xs sm:text-sm text-gray-900 bg-white hover:bg-gray-100"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={handleCreateBooking}
                disabled={modalSaving || !modalDateKey}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-xs sm:text-sm text-white font-semibold hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                {modalSaving ? '登録中…' : 'この内容で登録'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確定LINEメッセージ編集モーダル */}
      {confirmModalBooking && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
              ご予約確定メッセージを送信
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              お客様に送信するメッセージを確認・編集してから送信できます。
            </p>

            {confirmError && (
              <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-[11px] text-red-800">
                {confirmError}
              </div>
            )}

            <textarea
              value={confirmMessage}
              onChange={(e) => setConfirmMessage(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-gray-500 bg-white px-2 py-2 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModalBooking(null)}
                disabled={confirmSending}
                className="px-3 py-1.5 rounded-md border border-gray-500 text-xs sm:text-sm text-gray-900 bg-white hover:bg-gray-100"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={handleSendConfirmLine}
                disabled={confirmSending}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-xs sm:text-sm text-white font-semibold hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                {confirmSending ? '送信中…' : 'この内容で送信'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 日程編集モーダル */}
      {editingBooking && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
              予約日程の変更
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              {`予約ID: ${editingBooking.id}`}
            </p>

            {editError && (
              <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-[11px] text-red-800">
                {editError}
              </div>
            )}

            <div className="space-y-3 text-[12px] sm:text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1">
                  日付
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-md border border-gray-500 bg-white px-2 py-2 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1">
                  時間帯
                </label>
                <select
                  value={editTimeSlot}
                  onChange={(e) =>
                    setEditTimeSlot(e.target.value as TimeSlot)
                  }
                  className="w-full rounded-md border border-gray-500 bg-white px-2 py-2 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="MORNING">午前</option>
                  <option value="AFTERNOON">午後</option>
                  <option value="EVENING">夕方</option>
                </select>
              </div>

                {/* ★ 追加：何の予約か（メモ） */}
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">
                    何の予約か（メモ）
                  </label>
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-gray-500 bg-white px-2 py-2 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y"
                    placeholder="例）車検、オイル交換、鈑金見積もり など"
                  />
                </div>
              </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={editSaving}
                className="px-3 py-1.5 rounded-md border border-gray-500 text-xs sm:text-sm text-gray-900 bg-white hover:bg-gray-100"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-xs sm:text-sm text-white font-semibold hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                {editSaving ? '保存中…' : 'この内容で保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </TenantLayout>
  );
}

export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <TenantLayout>
          <div className="text-sm text-gray-800">読み込み中...</div>
        </TenantLayout>
      }
    >
      <BookingsPageInner />
    </Suspense>
  );
}
