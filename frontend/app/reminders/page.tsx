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
      <main className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
          <p className="font-semibold mb-2">エラー</p>
          <p className="text-sm mb-2 whitespace-pre-wrap">{pageError}</p>
          <button
            className="mt-2 px-3 py-1 border rounded text-sm bg-gray-100"
            onClick={reloadPreview}
          >
            再読み込み
          </button>
        </div>
      </main>
    );
  }

  return (
    <TenantLayout>
    <main className="min-h-screen flex flex-col items-center p-4 gap-6">
      <h1 className="text-2xl font-bold mt-4">リマインド候補プレビュー & 一括送信</h1>

      {me && (
        <div className="border rounded-md px-4 py-3 bg-gray-50 w-full max-w-4xl">
          <p>
            ログイン中: {me.name ?? me.email}（ロール: {me.role}）
          </p>
          <p className="text-xs text-gray-600 mt-1">
            dev@example.com（MANAGER）で、自テナントの候補と送信を確認する想定です。
          </p>
        </div>
      )}

      {/* 日付選択＆再取得 */}
      <section className="border rounded-md px-4 py-4 w-full max-w-4xl bg-white">
        <h2 className="font-semibold mb-3">対象日</h2>
        <div className="flex items-center gap-3">
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
          />
          <button
            className="px-3 py-1 border rounded text-sm bg-gray-100"
            onClick={reloadPreview}
          >
            この日付でプレビュー
          </button>
        </div>
        {preview && (
          <p className="text-xs text-gray-600 mt-2">
            サーバー側判定日: {formatDate(preview.date)}（tenantId:{' '}
            {preview.tenantId}）
          </p>
        )}
        {sendMessage && (
          <p className="text-xs text-green-700 mt-2 whitespace-pre-wrap">
            {sendMessage}
          </p>
        )}
        {sendError && (
          <p className="text-xs text-red-600 mt-2 whitespace-pre-wrap">
            {sendError}
          </p>
        )}
      </section>

      {/* 誕生日 */}
      <section className="border rounded-md px-4 py-4 w-full max-w-4xl bg-gray-50">
        <h2 className="font-semibold mb-3">誕生日対象（当日）</h2>

        <div className="mb-3">
          <label className="block text-xs text-gray-600 mb-1">
            送信メッセージ（全対象共通）
          </label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm h-24"
            value={birthdayMessage}
            onChange={(e) => setBirthdayMessage(e.target.value)}
          />
          <button
            className="mt-2 px-3 py-1 border rounded text-sm bg-gray-100 disabled:opacity-60"
            onClick={handleSendBirthday}
            disabled={sendingType === 'BIRTHDAY'}
          >
            {sendingType === 'BIRTHDAY'
              ? '送信中...'
              : '誕生日対象に一括送信（LINE連携ありのみ）'}
          </button>
        </div>

        {preview && preview.birthdayTargets.length === 0 && (
          <p className="text-sm text-gray-600">対象はありません。</p>
        )}
        <ul className="space-y-1">
          {preview?.birthdayTargets.map((t) => (
            <li
              key={`birthday-${t.customerId}`}
              className="text-sm border-b last:border-b-0 py-1"
            >
              <span className="font-semibold">{t.customerName}</span>
              {t.lineUid ? (
                <span className="text-xs text-green-700 ml-2">
                  （LINE連携あり）
                </span>
              ) : (
                <span className="text-xs text-red-500 ml-2">
                  （LINE未連携・送信対象外）
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* 車検2ヶ月前 */}
      <section className="border rounded-md px-4 py-4 w-full max-w-4xl bg-white">
        <h2 className="font-semibold mb-3">車検 2ヶ月前</h2>

        <div className="mb-3">
          <label className="block text-xs text-gray-600 mb-1">
            送信メッセージ（全対象共通）
          </label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm h-24"
            value={shaken2mMessage}
            onChange={(e) => setShaken2mMessage(e.target.value)}
          />
          <button
            className="mt-2 px-3 py-1 border rounded text-sm bg-gray-100 disabled:opacity-60"
            onClick={handleSendShaken2m}
            disabled={sendingType === 'SHAKEN_2M'}
          >
            {sendingType === 'SHAKEN_2M'
              ? '送信中...'
              : '車検２ヶ月前対象に一括送信（LINE連携ありのみ）'}
          </button>
        </div>

        {preview && preview.shakenTwoMonths.length === 0 && (
          <p className="text-sm text-gray-600">対象はありません。</p>
        )}
        <ul className="space-y-1">
          {preview?.shakenTwoMonths.map((t) => (
            <li
              key={`shaken2m-${t.carId}`}
              className="text-sm border-b last:border-b-0 py-1"
            >
              <div>
                <span className="font-semibold">
                  {t.carName}（{t.registrationNumber}）
                </span>
              </div>
              <div className="text-xs text-gray-600">
                顧客: {t.customerName}{' '}
                {t.lineUid ? (
                  <span className="text-green-700 ml-1">（LINE連携あり）</span>
                ) : (
                  <span className="text-red-500 ml-1">
                    （LINE未連携・送信対象外）
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 車検1週間前 */}
      <section className="border rounded-md px-4 py-4 w-full max-w-4xl bg-gray-50">
        <h2 className="font-semibold mb-3">車検 1週間前</h2>

        <div className="mb-3">
          <label className="block text-xs text-gray-600 mb-1">
            送信メッセージ（全対象共通）
          </label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm h-24"
            value={shaken1wMessage}
            onChange={(e) => setShaken1wMessage(e.target.value)}
          />
          <button
            className="mt-2 px-3 py-1 border rounded text-sm bg-gray-100 disabled:opacity-60"
            onClick={handleSendShaken1w}
            disabled={sendingType === 'SHAKEN_1W'}
          >
            {sendingType === 'SHAKEN_1W'
              ? '送信中...'
              : '車検１週間前対象に一括送信（LINE連携ありのみ）'}
          </button>
        </div>

        {preview && preview.shakenOneWeek.length === 0 && (
          <p className="text-sm text-gray-600">対象はありません。</p>
        )}
        <ul className="space-y-1">
          {preview?.shakenOneWeek.map((t) => (
            <li
              key={`shaken1w-${t.carId}`}
              className="text-sm border-b last:border-b-0 py-1"
            >
              <div>
                <span className="font-semibold">
                  {t.carName}（{t.registrationNumber}）
                </span>
              </div>
              <div className="text-xs text-gray-600">
                顧客: {t.customerName}{' '}
                {t.lineUid ? (
                  <span className="text-green-700 ml-1">（LINE連携あり）</span>
                ) : (
                  <span className="text-red-500 ml-1">
                    （LINE未連携・送信対象外）
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 点検1ヶ月前 */}
      <section className="border rounded-md px-4 py-4 w-full max-w-4xl bg-white">
        <h2 className="font-semibold mb-3">点検 1ヶ月前</h2>

        <div className="mb-3">
          <label className="block text-xs text-gray-600 mb-1">
            送信メッセージ（全対象共通）
          </label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm h-24"
            value={inspection1mMessage}
            onChange={(e) => setInspection1mMessage(e.target.value)}
          />
          <button
            className="mt-2 px-3 py-1 border rounded text-sm bg-gray-100 disabled:opacity-60"
            onClick={handleSendInspection1m}
            disabled={sendingType === 'INSPECTION_1M'}
          >
            {sendingType === 'INSPECTION_1M'
              ? '送信中...'
              : '点検１ヶ月前対象に一括送信（LINE連携ありのみ）'}
          </button>
        </div>

        {preview && preview.inspectionOneMonth.length === 0 && (
          <p className="text-sm text-gray-600">対象はありません。</p>
        )}
        <ul className="space-y-1">
          {preview?.inspectionOneMonth.map((t) => (
            <li
              key={`insp1m-${t.carId}`}
              className="text-sm border-b last:border-b-0 py-1"
            >
              <div>
                <span className="font-semibold">
                  {t.carName}（{t.registrationNumber}）
                </span>
              </div>
              <div className="text-xs text-gray-600">
                顧客: {t.customerName}{' '}
                {t.lineUid ? (
                  <span className="text-green-700 ml-1">（LINE連携あり）</span>
                ) : (
                  <span className="text-red-500 ml-1">
                    （LINE未連携・送信対象外）
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 任意日付 */}
      <section className="border rounded-md px-4 py-4 w-full max-w-4xl bg-gray-50">
        <h2 className="font-semibold mb-3">任意日付（custom）</h2>

        <div className="mb-3">
          <label className="block text-xs text-gray-600 mb-1">
            送信メッセージ（全対象共通）
          </label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm h-24"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
          />
          <button
            className="mt-2 px-3 py-1 border rounded text-sm bg-gray-100 disabled:opacity-60"
            onClick={handleSendCustom}
            disabled={sendingType === 'CUSTOM'}
          >
            {sendingType === 'CUSTOM'
              ? '送信中...'
              : '任意日付対象に一括送信（LINE連携ありのみ）'}
          </button>
        </div>

        {preview && preview.custom.length === 0 && (
          <p className="text-sm text-gray-600">対象はありません。</p>
        )}
        <ul className="space-y-1">
          {preview?.custom.map((t) => (
            <li
              key={`custom-${t.carId}`}
              className="text-sm border-b last:border-b-0 py-1"
            >
              <div>
                <span className="font-semibold">
                  {t.carName}（{t.registrationNumber}）
                </span>
              </div>
              <div className="text-xs text-gray-600">
                顧客: {t.customerName}{' '}
                {t.lineUid ? (
                  <span className="text-green-700 ml-1">（LINE連携あり）</span>
                ) : (
                  <span className="text-red-500 ml-1">
                    （LINE未連携・送信対象外）
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                任意日付まで {t.daysBefore ?? 0} 日前のタイミング
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
    </TenantLayout>
  );
}
