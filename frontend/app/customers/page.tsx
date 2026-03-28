"use client";

import { FormEvent, useEffect, useRef, useState, useCallback } from "react";
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
  hasVehicle?: boolean;   // サーバ側で true/false を返してもOK
  vehicleCount?: number | null;  // 台数で返したい場合
  createdAt?: string | null;     // 並び替え用（登録日が取れるなら）
};


// ★ 追加：車両型
type Car = {
  id: number;
  customerId: number;
  carName?: string | null;
  registrationNumber?: string | null;
  chassisNumber?: string | null;
  shakenDate?: string | null;
  inspectionDate?: string | null;
};

type SortKey = "id" | "name" | "createdAt" | "hasVehicle";

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
  customerIds?: number[];
  sentByName?: string | null;
};

type CsvImportErrorRow = {
  rowNumber: number;
  messages: string[];
  raw: Record<string, string>;
};

type CsvImportResult = {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: CsvImportErrorRow[];
};


const apiBase =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function CustomersPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLog, setSelectedLog] = useState<BroadcastLog | null>(
    null,
  );
  const [isLogDetailModalOpen, setIsLogDetailModalOpen] =
    useState(false);
  const [isLogListModalOpen, setIsLogListModalOpen] =
    useState(false);

      // ----- CSV取り込み用 state -----
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const [csvImportSuccess, setCsvImportSuccess] = useState<string | null>(null);
  const [csvImportResult, setCsvImportResult] = useState<CsvImportResult | null>(null);


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
  const [isSearchingAddress, setIsSearchingAddress] =
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
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // 顧客検索・ページング
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 10秒カウントダウン
  const [countdown, setCountdown] = useState<number>(0);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const countdownTimerRef = useRef<number | null>(null);

  // 一括送信履歴（★サーバ側3ヶ月保持分）
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLog[]>(
    [],
  );

    // ★ 車両一覧（テナント全体）
  const [cars, setCars] = useState<Car[]>([]);

  // ★ 顧客行クリック → 車両モーダル用
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [vehicleTargetCustomer, setVehicleTargetCustomer] =
    useState<Customer | null>(null);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);

  // 車両編集フォーム
  const [carName, setCarName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [shakenDate, setShakenDate] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");

  const [carFormError, setCarFormError] = useState<string | null>(null);
const [carFormSuccess, setCarFormSuccess] = useState<string | null>(null);
const [carFormSaving, setCarFormSaving] = useState(false);

  // 新規車両追加モード
  const [isAddingNewCar, setIsAddingNewCar] = useState(false);
  const [newCarSaving, setNewCarSaving] = useState(false);

  // 顧客モーダル内CSVアップロード（車両登録用）
  const [carCsvDragging, setCarCsvDragging] = useState(false);
  const [carCsvError, setCarCsvError] = useState<string | null>(null);
  const [carCsvSuccess, setCarCsvSuccess] = useState<string | null>(null);
  const carCsvInputRef = useRef<HTMLInputElement>(null);
  const [carMobileQrUrl, setCarMobileQrUrl] = useState<string | null>(null);
  const [carMobilePolling, setCarMobilePolling] = useState(false);
  const carPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);



  // ---- ヘルパー：一括送信履歴（サーバ）取得 ----
  const fetchBroadcastLogs = async (authToken: string) => {
    try {
      const res = await fetch(
        `${apiBase}/messages/broadcast-logs`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error(
          "failed to fetch broadcast logs",
          res.status,
          data ?? "",
        );
        return;
      }

      const data: BroadcastLog[] = await res.json();
      setBroadcastLogs(data);
    } catch (e) {
      console.error("failed to fetch broadcast logs", e);
    }
  };

  const openLogDetailModal = (log: BroadcastLog) => {
    if (!log.customerIds || log.customerIds.length === 0) {
      window.alert(
        "この履歴には送信先の情報が保存されていません。\n今後送信した履歴から順次記録されます。",
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

  // ----- 初回ロード：auth/me → customers → broadcast-logs -----
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
      const meRes = await fetch(`${apiBase}/auth/me`, { headers });

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

      // ② 顧客一覧（★ここを1ブロックだけにする）
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

      const customersData: Customer[] = await customersRes.json();
      setCustomers(customersData);

      // ③ 車両一覧
      try {
        const carsRes = await fetch(`${apiBase}/cars`, { headers });
        if (carsRes.ok) {
          const carsData: Car[] = await carsRes.json();
          setCars(carsData);
        } else {
          console.warn("cars api error", carsRes.status);
        }
      } catch (e) {
        console.warn("failed to fetch cars", e);
      }

      // ④ 一括送信履歴（ここで1回だけ呼べばOK）
      await fetchBroadcastLogs(savedToken);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "顧客一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  run();
}, []);

  const formatCustomerId = (c: Customer): string => {
    // tenantId がなければ従来どおりの ID
    if (!me?.tenantId) return String(c.id);

    const tenantPart = String(me.tenantId).padStart(3, "0");
    const idPart = String(c.id).padStart(5, "0");
    return `${tenantPart}-${idPart}`;
  };

    const resolveHasVehicle = (c: Customer): boolean => {
    // hasVehicle があればそれを優先
    if (typeof c.hasVehicle === "boolean") return c.hasVehicle;

    // vehicleCount があれば 1台以上で true
    if (typeof c.vehicleCount === "number") {
      return c.vehicleCount > 0;
    }

    // 将来、cars / vehicles 配列で返すかもしれないので保険
    const any = c as any;
    if (Array.isArray(any.cars)) return any.cars.length > 0;
    if (Array.isArray(any.vehicles)) return any.vehicles.length > 0;

    return false;
  };


  const formatLineUid = (uid?: string | null) => {
    if (!uid) return "";
    if (uid.length <= 10) return uid;
    // 例: U12345…ABCD
    return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
  };

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

  // ----- 郵便番号から住所検索 -----
  const handleLookupAddress = async () => {
    const raw = postalCode.trim();
    if (!raw) {
      window.alert("郵便番号を入力してください。");
      return;
    }
    const zip = raw.replace(/-/g, "");
    if (!/^\d{7}$/.test(zip)) {
      window.alert(
        "郵便番号は7桁の数字で入力してください（例: 8100001）。",
      );
      return;
    }

    setIsSearchingAddress(true);
    try {
      const res = await fetch(
        `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`,
      );
      const data: any = await res.json();

      if (data.status !== 200 || !data.results || data.results.length === 0) {
        window.alert(
          "住所が見つかりませんでした。郵便番号を確認してください。",
        );
        return;
      }

      const r = data.results[0];
      const addr =
        (r.address1 ?? "") + (r.address2 ?? "") + (r.address3 ?? "");
      setPostalCode(zip);
      setAddress1(addr);
    } catch (e) {
      console.error(e);
      window.alert(
        "住所検索に失敗しました。時間をおいて再度お試しください。",
      );
    } finally {
      setIsSearchingAddress(false);
    }
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
    // 以下の項目は「空欄なら null を送る」ようにする
    postalCode:
      postalCode.trim() === "" ? null : postalCode.trim(),
    address1:
      address1.trim() === "" ? null : address1.trim(),
    address2:
      address2.trim() === "" ? null : address2.trim(),
    // mobilePhone は必須チェックをしているのでそのまま送る
    mobilePhone,
    lineUid:
      lineUid.trim() === "" ? null : lineUid.trim(),
    birthday:
      birthday.trim() === "" ? null : birthday.trim(),
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
  // ★ モーダルは開いたままにする（閉じない）
  // resetFormFields() もここでは呼ばず、入力内容は残しておく
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
  // ★ ここも閉じない。editingCustomerId も残しておく
  // setEditingCustomerId(null);
  // resetFormFields();
  // setIsCustomerModalOpen(false);
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

    // ===== CSV取り込み関連 =====
  const openCsvImportModal = () => {
    setCsvImportError(null);
    setCsvImportSuccess(null);
    setCsvFile(null);
    setIsCsvImportModalOpen(true);
  };

  const closeCsvImportModal = () => {
    if (csvImporting) return;
    setIsCsvImportModalOpen(false);
  };

    const handleCsvImport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCsvImportError(null);
    setCsvImportSuccess(null);
    setCsvImportResult(null);

    if (!token) {
      setCsvImportError("トークンがありません。再度ログインしてください。");
      return;
    }

    if (!csvFile) {
      setCsvImportError("CSVファイルを選択してください。");
      return;
    }

    setCsvImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", csvFile);

      // strategy=skip で「エラー行だけスキップ」モード
      const res = await fetch(
        `${apiBase}/customers/import-csv?strategy=skip`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        let msg = "CSVの取り込みに失敗しました。";

        const m = (data as any)?.message;
        if (typeof m === "string") {
          msg = m;
        } else if (Array.isArray(m) && m[0]) {
          msg = String(m[0]);
        }

        setCsvImportError(msg);
        return;
      }

      const result: CsvImportResult = await res.json();
      setCsvImportResult(result);

      setCsvImportSuccess(
        `全 ${result.totalRows}件中、${result.importedCount}件を登録しました（エラー: ${result.errors.length}件）。`,
      );

      // 取り込み後に顧客一覧を再取得して画面に反映
      try {
        const customersRes = await fetch(`${apiBase}/customers`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (customersRes.ok) {
          const data: Customer[] = await customersRes.json();
          setCustomers(data);
        }
      } catch (e) {
        console.warn("顧客一覧の再取得に失敗しましたが、CSVの取り込み自体は成功しています。", e);
      }
    } catch (err) {
      console.error(err);
      setCsvImportError("CSV取り込み中にエラーが発生しました。");
    } finally {
      setCsvImporting(false);
    }
  };


  const handleEditClick = (c: Customer) => {
  // --- 顧客側 ---
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

  // --- 車両側：ここが重要 ---
  setVehicleTargetCustomer(c);
  setSelectedCar(null);
  setCarName("");
  setRegistrationNumber("");
  setChassisNumber("");
  setShakenDate("");
  setInspectionDate("");
  setCarFormError(null);
  setCarFormSuccess(null);

  setIsCustomerModalOpen(true);
};

  const closeCustomerModal = () => {
  setIsCustomerModalOpen(false);
  setEditingCustomerId(null);
  resetFormFields();
  setFormError(null);
  setFormSuccess(null);

  // 車両側もリセット
  setVehicleTargetCustomer(null);
  setSelectedCar(null);
  setCarName("");
  setRegistrationNumber("");
  setChassisNumber("");
  setShakenDate("");
  setInspectionDate("");
  setCarFormError(null);
  setCarFormSuccess(null);
  setIsAddingNewCar(false);
  setCarCsvError(null);
  setCarCsvSuccess(null);
  setCarMobileQrUrl(null);
  setCarMobilePolling(false);
  if (carPollTimerRef.current) { clearInterval(carPollTimerRef.current); carPollTimerRef.current = null; }
};

  const closeVehicleModal = () => {
    setIsVehicleModalOpen(false);
    setVehicleTargetCustomer(null);
    setSelectedCar(null);
    setCarFormError(null);
    setCarFormSaving(false);
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

    const handleSaveCar = async () => {
  // 編集対象がない場合
  if (!selectedCar) {
    setCarFormError("編集する車両が選択されていません。");
    setCarFormSuccess(null);
    return;
  }

  if (!token) {
    setCarFormError(
      "トークンがありません。再ログインしてから操作してください。",
    );
    setCarFormSuccess(null);
    return;
  }

  setCarFormError(null);
  setCarFormSuccess(null);
  setCarFormSaving(true);

  try {
    const res = await fetch(`${apiBase}/cars/${selectedCar.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        carName: carName || null,
        registrationNumber: registrationNumber || null,
        chassisNumber: chassisNumber || null,
        shakenDate: shakenDate || null,
        inspectionDate: inspectionDate || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      let msg = "車両情報の更新に失敗しました。";
      const m = (data as any)?.message;
      if (typeof m === "string") {
        msg = m;
      } else if (Array.isArray(m) && m[0]) {
        msg = String(m[0]);
      }
      throw new Error(msg);
    }

    const updated: Car = await res.json();

    // cars 一覧を更新
    setCars((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)),
    );

    // 選択中の車も最新に
    setSelectedCar(updated);

    // ★ 成功メッセージ
    setCarFormSuccess("車両情報を更新しました");
  } catch (err: any) {
    console.error(err);
    setCarFormError(
      err?.message ??
        "車両情報の更新に失敗しました。時間をおいて再度お試しください。",
    );
    setCarFormSuccess(null);
  } finally {
    setCarFormSaving(false);
  }
};



  // ── CSV パーサー（車検証閲覧アプリ形式） ────────────────────────────────
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
      } else { cur += ch; }
    }
    result.push(cur);
    return result;
  };

  const normalizeCarStr = (s: string) =>
    s.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
     .replace(/[　]+/g, ' ').trim();

  type CsvCarData = { registrationNumber?: string; chassisNumber?: string; carName?: string; shakenDate?: string };

  const parseCsvText = (text: string): CsvCarData => {
    const result: CsvCarData = {};
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return result;
    const headers = parseCsvLine(lines[0]);
    const values = parseCsvLine(lines[1]);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (values[i] ?? '').trim(); });

    const regRaw = row['TwodimensionCodeInfoEntryNoCarNo'] || row['EntryNoCarNo'] || '';
    if (regRaw) result.registrationNumber = normalizeCarStr(regRaw);
    const chassisRaw = row['TwodimensionCodeInfoCarNo'] || row['CarNo'] || '';
    if (chassisRaw) result.chassisNumber = normalizeCarStr(chassisRaw);
    if (row['CarName']) result.carName = row['CarName'].trim();
    const expiryCode = row['TwodimensionCodeInfoValidPeriodExpirdate'] || '';
    if (/^\d{6}$/.test(expiryCode) && expiryCode !== '999999') {
      const yy = parseInt(expiryCode.slice(0, 2), 10);
      const mm = expiryCode.slice(2, 4);
      const dd = expiryCode.slice(4, 6);
      result.shakenDate = `${yy < 80 ? 2000 + yy : 1900 + yy}-${mm}-${dd}`;
    } else {
      const era = (row['ValidPeriodExpirdateE'] || '').trim();
      const eraY = parseInt((row['ValidPeriodExpirdateY'] || '0').trim(), 10);
      const m = (row['ValidPeriodExpirdateM'] || '').trim().padStart(2, '0');
      const d = (row['ValidPeriodExpirdateD'] || '').trim().padStart(2, '0');
      if (era && eraY > 0 && m !== '00' && d !== '00') {
        const offsets: Record<string, number> = { '令和': 2018, '平成': 1988, '昭和': 1925 };
        const off = offsets[era];
        if (off) result.shakenDate = `${off + eraY}-${m}-${d}`;
      }
    }
    if (!result.registrationNumber) {
      for (const [k, v] of Object.entries(row)) {
        if (k.includes('登録番号') || k.includes('ナンバー') || k.includes('車両番号')) {
          result.registrationNumber = normalizeCarStr(v); break;
        }
      }
    }
    if (!result.chassisNumber) {
      for (const [k, v] of Object.entries(row)) {
        if (k.includes('車台番号')) { result.chassisNumber = normalizeCarStr(v); break; }
      }
    }
    if (!result.carName) {
      for (const [k, v] of Object.entries(row)) {
        if (k.includes('車名') && !k.includes('番号')) { result.carName = v.trim(); break; }
      }
    }
    return result;
  };

  const applyCarCsvData = (d: CsvCarData) => {
    if (d.registrationNumber) setRegistrationNumber(d.registrationNumber);
    if (d.chassisNumber) setChassisNumber(d.chassisNumber);
    if (d.carName) setCarName(d.carName);
    if (d.shakenDate) setShakenDate(d.shakenDate);
    const applied = [d.registrationNumber && '登録番号', d.chassisNumber && '車台番号', d.carName && '車名', d.shakenDate && '車検日'].filter(Boolean).join('・');
    setCarCsvSuccess(`${applied}を反映しました`);
    setCarCsvError(null);
  };

  const handleCarCsvFile = async (file: File) => {
    setCarCsvError(null);
    setCarCsvSuccess(null);
    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
      } catch {
        text = new TextDecoder('shift_jis').decode(buffer);
      }
      const data = parseCsvText(text);
      if (!data.registrationNumber && !data.chassisNumber && !data.carName) {
        setCarCsvError('登録番号・車台番号・車名が見つかりませんでした。車検証閲覧アプリのCSVか確認してください。');
        return;
      }
      applyCarCsvData(data);
    } catch {
      setCarCsvError('ファイルの読み込みに失敗しました。');
    }
  };

  const startCarMobileScan = async () => {
    setCarCsvError(null);
    setCarCsvSuccess(null);
    setCarMobileQrUrl(null);
    setCarMobilePolling(false);
    if (carPollTimerRef.current) { clearInterval(carPollTimerRef.current); carPollTimerRef.current = null; }
    try {
      const res = await fetch(`${apiBase}/public/car-scan/session`, { method: 'POST' });
      const data = await res.json();
      const sid = data.sessionId as string;
      const frontendBase = typeof window !== 'undefined' ? window.location.origin : '';
      const scanUrl = `${frontendBase}/public/car-scan?sid=${sid}`;
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(scanUrl, { width: 200, margin: 2 });
      setCarMobileQrUrl(dataUrl);
      setCarMobilePolling(true);
      carPollTimerRef.current = setInterval(async () => {
        try {
          const r = await fetch(`${apiBase}/public/car-scan/${sid}`);
          const d = await r.json();
          if (d.ready && d.rawData) {
            if (carPollTimerRef.current) { clearInterval(carPollTimerRef.current); carPollTimerRef.current = null; }
            setCarMobilePolling(false);
            setCarMobileQrUrl(null);
            try {
              const parsed: CsvCarData = JSON.parse(d.rawData);
              if (parsed.registrationNumber || parsed.chassisNumber || parsed.carName) {
                applyCarCsvData(parsed);
              } else {
                setCarCsvError('スマホからのデータを解析できませんでした。');
              }
            } catch {
              setCarCsvError('スマホからのデータを解析できませんでした。');
            }
          }
        } catch { /* ignore */ }
      }, 2000);
    } catch {
      setCarCsvError('スマホ連携の開始に失敗しました。');
    }
  };

  const handleAddNewCar = async () => {
    if (!token || !vehicleTargetCustomer) return;
    if (!carName && !registrationNumber && !chassisNumber) {
      setCarFormError('車名・登録番号・車台番号のいずれかは必須です。');
      return;
    }
    setCarFormError(null);
    setCarFormSuccess(null);
    setNewCarSaving(true);
    try {
      const res = await fetch(`${apiBase}/cars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerId: vehicleTargetCustomer.id,
          carName: carName || null,
          registrationNumber: registrationNumber || null,
          chassisNumber: chassisNumber || null,
          shakenDate: shakenDate || null,
          inspectionDate: inspectionDate || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.message ? (Array.isArray(data.message) ? data.message.join(', ') : String(data.message)) : '車両の登録に失敗しました';
        throw new Error(msg);
      }
      const created: Car = await res.json();
      setCars((prev) => [...prev, created]);
      // フォームリセット
      setCarName(''); setRegistrationNumber(''); setChassisNumber(''); setShakenDate(''); setInspectionDate('');
      setCarCsvError(null); setCarCsvSuccess(null); setCarMobileQrUrl(null); setCarMobilePolling(false);
      setIsAddingNewCar(false);
      setCarFormSuccess('車両を登録しました');
      // 顧客の車両フラグ更新
      setCustomers((prev) => prev.map((c) => c.id === vehicleTargetCustomer.id ? { ...c, hasVehicle: true } : c));
    } catch (err: any) {
      setCarFormError(err.message ?? '車両の登録に失敗しました');
    } finally {
      setNewCarSaving(false);
    }
  };

 // 並び替え後の顧客リスト
const sortedCustomers = [...customers].sort((a, b) => {
  const mul = sortOrder === "asc" ? 1 : -1;

  if (sortKey === "id") {
    return (a.id - b.id) * mul;
  }

  if (sortKey === "name") {
    const an = `${a.lastName ?? ""}${a.firstName ?? ""}`;
    const bn = `${b.lastName ?? ""}${b.firstName ?? ""}`;
    return an.localeCompare(bn, "ja") * mul;
  }

  if (sortKey === "createdAt") {
    const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return (ad - bd) * mul;
  }

  if (sortKey === "hasVehicle") {
    const av = resolveHasVehicle(a) ? 1 : 0;
    const bv = resolveHasVehicle(b) ? 1 : 0;
    return (av - bv) * mul;
  }

  return 0;
});

// 検索＋ページング用の顧客リスト
const normalizedQuery = searchQuery.trim().toLowerCase();
const filteredCustomers = normalizedQuery
  ? sortedCustomers.filter((c) => {
      const fields: string[] = [];
      fields.push(formatCustomerId(c));
      fields.push(`${c.lastName ?? ""}${c.firstName ?? ""}`);
      if (c.postalCode) fields.push(c.postalCode);
      if (c.address1) fields.push(c.address1);
      if (c.address2) fields.push(c.address2);
      if (c.mobilePhone) fields.push(c.mobilePhone);
      if (c.lineUid) fields.push(c.lineUid);
      if (c.birthday) fields.push(formatDate(c.birthday));
      const text = fields.join(" ").toLowerCase();
      return text.includes(normalizedQuery);
    })
  : sortedCustomers;

const totalPages = Math.max(
  1,
  Math.ceil(filteredCustomers.length / pageSize),
);
const currentPage = Math.min(page, totalPages);
const pagedCustomers = filteredCustomers.slice(
  (currentPage - 1) * pageSize,
  currentPage * pageSize,
);


  const allDisplayedSelected =
    pagedCustomers.length > 0 &&
    pagedCustomers.every((c) => selectedCustomerIds.includes(c.id));

  // ★ 一括チェック / 解除（現在のページに表示されている顧客のみ）
  const handleToggleSelectAll = () => {
    setSelectedCustomerIds((prev) => {
      const displayIds = pagedCustomers.map((c) => c.id);
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
      const targetCount =
        result.targetCount ?? selectedCustomerIds.length;

      // ★ サーバ側に保存された最新のまとめログを取得し直す
      await fetchBroadcastLogs(token);

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
            <h1 className="text-2xl font-extrabold text-green-700 flex items-center gap-2">
              👥 顧客管理
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              顧客情報の登録・編集、一括メッセージ送信ができます。LINE車検リマインドのベースとなる名簿です。
            </p>
          </div>
        </header>

        {/* サマリ + 新規登録ボタン */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border-l-4 border-l-green-400 border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col gap-2">
            <div className="text-xs font-bold text-green-600 flex items-center gap-1">👥 登録済み顧客</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-gray-900">{customers.length}</span>
              <span className="text-sm text-gray-400">件</span>
            </div>
            <p className="text-xs text-gray-500">顧客一覧に登録されている件数です。</p>
          </div>

          <div className="rounded-2xl border-l-4 border-l-amber-400 border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col gap-2">
            <div className="text-xs font-bold text-amber-600 flex items-center gap-1">☑️ 一括送信用に選択中</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-gray-900">{selectedCustomerIds.length}</span>
              <span className="text-sm text-gray-400">件</span>
            </div>
            <p className="text-xs text-gray-500">チェックボックスで選択した顧客数です。</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-gray-600">✏️ 新規顧客登録</div>
              <p className="mt-1 text-xs text-gray-500">店舗側で把握している顧客を随時追加できます。</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openNewCustomerModal}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 shadow-sm transition"
              >
                <span>＋</span>
                <span>新規登録</span>
              </button>
              {me?.role === 'MANAGER' && (
                <button
                  type="button"
                  onClick={openCsvImportModal}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-green-600 text-green-700 bg-white hover:bg-green-50 text-xs font-bold px-3 py-2 shadow-sm transition"
                >
                  <span>📥</span>
                  <span>CSV取込</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 顧客一覧 + 一括送信 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">
              顧客一覧 & 一括メッセージ送信
            </h2>
            <div className="flex flex-col sm:items-end gap-1 sm:gap-2 text-[11px] text-gray-500">
              <span>
                送信したい顧客にチェックを入れて、「選択した顧客にメッセージ送信」をクリックしてください。
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
                  placeholder="名前・電話・住所などで絞り込み"
                  className="w-48 sm:w-64 rounded-md border border-gray-300 px-2 py-1 text-[11px]"
                />
              </div>
              <div className="text-[10px] text-gray-500">
                表示中: {filteredCustomers.length}件 / 登録{" "}
                {customers.length}件
              </div>
            </div>
          </div>
         {/* 一括送信トリガー：選択中表示（1行目：赤枠の上の行） */}
          <div className="mb-1 text-[11px] text-gray-600">
            選択中:{" "}
            <span className="font-semibold text-emerald-700">
              {selectedCustomerIds.length}件
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

          {/* 並び替え（黄色枠）＋送信ボタン（青枠）の行 */}
          <div className="mb-2 flex items-center justify-between gap-2">
            {/* 左：並び替え（黄色の位置） */}
            <div className="flex items-center gap-1 text-[11px] text-gray-600">
              <span>並び替え:</span>
              <select
                value={sortKey}
                onChange={(e) =>
                  setSortKey(e.target.value as SortKey)
                }
                className="rounded-md border border-gray-300 text-[11px] px-2 py-1 bg-white"
              >
                <option value="id">顧客ID順</option>
                <option value="name">名前順</option>
                <option value="createdAt">登録日順</option>
                <option value="hasVehicle">車両タグ順</option>
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

                        {/* 右：履歴ボタン ＋ 送信ボタン（青枠の位置） */}
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

              {/* 送信履歴ボタン（モーダルを開く） */}
              <button
                type="button"
                onClick={() => setIsLogListModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 text-xs font-semibold px-3 py-1.5"
              >
                📊 送信履歴を見る
              </button>

              {/* 一括送信ボタン */}
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
          ) : filteredCustomers.length === 0 ? (
            <p className="text-xs text-gray-600">
              検索条件に一致する顧客がありません。
            </p>
          ) : (
            <>
              <div className="overflow-x-auto max-h-[480px] border rounded-xl">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
  <tr>
    <th className="border-b px-3 py-2 w-8">
      <span className="sr-only">選択</span>
    </th>
    <th className="border-b px-3 py-2 text-left w-14 text-gray-600 font-semibold">
      ID
    </th>
    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
      名前
    </th>
    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
      住所
    </th>
    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
      携帯番号
    </th>
    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
      LINE UID
    </th>
    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
      誕生日
    </th>
    <th className="border-b px-3 py-2 text-left text-gray-600 font-semibold">
      タグ
    </th>
  </tr>
</thead>
<tbody>
  {pagedCustomers.map((c) => {
    const fullAddress =
      (c.postalCode ? `〒${c.postalCode} ` : "") +
      [c.address1, c.address2].filter(Boolean).join("");

    const isSelected = selectedCustomerIds.includes(c.id);

    return (
      <tr
        key={c.id}
        className="hover:bg-green-50 text-gray-900 cursor-pointer"
        onClick={() => handleEditClick(c)}  // ★ 行クリックで車両モーダル
      >
        {/* チェックボックス */}
        <td className="border-b px-3 py-2 text-center">
          <input
            type="checkbox"
            checked={isSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => {
              setSelectedCustomerIds((prev) =>
                isSelected
                  ? prev.filter((id) => id !== c.id)
                  : [...prev, c.id],
              );
            }}
          />
        </td>

        {/* 顧客ID */}
        <td className="border-b px-3 py-2 whitespace-nowrap text-gray-500">
          {formatCustomerId(c)}
        </td>

        {/* 名前 */}
        <td className="border-b px-3 py-2 whitespace-nowrap font-medium text-gray-900">
          {c.lastName} {c.firstName}
        </td>

        {/* 住所 */}
        <td className="border-b px-3 py-2 text-gray-700">
          {fullAddress ? (
            fullAddress
          ) : (
            <span className="text-gray-400">住所未登録</span>
          )}
        </td>

        {/* 携帯番号 */}
        <td className="border-b px-3 py-2 whitespace-nowrap text-gray-700">
          {c.mobilePhone ?? (
            <span className="text-gray-400">未登録</span>
          )}
        </td>

        {/* LINE UID */}
        <td className="border-b px-3 py-2 whitespace-nowrap text-gray-700">
          {c.lineUid ? (
            <span title={c.lineUid}>
              {formatLineUid(c.lineUid)}
            </span>
          ) : (
            <span className="text-gray-400">未連携</span>
          )}
        </td>

        {/* 誕生日 */}
        <td className="border-b px-3 py-2 whitespace-nowrap text-gray-700">
          {c.birthday ? formatDate(c.birthday) : ""}
        </td>

        {/* タグ */}
        <td className="border-b px-3 py-2 whitespace-nowrap">
          <div className="flex flex-wrap gap-1">
            {resolveHasVehicle(c) && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700">
                車両あり
              </span>
            )}
            {c.lineUid && (
              <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">
                LINE連携
              </span>
            )}
          </div>
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
                  {filteredCustomers.length}件中{" "}
                  {(currentPage - 1) * pageSize + 1}～
                  {Math.min(
                    currentPage * pageSize,
                    filteredCustomers.length,
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

      {isCustomerModalOpen && (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
      {/* モーダルヘッダー */}
      <div className={`px-6 py-4 ${editingCustomerId == null ? 'bg-green-600' : 'bg-blue-600'} text-white`}>
        <h3 className="text-base font-bold">
          {editingCustomerId == null ? '👤 新規顧客の登録' : '✏️ 顧客情報の編集'}
        </h3>
      </div>

      <div className="p-4 sm:p-5 overflow-y-auto max-h-[80vh]">

{formError && (
  <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
    {formError}
  </div>
)}

      {formSuccess && (
  <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
    {formSuccess}
  </div>
)}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 左：顧客情報フォーム */}
        <form
          className="space-y-4"
          onSubmit={handleCreateOrUpdate}
        >
          {/* 姓・名 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                姓 <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                名 <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
          </div>

          {/* 郵便番号＋住所 */}
          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  郵便番号
                </label>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                  placeholder="8100001"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={handleLookupAddress}
                disabled={isSearchingAddress || !postalCode.trim()}
                className="px-4 py-3 rounded-xl border border-gray-300 text-sm bg-white hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
              >
                {isSearchingAddress ? "検索中..." : "住所検索"}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                住所（番地まで）
              </label>
              <input
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                placeholder="福岡市〇〇区△△1-2-3"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                住所（建物名・部屋番号など）
              </label>
              <input
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                placeholder="〇〇マンション101号室"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
              />
            </div>
          </div>

          {/* 電話・LINE UID・誕生日 */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                携帯番号 <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                placeholder="09012345678"
                value={mobilePhone}
                onChange={(e) => setMobilePhone(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LINE UID
              </label>
              <input
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                placeholder="Uから始まるIDを貼り付け"
                value={lineUid}
                onChange={(e) => setLineUid(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                誕生日
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <div>
              {editingCustomerId != null && me?.role !== 'CLIENT' && (
                <button
                  type="button"
                  onClick={() => handleDeleteClick(editingCustomerId)}
                  className="px-4 py-2.5 rounded-xl border border-red-300 text-sm text-red-700 bg-white hover:bg-red-50"
                >
                  🗑️ 削除
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeCustomerModal}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                閉じる
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-green-600 text-sm text-white font-bold hover:bg-green-700"
              >
                {editingCustomerId == null ? '登録する' : '更新する'}
              </button>
            </div>
          </div>
        </form>

        {/* 右：車両一覧＋編集＋新規追加 */}
        <div className="space-y-3">
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-gray-800 mb-0.5">🚗 紐づき車両</h4>
              <p className="text-xs text-gray-500">
                車両をクリックすると下のフォームで編集できます。
              </p>
            </div>
            {editingCustomerId != null && !isAddingNewCar && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCar(null);
                  setCarName(''); setRegistrationNumber(''); setChassisNumber(''); setShakenDate(''); setInspectionDate('');
                  setCarFormError(null); setCarFormSuccess(null);
                  setCarCsvError(null); setCarCsvSuccess(null); setCarMobileQrUrl(null);
                  setIsAddingNewCar(true);
                }}
                className="flex-shrink-0 inline-flex items-center gap-1 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2"
              >
                ＋ 車両追加
              </button>
            )}
          </div>

          {carFormError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {carFormError}
            </div>
          )}
          {carFormSuccess && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              {carFormSuccess}
            </div>
          )}

          {/* 車両リスト */}
          <div className="rounded-xl border border-gray-200 overflow-hidden max-h-52 overflow-y-auto">
            {cars.filter((car) => car.customerId === editingCustomerId).length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400 text-center">この顧客に紐づく車両がありません。</p>
            ) : (
              cars.filter((car) => car.customerId === editingCustomerId).map((car) => {
                const isActive = selectedCar && selectedCar.id === car.id;
                return (
                  <div
                    key={car.id}
                    className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors ${isActive ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                    onClick={() => {
                      setSelectedCar(car);
                      setCarName(car.carName ?? '');
                      setRegistrationNumber(car.registrationNumber ?? '');
                      setChassisNumber(car.chassisNumber ?? '');
                      setShakenDate(car.shakenDate ? new Date(car.shakenDate).toISOString().slice(0, 10) : '');
                      setInspectionDate(car.inspectionDate ? new Date(car.inspectionDate).toISOString().slice(0, 10) : '');
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{car.carName || <span className="text-gray-400">車名未設定</span>}</p>
                      <p className="text-xs text-gray-500">{car.registrationNumber || '登録番号未設定'}</p>
                    </div>
                    {isActive && <span className="text-xs text-green-600 font-bold">編集中</span>}
                  </div>
                );
              })
            )}
          </div>

          {/* 車検証CSVアップロード（新規追加 or 選択中編集時に表示） */}
          {(isAddingNewCar || selectedCar) && (
            <div
              className={`rounded-xl border-2 border-dashed p-3 transition-colors ${carCsvDragging ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}
              onDragOver={(e) => { e.preventDefault(); setCarCsvDragging(true); }}
              onDragLeave={() => setCarCsvDragging(false)}
              onDrop={(e) => {
                e.preventDefault(); setCarCsvDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleCarCsvFile(f);
              }}
            >
              <p className="text-xs font-bold text-gray-700 mb-2">📄 車検証CSVから自動入力</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-green-600 text-green-700 bg-white hover:bg-green-50 text-xs font-bold px-3 py-1.5">
                  📂 CSV選択
                  <input ref={carCsvInputRef} type="file" accept=".csv,text/csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCarCsvFile(f); e.currentTarget.value = ''; }} />
                </label>
                <button type="button" onClick={startCarMobileScan}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-400 text-blue-700 bg-white hover:bg-blue-50 text-xs font-bold px-3 py-1.5">
                  📱 スマホ連携
                </button>
                {carMobilePolling && (
                  <button type="button" onClick={() => {
                    if (carPollTimerRef.current) { clearInterval(carPollTimerRef.current); carPollTimerRef.current = null; }
                    setCarMobilePolling(false); setCarMobileQrUrl(null);
                  }} className="inline-flex items-center gap-1 rounded-lg border border-gray-400 text-gray-600 bg-white text-xs px-2 py-1.5">
                    キャンセル
                  </button>
                )}
              </div>
              {carMobileQrUrl && (
                <div className="mt-2 flex flex-col items-center gap-1">
                  <img src={carMobileQrUrl} alt="QRコード" className="w-36 h-36" />
                  <p className="text-xs text-gray-500">スマホでQRを読み取り、CSVをアップロードしてください</p>
                </div>
              )}
              {carCsvError && <p className="mt-2 text-xs text-red-600">{carCsvError}</p>}
              {carCsvSuccess && <p className="mt-2 text-xs text-green-700 font-semibold">✅ {carCsvSuccess}</p>}
            </div>
          )}

          {/* 新規車両追加フォーム */}
          {isAddingNewCar ? (
            <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-green-700">＋ 新規車両を登録</p>
                <button type="button" onClick={() => {
                  setIsAddingNewCar(false);
                  setCarName(''); setRegistrationNumber(''); setChassisNumber(''); setShakenDate(''); setInspectionDate('');
                  setCarCsvError(null); setCarCsvSuccess(null); setCarMobileQrUrl(null); setCarMobilePolling(false);
                  if (carPollTimerRef.current) { clearInterval(carPollTimerRef.current); carPollTimerRef.current = null; }
                }} className="text-xs text-gray-500 hover:text-gray-700">キャンセル</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">車名</label>
                <input className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400" value={carName} onChange={(e) => setCarName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">登録番号</label>
                <input className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400" placeholder="福岡300あ12-34 など" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">車台番号</label>
                <input className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400" value={chassisNumber} onChange={(e) => setChassisNumber(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">車検満了日</label>
                  <input type="date" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400" value={shakenDate} onChange={(e) => setShakenDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">点検予定日</label>
                  <input type="date" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button type="button" onClick={handleAddNewCar} disabled={newCarSaving}
                  className="px-4 py-2.5 rounded-xl bg-green-600 text-sm text-white font-bold hover:bg-green-700 disabled:opacity-60">
                  {newCarSaving ? '登録中...' : '車両を登録する'}
                </button>
              </div>
            </form>
          ) : selectedCar ? (
            <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
              <p className="text-xs font-semibold text-gray-600">✏️ 選択中の車両を編集</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">車名</label>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                  value={carName}
                  onChange={(e) => setCarName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">登録番号</label>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                  placeholder="福岡300あ12-34 など"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">車台番号</label>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">車検満了日</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={shakenDate}
                    onChange={(e) => setShakenDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">点検予定日</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSaveCar}
                  className="px-4 py-2.5 rounded-xl bg-green-600 text-sm text-white font-bold hover:bg-green-700"
                >
                  車両情報を保存
                </button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">上の一覧から車両を選択してください</p>
          )}
        </div>
      </div>
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
              onChange={(e) =>
                setBroadcastMessage(e.target.value)
              }
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

      {/* 一括送信履歴一覧モーダル（直近3か月） */}
      {isLogListModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
              一括メッセージ送信の履歴（直近3か月）
            </h3>
            {broadcastLogs.length === 0 ? (
              <p className="text-xs text-gray-600 mb-3">
                まだ送信履歴がありません。顧客を選択して一括メッセージ送信を行うと、ここに履歴が表示されます。
              </p>
            ) : (
              <div className="overflow-x-auto border rounded-lg max-h-[360px] mb-2">
                <table className="min-w-full text-[11px] sm:text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="border px-2 py-1 text-left">
                        送信日時
                      </th>
                      <th className="border px-2 py-1 text-left">
                        送信者
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
                        className="hover:bg-green-50"
                      >
                        <td className="border px-2 py-1 whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="border px-2 py-1 whitespace-nowrap text-gray-700">
                          {log.sentByName ?? <span className="text-gray-400">—</span>}
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
              ※ この履歴はサーバ側で3か月間保持されます（どの端末からログインしても同じ履歴が確認できます）。
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

      {/* 一括送信履歴の詳細モーダル（誰に送ったか） */}
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
                    <th className="border px-2 py-1 text-left w-16">
                      顧客ID
                    </th>
                    <th className="border px-2 py-1 text-left">
                      名前
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
                            {formatCustomerId(c)}
                          </td>
                          <td className="border px-2 py-1 whitespace-nowrap">
                            {c.lastName} {c.firstName}
                          </td>
                          <td className="border px-2 py-1 whitespace-nowrap">
                            {c.mobilePhone ?? ""}
                          </td>
                          <td className="border px-2 py-1">
                            {c.lineUid ? (
                              <span title={c.lineUid}>
                                {formatLineUid(c.lineUid)}
                              </span>
                            ) : (
                              ""
                            )}
                          </td>
                        </tr>
                      ))}

                  {selectedLog.customerIds &&
                    customers.filter((c) =>
                      selectedLog.customerIds!.includes(c.id),
                    ).length === 0 && (
                      <tr>
                        <td
                          className="border px-2 py-2 text-center text-[11px] text-gray-500"
                          colSpan={4}
                        >
                          現在の顧客一覧と一致する送信先が見つかりません。
                          （顧客が削除された可能性があります）
                        </td>
                      </tr>
                    )}

                  {!selectedLog.customerIds && (
                    <tr>
                      <td
                        className="border px-2 py-2 text-center text-[11px] text-gray-500"
                        colSpan={4}
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

            {/* ===== CSV取り込みモーダル ===== */}
      {isCsvImportModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-2">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              📥 顧客CSV取り込み
            </h2>

            {/* CSVの作り方ガイド */}
            <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-[11px] text-blue-900 space-y-3">
              <p className="font-bold text-blue-800">📋 CSVファイルの作り方</p>

              <div>
                <p className="font-semibold mb-1">① Excelやスプレッドシートで作成し、CSV形式で保存します。</p>
                <p className="text-blue-700">1行目は必ずヘッダー行にしてください。2行目以降がデータです。</p>
              </div>

              <div>
                <p className="font-semibold mb-1">② 使用できるヘッダー名（列名）</p>
                <div className="bg-white rounded border border-blue-200 overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead className="bg-blue-100">
                      <tr>
                        <th className="px-2 py-1 text-left font-bold">ヘッダー名</th>
                        <th className="px-2 py-1 text-left font-bold">必須</th>
                        <th className="px-2 py-1 text-left font-bold">説明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100">
                      <tr className="bg-yellow-50"><td className="px-2 py-1 font-mono font-bold">姓</td><td className="px-2 py-1 text-red-600 font-bold">必須</td><td className="px-2 py-1">苗字（例: 山田）</td></tr>
                      <tr><td className="px-2 py-1 font-mono">名</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">名前（例: 太郎）</td></tr>
                      <tr className="bg-gray-50"><td className="px-2 py-1 font-mono">氏名</td><td className="px-2 py-1 text-red-600 font-bold">必須※</td><td className="px-2 py-1">姓・名が無い場合に使用（例: 山田 太郎）</td></tr>
                      <tr><td className="px-2 py-1 font-mono">携帯番号</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">数字のみ（例: 09012345678）</td></tr>
                      <tr className="bg-gray-50"><td className="px-2 py-1 font-mono">郵便番号</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">7桁（例: 8100001）</td></tr>
                      <tr><td className="px-2 py-1 font-mono">住所（番地まで）</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">例: 福岡市博多区○○1-2-3</td></tr>
                      <tr className="bg-gray-50"><td className="px-2 py-1 font-mono">住所（建物名など）</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">マンション名・号室など</td></tr>
                      <tr><td className="px-2 py-1 font-mono">誕生日</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">例: 1985-04-01 / 1985/4/1</td></tr>
                      <tr className="bg-gray-50"><td className="px-2 py-1 font-mono">LINE UID</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">LINE連携済みの場合のみ</td></tr>
                      <tr className="bg-blue-50 font-semibold"><td className="px-2 py-1 font-mono" colSpan={3}>── 車両情報（同じ行に記載） ──</td></tr>
                      <tr><td className="px-2 py-1 font-mono">登録番号</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">例: 福岡500あ1234</td></tr>
                      <tr className="bg-gray-50"><td className="px-2 py-1 font-mono">車両名</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">例: プリウス</td></tr>
                      <tr><td className="px-2 py-1 font-mono">車台番号</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">例: ZVW5012345</td></tr>
                      <tr className="bg-gray-50"><td className="px-2 py-1 font-mono">車検日</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">例: 2026-03-31 / 令和8年3月31日</td></tr>
                      <tr><td className="px-2 py-1 font-mono">点検日</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">例: 2025-12-01 / 令和7年12月1日</td></tr>
                      <tr className="bg-gray-50"><td className="px-2 py-1 font-mono">任意日付</td><td className="px-2 py-1 text-gray-400">任意</td><td className="px-2 py-1">独自のリマインド日付（例: 2026-01-15）</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-blue-600">※「姓」が無い場合は「氏名」列を使用してください（スペースで姓・名に分割されます）</p>
              </div>

              <div>
                <p className="font-semibold mb-1">③ 注意事項</p>
                <ul className="space-y-0.5 text-blue-700 list-disc list-inside">
                  <li>文字コードは <span className="font-bold">UTF-8</span> で保存してください</li>
                  <li>1顧客に複数車両がある場合は、同じ顧客情報を繰り返して複数行に記載してください</li>
                  <li>同じ携帯番号の行は同一顧客として扱われます</li>
                  <li>エラーのあった行はスキップして、正常な行のみ取り込まれます</li>
                  <li>日付は西暦・元号どちらでも入力できます</li>
                </ul>
              </div>
            </div>


            {csvImportError && (
              <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                {csvImportError}
              </div>
            )}

            {csvImportSuccess && (
              <div className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                {csvImportSuccess}
              </div>
            )}

                        {csvImportResult && (
              <div className="mb-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-800">
                <div>
                  全 {csvImportResult.totalRows}件中{" "}
                  <span className="font-semibold text-emerald-700">
                    {csvImportResult.importedCount}件
                  </span>
                  を登録 /
                  <span className="ml-1">
                    スキップ {csvImportResult.skippedCount}件
                  </span>
                </div>

                {csvImportResult.errors.length > 0 && (
                  <>
                    <div className="mt-1 text-red-700">
                      エラーのあった行（最大20件まで表示）:
                    </div>
                    <ul className="mt-1 max-h-32 overflow-y-auto space-y-1">
                      {csvImportResult.errors.slice(0, 20).map((err) => (
                        <li key={err.rowNumber}>
                          <span className="font-semibold">
                            行 {err.rowNumber}:
                          </span>{" "}
                          {err.messages.join(" / ")}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            <form onSubmit={handleCsvImport} className="space-y-3">
              <div>
                <label className="block text-[11px] text-gray-700 mb-1">
                  CSVファイル
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) =>
                    setCsvFile(e.target.files?.[0] ?? null)
                  }
                  className="block w-full text-[11px] text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-gray-300 file:text-[11px] file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeCsvImportModal}
                  disabled={csvImporting}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 text-[11px] text-gray-700 disabled:opacity-60"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={csvImporting}
                  className="inline-flex items-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-[11px] font-semibold shadow-sm disabled:opacity-60"
                >
                  {csvImporting ? '処理中...' : '取り込みを実行'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </TenantLayout>
  );
}
