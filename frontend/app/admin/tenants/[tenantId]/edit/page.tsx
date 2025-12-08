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

    // ★ 追加
  companyName: string | null;
  companyAddress1: string | null;
  companyAddress2: string | null;
  representativeName: string | null;
  contactPhone: string | null;
  contactMobile: string | null;

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

  const [companyName, setCompanyName] = useState("");
  const [companyAddress1, setCompanyAddress1] = useState("");
  const [companyAddress2, setCompanyAddress2] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMobile, setContactMobile] = useState("");
  const [resetting, setResetting] = useState(false);


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

    const fetchMe = fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, { headers })
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
      `${process.env.NEXT_PUBLIC_API_URL}/admin/tenants/${tenantId}`,
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

                // ★ プランを大文字にそろえて、BASIC / STANDARD / PRO 以外なら「未選択」にする
        const planValue = (data.plan ?? "").toUpperCase();
        if (["BASIC", "STANDARD", "PRO"].includes(planValue)) {
          setPlan(planValue);
        } else {
          setPlan("");
        }

        setIsActive(data.isActive);

        // ★ 契約者情報も state に詰める
        setCompanyName(data.companyName ?? "");
        setCompanyAddress1(data.companyAddress1 ?? "");
        setCompanyAddress2(data.companyAddress2 ?? "");
        setRepresentativeName(data.representativeName ?? "");
        setContactPhone(data.contactPhone ?? "");
        setContactMobile(data.contactMobile ?? "");

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

  const handleLogout = async () => {
  const savedToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem("auth_token")
      : null;

  try {
    if (savedToken) {
      // ★ バックエンドの /auth/logout を叩いて、UserSession を revoked にする
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${savedToken}`,
          "Content-Type": "application/json",
        },
      });
    }
  } catch (e) {
    // 失敗しても、とりあえずフロント側のログアウト処理は続行
    console.error("logout error", e);
  }
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
        `${process.env.NEXT_PUBLIC_API_URL}/admin/tenants/${tenant.id}`,
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

              // ★ 契約者情報
            companyName: companyName || null,
            companyAddress1: companyAddress1 || null,
            companyAddress2: companyAddress2 || null,
            representativeName: representativeName || null,
            contactPhone: contactPhone || null,
            contactMobile: contactMobile || null,
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

    const handleResetData = async () => {
    if (!tenant) return;

    const ok = window.confirm(
      `テナント「${tenant.name}」 のデータをリセットします。\n\n` +
        "このテナントに紐づく 顧客・車両・予約 データはすべて削除され、元に戻せません。\n\n" +
        "本当に実行してもよろしいですか？",
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

    setResetting(true);
    setError(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/tenants/${tenant.id}/reset-data`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${savedToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.message ?? "テナントデータリセットAPIエラー",
        );
      }

      // フロント側のカウントもゼロにしておく
      setTenant({
        ...tenant,
        customersCount: 0,
        carsCount: 0,
        bookingsCount: 0,
      });

      alert("このテナントの顧客・車両・予約データをリセットしました。");
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ??
          "テナントデータのリセットに失敗しました。コンソールを確認してください。",
      );
    } finally {
      setResetting(false);
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
          {/* ★ 追加：ログインユーザー管理ボタン */}
          <button
            type="button"
            onClick={() => router.push(`/admin/tenants/${tenant.id}/user`)}
            className="px-3 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-700"
          >
            ログインユーザー管理
          </button>

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

            {/* テナントデータ概要 & リセットボタン */}
      <div className="mb-4 border rounded p-3 bg-red-50">
        <h2 className="font-semibold mb-2 text-sm text-red-700">
          テナントデータのリセット（開発・検証用）
        </h2>
        <p className="text-xs text-gray-700 mb-2">
          このテナントに紐づく
          <span className="font-semibold"> 顧客・車両・予約 </span>
          データをすべて削除します。<br />
          <span className="font-semibold text-red-700">
            実行すると元に戻せません。
          </span>
          本番用テナントでは実行しないでください。
        </p>

        <div className="text-xs text-gray-800 mb-2">
          <div>顧客数: {tenant.customersCount} 件</div>
          <div>車両数: {tenant.carsCount} 件</div>
          <div>予約数: {tenant.bookingsCount} 件</div>
        </div>

        <button
          type="button"
          onClick={handleResetData}
          disabled={resetting}
          className="mt-2 px-4 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
        >
          {resetting
            ? "データリセット中..."
            : "このテナントのデータをリセットする"}
        </button>
      </div>

      {/* エラー表示 */}
      {error && (
        <p className="mb-3 text-red-600 text-sm whitespace-pre-wrap">
          {error}
        </p>
      )}

      {/* 編集フォーム */}
      <form onSubmit={handleSubmit} className="max-w-lg space-y-3">
      {/* 契約者情報 */}
      <div className="mt-6 border-t pt-4">
        <h2 className="font-semibold mb-2 text-sm">契約者情報（会社情報）</h2>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">会社名</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full border px-2 py-1 text-sm rounded"
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">住所1</label>
          <input
            type="text"
            value={companyAddress1}
            onChange={(e) => setCompanyAddress1(e.target.value)}
            className="w-full border px-2 py-1 text-sm rounded"
            placeholder="例: 福岡市博多区◯◯1-2-3"
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">住所2</label>
          <input
            type="text"
            value={companyAddress2}
            onChange={(e) => setCompanyAddress2(e.target.value)}
            className="w-full border px-2 py-1 text-sm rounded"
            placeholder="ビル名・号室など"
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">代表者名</label>
          <input
            type="text"
            value={representativeName}
            onChange={(e) => setRepresentativeName(e.target.value)}
            className="w-full border px-2 py-1 text-sm rounded"
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">連絡先（代表）</label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="w-full border px-2 py-1 text-sm rounded"
            placeholder="例: 0921234567"
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">
            連絡先（携帯・担当者など）
          </label>
          <input
            type="tel"
            value={contactMobile}
            onChange={(e) => setContactMobile(e.target.value)}
            className="w-full border px-2 py-1 text-sm rounded"
            placeholder="例: 09012345678"
          />
        </div>
      </div>
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
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full border px-2 py-1 text-sm rounded"
            required
          >
            <option value="">プランを選択してください</option>
            <option value="BASIC">Basic（同時ログイン 1）</option>
            <option value="STANDARD">Standard（同時ログイン 2）</option>
            <option value="PRO">Pro（同時ログイン 3）</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            ※ 将来の仕様：MANAGER はプランに応じて同時ログイン数を制限します
            （BASIC:1 / STANDARD:2 / PRO:3）。CLIENT は常に 1、DEVELOPER は制限なし。
          </p>
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
