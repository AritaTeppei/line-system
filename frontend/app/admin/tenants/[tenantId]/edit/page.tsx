'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type TenantDetail = {
  id: number;
  name: string;
  email: string | null;
  plan: string | null;
  isActive: boolean;
  validUntil: string | null;
  customersCount: number;
  carsCount: number;
  bookingsCount: number;
  subscriptionStatus: string | null;
  stripeSubscriptionId: string | null;
  companyName: string | null;
  companyAddress1: string | null;
  companyAddress2: string | null;
  representativeName: string | null;
  contactPhone: string | null;
  contactMobile: string | null;
};

function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('auth_token');
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
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

const inputCls = 'w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-sm px-4 py-2.5 placeholder-gray-600 outline-none focus:border-green-500 transition-colors';

export default function AdminTenantEditPage() {
  const router = useRouter();
  const params = useParams<{ tenantId: string }>();
  const tenantId = Number(params.tenantId);

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [validUntil, setValidUntil] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress1, setCompanyAddress1] = useState('');
  const [companyAddress2, setCompanyAddress2] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMobile, setContactMobile] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) { setError('先にログインしてください'); setLoading(false); return; }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${apiBase}/auth/me`, { headers }).then(r => r.json()),
      fetch(`${apiBase}/admin/tenants/${tenantId}`, { headers }).then(r => r.ok ? r.json() : Promise.reject('テナント取得失敗')),
    ])
      .then(([me, data]: [any, TenantDetail]) => {
        if (me.role !== 'DEVELOPER') throw new Error('開発者専用ページです');
        setTenant(data);
        setName(data.name ?? '');
        setEmail(data.email ?? '');
        const p = (data.plan ?? '').toUpperCase();
        setPlan(['BASIC', 'STANDARD', 'PRO'].includes(p) ? p : '');
        setIsActive(data.isActive);
        setCompanyName(data.companyName ?? '');
        setCompanyAddress1(data.companyAddress1 ?? '');
        setCompanyAddress2(data.companyAddress2 ?? '');
        setRepresentativeName(data.representativeName ?? '');
        setContactPhone(data.contactPhone ?? '');
        setContactMobile(data.contactMobile ?? '');
        if (data.validUntil) {
          const d = new Date(data.validUntil);
          if (!isNaN(d.getTime())) setValidUntil(d.toISOString().slice(0, 10));
        }
      })
      .catch((e: any) => setError(e?.message ?? 'データ取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token || !tenant) return;
    setSaving(true); setError(null); setSaveSuccess(false);
    try {
      const res = await fetch(`${apiBase}/admin/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, plan, isActive, validUntil: validUntil || null, companyName: companyName || null, companyAddress1: companyAddress1 || null, companyAddress2: companyAddress2 || null, representativeName: representativeName || null, contactPhone: contactPhone || null, contactMobile: contactMobile || null }),
      });
      if (!res.ok) throw new Error('保存に失敗しました');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.message ?? '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleResetData = async () => {
    const token = getToken();
    if (!token || !tenant) return;
    setResetting(true); setError(null);
    try {
      const res = await fetch(`${apiBase}/admin/tenants/${tenant.id}/reset-data`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('リセットに失敗しました');
      setTenant({ ...tenant, customersCount: 0, carsCount: 0, bookingsCount: 0 });
      setShowResetConfirm(false);
    } catch (e: any) {
      setError(e?.message ?? 'リセットに失敗しました');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteTenant = async () => {
    const token = getToken();
    if (!token || !tenant) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`${apiBase}/admin/tenants/${tenant.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? 'テナントの削除に失敗しました');
      }
      router.replace('/admin/overview');
    } catch (e: any) {
      setDeleteError(e?.message ?? 'テナントの削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse text-sm">読み込み中...</p>
    </div>
  );

  if (error && !tenant) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="rounded-2xl bg-red-950 border border-red-800 p-6 text-red-300 text-sm max-w-sm w-full text-center space-y-4">
        <p>{error}</p>
        <button onClick={() => router.push('/admin/overview')} className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5">← 一覧に戻る</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button onClick={() => router.push('/admin/overview')} className="text-gray-500 hover:text-white transition-colors text-sm">←</button>
            <div className="min-w-0">
              <h1 className="text-sm font-black text-white truncate">テナント編集 <span className="text-gray-500 font-normal text-xs">#{tenantId}</span></h1>
              {tenant && <p className="text-[11px] text-gray-500 truncate">{tenant.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => router.push(`/admin/tenants/${tenantId}/line-settings`)}
              className="text-xs text-green-400 hover:text-green-300 border border-green-800 hover:border-green-600 rounded-lg px-2.5 py-1.5 transition-colors hidden sm:block"
            >
              📡 LINE設定
            </button>
            <button
              onClick={() => router.push(`/admin/tenants/${tenantId}/user`)}
              className="text-xs text-purple-400 hover:text-purple-300 border border-purple-800 hover:border-purple-600 rounded-lg px-2.5 py-1.5 transition-colors hidden sm:block"
            >
              👤 ユーザー管理
            </button>
            <button onClick={() => router.push('/admin/overview')} className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-2.5 py-1.5 transition-colors">
              一覧へ
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Mobile nav buttons */}
        <div className="flex gap-2 sm:hidden">
          <button onClick={() => router.push(`/admin/tenants/${tenantId}/line-settings`)} className="flex-1 text-xs text-green-400 border border-green-800 rounded-xl py-2 text-center">📡 LINE設定</button>
          <button onClick={() => router.push(`/admin/tenants/${tenantId}/user`)} className="flex-1 text-xs text-purple-400 border border-purple-800 rounded-xl py-2 text-center">👤 ユーザー管理</button>
        </div>

        {/* Stats bar */}
        {tenant && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '顧客', value: tenant.customersCount, icon: '👥' },
              { label: '車両', value: tenant.carsCount, icon: '🚗' },
              { label: '予約', value: tenant.bookingsCount, icon: '📅' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-gray-900 border border-gray-800 px-4 py-3 flex items-center gap-3">
                <span className="text-xl">{s.icon}</span>
                <div>
                  <p className="text-xl font-black text-white">{s.value}</p>
                  <p className="text-[11px] text-gray-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error / Success */}
        {error && <div className="rounded-xl bg-red-950/60 border border-red-800 px-4 py-3 text-xs text-red-300">{error}</div>}
        {saveSuccess && <div className="rounded-xl bg-emerald-950/60 border border-emerald-700 px-4 py-3 text-xs text-emerald-300">✅ 保存しました</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 基本情報 */}
          <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 bg-gray-800/50">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">🏢 基本情報</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              <Field label="テナント名" required>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputCls} placeholder="例: ○○自動車" />
              </Field>
              <Field label="メールアドレス" required>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputCls} placeholder="example@garage.jp" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="プラン" required>
                  <select value={plan} onChange={e => setPlan(e.target.value)} required className={inputCls + ' cursor-pointer'}>
                    <option value="">選択してください</option>
                    <option value="BASIC">BASIC（同時1名）</option>
                    <option value="STANDARD">STANDARD（同時2名）</option>
                    <option value="PRO">PRO（同時3名）</option>
                  </select>
                </Field>
                <Field label="有効期限（空白=無期限）">
                  <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isActive ? 'bg-green-500' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm text-gray-300">有効フラグ {isActive ? <span className="text-green-400 font-semibold">（有効）</span> : <span className="text-gray-500">（無効）</span>}</span>
              </div>
            </div>
          </div>

          {/* 契約者情報 */}
          <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 bg-gray-800/50">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">📋 契約者情報</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="会社名">
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className={inputCls} placeholder="例: 株式会社○○モータース" />
                </Field>
                <Field label="代表者名">
                  <input type="text" value={representativeName} onChange={e => setRepresentativeName(e.target.value)} className={inputCls} placeholder="例: 山田 太郎" />
                </Field>
              </div>
              <Field label="住所1">
                <input type="text" value={companyAddress1} onChange={e => setCompanyAddress1(e.target.value)} className={inputCls} placeholder="例: 福岡市博多区○○1-2-3" />
              </Field>
              <Field label="住所2">
                <input type="text" value={companyAddress2} onChange={e => setCompanyAddress2(e.target.value)} className={inputCls} placeholder="ビル名・号室など" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="代表電話">
                  <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={inputCls} placeholder="0921234567" />
                </Field>
                <Field label="携帯・担当者">
                  <input type="tel" value={contactMobile} onChange={e => setContactMobile(e.target.value)} className={inputCls} placeholder="09012345678" />
                </Field>
              </div>
            </div>
          </div>

          {/* 保存ボタン */}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 transition-colors"
          >
            {saving ? '保存中...' : '💾 変更を保存する'}
          </button>
        </form>

        {/* データリセット＆テナント削除 */}
        <div className="rounded-2xl bg-gray-900 border border-red-900/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-red-900/50 bg-red-950/20">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wide">⚠️ 危険操作</p>
          </div>
          <div className="px-5 py-4 space-y-4">
            {/* データリセット */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400">顧客・予約データのリセット</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                このテナントの<span className="text-red-400 font-semibold">顧客・車両・予約データをすべて削除</span>します。元に戻せません。
              </p>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="rounded-xl border border-red-800 text-red-400 hover:bg-red-950/50 text-xs font-bold px-4 py-2 transition-colors"
              >
                🗑️ テナントデータをリセットする
              </button>
            </div>

            <div className="border-t border-red-900/40 pt-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400">テナント削除（完全削除）</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                テナントとすべての関連データを<span className="text-red-400 font-semibold">完全に削除</span>します。<br />
                <span className="text-amber-400">サブスクが有効（active / trialing / past_due）の場合は削除できません。</span>先に解約してください。
              </p>
              {tenant && (() => {
                const activeStatuses = ['active', 'trialing', 'past_due'];
                const isBlocked = tenant.subscriptionStatus && activeStatuses.includes(tenant.subscriptionStatus);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">サブスク状態:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-full border text-[11px] ${
                        tenant.subscriptionStatus === 'active' ? 'bg-green-900/40 text-green-300 border-green-700' :
                        tenant.subscriptionStatus === 'trialing' ? 'bg-blue-900/40 text-blue-300 border-blue-700' :
                        tenant.subscriptionStatus === 'past_due' ? 'bg-orange-900/40 text-orange-300 border-orange-700' :
                        tenant.subscriptionStatus === 'canceled' ? 'bg-gray-800 text-gray-400 border-gray-700' :
                        'bg-gray-800 text-gray-500 border-gray-700'
                      }`}>
                        {tenant.subscriptionStatus ?? 'なし（TRIAL/未契約）'}
                      </span>
                      {isBlocked && <span className="text-red-400">← 削除不可</span>}
                    </div>
                    <button
                      type="button"
                      disabled={!!isBlocked}
                      onClick={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
                      className="rounded-xl border border-red-700 bg-red-950/30 text-red-400 hover:bg-red-950/70 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold px-4 py-2 transition-colors"
                    >
                      🚨 テナントを完全削除する
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* リセット確認モーダル */}
      {showResetConfirm && tenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-900 border border-red-800 p-6 space-y-4">
            <div className="text-center text-3xl">⚠️</div>
            <h3 className="text-base font-black text-white text-center">本当に削除しますか？</h3>
            <div className="rounded-xl bg-red-950/40 border border-red-800 px-4 py-3 text-xs text-red-300 space-y-1">
              <p>テナント：<span className="font-bold">{tenant.name}</span></p>
              <p>顧客 {tenant.customersCount} 件 / 車両 {tenant.carsCount} 件 / 予約 {tenant.bookingsCount} 件 を削除</p>
              <p className="font-bold mt-1">この操作は取り消せません。</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:text-white">キャンセル</button>
              <button onClick={handleResetData} disabled={resetting} className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-50">
                {resetting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* テナント完全削除確認モーダル */}
      {showDeleteConfirm && tenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-900 border border-red-700 p-6 space-y-4">
            <div className="text-center text-3xl">🚨</div>
            <h3 className="text-base font-black text-white text-center">テナントを完全削除しますか？</h3>
            <div className="rounded-xl bg-red-950/40 border border-red-800 px-4 py-3 text-xs text-red-300 space-y-1.5">
              <p>テナント: <span className="font-bold text-white">{tenant.name}</span> (#{tenant.id})</p>
              <p>顧客 {tenant.customersCount} 件 / 車両 {tenant.carsCount} 件 / 予約 {tenant.bookingsCount} 件</p>
              <p className="font-bold mt-1 text-red-400">全ユーザー・全データが完全に削除されます。</p>
              <p className="font-bold text-red-400">この操作は絶対に取り消せません。</p>
            </div>
            {deleteError && (
              <div className="rounded-xl bg-red-950/60 border border-red-800 px-3 py-2 text-xs text-red-300">
                {deleteError}
              </div>
            )}
            <p className="text-xs text-gray-500 text-center">本当に削除する場合のみ「完全削除」を押してください</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteTenant}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {deleting ? '削除中...' : '完全削除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
