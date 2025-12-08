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
  // ★ 追加：destination（BotユーザーID）
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
    // ★ 追加
    destination: "",
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
          // ★ ここで destination を反映
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
      // ← ここもフォームレベルに寄せる（画面はそのまま）
      setFormError(err?.message ?? "LINE設定の保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">読み込み中...</div>;
  }

  if (pageError) {
    return (
      <div className="p-4 text-red-600">
        <p>{pageError}</p>
        <button
          className="mt-4 px-3 py-1 text-sm border rounded"
          onClick={() => router.push("/")}
        >
          トップへ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold mb-2">
        テナントID: {tenantId} の LINE 設定
      </h1>

      {formError && (
        <div className="border border-red-400 bg-red-50 text-red-700 px-3 py-2 text-sm rounded">
          {formError}
        </div>
      )}

      {message && (
        <div className="border border-green-400 bg-green-50 text-green-700 px-3 py-2 text-sm rounded">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 border p-4 rounded">
        <div>
          <label className="block text-sm font-medium mb-1">
            チャネルID (channelId)
          </label>
          <input
            type="text"
            value={form.channelId}
            onChange={(e) => handleChange("channelId", e.target.value)}
            className="w-full border px-3 py-2 rounded text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            チャネルシークレット (channelSecret)
          </label>
          <input
            type="text"
            value={form.channelSecret}
            onChange={(e) => handleChange("channelSecret", e.target.value)}
            className="w-full border px-3 py-2 rounded text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            アクセストークン (accessToken)
          </label>
          <textarea
            value={form.accessToken}
            onChange={(e) => handleChange("accessToken", e.target.value)}
            className="w-full border px-3 py-2 rounded text-sm"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Webhook URL
          </label>
          <input
            type="text"
            value={form.webhookUrl}
            onChange={(e) => handleChange("webhookUrl", e.target.value)}
            className="w-full border px-3 py-2 rounded text-sm"
            placeholder="https://example.com/line/webhook"
          />
          <p className="mt-1 text-xs text-gray-500">
            Render 側の LINE webhook URL を設定してください。
          </p>
        </div>

        {/* ★ 追加：destination 入力欄 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            LINE Bot ユーザーID（destination）
          </label>
          <input
            type="text"
            value={form.destination}
            onChange={(e) => handleChange("destination", e.target.value)}
            className="w-full border px-3 py-2 rounded text-sm"
            placeholder="例: U7caf95752a4384246601f6e782973b8c"
          />
          <p className="mt-1 text-xs text-gray-500">
            LINEのWebhookイベントに含まれる
            <code className="px-1 bg-gray-100 rounded text-[11px]">
              destination
            </code>
            の値です。
            <br />
            ここに設定したIDと受信した destination を突き合わせて、
            「どのテナントのLINE公式アカウントか」を判定します。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="isActive"
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => handleChange("isActive", e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="isActive" className="text-sm">
            LINE 連携を有効にする
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/tenants")}
            className="px-4 py-2 text-sm rounded border"
          >
            テナント一覧に戻る
          </button>
        </div>
      </form>
    </div>
  );
}
