import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const csp = [
    "default-src 'self'",
    // nonce: Next.js の SSR インラインスクリプトに自動付与される
    // strict-dynamic: nonce 済みスクリプトが動的に読み込むスクリプトを許可
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // style: Next.js の Critical CSS はインラインのため unsafe-inline が必要
    "style-src 'self' 'unsafe-inline'",
    // img: data: は Base64 画像、blob: はオブジェクトURL に対応
    "img-src 'self' data: blob: https:",
    // font: next/font/google はビルド時に自己ホスト化するため 'self' のみで可
    "font-src 'self'",
    // connect: バックエンドAPI と 郵便番号API のみ許可
    `connect-src 'self' ${apiBase} https://zipcloud.ibsnet.co.jp`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ');

  // x-nonce をリクエストヘッダーに乗せる（layout.tsx で読み取り、Next.js が自動的に
  // 生成する <script> タグに nonce 属性を付与する）
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    {
      // _next/static・_next/image・favicon は静的ファイルなので除外
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
