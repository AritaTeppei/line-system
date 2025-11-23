"use client";

import { FormEvent, useEffect, useState } from "react";
import TenantLayout from "../components/TenantLayout";

type Customer = {
  id: number;
  lastName: string;
  firstName: string;
  postalCode?: string | null;
  address1?: string | null;
  address2?: string | null;
  mobilePhone?: string | null;
  lineUid?: string | null;
  birthday?: string | null;
};

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: "DEVELOPER" | "MANAGER" | "CLIENT";
};

export default function CustomersPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規登録＆編集フォーム用 state
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [lineUid, setLineUid] = useState("");
  const [birthday, setBirthday] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // ★ どの顧客を編集中か（null のときは新規モード）
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(
    null,
  );

  // ★ 一括送信用 state
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);

  // 初回ロード：トークンから /auth/me → customers の順で取得
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      const savedToken =
        typeof window !== "undefined"
          ? window.localStorage.getItem("auth_token")
          : null;

      if (!savedToken) {
        setLoading(false);
        setError("先にログインしてください（トップページからログイン）");
        return;
      }

      setToken(savedToken);
      const headers = { Authorization: `Bearer ${savedToken}` };

      try {
        // ① まず /auth/me でテナント有効チェック
        const meRes = await fetch("http://localhost:4000/auth/me", { headers });

        if (!meRes.ok) {
          const data = await meRes.json().catch(() => null);
          let msg: string = "ログイン情報の取得に失敗しました";
          const m = data?.message;
          if (typeof m === "string") {
            msg = m;
          } else if (Array.isArray(m) && m[0]) {
            msg = String(m[0]);
          }
          setError(msg); // ここに「テナントが無効になっています」「有効期限が切れています」などが入る
          setLoading(false);
          return; // ★ ここで終了 → customers は取りに行かない
        }

        const meData: Me = await meRes.json();
        setMe(meData);

        // ② テナントが有効な場合だけ顧客一覧を取得
        const customersRes = await fetch("http://localhost:4000/customers", {
          headers,
        });

        if (!customersRes.ok) {
          const data = await customersRes.json().catch(() => null);
          let msg: string = "顧客一覧の取得に失敗しました";
          const m = data?.message;
          if (typeof m === "string") {
            msg = m;
          } else if (Array.isArray(m) && m[0]) {
            msg = String(m[0]);
          }
          throw new Error(msg);
        }

        const data: Customer[] = await customersRes.json();
        setCustomers(data);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "顧客一覧の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  // 日付表示用
  const formatDate = (value?: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("ja-JP");
  };

  // フォームの入力値をリセットする小さいヘルパー
  const resetFormFields = () => {
    setLastName("");
    setFirstName("");
    setPostalCode("");
    setAddress1("");
    setAddress2("");
    setMobilePhone("");
    setLineUid("");
    setBirthday("");
  };

  const handleCreateOrUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!token) {
      setFormError("トークンがありません。再度ログインしてください。");
      return;
    }

    if (!lastName || !firstName || !mobilePhone) {
      setFormError("姓・名・携帯番号は必須です");
      return;
    }

    const payload = {
      lastName,
      firstName,
      postalCode: postalCode || undefined,
      address1: address1 || undefined,
      address2: address2 || undefined,
      mobilePhone: mobilePhone || undefined,
      lineUid: lineUid || undefined,
      birthday: birthday || undefined,
    };

    try {
      // ★ editingCustomerId が null → 新規作成（POST）
      if (editingCustomerId == null) {
        const res = await fetch("http://localhost:4000/customers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          let msg: string = "顧客の登録に失敗しました";
          if (data?.message) {
            msg = Array.isArray(data.message)
              ? data.message.join(", ")
              : String(data.message);
          }
          throw new Error(msg);
        }

        const created: Customer = await res.json();
        setCustomers((prev) => [...prev, created]);
        setFormSuccess("顧客を登録しました");
        resetFormFields();
      } else {
        // ★ editingCustomerId がある → 更新（PATCH）
        const res = await fetch(
          `http://localhost:4000/customers/${editingCustomerId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          let msg: string = "顧客情報の更新に失敗しました";
          if (data?.message) {
            msg = Array.isArray(data.message)
              ? data.message.join(", ")
              : String(data.message);
          }
          throw new Error(msg);
        }

        const updated: Customer = await res.json();
        setCustomers((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
        setFormSuccess("顧客情報を更新しました");
        setEditingCustomerId(null);
        resetFormFields();
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message ?? "顧客の登録・更新に失敗しました");
    }
  };

  // 編集ボタン：選んだ顧客の情報をフォームにセット
  const handleEditClick = (c: Customer) => {
    setEditingCustomerId(c.id);
    setFormError(null);
    setFormSuccess(null);

    setLastName(c.lastName ?? "");
    setFirstName(c.firstName ?? "");
    setPostalCode(c.postalCode ?? "");
    setAddress1(c.address1 ?? "");
    setAddress2(c.address2 ?? "");
    setMobilePhone(c.mobilePhone ?? "");
    setLineUid(c.lineUid ?? "");
    // birthday は "YYYY-MM-DD" 形式にして input[type=date] に入れる
    if (c.birthday) {
      try {
        const d = new Date(c.birthday);
        if (!Number.isNaN(d.getTime())) {
          setBirthday(d.toISOString().slice(0, 10));
        } else {
          setBirthday("");
        }
      } catch {
        setBirthday("");
      }
    } else {
      setBirthday("");
    }
  };

  // 編集キャンセル
  const handleCancelEdit = () => {
    setEditingCustomerId(null);
    resetFormFields();
    setFormError(null);
    setFormSuccess(null);
  };

  // 削除ボタン
  const handleDeleteClick = async (id: number) => {
    if (!token) {
      setFormError("トークンがありません。再ログインしてください。");
      return;
    }

    const ok = window.confirm("この顧客を削除してもよろしいですか？");
    if (!ok) return;

    try {
      const res = await fetch(`http://localhost:4000/customers/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        let msg: string = "顧客の削除に失敗しました";
        if (data?.message) {
          msg = Array.isArray(data.message)
            ? data.message.join(", ")
            : String(data.message);
        }
        throw new Error(msg);
      }

      setCustomers((prev) => prev.filter((c) => c.id !== id));
      // 削除対象を編集中だったらフォームもリセット
      if (editingCustomerId === id) {
        handleCancelEdit();
      }
      setFormSuccess("顧客を削除しました");
    } catch (err: any) {
      console.error(err);
      setFormError(err.message ?? "顧客の削除に失敗しました");
    }
  };

  // ★ チェックボックスの ON/OFF
  const toggleCustomerSelection = (id: number) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleBroadcast = async () => {
    setBroadcastError(null);
    setBroadcastSuccess(null);

    if (!token) {
      setBroadcastError("トークンがありません。再ログインしてください。");
      return;
    }
    if (selectedCustomerIds.length === 0) {
      setBroadcastError("送信先の顧客を1件以上選択してください。");
      return;
    }
    if (!broadcastMessage.trim()) {
      setBroadcastError("メッセージ内容を入力してください。");
      return;
    }

    setBroadcasting(true);
    try {
      const res = await fetch(
        "http://localhost:4000/messages/send-to-customers",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            customerIds: selectedCustomerIds,
            message: broadcastMessage,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        let msg: string = "メッセージの送信に失敗しました";
        if (data?.message) {
          msg = Array.isArray(data.message)
            ? data.message.join(", ")
            : String(data.message);
        }
        throw new Error(msg);
      }

      const result = await res.json();
      setBroadcastSuccess(
        `送信が完了しました（${result.sentCount}件 / 対象 ${result.targetCount}件）`,
      );
      setSelectedCustomerIds([]);
      setBroadcastMessage("");
    } catch (err: any) {
      console.error(err);
      setBroadcastError(err.message ?? "メッセージの送信に失敗しました");
    } finally {
      setBroadcasting(false);
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <main className="min-h-screen flex items-center justify-center">
          <p>読み込み中...</p>
        </main>
      </TenantLayout>
    );
  }

  // ★ エラー時は顧客UIを一切表示せず、メッセージだけ
  if (error) {
    return (
      <TenantLayout>
        <main className="min-h-screen flex flex-col items-center p-4 gap-6">
          <h1 className="text-2xl font-bold mt-4">顧客管理</h1>
          <div className="text-red-600 border border-red-400 px-4 py-2 rounded w-full max-w-2xl whitespace-pre-wrap">
            {error}
          </div>
        </main>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <main className="min-h-screen flex flex-col items-center p-4 gap-6">
        <h1 className="text-2xl font-bold mt-4">顧客管理</h1>

        {me && (
          <div className="border rounded-md px-4 py-3 bg-gray-50 w-full max-w-2xl">
            <p>
              ログイン中: {me.name ?? me.email}（ロール: {me.role}）
            </p>
          </div>
        )}

        {/* 新規登録＆編集フォーム */}
        <section className="border rounded-md px-4 py-4 w-full max-w-2xl bg-white">
          <h2 className="font-semibold mb-1">顧客登録／編集（テナント側入力）</h2>
          {editingCustomerId != null && (
            <p className="mb-2 text-xs text-orange-600">
              顧客ID {editingCustomerId} を編集中です。編集をやめて新規登録に戻る場合は「編集をキャンセル」を押してください。
            </p>
          )}

          {formError && (
            <div className="mb-2 text-sm text-red-600">{formError}</div>
          )}
          {formSuccess && (
            <div className="mb-2 text-sm text-green-600">{formSuccess}</div>
          )}

          <form className="space-y-3" onSubmit={handleCreateOrUpdate}>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm mb-1">
                  姓 <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm mb-1">
                  名 <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">
                郵便番号（ハイフンなし）
              </label>
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="例: 8100001"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">住所（番地まで）</label>
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                placeholder="例: 福岡市中央区天神1-1-1"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">
                住所（建物名・部屋番号など）
              </label>
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
                placeholder="例: GATCHビル3F"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">
                携帯番号 <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                value={mobilePhone}
                onChange={(e) => setMobilePhone(e.target.value)}
                placeholder="例: 09012345678"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                ※ 携帯番号が重複している場合は登録不可（サーバ側でチェック）想定。
              </p>
            </div>

            <div>
              <label className="block text-sm mb-1">LINE UID（任意）</label>
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                value={lineUid}
                onChange={(e) => setLineUid(e.target.value)}
                placeholder="LINE連携が分かっている場合にセット"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">誕生日（任意）</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1 text-sm"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="submit"
                className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                {editingCustomerId == null ? "顧客を登録" : "顧客情報を更新"}
              </button>
              {editingCustomerId != null && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 text-sm rounded border border-gray-400 text-gray-700 hover:bg-gray-100"
                >
                  編集をキャンセル
                </button>
              )}
            </div>
          </form>
        </section>

        {/* 顧客一覧＋一括送信 */}
        <section className="border rounded-md px-4 py-4 w-full max-w-4xl bg-white">
          <h2 className="font-semibold mb-3">顧客一覧 & 一括メッセージ送信</h2>

          <div className="mb-3 text-xs text-gray-600">
            任意の顧客にチェックを入れて、下のメッセージを送信できます。
          </div>

          {/* 一括送信フォーム */}
          <div className="mb-4 border rounded-md px-3 py-3 bg-gray-50">
            {broadcastError && (
              <div className="mb-2 text-xs text-red-600">
                {broadcastError}
              </div>
            )}
            {broadcastSuccess && (
              <div className="mb-2 text-xs text-green-600">
                {broadcastSuccess}
              </div>
            )}

            <label className="block text-xs mb-1">送信メッセージ</label>
            <textarea
              className="w-full h-24 border rounded px-2 py-1 text-xs"
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="ここにLINEで送りたいメッセージを入力"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-[11px] text-gray-500">
                選択中: {selectedCustomerIds.length} 件
              </span>
              <button
                type="button"
                onClick={handleBroadcast}
                disabled={broadcasting}
                className="px-3 py-1 text-xs rounded bg-green-600 text-white disabled:opacity-60"
              >
                {broadcasting ? "送信中..." : "選択した顧客に送信"}
              </button>
            </div>
          </div>

          {/* 顧客一覧テーブル */}
          {customers.length === 0 ? (
            <p className="text-sm text-gray-600">
              まだ顧客が登録されていません。
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[480px] border rounded">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border px-2 py-1">
                      <span className="sr-only">選択</span>
                    </th>
                    <th className="border px-2 py-1 text-left">ID</th>
                    <th className="border px-2 py-1 text-left">名前</th>
                    <th className="border px-2 py-1 text-left">住所</th>
                    <th className="border px-2 py-1 text-left">携帯番号</th>
                    <th className="border px-2 py-1 text-left">LINE UID</th>
                    <th className="border px-2 py-1 text-left">誕生日</th>
                    {/* ★ 操作列 */}
                    <th className="border px-2 py-1 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const fullAddress =
                      (c.postalCode ? `〒${c.postalCode} ` : "") +
                      (c.address1 ?? "") +
                      (c.address2 ? ` ${c.address2}` : "");

                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="border px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={selectedCustomerIds.includes(c.id)}
                            onChange={() => toggleCustomerSelection(c.id)}
                          />
                        </td>
                        <td className="border px-2 py-1">{c.id}</td>
                        <td className="border px-2 py-1">
                          {c.lastName} {c.firstName}
                        </td>
                        <td className="border px-2 py-1">{fullAddress}</td>
                        <td className="border px-2 py-1">
                          {c.mobilePhone ?? ""}
                        </td>
                        <td className="border px-2 py-1">{c.lineUid ?? ""}</td>
                        <td className="border px-2 py-1">
                          {formatDate(c.birthday)}
                        </td>
                        <td className="border px-2 py-1">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditClick(c)}
                              className="px-2 py-0.5 border rounded text-[11px] hover:bg-gray-100"
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(c.id)}
                              className="px-2 py-0.5 border rounded text-[11px] text-red-700 hover:bg-red-50"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </TenantLayout>
  );
}
