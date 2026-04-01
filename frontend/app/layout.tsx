import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PitLink",
  description: "自動車業向け LINE 連携プラットフォーム PitLink のログインページです。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // middleware が生成した nonce を読み取る
  // Next.js はこの nonce を自動的にハイドレーション用 <script> タグに付与する
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-green-50 to-white`}
        {...(nonce ? { "data-nonce": nonce } : {})}
      >
        {children}
      </body>
    </html>
  );
}
