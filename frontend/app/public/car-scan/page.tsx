'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── CSV パーサー（cars/page.tsx と同じロジック） ──────────────────
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function normalizeStr(s: string) {
  return s
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[　]+/g, ' ')
    .trim();
}

type CsvCarData = { registrationNumber?: string; chassisNumber?: string; carName?: string; shakenDate?: string };

function parseCsvText(text: string): CsvCarData {
  const result: CsvCarData = {};
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return result;

  const headers = parseCsvLine(lines[0]);
  const values = parseCsvLine(lines[1]);
  const row: Record<string, string> = {};
  headers.forEach((h, i) => { row[h.trim()] = (values[i] ?? '').trim(); });

  // 国土交通省 車検証閲覧アプリ形式（英語列名）
  const regRaw = row['TwodimensionCodeInfoEntryNoCarNo'] || row['EntryNoCarNo'] || '';
  if (regRaw) result.registrationNumber = normalizeStr(regRaw);

  const chassisRaw = row['TwodimensionCodeInfoCarNo'] || row['CarNo'] || '';
  if (chassisRaw) result.chassisNumber = normalizeStr(chassisRaw);

  if (row['CarName']) result.carName = row['CarName'].trim();

  const expiryCode = row['TwodimensionCodeInfoValidPeriodExpirdate'] || '';
  if (/^\d{6}$/.test(expiryCode) && expiryCode !== '999999') {
    const yy = parseInt(expiryCode.slice(0, 2), 10);
    const mm = expiryCode.slice(2, 4);
    const dd = expiryCode.slice(4, 6);
    result.shakenDate = `${yy < 80 ? 2000 + yy : 1900 + yy}-${mm}-${dd}`;
  } else {
    const era = (row['ValidPeriodExpirdateE'] || '').trim();
    const eraY = parseInt((row['ValidPeriodExpirdateY'] || '0').trim(), 10);
    const m = (row['ValidPeriodExpirdateM'] || '').trim().padStart(2, '0');
    const d = (row['ValidPeriodExpirdateD'] || '').trim().padStart(2, '0');
    if (era && eraY > 0 && m !== '00' && d !== '00') {
      const offsets: Record<string, number> = { '令和': 2018, '平成': 1988, '昭和': 1925 };
      const off = offsets[era];
      if (off) result.shakenDate = `${off + eraY}-${m}-${d}`;
    }
  }

  // 汎用フォールバック（日本語列名）
  if (!result.registrationNumber) {
    for (const [k, v] of Object.entries(row)) {
      if (k.includes('登録番号') || k.includes('ナンバー') || k.includes('車両番号')) {
        result.registrationNumber = normalizeStr(v); break;
      }
    }
  }
  if (!result.chassisNumber) {
    for (const [k, v] of Object.entries(row)) {
      if (k.includes('車台番号')) { result.chassisNumber = normalizeStr(v); break; }
    }
  }
  if (!result.carName) {
    for (const [k, v] of Object.entries(row)) {
      if (k.includes('車名') && !k.includes('番号')) { result.carName = v.trim(); break; }
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────────────
function CarScanContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sid');

  const [status, setStatus] = useState<'idle' | 'preview' | 'submitting' | 'done' | 'error'>('idle');
  const [parsed, setParsed] = useState<CsvCarData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // セッション有効期限チェック（念のため10分でタイムアウト表示）
  useEffect(() => {
    if (!sessionId) return;
    const t = setTimeout(() => {
      if (status === 'idle') setErrorMsg('セッションの有効期限が切れた可能性があります。PC側で再度QRを表示してください。');
    }, 10 * 60 * 1000);
    return () => clearTimeout(t);
  }, [sessionId, status]);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
      } catch {
        text = new TextDecoder('shift_jis').decode(buffer);
      }
      const data = parseCsvText(text);
      if (!data.registrationNumber && !data.chassisNumber && !data.carName) {
        setErrorMsg('CSVから車両情報を取得できませんでした。車検証閲覧アプリのCSVか確認してください。');
        return;
      }
      setParsed(data);
      setStatus('preview');
    } catch {
      setErrorMsg('ファイルの読み込みに失敗しました。');
    }
  };

  const submitData = async () => {
    if (!sessionId || !parsed) return;
    setStatus('submitting');
    try {
      const res = await fetch(`${apiBase}/public/car-scan/${sessionId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawData: JSON.stringify(parsed) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.message ?? '送信に失敗しました');
      }
      setStatus('done');
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e.message ?? '送信中にエラーが発生しました');
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="rounded-2xl bg-white border border-red-200 p-6 max-w-sm w-full text-center">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-sm text-red-700">このリンクは無効です。PC側の車両登録画面でQRコードを表示してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-green-600 px-5 pt-10 pb-6 text-white">
        <div className="text-2xl font-black">📄 車両情報を取り込む</div>
        <p className="mt-1 text-sm text-green-100">車検証閲覧アプリのCSVをアップロードしてPCに送信</p>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4">

        {/* 完了 */}
        {status === 'done' && (
          <div className="rounded-2xl bg-white border border-green-200 p-5 text-center space-y-3">
            <div className="text-4xl">✅</div>
            <p className="font-bold text-gray-900">送信が完了しました</p>
            <p className="text-sm text-gray-600">PC側の車両登録フォームに自動で入力されます。このページは閉じていただいて構いません。</p>
          </div>
        )}

        {/* エラー */}
        {status === 'error' && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-5 space-y-3">
            <p className="text-sm text-red-700">{errorMsg}</p>
            <button
              onClick={() => { setStatus('idle'); setErrorMsg(null); setParsed(null); }}
              className="w-full rounded-xl bg-green-600 text-white py-3 font-bold text-sm"
            >
              もう一度試す
            </button>
          </div>
        )}

        {/* ファイル選択 */}
        {status === 'idle' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <p className="text-sm font-bold text-gray-800 mb-2">操作手順</p>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>「車検証閲覧アプリ」でCSVをダウンロード</li>
                <li>下のボタンからCSVを選択</li>
                <li>内容を確認してPCに送信</li>
              </ol>
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">{errorMsg}</p>
              </div>
            )}

            <label className="block">
              <span className="flex items-center justify-center w-full rounded-2xl bg-green-600 hover:bg-green-700 text-white py-4 font-extrabold text-base shadow-md cursor-pointer">
                📂 CSVファイルを選択
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ''; }}
              />
            </label>
          </div>
        )}

        {/* プレビュー確認 */}
        {status === 'preview' && parsed && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <p className="text-sm font-bold text-gray-800 mb-3">読み取った内容を確認</p>
              <dl className="space-y-2 text-sm">
                {parsed.registrationNumber && (
                  <div className="flex gap-2">
                    <dt className="text-gray-500 w-24 shrink-0">登録番号</dt>
                    <dd className="font-medium text-gray-900">{parsed.registrationNumber}</dd>
                  </div>
                )}
                {parsed.chassisNumber && (
                  <div className="flex gap-2">
                    <dt className="text-gray-500 w-24 shrink-0">車台番号</dt>
                    <dd className="font-medium text-gray-900">{parsed.chassisNumber}</dd>
                  </div>
                )}
                {parsed.carName && (
                  <div className="flex gap-2">
                    <dt className="text-gray-500 w-24 shrink-0">車名</dt>
                    <dd className="font-medium text-gray-900">{parsed.carName}</dd>
                  </div>
                )}
                {parsed.shakenDate && (
                  <div className="flex gap-2">
                    <dt className="text-gray-500 w-24 shrink-0">車検日</dt>
                    <dd className="font-medium text-gray-900">{parsed.shakenDate}</dd>
                  </div>
                )}
              </dl>
            </div>

            <button
              onClick={submitData}
              className="w-full rounded-2xl bg-green-600 text-white py-4 font-extrabold text-base shadow-md"
            >
              この内容をPCに送信する →
            </button>
            <button
              onClick={() => { setParsed(null); setStatus('idle'); }}
              className="w-full rounded-xl border border-gray-400 text-gray-600 py-3 text-sm bg-white"
            >
              やり直す
            </button>
          </div>
        )}

        {/* 送信中 */}
        {status === 'submitting' && (
          <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center">
            <div className="animate-spin text-3xl mb-3">⏳</div>
            <p className="text-sm text-gray-600">送信中...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CarScanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-sm">読み込み中...</p>
      </div>
    }>
      <CarScanContent />
    </Suspense>
  );
}
