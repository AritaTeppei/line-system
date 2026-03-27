"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
  lineUid?: string | null;
  mobilePhone?: string | null;
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

type SortKey = "id" | "customer" | "shakenDate" | "inspectionDate" | "customReminderDate";

type BroadcastLog = {
  id: number;
  message: string;
  sentCount: number;
  targetCount: number;
  createdAt: string; // ISO
  customerIds?: number[];
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
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] =
    useState(false);

  // 一括送信ログ（サーバ側 3か月分）
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLog[]>(
    [],
  );
  const [selectedLog, setSelectedLog] = useState<BroadcastLog | null>(
    null,
  );
  const [isLogDetailModalOpen, setIsLogDetailModalOpen] =
    useState(false);
  const [isLogListModalOpen, setIsLogListModalOpen] = useState(false);

  // CSVアップロード関連
  const [csvDragging, setCsvDragging] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

   // 検索・ソート・ページング
 const [searchQuery, setSearchQuery] = useState("");
 const [sortKey, setSortKey] = useState<SortKey>("id");
 const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
 const [page, setPage] = useState(1);
 const pageSize = 20;

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

  // 初期ロード（auth/me, customers, cars, broadcastLogs）
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
        setCustomers(
          data.map((c) => ({
            ...c,
            // 念のため mobilePhone / lineUid が無いケースにも備える
            mobilePhone:
              (c as any).mobilePhone !== undefined
                ? (c as any).mobilePhone
                : null,
            lineUid:
              (c as any).lineUid !== undefined
                ? (c as any).lineUid
                : null,
          })),
        );
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

    const fetchBroadcastLogs = fetch(
      `${apiBase}/messages/broadcast-logs?target=CAR`,
      {
        headers,
      },
    )
      .then((res) => {
        if (!res.ok) throw new Error("broadcast logs api error");
        return res.json();
      })
      .then((data: BroadcastLog[]) => {
        setBroadcastLogs(data);
      });

    Promise.all([fetchMe, fetchCustomers, fetchCars, fetchBroadcastLogs])
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

      // 必須項目はそのまま trim して送る
      registrationNumber: registrationNumber.trim(),
      chassisNumber: chassisNumber.trim(),
      carName: carName.trim(),

      // 日付系・任意項目は「空文字なら null」を明示的に送る
      shakenDate:
        shakenDate.trim() === "" ? null : shakenDate.trim(),
      inspectionDate:
        inspectionDate.trim() === "" ? null : inspectionDate.trim(),
      customReminderDate:
        customReminderDate.trim() === ""
          ? null
          : customReminderDate.trim(),

      // 任意何日前：空欄なら null、数字が入っていれば number に変換
      customDaysBefore:
        customDaysBefore.trim() === ""
          ? null
          : Number(customDaysBefore.trim()),
    };

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

  // 顧客検索用の絞り込み（車両モーダルのセレクト用）
