// frontend/app/components/TenantLayout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  children: React.ReactNode;
};

const links = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/customers", label: "顧客一覧" },
  { href: "/cars", label: "車両一覧" },
  { href: "/bookings", label: "予約一覧" },
  { href: "/reminders", label: "リマインド管理" },
];

export default function TenantLayout({ children }: Props) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* 左サイドバー */}
      <aside className="w-44 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="px-3 py-3 border-b text-xs font-bold text-gray-700">
          LINE 車検システム
        </div>
        <nav className="px-2 py-3 space-y-1 text-xs">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname?.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "block px-2 py-2 rounded",
                  active
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-100",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 右側：各ページの中身 */}
      <div className="flex-1 px-4 py-5">{children}</div>
    </div>
  );
}
