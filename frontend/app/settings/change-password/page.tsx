"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import TenantLayout from "../../components/TenantLayout";

type Role = "DEVELOPER" | "MANAGER" | "CLIENT";

type MeResponse = {
  id: number;
  email: string;
  tenantId: number | null;
  role: Role;
  tenantPlan: string | null;
};

type ClientUser = {
  id: number;
  email: string;
  name: string | null;
};

type ClientLimits = {
  plan: string;
  maxClients: number;
  currentCount: number;
};

const PLAN_LABELS: Record<string, string> = {
  TRIAL: "トライアル",
  BASIC: "ベーシック",
  STANDARD: "スタンダード",
  PRO: "PRO",
};

const PLAN_COLORS: Record<string, string> = {
  TRIAL: "bg-amber-100 text-amber-800 border-amber-300",
  BASIC: "bg-gray-100 text-gray-700 border-gray-300",
  STANDARD: "bg-green-100 text-green-800 border-green-300",
  PRO: "bg-purple-100 text-purple-800 border-purple-300",
};

const CONCURRENT_SESSION_LIMITS: Record<string, number> = {
  TRIAL: 1,
  BASIC: 1,
  STANDARD: 2,
  PRO: 3,
};

export default function ChangePasswordPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // クライアント一覧 & 上限
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [limits, setLimits] = useState<ClientLimits | null>(null);

  // アカウント追加フォーム
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // パスワードリセット（CLIENT）
  const [resetTargetId, setResetTargetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // 削除確認
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 自分のパスワード変更
  const [currentPassword, setCurrentPassword] = useState("");
  const [selfNewPassword, setSelfNewPassword] = useState("");
  const [selfConfirm, setSelfConfirm] = useState("");
  const [selfMessage, setSelfMessage] = useState<string | null>(null);
  const [selfSuccessOpen, setSelfSuccessOpen] = useState(false);
  const [selfLoading, setSelfLoading] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL;

  const getToken = () =>
    typeof window !== "undefined"
      ? window.localStorage.getItem("auth_token")
      : null;

  const fetchClients = async (token: string) => {
    const [resClients, resLimits] = await Promise.all([
      fetch(`${apiBase}/tenants/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${apiBase}/tenants/client-limits`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    if (resClients.ok) setClients(await resClients.json());
    if (resLimits.ok) setLimits(await resLimits.json());
  };

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/"); return; }

    const run = async () => {
      try {
        const res = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { router.replace("/"); return; }

        const data = (await res.json()) as MeResponse;
        if (data.role !== "MANAGER") { router.replace("/dashboard"); return; }

        setMe(data);
        await fetchClients(token);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CLIENTアカウント追加
  const handleAddClient = async (e: FormEvent) => {
    e.preventDefault();
    setAddMessage(null);
    if (!newEmail.trim() || !newPassword.trim()) {
      setAddMessage("メールアドレスとパスワードは必須です");
      return;
    }
    const token = getToken();
    if (!token) return;
    setAddLoading(true);
    try {
      const res = await fetch(`${apiBase}/tenants/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newEmail,
          name: newName || null,
          password: newPassword,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAddMessage(data?.message ?? "追加に失敗しました");
        return;
      }
      setNewEmail(""); setNewName(""); setNewPassword("");
      setShowAddForm(false);
      setAddSuccess(true);
      await fetchClients(token);
    } catch {
      setAddMessage("通信エラーが発生しました");
    } finally {
      setAddLoading(false);
    }
  };

  // CLIENTアカウント削除
  const handleDeleteClient = async (userId: number) => {
    const token = getToken();
    if (!token) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${apiBase}/tenants/clients/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDeleteTargetId(null);
        await fetchClients(token);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteLoading(false);
    }
  };

  // CLIENTパスワードリセット
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setResetMessage(null);
    if (!resetTargetId || !resetPassword.trim()) return;
    const token = getToken();
    if (!token) return;
    setResetLoading(true);
    try {
      const res = await fetch(
        `${apiBase}/tenants/clients/${resetTargetId}/reset-password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ newPassword: resetPassword }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setResetMessage(data?.message ?? "変更に失敗しました");
        return;
      }
      setResetPassword("");
      setResetTargetId(null);
      setResetSuccess(true);
    } catch {
      setResetMessage("通信エラーが発生しました");
    } finally {
      setResetLoading(false);
    }
  };

  // 自分のパスワード変更
  const handleChangeSelfPassword = async (e: FormEvent) => {
    e.preventDefault();
    setSelfMessage(null);
    if (selfNewPassword === currentPassword) {
      setSelfMessage("新しいパスワードが現在のパスワードと同じです");
      return;
    }
    if (selfNewPassword !== selfConfirm) {
      setSelfMessage("パスワードが一致しません");
      return;
    }
    const token = getToken();
    if (!token) return;
    setSelfLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword: selfNewPassword,
          confirmNewPassword: selfConfirm,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSelfMessage(data?.message ?? "変更に失敗しました");
        return;
      }
      setCurrentPassword(""); setSelfNewPassword(""); setSelfConfirm("");
      setSelfSuccessOpen(true);
    } catch {
      setSelfMessage("通信エラーが発生しました");
    } finally {
      setSelfLoading(false);
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex items-center justify-center h-40 text-gray-500">
          読み込み中...
        </div>
      </TenantLayout>
    );
  }
  if (!me) return null;

  const plan = (me.tenantPlan ?? "BASIC").toUpperCase();
  const maxClients = limits?.maxClients ?? 0;
  const currentCount = limits?.currentCount ?? 0;
  const maxSessions = CONCURRENT_SESSION_LIMITS[plan] ?? 1;
  const canAddClient = maxClients > 0 && currentCount < maxClients;

  const resetTarget = clients.find((c) => c.id === resetTargetId) ?? null;
  const deleteTarget = clients.find((c) => c.id === deleteTargetId) ?? null;

  return (
    <TenantLayout>
      <div className="max-w-2xl mx-auto mt-4 space-y-6 px-4 pb-12">

        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-extrabold text-green-700 tracking-wide">
            🔒 アカウント・パスワード管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            スタッフアカウントの管理とパスワード設定を行えます
          </p>
        </div>

        {/* プラン情報カード */}
        <div className="rounded-2xl border bg-white shadow-sm p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">現在のプラン</p>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${
                  PLAN_COLORS[plan] ?? PLAN_COLORS.BASIC
                }`}
              >
                {PLAN_LABELS[plan] ?? plan}
              </span>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-2xl font-black text-gray-800">{maxSessions}</p>
                <p className="text-xs text-gray-500">同時ログイン上限</p>
              </div>
              <div>
                <p className="text-2xl font-black text-gray-800">{maxClients}</p>
                <p className="text-xs text-gray-500">クライアント上限</p>
              </div>
              <div>
                <p className="text-2xl font-black text-green-600">{currentCount}</p>
                <p className="text-xs text-gray-500">現在のクライアント数</p>
              </div>
            </div>
          </div>

          {/* プラン別説明 */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            {[
              { p: "BASIC", label: "ベーシック", sessions: 1, clients: 0 },
              { p: "STANDARD", label: "スタンダード", sessions: 2, clients: 1 },
              { p: "PRO", label: "PRO", sessions: 3, clients: 3 },
            ].map((row) => (
              <div
                key={row.p}
                className={`rounded-xl p-3 border text-center ${
                  plan === row.p
                    ? "border-green-400 bg-green-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <p className={`font-bold mb-1 ${plan === row.p ? "text-green-700" : "text-gray-600"}`}>
                  {row.label}
                  {plan === row.p && <span className="ml-1 text-[10px]">✓</span>}
                </p>
                <p className="text-gray-600">同時ログイン: {row.sessions}台</p>
                <p className="text-gray-600">
                  クライアント: {row.clients === 0 ? "なし" : `${row.clients}名`}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* クライアントアカウント管理 */}
        <section className="rounded-2xl border bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-800">👥 クライアントアカウント</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                スタッフが利用するサブアカウントを管理します
              </p>
            </div>
            <button
              onClick={() => {
                if (!canAddClient) return;
                setShowAddForm(!showAddForm);
                setAddMessage(null);
              }}
              disabled={!canAddClient}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                canAddClient
                  ? "bg-green-600 text-white hover:bg-green-700 shadow"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
              title={
                maxClients === 0
                  ? "現在のプランではクライアント追加不可"
                  : currentCount >= maxClients
                  ? "上限に達しています"
                  : ""
              }
            >
              ＋ アカウント追加
            </button>
          </div>

          {/* プランでクライアント追加不可の場合の案内 */}
          {maxClients === 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              ベーシックプランではクライアントアカウントを追加できません。
              スタンダード以上にアップグレードすると最大3名まで追加できます。
            </div>
          )}

          {/* 追加フォーム */}
          {showAddForm && canAddClient && (
            <form
              onSubmit={handleAddClient}
              className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3"
            >
              <p className="text-sm font-semibold text-green-800">新規クライアントアカウント</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    メールアドレス <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    placeholder="staff@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">名前（任意）</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="田中 太郎"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  初期パスワード <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="8文字以上推奨"
                />
              </div>
              {addMessage && (
                <p className="text-xs text-red-600">{addMessage}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setAddMessage(null); }}
                  className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
                >
                  {addLoading ? "追加中..." : "追加する"}
                </button>
              </div>
            </form>
          )}

          {/* クライアント一覧 */}
          {clients.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-6 border border-dashed rounded-xl">
              クライアントアカウントはまだありません
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {c.name ?? "（名前未設定）"}
                    </p>
                    <p className="text-xs text-gray-500">{c.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setResetTargetId(c.id);
                        setResetPassword("");
                        setResetMessage(null);
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                    >
                      🔑 PW変更
                    </button>
                    <button
                      onClick={() => setDeleteTargetId(c.id)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition"
                    >
                      🗑 削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 自分のパスワード変更 */}
        <section className="rounded-2xl border bg-white shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-800">🔐 自分のパスワード変更</h2>
            <p className="text-xs text-gray-500 mt-0.5">管理者アカウントのパスワードを変更します</p>
          </div>

          <form className="space-y-3" onSubmit={handleChangeSelfPassword}>
            <div>
              <label className="block text-xs text-gray-600 mb-1">現在のパスワード</label>
              <input
                type="password"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">新しいパスワード</label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                  value={selfNewPassword}
                  onChange={(e) => setSelfNewPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">確認用</label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                  value={selfConfirm}
                  onChange={(e) => setSelfConfirm(e.target.value)}
                  required
                />
              </div>
            </div>
            {selfMessage && (
              <p className="text-xs text-red-600">{selfMessage}</p>
            )}
            <button
              type="submit"
              disabled={selfLoading}
              className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {selfLoading ? "変更中..." : "パスワードを変更する"}
            </button>
          </form>
        </section>
      </div>

      {/* ── モーダル類 ── */}

      {/* CLIENTパスワードリセットモーダル */}
      {resetTargetId !== null && resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-blue-200 p-6">
            <h3 className="text-base font-bold text-blue-800 mb-1">🔑 パスワード変更</h3>
            <p className="text-xs text-gray-500 mb-4">
              {resetTarget.name ?? resetTarget.email} のパスワードを変更します
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">新しいパスワード</label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {resetMessage && (
                <p className="text-xs text-red-600">{resetMessage}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setResetTargetId(null); setResetMessage(null); }}
                  className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {resetLoading ? "変更中..." : "変更する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTargetId !== null && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-red-200 p-6">
            <h3 className="text-base font-bold text-red-700 mb-2">🗑 アカウント削除</h3>
            <p className="text-sm text-gray-700 mb-1">
              以下のアカウントを削除しますか？
            </p>
            <p className="text-sm font-semibold text-gray-900 mb-4">
              {deleteTarget.name ? `${deleteTarget.name} (${deleteTarget.email})` : deleteTarget.email}
            </p>
            <p className="text-xs text-red-600 mb-4">この操作は取り消せません。</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDeleteClient(deleteTargetId)}
                disabled={deleteLoading}
                className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                {deleteLoading ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* アカウント追加成功 */}
      {addSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-green-200 p-6">
            <h3 className="text-base font-bold text-green-700 mb-2">✅ アカウントを追加しました</h3>
            <p className="text-sm text-gray-600 mb-4">
              クライアントアカウントが正常に作成されました。
              初期パスワードをスタッフにお伝えください。
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setAddSuccess(false)}
                className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PW変更成功 */}
      {resetSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-blue-200 p-6">
            <h3 className="text-base font-bold text-blue-700 mb-2">✅ パスワードを変更しました</h3>
            <p className="text-sm text-gray-600 mb-4">
              新しいパスワードをスタッフにお伝えください。
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setResetSuccess(false)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 自分のPW変更成功 */}
      {selfSuccessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-emerald-200 p-6">
            <h3 className="text-base font-bold text-emerald-700 mb-2">✅ パスワードを変更しました</h3>
            <p className="text-sm text-gray-600 mb-4">
              次回ログインからこのパスワードをご利用ください。
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setSelfSuccessOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </TenantLayout>
  );
}
