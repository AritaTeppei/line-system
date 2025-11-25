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

export default function AdminTenantsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [tenants, setTenants] = useState<TenantOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    const fetchMe = fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, { headers })
  .then(async (res) => {
    if (!res.ok) {
      let msg = "auth me error";
      try {
        const data = await res.json();
        if (typeof data?.message === "string") {
          msg = data.message;
        } else if (Array.isArray(data?.message) && data.message[0]) {
          msg = data.message[0];
        }
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    return res.json() as Promise<Me>;
  })
  .then((data) => {
    setMe(data);
    if (data.role !== "DEVELOPER") {
      throw new Error("このページは開発者ユーザー専用です");
    }
  });

    const fetchTenants = fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/admin/tenants/overview`,
      { headers },
    )
      .then((res) => {
        if (!res.ok) throw new Error("tenants overview api error");
        return res.json() as Promise<TenantOverview[]>;
      })
      .then((data) => {
        setTenants(data);
      });

    Promise.all([fetchMe, fetchTenants])
      .catch((err: any) => {
        console.error(err);
        setError(
          err?.message ??
            "開発者オーバービューの取得に失敗しました。権限を確認してください。",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("auth_token");
      document.cookie = "Authentication=; Max-Age=0; path=/";
      document.cookie = "access_token=; Max-Age=0; path=/";
    }
    router.replace("/");
  };

  // ★ 追加：新規テナント作成ボタン
  const handleCreateTenant = () => {
    router.push("/admin/tenants/new");
  };

    // ★ 追加：テナント編集ボタン（編集ページへ遷移）
  const handleEditTenant = (id: number) => {
    router.push(`/admin/tenants/${id}/edit`);
  };

  // ★ 追加：テナント削除ボタン（API叩いて一覧から削除）
  const handleDeleteTenant = async (id: number) => {
    const ok = window.confirm(
      `テナント ID: ${id} を削除しますか？\n関連するデータがある場合は消える可能性があります。`,
    );
    if (!ok) return;

    const savedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;

    if (!savedToken) {
      alert("ログイン情報がありません。再ログインしてください。");
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/tenants/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      });

      if (!res.ok) {
        throw new Error("テナント削除APIエラー");
      }

      // 削除成功したので state を更新
      setTenants((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
      alert("テナントの削除に失敗しました。コンソールログを確認してください。");
    }
  };

  if (loading) {
    return <div className="p-4">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">開発者オーバービュー</h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
          >
            ログアウト
          </button>
        </div>
        <p className="text-red-600 text-sm whitespace-pre-wrap">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* 上部ヘッダー＋新規テナント作成ボタン */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">開発者オーバービュー（テナント一覧）</h1>
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
          {/* ★ 新規テナント作成ボタン */}
          <button
            onClick={handleCreateTenant}
            className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
          >
            新規テナントを作成
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
          >
            ログアウト
          </button>
        </div>
      </div>

      {tenants.length === 0 ? (
        <p>まだテナントがありません。</p>
      ) : (
        <table className="min-w-full border border-gray-300 text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">ID</th>
              <th className="border px-2 py-1">テナント名</th>
              <th className="border px-2 py-1">メール</th>
              <th className="border px-2 py-1">プラン</th>
              <th className="border px-2 py-1">有効</th>
              <th className="border px-2 py-1">有効期限</th>
              <th className="border px-2 py-1">顧客数</th>
              <th className="border px-2 py-1">車両数</th>
              <th className="border px-2 py-1">予約数</th>
              <th className="border px-2 py-1">設定</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className="border px-2 py-1 text-right">{t.id}</td>
                <td className="border px-2 py-1">{t.name}</td>
                <td className="border px-2 py-1">{t.email ?? "-"}</td>
                <td className="border px-2 py-1">{t.plan ?? "-"}</td>
                <td className="border px-2 py-1 text-center">
                  {t.isActive ? "◯" : "✕"}
                </td>
                <td className="border px-2 py-1">
                  {t.validUntil
                    ? new Date(t.validUntil).toLocaleDateString("ja-JP")
                    : "-"}
                </td>
                <td className="border px-2 py-1 text-right">
                  {t.customersCount}
                </td>
                <td className="border px-2 py-1 text-right">{t.carsCount}</td>
                <td className="border px-2 py-1 text-right">
                  {t.bookingsCount}
                </td>
                <td className="border px-2 py-1 text-center">
  <div className="flex items-center justify-center gap-2">
    {/* 編集ボタン */}
    <button
      onClick={() => handleEditTenant(t.id)}
      className="px-2 py-0.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
    >
      編集
    </button>

    {/* 削除ボタン */}
    <button
      onClick={() => handleDeleteTenant(t.id)}
      className="px-2 py-0.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
    >
      削除
    </button>

    {/* 既存の LINE 設定リンク */}
    <button
      onClick={() =>
        router.push(`/admin/tenants/${t.id}/line-settings`)
      }
      className="text-xs text-blue-600 underline"
    >
      LINE設定
    </button>
  </div>
</td>

              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
