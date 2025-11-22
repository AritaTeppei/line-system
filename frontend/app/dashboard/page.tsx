"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TenantLayout from "../components/TenantLayout";

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELED";

type Booking = {
  id: number;
  status: BookingStatus;
  bookingDate: string;
};

type ReminderPreview = {
  date: string;
  tenantId: number;
  birthdayTargets: any[];
  shakenTwoMonths: any[];
  shakenOneWeek: any[];
  inspectionOneMonth: any[];
  custom: any[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<ReminderPreview | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);

  const today = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      const savedToken =
        typeof window !== "undefined"
          ? window.localStorage.getItem("auth_token")
          : null;

      if (!savedToken) {
        setError("先にログインしてください（トップページからログイン）");
        setLoading(false);
        return;
      }

      setToken(savedToken);

      try {
        const headers: HeadersInit = {
          Authorization: `Bearer ${savedToken}`,
        };

        // ★ ここを追加：まず /auth/me でテナント有効チェックを通す
        const meRes = await fetch("http://localhost:4000/auth/me", {
          headers,
        });

        if (!meRes.ok) {
          const data = await meRes.json().catch(() => null);
          const msg =
            data?.message ||
            (Array.isArray(data?.message) ? data.message.join(", ") : null) ||
            "認証情報の確認に失敗しました。";

          // ここで throw すると下の catch に入り、error にメッセージが載る
          throw new Error(msg);
        }

        const [remindersRes, bookingsRes] = await Promise.all([
          fetch(
            `http://localhost:4000/reminders/preview?date=${encodeURIComponent(
              today,
            )}`,
            { headers },
          ),
          fetch("http://localhost:4000/bookings", { headers }),
        ]);

        if (!remindersRes.ok) {
          const data = await remindersRes.json().catch(() => null);
          const msg =
            data?.message ||
            (Array.isArray(data?.message) ? data.message.join(", ") : null) ||
            "リマインド情報の取得に失敗しました。";
          throw new Error(msg);
        }
        const remindersJson = (await remindersRes.json()) as ReminderPreview;
        setReminders(remindersJson);

        if (!bookingsRes.ok) {
          const data = await bookingsRes.json().catch(() => null);
          const msg =
            data?.message ||
            (Array.isArray(data?.message) ? data.message.join(", ") : null) ||
            "予約一覧の取得に失敗しました。";
          throw new Error(msg);
        }
        const bookingsJson = (await bookingsRes.json()) as Booking[];
        setBookings(bookingsJson);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ??
            "ダッシュボード情報の取得中にエラーが発生しました。",
        );
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [today]);

  const pendingBookings = bookings.filter(
    (b) => b.status === "PENDING",
  ).length;

  const birthdayCount = reminders?.birthdayTargets.length ?? 0;
  const shaken2MCount = reminders?.shakenTwoMonths.length ?? 0;
  const shaken1WCount = reminders?.shakenOneWeek.length ?? 0;
  const inspection1MCount = reminders?.inspectionOneMonth.length ?? 0;
  const customCount = reminders?.custom.length ?? 0;

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("auth_token");
      // Cookie も使っている場合に備えて一応クリア
      document.cookie = "Authentication=; Max-Age=0; path=/";
      document.cookie = "access_token=; Max-Age=0; path=/";
    }
    router.replace("/");
  };

  // ★ 追加：読み込み中はダッシュボードを描画しない
  if (loading) {
    return (
      <TenantLayout>
        <div className="w-full max-w-[960px]">
          <p className="text-sm">読み込み中...</p>
        </div>
      </TenantLayout>
    );
  }

  // ★ 追加：エラーがあるときもダッシュボードは描画せず、
  //         メッセージだけ出す（ここに「テナントが無効になっています...」が載る）
  if (error) {
    return (
      <TenantLayout>
        <div className="w-full max-w-[960px]">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">ダッシュボード</h1>
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
            >
              ログアウト
            </button>
          </div>
          <p className="text-red-600 text-sm whitespace-pre-wrap mt-4">
            {error}
          </p>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="w-full max-w-[960px]">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">ダッシュボード</h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
          >
            ログアウト
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          本日の状況をまとめて確認できます。
        </p>

        <div className="mb-4">
          <span className="inline-block text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">
            今日：{today}
          </span>
        </div>

        {error && (
          <div className="mb-4 border border-red-300 bg-red-50 text-xs text-red-800 rounded px-3 py-2 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-4 text-sm text-gray-600">読み込み中...</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* 本日のリマインド件数 */}
          <div className="bg-white rounded-lg shadow p-3 text-sm">
            <h2 className="font-semibold mb-2">本日のリマインド件数</h2>
            {reminders ? (
              <div className="space-y-1 text-xs">
                <p>誕生日：{birthdayCount} 件</p>
                <p>車検2ヶ月前：{shaken2MCount} 件</p>
                <p>車検1週間前：{shaken1WCount} 件</p>
                <p>点検1ヶ月前：{inspection1MCount} 件</p>
                <p>カスタム：{customCount} 件</p>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                リマインド対象なし、または読み込み前です。
              </p>
            )}
            <div className="mt-3">
              <a
                href="/reminders"
                className="inline-block text-xs text-blue-600 underline"
              >
                リマインドの詳細を見る →
              </a>
            </div>
          </div>

          {/* 予約状況 */}
          <div className="bg-white rounded-lg shadow p-3 text-sm">
            <h2 className="font-semibold mb-2">予約状況</h2>
            <p className="text-xs mb-1">
              本日時点の「未確認」予約：{pendingBookings} 件
            </p>
            <p className="text-[11px] text-gray-500 mb-2">
              ※ステータスは /bookings から変更できます。
            </p>
            <div className="mt-2">
              <a
                href="/bookings"
                className="inline-block text-xs text-blue-600 underline"
              >
                予約一覧を開く →
              </a>
            </div>
          </div>

          {/* クイックリンク */}
          <div className="bg-white rounded-lg shadow p-3 text-sm">
            <h2 className="font-semibold mb-2">クイックリンク</h2>
            <ul className="text-xs space-y-1">
              <li>
                <a href="/customers" className="text-blue-600 underline">
                  顧客一覧・登録 →
                </a>
              </li>
              <li>
                <a href="/cars" className="text-blue-600 underline">
                  車両一覧・登録 →
                </a>
              </li>
              <li>
                <a href="/logs" className="text-blue-600 underline">
                  メッセージ履歴 →
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}
