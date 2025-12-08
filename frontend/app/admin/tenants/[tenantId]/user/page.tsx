"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

type Role = "DEVELOPER" | "MANAGER" | "CLIENT";

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
};

type TenantUser = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  phone: string | null;
};

export default function AdminTenantUsersPage() {
  const router = useRouter();
  const params = useParams<{ tenantId: string }>();
  const tenantId = Number(params.tenantId);

  const [me, setMe] = useState<Me | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規ユーザー作成フォーム
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<"MANAGER" | "CLIENT">("MANAGER");
  const [newInitialPassword, setNewInitialPassword] = useState("");

  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  // パスワードリセット用
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (Number.isNaN(tenantId)) {
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

      try {
        // /auth/me で開発者チェック
        const meRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
          { headers },
        );
        if (!meRes.ok) {
          const data = await meRes.json().catch(() => null);
          let msg = "auth me error";
          const m = data?.message;
          if (typeof m === "string") msg = m;
          else if (Array.isArray(m) && m[0]) msg = String(m[0]);
          throw new Error(msg);
        }
        const meJson = (await meRes.json()) as Me;
        if (meJson.role !== "DEVELOPER") {
          throw new Error("このページは開発者ユーザー専用です");
        }
        setMe(meJson);

        // テナント配下ユーザー一覧
        const usersRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/admin/tenants/${tenantId}/users`,
          { headers },
        );
        if (!usersRes.ok) {
          const data = await usersRes.json().catch(() => null);
          let msg = "ユーザー一覧の取得に失敗しました";
          const m = data?.message;
          if (typeof m === "string") msg = m;
          else if (Array.isArray(m) && m[0]) msg = String(m[0]);
          throw new Error(msg);
        }
        const usersJson = (await usersRes.json()) as TenantUser[];
        setUsers(usersJson);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ??
            "テナントユーザー情報の取得に失敗しました。権限やIDを確認してください。",
        );
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [tenantId]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("auth_token");
      document.cookie = "Authentication=; Max-Age=0; path=/";
      document.cookie = "access_token=; Max-Age=0; path=/";
    }
    router.replace("/");
  };

  const handleBackToEdit = () => {
    router.push(`/admin/tenants/${tenantId}/edit`);
  };

  const handleCreateUser = async () => {
    setCreateMessage(null);
    setResetMessage(null);

    const savedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;
    if (!savedToken) {
      setCreateMessage("トークンがありません。再ログインしてください。");
      return;
    }

    if (!newEmail.trim() || !newInitialPassword.trim()) {
      setCreateMessage("メールアドレスと初期パスワードは必須です。");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/tenants/${tenantId}/users`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${savedToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: newEmail,
            name: newName || null,
            phone: newPhone || null,
            role: newRole,
            initialPassword: newInitialPassword,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        let msg = "ユーザー作成に失敗しました";
        const m = data?.message;
        if (typeof m === "string") msg = m;
        else if (Array.isArray(m) && m[0]) msg = String(m[0]);
        throw new Error(msg);
      }

      const created = (await res.json()) as TenantUser;
      setUsers((prev) => [...prev, created]);

      setCreateMessage("ユーザーを作成しました。");
      setNewEmail("");
      setNewName("");
      setNewPhone("");
      setNewInitialPassword("");
    } catch (err: any) {
      console.error(err);
      setCreateMessage(
        err?.message ?? "ユーザー作成に失敗しました。（詳細はコンソールを参照）",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleStartReset = (userId: number) => {
    setResetMessage(null);
    setResetPasswordInput("");
    setResettingUserId(userId);
  };

  const handleResetPassword = async () => {
    if (resettingUserId == null) return;

    const savedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;
    if (!savedToken) {
      setResetMessage("トークンがありません。再ログインしてください。");
      return;
    }

    if (!resetPasswordInput.trim()) {
      setResetMessage("初期パスワードを入力してください。");
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/tenants/${tenantId}/users/${resettingUserId}/reset-password`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${savedToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            initialPassword: resetPasswordInput,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        let msg = "パスワードリセットに失敗しました";
        const m = data?.message;
        if (typeof m === "string") msg = m;
        else if (Array.isArray(m) && m[0]) msg = String(m[0]);
        throw new Error(msg);
      }

      setResetMessage("初期パスワードをリセットしました。");
      setResettingUserId(null);
      setResetPasswordInput("");
    } catch (err: any) {
      console.error(err);
      setResetMessage(
        err?.message ??
          "パスワードリセットに失敗しました。（詳細はコンソールを参照）",
      );
    }
  };

  // ★ 追加：ユーザー削除
  const handleDeleteUser = async (userId: number) => {
    const savedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;

    if (!savedToken) {
      alert("トークンがありません。再ログインしてください。");
      return;
    }

    const ok = window.confirm("このユーザーを削除します。よろしいですか？");
    if (!ok) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/tenants/${tenantId}/users/${userId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `削除に失敗しました (${res.status}): ${
            text || res.statusText || "不明なエラー"
          }`,
        );
      }

      // 一覧から即時削除
      setUsers((prev) => prev.filter((u) => u.id !== userId));

      alert("ユーザーを削除しました。");
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "削除に失敗しました。");
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">テナント ログインユーザー管理</h1>
        </div>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">テナント ログインユーザー管理</h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
          >
            ログアウト
          </button>
        </div>
        <p className="mb-3 text-red-600 text-sm whitespace-pre-wrap">{error}</p>
        <button
          onClick={handleBackToEdit}
          className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
        >
          テナント編集に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">
            テナント ログインユーザー管理（ID: {tenantId}）
          </h1>
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
            onClick={handleBackToEdit}
            className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
          >
            テナント編集に戻る
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* 新規作成フォーム */}
      <section className="mb-6 border rounded px-4 py-3 bg-white max-w-xl">
        <h2 className="font-semibold text-sm mb-2">
          ログインユーザー追加（MANAGER / CLIENT）
        </h2>
        {createMessage && (
          <div className="mb-2 text-xs whitespace-pre-wrap">
            {createMessage}
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div>
            <label className="block text-xs mb-1">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs mb-1">氏名</label>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs mb-1">連絡先（電話・携帯など）</label>
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs mb-1">ロール</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={newRole}
              onChange={(e) =>
                setNewRole(
                  e.target.value === "CLIENT" ? "CLIENT" : "MANAGER",
                )
              }
            >
              <option value="MANAGER">MANAGER（管理者）</option>
              <option value="CLIENT">CLIENT（一般ユーザー）</option>
            </select>
            <p className="mt-1 text-[11px] text-gray-500">
              CLIENT は開発者画面からのみ追加可能とする運用。
            </p>
          </div>
          <div>
            <label className="block text-xs mb-1">
              初期パスワード <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border rounded px-2 py-1 text-sm"
              value={newInitialPassword}
              onChange={(e) => setNewInitialPassword(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-gray-500">
              初回ログイン用のパスワードを手動で設定。ユーザーはログイン後に任意のパスワードへ変更できます。
            </p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              disabled={creating}
              onClick={handleCreateUser}
              className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {creating ? "作成中..." : "ユーザーを作成"}
            </button>
          </div>
        </div>
      </section>

      {/* パスワードリセット */}
      <section className="mb-6 border rounded px-4 py-3 bg-white max-w-xl">
        <h2 className="font-semibold text-sm mb-2">初期パスワード再発行</h2>
        {resetMessage && (
          <div className="mb-2 text-xs whitespace-pre-wrap">
            {resetMessage}
          </div>
        )}
        <div className="text-xs text-gray-600 mb-2">
          一覧の「初期PWリセット」ボタンから対象ユーザーを選択し、ここで新しい初期パスワードを入力してリセットします。
        </div>
        <div className="mb-2 text-xs">
          対象ユーザーID:{" "}
          {resettingUserId != null ? resettingUserId : "（未選択）"}
        </div>
        <div className="flex gap-2 items-center text-sm">
          <input
            type="text"
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="新しい初期パスワード"
            value={resetPasswordInput}
            onChange={(e) => setResetPasswordInput(e.target.value)}
          />
          <button
            type="button"
            onClick={handleResetPassword}
            className="px-3 py-1 text-xs rounded bg-orange-600 text-white hover:bg-orange-700"
          >
            初期PWリセット実行
          </button>
        </div>
      </section>

      {/* 一覧 */}
      <section className="border rounded px-4 py-3 bg-white max-w-3xl">
        <h2 className="font-semibold text-sm mb-2">
          テナントのログインユーザー一覧
        </h2>
        {users.length === 0 ? (
          <p className="text-sm text-gray-600">
            まだ MANAGER / CLIENT ユーザーが登録されていません。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1 text-left">ID</th>
                  <th className="border px-2 py-1 text-left">メールアドレス</th>
                  <th className="border px-2 py-1 text-left">氏名</th>
                  <th className="border px-2 py-1 text-left">ロール</th>
                  <th className="border px-2 py-1 text-left">連絡先</th>
                  <th className="border px-2 py-1 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="border px-2 py-1">{u.id}</td>
                    <td className="border px-2 py-1">{u.email}</td>
                    <td className="border px-2 py-1">{u.name ?? ""}</td>
                    <td className="border px-2 py-1">{u.role}</td>
                    <td className="border px-2 py-1">{u.phone ?? ""}</td>
                    <td className="border px-2 py-1 space-x-1">
                      <button
                        type="button"
                        onClick={() => handleStartReset(u.id)}
                        className="px-2 py-0.5 text-xs rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
                      >
                        初期PWリセット
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.id)}
                        className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
