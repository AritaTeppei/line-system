'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type SessionRow = {
  id: number;
  userId: number;
  userEmail: string;
  userName: string | null;
  userRole: string;
  tenantId: number | null;
  tenantName: string | null;
  tenantPlan: string | null;
  createdAt: string;
  expiresAt: string | null;
  tokenSuffix: string | null;
};

type LookupSession = {
  id: number;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  tokenSuffix: string | null;
  status: 'active' | 'expired' | 'revoked' | 'no_expiry';
};

type LookupResult = {
  user: {
    id: number;
    email: string;
    name: string | null;
    role: string;
    tenantName: string | null;
    tenantPlan: string | null;
  } | null;
  sessions: LookupSession[];
};

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('auth_token') ?? window.localStorage.getItem('auth_token');
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    DEVELOPER: 'bg-purple-900/50 text-purple-300 border-purple-700',
    MANAGER: 'bg-sky-900/50 text-sky-300 border-sky-700',
    CLIENT: 'bg-gray-800 text-gray-400 border-gray-600',
  };
  return map[role] ?? 'bg-gray-800 text-gray-400 border-gray-600';
}

function planBadge(plan: string | null) {
  const map: Record<string, string> = {
    TRIAL: 'text-amber-400',
    BASIC: 'text-sky-400',
    STANDARD: 'text-green-400',
    PRO: 'text-purple-400',
  };
  return map[plan ?? ''] ?? 'text-gray-500';
}

