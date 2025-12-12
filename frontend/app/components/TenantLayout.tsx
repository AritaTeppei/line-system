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
  { href: '/billing', label: 'サブスク登録・プラン管理' }, 
];

const apiBase =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // ★ 追加：フロント側の操作なしタイムアウト（30分）
const FRONT_INACTIVITY_LOGOUT_MS =
  process.env.NODE_ENV === 'development'
    ? 30 * 60 * 1000 // 開発環境：30分
    : 30 * 60 * 1000; // 本番：30分


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
            className="px-3 py-1 rounded-md bg-blue-600 text-[11px] font-semibold text-white hover:bg-blue-700 shadow-sm"
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

// ★ TRIAL テナント専用バナー（サイドバー用）
function TrialBanner({ me }: { me: MeResponse | null }) {
  // me がない場合は表示しない
  if (!me) return null;

  // MANAGER 以外には出さない
  if (me.role !== 'MANAGER') return null;

  // プランが TRIAL 以外なら表示しない
  const rawPlan = me.tenantPlan ?? '';
  if (!rawPlan || rawPlan.toUpperCase() !== 'TRIAL') {
    return null;
  }

  // ★ 残り日数を計算
  let remainingDays: number | null = null;
  if (me.trialEnd) {
    const end = new Date(me.trialEnd); // trialEnd は string | null | undefined なので if で絞り込み
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="mt-2 w-full rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-center">
      <p className="text-[11px] font-bold text-orange-700">
        お試しプランをご利用中です
      </p>

      {remainingDays !== null && (
        <p className="mt-1 text-[11px] text-orange-700 font-semibold">
          残り {remainingDays} 日
        </p>
      )}

      <p className="mt-1 text-[10px] text-orange-700 leading-tight">
        顧客・車両・予約の件数に
        <br />
        制限があります。
      </p>

      <Link
        href="/billing"
        className="mt-2 inline-block w-full rounded-md bg-orange-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-orange-600"
      >
        サブスク登録して制限を解除
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
  const [me, setMe] = useState<MeResponse | null>(null); // ★ 追加：ログインユーザー情報
    // ★ 追加：最後のユーザー操作時刻を管理する ref
  const lastActivityRef = useRef<number>(Date.now());

// ⬇⬇⬇ ここからこの useEffect を追加 ⬇⬇⬇
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = getAuthToken();
    // トークンがない = ログインしていないので何もしない
    if (!token) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 一部ブラウザでは e.preventDefault が必要
      e.preventDefault();
      // これを書いておくと「本当に離れますか」ダイアログが出る
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // アンマウント時に後片付け
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [me]); // me がセットされたら有効になるイメージ
  // ⬆⬆⬆ ここまで追加 ⬆⬆⬆

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

  const handleLogout = useCallback(async (skipApi?: boolean) => {
  if (typeof window === 'undefined') return;

  const token = window.localStorage.getItem('auth_token');

  // 自動ログアウトの時は API 呼ばない！（競合防止）
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

  // トークン類は必ず即削除
  window.localStorage.removeItem('auth_token');
  document.cookie = 'Authentication=; Max-Age=0; path=/';
  document.cookie = 'access_token=; Max-Age=0; path=/';

  // 確実にログアウト画面へ遷移
  window.location.href = '/';
}, [router]);


    // ★ 追加：フロント側の「30分操作なしで自動ログアウト」
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 最初に現在時刻をセット
    lastActivityRef.current = Date.now();

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // 何かしら操作があったら「アクティビティあり」とみなすイベント
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

    // 1分おきに「最後の操作から30分経っているか」を確認
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const diff = now - lastActivityRef.current;

      if (diff > FRONT_INACTIVITY_LOGOUT_MS) {
        // これ以上二重に発火しないように先にクリーンアップ
        window.clearInterval(intervalId);
        events.forEach((ev) => {
          window.removeEventListener(ev, updateActivity);
        });

        // 自動ログアウト
        handleLogout(true);
      }
    }, 60 * 1000); // 1分ごとにチェック

    // アンマウント時のクリーンアップ
    return () => {
      window.clearInterval(intervalId);
      events.forEach((ev) => {
        window.removeEventListener(ev, updateActivity);
      });
    };
  }, [handleLogout, lastActivityRef]);


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

          {/* ★ TRIAL プラン用バナー（テナント名の下） */}
          <TrialBanner me={me} />

          {/* ログアウトボタン */}
          <button
  type="button"
  onClick={() => handleLogout(false)}  // ★ ラッパーで呼ぶ
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
