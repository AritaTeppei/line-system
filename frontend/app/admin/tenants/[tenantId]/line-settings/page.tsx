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
    isActive: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 🔴 画面ごと止める系（認証エラー・API死んでる等）
  const [pageError, setPageError] = useState<string | null>(null);
  // 🟠 フォーム入力ミスや保存失敗用（画面はそのまま）
  const [formError, setFormError] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);

  // 認証チェック＆開発者限定チェック
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

    const fetchMe = fetch("http://localhost:4000/auth/me", { headers })
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
      `http://localhost:4000/tenants/${tenantId}/line-settings`,
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
          isActive: data.isActive ?? false,
        });
      });

    Promise.all([fetchMe, fetchLineSettings])
      .catch((err: any) => {
        console.error(err);
        setPageError(
          err?.message ??
            "LINE設定の取得に失敗しました。権限やテナントを確認してください。",
        );
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("auth_token");
      document.cookie = "Authentication=; Max-Age=0; path=/";
      document.cookie = "access_token=; Max-Age=0; path=/";
    }
    router.replace("/");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null); // ← フォームエラーだけ消す
    setMessage(null);

    // 🔍 入力チェック（画面はそのままでエラーメッセージだけ出す）
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

    // 必須ではないが URL の形式チェック
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
        `http://localhost:4000/tenants/${tenantId}/line-settings`,
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
      // ← ここもフォームレベルに寄せる（画面はそのまま）
      setFormError(err?.message ?? "LINE設定の保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">読み込み中...</div>;
  }

  // 🔴 ログインしてない／権限なし／API自体が死んでる時だけ、別画面
  if (pageError) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">
            テナント {tenantId} の LINE 設定（開発者専用）
          </h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
          >
            ログアウト
          </button>
        </div>
        <p className="text-red-600 text-sm whitespace-pre-wrap">
          {pageError}
        </p>
        <button
          onClick={() => router.push("/admin/tenants")}
          className="mt-3 px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
        >
          テナント一覧に戻る
        </button>
      </div>
    );
  }

  // 🟢 通常ケース：フォームを表示したまま、上にメッセージを出す
  return (
    <div className="p-4 max-w-xl">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">
          テナント {tenantId} の LINE 設定（開発者専用）
        </h1>
        <button
          onClick={handleLogout}
          className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
        >
          ログアウト
        </button>
      </div>

      {me && (
        <div className="mb-4 text-sm text-gray-700">
          ログイン中: {me.email}（role: {me.role}）
        </div>
      )}

      {/* 成功メッセージ */}
      {message && (
        <div className="mb-3 text-sm text-green-600">{message}</div>
      )}

      {/* 入力ミス or 保存時エラー */}
      {formError && (
        <div className="mb-3 text-sm text-red-600">{formError}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            チャネルID
          </label>
          <input
            name="channelId"
            value={form.channelId}
            onChange={handleChange}
            className="border rounded w-full px-2 py-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            チャネルシークレット
          </label>
          <input
            name="channelSecret"
            type="password"
            value={form.channelSecret}
            onChange={handleChange}
            className="border rounded w-full px-2 py-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            アクセストークン
          </label>
          <input
            name="accessToken"
            type="password"
            value={form.accessToken}
            onChange={handleChange}
            className="border rounded w-full px-2 py-1"
          />
          <p className="text-xs text-gray-500 mt-1">
            長期チャネルアクセストークンをそのまま貼り付け
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Webhook URL（表示用）
          </label>
          <input
            name="webhookUrl"
            value={form.webhookUrl}
            onChange={handleChange}
            className="border rounded w-full px-2 py-1"
            placeholder="https://example.com/line/webhook"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="isActive"
            name="isActive"
            type="checkbox"
            checked={form.isActive}
            onChange={handleChange}
          />
          <label htmlFor="isActive" className="text-sm">
            このテナントで LINE 連携を有効にする
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/tenants")}
            className="px-4 py-2 rounded bg-gray-200 text-sm"
          >
            テナント一覧に戻る
          </button>
        </div>
      </form>
    </div>
  );
}
