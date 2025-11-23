"use client";

import { useEffect, useState } from 'react';
import TenantLayout from "../components/TenantLayout";

type Role = 'DEVELOPER' | 'MANAGER' | 'CLIENT';

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
};

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELED';

type Booking = {
  id: number;
  bookingDate: string; // ISO文字列
  timeSlot?: string | null;
  status: BookingStatus;
  source?: string | null;
  note?: string | null;
  customer: {
    id: number;
    lastName: string;
    firstName: string;
  };
  car: {
    id: number;
    carName: string;
    registrationNumber: string;
  };
};

type Customer = {
  id: number;
  lastName: string;
  firstName: string;
};

// customerId 追加済み
type Car = {
  id: number;
  carName: string;
  registrationNumber: string;
  customerId: number;
};

export default function BookingsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cars, setCars] = useState<Car[]>([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // 新規予約／編集フォーム用 state
  const [newCustomerId, setNewCustomerId] = useState<number | ''>('');
  const [newCarId, setNewCarId] = useState<number | ''>('');
  const [newDate, setNewDate] = useState<string>(''); // yyyy-mm-dd
  const [newTime, setNewTime] = useState<string>(''); // HH:MM
  const [newTimeSlot, setNewTimeSlot] = useState<string>(''); // "AM" など任意
  const [newNote, setNewNote] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // ★ 編集中の予約ID（null のときは新規モード）
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null);

  const formatDateTime = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const date = d.toLocaleDateString('ja-JP');
    const time = d.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${date} ${time}`;
  };

  const resetBookingForm = () => {
    setNewCustomerId('');
    setNewCarId('');
    setNewDate('');
    setNewTime('');
    setNewTimeSlot('');
    setNewNote('');
  };

  // 初回ロード時：auth/me + bookings + customers + cars
  useEffect(() => {
    const savedToken =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;

    if (!savedToken) {
      setPageError('先にログインしてください（トップページからログイン）');
      setLoading(false);
      return;
    }

    setToken(savedToken);

    const headers = { Authorization: `Bearer ${savedToken}` };

    const fetchMe = fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers,
    })
      .then((res) => {
        if (!res.ok) throw new Error('auth me error');
        return res.json();
      })
      .then((data: Me) => {
        setMe(data);
      });

    const fetchBookings = fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings`, {
      headers,
    })
      .then((res) => {
        if (!res.ok) throw new Error('bookings api error');
        return res.json();
      })
      .then((data: Booking[]) => {
        setBookings(data);
      });

    const fetchCustomers = fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers`, {
      headers,
    })
      .then((res) => {
        if (!res.ok) throw new Error('customers api error');
        return res.json();
      })
      .then((data: Customer[]) => {
        setCustomers(data);
      });

    const fetchCars = fetch(`${process.env.NEXT_PUBLIC_API_URL}/cars`, {
      headers,
    })
      .then((res) => {
        if (!res.ok) throw new Error('cars api error');
        return res.json();
      })
      .then((data: Car[]) => {
        setCars(data);
      });

    Promise.all([fetchMe, fetchBookings, fetchCustomers, fetchCars])
      .catch((err) => {
        console.error(err);
        setPageError('予約画面の初期データ取得に失敗しました');
      })
      .finally(() => setLoading(false));
  }, []);

  const reloadBookings = async () => {
    if (!token) return;
    setPageError(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('bookings api error');
      const data: Booking[] = await res.json();
      setBookings(data);
    } catch (err) {
      console.error(err);
      setPageError('予約一覧の再取得に失敗しました');
    }
  };

  const updateStatus = async (bookingId: number, status: BookingStatus) => {
    if (!token) {
      setUpdateError('トークンがありません。再ログインしてください。');
      return;
    }

    setUpdatingId(bookingId);
    setUpdateMessage(null);
    setUpdateError(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/bookings/${bookingId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data?.message ||
          (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
          'ステータス変更に失敗しました';
        throw new Error(msg);
      }

      await reloadBookings();
      setUpdateMessage(`予約ID ${bookingId} のステータスを ${status} に更新しました。`);
    } catch (err: any) {
      console.error(err);
      setUpdateError(err.message ?? 'ステータス変更中にエラーが発生しました');
    } finally {
      setUpdatingId(null);
    }
  };

  const renderStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-block px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-800">
            未確認
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">
            確定
          </span>
        );
      case 'CANCELED':
        return (
          <span className="inline-block px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700">
            キャンセル
          </span>
        );
      default:
        return status;
    }
  };

  const handleCreateOrUpdateBooking = async () => {
    if (!token) {
      setCreateError('トークンがありません。再ログインしてください。');
      return;
    }

    setCreateMessage(null);
    setCreateError(null);

    if (!newCustomerId || !newCarId || !newDate) {
      setCreateError('顧客・車両・予約日は必須です。');
      return;
    }

    const dateTimeStr = newTime
      ? `${newDate}T${newTime}:00`
      : `${newDate}T00:00:00`;
    const d = new Date(dateTimeStr);
    if (Number.isNaN(d.getTime())) {
      setCreateError('予約日の形式が不正です。');
      return;
    }

    setCreating(true);

    try {
      const body = {
        customerId: newCustomerId,
        carId: newCarId,
        bookingDate: d.toISOString(),
        timeSlot: newTimeSlot || undefined,
        note: newNote || undefined,
      };

      if (editingBookingId == null) {
        // 新規作成
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const msg =
            data?.message ||
            (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
            '予約の作成に失敗しました';
          throw new Error(msg);
        }

        resetBookingForm();
        await reloadBookings();
        setCreateMessage('予約を登録しました（ステータス: 未確認）。');
      } else {
        // 編集更新
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/bookings/${editingBookingId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const msg =
            data?.message ||
            (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
            '予約の更新に失敗しました';
          throw new Error(msg);
        }

        resetBookingForm();
        await reloadBookings();
        setEditingBookingId(null);
        setCreateMessage('予約内容を更新しました。');
      }
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message ?? '予約処理中にエラーが発生しました');
    } finally {
      setCreating(false);
    }
  };

  // 編集開始：選択した予約の内容をフォームに流し込む
  const handleEditBookingClick = (b: Booking) => {
    setEditingBookingId(b.id);
    setCreateError(null);
    setCreateMessage(null);

    setNewCustomerId(b.customer.id);
    setNewCarId(b.car.id);

    const d = new Date(b.bookingDate);
    if (!Number.isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setNewDate(`${yyyy}-${mm}-${dd}`);

      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      // 00:00 のときは空にしてもいいが、とりあえず入れておく
      setNewTime(hh + ':' + mi);
    } else {
      setNewDate('');
      setNewTime('');
    }

    setNewTimeSlot(b.timeSlot ?? '');
    setNewNote(b.note ?? '');
  };

  const handleCancelEditBooking = () => {
    setEditingBookingId(null);
    resetBookingForm();
    setCreateError(null);
    setCreateMessage(null);
  };

  const handleDeleteBooking = async (bookingId: number) => {
    if (!token) {
      setUpdateError('トークンがありません。再ログインしてください。');
      return;
    }

    const ok = window.confirm(`予約ID ${bookingId} を削除してよろしいですか？`);
    if (!ok) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data?.message ||
          (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
          '予約の削除に失敗しました';
        throw new Error(msg);
      }

      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      if (editingBookingId === bookingId) {
        handleCancelEditBooking();
      }
      setUpdateMessage(`予約ID ${bookingId} を削除しました。`);
    } catch (err: any) {
      console.error(err);
      setUpdateError(err.message ?? '予約の削除中にエラーが発生しました');
    }
  };

  // 顧客に紐づく車だけを表示
  const filteredCars: Car[] =
    newCustomerId === ''
      ? []
      : cars.filter((car) => car.customerId === newCustomerId);

  const handleChangeCustomer = (value: string) => {
    const cid = value ? Number(value) : ('' as const);
    setNewCustomerId(cid);

    if (cid === '') {
      setNewCarId('');
      return;
    }

    const carForCustomer = cars.filter((car) => car.customerId === cid);
    const currentCarStillValid =
      newCarId && carForCustomer.some((car) => car.id === newCarId);

    if (!currentCarStillValid) {
      setNewCarId('');
    }
  };

  const handleChangeCar = (value: string) => {
    setNewCarId(value ? Number(value) : ('' as const));
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="border border-red-400 text-red-700 px-4 py-3 rounded max-w-md bg-white">
          <p className="font-semibold mb-2">エラー</p>
          <p className="text-sm mb-2 whitespace-pre-wrap">{pageError}</p>
          <button
            className="mt-2 px-3 py-1 border rounded text-sm bg-gray-100"
            onClick={reloadBookings}
          >
            再読み込み
          </button>
        </div>
      </main>
    );
  }

  return (
    <TenantLayout>
      <main className="min-h-screen flex flex-col items-center p-4 gap-6 bg-gray-50">
        <h1 className="text-2xl font-bold mt-4">予約管理</h1>

        {me && (
          <div className="border rounded-md px-4 py-3 bg-white w-full max-w-6xl">
            <p>
              ログイン中: {me.name ?? me.email}（ロール: {me.role}）
            </p>
            <p className="text-xs text-gray-600 mt-1">
              管理者が電話・対面で受けた予約を登録し、ステータスを更新する運用を想定しています。
            </p>
          </div>
        )}

        {/* 予約作成／編集フォーム */}
        <section className="border rounded-md px-4 py-4 bg-white w-full max-w-6xl">
          <h2 className="font-semibold mb-2">
            {editingBookingId == null
              ? '新規予約の登録（管理者用）'
              : `予約の編集（ID: ${editingBookingId}）`}
          </h2>
          <p className="text-xs text-gray-600 mb-3">
            電話や対面で受けた予約を、ここから手動で登録・編集できます。
          </p>

          {editingBookingId != null && (
            <p className="text-xs text-orange-600 mb-2">
              編集をやめて新規予約モードに戻る場合は「編集をキャンセル」を押してください。
            </p>
          )}

          {createMessage && (
            <p className="text-xs text-green-700 mb-2 whitespace-pre-wrap">
              {createMessage}
            </p>
          )}
          {createError && (
            <p className="text-xs text-red-600 mb-2 whitespace-pre-wrap">
              {createError}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-700 mb-1">
                顧客<span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={newCustomerId}
                onChange={(e) => handleChangeCustomer(e.target.value)}
              >
                <option value="">選択してください</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.lastName} {c.firstName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">
                車両<span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={newCarId}
                onChange={(e) => handleChangeCar(e.target.value)}
                disabled={newCustomerId === ''}
              >
                <option value="">
                  {newCustomerId === ''
                    ? '先に顧客を選択してください'
                    : '選択してください'}
                </option>
                {filteredCars.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.carName}（{car.registrationNumber}）
                  </option>
                ))}
              </select>
              {newCustomerId !== '' && filteredCars.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  この顧客に紐づく車両が登録されていません。
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">
                予約日<span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1 text-sm"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">
                予約時間（任意）
              </label>
              <input
                type="time"
                className="w-full border rounded px-2 py-1 text-sm"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">
                時間帯ラベル（任意）
              </label>
              <input
                type="text"
                placeholder="例: 午前 / 午後 / 第1ラウンド など"
                className="w-full border rounded px-2 py-1 text-sm"
                value={newTimeSlot}
                onChange={(e) => setNewTimeSlot(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">
                メモ（任意）
              </label>
              <input
                type="text"
                className="w-full border rounded px-2 py-1 text-sm"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className="px-4 py-2 border rounded text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              onClick={handleCreateOrUpdateBooking}
              disabled={creating}
            >
              {creating
                ? '処理中...'
                : editingBookingId == null
                  ? '予約を登録'
                  : '予約を更新'}
            </button>
            {editingBookingId != null && (
              <button
                type="button"
                className="px-3 py-2 border rounded text-sm bg-gray-100"
                onClick={handleCancelEditBooking}
              >
                編集をキャンセル
              </button>
            )}
          </div>
        </section>

        {/* 予約一覧 */}
        <section className="border rounded-md px-4 py-4 bg-white w-full max-w-6xl">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div>
              <h2 className="font-semibold">予約一覧</h2>
              <p className="text-xs text-gray-600">
                車検予約・点検予約などを一覧で確認し、ステータスを更新・編集・削除できます。
              </p>
            </div>
            <button
              className="px-3 py-1 border rounded text-sm bg-gray-100"
              onClick={reloadBookings}
            >
              再読み込み
            </button>
          </div>

          {updateMessage && (
            <p className="text-xs text-green-700 mb-2 whitespace-pre-wrap">
              {updateMessage}
            </p>
          )}
          {updateError && (
            <p className="text-xs text-red-600 mb-2 whitespace-pre-wrap">
              {updateError}
            </p>
          )}

          {bookings.length === 0 ? (
            <p className="text-sm text-gray-600">予約はまだ登録されていません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1 text-left">ID</th>
                    <th className="border px-2 py-1 text-left">予約日時</th>
                    <th className="border px-2 py-1 text-left">時間帯</th>
                    <th className="border px-2 py-1 text-left">顧客</th>
                    <th className="border px-2 py-1 text-left">車両</th>
                    <th className="border px-2 py-1 text-left">ステータス</th>
                    <th className="border px-2 py-1 text-left">メモ</th>
                    <th className="border px-2 py-1 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="border px-2 py-1">{b.id}</td>
                      <td className="border px-2 py-1">
                        {formatDateTime(b.bookingDate)}
                      </td>
                      <td className="border px-2 py-1">
                        {b.timeSlot ?? <span className="text-gray-400">-</span>}
                      </td>
                      <td className="border px-2 py-1">
                        {b.customer
                          ? `${b.customer.lastName} ${b.customer.firstName}`
                          : '-'}
                      </td>
                      <td className="border px-2 py-1">
                        {b.car
                          ? `${b.car.carName}（${b.car.registrationNumber}）`
                          : '-'}
                      </td>
                      <td className="border px-2 py-1">
                        {renderStatusBadge(b.status)}
                      </td>
                      <td className="border px-2 py-1 max-w-xs">
                        <span className="block truncate" title={b.note ?? ''}>
                          {b.note ?? <span className="text-gray-400">-</span>}
                        </span>
                      </td>
                      <td className="border px-2 py-1">
                        <div className="flex flex-wrap gap-1">
                          <button
                            className="px-2 py-0.5 border rounded text-xs bg-green-50 hover:bg-green-100 disabled:opacity-60"
                            onClick={() => updateStatus(b.id, 'CONFIRMED')}
                            disabled={
                              updatingId === b.id || b.status === 'CONFIRMED'
                            }
                          >
                            確定
                          </button>
                          <button
                            className="px-2 py-0.5 border rounded text-xs bg-yellow-50 hover:bg-yellow-100 disabled:opacity-60"
                            onClick={() => updateStatus(b.id, 'PENDING')}
                            disabled={
                              updatingId === b.id || b.status === 'PENDING'
                            }
                          >
                            未確認に戻す
                          </button>
                          <button
                            className="px-2 py-0.5 border rounded text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
                            onClick={() => updateStatus(b.id, 'CANCELED')}
                            disabled={
                              updatingId === b.id || b.status === 'CANCELED'
                            }
                          >
                            キャンセル
                          </button>

                          {/* 予約編集・削除 */}
                          <button
                            className="px-2 py-0.5 border rounded text-xs bg-blue-50 hover:bg-blue-100"
                            type="button"
                            onClick={() => handleEditBookingClick(b)}
                          >
                            編集
                          </button>
                          <button
                            className="px-2 py-0.5 border rounded text-xs bg-red-50 text-red-700 hover:bg-red-100"
                            type="button"
                            onClick={() => handleDeleteBooking(b.id)}
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </TenantLayout>
  );
}