const normalizedCustomerQuery = customerSearchQuery.trim().toLowerCase();
const filteredCustomersForSelect = normalizedCustomerQuery
  ? customers.filter((c) => {
      const name = `${c.lastName ?? ""}${c.firstName ?? ""}`;
      const phone = c.mobilePhone ?? "";
      const lineUid = c.lineUid ?? "";
      const idText = String(c.id);

      const text = [name, phone, lineUid, idText]
        .join(" ")
        .toLowerCase();

      return text.includes(normalizedCustomerQuery);
    })
  : customers;

  const handleEditClick = (car: Car) => {
    setEditingCarId(car.id);
    setFormError(null);
    setFormSuccess(null);

    setCustomerId(String(car.customerId));
    setRegistrationNumber(car.registrationNumber);
    setChassisNumber(car.chassisNumber);
    setCarName(car.carName);
    setCustomerSearchQuery("");
    setIsCarModalOpen(true);

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
    setCustomerSearchQuery("");
    setIsCarModalOpen(true);
  };

  const closeCarModal = () => {
    setCsvError(null);
    setCsvSuccess(null);
    setIsCarModalOpen(false);
    setEditingCarId(null);
    resetFormFields();
    setFormError(null);
    setFormSuccess(null);
  };

  // ──────────────────────────────────────────────────────────────
  // 車検証閲覧アプリ CSV パーサー
  // 標準CSV（1行目ヘッダー）と転置CSV（列1=項目名、列2=値）の両形式に対応
  // UTF-8 BOM / Shift-JIS 両対応
  // ──────────────────────────────────────────────────────────────
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        result.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  };

  const handleCsvFile = async (file: File) => {
    setCsvError(null);
    setCsvSuccess(null);
    try {
      // UTF-8（BOM除去）→ Shift-JIS フォールバック
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
      } catch {
        text = new TextDecoder('shift_jis').decode(buffer);
      }

      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        setCsvError('CSVの形式が正しくありません（データ行がありません）');
        return;
      }

      const firstLineFields = parseCsvLine(lines[0]);

      // 転置形式（列1=項目名、列2=値）の判定: 1行目の2列目にデータがあり、かつ各行が2列程度
      const isTransposed = firstLineFields.length <= 3 && lines.length > 3;

      let reg = '';
      let chassis = '';
      let name = '';

      if (isTransposed) {
        // 転置CSV: 各行が「項目名,値」
        const map: Record<string, string> = {};
        for (const line of lines) {
          const cols = parseCsvLine(line);
          if (cols.length >= 2) map[cols[0].trim()] = cols[1].trim();
        }
        for (const [k, v] of Object.entries(map)) {
          if (!reg && (k.includes('登録番号') || k.includes('ナンバー') || k.includes('車両番号'))) reg = v;
          if (!chassis && k.includes('車台番号')) chassis = v;
          if (!name && k.includes('車名') && !k.includes('番号')) name = v;
        }
      } else {
        // 標準CSV: 1行目ヘッダー、2行目以降データ
        const headers = parseCsvLine(lines[0]);
        const values = parseCsvLine(lines[1]);
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h.trim()] = (values[i] ?? '').trim(); });
        for (const [k, v] of Object.entries(row)) {
          if (!reg && (k.includes('登録番号') || k.includes('ナンバー') || k.includes('車両番号'))) reg = v;
          if (!chassis && k.includes('車台番号')) chassis = v;
          if (!name && k.includes('車名') && !k.includes('番号')) name = v;
        }
      }

      // 全角数字→半角に正規化
      const normalize = (s: string) =>
        s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
         .replace(/[　]+/g, ' ').trim();

      reg = normalize(reg);
      chassis = normalize(chassis);

      if (!reg && !chassis && !name) {
        setCsvError('登録番号・車台番号・車名のいずれも見つかりませんでした。CSVの形式を確認してください。');
        return;
      }

      if (reg) setRegistrationNumber(reg);
      if (chassis) setChassisNumber(chassis);
      if (name) setCarName(name);

      const applied = [reg && '登録番号', chassis && '車台番号', name && '車名'].filter(Boolean).join('・');
      setCsvSuccess(`${applied}を反映しました`);
    } catch {
      setCsvError('ファイルの読み込みに失敗しました。');
    }
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

    // 全選択 / 全解除（このページに表示されている車両のみ）
  const handleToggleSelectAll = () => {
    setSelectedCarIds((prev) => {
      const displayIds = pagedCars.map((c) => c.id);
      if (displayIds.length === 0) return prev;

      const allSelected = displayIds.every((id) => prev.includes(id));
      if (allSelected) {
        // ページ内が全選択 → ページ内だけ解除
        return prev.filter((id) => !displayIds.includes(id));
      }
      // ページ内の未選択を追加
      return Array.from(new Set([...prev, ...displayIds]));
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
      const sentCount =
        result.sentCount ?? selectedCarIds.length;
      const targetCount =
        result.targetCount ?? selectedCarIds.length;

      setBroadcastSuccess(
        `送信が完了しました（${sentCount}件 / 対象 ${targetCount}件）`,
      );
      setSelectedCarIds([]);
      setBroadcastMessage("");
      setIsBroadcastModalOpen(false);

      // ★ 送信後に最新の一括送信ログを再取得（3か月用）
      try {
        const logsRes = await fetch(
          `${apiBase}/messages/broadcast-logs`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (logsRes.ok) {
          const logs: BroadcastLog[] = await logsRes.json();
          setBroadcastLogs(logs);
        }
      } catch (e) {
        console.error("failed to reload broadcast logs", e);
      }
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

  const openLogDetailModal = (log: BroadcastLog) => {
    if (!log.customerIds || log.customerIds.length === 0) {
      window.alert(
        "この履歴には送信先の情報が保存されていません。\nこの機能追加以降の送信から順次記録されます。",
      );
      return;
    }
    setSelectedLog(log);
    setIsLogDetailModalOpen(true);
  };

  const closeLogDetailModal = () => {
    setIsLogDetailModalOpen(false);
    setSelectedLog(null);
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

    // ===== 車両一覧の並び替え・検索・ページング =====
  const sortedCars = [...cars].sort((a, b) => {
    const mul = sortOrder === "asc" ? 1 : -1;

    if (sortKey === "id") {
      return (a.id - b.id) * mul;
    }

    if (sortKey === "customer") {
      const an = `${a.customer.lastName ?? ""}${a.customer.firstName ?? ""}`;
      const bn = `${b.customer.lastName ?? ""}${b.customer.firstName ?? ""}`;
      return an.localeCompare(bn, "ja") * mul;
    }

    if (sortKey === "shakenDate") {
      const ad = a.shakenDate ? new Date(a.shakenDate).getTime() : 0;
      const bd = b.shakenDate ? new Date(b.shakenDate).getTime() : 0;
      return (ad - bd) * mul;
    }

    if (sortKey === "inspectionDate") {
      const ad = a.inspectionDate ? new Date(a.inspectionDate).getTime() : 0;
      const bd = b.inspectionDate ? new Date(b.inspectionDate).getTime() : 0;
      return (ad - bd) * mul;
    }

    if (sortKey === "customReminderDate") {
      const ad = a.customReminderDate ? new Date(a.customReminderDate).getTime() : 0;
      const bd = b.customReminderDate ? new Date(b.customReminderDate).getTime() : 0;
      return (ad - bd) * mul;
    }

    return 0;
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCars = normalizedQuery
    ? sortedCars.filter((car) => {
        const customerName = `${car.customer.lastName ?? ""}${car.customer.firstName ?? ""}`;
        const fields: string[] = [
          String(car.id),
          customerName,
          car.carName,
          car.registrationNumber,
          car.chassisNumber,
        ];

        if (car.shakenDate) fields.push(formatDate(car.shakenDate));
        if (car.inspectionDate) fields.push(formatDate(car.inspectionDate));
        if (car.customReminderDate) fields.push(formatDate(car.customReminderDate));

        const text = fields.join(" ").toLowerCase();
        return text.includes(normalizedQuery);
      })
    : sortedCars;

  const totalPages = Math.max(1, Math.ceil(filteredCars.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedCars = filteredCars.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const allDisplayedSelected =
    pagedCars.length > 0 &&
    pagedCars.every((c) => selectedCarIds.includes(c.id));

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

  // メインUI
  return (
    <TenantLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mt-4">
          <div>
            <h1 className="text-2xl font-extrabold text-green-700 flex items-center gap-2">
              🚗 車両管理
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              顧客に紐づく車両情報の登録・編集、一括メッセージ送信ができます。LINE車検リマインドの対象車両をここで管理します。
            </p>
          </div>
        </header>

        {/* サマリ + 新規登録ボタン */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border-l-4 border-l-blue-400 border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col gap-2">
            <div className="text-xs font-bold text-blue-600 flex items-center gap-1">🚗 登録済み車両</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-gray-900">{cars.length}</span>
              <span className="text-sm text-gray-400">台</span>
            </div>
            <p className="text-xs text-gray-500">このテナントで登録されている車両の件数です。</p>
          </div>

          <div className="rounded-2xl border-l-4 border-l-amber-400 border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col gap-2">
            <div className="text-xs font-bold text-amber-600 flex items-center gap-1">☑️ 一括送信用に選択中</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-gray-900">{selectedCarIds.length}</span>
              <span className="text-sm text-gray-400">台</span>
            </div>
            <p className="text-xs text-gray-500">チェックボックスで選択した車両数です。</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-gray-600">✏️ 新規車両登録</div>
              <p className="mt-1 text-xs text-gray-500">顧客に紐づく車両を新しく登録します。</p>
            </div>
            <button
              type="button"
              onClick={openNewCarModal}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 shadow-sm transition"
            >
              <span>＋</span>
              <span>新規車両を登録</span>
            </button>
          </div>
        </section>

                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">
              車両一覧 & 一括メッセージ送信
            </h2>
            <div className="flex flex-col sm:items-end gap-1 sm:gap-2 text-[11px] text-gray-500">
              <span>
                送信したい車両にチェックを入れて、「選択した車両の顧客にメッセージ送信」をクリックしてください。
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  検索：
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="顧客名・車名・登録番号などで絞り込み"
                  className="w-48 sm:w-64 rounded-md border border-gray-300 px-2 py-1 text-[11px]"
                />
              </div>
              <div className="text-[10px] text-gray-500">
                表示中: {filteredCars.length}件 / 登録 {cars.length}件
              </div>
            </div>
          </div>


                    {/* 一括送信トリガー：選択中表示 + 並び替え + 送信ボタン */}
          <div className="mb-2 flex flex-col gap-1">
            <div className="text-[11px] text-gray-600">
              選択中:{" "}
              <span className="font-semibold text-emerald-700">
                {selectedCarIds.length}件
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="inline-flex items-center gap-1 rounded-md border border-gray-400 bg-white hover:bg-gray-100 px-2 py-1 text-[11px] ml-2"
              >
                {allDisplayedSelected
                  ? "このページをすべて解除"
                  : "このページをすべて選択"}
              </button>
            </div>

            <div className="mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              {/* 並び替え */}
              <div className="flex items-center gap-1 text-[11px] text-gray-600">
                <span>並び替え:</span>
                <select
                  value={sortKey}
                  onChange={(e) =>
                    setSortKey(e.target.value as SortKey)
                  }
                  className="rounded-md border border-gray-300 text-[11px] px-2 py-1 bg-white"
                >
                  <option value="id">車両ID順</option>
                  <option value="customer">顧客名順</option>
                  <option value="shakenDate">車検日順</option>
                  <option value="inspectionDate">点検日順</option>
                  <option value="customReminderDate">任意日付順</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setSortOrder((prev) =>
                      prev === "asc" ? "desc" : "asc",
                    )
                  }
                  className="rounded-md border border-gray-300 px-2 py-1 text-[11px] bg-white hover:bg-gray-100"
                >
                  {sortOrder === "asc" ? "↑ 昇順" : "↓ 降順"}
                </button>
              </div>

              {/* 履歴ボタン + 一括送信ボタン */}
              <div className="flex flex-wrap items-center gap-2">
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
                  onClick={() => setIsLogListModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 text-xs font-semibold px-3 py-1.5"
                >
                  📊 送信履歴を見る
                </button>

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
          </div>


          {/* 車両一覧テーブル */}
          {cars.length === 0 ? (
            <p className="text-xs text-gray-600">
              まだ車両が登録されていません。
            </p>
          ) : (
            <>
            <div className="overflow-x-auto max-h-[520px] border rounded-xl">
              <table className="min-w-full text-xs sm:text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="border-b px-3 py-2 w-8">
                      <span className="sr-only">選択</span>
                    </th>
                    <th className="border-b px-3 py-2 text-left w-12 text-gray-600 font-semibold">
                      ID
                    </th>
                    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
                      顧客
                    </th>
                    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
                      車両名
                    </th>
                    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
                      登録番号
                    </th>
                    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
                      車台番号
                    </th>
                    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
                      車検日
                    </th>
                    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
                      点検日
                    </th>
                    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
                      任意日付
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCars.map((car) => {
                    const selected = selectedCarIds.includes(car.id);
                    const customerName = `${car.customer.lastName} ${car.customer.firstName}`;
                    return (
                      <tr
                        key={car.id}
                        className="hover:bg-green-50 text-gray-900 cursor-pointer"
                        onClick={() => handleEditClick(car)}
                      >
                        <td className="border-b px-3 py-2 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleCarSelection(car.id)}
                          />
                        </td>
                        <td className="border-b px-3 py-2 align-middle text-gray-500">
                          {car.id}
                        </td>
                        <td className="border-b px-3 py-2 align-middle whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{customerName}</span>
                            <span className={`text-xs ${car.customer.lineUid ? 'text-green-600' : 'text-gray-400'}`}>
                              {car.customer.lineUid ? "LINE連携済" : "LINE未連携"}
                            </span>
                          </div>
                        </td>
                        <td className="border-b px-3 py-2 align-middle whitespace-nowrap font-medium">
                          {car.carName}
                        </td>
                        <td className="border-b px-3 py-2 align-middle whitespace-nowrap text-gray-700">
                          {car.registrationNumber}
                        </td>
                        <td className="border-b px-3 py-2 align-middle whitespace-nowrap text-gray-700">
                          {car.chassisNumber}
                        </td>
                        <td className="border-b px-3 py-2 align-middle whitespace-nowrap">
                          {car.shakenDate ? (
                            <span className="text-gray-700">{formatDate(car.shakenDate)}</span>
                          ) : (
                            <span className="text-gray-400">未設定</span>
                          )}
                        </td>
                        <td className="border-b px-3 py-2 align-middle whitespace-nowrap">
                          {car.inspectionDate ? (
                            <span className="text-gray-700">{formatDate(car.inspectionDate)}</span>
                          ) : (
                            <span className="text-gray-400">未設定</span>
                          )}
                        </td>
                        <td className="border-b px-3 py-2 align-middle whitespace-nowrap">
                          {car.customReminderDate ? (
                            <>
                              <span className="text-gray-700">{formatDate(car.customReminderDate)}</span>
                              {car.customDaysBefore != null && (
                                <span className="text-xs text-gray-500 ml-1">
                                  / {car.customDaysBefore}日前
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400">未設定</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
</div>
                            {/* ページネーション */}
              <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-gray-600">
                <div>
                  {filteredCars.length}件中{" "}
                  {(currentPage - 1) * pageSize + 1}～
                  {Math.min(
                    currentPage * pageSize,
                    filteredCars.length,
                  )}
                  件を表示
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) => Math.max(1, p - 1))
                    }
                    disabled={currentPage === 1}
                    className="px-2 py-1 rounded-md border border-gray-400 bg-white hover:bg-gray-100 disabled:opacity-50"
                  >
                    前の20件
                  </button>
                  <span>
                    {currentPage} / {totalPages}ページ
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 rounded-md border border-gray-400 bg-white hover:bg-gray-100 disabled:opacity-50"
                  >
                    次の20件
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* 車両登録／編集モーダル */}
      {isCarModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
            {/* モーダルヘッダー */}
            <div className={`px-6 py-4 ${editingCarId == null ? 'bg-green-600' : 'bg-blue-600'} text-white`}>
              <h3 className="text-base font-bold">
                {editingCarId == null ? '🚗 新規車両の登録' : '✏️ 車両情報の編集'}
              </h3>
            </div>

            <div className="p-5 overflow-y-auto max-h-[80vh]">

            {/* 車検証閲覧アプリ CSV アップロード */}
            <div
              className={`mb-4 rounded-xl border-2 border-dashed p-4 transition-colors ${
                csvDragging ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setCsvDragging(true); }}
              onDragLeave={() => setCsvDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setCsvDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleCsvFile(file);
              }}
            >
              <p className="text-xs font-semibold text-gray-600 mb-1">📄 車検証閲覧アプリのCSVから自動入力</p>
              <p className="text-xs text-gray-400 mb-3">
                国土交通省「車検証閲覧アプリ」でダウンロードしたCSVをアップロードすると登録番号・車台番号・車名が自動入力されます。
              </p>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <span className="inline-block rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 active:bg-green-800">
                    📂 CSVファイルを選択
                  </span>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ''; }}
                  />
                </label>
                <span className="text-xs text-gray-400">またはここにドロップ</span>
              </div>
              {csvError && <p className="mt-2 text-xs text-red-600">⚠️ {csvError}</p>}
              {csvSuccess && (
                <p className="mt-2 text-xs font-semibold text-green-700">✅ {csvSuccess}</p>
              )}
            </div>

            {formError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                {formError}
              </div>
            )}

            <form
              className="space-y-4"
              onSubmit={handleCreateOrUpdateCar}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  顧客 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder="顧客名・携帯番号・IDなどで検索"
                  className="w-full mb-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                />
                <select
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {filteredCustomersForSelect.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.lastName} {c.firstName}
                      {c.mobilePhone ? `（${c.mobilePhone}）` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  上の検索欄に名前や携帯番号を入力すると候補が絞り込まれます。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  登録番号（例: 福岡333は1234）<span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  車台番号（例: VZR-1234568）<span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  車名（例: トヨタ ハイエース）<span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                  value={carName}
                  onChange={(e) => setCarName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">車検日</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={shakenDate}
                    onChange={(e) => setShakenDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">点検日</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">任意日付</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={customReminderDate}
                    onChange={(e) => setCustomReminderDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">何日前に通知</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={customDaysBefore}
                    onChange={(e) => setCustomDaysBefore(e.target.value)}
                  />
                </div>
              </div>

              {formSuccess && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                  {formSuccess}
                </div>
              )}

              <div className="pt-1 flex justify-between gap-2">
                <div>
                  {editingCarId != null && (
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(editingCarId)}
                      disabled={submitting}
                      className="px-4 py-2.5 rounded-xl border border-red-300 text-sm text-red-600 bg-white hover:bg-red-50 disabled:opacity-50"
                    >
                      削除
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeCarModal}
                    disabled={submitting}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    閉じる
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2.5 rounded-xl bg-green-600 text-sm text-white font-bold hover:bg-green-700 disabled:bg-green-300"
                  >
                    {submitting ? "処理中..." : editingCarId == null ? "車両を登録" : "車両情報を更新"}
                  </button>
                </div>
              </div>
            </form>
            </div>
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

            {/* 一括送信履歴一覧モーダル（直近3か月） */}
      {isLogListModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
              一括メッセージ送信の履歴（直近3か月）
            </h3>
            {broadcastLogs.length === 0 ? (
              <p className="text-xs text-gray-600 mb-3">
                まだ送信履歴がありません。車両を選択して一括メッセージ送信を行うと、ここに履歴が表示されます。
              </p>
            ) : (
              <div className="overflow-x-auto border rounded-lg max-h-[260px] mb-2">
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
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50"
                      >
                        <td className="border px-2 py-1 whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="border px-2 py-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openLogDetailModal(log)}
                            className="underline text-emerald-700 hover:text-emerald-900"
                          >
                            {log.sentCount}件 / 対象{" "}
                            {log.targetCount}件
                          </button>
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
            <p className="text-[10px] text-gray-500 mb-3">
              ※ この履歴はサーバ側で3か月間保持されます（顧客管理の一括送信と共通のログです）。
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsLogListModalOpen(false)}
                className="px-3 py-1.5 rounded-md border border-gray-500 text-xs sm:text-sm text-gray-900 bg-white hover:bg-gray-100"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 一括送信履歴の詳細モーダル（送信先の顧客一覧） */}
      {isLogDetailModalOpen && selectedLog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
              送信先の一覧
            </h3>
            <p className="text-xs text-gray-600 mb-2">
              {formatDateTime(selectedLog.createdAt)} に送信したメッセージの対象顧客です。
            </p>

            {/* メッセージ本文の一部 */}
            <div className="mb-3 rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
              <div className="text-[11px] text-gray-500 mb-1">
                メッセージ内容
              </div>
              <div className="text-[11px] text-gray-800 whitespace-pre-wrap">
                {selectedLog.message}
              </div>
            </div>

            {/* 送信先リスト */}
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="min-w-full text-[11px] sm:text-xs">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="border px-2 py-1 text-left">
                      顧客
                    </th>
                    <th className="border px-2 py-1 text-left">
                      携帯番号
                    </th>
                    <th className="border px-2 py-1 text-left">
                      LINE UID
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLog.customerIds &&
                    customers
                      .filter((c) =>
                        selectedLog.customerIds!.includes(c.id),
                      )
                      .map((c) => (
                        <tr
                          key={c.id}
                          className="hover:bg-gray-50 text-gray-900"
                        >
                          <td className="border px-2 py-1 whitespace-nowrap">
                            {c.lastName} {c.firstName}
                          </td>
                          <td className="border px-2 py-1 whitespace-nowrap">
                            {c.mobilePhone ?? ""}
                          </td>
                          <td className="border px-2 py-1">
                            {c.lineUid ?? ""}
                          </td>
                        </tr>
                      ))}

                  {/* customerIds があるのに customers とマッチしないケース（顧客削除など） */}
                  {selectedLog.customerIds &&
                    customers.filter((c) =>
                      selectedLog.customerIds!.includes(c.id),
                    ).length === 0 && (
                      <tr>
                        <td
                          className="border px-2 py-2 text-center text-[11px] text-gray-500"
                          colSpan={3}
                        >
                          現在の顧客一覧と一致する送信先が見つかりません。
                          （顧客が削除された可能性があります）
                        </td>
                      </tr>
                    )}

                  {/* 古いログ（customerIds がない） */}
                  {!selectedLog.customerIds && (
                    <tr>
                      <td
                        className="border px-2 py-2 text-center text-[11px] text-gray-500"
                        colSpan={3}
                      >
                        この履歴には送信先の詳細情報が保存されていません。
                        この機能追加以降の送信から詳細が記録されます。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={closeLogDetailModal}
                className="px-3 py-1.5 rounded-md border border-gray-500 text-xs sm:text-sm text-gray-900 bg-white hover:bg-gray-100"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </TenantLayout>
  );
}
