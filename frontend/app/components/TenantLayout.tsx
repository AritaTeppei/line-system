// frontend/app/components/TenantLayout.tsx
'use client';

import { ReactNode, useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

type Props = {
  children: ReactNode;
};

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELED';

type Booking = {
  id: number;
  status: BookingStatus;
};

type Role = 'DEVELOPER' | 'MANAGER' | 'CLIENT';

type MeResponse = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
  tenantName?: string | null;
  tenantPlan?: string | null;
  trialEnd?: string | null;
  trialRemainingDays?: number | null;
};

type OnboardingStatus = {
  tenantId: number;
  tenantName: string;
  plan: string;
  hasLineSettings: boolean;
  lineSettingsActive: boolean;
  hasSubscription: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
} | null;

// メインメニュー（絵文字アイコン付き）
const mainLinks = [
  { href: '/dashboard', label: 'ダッシュボード', icon: '📊' },
  { href: '/customers', label: '顧客一覧', icon: '👥' },
  { href: '/cars', label: '車両一覧', icon: '🚗' },
  { href: '/bookings', label: '予約一覧', icon: '📅' },
  { href: '/reminders/month', label: 'リマインド管理', icon: '🔔' },
];

// ★ 管理者用「各種設定」メニュー
const managerSettingLinks = [
  { href: '/settings/messages', label: 'メッセージ設定', icon: '💬' },
  { href: '/settings/change-password', label: 'パスワード設定', icon: '🔒' },
  { href: '/onboarding/line', label: 'LINE連携', icon: '🟢' },
  { href: '/billing', label: 'サブスク・プラン管理', icon: '💳' },
];

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const FRONT_INACTIVITY_LOGOUT_MS =
  process.env.NODE_ENV === 'development'
    ? 30 * 60 * 1000
    : 30 * 60 * 1000;


function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const fromSession = window.sessionStorage.getItem('auth_token');
  if (fromSession) return fromSession;
  return window.localStorage.getItem('auth_token');
}

