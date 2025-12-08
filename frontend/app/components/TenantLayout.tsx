// frontend/app/components/TenantLayout.tsx
'use client';

import { ReactNode, useEffect, useState } from 'react';
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
  tenant?: {
    name?: string | null;
    displayName?: string | null;
  } | null;
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

// メインメニュー
const mainLinks = [
  { href: '/dashboard', label: 'ダッシュボード' },
  { href: '/customers', label: '顧客一覧' },
  { href: '/cars', label: '車両一覧' },
  { href: '/bookings', label: '予約一覧' },
  { href: '/reminders/month', label: 'リマインド管理' },
];

// ★ 管理者用「各種設定」メニュー（3つに集約）
const managerSettingLinks = [
  { href: '/settings/messages', label: 'メッセージ設定' },
  { href: '/settings/change-password', label: '設定パスワード' },
  { href: '/onboarding/line', label: 'LINE連携' },
  { href: '/billing', label: 'サブスク登録' },
];

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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

  // LINE設定 + サブスク登録が完了していたらパネル非表示
  const allDone =
    status.hasLineSettings &&
    status.lineSettingsActive &&
    status.hasSubscription;

  if (allDone) return null;

  return (
    <section className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-gray-800">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="font-semibold text-yellow-900 text-sm mb-1">
            初期設定の進捗
          </p>
          <p className="text-[11px] text-gray-700">
            テナント名：<b>{status.tenantName}</b>（プラン: {status.plan}）
          </p>
          <ul className="mt-1 space-y-[2px] text-[11px]">
            <li>
              ・LINE連携：
              <b>
                {status.hasLineSettings
                  ? status.lineSettingsActive
                    ? '設定済み（有効）'
                    : '設定済み（無効）'
                  : '未設定'}
              </b>
            </li>
            <li>
              ・サブスク（クレジット登録）：
              <b>
                {status.hasSubscription
                  ? `登録済み（${status.subscriptionStatus ?? '状態不明'}）`
                  : '未登録'}
              </b>
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-1 sm:mt-0">
          <button
            type="button"
            className="px-3 py-1 rounded-md border border-emerald-500 bg-white text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
            onClick={() => router.push('/onboarding/line')}
          >
            LINE連携の設定
          </button>
          <button
            type="button"
            className="px-3 py-1 rounded-md border border-blue-500 bg-white text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
            onClick={() => router.push('/billing')}
          >
            サブスク登録・プラン管理
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-1 text-[10px] text-red-700 whitespace-pre-wrap">
          {error}
        </p>
      )}
    </section>
  );
}

export default function TenantLayout({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null); // ★ 追加：ログインユーザー情報

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
        setMe(meData); // ★ me を保存

        // ログインユーザー名（担当）
        const userNameValue = meData.name ?? null;
        setUserName(userNameValue);

        const tenantNameFromApi =
          meData.tenantName ??
          meData.tenant?.name ??
          meData.tenant?.displayName ??
          null;

        const tenantNameValue =
          tenantNameFromApi ??
          (meData.tenantId != null
            ? `Tenant #${meData.tenantId}`
            : null);

        setTenantName(tenantNameValue);
      } catch (e) {
        console.error('テナント情報の取得に失敗しました', e);
        setTenantName(null);
        setUserName(null);
        setMe(null);
      }
    };

    fetchInfo();
  }, []);

  const handleLogout = async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const token = window.localStorage.getItem('auth_token');

    if (token && apiBase) {
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

    router.push('/');
  };

  return (
    <div className="min-h-screen flex bg-[#F7FFF8]">
      {/* 左サイドバー */}
      <aside className="w-56 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
        {/* ロゴ & タイトル部分 */}
        <div className="px-4 py-4 border-b border-gray-100 flex flex-col items-center">
          <div className="w-[160px] mb-2">
            <Image
              src="/pitlink-logo.png"
              alt="PitLink ロゴ"
              width={160}
              height={160}
              className="w-full h-auto"
              priority
            />
          </div>
          <div className="text-[11px] text-gray-500 text-center leading-tight">
            自動車業界向けLINE 連携プラットフォーム
          </div>
          <div className="mt-2 text-xs font-bold text-gray-800">
            LINE 通知システム
          </div>

          {/* ログインユーザー（担当） */}
          {userName && (
            <div className="mt-0.5 text-[11px] text-gray-600 text-center">
              ログインユーザー：
              <span className="font-medium">{userName}</span>
            </div>
          )}

          {/* テナント名（あれば） */}
          {tenantName && (
            <div className="mt-0.5 text-[11px] text-gray-600 text-center">
              テナント：
              <span className="font-medium">{tenantName}</span>
            </div>
          )}

          {/* ログアウトボタン */}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 w-full inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-800 hover:bg-gray-100 transition-colors"
          >
            ログアウト
          </button>
        </div>

        {/* ナビゲーション */}
        <nav className="px-3 py-4 text-xs flex-1 flex flex-col">
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
                    'flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors',
                    active
                      ? 'bg-[#00C300] text-white'
                      : 'text-gray-700 hover:bg-green-50 hover:text-[#00C300]',
                  ].join(' ')}
                >
                  <span>{link.label}</span>

                  {/* 未確認予約バッジ */}
                  {showBadge && (
                    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] min-w-[18px] px-1">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* 各種設定（★ 管理者のみ・3つに集約） */}
          {me?.role === 'MANAGER' && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="mb-2 text-[11px] font-semibold text-gray-500 tracking-wide">
                - 各種設定 -
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
                        'flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors',
                        active
                          ? 'bg-[#00C300] text-white'
                          : 'text-gray-700 hover:bg-green-50 hover:text-[#00C300]',
                      ].join(' ')}
                    >
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* フッター */}
        <div className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-400 text-center">
          &copy; PitLink
        </div>
      </aside>

      {/* 右側：各ページの中身 */}
      <div className="flex-1 px-4 py-5">
        {/* ★ 初期設定の進捗（TenantLayout 配下の全ページ共通） */}
        <OnboardingPanel me={me} />

        {children}
      </div>
    </div>
  );
}
