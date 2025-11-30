"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import TenantLayout from "../components/TenantLayout";

type Customer = {
  id: number;
  lastName: string;
  firstName: string;
  postalCode?: string | null;
  address1?: string | null;
  address2?: string | null;
  mobilePhone?: string | null;
  lineUid?: string | null;
  birthday?: string | null;
};

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: "DEVELOPER" | "MANAGER" | "CLIENT";
};

type BroadcastLog = {
  id: number;
  message: string;
  sentCount: number;
  targetCount: number;
  createdAt: string; // ISO
};

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// 30日(だいたい)のミリ秒
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

export default function CustomersPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規登録＆編集フォーム用 state（モーダルで使う）
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [lineUid, setLineUid] = useState("");
  const [birthday, setBirthday] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(
    null,
  );
  const [isCustomerModalOpen, setIsCustomerModalOpen] =
    useState(false);

  // 一括送信用 state（モーダル）
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<
    number[]
  >([]);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastError, setBroadcastError] =
    useState<string | null>(null);
  const [broadcastSuccess, setBroadcastSuccess] =
    useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] =
    useState(false);

  // 10秒カウントダウン
  const [countdown, setCountdown] = useState<number>(0);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const countdownTimerRef = useRef<number | null>(null);

  // 送信履歴（localStorageに保存）
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLog[]>(
    [],
  );

  // ----- 初回ロード：auth/me → customers -----
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      const savedToken =
        typeof window !== "undefined"
          ? window.localStorage.getItem("auth_token")
          : null;

      if (!savedToken) {
        setLoading(false);
        setError("先にログインしてください（トップページからログイン）");
        return;
      }

      setToken(savedToken);
      const headers = { Authorization: `Bearer ${savedToken}` };

      try {
        // ① /auth/me
        const meRes = await fetch(`${apiBase}/auth/me`, {
          headers,
        });

        if (!meRes.ok) {
          const data = await meRes.json().catch(() => null);
          let msg: string = "ログイン情報の取得に失敗しました";
          const m = (data as any)?.message;
          if (typeof m === "string") {
            msg = m;
          } else if (Array.isArray(m) && m[0]) {
            msg = String(m[0]);
          }
          setError(msg);
          setLoading(false);
          return;
        }

        const meData: Me = await meRes.json();
        setMe(meData);

        // ② 顧客一覧
        const customersRes = await fetch(`${apiBase}/customers`, {
          headers,
        });

        if (!customersRes.ok) {
          const data = await customersRes.json().catch(() => null);
          let msg: string = "顧客一覧の取得に失敗しました";
          const m = (data as any)?.message;
          if (typeof m === "string") {
            msg = m;
          } else if (Array.isArray(m) && m[0]) {
            msg = String(m[0]);
          }
          throw new Error(msg);
        }

        const data: Customer[] = await customersRes.json();
        setCustomers(data);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "顧客一覧の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  // ----- 送信履歴を localStorage から読み込む -----
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(
        "pitlink_broadcast_logs",
      );
      if (!raw) return;
      const parsed: BroadcastLog[] = JSON.parse(raw);
      const now = Date.now();
      // 1か月より古いものは捨てる
      const filtered = parsed.filter(
        (log) =>
          now - new Date(log.createdAt).getTime() < THIRTY_DAYS_MS,
      );
      setBroadcastLogs(filtered);
      window.localStorage.setItem(
        "pitlink_broadcast_logs",
        JSON.stringify(filtered),
      );
    } catch (e) {
      console.error("Failed to load broadcast logs", e);
    }
  }, []);

  // ----- 送信履歴の変更を localStorage へ反映 -----
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "pitlink_broadcast_logs",
        JSON.stringify(broadcastLogs),
      );
    } catch (e) {
      console.error("Failed to save broadcast logs", e);
    }
  }, [broadcastLogs]);

  // ----- アンマウント時にタイマー掃除 -----
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current != null) {
        window.clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // 日付表示
  const formatDate = (value?: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("ja-JP");
  };

  const formatDateTime = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("ja-JP");
  };

  // フォームリセット
  const resetFormFields = () => {
    setLastName("");
    setFirstName("");
    setPostalCode("");
    setAddress1("");
    setAddress2("");
    setMobilePhone("");
    setLineUid("");
    setBirthday("");
  };

  // ----- 顧客登録／更新（モーダル内フォーム） -----
  const handleCreateOrUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!token) {
      setFormError("トークンがありません。再度ログインしてください。");
      return;
    }

    if (!lastName || !firstName || !mobilePhone) {
      setFormError("姓・名・携帯番号は必須です");
      return;
    }

    const payload = {
      lastName,
      firstName,
      postalCode: postalCode || undefined,
      address1: address1 || undefined,
      address2: address2 || undefined,
      mobilePhone: mobilePhone || undefined,
      lineUid: lineUid || undefined,
      birthday: birthday || undefined,
    };

    try {
      if (editingCustomerId == null) {
        // 新規登録
        const res = await fetch(`${apiBase}/customers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          let msg: string = "顧客の登録に失敗しました";
          if (data?.message) {
            msg = Array.isArray(data.message)
              ? data.message.join(", ")
              : String(data.message);
          }
          throw new Error(msg);
        }

        const created: Customer = await res.json();
        setCustomers((prev) => [...prev, created]);
        setFormSuccess("顧客を登録しました");
        resetFormFields();
        setIsCustomerModalOpen(false);
      } else {
        // 更新
        const res = await fetch(
          `${apiBase}/customers/${editingCustomerId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          let msg: string = "顧客情報の更新に失敗しました";
          if (data?.message) {
            msg = Array.isArray(data.message)
              ? data.message.join(", ")
              : String(data.message);
          }
          throw new Error(msg);
        }

        const updated: Customer = await res.json();
        setCustomers((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
        setFormSuccess("顧客情報を更新しました");
        setEditingCustomerId(null);
        resetFormFields();
        setIsCustomerModalOpen(false);
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message ?? "顧客の登録・更新に失敗しました");
    }
  };

  const openNewCustomerModal = () => {
    setEditingCustomerId(null);
    resetFormFields();
    setFormError(null);
    setFormSuccess(null);
    setIsCustomerModalOpen(true);
  };

  const handleEditClick = (c: Customer) => {
    setEditingCustomerId(c.id);
    setFormError(null);
    setFormSuccess(null);

    setLastName(c.lastName ?? "");
    setFirstName(c.firstName ?? "");
    setPostalCode(c.postalCode ?? "");
    setAddress1(c.address1 ?? "");
    setAddress2(c.address2 ?? "");
    setMobilePhone(c.mobilePhone ?? "");
    setLineUid(c.lineUid ?? "");

    if (c.birthday) {
      try {
        const d = new Date(c.birthday);
        if (!Number.isNaN(d.getTime())) {
          setBirthday(d.toISOString().slice(0, 10));
        } else {
          setBirthday("");
        }
      } catch {
        setBirthday("");
      }
    } else {
      setBirthday("");
    }

    setIsCustomerModalOpen(true);
  };

  const closeCustomerModal = () => {
    setIsCustomerModalOpen(false);
    setEditingCustomerId(null);
    resetFormFields();
    setFormError(null);
    setFormSuccess(null);
  };

  // 削除
  const handleDeleteClick = async (id: number) => {
    if (!token) {
      setFormError("トークンがありません。再ログインしてください。");
      return;
    }

    const ok = window.confirm("この顧客を削除してもよろしいですか？");
    if (!ok) return;

    try {
      const res = await fetch(`${apiBase}/customers/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        let msg: string = "顧客の削除に失敗しました";
        if (data?.message) {
          msg = Array.isArray(data.message)
            ? data.message.join(", ")
            : String(data.message);
        }
        throw new Error(msg);
      }

      setCustomers((prev) => prev.filter((c) => c.id !== id));
      if (editingCustomerId === id) {
        closeCustomerModal();
      }
      setFormSuccess("顧客を削除しました");
    } catch (err: any) {
      console.error(err);
      setFormError(err.message ?? "顧客の削除に失敗しました");
    }
  };

  // チェックボックス
  const toggleCustomerSelection = (id: number) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

 // ★ 一括チェック / 解除
  const handleToggleSelectAll = () => {
    setSelectedCustomerIds((prev) => {
      if (prev.length === customers.length) {
        // 全選択済み → 全解除
        return [];
      }
      // まだ一部 or 0件 → 全選択
      return customers.map((c) => c.id);
    });
  };  

  // 一括送信モーダルを開く
  const openBroadcastModal = () => {
    setBroadcastError(null);
    setBroadcastSuccess(null);
    setCountdown(0);
    setIsCountingDown(false);

    if (selectedCustomerIds.length === 0) {
      setBroadcastError("送信先の顧客を1件以上選択してください。");
      return;
    }

    setIsBroadcastModalOpen(true);
  };

  const closeBroadcastModal = () => {
    setIsBroadcastModalOpen(false);
    setBroadcastError(null);
    setCountdown(0);
    setIsCountingDown(false);
    if (countdownTimerRef.current != null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  // ★ カウントダウン後に実際に送信する処理
  const actuallySendBroadcast = async () => {
    if (!token) {
      setBroadcastError("トークンがありません。再ログインしてください。");
      return;
    }
    if (selectedCustomerIds.length === 0) {
      setBroadcastError("送信先の顧客を1件以上選択してください。");
      return;
    }
    if (!broadcastMessage.trim()) {
      setBroadcastError("メッセージ内容を入力してください。");
      return;
    }

    setBroadcasting(true);
    try {
      const res = await fetch(
        `${apiBase}/messages/send-to-customers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            customerIds: selectedCustomerIds,
            message: broadcastMessage,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        let msg: string = "メッセージの送信に失敗しました";
        if (data?.message) {
          msg = Array.isArray(data.message)
            ? data.message.join(", ")
            : String(data.message);
        }
        throw new Error(msg);
      }

      const result = await res.json();
      const sentCount = result.sentCount ?? selectedCustomerIds.length;
      const targetCount = result.targetCount ?? selectedCustomerIds.length;

      const nowIso = new Date().toISOString();
      setBroadcastLogs((prev) => {
        // 1か月より古いものを削除しつつ先頭に追加
        const now = Date.now();
        const kept = prev.filter(
          (log) =>
            now - new Date(log.createdAt).getTime() <
            THIRTY_DAYS_MS,
        );
        return [
          {
            id: Date.now(),
            message: broadcastMessage,
            sentCount,
            targetCount,
            createdAt: nowIso,
          },
          ...kept,
        ];
      });

      setBroadcastSuccess(
        `送信が完了しました（${sentCount}件 / 対象 ${targetCount}件）`,
      );
      setSelectedCustomerIds([]);
      setBroadcastMessage("");
      setIsBroadcastModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setBroadcastError(
        err.message ?? "メッセージの送信に失敗しました",
      );
    } finally {
      setBroadcasting(false);
      setIsCountingDown(false);
      setCountdown(0);
      if (countdownTimerRef.current != null) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }
  };

  // モーダル内「送信」ボタン → カウントダウン開始
  const handleBroadcastModalSend = () => {
    setBroadcastError(null);
    setBroadcastSuccess(null);

    if (!broadcastMessage.trim()) {
      setBroadcastError("メッセージ内容を入力してください。");
      return;
    }
    if (selectedCustomerIds.length === 0) {
      setBroadcastError("送信先の顧客を1件以上選択してください。");
      return;
    }

    // すでにカウントダウン中なら何もしない
    if (isCountingDown) return;

    setIsCountingDown(true);
    let remaining = 10;
    setCountdown(remaining);

    const timerId = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        window.clearInterval(timerId);
        countdownTimerRef.current = null;
        actuallySendBroadcast();
      }
    }, 1000);

    countdownTimerRef.current = timerId;
  };

  // ----- ローディング／エラー表示 -----
  if (loading) {
    return (
      <TenantLayout>
        <div className="max-w-6xl mx-auto py-10 text-sm text-gray-800">
          読み込み中...
        </div>
      </TenantLayout>
    );
  }

  if (error) {
    return (
      <TenantLayout>
        <div className="max-w-3xl mx-auto mt-8">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 whitespace-pre-wrap">
            {error}
          </div>
        </div>
      </TenantLayout>
    );
  }

  // ----- メインUI -----
  return (
    <TenantLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mt-4">
          <div>
            <h1 className="text-3xl font-extrabold text-green-700 tracking-wide drop-shadow-sm">
              顧客管理
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-600 mt-1">
              顧客情報の登録・編集、一括メッセージ送信ができます。LINE車検リマインドのベースとなる名簿です。
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
              登録済み顧客
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {customers.length}
              </span>
              <span className="text-[11px] text-gray-500">件</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              顧客一覧に表示されている件数です。
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-1">
            <div className="text-[11px] font-semibold text-gray-500">
              一括送信用に選択中
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {selectedCustomerIds.length}
              </span>
              <span className="text-[11px] text-gray-500">件</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              下の顧客一覧のチェックボックスで選択した顧客数です。
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col justify-between gap-2">
            <div className="text-[11px] font-semibold text-gray-500">
              新規顧客登録
            </div>
            <p className="text-[11px] text-gray-500">
              店舗側で把握している顧客を随時追加できます。
            </p>
            <div className="mt-1">
              <button
                type="button"
                onClick={openNewCustomerModal}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 shadow-sm"
              >
                <span className="text-[14px]">＋</span>
                <span>新規顧客を登録</span>
              </button>
            </div>
          </div>
        </section>

        {/* 顧客一覧 + 一括送信 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">
              顧客一覧 & 一括メッセージ送信
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-[11px] text-gray-500">
              <span>
                送信したい顧客にチェックを入れて、「選択した顧客にメッセージ送信」をクリックしてください。
              </span>
            </div>
          </div>

          {/* 一括送信トリガー */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-[11px] text-gray-600">
              選択中:{" "}
              <span className="font-semibold text-emerald-700">
                {selectedCustomerIds.length}件
              </span>

              {/* ★ 一括チェックボタン */}
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="inline-flex items-center gap-1 rounded-md border border-gray-400 bg-white hover:bg-gray-100 px-2 py-1 text-[11px]"
              >
                {selectedCustomerIds.length === customers.length &&
                customers.length > 0
                  ? "すべて解除"
                  : "すべて選択"}
              </button>
            </div>
            <div className="flex items-center gap-2">
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
                📩 選択した顧客にメッセージ送信
              </button>
            </div>
          </div>

          {/* 顧客一覧テーブル */}
          {customers.length === 0 ? (
            <p className="text-xs text-gray-600">
              まだ顧客が登録されていません。
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[480px] border rounded-lg">
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
                      名前
                    </th>
                    <th className="border px-2 py-1 text-left">
                      住所
                    </th>
                    <th className="border px-2 py-1 text-left">
                      携帯番号
                    </th>
                    <th className="border px-2 py-1 text-left">
                      LINE UID
                    </th>
                    <th className="border px-2 py-1 text-left">
                      誕生日
                    </th>
                    <th className="border px-2 py-1 text-left w-28">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const fullAddress =
                      (c.postalCode ? `〒${c.postalCode} ` : "") +
                      (c.address1 ?? "") +
                      (c.address2 ? ` ${c.address2}` : "");

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-gray-50 text-gray-900"
                      >
                        <td className="border px-2 py-1 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={selectedCustomerIds.includes(
                              c.id,
                            )}
                            onChange={() =>
                              toggleCustomerSelection(c.id)
                            }
                          />
                        </td>
                        <td className="border px-2 py-1 align-middle">
                          {c.id}
                        </td>
                        <td className="border px-2 py-1 align-middle whitespace-nowrap">
                          {c.lastName} {c.firstName}
                        </td>
                        <td className="border px-2 py-1 align-middle">
                          {fullAddress}
                        </td>
                        <td className="border px-2 py-1 align-middle whitespace-nowrap">
                          {c.mobilePhone ?? ""}
                        </td>
                        <td className="border px-2 py-1 align-middle">
                          {c.lineUid ?? ""}
                        </td>
                        <td className="border px-2 py-1 align-middle whitespace-nowrap">
                          {formatDate(c.birthday)}
                        </td>
                        <td className="border px-2 py-1 align-middle">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditClick(c)}
                              className="px-2 py-0.5 border border-gray-400 rounded-md text-[10px] hover:bg-gray-100"
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteClick(c.id)
                              }
                              className="px-2 py-0.5 border border-red-500 rounded-md text-[10px] text-red-700 hover:bg-red-50"
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

        {/* 送信履歴（1か月分） */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 mb-6">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
            一括メッセージ送信の履歴（直近1か月）
          </h2>
          {broadcastLogs.length === 0 ? (
            <p className="text-xs text-gray-600">
              まだ送信履歴がありません。顧客を選択して一括メッセージ送信を行うと、ここに履歴が表示されます。
            </p>
          ) : (
            <div className="overflow-x-auto border rounded-lg max-h-[260px]">
              <table className="min-w-full text-[11px] sm:text-xs">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="border px-2 py-1 text-left">
                      送信日時
                    </th>
                    <th className="border px-2 py-1 text-left">
                      送信件数
                    </th>
                    <th className="border px-2 py-1 text-left">
                      メッセージ内容（一部）
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {broadcastLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="border px-2 py-1 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="border px-2 py-1 whitespace-nowrap">
                        {log.sentCount}件 / 対象 {log.targetCount}件
                      </td>
                      <td className="border px-2 py-1">
                        {log.message.length > 40
                          ? log.message.slice(0, 40) + "…"
                          : log.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[10px] text-gray-500">
            ※ この履歴はブラウザごとに保存され、1か月を過ぎたものは自動的に削除されます（サーバ側の正式なログとは別管理です）。
          </p>
        </section>
      </div>

      {/* 顧客登録／編集モーダル */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
              {editingCustomerId == null
                ? "新規顧客の登録"
                : `顧客情報の編集（ID: ${editingCustomerId}）`}
            </h3>

            {formError && (
              <div className="mb-2 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-[11px] text-red-800">
                {formError}
              </div>
            )}

            <form
              className="space-y-3 text-[12px] sm:text-sm"
              onSubmit={handleCreateOrUpdate}
            >
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1">
                    姓 <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1">
                    名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  郵便番号（ハイフンなし）
                </label>
                <input
                  className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="例: 8100001"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  住所（番地まで）
                </label>
                <input
                  className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  placeholder="例: 福岡市中央区天神1-1-1"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  住所（建物名・部屋番号など）
                </label>
                <input
                  className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  placeholder="例: GATCHビル3F"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  携帯番号 <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  placeholder="例: 09012345678"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  ※ 携帯番号が重複している場合は登録不可（サーバ側でチェック）想定。
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  LINE UID（任意）
                </label>
                <input
                  className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                  value={lineUid}
                  onChange={(e) => setLineUid(e.target.value)}
                  placeholder="LINE連携が分かっている場合にセット"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  誕生日（任意）
                </label>
                <input
                  type="date"
                  className="w-full rounded-md border border-gray-500 px-2 py-1.5 text-[12px]"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCustomerModal}
                  className="px-3 py-1.5 rounded-md border border-gray-500 text-xs sm:text-sm text-gray-900 bg-white hover:bg-gray-100"
                >
                  閉じる
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-md bg-emerald-600 text-xs sm:text-sm text-white font-semibold hover:bg-emerald-700"
                >
                  {editingCustomerId == null
                    ? "顧客を登録"
                    : "顧客情報を更新"}
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
              選択中の顧客{" "}
              <span className="font-semibold text-emerald-700">
                {selectedCustomerIds.length}件
              </span>
              にメッセージを送信します。
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

            <div className="mt-3 text-[11px] text-gray-600">
              {isCountingDown ? (
                <span className="text-orange-600 font-semibold">
                  {countdown}秒後に送信します...
                </span>
              ) : (
                <span>
                  「この内容で送信」を押すと10秒間カウントダウンしてから送信します。
                  その間に内容を修正したい場合は「閉じる」でキャンセルしてください。
                </span>
              )}
            </div>

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
                onClick={handleBroadcastModalSend}
                disabled={broadcasting || isCountingDown}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-xs sm:text-sm text-white font-semibold hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                {isCountingDown
                  ? "カウントダウン中..."
                  : "この内容で送信（10秒後）"}
              </button>
            </div>
          </div>
        </div>
      )}
    </TenantLayout>
  );
}