// ★ 初期設定の進捗パネル（管理者 & 未完了のときだけ表示）
function OnboardingPanel({ me }: { me: MeResponse | null }) {
  const [status, setStatus] = useState<OnboardingStatus>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !me?.tenantId || me.role !== 'MANAGER') {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${apiBase}/onboarding/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tenantId: me.tenantId }),
        });

        if (!res.ok) {
          setError('設定状況の取得に失敗しました。');
          setLoading(false);
          return;
        }

        const data = (await res.json()) as { status: OnboardingStatus };
        setStatus(data.status ?? null);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError('設定状況の取得に失敗しました。');
        setLoading(false);
      }
    })();
  }, [me]);

  if (loading) return null;
  if (!me || me.role !== 'MANAGER') return null;
  if (!status) return null;

  const allDone =
    status.hasLineSettings &&
    status.lineSettingsActive &&
    status.hasSubscription;

  if (allDone) return null;

  const step1Done = status.hasLineSettings && status.lineSettingsActive;
  const step2Done = status.hasSubscription;

  return (
    <section className="mb-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-4 shadow-sm">
      <p className="font-bold text-amber-900 text-sm mb-3 flex items-center gap-2">
        🚀 初期設定を完了させましょう
      </p>

      <div className="space-y-2 mb-4">
        {/* STEP 1: LINE連携 */}
        <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${step1Done ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-amber-200'}`}>
          <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step1Done ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'}`}>
            {step1Done ? '✓' : '1'}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold ${step1Done ? 'text-emerald-700 line-through' : 'text-gray-800'}`}>
              LINE連携の設定
            </p>
            {!step1Done && (
              <p className="text-[10px] text-gray-500">未設定 — まずはここから</p>
            )}
          </div>
          {step1Done && <span className="text-emerald-500 text-sm">✅</span>}
        </div>

        {/* STEP 2: サブスク登録 */}
        <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${step2Done ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-amber-200'}`}>
          <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step2Done ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'}`}>
            {step2Done ? '✓' : '2'}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold ${step2Done ? 'text-emerald-700 line-through' : 'text-gray-800'}`}>
              サブスク登録
            </p>
            {!step2Done && (
              <p className="text-[10px] text-gray-500">未登録 — フル機能が使えます</p>
            )}
          </div>
          {step2Done && <span className="text-emerald-500 text-sm">✅</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {!step1Done && (
          <button
            type="button"
            className="w-full px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm"
            onClick={() => router.push('/onboarding/line')}
          >
            🟢 LINE連携を設定する
          </button>
        )}
        {!step2Done && (
          <button
            type="button"
            className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
            onClick={() => router.push('/billing')}
          >
            💳 サブスク登録・プラン管理
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[10px] text-red-700 whitespace-pre-wrap">
          {error}
        </p>
      )}
    </section>
  );
}

// ★ BASIC プラン専用バナー（プラン制限の案内）
function BasicPlanBanner({ me }: { me: MeResponse | null }) {
  if (!me) return null;
  if (!me.tenantPlan || me.tenantPlan.toUpperCase() !== 'BASIC') return null;

  return (
    <div className="mt-3 w-full rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-slate-50 px-3 py-3">
      <p className="text-xs font-bold text-blue-800 flex items-center gap-1 mb-2">
        🔵 BASICプラン
      </p>
      <ul className="space-y-1 mb-2">
        <li className="text-[10px] text-blue-700 flex items-center gap-1">
          <span className="text-emerald-500 font-bold">✓</span> LINE送信 月200通まで
        </li>
        <li className="text-[10px] text-red-500 flex items-center gap-1">
          <span className="font-bold">✗</span> 外部API連携 不可
        </li>
      </ul>
      <Link
        href="/billing"
        className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-2 py-1.5 text-[10px] font-bold text-white transition-colors shadow-sm"
      >
        STANDARDへアップグレード →
      </Link>
    </div>
  );
}

// ★ TRIAL テナント専用バナー（サイドバー用）
function TrialBanner({ me }: { me: MeResponse | null }) {
  if (!me) return null;
  if (me.role !== 'MANAGER') return null;

  const rawPlan = me.tenantPlan ?? '';
  if (!rawPlan || rawPlan.toUpperCase() !== 'TRIAL') {
    return null;
  }

  // 残り日数を計算（トライアルは7日間前提）
  const TRIAL_TOTAL_DAYS = 7;
  let remainingDays: number | null = null;
  let progressPercent = 100;

  if (me.trialEnd) {
    const end = new Date(me.trialEnd);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    // 経過日数を算出してプログレスバーに使用
    const elapsed = TRIAL_TOTAL_DAYS - Math.max(0, remainingDays);
    progressPercent = Math.min(100, Math.max(0, (elapsed / TRIAL_TOTAL_DAYS) * 100));
  }

  // 残り日数に応じた緊急カラー
  const isUrgent = remainingDays !== null && remainingDays <= 3;
  const isWarning = remainingDays !== null && remainingDays <= 7 && !isUrgent;

  const bannerBg = isUrgent
    ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-300'
    : isWarning
    ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300'
    : 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300';

  const countBg = isUrgent
    ? 'bg-red-500'
    : isWarning
    ? 'bg-orange-500'
    : 'bg-amber-500';

  const textColor = isUrgent
    ? 'text-red-800'
    : isWarning
    ? 'text-orange-800'
    : 'text-amber-800';

  const barColor = isUrgent
    ? 'bg-red-400'
    : isWarning
    ? 'bg-orange-400'
    : 'bg-amber-400';

  return (
    <div className={`mt-3 w-full rounded-xl border ${bannerBg} px-3 py-3`}>
      <p className={`text-xs font-bold ${textColor} flex items-center gap-1`}>
        ⏳ トライアル中
      </p>

      {remainingDays !== null && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className={`${countBg} text-white rounded-lg px-3 py-1 text-2xl font-black leading-tight`}>
            {Math.max(0, remainingDays)}
          </span>
          <span className={`text-sm font-bold ${textColor}`}>日</span>
        </div>
      )}

      {/* 進捗バー */}
      <div className="mt-2 w-full bg-white/70 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className={`mt-1 text-[10px] ${textColor} text-center`}>
        トライアル経過 {Math.round(progressPercent)}%
      </p>

      <p className={`mt-2 text-[10px] ${textColor} text-center leading-tight`}>
        顧客・車両・予約に<br />利用件数の制限があります
      </p>

      <Link
        href="/billing"
        className={`mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg ${isUrgent ? 'bg-red-500 hover:bg-red-600' : isWarning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-amber-500 hover:bg-amber-600'} px-2 py-2 text-xs font-bold text-white transition-colors shadow-sm`}
      >
        今すぐプラン登録する →
      </Link>
    </div>
  );
}



