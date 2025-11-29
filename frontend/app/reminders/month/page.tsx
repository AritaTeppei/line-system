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

// フロント専用の「送信済み」フラグ付き
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
  sent?: boolean; // 送信済み
};

type PreviewMonthResponse = {
  month: string; // "YYYY-MM"
  tenantId: number;
  days: DaySummary[];
  items: MonthReminderItem[];
};

type Role = 'DEVELOPER' | 'MANAGER' | 'CLIENT';

type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: Role;
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

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sending, setSending] = useState(false);

  const [me, setMe] = useState<Me | null>(null);

  // 行クリックで表示する詳細モーダル用
  const [detailItem, setDetailItem] = useState<MonthReminderItem | null>(
    null,
  );

  // 初期表示: 今月をセット
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    setMonth(`${y}-${m}`);
  }, []);

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

  // month が変わるたびに /reminders/preview-month を叩く（元の挙動そのまま）
  useEffect(() => {
    const run = async () => {
      if (!month) return;

      setLoading(true);
      setPageError(null);
      setSelectedIds([]); // 月が変わったら選択クリア
      setDetailItem(null); // モーダルも閉じる

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
    // 日付＋カテゴリーで安定ソート
    return items.slice().sort((a, b) => {
      if (a.date === b.date) {
        return a.category.localeCompare(b.category);
      }
      return a.date.localeCompare(b.date);
    });
  }, [data, categoryFilter]);

  // 「未送信の行だけ」を選択対象にする
  const selectableItems = filteredItems.filter((item) => !item.sent);

  // チェック切り替え（未送信のみ）
  const toggleItem = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // 今表示している「未送信行」がすべて選択されているか
  const allVisibleSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedIds.includes(item.id));

  // 今表示している「未送信行」の全選択 / 全解除
  const handleToggleAllVisible = () => {
    if (selectableItems.length === 0) return;

    if (allVisibleSelected) {
      // 今表示している未送信分を全部外す
      const visibleIds = new Set(selectableItems.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      // 今表示している未送信分を全部ONにする
      const visibleIds = selectableItems.map((item) => item.id);
      setSelectedIds((prev) => {
        const set = new Set(prev);
        visibleIds.forEach((id) => set.add(id));
        return Array.from(set);
      });
    }
  };

  // 選択した件を送信（/reminders/send-bulk）＋送信済みマーク更新
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

      // フロント側の state だけで「送信済み」をマーク
      setData((prev) => {
        if (!prev) return prev;
        const sentIdSet = new Set(selectedIds);
        const newItems = prev.items.map((item) =>
          sentIdSet.has(item.id) ? { ...item, sent: true } : item,
        );
        return { ...prev, items: newItems };
      });

      // 送信済みは選択解除
      setSelectedIds([]);

      alert('送信処理を受け付けました。');
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? '送信に失敗しました。');
    } finally {
      setSending(false);
    }
  };

  const totalCountThisMonth =
    data?.days.reduce((sum, d) => sum + d.totalCount, 0) ?? 0;

  return (
    <TenantLayout>
      <div className="max-w-6xl mx-auto space-y-6 py-4">
        {/* ヘッダー：ダッシュボード系と同じトーン */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mt-2">
          <div>
            <h1
              className="text-3xl font-extrabold text-green-700 tracking-wide drop-shadow-sm"
              style={{
                fontFamily: "'M PLUS Rounded 1c', system-ui, sans-serif",
              }}
            >
              リマインド（月別サマリ）
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-600 mt-1">
              指定した月の「誕生日・車検・点検・任意日付」の対象件数を日別に確認し、
              下の一覧から送信対象を絞り込んで一括送信できます。
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

        {/* エラー表示 */}
        {pageError && (
          <div className="max-w-3xl">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 whitespace-pre-wrap">
              {pageError}
            </div>
          </div>
        )}

        {/* サマリカード（今月の総件数 & 選択件数） */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-1">
            <div className="text-[11px] font-semibold text-gray-500">
              今月のリマインド件数
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {totalCountThisMonth}
              </span>
              <span className="text-[11px] text-gray-500">件</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              月別サマリに含まれる全リマインド件数です。
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-1">
            <div className="text-[11px] font-semibold text-gray-500">
              一括送信用に選択中
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {selectedIds.length}
              </span>
              <span className="text-[11px] text-gray-500">件</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              下の一覧でチェックを入れているリマインド対象の件数です。
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-1">
            <div className="text-[11px] font-semibold text-gray-500">
              表示中の種別
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {
                categoryOptions.find((c) => c.value === categoryFilter)
                  ?.label
              }
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              「種別フィルタ」で誕生日・車検・点検・任意日付ごとに絞り込みができます。
            </p>
          </div>
        </section>

        {/* 月選択＋操作バー */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="px-3 py-1 border border-gray-400 rounded-md text-xs bg-gray-50 hover:bg-gray-100"
            >
              ← 前の月
            </button>

            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border border-gray-400 rounded-md px-2 py-1 text-xs sm:text-sm"
            />

            <button
              type="button"
              onClick={handleNextMonth}
              className="px-3 py-1 border border-gray-400 rounded-md text-xs bg-gray-50 hover:bg-gray-100"
            >
              次の月 →
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-[11px] text-gray-600">
            <span>
              月を切り替えると、その月のサマリと対象一覧が自動で更新されます。
            </span>
            {data && (
              <span>
                この月の合計:{' '}
                <span className="font-semibold text-gray-900">
                  {totalCountThisMonth}
                </span>{' '}
                件
              </span>
            )}
          </div>
        </section>

        {/* ローディング */}
        {loading && (
          <div className="text-sm text-gray-600">読み込み中...</div>
        )}

        {/* 日ごとの件数テーブル */}
        {data && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <div className="px-4 py-2 border-b text-sm font-semibold text-gray-900">
              日別サマリ
            </div>
            <table className="min-w-full text-[11px] sm:text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left border-b border-gray-200">
                    日付
                  </th>
                  <th className="px-2 py-1 text-right border-b border-gray-200">
                    合計
                  </th>
                  <th className="px-2 py-1 text-right border-b border-gray-200">
                    誕生日
                  </th>
                  <th className="px-2 py-1 text-right border-b border-gray-200">
                    車検2ヶ月前
                  </th>
                  <th className="px-2 py-1 text-right border-b border-gray-200">
                    車検1週間前
                  </th>
                  <th className="px-2 py-1 text-right border-b border-gray-200">
                    点検1ヶ月前
                  </th>
                  <th className="px-2 py-1 text-right border-b border-gray-200">
                    任意日付
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((day) => (
                  <tr key={day.date} className="border-t border-gray-100">
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
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <div className="px-4 py-2 border-b flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-gray-900">
                対象者 & 対象車両 一覧
              </span>

              <div className="flex items-center gap-2 text-[11px]">
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
                  className="border border-gray-400 rounded px-2 py-1 text-[11px]"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ml-auto flex flex-col sm:flex-row sm:items-center gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span>
                    選択中:{' '}
                    <span className="font-semibold text-emerald-700">
                      {selectedIds.length}
                    </span>{' '}
                    件
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleAllVisible}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-400 bg-white hover:bg-gray-100 px-2 py-1 text-[11px]"
                    disabled={selectableItems.length === 0}
                  >
                    {allVisibleSelected
                      ? 'この一覧の未送信分を全て外す'
                      : 'この一覧の未送信分を全て選択'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSendSelected}
                  disabled={sending || selectedIds.length === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? '送信中...' : '選択した件を送信'}
                </button>
              </div>
            </div>

            <table className="min-w-full text-[11px] sm:text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-center border-b border-gray-200 w-8">
                    <input
                      type="checkbox"
                      checked={selectableItems.length > 0 && allVisibleSelected}
                      onChange={handleToggleAllVisible}
                      disabled={selectableItems.length === 0}
                    />
                  </th>
                  <th className="px-2 py-1 text-left border-b border-gray-200">
                    日付
                  </th>
                  <th className="px-2 py-1 text-left border-b border-gray-200">
                    種別
                  </th>
                  <th className="px-2 py-1 text-left border-b border-gray-200">
                    顧客名
                  </th>
                  <th className="px-2 py-1 text-left border-b border-gray-200">
                    車両
                  </th>
                  <th className="px-2 py-1 text-left border-b border-gray-200">
                    ナンバー
                  </th>
                  <th className="px-2 py-1 text-left border-b border-gray-200">
                    状態
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isSent = !!item.sent;
                  const isChecked =
                    !isSent && selectedIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setDetailItem(item)} // 行クリックで詳細モーダル
                    >
                      <td
                        className="px-2 py-1 text-center align-middle"
                        onClick={(e) => e.stopPropagation()} // チェックボックスクリックでモーダル開かないように
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isSent}
                          onChange={() => {
                            if (!isSent) toggleItem(item.id);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap align-middle">
                        {item.date}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap align-middle">
                        {categoryLabelMap[item.category]}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap align-middle">
                        {item.customerName}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap align-middle">
                        {item.carName || '-'}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap align-middle">
                        {item.plateNumber || '-'}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap align-middle">
                        {isSent ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-400 px-2 py-0.5 text-[10px] text-emerald-800 font-semibold">
                            送信済み
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            未送信
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
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

      {/* 顧客・車両 詳細モーダル */}
      {detailItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
              顧客・車両の詳細
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              月別サマリで選択した行の情報です。顧客・車両のより詳しい情報は
              「顧客一覧」「車両一覧」から確認できます。
            </p>

            <div className="space-y-3 text-[12px] sm:text-sm">
              <div>
                <div className="text-[11px] font-medium text-gray-500">
                  リマインド日付
                </div>
                <div className="text-gray-900">{detailItem.date}</div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-gray-500">
                  リマインド種別
                </div>
                <div className="text-gray-900">
                  {categoryLabelMap[detailItem.category]}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-2">
                <div className="text-[11px] font-medium text-gray-500">
                  顧客名
                </div>
                <div className="text-gray-900">
                  {detailItem.customerName || '-'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-gray-500">
                  車両名
                </div>
                <div className="text-gray-900">
                  {detailItem.carName || '-'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-gray-500">
                  ナンバー
                </div>
                <div className="text-gray-900">
                  {detailItem.plateNumber || '-'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-gray-500">
                  状態
                </div>
                <div className="text-gray-900">
                  {detailItem.sent ? '送信済み' : '未送信'}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
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
