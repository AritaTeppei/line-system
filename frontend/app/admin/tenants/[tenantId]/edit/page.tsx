"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Rubik_Doodle_Shadow } from "next/font/google";

type Role = "DEVELOPER" | "MANAGER" | "CLIENT";

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
};

type TenantOverview = {
  id: number;
  name: string;
  email: string | null;
  plan: string | null;
  isActive: boolean;
  validUntil: string | null;
  customersCount: number;
  carsCount: number;
  bookingsCount: number;
};

export default function AdminTenantEditPage() {
  const router = useRouter();
  const params = useParams<{ tenantId: string }>();
  const tenantIdParam = params.tenantId;
  const tenantId = Number(tenantIdParam);

  const [me, setMe] = useState<Me | null>(null);
  const [tenant, setTenant] = useState<TenantOverview | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [validUntil, setValidUntil] = useState<string>(""); // yyyy-MM-dd

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantIdParam || Number.isNaN(tenantId)) {
      setError("URL の ID が不正です");
      setLoading(false);
      return;
    }

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

    const fetchTenant = fetch(
      `http://localhost:4000/admin/tenants/${tenantId}`,
      { headers },
    )
      .then((res) => {
        if (!res.ok) throw new Error("tenant detail api error");
        return res.json() as Promise<TenantOverview>;
      })
      .then((data) => {
        setTenant(data);
        setName(data.name ?? "");
        setEmail(data.email ?? "");
        setPlan(data.plan ?? "");
        setIsActive(data.isActive);

        // validUntil を yyyy-MM-dd に変換（input[type=date] 用）
        if (data.validUntil) {
          const d = new Date(data.validUntil);
          if (!Number.isNaN(d.getTime())) {
            setValidUntil(d.toISOString().slice(0, 10));
          }
        }
      });

    Promise.all([fetchMe, fetchTenant])
      .catch((err: any) => {
        console.error(err);
        setError(
          err?.message ??
            "テナント情報の取得に失敗しました。権限やIDを確認してください。",
        );
      })
      .finally(() => setLoading(false));
  }, [tenantId, tenantIdParam]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("auth_token");
      document.cookie = "Authentication=; Max-Age=0; path=/";
      document.cookie = "access_token=; Max-Age=0; path=/";
    }
    router.replace("/");
  };

  const handleBack = () => {
    router.push("/admin/tenants");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    const savedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;

    if (!savedToken) {
      alert("ログイン情報がありません。再ログインしてください。");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `http://localhost:4000/admin/tenants/${tenant.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${savedToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            plan,
            isActive,
            validUntil: validUntil || null, // 空なら null クリア
          }),
        },
      );

      if (!res.ok) {
        throw new Error("テナント更新APIエラー");
      }

      // 成功したら一覧に戻る
      router.push("/admin/tenants");
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ?? "テナントの更新に失敗しました。コンソールを確認してください。",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">テナント編集</h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
          >
            ログアウト
          </button>
        </div>
        <p className="text-red-600 text-sm whitespace-pre-wrap mb-4">
          {error}
        </p>
        <button
          onClick={handleBack}
          className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
        >
          一覧に戻る
        </button>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">テナント編集</h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
          >
            ログアウト
          </button>
        </div>
        <p className="text-sm">テナントが見つかりませんでした。</p>
        <button
          onClick={handleBack}
          className="mt-3 px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
        >
          一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">テナント編集（ID: {tenant.id}）</h1>
          {me && (
            <div className="mt-1 text-sm text-gray-700">
              ログイン中: {me.email}（role: {me.role}
              {me.tenantId != null
                ? ` / tenantId: ${me.tenantId}`
                : " / 全テナント管理"}
              ）
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleBack}
            className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
          >
            一覧に戻る
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <p className="mb-3 text-red-600 text-sm whitespace-pre-wrap">
          {error}
        </p>
      )}

      {/* 編集フォーム */}
      <form onSubmit={handleSubmit} className="max-w-lg space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            テナント名 <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border px-2 py-1 text-sm rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            メールアドレス <span className="text-red-600">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border px-2 py-1 text-sm rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            プラン <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full border px-2 py-1 text-sm rounded"
            placeholder="trial / standard / premium など"
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">有効フラグ</label>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span className="text-xs text-gray-600">
            チェックが入っている場合のみ有効（◯）として扱います
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            有効期限（空欄で指定なし）
          </label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-48 border px-2 py-1 text-sm rounded"
          />
        </div>

        <div className="flex gap-2 mt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-1.5 text-sm rounded bg-gray-200 hover:bg-gray-300"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
