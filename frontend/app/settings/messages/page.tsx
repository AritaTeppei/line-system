'use client';

import { useEffect, useState } from 'react';
import type React from 'react';
import TenantLayout from '../../components/TenantLayout';

type Templates = {
  birthday: string;
  shakenTwoMonths: string;
  shakenOneWeek: string;
  inspectionOneMonth: string;
  custom: string;
};

type Role = 'DEVELOPER' | 'MANAGER' | 'CLIENT';

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
};

type TemplateKey = keyof Templates;

const keyToType: Record<TemplateKey, string> = {
  birthday: 'BIRTHDAY',
  shakenTwoMonths: 'SHAKEN_TWO_MONTHS',
  shakenOneWeek: 'SHAKEN_ONE_WEEK',
  inspectionOneMonth: 'INSPECTION_ONE_MONTH',
  custom: 'CUSTOM',
};

const keyToLabel: Record<TemplateKey, string> = {
  birthday: '誕生日メッセージ',
  shakenTwoMonths: '車検 2ヶ月前メッセージ',
  shakenOneWeek: '車検 1週間前メッセージ',
  inspectionOneMonth: '点検 1ヶ月前メッセージ',
  custom: '任意日付メッセージ',
};

const placeholderList: { token: string; label: string }[] = [
  { token: '{customerName}', label: '顧客名 {customerName}' },
  { token: '{carName}', label: '車両名 {carName}' },
  { token: '{registrationNumber}', label: 'ナンバー {registrationNumber}' },
  { token: '{mainDate}', label: '対象日 {mainDate}' },
  { token: '{bookingUrl}', label: '予約URL {bookingUrl}' },
  { token: '{daysBefore}', label: '○日前 {daysBefore}' },
  { token: '{shopName}', label: '店名 {shopName}' },
];

const defaultTemplates: Templates = {
  birthday: `【お誕生日おめでとうございます】
{customerName} 様

いつもご利用いただきありがとうございます。
ささやかではございますが、お誕生日のお祝いとしてご案内をお送りしました。

今後ともよろしくお願いいたします。`,

  shakenTwoMonths: `【車検2ヶ月前のお知らせ】
{customerName} 様

いつも当店をご利用いただきありがとうございます。
対象のお車：{carName}（{registrationNumber}）
車検の満了日が {mainDate} に近づいております。

お早めのご予約をおすすめしております。
▼ご予約はこちら
{bookingUrl}`,

  shakenOneWeek: `【車検1週間前のお知らせ】
{customerName} 様

対象のお車：{carName}（{registrationNumber}）
車検の満了日（{mainDate}）まであと1週間となりました。

まだご予約がお済みでない場合は、お早めにご連絡ください。
▼ご予約はこちら
{bookingUrl}`,

  inspectionOneMonth: `【点検1ヶ月前のお知らせ】
{customerName} 様

対象のお車：{carName}（{registrationNumber}）
点検のご予定日が {mainDate} に近づいております。

安全・安心のため、事前のご予約をお願いいたします。
▼ご予約はこちら
{bookingUrl}`,

  custom: `【お車に関するお知らせ】
{customerName} 様

対象のお車：{carName}（{registrationNumber}）
{mainDate} に設定していたお知らせの{daysBefore}日前となりました。

ご不明点やご相談がございましたら、お気軽にご返信ください。
▼ご予約はこちら
{bookingUrl}`,
};

