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
  registrationNumber?: string | null;

  // 顧客情報
  customerPhone?: string | null;
  customerAddress?: string | null;

  // ★ 追加：顧客の LINE UID
  lineUid?: string | null;

  // ★ 追加：車検日・点検日
  shakenDate?: string | null;
  inspectionDate?: string | null;

  // ★ 追加：送信メッセージ内容（バックエンドから渡ってくる）
  messageText?: string | null;

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


// 日付ラベルを YYYY/MM/DD で表示
function formatDateLabel(value?: string | null): string {
  if (!value) return '-';

  // "YYYY-MM-DD" だけならそのまま変換
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replace(/-/g, '/');
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

// ★ 追加：下のテーブルで使う別名ヘルパー
function formatDateDisplay(value?: string | null): string {
  return formatDateLabel(value);
}


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

  // ★ 追加：送信確認モーダル＋カウントダウン用
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [isCounting, setIsCounting] = useState(false);

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

  // month が変わるたびに /reminders/preview-month を叩く
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

  const canSelect = (item: MonthReminderItem): boolean => {

  if (item.sent) return false;

  if (!item.lineUid || item.lineUid.trim() === '') return false;

  return true;
};

  // ★ ① まずは「その月の全アイテム」を対象にする
  let items = data.items ?? [];

  // ★ ② 誕生日は「選択中の月」と同じ月だけに絞る
  if (month) {
    const [_, mStr] = month.split('-'); // "YYYY-MM" から月を取り出す
    const selectedMonth = Number(mStr);

    if (!Number.isNaN(selectedMonth)) {
      items = items.filter((item) => {
        // 誕生日以外（車検・点検・custom）はそのまま残す
        if (item.category !== 'birthday') return true;

        if (!item.date) return false;

        const d = new Date(item.date);
        if (Number.isNaN(d.getTime())) return false;

        const itemMonth = d.getMonth() + 1;
        return itemMonth === selectedMonth;
      });
    }
  }

  // ★ ③ 種別フィルタ
  if (categoryFilter !== 'ALL') {
    items = items.filter((item) => item.category === categoryFilter);
  }

  // ★ ④ 日付＋カテゴリーで安定ソート
  return items.slice().sort((a, b) => {
    if (a.date === b.date) {
      return a.category.localeCompare(b.category);
    }
    return a.date.localeCompare(b.date);
  });
}, [data, categoryFilter, month]);

  // ★ LINE 連携している行だけ「選択可能」とみなす
  const canSelect = (item: MonthReminderItem): boolean => {
    // lineUid が null / 空文字 / 空白だけ の場合は選択不可
    return !!(item.lineUid && item.lineUid.trim() !== "");
  };

  // ★ 選択中のアイテム一覧（モーダル表示用）
  const selectedItems = useMemo(() => {
    if (!data) return [];
    if (selectedIds.length === 0) return [];
    const idSet = new Set(selectedIds);
    return (data.items ?? []).filter((item) => idSet.has(item.id));
  }, [data, selectedIds]);

  const isDeveloper = me?.role === 'DEVELOPER' || me?.role === 'MANAGER';

    // DEVELOPERは送信済みも再選択可。それ以外は未送信のみ
  const selectableItems = filteredItems.filter(
    (item) => (isDeveloper || !item.sent) && canSelect(item),
  );

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

  // ★ 「選択した件を送信」ボタン → モーダルを開くだけ
  const handleOpenSendConfirm = () => {
    if (!data) return;
    if (selectedIds.length === 0) {
      alert('送信対象が選択されていません。');
      return;
    }
    setSendConfirmOpen(true);
    setCountdown(10);
    setIsCounting(false);
  };

  // 選択した件を送信（/reminders/send-bulk）＋送信済みマーク更新
  const handleSendSelected = async () => {
    if (!data) return;
    if (selectedIds.length === 0) {
      alert('送信対象が選択されていません。');
      return;
    }

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

  // ★ カウントダウン処理
  useEffect(() => {
    if (!sendConfirmOpen || !isCounting) return;

    if (countdown <= 0) {
      // 0になったら送信実行
      (async () => {
        await handleSendSelected();
        setIsCounting(false);
        setSendConfirmOpen(false);
        setCountdown(10);
      })();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [sendConfirmOpen, isCounting, countdown]);

  const totalCountThisMonth =
    data?.days.reduce((sum, d) => sum + d.totalCount, 0) ?? 0;

  return (
    <TenantLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-extrabold text-green-700 flex items-center gap-2">
            🔔 リマインド管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            指定した月の「誕生日・車検・点検・任意日付」の対象件数を日別に確認し、一覧から送信対象を絞り込んで一括送信できます。
          </p>
        </div>

        {/* エラー表示 */}
        {pageError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 whitespace-pre-wrap">
            {pageError}
          </div>
        )}

        {/* サマリカード */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border-l-4 border-l-green-400 border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col gap-2">
            <div className="text-xs font-bold text-green-600">🔔 今月のリマインド件数</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-gray-900">{totalCountThisMonth}</span>
              <span className="text-sm text-gray-400">件</span>
            </div>
            <p className="text-xs text-gray-500">月別サマリに含まれる全リマインド件数です。</p>
          </div>

          <div className="rounded-2xl border-l-4 border-l-amber-400 border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col gap-2">
            <div className="text-xs font-bold text-amber-600">☑️ 一括送信用に選択中</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-gray-900">{selectedIds.length}</span>
              <span className="text-sm text-gray-400">件</span>
            </div>
            <p className="text-xs text-gray-500">
              下の一覧でチェックを入れているリマインド対象の件数です。
            </p>
          </div>

          <div className="rounded-2xl border-l-4 border-l-purple-400 border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-col gap-2">
            <div className="text-xs font-bold text-purple-600">🔍 表示中の種別</div>
            <div className="text-lg font-black text-gray-900">
              {categoryOptions.find((c) => c.value === categoryFilter)?.label}
            </div>
            <p className="text-xs text-gray-500">種別フィルタで絞り込みができます。</p>
          </div>
        </section>

        {/* 月選択バー */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-bold bg-white hover:bg-gray-50 transition"
            >
              ← 前の月
            </button>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
            />
            <button
              type="button"
              onClick={handleNextMonth}
              className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-bold bg-white hover:bg-gray-50 transition"
            >
              次の月 →
            </button>
          </div>
          {data && (
            <span className="text-xs text-gray-500">
              この月の合計: <span className="font-bold text-gray-800">{totalCountThisMonth}</span> 件
            </span>
          )}
        </section>

        {/* ローディング */}
        {loading && (
          <div className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-200 px-5 py-4 shadow-sm">読み込み中...</div>
        )}

        {/* 日ごとの件数テーブル */}
        {data && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className="text-sm font-bold text-gray-700">📅 日別サマリ</span>
            </div>
            <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-bold text-gray-600">日付</th>
                  <th className="px-3 py-2 text-right border-b border-gray-200 font-bold text-gray-600">合計</th>
                  <th className="px-3 py-2 text-right border-b border-gray-200 font-bold text-rose-600">🎂誕生日</th>
                  <th className="px-3 py-2 text-right border-b border-gray-200 font-bold text-blue-600">🔧車検2ヶ月前</th>
                  <th className="px-3 py-2 text-right border-b border-gray-200 font-bold text-orange-600">⚠️車検1週間前</th>
                  <th className="px-3 py-2 text-right border-b border-gray-200 font-bold text-purple-600">🔩点検1ヶ月前</th>
                  <th className="px-3 py-2 text-right border-b border-gray-200 font-bold text-gray-600">📅任意日付</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((day) => (
                  <tr key={day.date} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{day.date}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">
                      {day.totalCount > 0 ? <span className="inline-flex items-center justify-center rounded-full bg-green-100 text-green-800 px-2 py-0.5 min-w-[2rem]">{day.totalCount}</span> : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {day.birthdayCount > 0 ? day.birthdayCount : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {day.shakenTwoMonthsCount > 0 ? day.shakenTwoMonthsCount : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {day.shakenOneWeekCount > 0 ? day.shakenOneWeekCount : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {day.inspectionOneMonthCount > 0 ? day.inspectionOneMonthCount : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {day.customCount > 0 ? day.customCount : <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                ))}
                {data.days.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-400 text-sm">
                      この月のリマインド対象はありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </section>
        )}

        {/* 対象者＋対象車両 一覧 */}
        {data && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-gray-700">
                👤 対象者 & 対象車両 一覧
              </span>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">種別:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) =>
                    setCategoryFilter(
                      e.target.value as 'ALL' | MonthReminderItem['category'],
                    )
                  }
                  className="border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-600">
                  選択中: <span className="font-bold text-green-700">{selectedIds.length}</span> 件
                </span>
                <button
                  type="button"
                  onClick={handleToggleAllVisible}
                  className="rounded-xl border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-bold transition"
                  disabled={selectableItems.length === 0}
                >
                  {allVisibleSelected ? '全て外す' : '未送信を全て選択'}
                </button>
                <button
                  type="button"
                  onClick={handleOpenSendConfirm}
                  disabled={sending || selectedIds.length === 0}
                  className="rounded-xl bg-green-600 text-white px-4 py-1.5 text-xs font-bold shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {sending ? '⏳ 送信中...' : '📤 選択した件を送信'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-center border-b border-gray-200 w-10">
                    <input
                      type="checkbox"
                      checked={selectableItems.length > 0 && allVisibleSelected}
                      onChange={handleToggleAllVisible}
                      disabled={selectableItems.length === 0}
                    />
                  </th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-bold text-gray-600">日付</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-bold text-gray-600">種別</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-bold text-gray-600">顧客名</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-bold text-gray-600">車両</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-bold text-gray-600">ナンバー</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200 font-bold text-gray-600">状態</th>
                </tr>
              </thead>
              <tbody>
   {filteredItems.map((item) => {
      const isSent = !!item.sent;
      const selectable = (isDeveloper || !isSent) && canSelect(item);
      const isChecked = selectable && selectedIds.includes(item.id);

      return (
        <tr
          key={item.id}
          className="border-t border-gray-100 hover:bg-green-50 cursor-pointer transition-colors"
          onClick={() => setDetailItem(item)}
        >
          <td
            className="px-3 py-2 text-center align-middle"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isChecked}
              disabled={!selectable}
              onChange={() => { if (selectable) toggleItem(item.id); }}
            />
          </td>
          <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">
            {item.date}
          </td>
          <td className="px-3 py-2 whitespace-nowrap">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700">
              {categoryLabelMap[item.category]}
            </span>
          </td>

          <td className="px-3 py-2 whitespace-nowrap text-gray-800">{item.customerName}</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-600">{item.carName ?? '-'}</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-600">{item.plateNumber ?? item.registrationNumber ?? '-'}</td>
          <td className="px-3 py-2 whitespace-nowrap">
            {item.lineUid ? (
              isSent ? (
                isDeveloper ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold">
                    🔁 送信済み（再送可）
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold">
                    ✅ 送信済み
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-[11px] font-bold">
                  📤 未送信
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200 px-2.5 py-0.5 text-[11px]">
                LINE未連携
              </span>
            )}
          </td>
        </tr>
      );
    })}
    {filteredItems.length === 0 && (
      <tr>
        <td colSpan={7} className="px-3 py-6 text-center text-gray-400 text-sm">
          この条件に合う対象はありません。
        </td>
      </tr>
    )}
  </tbody>
</table>
            </div>
          </section>
        )}

        {!loading && !data && !pageError && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-6 text-sm text-gray-500 text-center">
            月を選択すると、その月の日付ごとの件数と対象者・対象車両の一覧が表示されます。
          </div>
        )}
      </div>

      {/* 送信確認モーダル */}
      {sendConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 p-5">
            <h3 className="text-base font-extrabold text-gray-900 mb-1">📤 送信確認</h3>
            <p className="text-xs text-gray-500 mb-4">
              下記の件数と内容でLINEリマインドを送信します。10秒カウントダウン後に送信されます。
            </p>

            <div className="space-y-3">
              <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-2.5">
                <span className="text-xs font-bold text-gray-600">送信対象件数</span>
                <span className="text-lg font-black text-green-700">{selectedItems.length} 件</span>
              </div>

              <div className="rounded-xl border border-gray-200 p-3">
                <div className="text-xs font-bold text-gray-600 mb-2">対象の一部（最大3件）</div>
                <ul className="space-y-1 max-h-28 overflow-y-auto">
                  {selectedItems.slice(0, 3).map((item) => (
                    <li key={item.id} className="text-xs text-gray-700 flex flex-wrap gap-x-2">
                      <span className="text-gray-400">{item.date} / {categoryLabelMap[item.category]}</span>
                      <span className="font-semibold">{item.customerName}</span>
                      {item.carName && <span className="text-gray-500">({item.carName})</span>}
                    </li>
                  ))}
                  {selectedItems.length === 0 && <li className="text-xs text-gray-400">送信対象が選択されていません。</li>}
                </ul>
              </div>

              <div className="rounded-xl border border-gray-200 p-3">
                <div className="text-xs font-bold text-gray-600 mb-1.5">メッセージ内容（1件目）</div>
                <pre className="text-xs bg-gray-50 rounded-lg p-2.5 whitespace-pre-wrap text-gray-800 max-h-32 overflow-y-auto">
                  {selectedItems[0]?.messageText || 'メッセージ内容を取得できませんでした。'}
                </pre>
              </div>

              <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-2.5 border border-green-200">
                <span className="text-xs text-gray-600">カウントダウンが0秒になると送信を開始します。</span>
                <span className="text-2xl font-black text-green-700 tabular-nums">
                  {isCounting ? `${countdown}s` : '—'}
                </span>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setSendConfirmOpen(false); setIsCounting(false); setCountdown(10); }}
                className="px-4 py-2 rounded-xl border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 font-bold transition"
                disabled={sending}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => { if (!isCounting) { setCountdown(10); setIsCounting(true); } }}
                disabled={sending || selectedItems.length === 0}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isCounting ? `${countdown} 秒後に送信します` : '10秒カウントダウンを開始'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 詳細モーダル */}
      {detailItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 p-5">
            <h3 className="text-base font-extrabold text-gray-900 mb-1">👤 顧客・車両の詳細</h3>
            <p className="text-xs text-gray-500 mb-4">
              詳しい情報は「顧客一覧」「車両一覧」から確認できます。
            </p>

            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-[10px] font-bold text-gray-500 mb-0.5">リマインド日付</div>
                  <div className="font-semibold text-gray-900">{detailItem.date}</div>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-[10px] font-bold text-gray-500 mb-0.5">種別</div>
                  <div className="font-semibold text-gray-900">{categoryLabelMap[detailItem.category]}</div>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 px-3 py-2">
                <div className="text-[10px] font-bold text-gray-500 mb-0.5">顧客名</div>
                <div className="font-semibold text-gray-900">{detailItem.customerName || '-'}</div>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-2">
                <div className="text-[10px] font-bold text-gray-500 mb-0.5">住所</div>
                <div className="text-gray-800 whitespace-pre-line">{detailItem.customerAddress || '-'}</div>
              </div>

              <div className="rounded-xl bg-gray-50 px-3 py-2">
                <div className="text-[10px] font-bold text-gray-500 mb-0.5">連絡先（電話）</div>
                <div className="text-gray-800">{detailItem.customerPhone || '-'}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-[10px] font-bold text-gray-500 mb-0.5">車両名</div>
                  <div className="text-gray-800">{detailItem.carName || '-'}</div>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-[10px] font-bold text-gray-500 mb-0.5">ナンバー</div>
                  <div className="text-gray-800">{detailItem.plateNumber || '-'}</div>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-[10px] font-bold text-gray-500 mb-0.5">車検日</div>
                  <div className="text-gray-800">{formatDateLabel(detailItem.shakenDate)}</div>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-[10px] font-bold text-gray-500 mb-0.5">点検日</div>
                  <div className="text-gray-800">{formatDateLabel(detailItem.inspectionDate)}</div>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 px-3 py-2">
                <div className="text-[10px] font-bold text-gray-500 mb-0.5">状態</div>
                <div>
                  {detailItem.sent ? (
                    <span className="text-xs font-bold text-emerald-700">✅ 送信済み</span>
                  ) : (
                    <span className="text-xs font-bold text-blue-700">📤 未送信</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition"
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
