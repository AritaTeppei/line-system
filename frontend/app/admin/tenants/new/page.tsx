"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Role = "DEVELOPER" | "MANAGER" | "CLIENT";

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
};

type CreateTenantBody = {
  name: string;
  email: string;
  plan: string;
  isActive: boolean;
  validUntil: string | null; // ISO 文字列 or null
};

export default function NewTenantPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // フォームの状態
  const [name, setName] = useState("");
  const [email, setEmail] = useState(""); // 契約・管理用の代表メール（Tenant.email 用）
  const [plan, setPlan] = useState("STANDARD");
  const [isActive, setIsActive] = useState(true);
  const [validUntil, setValidUntil] = useState<string>(""); // yyyy-MM-dd

  // 認証＆開発者チェック
  useEffect(() => {
    const savedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;

    if (!savedToken) {
      setError("先にログインしてください（トップページからログイン）");
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${savedToken}` };

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error("auth me error");
        return res.json() as Promise<Me>;
      })
      .then((data) => {
        if (data.role !== "DEVELOPER") {
          throw new Error("このページは開発者ユーザー専用です");
        }
        setMe(data);
      })
      .catch((err: any) => {
        console.error(err);
        setError(
          err?.message ??
            "ユーザー情報の取得に失敗しました。権限を確認してください。",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const handleBack = () => {
    router.push("/admin/tenants");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // 簡易バリデーション（必要最低限）
    if (!name.trim()) {
      setError("テナント名（会社名）は必須です。");
      return;
    }
    if (!email.trim()) {
      setError("テナントの代表メールアドレスは必須です。");
      return;
    }

    const savedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;

    if (!savedToken) {
      setError("ログイン情報が失われました。再度ログインしてください。");
      return;
    }

    const body: CreateTenantBody = {
      name: name.trim(),
      email: email.trim(),
      plan: plan.trim(),
      isActive,
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
    };

    setSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/tenants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${savedToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("create tenant error:", res.status, text);
        setError(
          `テナントの作成に失敗しました (status: ${res.status})\n${text}`,
        );
        return;
      }

      setSuccess("テナントを作成しました。テナント一覧へ戻ります。");
      // 少し待ってから一覧へ戻す
      setTimeout(() => {
        router.push("/admin/tenants");
      }, 800);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ?? "テナントの作成中にエラーが発生しました。",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">読み込み中...</div>;
  }

  if (error && !me) {
    // 認証 or 権限エラー時
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-3">新規テナント作成</h1>
        <p className="text-red-600 text-sm whitespace-pre-wrap mb-4">
          {error}
        </p>
        <button
          onClick={handleBack}
          className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
        >
          テナント一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">新規テナント作成</h1>
          {me && (
            <div className="mt-1 text-sm text-gray-700">
              ログイン中: {me.email}（role: {me.role}）
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleBack}
            className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
            type="button"
          >
            テナント一覧に戻る
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-600 whitespace-pre-wrap">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 text-sm text-green-700 whitespace-pre-wrap">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 border p-4 rounded">
        {/* 会社名 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            テナント名（会社名） <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full border rounded px-2 py-1 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例）○○自動車整備工場"
          />
        </div>

        {/* 代表メール（Tenant.email 用） */}
        <div>
          <label className="block text-sm font-medium mb-1">
            テナント代表メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            className="w-full border rounded px-2 py-1 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="例）info@example.com"
          />
          <p className="text-xs text-gray-500 mt-1">
            契約連絡や管理に使う代表メールアドレスです（Tenant.email）。
          </p>
        </div>

        {/* プラン */}
        <div>
          <label className="block text-sm font-medium mb-1">プラン</label>
          <input
            type="text"
            className="w-full border rounded px-2 py-1 text-sm"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder="例）STANDARD / PREMIUM など"
          />
        </div>

        {/* 有効フラグ */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">有効フラグ</label>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span className="text-xs text-gray-500">
            チェックが入っている場合、このテナントは有効です。
          </span>
        </div>

        {/* 有効期限 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            有効期限（任意）
          </label>
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            空のままでも作成できます。入力した場合はその日付まで有効として扱います。
          </p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "作成中..." : "この内容でテナントを作成"}
          </button>
        </div>
      </form>
    </div>
  );
}
