'use client';

import { useEffect, useState, FormEvent } from 'react';

type Templates = {
  birthday: string;
  shakenTwoMonths: string;
  shakenOneWeek: string;
  inspectionOneMonth: string;
  custom: string;
};

const DEFAULT_TEMPLATES: Templates = {
  birthday:
    '{customerName} 様\n\nお誕生日おめでとうございます！\n{shopName} です。\nいつもご利用いただきありがとうございます。',
  shakenTwoMonths:
    '{customerName} 様\n\n{carName}（{registrationNumber}）の車検満了日が {mainDate} となっております。\nお早めのご予約をおすすめいたします。\nご予約はこちら：{bookingUrl}',
  shakenOneWeek:
    '{customerName} 様\n\n{carName}（{registrationNumber}）の車検満了日が近づいております（{mainDate}）。\nまだご予約がお済みでない場合は、ご連絡をお願いいたします。',
  inspectionOneMonth:
    '{customerName} 様\n\n{carName}（{registrationNumber}）の点検時期が近づいております（{mainDate}）。\nご希望の日時があればお気軽にご相談ください。',
  custom:
    '{customerName} 様\n\n{note}\n\n{shopName}',
};

export default function MessageSettingsPage() {
  const [templates, setTemplates] = useState<Templates>(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // 初期値読み込み（バックエンドの API ができたらここで取得）
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const token =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('auth_token')
            : null;

        if (!token) return;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/line-settings/messages`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!res.ok) {
          // まだ API 未実装や 404 の場合はデフォルトのままでもOK
          return;
        }

        const data = (await res.json()) as Partial<Templates>;
        setTemplates((prev) => ({
          ...prev,
          ...data,
        }));
      } catch (e) {
        // 読み込み失敗時はとりあえずデフォルトのまま
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const handleChange =
    (key: keyof Templates) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setTemplates((prev) => ({
        ...prev,
        [key]: e.target.value,
      }));
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const token =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('auth_token')
          : null;

      if (!token) {
        throw new Error('ログイン情報が見つかりません。再度ログインしてください。');
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/line-settings/messages`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(templates),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          (data as any)?.message ||
          'メッセージ設定の保存に失敗しました。サーバーログを確認してください。';
        throw new Error(msg);
      }

      setSavedMessage('メッセージ設定を保存しました。');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || '保存中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto">
      <h1 className="text-lg font-bold mb-4 text-gray-800">メッセージ設定</h1>
      <p className="text-xs text-gray-600 mb-4">
        各種リマインドで送信する LINE メッセージのテンプレートを設定します。
        <br />
        <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">
          {'{customerName}'}
        </code>
        ,
        <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">
          {'{carName}'}
        </code>
        ,
        <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">
          {'{registrationNumber}'}
        </code>
        ,
        <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">
          {'{mainDate}'}
        </code>
        ,
        <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">
          {'{bookingUrl}'}
        </code>
        などのプレースホルダが利用できます。
      </p>

      {loading && (
        <div className="mb-4 text-xs text-gray-500">読込中です...</div>
      )}

      {error && (
        <div className="mb-4 border border-red-300 bg-red-50 text-xs text-red-800 rounded px-3 py-2 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {savedMessage && (
        <div className="mb-4 border border-green-300 bg-green-50 text-xs text-green-800 rounded px-3 py-2 whitespace-pre-wrap">
          {savedMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* カードをカテゴリごとに */}
        <section className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold mb-2 text-gray-800">
            誕生日メッセージ
          </h2>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-xs min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#00C300]"
            value={templates.birthday}
            onChange={handleChange('birthday')}
          />
        </section>

        <section className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold mb-2 text-gray-800">
            車検 2ヶ月前メッセージ
          </h2>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-xs min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#00C300]"
            value={templates.shakenTwoMonths}
            onChange={handleChange('shakenTwoMonths')}
          />
        </section>

        <section className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold mb-2 text-gray-800">
            車検 1週間前メッセージ
          </h2>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-xs min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#00C300]"
            value={templates.shakenOneWeek}
            onChange={handleChange('shakenOneWeek')}
          />
        </section>

        <section className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold mb-2 text-gray-800">
            点検 1ヶ月前メッセージ
          </h2>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-xs min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#00C300]"
            value={templates.inspectionOneMonth}
            onChange={handleChange('inspectionOneMonth')}
          />
        </section>

        <section className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold mb-2 text-gray-800">
            任意日付メッセージ
          </h2>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-xs min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#00C300]"
            value={templates.custom}
            onChange={handleChange('custom')}
          />
        </section>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-[#00C300] text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-60 hover:bg-green-500 transition-colors"
          >
            {saving ? '保存中...' : 'この内容で保存'}
          </button>
        </div>
      </form>
    </main>
  );
}
