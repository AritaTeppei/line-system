'use client';

import { useEffect, useState, useMemo } from 'react';
import TenantLayout from '../../components/TenantLayout';

type DaySummary = {
  date: string; // "YYYY-MM-DD"
  birthdayCount: number;
  shakenTwoMonthsCount: number;
  shakenOneWeekCount: number;
  inspectionOneMonthCount: number;
  customCount: number;
  totalCount: number;
};

type MonthReminderItem = {
  id: number;
  date: string; // "YYYY-MM-DD"
  category:
    | 'birthday'
    | 'shakenTwoMonths'
    | 'shakenOneWeek'
    | 'inspectionOneMonth'
    | 'custom';
  customerName: string;
  carName?: string | null;
  plateNumber?: string | null;
};

type PreviewMonthResponse = {
  month: string; // "YYYY-MM"
  tenantId: number;
  days: DaySummary[];
  items: MonthReminderItem[];
};

const categoryLabelMap: Record<MonthReminderItem['category'], string> = {
  birthday: '誕生日',
  shakenTwoMonths: '車検 2ヶ月前',
  shakenOneWeek: '車検 1週間前',
  inspectionOneMonth: '点検 1ヶ月前',
  custom: '任意日付',
};

const categoryOptions: {
  value: 'ALL' | MonthReminderItem['category'];
  label: string;
}[] = [
  { value: 'ALL', label: 'すべて' },
  { value: 'birthday', label: '誕生日' },
  { value: 'shakenTwoMonths', label: '車検 2ヶ月前' },
  { value: 'shakenOneWeek', label: '車検 1週間前' },
  { value: 'inspectionOneMonth', label: '点検 1ヶ月前' },
  { value: 'custom', label: '任意日付' },
];

