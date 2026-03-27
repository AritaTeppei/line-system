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

const inputCls =
  "w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-sm px-4 py-2.5 placeholder-gray-600 outline-none focus:border-green-500 transition-colors";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-400 flex items-center gap-1">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-600">{hint}</p>}
    </div>
  );
}

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
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  // パスワードリセット
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);

  // 削除確認モーダル
  const [deleteTargetUser, setDeleteTargetUser] = useState<TenantUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        const meRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
          { headers },
        );
        if (!meRes.ok) throw new Error("auth me error");
        const meJson = (await meRes.json()) as Me;
        if (meJson.role !== "DEVELOPER") {
          throw new Error("このページは開発者ユーザー専用です");
        }
        setMe(meJson);

        const usersRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/admin/tenants/${tenantId}/users`,
          { headers },
        );
        if (!usersRes.ok) throw new Error("ユーザー一覧の取得に失敗しました");
        const usersJson = (await usersRes.json()) as TenantUser[];
        setUsers(usersJson);
      } catch (err: any) {
        setError(err?.message ?? "データ取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [tenantId]);

  const handleCreateUser = async () => {
    setCreateError(null);
    setCreateSuccess(false);

    const savedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;
    if (!savedToken) { setCreateError("再ログインしてください。"); return; }
    if (!newEmail.trim() || !newInitialPassword.trim()) {
      setCreateError("メールアドレスと初期パスワードは必須です。");
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
        const m = data?.message;
        const msg = typeof m === "string" ? m : Array.isArray(m) ? m[0] : "ユーザー作成に失敗しました";
        throw new Error(msg);
      }

      const created = (await res.json()) as TenantUser;
      setUsers((prev) => [...prev, created]);
      setCreateSuccess(true);
      setNewEmail(""); setNewName(""); setNewPhone(""); setNewInitialPassword("");
    } catch (err: any) {
      setCreateError(err?.message ?? "ユーザー作成に失敗しました。");
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async () => {
    if (resettingUserId == null) return;
    setResetError(null);
    setResetSuccess(false);

    const savedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;
    if (!savedToken) { setResetError("再ログインしてください。"); return; }
    if (!resetPasswordInput.trim()) { setResetError("新しいパスワードを入力してください。"); return; }

    setResettingPw(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/tenants/${tenantId}/users/${resettingUserId}/reset-password`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${savedToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ initialPassword: resetPasswordInput }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const m = data?.message;
        const msg = typeof m === "string" ? m : Array.isArray(m) ? m[0] : "リセットに失敗しました";
        throw new Error(msg);
      }

      setResetSuccess(true);
      setResettingUserId(null);
      setResetPasswordInput("");
    } catch (err: any) {
      setResetError(err?.message ?? "パスワードリセットに失敗しました。");
    } finally {
      setResettingPw(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTargetUser) return;
    const savedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;
    if (!savedToken) { setDeleteError("再ログインしてください。"); return; }

    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/tenants/${tenantId}/users/${deleteTargetUser.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${savedToken}` },
        },
      );

      if (!res.ok) {
        throw new Error(`削除に失敗しました (${res.status})`);
      }

      setUsers((prev) => prev.filter((u) => u.id !== deleteTargetUser.id));
      setDeleteTargetUser(null);
    } catch (err: any) {
      setDeleteError(err?.message ?? "削除に失敗しました。");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
        <div className="rounded-xl bg-red-950/60 border border-red-800 px-6 py-4 text-red-300 text-sm max-w-sm w-full text-center">
          {error}
        </div>
        <button
          className="text-sm text-gray-500 hover:text-gray-300 underline underline-offset-2"
          onClick={() => router.push(`/admin/tenants/${tenantId}/edit`)}
        >
          テナント編集に戻る
        </button>
      </div>
    );
  }

  const resettingUser = users.find((u) => u.id === resettingUserId);

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
          <span className="text-purple-400 font-bold text-sm">👤</span>
          <h1 className="text-sm font-semibold text-white truncate">
            ユーザー管理 — テナントID: {tenantId}
          </h1>
        </div>
        <button
          onClick={() => router.push("/admin/overview")}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors hidden sm:block"
        >
          オーバービューへ
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Success banners */}
        {createSuccess && (
          <div className="rounded-xl bg-green-950/60 border border-green-700 px-4 py-3 flex items-center gap-3">
            <span className="text-green-400">✓</span>
            <p className="text-green-300 text-sm font-medium">ユーザーを作成しました。</p>
            <button onClick={() => setCreateSuccess(false)} className="ml-auto text-green-600 hover:text-green-400 text-lg leading-none">×</button>
          </div>
        )}
        {resetSuccess && (
          <div className="rounded-xl bg-green-950/60 border border-green-700 px-4 py-3 flex items-center gap-3">
            <span className="text-green-400">✓</span>
            <p className="text-green-300 text-sm font-medium">初期パスワードをリセットしました。</p>
            <button onClick={() => setResetSuccess(false)} className="ml-auto text-green-600 hover:text-green-400 text-lg leading-none">×</button>
          </div>
        )}

        {/* ユーザー一覧 */}
        <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">ログインユーザー一覧</h2>
            <span className="text-xs text-gray-500">{users.length} 名</span>
          </div>

          {users.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">
              まだ MANAGER / CLIENT ユーザーが登録されていません。
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {users.map((u) => (
                <div key={u.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
                      {(u.name ?? u.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{u.name ?? "（名前なし）"}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      {u.phone && <p className="text-xs text-gray-500">{u.phone}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      u.role === "MANAGER"
                        ? "bg-blue-900/60 text-blue-300 border border-blue-700"
                        : "bg-gray-800 text-gray-400 border border-gray-700"
                    }`}>
                      {u.role}
                    </span>
                    <span className="text-[11px] text-gray-600">#{u.id}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setResettingUserId(u.id);
                        setResetPasswordInput("");
                        setResetError(null);
                        setResetSuccess(false);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-amber-900/40 text-amber-300 border border-amber-800 hover:bg-amber-900/70 transition-colors"
                    >
                      PW リセット
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeleteTargetUser(u); setDeleteError(null); }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-950/40 text-red-400 border border-red-900 hover:bg-red-950/70 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 新規ユーザー作成 */}
        <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-bold text-white">➕ ユーザーを追加</h2>
            <p className="text-xs text-gray-500 mt-0.5">MANAGER または CLIENT ユーザーを作成します</p>
          </div>
          <div className="px-5 py-5 space-y-4">
            {createError && (
              <div className="rounded-xl bg-red-950/60 border border-red-800 px-4 py-3 flex items-center gap-2">
                <p className="text-red-300 text-xs flex-1">{createError}</p>
                <button onClick={() => setCreateError(null)} className="text-red-600 hover:text-red-400 text-lg leading-none">×</button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="メールアドレス" required>
                <input
                  type="email"
                  className={inputCls}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@garage.jp"
                />
              </Field>
              <Field label="氏名">
                <input
                  type="text"
                  className={inputCls}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="山田 太郎"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="連絡先">
                <input
                  type="text"
                  className={inputCls}
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="09012345678"
                />
              </Field>
              <Field label="ロール">
                <select
                  className={inputCls + " cursor-pointer"}
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value === "CLIENT" ? "CLIENT" : "MANAGER")
                  }
                >
                  <option value="MANAGER">MANAGER（管理者）</option>
                  <option value="CLIENT">CLIENT（一般ユーザー）</option>
                </select>
              </Field>
            </div>
            <Field
              label="初期パスワード"
              required
              hint="ユーザーはログイン後に任意のパスワードへ変更できます"
            >
              <input
                type="text"
                className={inputCls + " font-mono"}
                value={newInitialPassword}
                onChange={(e) => setNewInitialPassword(e.target.value)}
                placeholder="初回ログイン用パスワード"
              />
            </Field>
            <button
              type="button"
              disabled={creating}
              onClick={handleCreateUser}
              className="w-full sm:w-auto sm:px-8 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-3 transition-colors"
            >
              {creating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  作成中...
                </span>
              ) : "ユーザーを作成する"}
            </button>
          </div>
        </div>

      </main>

      {/* PW リセットモーダル */}
      {resettingUserId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-900 border border-amber-800 p-6 space-y-4">
            <h3 className="text-base font-black text-white">🔑 初期パスワードリセット</h3>
            {resettingUser && (
              <div className="rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-xs text-gray-300 space-y-0.5">
                <p>対象: <span className="font-semibold text-white">{resettingUser.name ?? resettingUser.email}</span></p>
                <p className="text-gray-500">{resettingUser.email}</p>
              </div>
            )}
            {resetError && (
              <div className="rounded-xl bg-red-950/60 border border-red-800 px-3 py-2 text-xs text-red-300">
                {resetError}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">新しい初期パスワード</label>
              <input
                type="text"
                className={inputCls + " font-mono"}
                placeholder="新しいパスワードを入力"
                value={resetPasswordInput}
                onChange={(e) => setResetPasswordInput(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setResettingUserId(null); setResetPasswordInput(""); setResetError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:text-white transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resettingPw}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {resettingPw ? "リセット中..." : "リセット実行"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-900 border border-red-800 p-6 space-y-4">
            <div className="text-center text-3xl">⚠️</div>
            <h3 className="text-base font-black text-white text-center">このユーザーを削除しますか？</h3>
            <div className="rounded-xl bg-red-950/40 border border-red-800 px-4 py-3 text-xs text-red-300 space-y-1">
              <p>名前: <span className="font-bold text-white">{deleteTargetUser.name ?? "（名前なし）"}</span></p>
              <p>メール: {deleteTargetUser.email}</p>
              <p>ロール: {deleteTargetUser.role}</p>
              <p className="font-bold mt-1">この操作は取り消せません。</p>
            </div>
            {deleteError && (
              <div className="rounded-xl bg-red-950/60 border border-red-800 px-3 py-2 text-xs text-red-300">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteTargetUser(null); setDeleteError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:text-white transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {deleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
