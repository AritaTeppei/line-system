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
};

type ClientUser = {
  id: number;
  email: string;
};

export default function ChangePasswordPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // 自分のパスワード変更用
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [selfMessage, setSelfMessage] = useState<string | null>(null);
  const [selfSuccessModalOpen, setSelfSuccessModalOpen] = useState(false);

  // CLIENT パスワード変更用
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | "">("");
  const [clientNewPassword, setClientNewPassword] = useState("");
  const [clientConfirmNewPassword, setClientConfirmNewPassword] =
    useState("");
  const [clientMessage, setClientMessage] = useState<string | null>(null);
  const [clientSuccessModalOpen, setClientSuccessModalOpen] =
    useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;

    if (!token) {
      router.replace("/");
      return;
    }

    const run = async () => {
      try {
        // ログイン中ユーザー情報取得
        const res = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          router.replace("/");
          return;
        }

        const data = (await res.json()) as MeResponse;

        // MANAGER 以外はダッシュボードへ戻す
        if (data.role !== "MANAGER") {
          router.replace("/dashboard");
          return;
        }

        setMe(data);

        // CLIENT 一覧取得
        const resClients = await fetch(`${apiBase}/tenants/clients`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (resClients.ok) {
          const clientsData =
            (await resClients.json()) as ClientUser[];
          setClients(clientsData);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [apiBase, router]);

  const handleChangeOwnPassword = async (e: FormEvent) => {
    e.preventDefault();
    setSelfMessage(null);

    // ▼ ここで「同じパスワード問題」をフロントで弾く
    if (newPassword === currentPassword) {
      setSelfMessage(
        "新しいパスワードが現在のパスワードと同じです。別のパスワードを入力してください。"
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setSelfMessage("新しいパスワードが確認用と一致していません。");
      return;
    }

    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;

    if (!token) {
      router.replace("/");
      return;
    }

    try {
      const res = await fetch(`${apiBase}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          data?.message ||
          (Array.isArray(data?.message) ? data.message.join(", ") : null) ||
          "パスワード変更に失敗しました。";
        setSelfMessage(msg);
        return;
      }

      // 成功時はモーダル表示に切り替え
      setSelfMessage(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setSelfSuccessModalOpen(true);
    } catch (e) {
      console.error(e);
      setSelfMessage("通信エラーが発生しました。");
    }
  };

  const handleResetClientPassword = async (e: FormEvent) => {
    e.preventDefault();
    setClientMessage(null);

    if (!selectedClientId) {
      setClientMessage("対象 CLIENT を選択してください。");
      return;
    }

    if (clientNewPassword !== clientConfirmNewPassword) {
      setClientMessage("新しいパスワードが確認用と一致していません。");
      return;
    }

    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;

    if (!token) {
      router.replace("/");
      return;
    }

    try {
      const res = await fetch(
        `${apiBase}/auth/manager/reset-client-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            clientUserId: selectedClientId,
            newPassword: clientNewPassword,
            confirmNewPassword: clientConfirmNewPassword,
          }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          data?.message ||
          (Array.isArray(data?.message) ? data.message.join(", ") : null) ||
          "CLIENT のパスワード変更に失敗しました。";
        setClientMessage(msg);
        return;
      }

      setClientMessage(null);
      setClientNewPassword("");
      setClientConfirmNewPassword("");
      setClientSuccessModalOpen(true);
    } catch (e) {
      console.error(e);
      setClientMessage("通信エラーが発生しました。");
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="text-sm text-gray-600 p-4">読み込み中...</div>
      </TenantLayout>
    );
  }

  if (!me) return null;

  return (
    <TenantLayout>
      <div className="max-w-3xl mx-auto mt-4 space-y-6 px-4 pb-10">
        {/* 見出し */}
        <h1
          className="text-2xl font-extrabold text-green-700 tracking-wide drop-shadow-sm"
          style={{
            fontFamily: "'M PLUS Rounded 1c', system-ui, sans-serif",
          }}
        >
          パスワード管理
        </h1>

        <p className="text-xs text-gray-600">
          アカウントのパスワードを安全に管理できます。
        </p>

        {/* 自分のパスワード変更 */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            自分のパスワード変更
          </h2>

          <form className="space-y-3" onSubmit={handleChangeOwnPassword}>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                現在のパスワード
              </label>
              <input
                type="password"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                新しいパスワード
              </label>
              <input
                type="password"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
              />
            </div>

            {selfMessage && (
              <p className="text-sm text-red-600 whitespace-pre-wrap">
                {selfMessage}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow hover:bg-emerald-700 transition"
            >
              自分のパスワードを変更する
            </button>
          </form>
        </section>

        {/* CLIENT のパスワード変更 */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            CLIENT のパスワード変更
          </h2>

          <form className="space-y-3" onSubmit={handleResetClientPassword}>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                対象 CLIENT
              </label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                value={selectedClientId}
                onChange={(e) =>
                  setSelectedClientId(
                    e.target.value ? Number(e.target.value) : ""
                  )
                }
              >
                <option value="">選択してください</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                新しいパスワード
              </label>
              <input
                type="password"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                value={clientNewPassword}
                onChange={(e) =>
                  setClientNewPassword(e.target.value)
                }
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                value={clientConfirmNewPassword}
                onChange={(e) =>
                  setClientConfirmNewPassword(e.target.value)
                }
                required
              />
            </div>

            {clientMessage && (
              <p className="text-sm text-red-600 whitespace-pre-wrap">
                {clientMessage}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow hover:bg-blue-700 transition"
            >
              CLIENT のパスワードを変更する
            </button>
          </form>
        </section>
      </div>

      {/* 自分のパスワード変更 成功モーダル */}
      {selfSuccessModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-lg border border-emerald-200 p-5">
            <h3 className="text-sm sm:text-base font-semibold text-emerald-800 mb-2">
              パスワードを変更しました
            </h3>
            <p className="text-xs sm:text-sm text-gray-700 mb-4">
              新しいパスワードが保存されました。
              次回ログインからこのパスワードをご利用ください。
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelfSuccessModalOpen(false)}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLIENT パスワード変更 成功モーダル */}
      {clientSuccessModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-lg border border-blue-200 p-5">
            <h3 className="text-sm sm:text-base font-semibold text-blue-800 mb-2">
              CLIENT のパスワードを変更しました
            </h3>
            <p className="text-xs sm:text-sm text-gray-700 mb-4">
              選択した CLIENT アカウントのパスワードが更新されました。
              新しいパスワードを対象の方にお伝えください。
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setClientSuccessModalOpen(false)}
                className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700"
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
