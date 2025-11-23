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

type LogEntry = {
  id: number;
  tenantId: number;
  tenant?: {
    id: number;
    name: string | null;
  };
  customerId?: number | null;
  customer?: {
    id: number;
    lastName: string;
    firstName: string;
  } | null;
  carId?: number | null;
  car?: {
    id: number;
    registrationNumber: string;
    carName: string;
  } | null;
  lineUid?: string | null;
  messageType: string;
  content: string;
  createdAt: string;
};

export default function LogsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

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

    const fetchLogs = fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/logs`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('logs api error');
        return res.json();
      })
      .then((data: LogEntry[]) => {
        setLogs(data);
      });

    Promise.all([fetchMe, fetchLogs])
      .catch((err) => {
        console.error(err);
        setPageError('メッセージ履歴の取得に失敗しました');
      })
      .finally(() => setLoading(false));
  }, []);

  const formatDateTime = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('ja-JP');
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
          <p className="text-sm">{pageError}</p>
        </div>
      </main>
    );
  }

  return (
    <TenantLayout>
    <main className="min-h-screen flex flex-col items-center p-4 gap-6">
      <h1 className="text-2xl font-bold mt-4">メッセージ履歴</h1>

      {me && (
        <div className="border rounded-md px-4 py-3 bg-gray-50 w-full max-w-4xl">
          <p>
            ログイン中: {me.name ?? me.email}（ロール: {me.role}）
          </p>
          {me.role === 'DEVELOPER' ? (
            <p className="text-xs text-gray-600 mt-1">
              開発者権限のため、全テナントの履歴が表示されています。
            </p>
          ) : (
            <p className="text-xs text-gray-600 mt-1">
              自テナントのメッセージ履歴のみ表示しています。
            </p>
          )}
        </div>
      )}

      <section className="border rounded-md px-4 py-4 w-full max-w-4xl bg-white">
        <h2 className="font-semibold mb-3">直近の送信履歴</h2>
        {logs.length === 0 && (
          <p className="text-sm text-gray-600">まだ履歴がありません。</p>
        )}

        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className="border rounded-md px-3 py-2 text-sm bg-gray-50"
            >
              <div className="flex justify-between items-center">
                <div className="font-semibold text-xs text-gray-700">
                  {log.messageType}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDateTime(log.createdAt)}
                </div>
              </div>

              <div className="mt-1 text-xs text-gray-600">
                {log.tenant && (
                  <div>
                    テナント:{' '}
                    <span className="font-medium">
                      {log.tenant.name ?? `ID: ${log.tenantId}`}
                    </span>
                  </div>
                )}
                {log.customer && (
                  <div>
                    顧客:{' '}
                    <span className="font-medium">
                      {log.customer.lastName} {log.customer.firstName}
                    </span>
                  </div>
                )}
                {log.car && (
                  <div>
                    車両:{' '}
                    <span className="font-medium">
                      {log.car.carName}（{log.car.registrationNumber}）
                    </span>
                  </div>
                )}
                {log.lineUid && (
                  <div>LINE UID: {log.lineUid}</div>
                )}
              </div>

              <div className="mt-2 text-sm whitespace-pre-wrap bg-white border rounded px-2 py-1">
                {log.content}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
    </TenantLayout>
  );
}