export default function RemindersMonthPage() {
  const [month, setMonth] = useState<string>('');
  const [data, setData] = useState<PreviewMonthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] =
    useState<'ALL' | MonthReminderItem['category']>('ALL');

  // チェック状態
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sending, setSending] = useState(false);

  // 初期表示: 今月をセット
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    setMonth(`${y}-${m}`);
  }, []);

  // month が変わるたびに /reminders/preview-month を叩く
  useEffect(() => {
    const run = async () => {
      if (!month) return;

      setLoading(true);
      setPageError(null);
      setSelectedIds([]); // 月が変わったら選択クリア

      try {
        const token =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('auth_token')
            : null;

        if (!token) {
          setPageError(
            '先にログインしてください（トップページからログイン）',
          );
          setLoading(false);
          return;
        }

        const apiBase = process.env.NEXT_PUBLIC_API_URL;
        const res = await fetch(
          `${apiBase}/reminders/preview-month?month=${encodeURIComponent(
            month,
          )}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `サーバーエラー (${res.status}): ${
              text || res.statusText || '不明なエラー'
            }`,
          );
        }

        const json = (await res.json()) as PreviewMonthResponse;
        setData(json);
      } catch (e: any) {
        console.error(e);
        setPageError(e?.message ?? '月別リマインドの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [month]);

  const handlePrevMonth = () => {
    if (!month) return;
    const [yStr, mStr] = month.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() - 1);
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, '0');
    setMonth(`${ny}-${nm}`);
  };

  const handleNextMonth = () => {
    if (!month) return;
    const [yStr, mStr] = month.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() + 1);
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, '0');
    setMonth(`${ny}-${nm}`);
  };

  const filteredItems = useMemo(() => {
    if (!data) return [];
    let items = data.items ?? [];
    if (categoryFilter !== 'ALL') {
      items = items.filter((item) => item.category === categoryFilter);
    }
    // 日付＋カテゴリーで一応安定ソート
    return items.slice().sort((a, b) => {
      if (a.date === b.date) {
        return a.category.localeCompare(b.category);
      }
      return a.date.localeCompare(b.date);
    });
  }, [data, categoryFilter]);

  // チェック切り替え
  const toggleItem = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // 今表示している行が全て選択されているか
  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.includes(item.id));

  // 今表示している行の全選択 / 全解除
  const handleToggleAllVisible = () => {
    if (filteredItems.length === 0) return;

    if (allVisibleSelected) {
      // 今表示している分を全部外す
      const visibleIds = new Set(filteredItems.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      // 今表示している分を全部ONにする
      const visibleIds = filteredItems.map((item) => item.id);
      setSelectedIds((prev) => {
        const set = new Set(prev);
        visibleIds.forEach((id) => set.add(id));
        return Array.from(set);
      });
    }
  };

  // 選択した件を送信（バックエンド側で /reminders/send-bulk を用意する想定）
  const handleSendSelected = async () => {
    if (!data) return;
    if (selectedIds.length === 0) {
      alert('送信対象が選択されていません。');
      return;
    }

    const ok = window.confirm(
      `選択中の ${selectedIds.length} 件にリマインドを送信します。よろしいですか？`,
    );
    if (!ok) return;

    try {
      setSending(true);

      const token =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('auth_token')
          : null;

      if (!token) {
        alert('先にログインしてください（トップページからログイン）');
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiBase}/reminders/send-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          month: data.month,
          itemIds: selectedIds,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `送信に失敗しました (${res.status}): ${
            text || res.statusText || '不明なエラー'
          }`,
        );
      }

      alert('送信処理を受け付けました。');
      // 必要ならここで selectedIds をクリア
      // setSelectedIds([]);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? '送信に失敗しました。');
    } finally {
      setSending(false);
    }
  };

  return (
    <TenantLayout>
      <main className="min-h-screen flex flex-col items-center p-4">
        <div className="w-full max-w-6xl space-y-4">
          <h1 className="text-2xl font-bold mt-4">
            リマインド（月別サマリ & 一覧）
          </h1>

          {/* 月選択ヘッダー */}
          <section className="border rounded-md px-4 py-3 bg-white flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="px-3 py-1 border rounded text-sm bg-gray-50 hover:bg-gray-100"
            >
              ← 前の月
            </button>

            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />

            <button
              type="button"
              onClick={handleNextMonth}
              className="px-3 py-1 border rounded text-sm bg-gray-50 hover:bg-gray-100"
            >
              次の月 →
            </button>

            {data && (
              <div className="ml-auto text-xs text-gray-600">
                合計件数:{' '}
                <span className="font-semibold">
                  {data.days.reduce((sum, d) => sum + d.totalCount, 0)}
                </span>
              </div>
            )}
          </section>

          {loading && (
            <p className="text-sm text-gray-600">読み込み中...</p>
          )}

          {pageError && (
            <div className="border border-red-400 bg-red-50 text-red-700 px-4 py-3 rounded text-sm whitespace-pre-wrap">
              {pageError}
            </div>
          )}

          {/* 日ごとの件数テーブル */}
          {data && (
            <section className="border rounded-md bg-white overflow-x-auto">
              <div className="px-4 py-2 border-b text-sm font-semibold">
                日別サマリ
              </div>
              <table className="min-w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-left">日付</th>
                    <th className="px-2 py-1 text-right">合計</th>
                    <th className="px-2 py-1 text-right">誕生日</th>
                    <th className="px-2 py-1 text-right">車検2ヶ月前</th>
                    <th className="px-2 py-1 text-right">車検1週間前</th>
                    <th className="px-2 py-1 text-right">点検1ヶ月前</th>
                    <th className="px-2 py-1 text-right">任意日付</th>
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((day) => (
                    <tr key={day.date} className="border-t">
                      <td className="px-2 py-1">{day.date}</td>
                      <td className="px-2 py-1 text-right font-semibold">
                        {day.totalCount}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {day.birthdayCount}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {day.shakenTwoMonthsCount}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {day.shakenOneWeekCount}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {day.inspectionOneMonthCount}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {day.customCount}
                      </td>
                    </tr>
                  ))}
                  {data.days.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-2 py-4 text-center text-gray-500"
                      >
                        この月のリマインド対象はありません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {/* 対象者＋対象車両 一覧 ＋ チェックボックス・送信ボタン */}
          {data && (
            <section className="border rounded-md bg-white overflow-x-auto">
              <div className="px-4 py-2 border-b flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold">
                  対象者 & 対象車両 一覧
                </span>

                <div className="flex items-center gap-2 text-xs">
                  <span>種別フィルタ:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) =>
                      setCategoryFilter(
                        e.target.value as
                          | 'ALL'
                          | MonthReminderItem['category'],
                      )
                    }
                    className="border rounded px-2 py-1 text-xs"
                  >
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ml-auto flex items-center gap-3 text-xs">
                  <span>
                    選択中:{' '}
                    <span className="font-semibold">{selectedIds.length}</span>{' '}
                    件
                  </span>
                  <button
                    type="button"
                    onClick={handleSendSelected}
                    disabled={sending || selectedIds.length === 0}
                    className="px-3 py-1 border rounded bg-green-500 text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? '送信中...' : '選択した件を送信'}
                  </button>
                </div>
              </div>

              <table className="min-w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={handleToggleAllVisible}
                      />
                    </th>
                    <th className="px-2 py-1 text-left">日付</th>
                    <th className="px-2 py-1 text-left">種別</th>
                    <th className="px-2 py-1 text-left">顧客名</th>
                    <th className="px-2 py-1 text-left">車両</th>
                    <th className="px-2 py-1 text-left">ナンバー</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleItem(item.id)}
                        />
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {item.date}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {categoryLabelMap[item.category]}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {item.customerName}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {item.carName || '-'}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {item.plateNumber || '-'}
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-4 text-center text-gray-500"
                      >
                        この条件に合う対象はありません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {!loading && !data && !pageError && (
            <p className="text-sm text-gray-600">
              月を選択すると、その月の日付ごとの件数と、
              対象者・対象車両の一覧が表示されます。
            </p>
          )}
        </div>
      </main>
    </TenantLayout>
  );
}
