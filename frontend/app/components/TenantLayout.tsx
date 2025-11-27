// frontend/app/components/TenantLayout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

type Props = {
  children: React.ReactNode;
};

const links = [
  { href: '/dashboard', label: 'ダッシュボード' },
  { href: '/customers', label: '顧客一覧' },
  { href: '/cars', label: '車両一覧' },
  { href: '/bookings', label: '予約一覧' },
  { href: '/reminders/month', label: 'リマインド管理' },
  // ★ メッセージ設定（MANAGER向け）。ルーティングは /settings/messages にしておく
  { href: '/settings/messages', label: 'メッセージ設定' },
  { href: '/settings/change-password', label: '設定（パスワード）' },
];

export default function TenantLayout({ children }: Props) {
  const pathname = usePathname();

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
            自動車業界向け LINE 連携プラットフォーム
          </div>
          <div className="mt-2 text-xs font-bold text-gray-800">
            LINE 通知システム
          </div>
        </div>

        {/* ナビゲーション */}
        <nav className="px-3 py-4 space-y-1 text-xs flex-1">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== '/dashboard' && pathname?.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  'block px-3 py-2 rounded-lg transition-colors',
                  active
                    ? 'bg-[#00C300] text-white'
                    : 'text-gray-700 hover:bg-green-50 hover:text-[#00C300]',
                ].join(' ')}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* フッター（任意） */}
        <div className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-400 text-center">
          &copy; PitLink
        </div>
      </aside>

      {/* 右側：各ページの中身 */}
      <div className="flex-1 px-4 py-5">{children}</div>
    </div>
  );
}
