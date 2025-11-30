"use client";

import { FormEvent, useEffect, useState } from "react";
import TenantLayout from "../components/TenantLayout";

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: "DEVELOPER" | "MANAGER" | "CLIENT";
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

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function CarsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // 新規登録＆編集フォーム（モーダル用）
  const [customerId, setCustomerId] = useState<string>("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [carName, setCarName] = useState("");
  const [shakenDate, setShakenDate] = useState(""); // 車検日（date入力用 YYYY-MM-DD）
  const [inspectionDate, setInspectionDate] = useState(""); // 点検日
  const [customReminderDate, setCustomReminderDate] = useState(""); // 任意日付
  const [customDaysBefore, setCustomDaysBefore] = useState(""); // 任意何日前

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingCarId, setEditingCarId] = useState<number | null>(null);
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);

  // 一括送信用
  const [selectedCarIds, setSelectedCarIds] = useState<number[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastError, setBroadcastError] =
    useState<string | null>(null);
  const [broadcastSuccess, setBroadcastSuccess] =
    useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] =
    useState(false);

  const formatDate = (value?: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("ja-JP");
  };

  const toDateInputValue = (value?: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  const resetFormFields = () => {
    setCustomerId("");
    setRegistrationNumber("");
    setChassisNumber("");
    setCarName("");
    setShakenDate("");
    setInspectionDate("");
    setCustomReminderDate("");
    setCustomDaysBefore("");
  };

  // 初期ロード（auth/me, customers, cars）
  useEffect(() => {
    const savedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;

    if (!savedToken) {
      setPageError("先にログインしてください（トップページからログイン）");
      setLoading(false);
      return;
    }

    setToken(savedToken);

    const headers = { Authorization: `Bearer ${savedToken}` };

    const fetchMe = fetch(`${apiBase}/auth/me`, {
      headers,
    })
      .then((res) => {
        if (!res.ok) throw new Error("auth me error");
        return res.json();
      })
      .then((data: Me) => {
        setMe(data);
      });

    const fetchCustomers = fetch(`${apiBase}/customers`, {
      headers,
    })
      .then((res) => {
        if (!res.ok) throw new Error("customers api error");
        return res.json();
      })
      .then((data: Customer[]) => {
        setCustomers(data);
      });

    const fetchCars = fetch(`${apiBase}/cars`, {
      headers,
    })
      .then((res) => {
        if (!res.ok) throw new Error("cars api error");
        return res.json();
      })
      .then((data: Car[]) => {
        setCars(data);
      });

    Promise.all([fetchMe, fetchCustomers, fetchCars])
      .catch((err) => {
        console.error(err);
        setPageError("初期データの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreateOrUpdateCar = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!token) {
      setFormError("トークンがありません。再ログインしてください。");
      return;
    }

    if (!customerId || !registrationNumber || !chassisNumber || !carName) {
      setFormError("顧客・登録番号・車台番号・車名はすべて必須です");
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
      if (customDaysBefore)
        body.customDaysBefore = Number(customDaysBefore);

      if (editingCarId == null) {
        // 新規登録
        const res = await fetch(`${apiBase}/cars`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const msg =
            data?.message ||
            (Array.isArray(data?.message)
              ? data.message.join(", ")
              : null) ||
            "車両の登録に失敗しました";
          throw new Error(msg);
        }

        const created: Car = await res.json();
        setCars((prev) => [...prev, created]);
        setFormSuccess("車両を登録しました");
        resetFormFields();
        setIsCarModalOpen(false);
      } else {
        // 編集更新
        const res = await fetch(
          `${apiBase}/cars/${editingCarId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const msg =
            data?.message ||
            (Array.isArray(data?.message)
              ? data.message.join(", ")
              : null) ||
            "車両情報の更新に失敗しました";
          throw new Error(msg);
        }

        const updated: Car = await res.json();
        setCars((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
        setFormSuccess("車両情報を更新しました");
        setEditingCarId(null);
        resetFormFields();
        setIsCarModalOpen(false);
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message ?? "車両の登録・更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (car: Car) => {
    setEditingCarId(car.id);
    setFormError(null);
    setFormSuccess(null);

    setCustomerId(String(car.customerId));
    setRegistrationNumber(car.registrationNumber);
    setChassisNumber(car.chassisNumber);
    setCarName(car.carName);

    setShakenDate(toDateInputValue(car.shakenDate));
    setInspectionDate(toDateInputValue(car.inspectionDate));
    setCustomReminderDate(toDateInputValue(car.customReminderDate));
    setCustomDaysBefore(
      car.customDaysBefore != null ? String(car.customDaysBefore) : "",
    );

    setIsCarModalOpen(true);
  };

  const openNewCarModal = () => {
    setEditingCarId(null);
    resetFormFields();
    setFormError(null);
    setFormSuccess(null);
    setIsCarModalOpen(true);
  };

  const closeCarModal = () => {
    setIsCarModalOpen(false);
    setEditingCarId(null);
    resetFormFields();
    setFormError(null);
    setFormSuccess(null);
  };

  const handleDeleteClick = async (id: number) => {
  if (!token) {
    setFormError("トークンがありません。再ログインしてください。");
    return;
  }

  const ok = window.confirm(
    "この車両を削除します。\n\n" +
      "※今日以降に「確定」ステータスの予約がある場合は削除できません。\n" +
      "　その場合は対象の予約を変更または削除してから、再度お試しください。\n\n" +
      "本当に削除してよろしいですか？",
  );
  if (!ok) return;

  try {
    const res = await fetch(`${apiBase}/cars/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const msg =
        data?.message ||
        (Array.isArray(data?.message)
          ? data.message.join(", ")
          : null) ||
        "車両の削除に失敗しました";

      // ★ バックエンドからの注意メッセージを直接表示
      alert(msg);
      throw new Error(msg);
    }

    setCars((prev) => prev.filter((c) => c.id !== id));
    if (editingCarId === id) {
      closeCarModal();
    }
    setFormSuccess("車両を削除しました");
  } catch (err: any) {
    console.error(err);
    setFormError(err.message ?? "車両の削除に失敗しました");
  }
};


  // チェックボックス ON/OFF
  const toggleCarSelection = (id: number) => {
    setSelectedCarIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // 全選択 / 全解除（customersページと合わせた操作）
  const handleToggleSelectAll = () => {
    setSelectedCarIds((prev) => {
      if (prev.length === cars.length) {
        return [];
      }
      return cars.map((c) => c.id);
    });
  };

  const handleBroadcast = async () => {
    setBroadcastError(null);
    setBroadcastSuccess(null);

    if (!token) {
      setBroadcastError("トークンがありません。再ログインしてください。");
      return;
    }
    if (selectedCarIds.length === 0) {
      setBroadcastError("送信対象の車両を1件以上選択してください。");
      return;
    }
    if (!broadcastMessage.trim()) {
      setBroadcastError("メッセージ内容を入力してください。");
      return;
    }

    setBroadcasting(true);
    try {
      const res = await fetch(
        `${apiBase}/messages/send-to-cars`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
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
          (Array.isArray(data?.message)
            ? data.message.join(", ")
            : null) ||
          "メッセージの送信に失敗しました";
        throw new Error(msg);
      }

      const result = await res.json();
      setBroadcastSuccess(
        `送信が完了しました（${result.sentCount}件 / 対象 ${result.targetCount}件）`,
      );
      setSelectedCarIds([]);
      setBroadcastMessage("");
      setIsBroadcastModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setBroadcastError(err.message ?? "メッセージの送信に失敗しました");
    } finally {
      setBroadcasting(false);
    }
  };

  const openBroadcastModal = () => {
    setBroadcastError(null);
    setBroadcastSuccess(null);

    if (selectedCarIds.length === 0) {
      setBroadcastError("送信対象の車両を1件以上選択してください。");
      return;
    }

    setIsBroadcastModalOpen(true);
  };

  const closeBroadcastModal = () => {
    setIsBroadcastModalOpen(false);
    setBroadcastError(null);
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="max-w-6xl mx-auto py-10 text-sm text-gray-800">
          読み込み中...
        </div>
      </TenantLayout>
    );
  }

  if (pageError) {
    return (
      <TenantLayout>
        <div className="max-w-3xl mx-auto mt-8">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 whitespace-pre-wrap">
            {pageError}
          </div>
        </div>
      </TenantLayout>
    );
  }

  // メインUI（customersページと同じレイアウト感）
  return (
    <TenantLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mt-4">
          <div>
            <h1 className="text-3xl font-extrabold text-green-700 tracking-wide drop-shadow-sm">
              車両管理
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-600 mt-1">
              顧客に紐づく車両情報の登録・編集、一括メッセージ送信ができます。LINE車検リマインドの対象車両をここで管理します。
            </p>
          </div>

          {me && (
            <div className="text-xs text-gray-600 text-right space-y-1">
              <div>
                ログイン中:{" "}
                <span className="font-medium text-gray-900">
                  {me.name ?? me.email}
                </span>
              </div>
              <div>
                ロール:{" "}
                <span className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-50 px-2 py-0.5 text-emerald-800 text-[11px]">
                  {me.role === "DEVELOPER"
                    ? "開発者"
                    : me.role === "MANAGER"
                    ? "管理者"
                    : "スタッフ"}
                </span>
              </div>
            </div>
          )}
        </header>

        {/* サマリ + 新規登録ボタン */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-1">
            <div className="text-[11px] font-semibold text-gray-500">
              登録済み車両
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {cars.length}
              </span>
              <span className="text-[11px] text-gray-500">台</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              このテナントで登録されている車両の件数です。
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-1">
            <div className="text-[11px] font-semibold text-gray-500">
              一括送信用に選択中
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {selectedCarIds.length}
              </span>
              <span className="text-[11px] text-gray-500">台</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              下の車両一覧のチェックボックスで選択した車両数です。
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col justify-between gap-2">
            <div className="text-[11px] font-semibold text-gray-500">
              新規車両登録
            </div>
            <p className="text-[11px] text-gray-500">
              顧客に紐づく車両を新しく登録します。顧客はあらかじめ顧客一覧で登録しておいてください。
            </p>
            <div className="mt-1">
              <button
                type="button"
                onClick={openNewCarModal}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 shadow-sm"
              >
                <span className="text-[14px]">＋</span>
                <span>新規車両を登録</span>
              </button>
            </div>
          </div>
        </section>

        {/* 車両一覧 + 一括送信 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">
              車両一覧 & 一括メッセージ送信
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-[11px] text-gray-500">
              <span>
                送信したい車両にチェックを入れて、「選択した車両の顧客にメッセージ送信」をクリックしてください。
              </span>
            </div>
          </div>

          {/* 一括送信トリガー */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-[11px] text-gray-600 flex items-center gap-2">
              <span>
                選択中:{" "}
                <span className="font-semibold text-emerald-700">
                  {selectedCarIds.length}件
                </span>
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="inline-flex items-center gap-1 rounded-md border border-gray-400 bg-white hover:bg-gray-100 px-2 py-1 text-[11px]"
              >
                {selectedCarIds.length === cars.length && cars.length > 0
                  ? "すべて解除"
                  : "すべて選択"}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              {broadcastError && (
                <span className="text-[11px] text-red-600">
                  {broadcastError}
                </span>
              )}
              {broadcastSuccess && (
                <span className="text-[11px] text-emerald-700">
                  {broadcastSuccess}
                </span>
              )}
              <button
                type="button"
                onClick={openBroadcastModal}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 shadow-sm disabled:opacity-60"
                disabled={broadcasting}
              >
                🚗 選択した車両の顧客にメッセージ送信
              </button>
            </div>
          </div>

          {/* 車両一覧テーブル */}
          {cars.length === 0 ? (
            <p className="text-xs text-gray-600">
              まだ車両が登録されていません。
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[520px] border rounded-lg">
              <table className="min-w-full text-[11px] sm:text-xs">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="border px-2 py-1 w-8">
                      <span className="sr-only">選択</span>
                    </th>
                    <th className="border px-2 py-1 text-left w-12">
                      ID
                    </th>
                    <th className="border px-2 py-1 text-left">
                      顧客
                    </th>
                    <th className="border px-2 py-1 text-left">
                      車両名
                    </th>
                    <th className="border px-2 py-1 text-left">
                      登録番号
                    </th>
                    <th className="border px-2 py-1 text-left">
                      車台番号
                    </th>
                    <th className="border px-2 py-1 text-left">
                      車検日
                    </th>
                    <th className="border px-2 py-1 text-left">
                      点検日
                    </th>
                    <th className="border px-2 py-1 text-left">
                      任意日付
                    </th>
                    <th className="border px-2 py-1 text-left w-28">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cars.map((car) => {
                    const selected = selectedCarIds.includes(car.id);
                    const customerName = `${car.customer.lastName} ${car.customer.firstName}`;
                    return (
                      <tr
                        key={car.id}
                        className="hover:bg-gray-50 text-gray-900"
                      >
                        <td className="border px-2 py-1 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleCarSelection(car.id)}
                          />
                        </td>
                        <td className="border px-2 py-1 align-middle">
                          {car.id}
                        </td>
                        <td className="border px-2 py-1 align-middle whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span>{customerName}</span>
                            <span className="text-[10px] text-gray-500">
                              {car.customer.lineUid
                                ? "LINE連携済"
                                : "LINE未連携"}
                            </span>
                          </div>
                        </td>
                        <td className="border px-2 py-1 align-middle whitespace-nowrap">
                          {car.carName}
                        </td>
                        <td className="border px-2 py-1 align-middle whitespace-nowrap">
                          {car.registrationNumber}
                        </td>
                        <td className="border px-2 py-1 align-middle whitespace-nowrap">
                          {car.chassisNumber}
                        </td>
                        <td className="border px-2 py-1 align-middle whitespace-nowrap">
                          {car.shakenDate ? (
                            <span>{formatDate(car.shakenDate)}</span>
                          ) : (
                            <span className="text-gray-400">未設定</span>
                          )}
                        </td>
                        <td className="border px-2 py-1 align-middle whitespace-nowrap">
                          {car.inspectionDate ? (
                            <span>{formatDate(car.inspectionDate)}</span>
                          ) : (
                            <span className="text-gray-400">未設定</span>
                          )}
                        </td>
                        <td className="border px-2 py-1 align-middle whitespace-nowrap">
                          {car.customReminderDate ? (
                            <>
                              <span>
                                {formatDate(car.customReminderDate)}
                              </span>
                              {car.customDaysBefore != null && (
                                <span className="text-[10px] text-gray-500 ml-1">
                                  / {car.customDaysBefore}日前
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400">未設定</span>
                          )}
                        </td>
                        <td className="border px-2 py-1 align-middle">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditClick(car)}
                              className="px-2 py-0.5 border border-gray-400 rounded-md text-[10px] hover:bg-gray-100 bg-white"
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(car.id)}
                              className="px-2 py-0.5 border border-red-500 rounded-md text-[10px] text-red-700 hover:bg-red-50 bg-white"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* 車両登録／編集モーダル */}
      {isCarModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
              {editingCarId == null
                ? "新規車両の登録"
                : `車両情報の編集（ID: ${editingCarId}）`}
            </h3>

            {formError && (
              <div className="mb-2 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-[11px] text-red-800">
                {formError}
              </div>
            )}

            <form
              className="space-y-3 text-[12px] sm:text-sm"
              onSubmit={handleCreateOrUpdateCar}
            >
              <div>
                <label className="block text-xs font-medium mb-1">
                  顧客 <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
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
                <label className="block text-xs font-medium mb-1">
                  登録番号（例: 福岡333は1234）{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  車台番号（例: VZR-1234568）{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  車名（例: トヨタ ハイエース）{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                  value={carName}
                  onChange={(e) => setCarName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    車検日
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                    value={shakenDate}
                    onChange={(e) => setShakenDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    点検日
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    任意日付
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                    value={customReminderDate}
                    onChange={(e) =>
                      setCustomReminderDate(e.target.value)
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    任意日付の何日前に通知するか
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                    value={customDaysBefore}
                    onChange={(e) =>
                      setCustomDaysBefore(e.target.value)
                    }
                  />
                </div>
              </div>

              {formSuccess && (
                <div className="text-[11px] text-emerald-700">
                  {formSuccess}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCarModal}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-md border border-gray-500 text-xs sm:text-sm text-gray-900 bg-white hover:bg-gray-100"
                >
                  閉じる
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-md bg-emerald-600 text-xs sm:text-sm text-white font-semibold hover:bg-emerald-700 disabled:bg-emerald-300"
                >
                  {submitting
                    ? "処理中..."
                    : editingCarId == null
                    ? "車両を登録"
                    : "車両情報を更新"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 一括送信モーダル */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
              一括メッセージ送信
            </h3>
            <p className="text-xs text-gray-600 mb-2">
              選択中の車両{" "}
              <span className="font-semibold text-emerald-700">
                {selectedCarIds.length}件
              </span>
              の顧客にメッセージを送信します。
            </p>

            {broadcastError && (
              <div className="mb-2 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-[11px] text-red-800">
                {broadcastError}
              </div>
            )}

            <label className="block text-xs font-medium mb-1">
              送信内容
            </label>
            <textarea
              className="w-full rounded-md border border-gray-500 px-2 py-2 text-[12px] sm:text-sm min-h-[120px] resize-y"
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="ここにLINEで送りたいメッセージを入力"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeBroadcastModal}
                disabled={broadcasting}
                className="px-3 py-1.5 rounded-md border border-gray-500 text-xs sm:text-sm text-gray-900 bg-white hover:bg-gray-100"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={handleBroadcast}
                disabled={broadcasting}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-xs sm:text-sm text-white font-semibold hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                {broadcasting ? "送信中..." : "この内容で送信"}
              </button>
            </div>
          </div>
        </div>
      )}
    </TenantLayout>
  );
}