function fmtTime(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function expiresIn(iso: string | null): string {
  if (!iso) return '-';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '期限切れ';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}秒後`;
  return `${Math.floor(s / 60)}分${s % 60}秒後`;
}

export default function AdminSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ type: 'session' | 'user'; id: number; label: string } | null>(null);
  const [search, setSearch] = useState('');

  // メール検索
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupRevoking, setLookupRevoking] = useState(false);

  const fetchSessions = useCallback(async () => {
    const token = getAuthToken();
    if (!token) { setError('ログインしてください'); setLoading(false); return; }
    try {
      const res = await fetch(`${apiBase}/admin/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('取得に失敗しました');
      const data = await res.json();
      setSessions(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    // 30秒ごとに自動更新
    const timer = setInterval(fetchSessions, 30_000);
    return () => clearInterval(timer);
  }, [fetchSessions]);

  // カウントダウン表示のために1秒毎に再レンダリング
  useEffect(() => {
    const timer = setInterval(() => setSessions((s) => [...s]), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLookup = async () => {
    if (!lookupEmail.trim()) return;
    const token = getAuthToken();
    if (!token) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await fetch(
        `${apiBase}/admin/sessions/lookup?email=${encodeURIComponent(lookupEmail.trim())}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      setLookupResult(data);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookupRevokeAll = async () => {
    if (!lookupResult?.user) return;
    const token = getAuthToken();
    if (!token) return;
    setLookupRevoking(true);
    try {
      await fetch(`${apiBase}/admin/sessions/user/${lookupResult.user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      // 再検索して結果を更新
      await handleLookup();
      await fetchSessions();
    } finally {
      setLookupRevoking(false);
    }
  };

  const revokeSession = async (sessionId: number) => {
    const token = getAuthToken();
    if (!token) return;
    setRevoking(sessionId);
    try {
      await fetch(`${apiBase}/admin/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions((s) => s.filter((x) => x.id !== sessionId));
    } finally {
      setRevoking(null);
      setConfirmTarget(null);
    }
  };

  const revokeUser = async (userId: number) => {
    const token = getAuthToken();
    if (!token) return;
    setRevoking(userId * -1); // 負の数でユーザー単位を区別
    try {
      await fetch(`${apiBase}/admin/sessions/user/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions((s) => s.filter((x) => x.userId !== userId));
    } finally {
      setRevoking(null);
      setConfirmTarget(null);
    }
  };

  const filtered = sessions.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (s.userEmail ?? '').toLowerCase().includes(q) ||
      (s.userName ?? '').toLowerCase().includes(q) ||
      (s.tenantName ?? '').toLowerCase().includes(q)
    );
  });

  // ユーザー単位でグループ化（同一ユーザーの複数セッションをまとめて表示）
  const userGroups = filtered.reduce<Record<number, SessionRow[]>>((acc, s) => {
    if (!acc[s.userId]) acc[s.userId] = [];
    acc[s.userId].push(s);
    return acc;
  }, {});

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
    <>
      {/* 確認モーダル */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmTarget(null)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-red-900/60 border-b border-red-800 px-5 py-4">
              <h2 className="text-white font-bold text-sm">強制ログアウト確認</h2>
            </div>
            <div className="px-5 py-4">
              <p className="text-gray-300 text-sm leading-relaxed">
                {confirmTarget.type === 'user'
                  ? `「${confirmTarget.label}」のすべてのセッションを強制ログアウトします。`
                  : `セッション（${confirmTarget.label}）を強制ログアウトします。`}
              </p>
              <p className="text-gray-500 text-xs mt-2">この操作は取り消せません。該当ユーザーは次のリクエスト時にログアウトされます。</p>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-400 hover:text-white text-sm transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() =>
                  confirmTarget.type === 'session'
                    ? revokeSession(confirmTarget.id)
                    : revokeUser(confirmTarget.id)
                }
                disabled={revoking !== null}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold transition-colors"
              >
                {revoking !== null ? '処理中...' : '強制ログアウト'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-950 text-gray-100">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 sm:px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => router.push('/admin/overview')}
                className="text-gray-500 hover:text-white transition-colors text-sm"
              >
                ← 戻る
              </button>
              <span className="text-gray-700">|</span>
              <span className="text-xl">🔐</span>
              <div>
                <h1 className="text-sm font-black text-white leading-tight">セッション管理</h1>
                <p className="text-[11px] text-gray-500 hidden sm:block">アクティブセッションの確認・強制ログアウト</p>
              </div>
            </div>
            <button
              onClick={() => { setLoading(true); fetchSessions(); }}
              className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
            >
              🔄 更新
            </button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-4">

          {/* ===== メール検索・緊急強制ログアウト ===== */}
          <div className="rounded-2xl bg-gray-900 border border-red-900/50 overflow-hidden">
            <div className="bg-red-950/60 border-b border-red-900/50 px-4 py-3 flex items-center gap-2">
              <span className="text-base">🚨</span>
              <h2 className="text-sm font-bold text-red-300">メール検索で強制ログアウト</h2>
              <span className="text-[11px] text-gray-500">（ログインできない場合はこちら）</span>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  placeholder="例：test@gmail.com"
                  className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 placeholder-gray-500 outline-none focus:border-red-500 transition-colors"
                />
                <button
                  onClick={handleLookup}
                  disabled={lookupLoading || !lookupEmail.trim()}
                  className="flex-shrink-0 px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                >
                  {lookupLoading ? '検索中...' : '検索'}
                </button>
              </div>

              {lookupResult && (
                <div className="rounded-xl border border-gray-700 overflow-hidden">
                  {!lookupResult.user ? (
                    <p className="px-4 py-3 text-sm text-gray-500">ユーザーが見つかりませんでした。</p>
                  ) : (
                    <>
                      {/* ユーザー情報 */}
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/60 border-b border-gray-700">
                        <div>
                          <p className="text-sm font-bold text-white">{lookupResult.user.name ?? lookupResult.user.email}</p>
                          <p className="text-xs text-gray-400">{lookupResult.user.email}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            <span className={`font-bold ${roleBadge(lookupResult.user.role).includes('sky') ? 'text-sky-400' : lookupResult.user.role === 'DEVELOPER' ? 'text-purple-400' : 'text-gray-400'}`}>
                              {lookupResult.user.role}
                            </span>
                            {lookupResult.user.tenantName && <> ／ {lookupResult.user.tenantName} ({lookupResult.user.tenantPlan})</>}
                          </p>
                        </div>
                        {lookupResult.sessions.some(s => s.status === 'active' || s.status === 'no_expiry') && (
                          <button
                            onClick={handleLookupRevokeAll}
                            disabled={lookupRevoking}
                            className="px-3 py-2 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                          >
                            {lookupRevoking ? '処理中...' : '全セッション強制削除'}
                          </button>
                        )}
                      </div>

                      {/* セッション一覧（全ステータス） */}
                      <div className="divide-y divide-gray-800">
                        {lookupResult.sessions.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-gray-500">セッション履歴なし</p>
                        ) : (
                          lookupResult.sessions.map((s) => (
                            <div key={s.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                              <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  s.status === 'active' ? 'bg-emerald-400' :
                                  s.status === 'no_expiry' ? 'bg-yellow-400' :
                                  s.status === 'expired' ? 'bg-gray-600' : 'bg-red-800'
                                }`} />
                                <div>
                                  <p className="text-xs text-gray-300">
                                    作成: {fmtTime(s.createdAt)}
                                    {s.tokenSuffix && <span className="ml-2 font-mono text-[10px] text-gray-600">{s.tokenSuffix}</span>}
                                  </p>
                                  <p className="text-[11px] mt-0.5">
                                    <span className={`font-bold ${
                                      s.status === 'active' ? 'text-emerald-400' :
                                      s.status === 'no_expiry' ? 'text-yellow-400' :
                                      s.status === 'expired' ? 'text-gray-500' : 'text-red-600'
                                    }`}>
                                      {s.status === 'active' ? `アクティブ（${expiresIn(s.expiresAt)}）` :
                                       s.status === 'no_expiry' ? '期限なし（要確認）' :
                                       s.status === 'expired' ? `期限切れ（${fmtTime(s.expiresAt)}）` :
                                       `ログアウト済（${fmtTime(s.revokedAt)}）`}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-gray-900 border border-gray-800 px-4 py-3">
              <p className="text-2xl font-black text-white">{sessions.length}</p>
              <p className="text-[11px] text-gray-500">アクティブセッション数</p>
            </div>
            <div className="rounded-2xl bg-gray-900 border border-gray-800 px-4 py-3">
              <p className="text-2xl font-black text-sky-400">{Object.keys(userGroups).length}</p>
              <p className="text-[11px] text-gray-500">ログイン中ユーザー数</p>
            </div>
            <div className="rounded-2xl bg-gray-900 border border-gray-800 px-4 py-3 col-span-2 sm:col-span-1">
              <p className="text-[11px] text-gray-500 mb-1">ロール別</p>
              <div className="flex gap-2 flex-wrap">
                {['MANAGER', 'CLIENT', 'DEVELOPER'].map((role) => {
                  const cnt = sessions.filter((s) => s.userRole === role).length;
                  if (cnt === 0) return null;
                  return (
                    <span key={role} className={`text-xs font-bold border rounded-full px-2 py-0.5 ${roleBadge(role)}`}>
                      {role} {cnt}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 検索 */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="メール・ユーザー名・テナント名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 placeholder-gray-500 outline-none focus:border-green-500 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">✕</button>
            )}
          </div>

          <p className="text-xs text-gray-500">
            {filtered.length} セッション表示 ／ 30秒ごとに自動更新
          </p>

          {/* セッション一覧（ユーザーグループ単位） */}
          {Object.entries(userGroups).length === 0 ? (
            <div className="rounded-2xl bg-gray-900 border border-gray-800 py-16 text-center text-gray-600 text-sm">
              アクティブなセッションはありません
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(userGroups).map(([userIdStr, userSessions]) => {
                const userId = Number(userIdStr);
                const first = userSessions[0];
                return (
                  <div key={userId} className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
                    {/* ユーザーヘッダー */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50 border-b border-gray-800">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`border rounded-full px-2 py-0.5 text-[11px] font-bold flex-shrink-0 ${roleBadge(first.userRole)}`}>
                          {first.userRole}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {first.userName ?? first.userEmail}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">{first.userEmail}</p>
                        </div>
                        {first.tenantName && (
                          <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-gray-600 text-xs">｜</span>
                            <span className="text-xs text-gray-400">{first.tenantName}</span>
                            <span className={`text-[11px] font-bold ${planBadge(first.tenantPlan)}`}>
                              {first.tenantPlan}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setConfirmTarget({ type: 'user', id: userId, label: first.userName ?? first.userEmail })}
                        disabled={revoking !== null}
                        className="flex-shrink-0 ml-3 px-3 py-1.5 rounded-lg bg-red-900/50 hover:bg-red-800 border border-red-800 hover:border-red-600 text-red-400 hover:text-red-300 text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        全セッション強制ログアウト
                      </button>
                    </div>

                    {/* セッション行 */}
                    <div className="divide-y divide-gray-800">
                      {userSessions.map((s) => (
                        <div key={s.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="text-[11px] text-gray-600 font-mono hidden sm:block">
                              #{s.id}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                <p className="text-xs text-gray-300">
                                  ログイン: <span className="text-gray-400">{fmtTime(s.createdAt)}</span>
                                </p>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                期限: <span className={
                                  s.expiresAt && (new Date(s.expiresAt).getTime() - Date.now()) < 120_000
                                    ? 'text-orange-400 font-bold'
                                    : 'text-gray-400'
                                }>{expiresIn(s.expiresAt)}</span>
                                {s.tokenSuffix && (
                                  <span className="ml-3 font-mono text-[10px] text-gray-600">{s.tokenSuffix}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setConfirmTarget({ type: 'session', id: s.id, label: s.tokenSuffix ?? `#${s.id}` })}
                            disabled={revoking !== null}
                            className="flex-shrink-0 px-2.5 py-1 rounded-lg border border-gray-700 hover:border-red-700 text-gray-500 hover:text-red-400 text-[11px] transition-colors disabled:opacity-50"
                          >
                            ログアウト
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
