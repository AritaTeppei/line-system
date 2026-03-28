// frontend/app/onboarding/line/page.tsx
'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TenantLayout from '../../components/TenantLayout';

type Role = 'DEVELOPER' | 'MANAGER' | 'CLIENT';

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
};

type LineSettingsForm = {
  channelId: string;
  channelSecret: string;
  accessToken: string;
  webhookUrl: string;
  destination: string;
  isActive: boolean;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('auth_token') ?? window.localStorage.getItem('auth_token');
}

// ステップ番号バッジ
function StepBadge({ n, done }: { n: number; done?: boolean }) {
  return (
    <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black ${done ? 'bg-emerald-500 text-white' : 'bg-green-600 text-white'}`}>
      {done ? '✓' : n}
    </span>
  );
}

export default function LineOnboardingPage() {
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<LineSettingsForm>({
    channelId: '',
    channelSecret: '',
    accessToken: '',
    webhookUrl: '',
    destination: '',
    isActive: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  // テスト送信
  const [testTo, setTestTo] = useState('');
  const [testMessage, setTestMessage] = useState('テスト送信です。LINE連携が正常に動作しています！🎉');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // 説明パネル開閉
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setPageError('ログイン情報が見つかりません。再ログインしてください。');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const meRes = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!meRes.ok) throw new Error('auth/me api error');
        const meData: Me = await meRes.json();
        setMe(meData);

        if (!meData.tenantId) throw new Error('テナント情報が見つかりません。');

        const lsRes = await fetch(`${apiBase}/tenants/${meData.tenantId}/line-settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (lsRes.ok) {
          const data = await lsRes.json();
          setForm({
            channelId: data.channelId ?? '',
            channelSecret: data.channelSecret ?? '',
            accessToken: data.accessToken ?? '',
            webhookUrl: data.webhookUrl ?? '',
            destination: data.destination ?? '',
            isActive: data.isActive ?? false,
          });
        }
      } catch (err: any) {
        setPageError(err?.message ?? '読み込みに失敗しました。');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (key: keyof LineSettingsForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveOk(false);

    const token = getAuthToken();
    if (!token || !me?.tenantId) {
      setSaveError('ログイン情報が取得できません。');
      return;
    }
    if (!form.channelId.trim()) { setSaveError('チャネルIDは必須です。'); return; }
    if (!form.channelSecret.trim()) { setSaveError('チャネルシークレットは必須です。'); return; }
    if (!form.accessToken.trim()) { setSaveError('アクセストークンは必須です。'); return; }

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/tenants/${me.tenantId}/line-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? 'LINE設定の保存に失敗しました。');
      }

      // 保存後に最新情報を再取得（destinationが自動設定されるため）
      const refreshed = await fetch(`${apiBase}/tenants/${me.tenantId}/line-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (refreshed.ok) {
        const data = await refreshed.json();
        setForm({
          channelId: data.channelId ?? '',
          channelSecret: data.channelSecret ?? '',
          accessToken: data.accessToken ?? '',
          webhookUrl: data.webhookUrl ?? '',
          destination: data.destination ?? '',
          isActive: data.isActive ?? false,
        });
      }

      setSaveOk(true);
    } catch (err: any) {
      setSaveError(err?.message ?? '保存中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    const token = getAuthToken();
    if (!token || !me?.tenantId) {
      setTestResult({ ok: false, msg: 'ログイン情報が見つかりません。' });
      return;
    }
    if (!testTo.trim()) {
      setTestResult({ ok: false, msg: 'LINE User IDを入力してください。' });
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch(`${apiBase}/tenants/${me.tenantId}/line-settings/test-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: testTo.trim(), message: testMessage }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setTestResult({ ok: false, msg: data?.message ?? 'テスト送信に失敗しました。' });
        return;
      }
      setTestResult({ ok: true, msg: '送信成功！LINEにメッセージが届いているか確認してください。' });
    } catch {
      setTestResult({ ok: false, msg: 'テスト送信中にエラーが発生しました。' });
    } finally {
      setTestSending(false);
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex items-center justify-center h-40 text-gray-400">読み込み中...</div>
      </TenantLayout>
    );
  }

  if (pageError) {
    return (
      <TenantLayout>
        <div className="max-w-2xl mx-auto p-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{pageError}</div>
          <button className="mt-4 px-4 py-2 text-sm border rounded-lg" onClick={() => router.push('/dashboard')}>
            ダッシュボードへ戻る
          </button>
        </div>
      </TenantLayout>
    );
  }

  const hasDestination = !!form.destination.trim();
  const isConnected = hasDestination && form.isActive;
  const step1Done = hasDestination;
  const step2Done = isConnected;

  return (
    <TenantLayout>
      <div className="max-w-2xl mx-auto space-y-5 pb-12">

        {/* ── ページヘッダー ── */}
        <div>
          <h1 className="text-2xl font-extrabold text-green-700 flex items-center gap-2">
            🟢 LINE連携設定
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            自社のLINE公式アカウントとPitLinkを接続します。下記の手順に沿って設定してください。
          </p>
        </div>

        {/* ── 現在の連携状況 ── */}
        <div className={`rounded-2xl border p-4 flex items-center gap-4 ${isConnected ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
          <span className="text-3xl">{isConnected ? '✅' : '⚠️'}</span>
          <div>
            <p className={`font-bold text-sm ${isConnected ? 'text-emerald-800' : 'text-amber-800'}`}>
              {isConnected ? 'LINE連携: 有効' : 'LINE連携: 未設定 / 無効'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {isConnected
                ? `LINE BotユーザーID: ${form.destination}`
                : hasDestination
                ? 'チャネル情報は保存済みです。「LINE連携を有効にする」にチェックして保存してください。'
                : 'チャネル情報を入力して保存すると、LINE BotユーザーIDが自動で取得されます。'}
            </p>
          </div>
        </div>

        {/* ── 手順ガイド（折りたたみ）── */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setGuideOpen(!guideOpen)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
          >
            <span className="font-bold text-gray-800 flex items-center gap-2">
              📖 LINE連携の手順を確認する
            </span>
            <span className="text-gray-400 text-lg">{guideOpen ? '▲' : '▼'}</span>
          </button>

          {guideOpen && (
            <div className="px-5 pb-5 space-y-4 text-sm border-t border-gray-100">
              <div className="pt-4 space-y-3">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                  <div>
                    <p className="font-semibold text-gray-800">LINE Official Account Managerにログイン</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <a href="https://manager.line.biz" target="_blank" rel="noreferrer" className="text-blue-600 underline">manager.line.biz</a> から利用する公式アカウントを開きます。
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                  <div>
                    <p className="font-semibold text-gray-800">LINE DevelopersでMessaging APIチャネルを確認</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <a href="https://developers.line.biz" target="_blank" rel="noreferrer" className="text-blue-600 underline">developers.line.biz</a> → プロバイダー → Messaging APIチャネルを開きます。
                    </p>
                    <ul className="mt-1 text-xs text-gray-500 space-y-0.5 list-disc list-inside">
                      <li>「チャネル基本設定」タブ → <strong>チャネルID</strong>・<strong>チャネルシークレット</strong></li>
                      <li>「Messaging API設定」タブ → <strong>チャネルアクセストークン</strong>（発行ボタンを押してコピー）</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">3</span>
                  <div>
                    <p className="font-semibold text-gray-800">Webhook URLを設定する</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      LINE DevelopersのMessaging API設定 → WebhookURL欄に以下を入力して「検証」「有効にする」をONにします：
                    </p>
                    <div className="mt-1 bg-gray-100 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-700 break-all select-all">
                      https://api.seibisystem.com/line/webhook
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">4</span>
                  <div>
                    <p className="font-semibold text-gray-800">下のフォームに入力して保存</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      チャネルID・チャネルシークレット・アクセストークンを入力し「保存する」をクリックします。<br />
                      保存後に <strong>LINE BotユーザーID</strong> が自動で表示されます。
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">5</span>
                  <div>
                    <p className="font-semibold text-gray-800">「LINE連携を有効にする」にチェックして保存</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      LINE BotユーザーIDが表示されたら、チェックボックスをONにして再度保存します。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── STEP 1: チャネル情報入力 ── */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <StepBadge n={1} done={step1Done} />
            <div>
              <h2 className="font-bold text-gray-800">チャネル情報を入力して保存</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                保存するとLINE BotユーザーIDが自動で取得されます
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                チャネルID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                value={form.channelId}
                onChange={(e) => handleChange('channelId', e.target.value)}
                placeholder="例: 2006XXXXXXX"
              />
              <p className="mt-1 text-xs text-gray-400">LINE Developers → チャネル基本設定 → チャネルID</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                チャネルシークレット <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500"
                value={form.channelSecret}
                onChange={(e) => handleChange('channelSecret', e.target.value)}
                placeholder="32文字の英数字"
              />
              <p className="mt-1 text-xs text-gray-400">LINE Developers → チャネル基本設定 → チャネルシークレット</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                チャネルアクセストークン（長期） <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-green-300 focus:border-green-500 h-20 resize-none"
                value={form.accessToken}
                onChange={(e) => handleChange('accessToken', e.target.value)}
                placeholder="発行したアクセストークンを貼り付けてください"
              />
              <p className="mt-1 text-xs text-gray-400">LINE Developers → Messaging API設定 → チャネルアクセストークン（長期）</p>
            </div>

            {/* LINE Bot ユーザーID（保存後に自動表示） */}
            <div className={`rounded-xl p-4 border ${hasDestination ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
              <p className="text-xs font-semibold text-gray-600 mb-1">
                LINE BotユーザーID（保存後に自動取得）
              </p>
              {hasDestination ? (
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 text-lg">✅</span>
                  <span className="font-mono text-sm font-bold text-emerald-800 break-all">{form.destination}</span>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  上の3項目を入力して「保存する」を押すと、ここに自動で表示されます
                </p>
              )}
            </div>

            {saveError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                ❌ {saveError}
              </div>
            )}
            {saveOk && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                ✅ 設定を保存しました{hasDestination ? '。LINE BotユーザーIDを取得しました。' : '。'}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition disabled:opacity-60 shadow"
            >
              {saving ? '⏳ 保存中...' : '💾 保存する'}
            </button>
          </form>
        </section>

        {/* ── STEP 2: LINE連携を有効化 ── */}
        <section className={`rounded-2xl border shadow-sm ${hasDestination ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <StepBadge n={2} done={step2Done} />
            <div>
              <h2 className="font-bold text-gray-800">LINE連携を有効にする</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                LINE BotユーザーIDが取得できたら有効化します
              </p>
            </div>
          </div>

          <div className="px-5 py-5">
            {!hasDestination ? (
              <p className="text-sm text-gray-400">
                ⬆️ まずSTEP1でチャネル情報を保存し、LINE BotユーザーIDを取得してください。
              </p>
            ) : (
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    id="ls-active"
                    type="checkbox"
                    className="mt-0.5 w-5 h-5 accent-green-600 cursor-pointer"
                    checked={form.isActive}
                    onChange={(e) => handleChange('isActive', e.target.checked)}
                  />
                  <div>
                    <span className="text-sm font-semibold text-gray-800 group-hover:text-green-700 transition">
                      LINE連携を有効にする
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      チェックを入れると、リマインドや予約通知のLINE送信が有効になります。
                    </p>
                  </div>
                </label>

                {form.isActive && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-800">
                    ✅ 有効化済みです。チェックが入ったら下の「保存する」を押して確定してください。
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit as any}
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition disabled:opacity-60 shadow"
                >
                  {saving ? '⏳ 保存中...' : '💾 有効化設定を保存する'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── STEP 3: 動作テスト ── */}
        <section className={`rounded-2xl border shadow-sm ${isConnected ? 'border-blue-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <StepBadge n={3} done={false} />
            <div>
              <h2 className="font-bold text-gray-800">動作テスト（送信確認）</h2>
              <p className="text-xs text-gray-500 mt-0.5">実際にLINEメッセージが届くか確認します</p>
            </div>
          </div>

          <div className="px-5 py-5 space-y-4">
            {!isConnected ? (
              <p className="text-sm text-gray-400">
                ⬆️ STEP1・STEP2を完了して LINE連携を有効にするとテストできます。
              </p>
            ) : (
              <>
                {/* テスト方法の説明 */}
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-2">
                  <p className="text-xs font-bold text-blue-800">📋 テスト用LINE User IDの確認方法</p>
                  <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                    <li>テスト送信したいLINEアカウントで、登録済みの<strong>LINE公式アカウント</strong>にメッセージを送信します。</li>
                    <li>PitLinkの<strong>顧客一覧</strong>ページを開くと、メッセージを送ったアカウントが自動登録されます。</li>
                    <li>顧客詳細を開き、表示されている<strong>LINE User ID（Uから始まる文字列）</strong>をコピーします。</li>
                    <li>下の「送信先LINE User ID」欄に貼り付けてテスト送信します。</li>
                  </ol>
                </div>

                {testResult && (
                  <div className={`rounded-xl px-4 py-3 text-sm font-semibold border ${testResult.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                    {testResult.ok ? '✅ ' : '❌ '}{testResult.msg}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    送信先 LINE User ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-blue-300 focus:border-blue-500"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    顧客一覧 → 顧客詳細 に表示される LINE User ID を入力してください
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">送信メッセージ</label>
                  <textarea
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-blue-300 focus:border-blue-500 h-16 resize-none"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleTestSend}
                  disabled={testSending}
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition disabled:opacity-60 shadow"
                >
                  {testSending ? '⏳ 送信中...' : '📨 テスト送信する'}
                </button>
              </>
            )}
          </div>
        </section>

      </div>
    </TenantLayout>
  );
}
