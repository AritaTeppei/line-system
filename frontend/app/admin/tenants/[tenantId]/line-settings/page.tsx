"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Role = "DEVELOPER" | "MANAGER" | "CLIENT";

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
};

type LineSettings = {
  tenantId: number;
  channelId: string | null;
  channelSecret: string | null;
  accessToken: string | null;
  webhookUrl: string | null;
  destination: string | null;
  isActive: boolean;
};

export default function TenantLineSettingsPage() {
  const router = useRouter();
  const params = useParams();

  const tenantId = Number(params.tenantId);

  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState({
    channelId: "",
    channelSecret: "",
    accessToken: "",
    webhookUrl: "",
    destination: "",
    isActive: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

    const headers = { Authorization: `Bearer ${savedToken}` };

    const fetchMe = fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers,
    })
      .then((res) => {
        if (!res.ok) throw new Error("auth me error");
        return res.json() as Promise<Me>;
      })
      .then((data) => {
        setMe(data);
        if (data.role !== "DEVELOPER") {
          throw new Error("このページは開発者ユーザー専用です");
        }
      });

    const fetchLineSettings = fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/tenants/${tenantId}/line-settings`,
      { headers },
    )
      .then((res) => {
        if (!res.ok) throw new Error("line settings api error");
        return res.json() as Promise<LineSettings>;
      })
      .then((data) => {
        setForm({
          channelId: data.channelId ?? "",
          channelSecret: data.channelSecret ?? "",
          accessToken: data.accessToken ?? "",
          webhookUrl: data.webhookUrl ?? "",
          destination: data.destination ?? "",
          isActive: data.isActive ?? false,
        });
      });

    Promise.all([fetchMe, fetchLineSettings])
      .catch((err: any) => {
        console.error(err);
        setPageError(
          err?.message ??
            "ページの読み込みに失敗しました。ログイン状態や権限を確認してください。",
        );
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleChange = (
    key: keyof typeof form,
    value: string | boolean,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === "isActive" ? Boolean(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setMessage(null);

    if (!form.channelId.trim()) {
      setFormError("チャネルIDは必須です。");
      setSaving(false);
      return;
    }
    if (!form.channelSecret.trim()) {
      setFormError("チャネルシークレットは必須です。");
      setSaving(false);
      return;
    }
    if (!form.accessToken.trim()) {
      setFormError("アクセストークンは必須です。");
      setSaving(false);
      return;
    }
    if (form.webhookUrl && !form.webhookUrl.startsWith("https://")) {
      setFormError("Webhook URLは https:// から始まる必要があります。");
      setSaving(false);
      return;
    }

    try {
      const savedToken =
        typeof window !== "undefined"
          ? window.localStorage.getItem("auth_token")
          : null;

      if (!savedToken) {
        throw new Error("トークンがありません。ログインし直してください。");
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tenants/${tenantId}/line-settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${savedToken}`,
          },
          body: JSON.stringify(form),
        },
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Error response:", text);
        throw new Error(`保存に失敗しました (status: ${res.status})`);
      }

      setMessage("LINE設定を保存しました。");
    } catch (err: any) {
      console.error(err);
      setFormError(err?.message ?? "LINE設定の保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">読み込み中...</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
        <div className="rounded-xl bg-red-950/60 border border-red-800 px-6 py-4 text-red-300 text-sm max-w-sm w-full text-center">
          {pageError}
        </div>
        <button
          className="text-sm text-gray-500 hover:text-gray-300 underline underline-offset-2"
          onClick={() => router.push("/")}
        >
          トップへ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 sm:px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push(`/admin/tenants/${tenantId}/edit`)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          テナント編集へ
        </button>
        <span className="text-gray-700">|</span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-green-400 font-bold text-sm">📡</span>
          <h1 className="text-sm font-semibold text-white truncate">
            LINE設定 — テナントID: {tenantId}
          </h1>
        </div>
        <button
          onClick={() => router.push("/admin/overview")}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors hidden sm:block"
        >
          オーバービューへ
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Success Banner */}
        {message && (
          <div className="rounded-xl bg-green-950/60 border border-green-700 px-4 py-3 flex items-center gap-3">
            <span className="text-green-400 text-lg">✓</span>
            <p className="text-green-300 text-sm font-medium">{message}</p>
            <button
              onClick={() => setMessage(null)}
              className="ml-auto text-green-600 hover:text-green-400 text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Error Banner */}
        {formError && (
          <div className="rounded-xl bg-red-950/60 border border-red-800 px-4 py-3 flex items-center gap-3">
            <span className="text-red-400 text-lg">!</span>
            <p className="text-red-300 text-sm">{formError}</p>
            <button
              onClick={() => setFormError(null)}
              className="ml-auto text-red-600 hover:text-red-400 text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* LINE Credentials Card */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
              <span className="text-base">🔑</span>
              <h2 className="text-sm font-bold text-white">LINE Messaging API 認証情報</h2>
            </div>
            <div className="px-5 py-5 space-y-4">

              {/* Channel ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  チャネルID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.channelId}
                  onChange={(e) => handleChange("channelId", e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 placeholder-gray-600 outline-none focus:border-green-500 transition-colors font-mono"
                  placeholder="例: 1234567890"
                />
              </div>

              {/* Channel Secret */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  チャネルシークレット <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.channelSecret}
                  onChange={(e) => handleChange("channelSecret", e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 placeholder-gray-600 outline-none focus:border-green-500 transition-colors font-mono"
                  placeholder="例: abc123def456..."
                />
              </div>

              {/* Access Token */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  アクセストークン <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.accessToken}
                  onChange={(e) => handleChange("accessToken", e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 placeholder-gray-600 outline-none focus:border-green-500 transition-colors font-mono resize-none"
                  rows={3}
                  placeholder="Channel Access Token (長期)"
                />
              </div>
            </div>
          </div>

          {/* Webhook & Destination Card */}
          <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
              <span className="text-base">🌐</span>
              <h2 className="text-sm font-bold text-white">Webhook 設定</h2>
            </div>
            <div className="px-5 py-5 space-y-4">

              {/* Webhook URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Webhook URL
                </label>
                <input
                  type="text"
                  value={form.webhookUrl}
                  onChange={(e) => handleChange("webhookUrl", e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 placeholder-gray-600 outline-none focus:border-green-500 transition-colors font-mono"
                  placeholder="https://your-backend.com/line/webhook"
                />
                <p className="text-xs text-gray-500">
                  バックエンドの LINE Webhook エンドポイントを設定してください。
                </p>
              </div>

              {/* Destination */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  LINE Bot ユーザーID（destination）
                </label>
                <input
                  type="text"
                  value={form.destination}
                  onChange={(e) => handleChange("destination", e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 placeholder-gray-600 outline-none focus:border-green-500 transition-colors font-mono"
                  placeholder="例: U7caf95752a4384246601f6e782973b8c"
                />
                <p className="text-xs text-gray-500">
                  Webhook イベントに含まれる{" "}
                  <code className="px-1 py-0.5 bg-gray-800 rounded text-green-400 text-[11px]">destination</code>{" "}
                  の値。テナントのLINE公式アカウントを識別するために使用します。初回Webhook受信時に自動設定されます。
                </p>
              </div>
            </div>
          </div>

          {/* Active Toggle Card */}
          <div className="rounded-2xl bg-gray-900 border border-gray-800 px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">LINE 連携を有効にする</p>
              <p className="text-xs text-gray-500 mt-0.5">
                無効にするとWebhookイベントが処理されません
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleChange("isActive", !form.isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                form.isActive ? "bg-green-500" : "bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  form.isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 sm:flex-none sm:px-8 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-3 transition-colors"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  保存中...
                </span>
              ) : "保存する"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/admin/tenants/${tenantId}/edit`)}
              className="flex-1 sm:flex-none sm:px-6 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold py-3 transition-colors border border-gray-700"
            >
              キャンセル
            </button>
          </div>
        </form>

        {/* Help Card */}
        <div className="rounded-2xl bg-gray-900/50 border border-gray-800 px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">設定のヒント</p>
          <ul className="space-y-1.5 text-xs text-gray-600">
            <li>• チャネルID・シークレット・アクセストークンは LINE Developers コンソールで確認できます</li>
            <li>• Webhook URLはバックエンドの <code className="text-green-500/70">/line/webhook</code> エンドポイントを指定してください</li>
            <li>• destination は初回のWebhook受信時に自動保存されます（手動設定も可能）</li>
            <li>• LINE連携を有効にするにはすべての必須フィールドの入力が必要です</li>
          </ul>
        </div>

      </main>
    </div>
  );
}
