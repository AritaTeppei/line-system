// frontend/app/bookings/BookingsPageClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import TenantLayout from '../components/TenantLayout';
import { useSearchParams } from 'next/navigation';

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

export default function BookingsPageClient() {
  const [editingBooking, setEditingBooking] = useState<Booking | null>(
    null,
  );
  const [editDate, setEditDate] = useState('');
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

  const searchParams = useSearchParams();

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

  // ダッシュボードから /bookings?date=YYYY-MM-DD で来たときの初期選択
  useEffect(() => {
    const dateParam = searchParams?.get('date');
    if (!dateParam) return;

    const d = new Date(dateParam);
    if (Number.isNaN(d.getTime())) return;

    const key = toDateKey(d);

    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
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
    }[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push({
        key: `empty-${i}`,
        dayNumber: null,
        dateKey: null,
        totalCount: 0,
        pendingCount: 0,
      });
    }

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
        <div className="text-sm text-gray-800">読み込み中...</div>
      {/* ここから下は今の page.tsx の JSX をそのまま移植でOK */}
      {/* 予約カレンダーのヘッダー〜モーダルまで全部 */}
      {/* すでに書いているので省略するけど、基本「そのままコピペ」で大丈夫 */}
    </TenantLayout>
  );
}
