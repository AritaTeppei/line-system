"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type SlotKey = "MORNING" | "AFTERNOON" | "EVENING";
type SlotStatus = "AVAILABLE" | "FULL";

type BookingTargetInfo = {
  tenantId: number;
  customerId: number;
  carId: number;
  customerName: string;
  lineUid: string | null;
  carName: string;
  registrationNumber: string;
  vin: string | null;
  shakenDate: string | null;
  inspectionDate: string | null;
};

type AvailabilityDay = {
  date: string; // "YYYY-MM-DD"
  slots: Record<SlotKey, SlotStatus>;
};

type AvailabilityResponse = {
  tenantId: number;
  month: string; // "YYYY-MM"
  capacityPerSlot: number;
  days: AvailabilityDay[];
};

type CreateResult =
  | { ok: true; bookingId: number }
  | { ok: false; message: string };

function formatDateLabel(dateStr: string) {
  // "YYYY-MM-DD" → "YYYY/MM/DD"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return dateStr.replace(/-/g, "/");
}

function formatSlotLabel(slot: SlotKey) {
  switch (slot) {
    case "MORNING":
      return "午前（10:00〜12:00）";
    case "AFTERNOON":
      return "午後（13:00〜15:00）";
    case "EVENING":
      return "夕方（15:00〜17:00）";
    default:
      return slot;
  }
}

// 指定月の「その月の全日付」を配列で返す
function getDaysInMonth(monthStr: string): string[] {
  // monthStr: "YYYY-MM"
  const year = Number(monthStr.slice(0, 4));
  const monthIndex = Number(monthStr.slice(5, 7)) - 1; // 0-11

  const first = new Date(Date.UTC(year, monthIndex, 1));
  const days: string[] = [];

  let current = first;
  while (current.getUTCMonth() === monthIndex) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    current = new Date(Date.UTC(year, monthIndex, current.getUTCDate() + 1));
  }
  return days;
}

