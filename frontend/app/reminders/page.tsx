'use client';

import { useEffect, useState } from 'react';
import TenantLayout from "../components/TenantLayout";


type Me = {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role: 'DEVELOPER' | 'MANAGER' | 'CLIENT';
};

type BirthdayTarget = {
  kind: 'BIRTHDAY';
  customerId: number;
  customerName: string;
  lineUid?: string | null;
};

type CarTargetKind = 'SHAKEN_2M' | 'SHAKEN_1W' | 'INSPECTION_1M' | 'CUSTOM';

type CarTarget = {
  kind: CarTargetKind;
  carId: number;
  carName: string;
  registrationNumber: string;
  customerId: number;
  customerName: string;
  lineUid?: string | null;
  daysBefore?: number | null;
};

type PreviewResponse = {
  date: string;
  tenantId: number;
  birthdayTargets: BirthdayTarget[];
  shakenTwoMonths: CarTarget[];
  shakenOneWeek: CarTarget[];
  inspectionOneMonth: CarTarget[];
  custom: CarTarget[];
};

export default function RemindersPage() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [dateStr, setDateStr] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // 各カテゴリごとのテンプレ文面と状態
  const [birthdayMessage, setBirthdayMessage] = useState(
    'お世話になっております。\n〇〇自動車です。\n\n本日はお客様のお誕生日月となりましたので、日頃の感謝を込めてご挨拶申し上げます。\nまたお車のことで気になる点がございましたら、お気軽にご相談ください。',
  );
  const [shaken2mMessage, setShaken2mMessage] = useState(
    'お世話になっております。\n〇〇自動車です。\n\nお客様のお車の車検満了日が約２ヶ月後となりました。\n車検のご予約を承っておりますので、ご希望の日程がございましたらLINEでご返信ください。',
  );
  const [shaken1wMessage, setShaken1wMessage] = useState(
    'お世話になっております。\n〇〇自動車です。\n\nお客様のお車の車検満了日が１週間後に迫っております。\nまだご予約がお済みでない場合は、お早めのご連絡をお願いいたします。',
  );
  const [inspection1mMessage, setInspection1mMessage] = useState(
    'お世話になっております。\n〇〇自動車です。\n\nお客様のお車の点検予定日が１ヶ月後となりました。\n安全にお乗りいただくためにも、この機会に点検のご予約をご検討ください。',
  );
  const [customMessage, setCustomMessage] = useState(
    'お世話になっております。\n〇〇自動車です。\n\n以前ご案内しておりました日程が近づいてまいりましたので、ご連絡いたしました。\n内容につきましてご不明点がございましたら、お気軽にお問い合わせください。',
  );

  // 送信ボタンの状態
  const [sendingType, setSendingType] = useState<
    null | 'BIRTHDAY' | 'SHAKEN_2M' | 'SHAKEN_1W' | 'INSPECTION_1M' | 'CUSTOM'
  >(null);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const formatDate = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('ja-JP');
  };

  // 初回ロード
  useEffect(() => {
    const savedToken =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('auth_token')
        : null;

    if (!savedToken) {
      setPageError('先にログインしてください（トップページからログイン）');
      setLoading(false);
      return;
    }

    setToken(savedToken);

    const fetchMe = fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('auth me error');
        return res.json();
      })
      .then((data: Me) => {
        setMe(data);
      });

    const fetchPreview = fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/reminders/preview?date=${encodeURIComponent(
        dateStr,
      )}`,
      {
        headers: { Authorization: `Bearer ${savedToken}` },
      },
    )
      .then((res) => {
        if (!res.ok) throw new Error('preview api error');
        return res.json();
      })
      .then((data: PreviewResponse) => {
        setPreview(data);
      });

    Promise.all([fetchMe, fetchPreview])
      .catch((err) => {
        console.error(err);
        setPageError('リマインド候補の取得に失敗しました');
      })
      .finally(() => setLoading(false));
  }, []);

  const reloadPreview = async () => {
    if (!token) return;
    setLoading(true);
    setPageError(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reminders/preview?date=${encodeURIComponent(
          dateStr,
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        throw new Error('preview api error');
      }
      const data: PreviewResponse = await res.json();
      setPreview(data);
    } catch (err) {
      console.error(err);
      setPageError('リマインド候補の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 共通：送信処理
  const postToCustomers = async (customerIds: number[], message: string) => {
    if (!token) throw new Error('トークンがありません。再ログインしてください。');

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/messages/send-to-customers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ customerIds, message }),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const msg =
        data?.message ||
        (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
        'メッセージの送信に失敗しました';
      throw new Error(msg);
    }
    return res.json();
  };

  const postToCars = async (carIds: number[], message: string) => {
    if (!token) throw new Error('トークンがありません。再ログインしてください。');

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/send-to-cars`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ carIds, message }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const msg =
        data?.message ||
        (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
        'メッセージの送信に失敗しました';
      throw new Error(msg);
    }
    return res.json();
  };

  // 各カテゴリごとの送信関数
  const handleSendBirthday = async () => {
    if (!preview) return;
    setSendingType('BIRTHDAY');
    setSendMessage(null);
    setSendError(null);

    try {
      const targets = preview.birthdayTargets.filter((t) => t.lineUid);
      if (targets.length === 0) {
        throw new Error('LINE連携済みの対象がありません。');
      }
      const ids = targets.map((t) => t.customerId);
      const result = await postToCustomers(ids, birthdayMessage);
      setSendMessage(
        `誕生日メッセージを送信しました（${result.sentCount}件 / 対象 ${result.targetCount}件）`,
      );
    } catch (err: any) {
      console.error(err);
      setSendError(err.message ?? '誕生日メッセージの送信に失敗しました');
    } finally {
      setSendingType(null);
    }
  };

  const handleSendShaken2m = async () => {
    if (!preview) return;
    setSendingType('SHAKEN_2M');
    setSendMessage(null);
    setSendError(null);

    try {
      const targets = preview.shakenTwoMonths.filter((t) => t.lineUid);
      if (targets.length === 0) {
        throw new Error('LINE連携済みの対象がありません。');
      }
      const ids = targets.map((t) => t.carId);
      const result = await postToCars(ids, shaken2mMessage);
      setSendMessage(
        `車検２ヶ月前メッセージを送信しました（${result.sentCount}件 / 対象 ${result.targetCount}件）`,
      );
    } catch (err: any) {
      console.error(err);
      setSendError(err.message ?? '車検２ヶ月前メッセージの送信に失敗しました');
    } finally {
      setSendingType(null);
    }
  };

  const handleSendShaken1w = async () => {
    if (!preview) return;
    setSendingType('SHAKEN_1W');
    setSendMessage(null);
    setSendError(null);

    try {
      const targets = preview.shakenOneWeek.filter((t) => t.lineUid);
      if (targets.length === 0) {
        throw new Error('LINE連携済みの対象がありません。');
      }
      const ids = targets.map((t) => t.carId);
      const result = await postToCars(ids, shaken1wMessage);
      setSendMessage(
        `車検１週間前メッセージを送信しました（${result.sentCount}件 / 対象 ${result.targetCount}件）`,
      );
    } catch (err: any) {
      console.error(err);
      setSendError(err.message ?? '車検１週間前メッセージの送信に失敗しました');
    } finally {
      setSendingType(null);
    }
  };

  const handleSendInspection1m = async () => {
    if (!preview) return;
    setSendingType('INSPECTION_1M');
    setSendMessage(null);
    setSendError(null);

    try {
      const targets = preview.inspectionOneMonth.filter((t) => t.lineUid);
      if (targets.length === 0) {
        throw new Error('LINE連携済みの対象がありません。');
      }
      const ids = targets.map((t) => t.carId);
      const result = await postToCars(ids, inspection1mMessage);
      setSendMessage(
        `点検１ヶ月前メッセージを送信しました（${result.sentCount}件 / 対象 ${result.targetCount}件）`,
      );
    } catch (err: any) {
      console.error(err);
      setSendError(err.message ?? '点検１ヶ月前メッセージの送信に失敗しました');
    } finally {
      setSendingType(null);
    }
  };

  const handleSendCustom = async () => {
    if (!preview) return;
    setSendingType('CUSTOM');
    setSendMessage(null);
    setSendError(null);

    try {
      const targets = preview.custom.filter((t) => t.lineUid);
      if (targets.length === 0) {
        throw new Error('LINE連携済みの対象がありません。');
      }
      const ids = targets.map((t) => t.carId);
      const result = await postToCars(ids, customMessage);
      setSendMessage(
        `任意日付メッセージを送信しました（${result.sentCount}件 / 対象 ${result.targetCount}件）`,
      );
    } catch (err: any) {
      console.error(err);
      setSendError(err.message ?? '任意日付メッセージの送信に失敗しました');
    } finally {
      setSendingType(null);
    }
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="text-sm text-gray-800">読み込み中...</div>
      </TenantLayout>
    );
  }

  if (pageError) {
    return (
      <TenantLayout>
        <div className="max-w-3xl mx-auto mt-8">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-bold mb-1">エラー</p>
            <p className="whitespace-pre-wrap">{pageError}</p>
            <button
              className="mt-3 px-4 py-1.5 rounded-xl border border-red-300 bg-white text-red-700 text-xs font-bold hover:bg-red-50 transition"
              onClick={reloadPreview}
            >
              再読み込み
            </button>
          </div>
        </div>
      </TenantLayout>
    );
  }

  // カードメタ情報
  const reminderCards: {
    key: 'birthday' | 'shaken2m' | 'shaken1w' | 'inspection1m' | 'custom';
    icon: string;
    label: string;
    timing: string;
    color: string;
    border: string;
    badge: string;
    sendingKey: typeof sendingType;
    message: string;
    setMessage: (v: string) => void;
    onSend: () => void;
    targets: { id: string; name: string; sub?: string; lineUid?: string | null; extra?: string }[];
  }[] = [
    {
      key: 'birthday',
      icon: '🎂',
      label: '誕生日メッセージ',
      timing: '誕生日当日',
      color: 'from-rose-50 to-pink-50',
      border: 'border-rose-200',
      badge: 'bg-rose-100 text-rose-700',
      sendingKey: 'BIRTHDAY',
      message: birthdayMessage,
      setMessage: setBirthdayMessage,
      onSend: handleSendBirthday,
      targets: (preview?.birthdayTargets ?? []).map((t) => ({
        id: `birthday-${t.customerId}`,
        name: t.customerName,
        lineUid: t.lineUid,
      })),
    },
    {
      key: 'shaken2m',
      icon: '🔧',
      label: '車検 2ヶ月前',
      timing: '車検満了の約60日前',
      color: 'from-blue-50 to-sky-50',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-700',
      sendingKey: 'SHAKEN_2M',
      message: shaken2mMessage,
      setMessage: setShaken2mMessage,
      onSend: handleSendShaken2m,
      targets: (preview?.shakenTwoMonths ?? []).map((t) => ({
        id: `shaken2m-${t.carId}`,
        name: `${t.carName}（${t.registrationNumber}）`,
        sub: `顧客: ${t.customerName}`,
        lineUid: t.lineUid,
      })),
    },
    {
      key: 'shaken1w',
      icon: '⚠️',
      label: '車検 1週間前',
      timing: '車検満了の7日前',
      color: 'from-orange-50 to-amber-50',
      border: 'border-orange-200',
      badge: 'bg-orange-100 text-orange-700',
      sendingKey: 'SHAKEN_1W',
      message: shaken1wMessage,
      setMessage: setShaken1wMessage,
      onSend: handleSendShaken1w,
      targets: (preview?.shakenOneWeek ?? []).map((t) => ({
        id: `shaken1w-${t.carId}`,
        name: `${t.carName}（${t.registrationNumber}）`,
        sub: `顧客: ${t.customerName}`,
        lineUid: t.lineUid,
      })),
    },
    {
      key: 'inspection1m',
      icon: '🔩',
      label: '点検 1ヶ月前',
      timing: '点検予定日の30日前',
      color: 'from-purple-50 to-violet-50',
      border: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-700',
      sendingKey: 'INSPECTION_1M',
      message: inspection1mMessage,
      setMessage: setInspection1mMessage,
      onSend: handleSendInspection1m,
      targets: (preview?.inspectionOneMonth ?? []).map((t) => ({
        id: `insp1m-${t.carId}`,
        name: `${t.carName}（${t.registrationNumber}）`,
        sub: `顧客: ${t.customerName}`,
        lineUid: t.lineUid,
      })),
    },
    {
      key: 'custom',
      icon: '📅',
      label: '任意日付メッセージ',
      timing: '任意に設定した日付の指定日前',
      color: 'from-gray-50 to-slate-50',
      border: 'border-gray-200',
      badge: 'bg-gray-100 text-gray-600',
      sendingKey: 'CUSTOM',
      message: customMessage,
      setMessage: setCustomMessage,
      onSend: handleSendCustom,
      targets: (preview?.custom ?? []).map((t) => ({
        id: `custom-${t.carId}`,
        name: `${t.carName}（${t.registrationNumber}）`,
        sub: `顧客: ${t.customerName}`,
        lineUid: t.lineUid,
        extra: t.daysBefore != null ? `${t.daysBefore}日前のタイミング` : undefined,
      })),
    },
  ];

  return (
    <TenantLayout>
      <div className="max-w-3xl mx-auto space-y-5 pb-12">

        {/* ── ページヘッダー ── */}
        <div>
          <h1 className="text-2xl font-extrabold text-green-700 flex items-center gap-2">
            🔔 リマインド管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            指定した日付のリマインド対象をプレビューし、LINE一括送信ができます。
          </p>
        </div>

        {/* 日付選択カード */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">🗓️ 対象日を選択</h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
            <button
              className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition shadow-sm"
              onClick={reloadPreview}
            >
              この日付でプレビュー
            </button>
            {preview && (
              <span className="text-xs text-gray-500">
                判定日: {formatDate(preview.date)}
              </span>
            )}
          </div>

          {sendMessage && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 font-semibold">
              ✅ {sendMessage}
            </div>
          )}
          {sendError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
              ❌ {sendError}
            </div>
          )}
        </section>

        {/* リマインドカード一覧 */}
        <div className="space-y-4">
          {reminderCards.map((card) => {
            const isSending = sendingType === card.sendingKey;
            const lineEnabledCount = card.targets.filter((t) => t.lineUid).length;

            return (
              <section
                key={card.key}
                className={`rounded-2xl border shadow-sm overflow-hidden ${card.border}`}
              >
                {/* カードヘッダー */}
                <div className={`bg-gradient-to-r ${card.color} px-5 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{card.icon}</span>
                    <h2 className="text-sm font-bold text-gray-800">{card.label}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${card.badge}`}>
                      {card.timing}
                    </span>
                    <span className="text-xs font-bold text-gray-700 bg-white/70 border border-gray-200 rounded-full px-2.5 py-1">
                      対象 {card.targets.length}件
                      {lineEnabledCount > 0 && (
                        <span className="text-green-700 ml-1">（LINE {lineEnabledCount}件）</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="bg-white px-5 pt-4 pb-3 space-y-3">
                  {/* メッセージ入力 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      送信メッセージ（全対象共通）
                    </label>
                    <textarea
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition"
                      value={card.message}
                      onChange={(e) => card.setMessage(e.target.value)}
                    />
                  </div>

                  {/* 対象リスト */}
                  {card.targets.length === 0 ? (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-3">この日付の対象はありません。</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                      {card.targets.map((t) => (
                        <li key={t.id} className="flex items-start justify-between gap-2 text-sm rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                          <div>
                            <span className="font-semibold text-gray-800">{t.name}</span>
                            {t.sub && <span className="text-xs text-gray-500 ml-2">{t.sub}</span>}
                            {t.extra && <span className="text-xs text-gray-400 ml-2">({t.extra})</span>}
                          </div>
                          {t.lineUid ? (
                            <span className="flex-shrink-0 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">LINE✓</span>
                          ) : (
                            <span className="flex-shrink-0 text-xs text-red-500 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">未連携</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 送信フッター */}
                <div className="bg-gray-50 border-t border-gray-100 px-5 py-3 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={card.onSend}
                    disabled={isSending || lineEnabledCount === 0}
                    className="px-5 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                  >
                    {isSending ? '⏳ 送信中...' : `📤 LINE連携済み ${lineEnabledCount}件に一括送信`}
                  </button>
                </div>
              </section>
            );
          })}
        </div>

      </div>
    </TenantLayout>
  );
}
