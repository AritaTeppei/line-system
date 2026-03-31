"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Role = "DEVELOPER" | "MANAGER" | "CLIENT";
type Me = { id: number; email: string; name: string | null; tenantId: number | null; role: Role };
type CreateTenantBody = { name: string; email: string; plan: string; isActive: boolean; validUntil: string | null };

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("auth_token") ?? window.localStorage.getItem("auth_token");
}

const PLAN_OPTIONS = [
  { value: "TRIAL",    label: "TRIAL",    cls: "bg-amber-900/50 text-amber-300 border-amber-700" },
  { value: "BASIC",    label: "BASIC",    cls: "bg-sky-900/50 text-sky-300 border-sky-700" },
  { value: "STANDARD", label: "STANDARD", cls: "bg-green-900/50 text-green-300 border-green-700" },
  { value: "PRO",      label: "PRO",      cls: "bg-purple-900/50 text-purple-300 border-purple-700" },
];

export default function NewTenantPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("STANDARD");
  const [isActive, setIsActive] = useState(true);
  const [validUntil, setValidUntil] = useState("");

  useEffect(() => {
    const token = getAuthToken();
    if (!token) { setError("先にログインしてください"); setLoading(false); return; }
    fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() as Promise<Me> : Promise.reject())
      .then((data) => {
        if (data.role !== "DEVELOPER") throw new Error("DEVELOPER アカウント専用です");
        setMe(data);
      })
      .catch((e: any) => setError(e?.message ?? "認証エラー"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("テナント名は必須です"); return; }
    if (!email.trim()) { setError("代表メールアドレスは必須です"); return; }
    const token = getAuthToken();
    if (!token) { setError("ログイン情報が失われました"); return; }

    const body: CreateTenantBody = {
      name: name.trim(),
      email: email.trim(),
      plan,
      isActive,
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
    };

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/admin/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(`作成に失敗しました (${res.status})${text ? `\n${text}` : ""}`);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/admin/overview"), 1000);
    } catch (e: any) {
      setError(e?.message ?? "作成中にエラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse text-sm">読み込み中...</p>
    </div>
  );

  if (error && !me) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="rounded-2xl bg-red-950 border border-red-800 p-6 text-red-300 text-sm max-w-sm w-full text-center space-y-4">
        <p>{error}</p>
        <button onClick={() => router.push("/admin/overview")} className="text-xs text-gray-400 hover:text-white underline">
          Overviewへ戻る
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => router.push("/admin/overview")}
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
            >
              ←
            </button>
            <div>
              <h1 className="text-sm font-black text-white leading-tight">新規テナント作成</h1>
              <p className="text-[11px] text-gray-500 hidden sm:block">Developer Console</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/admin/overview")}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            一覧へ戻る
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">

        {/* Success */}
        {success && (
          <div className="mb-4 rounded-xl bg-emerald-950 border border-emerald-700 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
            <span>✅</span> テナントを作成しました。一覧へ移動します…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-950/60 border border-red-800 px-4 py-3 text-sm text-red-300 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* Form card */}
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-5 sm:p-6 space-y-5">

          <div>
            <h2 className="text-base font-black text-white">テナント情報</h2>
            <p className="text-xs text-gray-500 mt-0.5">新しいテナントを手動で追加します</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* テナント名 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">
                テナント名（会社名） <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例）○○自動車整備工場"
                className="w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 placeholder-gray-600 outline-none focus:border-green-500 transition-colors"
              />
            </div>

            {/* 代表メール */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">
                代表メールアドレス <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="例）info@example.com"
                className="w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 placeholder-gray-600 outline-none focus:border-green-500 transition-colors"
              />
              <p className="text-[11px] text-gray-600">契約・管理用の代表メールアドレスです</p>
            </div>

            {/* プラン */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">プラン</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PLAN_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPlan(p.value)}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all ${p.cls} ${plan === p.value ? "ring-2 ring-white/30 scale-105" : "opacity-50 hover:opacity-80"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 有効フラグ */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${isActive ? "bg-green-500" : "bg-gray-700"}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <div>
                <p className="text-sm font-semibold text-gray-200">{isActive ? "有効" : "無効"}</p>
                <p className="text-[11px] text-gray-500">テナントのアクセス可否を設定します</p>
              </div>
            </div>

            {/* 有効期限 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">有効期限（任意）</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="rounded-xl bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 outline-none focus:border-green-500 transition-colors"
              />
              <p className="text-[11px] text-gray-600">空のままでも作成できます</p>
            </div>

            {/* Submit */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={saving || success}
                className="w-full rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-3 transition-colors"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    作成中...
                  </span>
                ) : "テナントを作成"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
