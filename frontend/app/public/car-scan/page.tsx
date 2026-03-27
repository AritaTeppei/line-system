'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function CarScanContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sid');

  const [status, setStatus] = useState<'idle' | 'scanning' | 'detected' | 'submitting' | 'done' | 'error'>('idle');
  const [rawData, setRawData] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCamera = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startScan = async () => {
    setErrorMsg(null);
    setStatus('scanning');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const jsQR = (await import('jsqr')).default;

      timerRef.current = setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          stopCamera();
          setRawData(code.data);
          setStatus('detected');
        }
      }, 300);
    } catch (e: any) {
      setStatus('error');
      setErrorMsg('カメラへのアクセスに失敗しました。ブラウザの設定でカメラを許可してください。');
    }
  };

  const submitData = async () => {
    if (!sessionId || !rawData) return;
    setStatus('submitting');

    try {
      const res = await fetch(`${apiBase}/public/car-scan/${sessionId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawData }),
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
          <p className="text-sm text-red-700">このリンクは無効です。車両登録画面のQRコードをスマホで読み取ってください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-green-600 px-5 pt-10 pb-6 text-white">
        <div className="text-2xl font-black">📄 車検証QR読み取り</div>
        <p className="mt-1 text-sm text-green-100">車検証に印刷されているQRコードをカメラで読み取ってください</p>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4">

        {/* 完了 */}
        {status === 'done' && (
          <div className="rounded-2xl bg-white border border-green-200 p-5 text-center space-y-3">
            <div className="text-4xl">✅</div>
            <p className="font-bold text-gray-900">送信が完了しました</p>
            <p className="text-sm text-gray-600">PC側の車両登録画面に自動で入力されます。このページは閉じていただいて構いません。</p>
          </div>
        )}

        {/* エラー */}
        {status === 'error' && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-5 space-y-3">
            <p className="text-sm text-red-700">{errorMsg}</p>
            <button
              onClick={() => { setStatus('idle'); setErrorMsg(null); }}
              className="w-full rounded-xl bg-green-600 text-white py-3 font-bold text-sm"
            >
              もう一度試す
            </button>
          </div>
        )}

        {/* 待機中 */}
        {status === 'idle' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <p className="text-sm text-gray-700 leading-relaxed">
                📋 <span className="font-bold">操作手順</span><br />
                1. 下のボタンでカメラを起動<br />
                2. 車検証下部のQRコードにカメラを向ける<br />
                3. 自動で読み取り・送信されます
              </p>
            </div>
            <button
              onClick={startScan}
              className="w-full rounded-2xl bg-green-600 hover:bg-green-700 text-white py-4 font-extrabold text-base shadow-md"
            >
              📷 カメラを起動してスキャン
            </button>
          </div>
        )}

        {/* スキャン中 */}
        {status === 'scanning' && (
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden bg-black aspect-video relative">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* ターゲット枠 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-4 border-green-400 rounded-2xl opacity-80" />
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-sm text-gray-300 text-center animate-pulse">QRコードを枠内に合わせてください…</p>
            <button
              onClick={() => { stopCamera(); setStatus('idle'); }}
              className="w-full rounded-xl border border-gray-500 text-gray-300 py-3 text-sm"
            >
              キャンセル
            </button>
          </div>
        )}

        {/* 検出済み */}
        {status === 'detected' && rawData && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white border border-green-200 p-5">
              <p className="text-sm font-bold text-green-700 mb-2">✅ QRコードを読み取りました</p>
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 max-h-32 overflow-y-auto">
                <p className="text-xs text-gray-600 break-all font-mono">{rawData}</p>
              </div>
            </div>
            <button
              onClick={submitData}
              className="w-full rounded-2xl bg-green-600 text-white py-4 font-extrabold text-base shadow-md"
            >
              この内容をPCに送信する →
            </button>
            <button
              onClick={() => { setRawData(null); setStatus('idle'); }}
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
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-white text-sm">読み込み中...</p></div>}>
      <CarScanContent />
    </Suspense>
  );
}
