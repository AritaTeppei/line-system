// frontend/app/components/TenantLayout.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

type Props = {
  children: React.ReactNode;
};

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELED';

type Booking = {
  id: number;
  status: BookingStatus;
};

type MeResponse = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: 'DEVELOPER' | 'MANAGER' | 'CLIENT';
  // あるかもしれないフィールドたち（あれば勝手に拾う）
  tenantName?: string | null;
  tenant?: {
    name?: string | null;
    displayName?: string | null;
  } | null;
};

// メインメニュー
const mainLinks = [
  { href: '/dashboard', label: 'ダッシュボード' },
  { href: '/customers', label: '顧客一覧' },
  { href: '/cars', label: '車両一覧' },
  { href: '/bookings', label: '予約一覧' },
  { href: '/reminders/month', label: 'リマインド管理' },
];

// 各種設定メニュー
const settingLinks = [
  { href: '/settings/messages', label: 'メッセージ設定' },
  { href: '/settings/change-password', label: '設定（パスワード）' },
];

export default function TenantLayout({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;

    if (!token) {
      setPendingCount(null);
      setTenantName(null);
      setUserName(null);
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL;
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

        // ログインユーザー名（担当者）
        const userNameValue = meData.name ?? null;
        setUserName(userNameValue);

        // テナント名候補：バックエンドがどの形で返してきても拾えるようにしておく
        const tenantNameFromApi =
          meData.tenantName ??
          meData.tenant?.name ??
          meData.tenant?.displayName ??
          null;

        // それでも取れなければ tenantId を仮表示
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
      }
    };

    fetchInfo();
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('auth_token');
    }
    router.push('/'); // ログイン画面 or トップ
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

          {/* ★ ログインユーザー（担当） */}
          {userName && (
            <div className="mt-0.5 text-[11px] text-gray-600 text-center">
              ログインユーザー：
              <span className="font-medium">{userName}</span>
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

          {/* - 各種設定 - */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="mb-2 text-[11px] font-semibold text-gray-500 tracking-wide">
              - 各種設定 -
            </div>

            <div className="space-y-1">
              {settingLinks.map((link) => {
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
        </nav>

        {/* フッター */}
        <div className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-400 text-center">
          &copy; PitLink
        </div>
      </aside>

      {/* 右側：各ページの中身 */}
      <div className="flex-1 px-4 py-5">{children}</div>
    </div>
  );
}
