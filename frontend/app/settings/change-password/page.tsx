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

  // CLIENT パスワード変更用
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | "">("");
  const [clientNewPassword, setClientNewPassword] = useState("");
  const [clientConfirmNewPassword, setClientConfirmNewPassword] =
    useState("");
  const [clientMessage, setClientMessage] = useState<string | null>(null);

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

        // CLIENT 一覧取得（後で backend 側で実装する /tenants/clients）
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

      setSelfMessage("パスワードを変更しました。");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
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

      setClientMessage("CLIENT のパスワードを変更しました。");
      setClientNewPassword("");
      setClientConfirmNewPassword("");
    } catch (e) {
      console.error(e);
      setClientMessage("通信エラーが発生しました。");
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div>読み込み中...</div>
      </TenantLayout>
    );
  }

  if (!me) return null;

  return (
    <TenantLayout>
      <div className="max-w-2xl mx-auto bg-white rounded-md shadow p-6 space-y-8">
        <h1 className="text-xl font-bold mb-2">
          設定（パスワード管理） - {me.email}
        </h1>

        {/* ① 自分のパスワード変更 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">
            自分のパスワード変更
          </h2>
          <form className="space-y-3" onSubmit={handleChangeOwnPassword}>
            <div>
              <label className="block text-sm mb-1">
                現在のパスワード
              </label>
              <input
                type="password"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                新しいパスワード
              </label>
              <input
                type="password"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={confirmNewPassword}
                onChange={(e) =>
                  setConfirmNewPassword(e.target.value)
                }
                required
              />
            </div>

            {selfMessage && (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {selfMessage}
              </p>
            )}

            <button
              type="submit"
              className="w-full mt-2 py-2 bg-blue-600 text-white rounded-md text-sm font-medium"
            >
              自分のパスワードを変更する
            </button>
          </form>
        </section>

        {/* ② CLIENT のパスワード変更 */}
        <section>
          <h2 className="text-lg font-semibold mb-2">
            CLIENT のパスワード変更
          </h2>

          <form className="space-y-3" onSubmit={handleResetClientPassword}>
            <div>
              <label className="block text-sm mb-1">
                対象 CLIENT
              </label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
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
              <label className="block text-sm mb-1">
                新しいパスワード
              </label>
              <input
                type="password"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={clientNewPassword}
                onChange={(e) =>
                  setClientNewPassword(e.target.value)
                }
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={clientConfirmNewPassword}
                onChange={(e) =>
                  setClientConfirmNewPassword(e.target.value)
                }
                required
              />
            </div>

            {clientMessage && (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {clientMessage}
              </p>
            )}

            <button
              type="submit"
              className="w-full mt-2 py-2 bg-blue-600 text-white rounded-md text-sm font-medium"
            >
              CLIENT のパスワードを変更する
            </button>
          </form>
        </section>
      </div>
    </TenantLayout>
  );
}