export default function TenantLayout({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = getAuthToken();
    if (!token) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [me]);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      setPendingCount(null);
      setTenantName(null);
      setUserName(null);
      setMe(null);
      return;
    }

    if (!apiBase) {
      console.error('NEXT_PUBLIC_API_URL が設定されていません');
      return;
    }

    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
    };

    const fetchInfo = async () => {
      // ① 予約一覧（未確認件数）
      try {
        const bookingsRes = await fetch(`${apiBase}/bookings`, {
          headers,
        });

        if (!bookingsRes.ok) {
          throw new Error('failed to fetch bookings');
        }

        const bookingsData: Booking[] = await bookingsRes.json();
        const pending = bookingsData.filter(
          (b) => b.status === 'PENDING',
        ).length;
        setPendingCount(pending);
      } catch (e) {
        console.error('予約一覧の取得に失敗しました', e);
        setPendingCount(null);
      }

      // ② /auth/me（テナント名＆ログインユーザー名）
      try {
        const meRes = await fetch(`${apiBase}/auth/me`, {
          headers,
        });

        if (!meRes.ok) {
          throw new Error('failed to fetch me');
        }

        const meData: MeResponse = await meRes.json();
        setMe(meData);

        setUserName(meData.name ?? null);
        setTenantName(meData.tenantName ?? null);
      } catch (e) {
        console.error('テナント情報の取得に失敗しました', e);
        setTenantName(null);
        setUserName(null);
        setMe(null);
      }
    };

    fetchInfo();
  }, []);

  const handleLogout = useCallback(async (skipApi?: boolean) => {
    if (typeof window === 'undefined') return;

    const token = window.localStorage.getItem('auth_token');

    if (!skipApi && token) {
      try {
        await fetch(`${apiBase}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (e) {
        console.error('logout api error', e);
      }
    }

    window.localStorage.removeItem('auth_token');
    document.cookie = 'Authentication=; Max-Age=0; path=/';
    document.cookie = 'access_token=; Max-Age=0; path=/';

    window.location.href = '/';
  }, [router]);


  useEffect(() => {
    if (typeof window === 'undefined') return;

    lastActivityRef.current = Date.now();

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events: (keyof WindowEventMap)[] = [
      'click',
      'keydown',
      'mousemove',
      'scroll',
      'touchstart',
    ];

    events.forEach((ev) => {
      window.addEventListener(ev, updateActivity);
    });

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const diff = now - lastActivityRef.current;

      if (diff > FRONT_INACTIVITY_LOGOUT_MS) {
        window.clearInterval(intervalId);
        events.forEach((ev) => {
          window.removeEventListener(ev, updateActivity);
        });

        handleLogout(true);
      }
    }, 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
      events.forEach((ev) => {
        window.removeEventListener(ev, updateActivity);
      });
    };
  }, [handleLogout, lastActivityRef]);


  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-50/50 to-white">

      {/* ── トップバー ── */}
      <header className="h-14 bg-white border-b border-gray-200 shadow-sm flex items-center px-5 gap-4 flex-shrink-0 z-20">
        {/* 店舗名 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-600 text-lg">🏪</span>
          <span className="font-bold text-gray-800 text-sm truncate max-w-[220px]">
            {tenantName ?? 'PitLink'}
          </span>
        </div>

        {/* セパレーター */}
        <div className="h-5 w-px bg-gray-200 flex-shrink-0" />

        {/* ログインユーザー */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-semibold text-gray-700 truncate">
            {userName ?? me?.email ?? ''}
          </span>
          {me?.role && (
            <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              me.role === 'MANAGER'
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {me.role === 'MANAGER' ? '管理者' : 'スタッフ'}
            </span>
          )}
        </div>

        {/* ログアウトボタン */}
        <button
          type="button"
          onClick={() => handleLogout(false)}
          className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
        >
          <span>🚪</span> ログアウト
        </button>
      </header>

      {/* ── メインエリア（サイドバー ＋ コンテンツ）── */}
      <div className="flex flex-1 min-h-0">

        {/* 左サイドバー */}
        <aside className="w-56 bg-gradient-to-b from-white to-green-50/30 border-r border-gray-200 flex-shrink-0 flex flex-col shadow-sm">

          {/* ロゴ */}
          <div className="px-4 py-5 border-b border-gray-100 flex flex-col items-center">
            <div className="w-[140px]">
              <Image
                src="/pitlink-logo.png"
                alt="PitLink ロゴ"
                width={140}
                height={140}
                className="w-full h-auto"
                priority
              />
            </div>
            <div className="mt-1 text-[11px] text-gray-400 text-center leading-snug">
              自動車業界向け LINE連携
            </div>

            {/* ★ TRIAL プラン用バナー */}
            <TrialBanner me={me} />
            {/* ★ BASIC プラン用バナー */}
            <BasicPlanBanner me={me} />
          </div>

          {/* ナビゲーション */}
          <nav className="px-3 py-4 text-sm flex-1 flex flex-col">
            {/* メインメニュー */}
            <div className="space-y-1">
              {mainLinks.map((link) => {
                const active =
                  pathname === link.href ||
                  (link.href !== '/dashboard' &&
                    pathname?.startsWith(link.href));

                const isBookingsLink = link.href === '/bookings';
                const showBadge =
                  isBookingsLink &&
                  pendingCount !== null &&
                  pendingCount > 0;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={[
                      'flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150 font-medium',
                      active
                        ? 'bg-[#00C300] text-white shadow-sm'
                        : 'text-gray-700 hover:bg-green-50 hover:text-[#00C300]',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-2">
                      <span>{link.icon}</span>
                      <span>{link.label}</span>
                    </span>

                    {showBadge && (
                      <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] min-w-[20px] px-1 font-bold">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* 各種設定（管理者のみ） */}
            {me?.role === 'MANAGER' && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <div className="mb-2 text-[11px] font-bold text-gray-400 tracking-widest px-1">
                  ⚙️ 各種設定
                </div>

                <div className="space-y-1">
                  {managerSettingLinks.map((link) => {
                    const active =
                      pathname === link.href ||
                      pathname?.startsWith(link.href);

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={[
                          'flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-150 font-medium text-sm',
                          active
                            ? 'bg-[#00C300] text-white shadow-sm'
                            : 'text-gray-700 hover:bg-green-50 hover:text-[#00C300]',
                        ].join(' ')}
                      >
                        <span>{link.icon}</span>
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          {/* フッター */}
          <div className="px-3 py-3 border-t border-gray-100 text-[10px] text-gray-400 text-center">
            &copy; PitLink
          </div>
        </aside>

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-auto px-5 py-6">
          <OnboardingPanel me={me} />
          {children}
        </div>

      </div>
    </div>
  );
}
