'use client';

import { useEffect, useState, useRef } from 'react';
import type React from 'react';
import TenantLayout from '../../components/TenantLayout';

type Templates = {
  birthday: string;
  shakenTwoMonths: string;
  shakenOneWeek: string;
  inspectionOneMonth: string;
  custom: string;
};

type TemplateKey = keyof Templates;

const keyToType: Record<TemplateKey, string> = {
  birthday: 'BIRTHDAY',
  shakenTwoMonths: 'SHAKEN_TWO_MONTHS',
  shakenOneWeek: 'SHAKEN_ONE_WEEK',
  inspectionOneMonth: 'INSPECTION_ONE_MONTH',
  custom: 'CUSTOM',
};

const templateMeta: Record<TemplateKey, { label: string; timing: string; icon: string; color: string; border: string; badge: string }> = {
  birthday: {
    label: '誕生日メッセージ',
    timing: '誕生日当日に送信',
    icon: '🎂',
    color: 'from-rose-50 to-pink-50',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-700',
  },
  shakenTwoMonths: {
    label: '車検 2ヶ月前メッセージ',
    timing: '車検満了日の約60日前に送信',
    icon: '🔧',
    color: 'from-blue-50 to-sky-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
  shakenOneWeek: {
    label: '車検 1週間前メッセージ',
    timing: '車検満了日の7日前に送信',
    icon: '⚠️',
    color: 'from-orange-50 to-amber-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
  },
  inspectionOneMonth: {
    label: '点検 1ヶ月前メッセージ',
    timing: '点検予定日の30日前に送信',
    icon: '🔩',
    color: 'from-purple-50 to-violet-50',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
  },
  custom: {
    label: '任意日付メッセージ',
    timing: '任意に設定した日付の指定日前に送信',
    icon: '📅',
    color: 'from-gray-50 to-slate-50',
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-600',
  },
};

const templateKeys: TemplateKey[] = [
  'birthday',
  'shakenTwoMonths',
  'shakenOneWeek',
  'inspectionOneMonth',
  'custom',
];

const placeholderList: { token: string; label: string; desc: string }[] = [
  { token: '{customerName}', label: '顧客名', desc: '例: 田中 太郎' },
  { token: '{carName}', label: '車両名', desc: '例: アルファード' },
  { token: '{registrationNumber}', label: 'ナンバー', desc: '例: 品川 300 あ 1234' },
  { token: '{mainDate}', label: '対象日', desc: '例: 2025/04/01' },
  { token: '{bookingUrl}', label: '予約URL', desc: '予約フォームURL' },
  { token: '{daysBefore}', label: '○日前', desc: '例: 7（日前）' },
  { token: '{shopName}', label: '店舗名', desc: '登録した工場名' },
];

const defaultTemplates: Templates = {
  birthday: `【お誕生日おめでとうございます】
{customerName} 様

いつもご利用いただきありがとうございます。
ささやかではございますが、お誕生日のお祝いとしてご案内をお送りしました。

今後ともよろしくお願いいたします。
{shopName}`,

  shakenTwoMonths: `【車検2ヶ月前のお知らせ】
{customerName} 様

いつも当店をご利用いただきありがとうございます。
対象のお車：{carName}（{registrationNumber}）
車検の満了日が {mainDate} に近づいております。

お早めのご予約をおすすめしております。
▼ご予約はこちら
{bookingUrl}

{shopName}`,

  shakenOneWeek: `【車検1週間前のお知らせ】
{customerName} 様

対象のお車：{carName}（{registrationNumber}）
車検の満了日（{mainDate}）まであと1週間となりました。

まだご予約がお済みでない場合は、お早めにご連絡ください。
▼ご予約はこちら
{bookingUrl}

{shopName}`,

  inspectionOneMonth: `【点検1ヶ月前のお知らせ】
{customerName} 様

対象のお車：{carName}（{registrationNumber}）
点検のご予定日が {mainDate} に近づいております。

安全・安心のため、事前のご予約をお願いいたします。
▼ご予約はこちら
{bookingUrl}

{shopName}`,

  custom: `【お車に関するお知らせ】
{customerName} 様

対象のお車：{carName}（{registrationNumber}）
{mainDate} に設定していたお知らせの{daysBefore}日前となりました。

ご不明点やご相談がございましたら、お気軽にご返信ください。
▼ご予約はこちら
{bookingUrl}

{shopName}`,
};

export default function MessagesSettingsPage() {
  const [templates, setTemplates] = useState<Templates>(defaultTemplates);
  const [savingKey, setSavingKey] = useState<TemplateKey | null>(null);
  const [savedKey, setSavedKey] = useState<TemplateKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeKey, setActiveKey] = useState<TemplateKey | null>(null);
  const [selectionMap, setSelectionMap] = useState<{ [K in TemplateKey]?: { start: number; end: number } }>({});
  const textareaRefs = useRef<Partial<Record<TemplateKey, HTMLTextAreaElement | null>>>({});

  useEffect(() => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
    if (!token) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) return;

    fetch(`${apiBase}/reminders/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) return;
        return res.json();
      })
      .then((json) => {
        if (!json) return;
        const map: Partial<Templates> = { ...defaultTemplates };
        for (const t of json) {
          if (t.type === 'BIRTHDAY') map.birthday = t.body ?? defaultTemplates.birthday;
          else if (t.type === 'SHAKEN_TWO_MONTHS') map.shakenTwoMonths = t.body ?? defaultTemplates.shakenTwoMonths;
          else if (t.type === 'SHAKEN_ONE_WEEK') map.shakenOneWeek = t.body ?? defaultTemplates.shakenOneWeek;
          else if (t.type === 'INSPECTION_ONE_MONTH') map.inspectionOneMonth = t.body ?? defaultTemplates.inspectionOneMonth;
          else if (t.type === 'CUSTOM') map.custom = t.body ?? defaultTemplates.custom;
        }
        setTemplates((prev) => ({ ...prev, ...map }));
      })
      .catch(console.error);
  }, []);

  const handleChange = (key: TemplateKey) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTemplates((prev) => ({ ...prev, [key]: e.target.value }));
    if (savedKey === key) setSavedKey(null);
  };

  const handleFocusOrSelect = (key: TemplateKey) => (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    setActiveKey(key);
    setSelectionMap((prev) => ({ ...prev, [key]: { start, end } }));
  };

  const handleInsertPlaceholder = (token: string) => {
    if (!activeKey) return;

    setTemplates((prev) => {
      const current = prev[activeKey] ?? '';
      const sel = selectionMap[activeKey];
      if (!sel) return { ...prev, [activeKey]: current + token };
      const before = current.slice(0, sel.start);
      const after = current.slice(sel.end);
      const next = `${before}${token}${after}`;
      // カーソル位置を更新
      setTimeout(() => {
        const ta = textareaRefs.current[activeKey];
        if (ta) {
          const pos = sel.start + token.length;
          ta.focus();
          ta.setSelectionRange(pos, pos);
          setSelectionMap((p) => ({ ...p, [activeKey]: { start: pos, end: pos } }));
        }
      }, 0);
      return { ...prev, [activeKey]: next };
    });

    if (savedKey === activeKey) setSavedKey(null);
  };

  const handleSave = async (key: TemplateKey) => {
    setError(null);
    const body = templates[key];
    if (!body?.trim()) { setError('メッセージ本文が空です。'); return; }

    const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;
    if (!token) { setError('ログイン情報が見つかりません。'); return; }

    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) return;

    setSavingKey(key);
    try {
      const res = await fetch(`${apiBase}/reminders/templates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: keyToType[key], title: templateMeta[key].label, body, note: null }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`保存に失敗しました (${res.status}): ${text || res.statusText}`);
      }
      setSavedKey(key);
      setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 3000);
    } catch (e: any) {
      setError(e?.message ?? '保存に失敗しました。');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <TenantLayout>
      {/* ── 差し込みワード 右側フローティングカード ── */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-30 w-36 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
        {/* カードヘッダー */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200 px-3 py-2.5">
          <p className="text-[11px] font-bold text-gray-600 tracking-wide text-center">差し込みワード</p>
          {activeKey ? (
            <div className="mt-1.5 flex items-center justify-center gap-1">
              <span className="text-sm">{templateMeta[activeKey].icon}</span>
              <span className="text-[10px] font-bold text-green-700 leading-tight truncate max-w-[80px]">
                {templateMeta[activeKey].label}
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 text-center mt-1 leading-tight">
              テキストをクリックして選択
            </p>
          )}
        </div>

        {/* ボタン群（縦並び） */}
        <div className="px-2 py-2 space-y-1">
          {placeholderList.map((p) => (
            <button
              key={p.token}
              type="button"
              onClick={() => handleInsertPlaceholder(p.token)}
              disabled={!activeKey}
              title={p.desc}
              className={`w-full rounded-lg border px-2 py-1.5 text-[11px] font-medium text-left transition ${
                activeKey
                  ? 'border-green-300 bg-green-50 text-green-800 hover:bg-green-100 cursor-pointer'
                  : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto space-y-5 pb-12">

        {/* ── ページヘッダー ── */}
        <div>
          <h1 className="text-2xl font-extrabold text-green-700 flex items-center gap-2">
            💬 メッセージ設定
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            各リマインドで送信するLINEメッセージのテンプレートを設定します。
          </p>
        </div>

        {/* エラー */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            ❌ {error}
          </div>
        )}

        {/* ── テンプレートカード一覧 ── */}
        <div className="space-y-4">
          {templateKeys.map((key) => {
            const meta = templateMeta[key];
            const isSaving = savingKey === key;
            const isSaved = savedKey === key;
            const isActive = activeKey === key;
            const charCount = templates[key]?.length ?? 0;

            return (
              <section
                key={key}
                className={`rounded-2xl border shadow-sm overflow-hidden transition ${isActive ? 'ring-2 ring-green-400 ring-offset-1' : ''} ${meta.border}`}
              >
                {/* カードヘッダー */}
                <div className={`bg-gradient-to-r ${meta.color} px-5 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{meta.icon}</span>
                    <h2 className="text-sm font-bold text-gray-800">{meta.label}</h2>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge}`}>
                    {meta.timing}
                  </span>
                </div>

                {/* テキストエリア */}
                <div className="bg-white px-5 pt-4 pb-3">
                  <textarea
                    ref={(el) => { textareaRefs.current[key] = el; }}
                    className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-800 min-h-[150px] resize-y focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition leading-relaxed ${isActive ? 'border-green-400 bg-green-50/30' : 'border-gray-200 bg-white'}`}
                    value={templates[key]}
                    onChange={handleChange(key)}
                    onFocus={handleFocusOrSelect(key)}
                    onClick={handleFocusOrSelect(key)}
                    onSelect={handleFocusOrSelect(key)}
                    onKeyUp={handleFocusOrSelect(key)}
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{charCount} 文字</span>
                    <span className="text-xs text-gray-400">
                      プレースホルダは送信時に実際の値に置き換えられます
                    </span>
                  </div>
                </div>

                {/* 保存フッター */}
                <div className="bg-gray-50 border-t border-gray-100 px-5 py-3 flex items-center justify-between gap-3">
                  {isSaved ? (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      ✅ 保存しました
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">
                      編集後は保存ボタンを押してください
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSave(key)}
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60 transition shadow-sm"
                  >
                    {isSaving ? '⏳ 保存中...' : '💾 保存する'}
                  </button>
                </div>
              </section>
            );
          })}
        </div>

        {/* プレースホルダ一覧 */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">📝 使用できる差し込みワード一覧</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {placeholderList.map((p) => (
              <div key={p.token} className="flex items-start gap-3 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                <code className="text-xs font-mono font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-lg flex-shrink-0">
                  {p.token}
                </code>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{p.label}</p>
                  <p className="text-[11px] text-gray-400">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </TenantLayout>
  );
}
