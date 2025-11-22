'use client';

import { FormEvent, useEffect, useState } from 'react';
import TenantLayout from "../components/TenantLayout";

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: 'DEVELOPER' | 'MANAGER' | 'CLIENT';
};

type Customer = {
  id: number;
  lastName: string;
  firstName: string;
};

type Car = {
  id: number;
  tenantId: number;
  customerId: number;
  registrationNumber: string;
  chassisNumber: string;
  carName: string;
  shakenDate?: string | null;
  inspectionDate?: string | null;
  customReminderDate?: string | null;
  customDaysBefore?: number | null;
  customer: {
    id: number;
    lastName: string;
    firstName: string;
    lineUid?: string | null;
  };
};

export default function CarsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // 新規登録フォーム
  const [customerId, setCustomerId] = useState<string>('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [carName, setCarName] = useState('');
  const [shakenDate, setShakenDate] = useState(''); // 車検日
  const [inspectionDate, setInspectionDate] = useState(''); // 点検日
  const [customReminderDate, setCustomReminderDate] = useState(''); // 任意日付
  const [customDaysBefore, setCustomDaysBefore] = useState(''); // 任意何日前

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ★ 一括送信用
  const [selectedCarIds, setSelectedCarIds] = useState<number[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);

  const formatDate = (value?: string | null) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ja-JP');
  };

  // 初期ロード
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

    const fetchMe = fetch('http://localhost:4000/auth/me', {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('auth me error');
        return res.json();
      })
      .then((data: Me) => {
        setMe(data);
      });

    const fetchCustomers = fetch('http://localhost:4000/customers', {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('customers api error');
        return res.json();
      })
      .then((data: Customer[]) => {
        setCustomers(data);
      });

    const fetchCars = fetch('http://localhost:4000/cars', {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('cars api error');
        return res.json();
      })
      .then((data: Car[]) => {
        setCars(data);
      });

    Promise.all([fetchMe, fetchCustomers, fetchCars])
      .catch((err) => {
        console.error(err);
        setPageError('初期データの取得に失敗しました');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreateCar = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!token) {
      setFormError('トークンがありません。再ログインしてください。');
      return;
    }

    if (!customerId || !registrationNumber || !chassisNumber || !carName) {
      setFormError('顧客・登録番号・車台番号・車名はすべて必須です');
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        customerId: Number(customerId),
        registrationNumber,
        chassisNumber,
        carName,
      };

      if (shakenDate) body.shakenDate = shakenDate;
      if (inspectionDate) body.inspectionDate = inspectionDate;
      if (customReminderDate) body.customReminderDate = customReminderDate;
      if (customDaysBefore) body.customDaysBefore = Number(customDaysBefore);

      const res = await fetch('http://localhost:4000/cars', {
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
          '車両の登録に失敗しました';
        throw new Error(msg);
      }

      const created: Car = await res.json();
      setCars((prev) => [...prev, created]);

      setFormSuccess('車両を登録しました');
      setCustomerId('');
      setRegistrationNumber('');
      setChassisNumber('');
      setCarName('');
      setShakenDate('');
      setInspectionDate('');
      setCustomReminderDate('');
      setCustomDaysBefore('');
    } catch (err: any) {
      console.error(err);
      setFormError(err.message ?? '車両の登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  // ★ チェックボックス ON/OFF
  const toggleCarSelection = (id: number) => {
    setSelectedCarIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleBroadcast = async () => {
    setBroadcastError(null);
    setBroadcastSuccess(null);

    if (!token) {
      setBroadcastError('トークンがありません。再ログインしてください。');
      return;
    }
    if (selectedCarIds.length === 0) {
      setBroadcastError('送信対象の車両を1件以上選択してください。');
      return;
    }
    if (!broadcastMessage.trim()) {
      setBroadcastError('メッセージ内容を入力してください。');
      return;
    }

    setBroadcasting(true);
    try {
      const res = await fetch(
        'http://localhost:4000/messages/send-to-cars',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            carIds: selectedCarIds,
            message: broadcastMessage,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data?.message ||
          (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
          'メッセージの送信に失敗しました';
        throw new Error(msg);
      }

      const result = await res.json();
      setBroadcastSuccess(
        `送信が完了しました（${result.sentCount}件 / 対象 ${result.targetCount}件）`,
      );
      setSelectedCarIds([]);
      setBroadcastMessage('');
    } catch (err: any) {
      console.error(err);
      setBroadcastError(err.message ?? 'メッセージの送信に失敗しました');
    } finally {
      setBroadcasting(false);
    }
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
        <div className="border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
          <p className="font-semibold mb-2">エラー</p>
          <p className="text-sm">{pageError}</p>
        </div>
      </main>
    );
  }

  return (
    <TenantLayout>
    <main className="min-h-screen flex flex-col items-center p-4 gap-6">
      <h1 className="text-2xl font-bold mt-4">車両管理</h1>

      {me && (
        <div className="border rounded-md px-4 py-3 bg-gray-50 w-full max-w-3xl">
          <p>
            ログイン中: {me.name ?? me.email}（ロール: {me.role}）
          </p>
        </div>
      )}

      {/* 車両登録フォーム */}
      <section className="border rounded-md px-4 py-4 w-full max-w-3xl bg-white">
        <h2 className="font-semibold mb-3">車両新規登録</h2>
        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
          onSubmit={handleCreateCar}
        >
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">
              顧客 <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
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
            <label className="block text-sm mb-1">
              登録番号（例: 福岡333は1234） <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">
              車台番号（例: VZR-1234568） <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={chassisNumber}
              onChange={(e) => setChassisNumber(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">
              車名（例: トヨタ ハイエース） <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={carName}
              onChange={(e) => setCarName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">車検日</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1 text-sm"
              value={shakenDate}
              onChange={(e) => setShakenDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">点検日</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1 text-sm"
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">任意日付</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1 text-sm"
              value={customReminderDate}
              onChange={(e) => setCustomReminderDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">任意日付の何日前に通知するか</label>
            <input
              type="number"
              className="w-full border rounded px-2 py-1 text-sm"
              value={customDaysBefore}
              onChange={(e) => setCustomDaysBefore(e.target.value)}
              min={0}
            />
          </div>

          {formError && (
            <div className="md:col-span-2 text-sm text-red-600">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="md:col-span-2 text-sm text-green-600">
              {formSuccess}
            </div>
          )}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1 border rounded-md text-sm bg-gray-100 disabled:opacity-60"
            >
              {submitting ? '登録中...' : '登録'}
            </button>
          </div>
        </form>
      </section>

      {/* 一括送信エリア */}
      <section className="border rounded-md px-4 py-4 w-full max-w-3xl bg-white">
        <h2 className="font-semibold mb-3">選択した車両の顧客への一括メッセージ送信</h2>
        <p className="text-xs text-gray-600 mb-2">
          車両に紐づく顧客の LINE UID が登録されている場合のみ送信されます。
        </p>
        <textarea
          className="w-full border rounded px-2 py-1 text-sm h-24"
          placeholder="送信したいメッセージを入力してください"
          value={broadcastMessage}
          onChange={(e) => setBroadcastMessage(e.target.value)}
        />
        {broadcastError && (
          <p className="text-sm text-red-600 mt-2">{broadcastError}</p>
        )}
        {broadcastSuccess && (
          <p className="text-sm text-green-600 mt-2">{broadcastSuccess}</p>
        )}
        <button
          type="button"
          onClick={handleBroadcast}
          disabled={broadcasting}
          className="mt-2 px-4 py-1 border rounded-md text-sm bg-gray-100 disabled:opacity-60"
        >
          {broadcasting ? '送信中...' : '選択した車両の顧客に送信'}
        </button>
        <p className="text-xs text-gray-500 mt-1">
          選択中の車両: {selectedCarIds.length}件
        </p>
      </section>

      {/* 車両一覧 */}
      <section className="border rounded-md px-4 py-4 w-full max-w-3xl bg-gray-50">
        <h2 className="font-semibold mb-3">車両一覧</h2>
        {cars.length === 0 && (
          <p className="text-sm text-gray-600">
            まだ車両が登録されていません。
          </p>
        )}
        <div className="space-y-2">
          {cars.map((car) => {
            const selected = selectedCarIds.includes(car.id);
            return (
              <div
                key={car.id}
                className="border-b last:border-b-0 py-2 text-sm flex flex-col gap-1"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleCarSelection(car.id)}
                  />
                  <span className="font-semibold">
                    {car.carName}（{car.registrationNumber}）
                  </span>
                </div>
                <div className="text-gray-700 ml-6">
                  車台番号: {car.chassisNumber}
                </div>
                <div className="text-xs text-gray-500 ml-6">
                  顧客: {car.customer.lastName} {car.customer.firstName}
                  {car.customer.lineUid ? (
                    <span className="ml-2 text-green-700">
                      （LINE連携済）
                    </span>
                  ) : (
                    <span className="ml-2 text-red-500">（LINE未連携）</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 ml-6">
                  車検日:{' '}
                  {car.shakenDate ? (
                    <span>{formatDate(car.shakenDate)}</span>
                  ) : (
                    <span className="text-gray-400">未設定</span>
                  )}
                  {' / '}
                  点検日:{' '}
                  {car.inspectionDate ? (
                    <span>{formatDate(car.inspectionDate)}</span>
                  ) : (
                    <span className="text-gray-400">未設定</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 ml-6">
                  任意日付:{' '}
                  {car.customReminderDate ? (
                    <span>{formatDate(car.customReminderDate)}</span>
                  ) : (
                    <span className="text-gray-400">未設定</span>
                  )}
                  {car.customReminderDate && (
                    <>
                      {' '}
                      / {car.customDaysBefore ?? 0}日前通知
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
    </TenantLayout>
  );
}
