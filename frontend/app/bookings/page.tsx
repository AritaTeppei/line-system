// frontend/app/bookings/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
    id: number;                     // ★ 追加
    lastName: string;
    firstName: string;
    mobilePhone?: string | null;
    lineUid?: string | null;
    birthday?: string | null;       // ★ 追加
    postalCode?: string | null;     // ★ 追加（住所系は実テーブル名に合わせてね）
    address1?: string | null;       // ★ 追加
    address2?: string | null;       // ★ 追加
  } | null;
  carId?: number | null;

  car?: {
    id: number;                     // ★ 追加（選び直し用）
    carName?: string | null;
    registrationNumber?: string | null;
    shakenDate?: string | null;
    inspectionDate?: string | null;
    customerId?: number | null;     // ★ あれば便利（cars の絞り込み）
  } | null;
  confirmationLineSentAt?: string | null;
  confirmationLineMessage?: string | null;

  needsLoanerCar?: boolean | null;

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

  // const [loanerChoice, setLoanerChoice] = useState<'NEED' | 'NO' | ''>('');


// ---- API ヘルパー ----
async function updateBookingStatus(
  id: number,
  status: BookingStatus,
  token: string,
) {
  // ★ ここは「ステータスだけ更新する専用 API」にする
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
    needLoanerCar?: boolean; // ★追加
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
  // 代車：true=必要, false=不要, null=未選択（必須にするため）
  const [editNeedLoanerCar, setEditNeedLoanerCar] = useState<boolean | null>(null);
  const [modalNeedLoanerCar, setModalNeedLoanerCar] = useState<boolean | null>(null);

  // const [editLoanerChoice, setEditLoanerChoice] = useState<'NEED' | 'NO'>('NO');


  const [editTimeSlot, setEditTimeSlot] =
    useState<TimeSlot>('MORNING');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

    // ★ 予約詳細モーダル用の state
  const [editCustomerId, setEditCustomerId] = useState<number | null>(null);
  const [editCustomerMobile, setEditCustomerMobile] = useState('');
  const [editCustomerLineUid, setEditCustomerLineUid] = useState('');
  const [editCustomerBirthday, setEditCustomerBirthday] = useState('');
  const [editCustomerPostalCode, setEditCustomerPostalCode] = useState('');
  const [editCustomerAddress1, setEditCustomerAddress1] = useState('');
  const [editCustomerAddress2, setEditCustomerAddress2] = useState('');

  const [editCarId, setEditCarId] = useState<number | null>(null);

  const [me, setMe] = useState<Me | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [confirmModalBooking, setConfirmModalBooking] =
    useState<Booking | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmSending, setConfirmSending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(
    null,
  );

  // 未確認一覧からの確定/キャンセル + LINE送信確認モーダル
  const [pendingActionModal, setPendingActionModal] = useState<{
    booking: Booking;
    nextStatus: 'CONFIRMED' | 'CANCELED';
  } | null>(null);
  const [pendingActionMessage, setPendingActionMessage] = useState('');
  const [pendingActionSending, setPendingActionSending] = useState(false);
  const [pendingActionError, setPendingActionError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');

  const customerCarsForEditing = useMemo(() => {
  if (!editCustomerId) return [];
  return cars.filter((car) => car.customerId === editCustomerId);
}, [cars, editCustomerId]);

  // ★ 追加：検索キーワードで顧客リストを絞り込む
const filteredCustomers = useMemo(() => {
  if (!customerSearch.trim()) {
    // 何も入力されていないとき → 全顧客
    return customers;
  }

  const keyword = customerSearch.trim().toLowerCase();

  return customers.filter((c) => {
    const fullName = `${c.lastName ?? ''}${c.firstName ?? ''}`.toLowerCase();
    return fullName.includes(keyword);
  });
}, [customers, customerSearch]);


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
  // const [modalLoanerChoice, setModalLoanerChoice] = useState<'NEED' | 'NO' | ''>('');

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

  // 初回ロード完了後に knownBookingIds を初期化し、30秒ポーリング開始
  useEffect(() => {
    if (loading) return;

    // 初回は現在の予約IDを「既知」として登録（音を鳴らさない）
    knownBookingIdsRef.current = new Set(bookings.map((b) => b.id));

    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;
    if (!token) return;

    const poll = async () => {
      try {
        const res = await fetch(`${apiBase}/bookings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: Booking[] = await res.json();

        // 新着PENDING LINE予約を検知
        const known = knownBookingIdsRef.current!;
        const newLineBookings = data.filter(
          (b) => !known.has(b.id) && b.status === 'PENDING' && b.source === 'LINE_PUBLIC_FORM',
        );

        // 全予約IDを既知として更新
        knownBookingIdsRef.current = new Set(data.map((b) => b.id));
        setBookings(data);

        if (newLineBookings.length > 0) {
          playNotificationSound();
          setNewBookingFlash(true);
          setShowPendingList(true);
          setTimeout(() => setNewBookingFlash(false), 3000);
        }
      } catch {
        // ポーリングエラーは無視
      }
    };

    pollBookingTimerRef.current = setInterval(poll, 30_000);
    return () => {
      if (pollBookingTimerRef.current) clearInterval(pollBookingTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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

  const pendingBookings = useMemo(() => {
    return bookings
      .filter((b) => b.status === 'PENDING')
      .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
  }, [bookings]);

  const [showPendingList, setShowPendingList] = useState(true);

  // 新着LINE予約の通知アニメーション
  const [newBookingFlash, setNewBookingFlash] = useState(false);
  // 既知の予約IDセット（新着検知用）
  const knownBookingIdsRef = useRef<Set<number> | null>(null);
  // ポーリングタイマー
  const pollBookingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Web Audio API で通知音を鳴らす（外部ファイル不要）
  const playNotificationSound = () => {
    try {
      const ctx = new AudioContext();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.35);
      });
      setTimeout(() => ctx.close(), 1500);
    } catch {
      // AudioContext が使えない環境では無視
    }
  };

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
    setModalNeedLoanerCar(null);

  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setModalError(null);
    setModalNote('');
    setModalNeedLoanerCar(null);

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

  const openPendingActionModal = (
    booking: Booking,
    nextStatus: 'CONFIRMED' | 'CANCELED',
  ) => {
    const dateKey = toDateKey(booking.bookingDate).replace(/-/g, '/');
    const customerName = booking.customer
      ? `${booking.customer.lastName ?? ''} ${booking.customer.firstName ?? ''}`.trim()
      : '';
    const carLabel = booking.car
      ? `${booking.car.carName ?? ''}${booking.car.registrationNumber ? `（${booking.car.registrationNumber}）` : ''}`
      : '';

    let defaultMsg = '';
    if (nextStatus === 'CONFIRMED') {
      defaultMsg = [
        customerName ? `${customerName} 様` : '',
        '',
        'このたびはご予約ありがとうございます。',
        '以下の内容でご予約を承りました。',
        '',
        dateKey ? `ご予約日：${dateKey}` : '',
        booking.timeSlot ? `ご希望時間帯：${timeSlotLabel(booking.timeSlot)}` : '',
        carLabel ? `対象のお車：${carLabel}` : '',
        '',
        '内容に変更がある場合は、お手数ですが店舗までご連絡ください。',
      ].filter(Boolean).join('\n');
    } else {
      defaultMsg = [
        customerName ? `${customerName} 様` : '',
        '',
        'ご予約についてご連絡いたします。',
        '誠に恐れ入りますが、以下のご予約をキャンセルとさせていただきました。',
        '',
        dateKey ? `ご予約日：${dateKey}` : '',
        booking.timeSlot ? `ご希望時間帯：${timeSlotLabel(booking.timeSlot)}` : '',
        carLabel ? `対象のお車：${carLabel}` : '',
        '',
        'ご不明点がございましたら、お気軽にご連絡ください。',
      ].filter(Boolean).join('\n');
    }

    setPendingActionModal({ booking, nextStatus });
    setPendingActionMessage(defaultMsg);
    setPendingActionError(null);
  };

  const handlePendingAction = async (sendLine: boolean) => {
    if (!pendingActionModal) return;
    const { booking, nextStatus } = pendingActionModal;

    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;
    if (!token) {
      alert('ログイン情報が見つかりません。再ログインしてください。');
      return;
    }

    setPendingActionSending(true);
    setPendingActionError(null);

    try {
      // 1) ステータス変更
      await updateBookingStatus(booking.id, nextStatus, token);
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: nextStatus } : b)),
      );

      // 2) LINE送信（希望する場合かつ LINE UID あり）
      if (sendLine && booking.customer?.lineUid) {
        const updated = await sendConfirmationLine(booking.id, token, pendingActionMessage);
        if (updated) {
          setBookings((prev) =>
            prev.map((b) =>
              b.id === updated.id
                ? { ...b, confirmationLineSentAt: updated.confirmationLineSentAt, confirmationLineMessage: updated.confirmationLineMessage }
                : b,
            ),
          );
        }
      }

      setPendingActionModal(null);
    } catch (e: any) {
      setPendingActionError(e?.message ?? '処理に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setPendingActionSending(false);
    }
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


  // 予約情報
  setEditDate(toDateKey(booking.bookingDate));
  setEditTimeSlot(booking.timeSlot as TimeSlot);
  setEditNote(booking.note ?? '');
  setEditError(null);
  setEditCarId(booking.carId ?? null);

  // 顧客情報
  setEditCustomerId(booking.customer?.id ?? null);
  setEditCustomerMobile(booking.customer?.mobilePhone ?? '');
  setEditCustomerLineUid(booking.customer?.lineUid ?? '');
  setEditCustomerBirthday(
    booking.customer?.birthday
      ? toDateKey(booking.customer.birthday)
      : '',
  );
  setEditCustomerPostalCode(booking.customer?.postalCode ?? '');
  setEditCustomerAddress1(booking.customer?.address1 ?? '');
  setEditCustomerAddress2(booking.customer?.address2 ?? '');

  // 車両情報
  setEditCarId(booking.car?.id ?? null);

  setEditNeedLoanerCar(
  booking.needsLoanerCar === null || booking.needsLoanerCar === undefined
    ? null
    : booking.needsLoanerCar
);

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

  if (editNeedLoanerCar === null) {
  setEditError('代車の要否を選択してください。');
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
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // --- 1) 顧客情報の更新（あれば） ---
    if (editCustomerId) {
      const resCustomer = await fetch(
        `${apiBase}/customers/${editCustomerId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            mobilePhone: editCustomerMobile || null,
            lineUid: editCustomerLineUid || null,
            birthday: editCustomerBirthday || null,
            postalCode: editCustomerPostalCode || null,
            address1: editCustomerAddress1 || null,
            address2: editCustomerAddress2 || null,
          }),
        },
      );

      if (!resCustomer.ok) {
        const data = await resCustomer.json().catch(() => null);
        const msg =
          (data && data.message) ||
          '顧客情報の更新に失敗しました。';
        setEditError(msg);
        setEditSaving(false);
        return;
      }
    }

    // --- 2) 予約情報の更新（日時・メモ・車両） ---
    const resBooking = await fetch(
      `${apiBase}/bookings/${editingBooking.id}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          bookingDate: editDate,
          timeSlot: editTimeSlot,
          note: editNote,
          carId: editCarId ?? undefined,
          needLoanerCar: editNeedLoanerCar,

        }),
      },
    );

    if (!resBooking.ok) {
      const data = await resBooking.json().catch(() => null);
      const msg =
        (data && data.message) ||
        '予約の更新に失敗しました。時間をおいて再度お試しください。';
      setEditError(msg);
      setEditSaving(false);
      return;
    }

    const updated = (await resBooking.json()) as Booking;

    setBookings((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b)),
    );

    closeEditModal();
    alert('予約の内容を更新しました。');
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
if (modalNeedLoanerCar === null) {
  setModalError('代車の要否を選択してください。');
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
          needLoanerCar: modalNeedLoanerCar,

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
            <h1 className="text-2xl font-extrabold text-green-700 flex items-center gap-2">
              📅 予約カレンダー
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              カレンダー上で予約件数と重複状況を確認できます。日付をクリックすると、その日の予約一覧が下に表示されます。
            </p>
          </div>
        </header>

        {/* 未確認予約一覧 */}
        {(() => {
          const lineBookingCount = pendingBookings.filter(b => b.source === 'LINE_PUBLIC_FORM').length;
          return (
        <section className={`rounded-2xl shadow-sm overflow-hidden border-2 transition-all ${newBookingFlash ? 'border-red-500 bg-red-100 ring-4 ring-red-300 ring-offset-2 scale-[1.01]' : lineBookingCount > 0 ? 'border-red-400 bg-red-50 animate-pulse-slow' : 'border-amber-200 bg-amber-50'}`}>
          <button
            type="button"
            onClick={() => setShowPendingList((v) => !v)}
            className={`w-full flex items-center justify-between px-5 py-3 transition-colors ${lineBookingCount > 0 ? 'hover:bg-red-100' : 'hover:bg-amber-100'}`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-base font-extrabold ${lineBookingCount > 0 ? 'text-red-900' : 'text-amber-900'}`}>
                {lineBookingCount > 0 ? '🔔 未確認の予約' : '⚠️ 未確認の予約'}
              </span>
              {pendingBookings.length > 0 ? (
                <span className={`inline-flex items-center rounded-full text-white text-xs font-bold px-2.5 py-0.5 ${lineBookingCount > 0 ? 'bg-red-500' : 'bg-amber-500'}`}>
                  {pendingBookings.length}件
                </span>
              ) : (
                <span className="text-xs text-amber-700">なし</span>
              )}
              {lineBookingCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-100 border border-red-400 text-red-700 text-xs font-bold px-2.5 py-0.5 animate-bounce">
                  📲 LINE予約 {lineBookingCount}件 — 要対応
                </span>
              )}
            </div>
            <span className={`text-sm ${lineBookingCount > 0 ? 'text-red-700' : 'text-amber-700'}`}>{showPendingList ? '▲ 閉じる' : '▼ 開く'}</span>
          </button>

          {showPendingList && (
            <div className="border-t border-amber-200 px-4 py-3">
              {pendingBookings.length === 0 ? (
                <p className="text-sm text-amber-700 py-2">✅ 未確認の予約はありません</p>
              ) : (
                <div className="space-y-2">
                  {pendingBookings.map((b) => {
                    const customerName = b.customer
                      ? `${b.customer.lastName ?? ''} ${b.customer.firstName ?? ''}`.trim()
                      : '-';
                    const tel = (b.customer?.mobilePhone ?? '').trim() || null;
                    const carLabel = b.car
                      ? `${b.car.carName ?? ''}${b.car.registrationNumber ? `（${b.car.registrationNumber}）` : ''}`
                      : '-';
                    const dateStr = toDateKey(b.bookingDate).replace(/-/g, '/');
                    const sourceLabel =
                      b.source === 'LINE_PUBLIC_FORM' ? '📲 LINE予約フォーム'
                      : b.source === 'TENANT_MANUAL' ? '✏️ 店舗入力'
                      : b.source === 'ADMIN' ? '🔧 管理画面'
                      : b.source || '不明';

                    const isLineBooking = b.source === 'LINE_PUBLIC_FORM';
                    return (
                      <div
                        key={b.id}
                        className={`rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3 border-2 ${isLineBooking ? 'bg-red-50 border-red-400 shadow-md' : 'bg-white border-amber-200'}`}
                      >
                        {/* 日時・種別 */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-extrabold text-gray-900">{dateStr}</span>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${timeSlotBadgeClass(b.timeSlot)}`}>
                            {timeSlotLabel(b.timeSlot)}
                          </span>
                        </div>
                        {/* 顧客・車両 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 truncate">{customerName}</p>
                            {isLineBooking && (
                              <span className="inline-flex items-center rounded-full bg-red-500 text-white text-[10px] font-bold px-2 py-0.5">📲 LINE新着</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 truncate">{carLabel}</p>
                          {tel && (
                            <a href={`tel:${tel}`} className="text-xs text-emerald-700 hover:underline">{tel}</a>
                          )}
                          <p className={`text-xs mt-0.5 font-semibold ${isLineBooking ? 'text-red-600' : 'text-gray-400'}`}>{sourceLabel}</p>
                          {b.needsLoanerCar != null && (
                            <p className="text-xs text-gray-500">代車: {b.needsLoanerCar ? '必要' : '不要'}</p>
                          )}
                          {b.note && (
                            <p className="text-xs text-gray-600 mt-0.5 italic">「{b.note.slice(0, 40)}{b.note.length > 40 ? '…' : ''}」</p>
                          )}
                        </div>
                        {/* 操作ボタン */}
                        <div className="flex flex-wrap gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => openPendingActionModal(b, 'CONFIRMED')}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 shadow-sm"
                          >
                            ✅ 確定する
                          </button>
                          <button
                            type="button"
                            onClick={() => openPendingActionModal(b, 'CANCELED')}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white hover:bg-red-50 text-red-700 text-xs font-bold px-3 py-1.5"
                          >
                            ✕ キャンセル
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDateKey(toDateKey(b.bookingDate));
                              setCurrentMonth(new Date(new Date(b.bookingDate).getFullYear(), new Date(b.bookingDate).getMonth(), 1));
                              document.querySelector('section.bg-white')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold px-3 py-1.5"
                          >
                            📅 カレンダーで見る
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
          );
        })()}

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
            <div className="space-y-3">
              {selectedBookings
                .slice()
                .sort((a, b) => (a.timeSlot || '').localeCompare(b.timeSlot || ''))
                .map((b) => {
                  const customerName = b.customer
                    ? `${b.customer.lastName ?? ''} ${b.customer.firstName ?? ''}`.trim()
                    : '-';
                  const tel = (b.customer?.mobilePhone ?? '').trim() || null;
                  const carLabel = b.car
                    ? `${b.car.carName ?? ''}${b.car.registrationNumber ? `（${b.car.registrationNumber}）` : ''}`
                    : '-';
                  const hasLineUid = !!b.customer?.lineUid?.trim();
                  const shakenLabel = formatDateLabel(b.car?.shakenDate);
                  const inspectionLabel = formatDateLabel(b.car?.inspectionDate);
                  const sourceLabel =
                    b.source === 'LINE_PUBLIC_FORM' ? '📲 LINE予約フォーム'
                    : b.source === 'TENANT_MANUAL' ? '✏️ 店舗入力'
                    : b.source === 'ADMIN' ? '🔧 管理画面'
                    : b.source || '不明';

                  const isPending = b.status === 'PENDING';

                  return (
                    <div
                      key={b.id}
                      className={`rounded-2xl border p-4 shadow-sm ${
                        isPending
                          ? 'border-amber-300 bg-amber-50'
                          : b.status === 'CONFIRMED'
                          ? 'border-emerald-200 bg-white'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      {/* 上段：時間帯・ステータス・受付経路 */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${timeSlotBadgeClass(b.timeSlot)}`}>
                          {timeSlotLabel(b.timeSlot)}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(b.status)}`}>
                          {statusLabel(b.status)}
                        </span>
                        <span className="text-xs text-gray-500">{sourceLabel}</span>
                        {b.confirmationLineSentAt && (
                          <span className="text-xs text-emerald-600 font-semibold">✅ LINE確定済み</span>
                        )}
                      </div>

                      {/* 中段：顧客・車両情報 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">顧客</p>
                          <p className="font-bold text-gray-900 text-sm">{customerName}</p>
                          {tel ? (
                            <a href={`tel:${tel}`} className="text-sm text-emerald-700 hover:underline">{tel}</a>
                          ) : (
                            <p className="text-sm text-gray-400">電話番号未登録</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">車両</p>
                          <p className="font-bold text-gray-900 text-sm">{carLabel}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {shakenLabel && (
                              <span className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700">
                                🔧 車検 {shakenLabel}
                              </span>
                            )}
                            {inspectionLabel && (
                              <span className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700">
                                🔩 点検 {inspectionLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 代車・メモ */}
                      <div className="flex flex-wrap gap-3 mb-3 text-sm">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          b.needsLoanerCar ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-300 bg-white text-gray-600'
                        }`}>
                          🚙 代車: {b.needsLoanerCar == null ? '未選択' : b.needsLoanerCar ? '必要' : '不要'}
                        </span>
                        {b.note && (
                          <span className="text-xs text-gray-600 italic">
                            💬 「{b.note.slice(0, 50)}{b.note.length > 50 ? '…' : ''}」
                          </span>
                        )}
                      </div>

                      {/* 下段：操作ボタン */}
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
                        {/* ステータス変更 */}
                        <select
                          value={b.status}
                          onChange={(e) => handleChangeStatus(b.id, e.target.value as BookingStatus)}
                          disabled={updatingId === b.id}
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="PENDING">未確認</option>
                          <option value="CONFIRMED">確定</option>
                          <option value="CANCELED">キャンセル</option>
                        </select>

                        {/* LINE確定メッセージ */}
                        {b.status === 'CONFIRMED' && (
                          <button
                            type="button"
                            disabled={!hasLineUid}
                            onClick={hasLineUid ? () => openConfirmModal(b) : undefined}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm ${
                              hasLineUid
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            📲 {hasLineUid
                              ? b.confirmationLineSentAt ? 'LINE確定再送' : 'LINE確定送信'
                              : 'LINE未連携'}
                          </button>
                        )}

                        {/* 詳細編集 */}
                        {(b.source === 'ADMIN' || b.source === 'TENANT_MANUAL' || b.source === 'LINE_PUBLIC_FORM') && (
                          <button
                            type="button"
                            onClick={() => openEditModal(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700"
                          >
                            🗓 詳細編集
                          </button>
                        )}

                        {/* 削除 */}
                        <button
                          type="button"
                          onClick={() => handleDeleteBooking(b.id)}
                          disabled={deletingId === b.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white hover:bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50"
                        >
                          🗑 {deletingId === b.id ? '削除中...' : '削除'}
                        </button>
                      </div>
                    </div>
                  );
                })}
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

                {/* ★ 追加：顧客検索欄 */}
<input
  type="text"
  value={customerSearch}
  onChange={(e) => setCustomerSearch(e.target.value)}
  placeholder="名前で検索（例：山田、田中太郎 など）"
  className="w-full rounded-md border border-gray-400 bg-white px-2 py-1.5 text-[11px] sm:text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
/>
<p className="text-[10px] text-gray-500 mb-1">
  入力すると該当する顧客だけが下のリストに表示されます。
</p>

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
                   {/* ★ 修正：customers → filteredCustomers */}
  {filteredCustomers.map((c) => (
    <option key={c.id} value={c.id}>
      {`${c.lastName ?? ''} ${c.firstName ?? ''}`.trim() || `ID: ${c.id}`}
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
  <label className="block text-sm font-medium mb-1">
    代車 <span className="text-red-500">*</span>
  </label>

  <div className="flex items-center gap-6 text-sm">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={modalNeedLoanerCar === true}
        onChange={() =>
          setModalNeedLoanerCar(modalNeedLoanerCar === true ? null : true)
        }
      />
      必要
    </label>

    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={modalNeedLoanerCar === false}
        onChange={() =>
          setModalNeedLoanerCar(modalNeedLoanerCar === false ? null : false)
        }
      />
      不要
    </label>
  </div>

  {modalNeedLoanerCar === null && (
    <p className="mt-1 text-[11px] text-gray-600">
      ※ 必ずどちらか選択してください
    </p>
  )}
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

      {/* 未確認一覧からの確定/キャンセル + LINE送信モーダル */}
      {pendingActionModal && (() => {
        const { booking, nextStatus } = pendingActionModal;
        const customerName = booking.customer
          ? `${booking.customer.lastName ?? ''} ${booking.customer.firstName ?? ''}`.trim()
          : '-';
        const dateKey = toDateKey(booking.bookingDate).replace(/-/g, '/');
        const hasLineUid = !!booking.customer?.lineUid?.trim();
        const isConfirm = nextStatus === 'CONFIRMED';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
              {/* ヘッダー */}
              <div className={`px-5 py-4 ${isConfirm ? 'bg-emerald-600' : 'bg-red-500'}`}>
                <h3 className="text-base font-extrabold text-white">
                  {isConfirm ? '✅ 予約を確定する' : '✕ 予約をキャンセルする'}
                </h3>
                <p className="text-sm text-white/80 mt-0.5">
                  {customerName}｜{dateKey}｜{timeSlotLabel(booking.timeSlot)}
                </p>
              </div>

              <div className="px-5 py-4 space-y-4">
                {pendingActionError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    {pendingActionError}
                  </div>
                )}

                {hasLineUid ? (
                  <>
                    <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                      📲 このお客様はLINE連携済みです。ステータス変更と同時にLINEメッセージを送信できます。
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        送信するメッセージ（編集可）
                      </label>
                      <textarea
                        value={pendingActionMessage}
                        onChange={(e) => setPendingActionMessage(e.target.value)}
                        rows={8}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-green-400 resize-y"
                      />
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
                    ℹ️ このお客様はLINE未連携のため、LINE送信はできません。ステータスのみ変更されます。
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  {hasLineUid && (
                    <button
                      type="button"
                      disabled={pendingActionSending}
                      onClick={() => handlePendingAction(true)}
                      className={`w-full rounded-xl py-3 text-sm font-extrabold text-white shadow-sm disabled:opacity-50 ${
                        isConfirm ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'
                      }`}
                    >
                      {pendingActionSending ? '処理中...' : `${isConfirm ? '確定' : 'キャンセル'}してLINEを送信する`}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pendingActionSending}
                    onClick={() => handlePendingAction(false)}
                    className="w-full rounded-xl border border-gray-300 bg-white hover:bg-gray-50 py-3 text-sm font-bold text-gray-700 disabled:opacity-50"
                  >
                    {pendingActionSending ? '処理中...' : `LINE送信なしで${isConfirm ? '確定' : 'キャンセル'}する`}
                  </button>
                  <button
                    type="button"
                    disabled={pendingActionSending}
                    onClick={() => setPendingActionModal(null)}
                    className="w-full rounded-xl border border-gray-200 bg-white hover:bg-gray-50 py-2 text-xs text-gray-500 disabled:opacity-50"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 日程編集モーダル */}
      {editingBooking && (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
    <div
  className="
    w-full max-w-2xl 
    max-h-[85vh]                /* 画面の85%以内に収める */
    overflow-y-auto             /* 中身だけスクロール */
    rounded-xl bg-white shadow-lg border border-gray-200 
    p-4 sm:p-5
  "
>
      <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
        予約の詳細
      </h3>
      <p className="text-xs text-gray-600 mb-3">
        {`予約ID: ${editingBooking.id}`}
      </p>

      {editError && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-[11px] text-red-800">
          {editError}
        </div>
      )}

            {/* ↓↓↓ ここから差し替え ↓↓↓ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px] sm:text-sm">
        {/* 予約情報（左カラム） */}
        <section className="rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-3 sm:px-4 sm:py-4">
          <h4 className="text-xs font-semibold text-gray-900 mb-2">
            予約情報
          </h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1">
                  日付
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-md border border-gray-500 bg-white px-2 py-1.5 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                  className="w-full rounded-md border border-gray-500 bg-white px-2 py-1.5 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="MORNING">午前</option>
                  <option value="AFTERNOON">午後</option>
                  <option value="EVENING">夕方</option>
                </select>
              </div>
            </div>

            {/* 代車 */}
<div>
  <label className="block text-sm font-medium mb-1">
    代車 <span className="text-red-500">*</span>
  </label>

  <div className="flex items-center gap-6 text-sm">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={editNeedLoanerCar === true}
        onChange={() =>
          setEditNeedLoanerCar(editNeedLoanerCar === true ? null : true)
        }
      />
      必要
    </label>

    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={editNeedLoanerCar === false}
        onChange={() =>
          setEditNeedLoanerCar(editNeedLoanerCar === false ? null : false)
        }
      />
      不要
    </label>
  </div>

  {editNeedLoanerCar === null && (
    <p className="mt-1 text-[11px] text-gray-600">
      ※ 必ずどちらか選択してください
    </p>
  )}
</div>

            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1">
                何の予約か（メモ）
              </label>
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={2} // ← 3行 → 2行にして縦を少し詰める
                className="w-full rounded-md border border-gray-500 bg-white px-2 py-1.5 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y"
                placeholder="例）車検、オイル交換、鈑金見積もり など"
              />
            </div>
          </div>
        </section>

        {/* 顧客情報（右カラム） */}
        <section className="rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-3 sm:px-4 sm:py-4">
          <h4 className="text-xs font-semibold text-gray-900 mb-2">
            顧客情報
          </h4>
          <p className="text-[11px] text-gray-600 mb-2">
            {editingBooking.customer
              ? `${editingBooking.customer.lastName ?? ''} ${
                  editingBooking.customer.firstName ?? ''
                }`.trim()
              : '（顧客情報なし）'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1">
                携帯番号
              </label>
              <input
                type="tel"
                value={editCustomerMobile}
                onChange={(e) => setEditCustomerMobile(e.target.value)}
                className="w-full rounded-md border border-gray-500 bg-white px-2 py-1.5 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1">
                LINE UID
              </label>
              <input
                type="text"
                value={editCustomerLineUid}
                onChange={(e) => setEditCustomerLineUid(e.target.value)}
                className="w-full rounded-md border border-gray-500 bg-white px-2 py-1.5 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1">
                誕生日
              </label>
              <input
                type="date"
                value={editCustomerBirthday}
                onChange={(e) => setEditCustomerBirthday(e.target.value)}
                className="w-full rounded-md border border-gray-500 bg-white px-2 py-1.5 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1">
                郵便番号
              </label>
              <input
                type="text"
                value={editCustomerPostalCode}
                onChange={(e) => setEditCustomerPostalCode(e.target.value)}
                className="w-full rounded-md border border-gray-500 bg-white px-2 py-1.5 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1">
                住所１
              </label>
              <input
                type="text"
                value={editCustomerAddress1}
                onChange={(e) => setEditCustomerAddress1(e.target.value)}
                className="w-full rounded-md border border-gray-500 bg-white px-2 py-1.5 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1">
                住所２（建物名等）
              </label>
              <input
                type="text"
                value={editCustomerAddress2}
                onChange={(e) => setEditCustomerAddress2(e.target.value)}
                className="w-full rounded-md border border-gray-500 bg-white px-2 py-1.5 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        </section>

        {/* 車両情報（下段フル幅） */}
        <section className="md:col-span-2 rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-3 sm:px-4 sm:py-4">
          <h4 className="text-xs font-semibold text-gray-900 mb-2">
            車両情報
          </h4>

          <div>
            <label className="block text-xs font-medium text-gray-900 mb-1">
              車両（選び直し）
            </label>
            <select
              value={editCarId ?? ''}
              onChange={(e) =>
                setEditCarId(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              disabled={!editCustomerId}
              className="w-full rounded-md border border-gray-500 bg-white px-2 py-2 text-[12px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">
                {editCustomerId
                  ? 'この顧客に紐づく車両を選択してください'
                  : '先に顧客情報を確認してください'}
              </option>

              {customerCarsForEditing.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.carName ?? '車両'}
                  {car.registrationNumber
                    ? `（${car.registrationNumber}）`
                    : ''}
                </option>
              ))}

              {editCustomerId && customerCarsForEditing.length === 0 && (
                <option value="" disabled>
                  ※ この顧客に登録されている車両がありません
                </option>
              )}
            </select>
          </div>
        </section>
      </div>
      {/* ↑↑↑ ここまで差し替え ↑↑↑ */}


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