export default function PublicBookingPage() {
  const searchParams = useSearchParams();

  const tenantIdParam = searchParams.get("tenantId");
  const customerIdParam = searchParams.get("customerId");
  const carIdParam = searchParams.get("carId");
  const dateParam = searchParams.get("date") ?? "";

  const tenantId = tenantIdParam ? Number(tenantIdParam) : NaN;
  const customerId = customerIdParam ? Number(customerIdParam) : NaN;
  const carId = carIdParam ? Number(carIdParam) : NaN;

  const showInvalidUrl =
    Number.isNaN(tenantId) ||
    Number.isNaN(customerId) ||
    Number.isNaN(carId);

  // 対象車両情報
  const [targetInfo, setTargetInfo] = useState<BookingTargetInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState<boolean>(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  // 予約日・時間帯・メモ
  const [bookingDate, setBookingDate] = useState<string>(dateParam ?? "");
  const [timeSlot, setTimeSlot] = useState<SlotKey>("MORNING");
  const [note, setNote] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // availability 用の状態
  const initialMonth = useMemo(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return dateParam.slice(0, 7); // "YYYY-MM"
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [dateParam]);

  const [currentMonth, setCurrentMonth] = useState<string>(initialMonth);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(
    null,
  );
  const [availabilityLoading, setAvailabilityLoading] =
    useState<boolean>(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );

  // ▼ 対象車両情報を取得
  useEffect(() => {
    if (showInvalidUrl) {
      setInfoError("URLが不正です。再度リンクからアクセスしてください。");
      return;
    }

    setInfoLoading(true);
    setInfoError(null);

    const url = new URL(
      "http://localhost:4000/public/bookings/info",
      window.location.origin,
    );
    url.searchParams.set("tenantId", String(tenantId));
    url.searchParams.set("customerId", String(customerId));
    url.searchParams.set("carId", String(carId));

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const msg =
            data?.message ||
            (Array.isArray(data?.message) ? data.message.join(", ") : null) ||
            "対象の車両情報の取得に失敗しました。";
          throw new Error(msg);
        }
        return res.json() as Promise<BookingTargetInfo>;
      })
      .then((data) => {
        setTargetInfo(data);
      })
      .catch((err: any) => {
        console.error(err);
        setInfoError(
          err?.message ?? "対象の車両情報の取得中にエラーが発生しました。",
        );
      })
      .finally(() => {
        setInfoLoading(false);
      });
  }, [tenantId, customerId, carId, showInvalidUrl]);

  // ▼ 指定月の availability を取得
  useEffect(() => {
    if (showInvalidUrl) return;
    if (!currentMonth) return;
    if (!tenantId || Number.isNaN(tenantId)) return;

    setAvailabilityLoading(true);
    setAvailabilityError(null);

    const url = new URL(
      "http://localhost:4000/public/bookings/availability",
      window.location.origin,
    );
    url.searchParams.set("tenantId", String(tenantId));
    url.searchParams.set("month", currentMonth);

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const msg =
            data?.message ||
            (Array.isArray(data?.message) ? data.message.join(", ") : null) ||
            "空き状況の取得に失敗しました。";
          throw new Error(msg);
        }
        return res.json() as Promise<AvailabilityResponse>;
      })
      .then((data) => {
        setAvailability(data);
      })
      .catch((err: any) => {
        console.error(err);
        setAvailabilityError(
          err?.message ?? "空き状況の取得中にエラーが発生しました。",
        );
      })
      .finally(() => {
        setAvailabilityLoading(false);
      });
  }, [tenantId, currentMonth, showInvalidUrl]);

  // 指定日の枠ステータスを取得
  const getSlotStatusesForDate = (dateStr: string): Record<SlotKey, SlotStatus> => {
    const base: Record<SlotKey, SlotStatus> = {
      MORNING: "AVAILABLE",
      AFTERNOON: "AVAILABLE",
      EVENING: "AVAILABLE",
    };

    if (!availability) return base;

    const day = availability.days.find((d) => d.date === dateStr);
    if (!day) return base;

    return {
      MORNING: day.slots.MORNING ?? "AVAILABLE",
      AFTERNOON: day.slots.AFTERNOON ?? "AVAILABLE",
      EVENING: day.slots.EVENING ?? "AVAILABLE",
    };
  };

  const handlePrevMonth = () => {
    const [yStr, mStr] = currentMonth.split("-");
    const y = Number(yStr);
    const m = Number(mStr); // 1-12
    const d = new Date(Date.UTC(y, m - 1, 1));
    d.setUTCMonth(d.getUTCMonth() - 1);
    const ny = d.getUTCFullYear();
    const nm = String(d.getUTCMonth() + 1).padStart(2, "0");
    setCurrentMonth(`${ny}-${nm}`);
  };

  const handleNextMonth = () => {
    const [yStr, mStr] = currentMonth.split("-");
    const y = Number(yStr);
    const m = Number(mStr); // 1-12
    const d = new Date(Date.UTC(y, m - 1, 1));
    d.setUTCMonth(d.getUTCMonth() + 1);
    const ny = d.getUTCFullYear();
    const nm = String(d.getUTCMonth() + 1).padStart(2, "0");
    setCurrentMonth(`${ny}-${nm}`);
  };

  const daysInMonth = useMemo(
    () => getDaysInMonth(currentMonth),
    [currentMonth],
  );

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const canSubmit = !showInvalidUrl && !!bookingDate && !!timeSlot;

  const handleSubmit = async () => {
    setError(null);
    setResult(null);

    if (!canSubmit) {
      setError("日付と時間帯を選択してください。");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("http://localhost:4000/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          customerId,
          carId,
          bookingDate,
          timeSlot,
          note: note || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data?.message ||
          (Array.isArray(data?.message) ? data.message.join(", ") : null) ||
          "ご予約の送信中にエラーが発生しました。";
        throw new Error(msg);
      }

      const data = (await res.json()) as { ok: boolean; bookingId: number };
      setResult({ ok: true, bookingId: data.bookingId });
    } catch (err: any) {
      console.error(err);
      setResult({
        ok: false,
        message:
          err?.message ??
          "ご予約の送信中にエラーが発生しました。時間をおいて再度お試しください。",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex justify-center items-start bg-gray-100 px-3 py-6">
      <div className="w-full max-w-[480px] bg-white rounded-lg shadow p-4 text-sm">
        <h1 className="text-lg font-bold mb-2 text-center">
          車検・点検 予約フォーム
        </h1>
        <p className="text-xs text-gray-600 mb-4 text-center">
          メッセージをお送りした店舗へのご予約フォームです。
          空き状況をご確認のうえ、日付と時間帯をお選びください。
        </p>

        {showInvalidUrl && (
          <div className="mb-4 text-xs text-red-600">
            URLが不正です。もう一度メッセージ内のリンクからアクセスしてください。
          </div>
        )}

        {/* 対象車両情報 */}
        {!showInvalidUrl && (
          <div className="mb-4 border rounded-md px-3 py-2 bg-gray-50">
            <p className="text-xs font-semibold mb-1">ご予約対象のお車</p>

            {infoLoading && (
              <p className="text-[11px] text-gray-500">車両情報を読み込み中...</p>
            )}

            {infoError && (
              <p className="text-[11px] text-red-600 whitespace-pre-wrap">
                {infoError}
              </p>
            )}

            {targetInfo && (
              <div className="text-[11px] space-y-0.5">
                <p>
                  お客様:{" "}
                  <span className="font-semibold">
                    {targetInfo.customerName}
                  </span>
                </p>
                <p>
                  車名:{" "}
                  <span className="font-semibold">
                    {targetInfo.carName}
                  </span>
                </p>
                <p>
                  登録番号:{" "}
                  <span className="font-semibold">
                    {targetInfo.registrationNumber}
                  </span>
                </p>
                {targetInfo.shakenDate && (
                  <p>
                    車検満了日:{" "}
                    <span className="font-semibold">
                      {targetInfo.shakenDate}
                    </span>
                  </p>
                )}
                {targetInfo.inspectionDate && (
                  <p>
                    点検予定日:{" "}
                    <span className="font-semibold">
                      {targetInfo.inspectionDate}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 結果メッセージ */}
        {result?.ok && (
          <div className="mb-4 border border-green-300 bg-green-50 text-xs text-green-800 rounded px-3 py-2">
            ご予約を受け付けました。担当者からのご連絡をお待ちください。
            <br />
            予約番号: {result.bookingId}
          </div>
        )}
        {result && !result.ok && (
          <div className="mb-4 border border-red-300 bg-red-50 text-xs text-red-800 rounded px-3 py-2 whitespace-pre-wrap">
            {result.message}
          </div>
        )}
        {error && (
          <div className="mb-3 text-xs text-red-600 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* カレンダー */}
        <div className="mb-4 border rounded-md px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              className="text-xs text-blue-600"
              onClick={handlePrevMonth}
            >
              ＜ 前の月
            </button>
            <p className="text-xs font-semibold">
              {currentMonth.replace("-", "年") + "月"}
            </p>
            <button
              type="button"
              className="text-xs text-blue-600"
              onClick={handleNextMonth}
            >
              次の月 ＞
            </button>
          </div>

          {availabilityLoading && (
            <p className="text-[11px] text-gray-500 mb-1">
              空き状況を読み込み中...
            </p>
          )}
          {availabilityError && (
            <p className="text-[11px] text-red-600 mb-1 whitespace-pre-wrap">
              {availabilityError}
            </p>
          )}

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] mb-1">
            <span>日</span>
            <span>月</span>
            <span>火</span>
            <span>水</span>
            <span>木</span>
            <span>金</span>
            <span>土</span>
          </div>

          {/* 簡易的に「1日目の曜日」から埋める */}
          {(() => {
            const year = Number(currentMonth.slice(0, 4));
            const monthIndex = Number(currentMonth.slice(5, 7)) - 1;
            const first = new Date(Date.UTC(year, monthIndex, 1));
            const firstWeekday = first.getUTCDay(); // 0-6 (日曜始まり)

            const cells: (string | null)[] = [];
            for (let i = 0; i < firstWeekday; i++) cells.push(null);
            for (const d of daysInMonth) cells.push(d);

            // 7の倍数になるように末尾を埋める
            while (cells.length % 7 !== 0) cells.push(null);

            return (
              <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                {cells.map((d, idx) => {
                  if (!d) {
                    return (
                      <div key={idx} className="h-7 text-gray-300 text-[10px]" />
                    );
                  }

                  const slots = getSlotStatusesForDate(d);
                  const allFull =
                    slots.MORNING === "FULL" &&
                    slots.AFTERNOON === "FULL" &&
                    slots.EVENING === "FULL";

                  const isPast = d < todayStr; // 雑に文字列比較（フォーマット固定なのでOK）

                  const isSelected = bookingDate === d;

                  const disabled = allFull || isPast;

                  const baseClass =
                    "h-7 flex items-center justify-center rounded cursor-pointer border";
                  const colorClass = disabled
                    ? "bg-gray-200 text-gray-400 border-gray-200"
                    : isSelected
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-800 border-gray-300";

                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={disabled}
                      className={`${baseClass} ${colorClass}`}
                      onClick={() => {
                        if (disabled) return;
                        setBookingDate(d);
                      }}
                    >
                      {Number(d.slice(8, 10))}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          <p className="mt-1 text-[10px] text-gray-500">
            ※ × 表示の日は全ての時間帯が満席です。過去の日付は選択できません。
          </p>
        </div>

        {/* 時間帯選択 */}
        <div className="mb-4">
          <p className="text-xs font-semibold mb-1">ご希望の時間帯</p>
          {!bookingDate && (
            <p className="text-[11px] text-gray-500 mb-1">
              まずカレンダーから日付をお選びください。
            </p>
          )}

          {bookingDate && (
            <div className="flex flex-col gap-2">
              {(["MORNING", "AFTERNOON", "EVENING"] as SlotKey[]).map(
                (slot) => {
                  const statuses = getSlotStatusesForDate(bookingDate);
                  const status = statuses[slot];
                  const disabled = status === "FULL";

                  return (
                    <label
                      key={slot}
                      className={`border rounded p-2 flex items-center gap-2 text-xs ${
                        disabled
                          ? "bg-gray-100 text-gray-400"
                          : "bg-white text-gray-800"
                      }`}
                    >
                      <input
                        type="radio"
                        name="slot"
                        value={slot}
                        disabled={disabled}
                        checked={timeSlot === slot}
                        onChange={() => setTimeSlot(slot)}
                      />
                      <span>{formatSlotLabel(slot)}</span>
                      <span className="ml-auto text-[10px]">
                        {status === "FULL" ? "満席" : "空きあり"}
                      </span>
                    </label>
                  );
                },
              )}
            </div>
          )}
        </div>

        {/* メモ欄 */}
        <div className="mb-4">
          <p className="text-xs font-semibold mb-1">メモ・補足（任意）</p>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm min-h-[70px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ご希望があればご記入ください（例：代車希望／一緒にオイル交換も など）"
          />
        </div>

        {/* 送信ボタン */}
        <button
          className="w-full py-2 rounded text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60"
          disabled={submitting || !canSubmit}
          onClick={handleSubmit}
        >
          {submitting ? "送信中..." : "この内容で予約する"}
        </button>

        <p className="mt-3 text-[10px] text-gray-400 text-center">
          本フォームは、車検・点検予約の受付専用です。
          内容によっては折り返しのお電話にて確認させていただく場合があります。
        </p>
      </div>
    </main>
  );
}
