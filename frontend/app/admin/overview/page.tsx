'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
  subscriptionStatus: string | null;
  stripeSubscriptionId: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  companyName: string | null;
  representativeName: string | null;
  contactPhone: string | null;
};

const PLAN_PRICES: Record<string, number> = { BASIC: 9800, STANDARD: 15000, PRO: 20000 };

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('auth_token') ?? window.localStorage.getItem('auth_token');
}

function getPlanKey(t: TenantOverview): string {
  return t.subscriptionStatus === 'active' && t.plan ? t.plan : 'TRIAL';
}

function trialDaysLeft(trialEnd: string | null): number | null {
  if (!trialEnd) return null;
  return Math.ceil((new Date(trialEnd).getTime() - Date.now()) / 86400000);
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}

type PlanBadge = { label: string; cls: string };
function planBadge(t: TenantOverview): PlanBadge {
  const planKey = getPlanKey(t);
  const map: Record<string, PlanBadge> = {
    TRIAL: { label: 'TRIAL', cls: 'bg-amber-900/50 text-amber-300 border-amber-700' },
    BASIC: { label: 'BASIC', cls: 'bg-sky-900/50 text-sky-300 border-sky-700' },
    STANDARD: { label: 'STANDARD', cls: 'bg-green-900/50 text-green-300 border-green-700' },
    PRO: { label: 'PRO', cls: 'bg-purple-900/50 text-purple-300 border-purple-700' },
  };
  return map[planKey] ?? { label: planKey, cls: 'bg-gray-800 text-gray-400 border-gray-600' };
}

function StatusBadge({ t }: { t: TenantOverview }) {
  const days = trialDaysLeft(t.trialEnd);
  if (t.subscriptionStatus === 'active') {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />契約中</span>;
  }
  if (t.subscriptionStatus === 'past_due') {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">⚠ 支払遅延</span>;
  }
  if (days === null) return <span className="text-xs text-gray-600">-</span>;
  if (days < 0) return <span className="text-xs font-semibold text-red-400">期限切れ</span>;
  if (days <= 3) return <span className="text-xs font-semibold text-orange-400 animate-pulse">残 {days} 日</span>;
  return <span className="text-xs font-semibold text-amber-400">残 {days} 日</span>;
}