export default function MessagesSettingsPage() {
  const [templates, setTemplates] = useState<Templates>(defaultTemplates);
  const [savingKey, setSavingKey] = useState<TemplateKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const [activeKey, setActiveKey] = useState<TemplateKey | null>(null);
  const [selectionMap, setSelectionMap] = useState<{
    [K in TemplateKey]?: { start: number; end: number };
  }>({});

  // ログインユーザー情報（ヘッダー表示用）
  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;

    if (!token) {
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) return;

    fetch(`${apiBase}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('auth/me api error');
        return res.json();
      })
      .then((data: Me) => setMe(data))
      .catch((err) => {
        console.error(err);
      });
  }, []);

  // 初期テンプレートを API から取得
  useEffect(() => {
    const run = async () => {
      const token =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('auth_token')
          : null;

      if (!token) {
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL;
      if (!apiBase) return;

      try {
        const res = await fetch(`${apiBase}/reminders/templates`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          console.error('テンプレート取得に失敗しました', res.status);
          return;
        }

        const json = await res.json();
        const map: Partial<Templates> = { ...defaultTemplates };

        for (const t of json) {
          if (t.type === 'BIRTHDAY') {
            map.birthday = t.body ?? defaultTemplates.birthday;
          } else if (t.type === 'SHAKEN_TWO_MONTHS') {
            map.shakenTwoMonths = t.body ?? defaultTemplates.shakenTwoMonths;
          } else if (t.type === 'SHAKEN_ONE_WEEK') {
            map.shakenOneWeek = t.body ?? defaultTemplates.shakenOneWeek;
          } else if (t.type === 'INSPECTION_ONE_MONTH') {
            map.inspectionOneMonth =
              t.body ?? defaultTemplates.inspectionOneMonth;
          } else if (t.type === 'CUSTOM') {
            map.custom = t.body ?? defaultTemplates.custom;
          }
        }

        setTemplates((prev) => ({
          ...prev,
          ...map,
        }));
      } catch (e) {
        console.error(e);
      }
    };

    run();
  }, []);

  const handleChange =
    (key: TemplateKey) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setTemplates((prev) => ({
        ...prev,
        [key]: value,
      }));
    };

  const handleFocus = (key: TemplateKey) => () => {
    setActiveKey(key);
  };

  const handleSelect =
    (key: TemplateKey) =>
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      const start =
        typeof target.selectionStart === 'number'
          ? target.selectionStart
          : target.value.length;
      const end =
        typeof target.selectionEnd === 'number'
          ? target.selectionEnd
          : target.value.length;

      setActiveKey(key);
      setSelectionMap((prev) => ({
        ...prev,
        [key]: { start, end },
      }));
    };

  const handleInsertPlaceholder = (token: string) => {
    if (!activeKey) {
      alert(
        '挿入先のメッセージをクリックしてから、プレースホルダを選択してください。',
      );
      return;
    }

    setTemplates((prev) => {
      const current = prev[activeKey] ?? '';
      const sel = selectionMap[activeKey];

      if (!sel) {
        return {
          ...prev,
          [activeKey]: current + token,
        };
      }

      const { start, end } = sel;
      const before = current.slice(0, start);
      const after = current.slice(end);

      return {
        ...prev,
        [activeKey]: `${before}${token}${after}`,
      };
    });
  };

  const handleSaveTemplate = async (key: TemplateKey) => {
    setError(null);
    setSavedMessage(null);

    const body = templates[key];
    if (!body || !body.trim()) {
      setError('メッセージ本文が空です。内容を入力してください。');
      return;
    }

    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;

    if (!token) {
      setError('ログイン情報が見つかりません。再度ログインしてください。');
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) {
      setError('API のベースURLが設定されていません。');
      return;
    }

    setSavingKey(key);

    try {
      const res = await fetch(`${apiBase}/reminders/templates`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: keyToType[key],
          title: keyToLabel[key],
          body,
          note: null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `保存に失敗しました (${res.status}): ${
            text || res.statusText || '不明なエラー'
          }`,
        );
      }

      setSavedMessage(`「${keyToLabel[key]}」を保存しました。`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? '保存に失敗しました。');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <TenantLayout>
      <main className="max-w-4xl mx-auto space-y-6 py-4">
        {/* ヘッダー */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1
              className="text-3xl font-extrabold text-green-700 tracking-wide drop-shadow-sm"
              style={{
                fontFamily: "'M PLUS Rounded 1c', system-ui, sans-serif",
              }}
            >
              メッセージ設定
            </h1>
            <p className="mt-1 text-[11px] sm:text-xs text-gray-600 leading-relaxed">
              各種リマインドで送信する LINE メッセージのテンプレートを設定できます。
              メッセージ入力欄を選んでから、下の
              <span className="font-semibold">プレースホルダボタン</span>
              をクリックすると、その位置に差し込みできます。
            </p>
          </div>

          {me && (
            <div className="text-xs text-gray-600 text-right space-y-1">
              <div>
                ログイン中:{' '}
                <span className="font-medium text-gray-900">
                  {me.name ?? me.email}
                </span>
              </div>
              <div>
                ロール:{' '}
                <span className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-50 px-2 py-0.5 text-emerald-800 text-[11px]">
                  {me.role === 'DEVELOPER'
                    ? '開発者'
                    : me.role === 'MANAGER'
                    ? '管理者'
                    : 'スタッフ'}
                </span>
              </div>
            </div>
          )}
        </header>

        {/* プレースホルダ説明 & ボタン */}
<section className="sticky top-[60px] z-20 rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3 space-y-2">
  <p className="text-[11px] sm:text-xs text-gray-600">
    使用できる主なプレースホルダ：
  </p>
  <div className="flex flex-wrap gap-2 text-[11px]">
    {placeholderList.map((p) => (
      <button
        key={p.token}
        type="button"
        onClick={() => handleInsertPlaceholder(p.token)}
        className="inline-flex items-center rounded-full border border-emerald-400 bg-emerald-50 px-2.5 py-0.5 hover:bg-emerald-100 text-emerald-800 whitespace-nowrap"
      >
        {p.label}
      </button>
    ))}
  </div>
</section>

        {/* エラー表示 */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* 各メッセージ入力エリア */}
        <section className="space-y-4">
          {/* 誕生日 */}
          <section className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-800">
                {keyToLabel.birthday}
              </h2>
              <span className="text-[10px] text-gray-400">
                誕生日当日に送信
              </span>
            </div>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-xs text-gray-800 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#00C300]"
              value={templates.birthday}
              onChange={handleChange('birthday')}
              onFocus={handleFocus('birthday')}
              onClick={handleSelect('birthday')}
              onSelect={handleSelect('birthday')}
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveTemplate('birthday')}
                disabled={savingKey === 'birthday'}
                className="px-4 py-1.5 rounded-lg bg-[#00C300] text-white text-xs font-semibold shadow-sm hover:bg-green-500 disabled:opacity-60"
              >
                {savingKey === 'birthday' ? '保存中...' : 'このメッセージを保存'}
              </button>
            </div>
          </section>

          {/* 車検 2ヶ月前 */}
          <section className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-800">
                {keyToLabel.shakenTwoMonths}
              </h2>
              <span className="text-[10px] text-gray-400">
                車検満了日の約60日前に送信
              </span>
            </div>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-xs text-gray-800 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#00C300]"
              value={templates.shakenTwoMonths}
              onChange={handleChange('shakenTwoMonths')}
              onFocus={handleFocus('shakenTwoMonths')}
              onClick={handleSelect('shakenTwoMonths')}
              onSelect={handleSelect('shakenTwoMonths')}
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveTemplate('shakenTwoMonths')}
                disabled={savingKey === 'shakenTwoMonths'}
                className="px-4 py-1.5 rounded-lg bg-[#00C300] text-white text-xs font-semibold shadow-sm hover:bg-green-500 disabled:opacity-60"
              >
                {savingKey === 'shakenTwoMonths'
                  ? '保存中...'
                  : 'このメッセージを保存'}
              </button>
            </div>
          </section>

          {/* 車検 1週間前 */}
          <section className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-800">
                {keyToLabel.shakenOneWeek}
              </h2>
              <span className="text-[10px] text-gray-400">
                車検満了日の7日前に送信
              </span>
            </div>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-xs text-gray-800 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#00C300]"
              value={templates.shakenOneWeek}
              onChange={handleChange('shakenOneWeek')}
              onFocus={handleFocus('shakenOneWeek')}
              onClick={handleSelect('shakenOneWeek')}
              onSelect={handleSelect('shakenOneWeek')}
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveTemplate('shakenOneWeek')}
                disabled={savingKey === 'shakenOneWeek'}
                className="px-4 py-1.5 rounded-lg bg-[#00C300] text-white text-xs font-semibold shadow-sm hover:bg-green-500 disabled:opacity-60"
              >
                {savingKey === 'shakenOneWeek'
                  ? '保存中...'
                  : 'このメッセージを保存'}
              </button>
            </div>
          </section>

          {/* 点検 1ヶ月前 */}
          <section className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-800">
                {keyToLabel.inspectionOneMonth}
              </h2>
              <span className="text-[10px] text-gray-400">
                点検予定日の30日前に送信
              </span>
            </div>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-xs text-gray-800 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#00C300]"
              value={templates.inspectionOneMonth}
              onChange={handleChange('inspectionOneMonth')}
              onFocus={handleFocus('inspectionOneMonth')}
              onClick={handleSelect('inspectionOneMonth')}
              onSelect={handleSelect('inspectionOneMonth')}
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveTemplate('inspectionOneMonth')}
                disabled={savingKey === 'inspectionOneMonth'}
                className="px-4 py-1.5 rounded-lg bg-[#00C300] text-white text-xs font-semibold shadow-sm hover:bg-green-500 disabled:opacity-60"
              >
                {savingKey === 'inspectionOneMonth'
                  ? '保存中...'
                  : 'このメッセージを保存'}
              </button>
            </div>
          </section>

          {/* 任意日付 */}
          <section className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-800">
                {keyToLabel.custom}
              </h2>
              <span className="text-[10px] text-gray-400">
                任意に設定した日付の {`{daysBefore}`} 日前に送信
              </span>
            </div>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-xs text-gray-800 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#00C300]"
              value={templates.custom}
              onChange={handleChange('custom')}
              onFocus={handleFocus('custom')}
              onClick={handleSelect('custom')}
              onSelect={handleSelect('custom')}
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveTemplate('custom')}
                disabled={savingKey === 'custom'}
                className="px-4 py-1.5 rounded-lg bg-[#00C300] text-white text-xs font-semibold shadow-sm hover:bg-green-500 disabled:opacity-60"
              >
                {savingKey === 'custom' ? '保存中...' : 'このメッセージを保存'}
              </button>
            </div>
          </section>
        </section>

        {!error && !savedMessage && (
          <p className="text-[11px] sm:text-xs text-gray-500">
            各メッセージを編集したら、直下の「このメッセージを保存」ボタンを押してください。
          </p>
        )}
      </main>

      {/* 保存完了モーダル */}
      {savedMessage && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xs sm:max-w-sm rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
              保存が完了しました
            </h3>
            <p className="text-[12px] sm:text-sm text-gray-700 whitespace-pre-line mb-4">
              {savedMessage}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSavedMessage(null)}
                className="px-3 py-1.5 rounded-md border border-gray-500 text-xs sm:text-sm text-gray-900 bg-white hover:bg-gray-100"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </TenantLayout>
  );
}