export default function DeveloperOverviewPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('ALL');
  const [view, setView] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    const token = getAuthToken();
    if (!token) { setError('ログインしてください'); setLoading(false); return; }
    fetch(`${apiBase}/admin/tenants/overview`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error('データ取得に失敗しました');
        return res.json() as Promise<TenantOverview[]>;
      })
      .then((data) => { setTenants(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  // 集計
  const total = tenants.length;
  const activeCount = tenants.filter((t) => t.subscriptionStatus === 'active').length;
  const trialCount = tenants.filter((t) => getPlanKey(t) === 'TRIAL').length;
  const pastDueCount = tenants.filter((t) => t.subscriptionStatus === 'past_due').length;
  const mrr = tenants.filter((t) => t.subscriptionStatus === 'active').reduce((s, t) => s + (PLAN_PRICES[t.plan!] ?? 0), 0);
  const planCounts: Record<string, number> = {};
  for (const t of tenants) {
    const k = getPlanKey(t);
    planCounts[k] = (planCounts[k] ?? 0) + 1;
  }

  // フィルタ
  const filtered = tenants.filter((t) => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || (t.email ?? '').toLowerCase().includes(q) || (t.companyName ?? '').toLowerCase().includes(q);
    const matchPlan = filterPlan === 'ALL' || getPlanKey(t) === filterPlan;
    return matchSearch && matchPlan;
  });

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse text-sm">読み込み中...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="rounded-2xl bg-red-950 border border-red-800 p-6 text-red-300 text-sm max-w-sm w-full text-center">{error}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl flex-shrink-0">🛠️</span>
            <div className="min-w-0">
              <h1 className="text-sm font-black text-white leading-tight">Developer Overview</h1>
              <p className="text-[11px] text-gray-500 hidden sm:block">PitLink 管理ダッシュボード</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => router.push('/admin/tenants/new')}
              className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-700 hover:border-emerald-500 rounded-lg px-2.5 py-1.5 transition-colors hidden sm:block"
            >
              ＋ 新規テナント
            </button>
            <button
              onClick={() => { if (typeof window !== 'undefined') { window.localStorage.removeItem('auth_token'); } router.push('/admin/login'); }}
              className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { icon: '🏢', value: total, label: '総テナント', color: 'text-white' },
            { icon: '💳', value: activeCount, label: 'サブスク契約中', color: 'text-emerald-400' },
            { icon: '⏳', value: trialCount, label: 'トライアル中', color: 'text-amber-400' },
            { icon: '⚠️', value: pastDueCount, label: '支払い遅延', color: pastDueCount > 0 ? 'text-red-400' : 'text-gray-600' },
            { icon: '💰', value: `¥${mrr.toLocaleString()}`, label: 'MRR (月次売上)', color: 'text-yellow-400', wide: true },
          ].map((k) => (
            <div key={k.label} className={`rounded-2xl bg-gray-900 border border-gray-800 px-4 py-3 flex items-center gap-3 ${k.wide ? 'col-span-2 sm:col-span-1' : ''}`}>
              <span className="text-2xl">{k.icon}</span>
              <div>
                <p className={`text-xl font-black leading-tight ${k.color}`}>{k.value}</p>
                <p className="text-[11px] text-gray-500 leading-tight">{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plan Bar */}
        <div className="rounded-2xl bg-gray-900 border border-gray-800 px-4 py-3 flex flex-wrap gap-2 items-center">
          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide mr-1">プラン分布</p>
          {(['TRIAL', 'BASIC', 'STANDARD', 'PRO'] as const).map((p) => {
            const cnt = planCounts[p] ?? 0;
            const colors: Record<string, string> = {
              TRIAL: 'bg-amber-900/50 border-amber-700 text-amber-300',
              BASIC: 'bg-sky-900/50 border-sky-700 text-sky-300',
              STANDARD: 'bg-green-900/50 border-green-700 text-green-300',
              PRO: 'bg-purple-900/50 border-purple-700 text-purple-300',
            };
            return (
              <button
                key={p}
                onClick={() => setFilterPlan(filterPlan === p ? 'ALL' : p)}
                className={`border rounded-full px-3 py-1 text-xs font-bold transition-all ${colors[p]} ${filterPlan === p ? 'ring-2 ring-white/30 scale-105' : 'opacity-70 hover:opacity-100'}`}
              >
                {p} <span className="font-black">{cnt}</span>
              </button>
            );
          })}
          {filterPlan !== 'ALL' && (
            <button onClick={() => setFilterPlan('ALL')} className="text-xs text-gray-500 hover:text-gray-300 ml-1">✕ 解除</button>
          )}
        </div>

        {/* Search & View Toggle */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="テナント名・メール・会社名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 placeholder-gray-500 outline-none focus:border-green-500 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">✕</button>
            )}
          </div>
          {/* view toggle – hidden on mobile (always cards) */}
          <div className="hidden sm:flex rounded-xl border border-gray-700 overflow-hidden flex-shrink-0">
            {(['table', 'cards'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-2 text-xs font-bold transition-colors ${view === v ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {v === 'table' ? '📋 表' : '🃏 カード'}
              </button>
            ))}
          </div>
        </div>

        {/* Result count */}
        <p className="text-xs text-gray-500">{filtered.length} 件表示</p>

        {/* === TABLE VIEW === */}
        {view === 'table' && (
          <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-800 text-[11px] text-gray-500 uppercase tracking-wide bg-gray-800/50">
                    <th className="text-left px-4 py-3">テナント</th>
                    <th className="text-left px-3 py-3">プラン</th>
                    <th className="text-left px-3 py-3">状態</th>
                    <th className="text-center px-3 py-3">顧客</th>
                    <th className="text-center px-3 py-3">車両</th>
                    <th className="text-center px-3 py-3">予約</th>
                    <th className="text-left px-3 py-3">次回 / 期限</th>
                    <th className="px-3 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const badge = planBadge(t);
                    const dateLabel = fmtDate(t.currentPeriodEnd ?? t.trialEnd);
                    return (
                      <tr
                        key={t.id}
                        className={`border-b border-gray-800/60 hover:bg-gray-800/50 transition-colors cursor-pointer ${!t.isActive ? 'opacity-40' : ''}`}
                        onClick={() => router.push(`/admin/tenants/${t.id}/edit`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-600 font-mono w-5">#{t.id}</span>
                            <div>
                              <p className="font-bold text-white text-sm leading-tight">{t.name}</p>
                              {t.companyName && <p className="text-[11px] text-gray-500">{t.companyName}</p>}
                              <p className="text-[11px] text-gray-600">{t.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block border rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td className="px-3 py-3"><StatusBadge t={t} /></td>
                        <td className="px-3 py-3 text-center font-bold text-gray-300">{t.customersCount}</td>
                        <td className="px-3 py-3 text-center font-bold text-gray-300">{t.carsCount}</td>
                        <td className="px-3 py-3 text-center font-bold text-gray-300">{t.bookingsCount}</td>
                        <td className="px-3 py-3 text-xs text-gray-500">{dateLabel ?? '-'}</td>
                        <td className="px-3 py-3">
                          <span className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-2 py-1 transition-colors">編集</span>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-600 text-sm">該当するテナントがありません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === CARD VIEW (always shown on mobile) === */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${view === 'cards' ? 'sm:grid' : 'sm:hidden'}`}>
          {filtered.map((t) => {
            const badge = planBadge(t);
            const dateLabel = fmtDate(t.currentPeriodEnd ?? t.trialEnd);
            return (
              <div
                key={t.id}
                onClick={() => router.push(`/admin/tenants/${t.id}/edit`)}
                className={`rounded-2xl bg-gray-900 border border-gray-800 p-4 cursor-pointer hover:border-gray-600 transition-all active:scale-[0.99] ${!t.isActive ? 'opacity-50' : ''}`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] text-gray-600 font-mono">#{t.id}</span>
                      <p className="font-black text-white text-sm truncate">{t.name}</p>
                    </div>
                    {t.companyName && <p className="text-xs text-gray-500 truncate">{t.companyName}</p>}
                    <p className="text-xs text-gray-600 truncate">{t.email}</p>
                  </div>
                  <span className={`flex-shrink-0 border rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-800">
                  <StatusBadge t={t} />
                  <span className="text-[11px] text-gray-600">{dateLabel ?? ''}</span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '顧客', value: t.customersCount, icon: '👥' },
                    { label: '車両', value: t.carsCount, icon: '🚗' },
                    { label: '予約', value: t.bookingsCount, icon: '📅' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-gray-800 px-2 py-2 text-center">
                      <p className="text-base font-black text-white">{s.value}</p>
                      <p className="text-[10px] text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-600 text-sm">該当するテナントがありません</div>
          )}
        </div>
      </div>
    </div>
  );
}
