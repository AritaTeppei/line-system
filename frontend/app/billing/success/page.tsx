// frontend/app/billing/success/page.tsx

type BillingSuccessPageProps = {
  searchParams: {
    [key: string]: string | string[] | undefined;
  };
};

export default function BillingSuccessPage({ searchParams }: BillingSuccessPageProps) {
  // URL例: /billing/success?session_id=xxx&redirect_status=succeeded などを想定
  const sessionIdParam = searchParams["session_id"];
  const sessionId = Array.isArray(sessionIdParam) ? sessionIdParam[0] : sessionIdParam ?? "";

  const statusParam = searchParams["redirect_status"];
  const status = Array.isArray(statusParam) ? statusParam[0] : statusParam ?? "succeeded";

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">決済が完了しました</h1>

        <p className="text-sm text-gray-700 mb-4">
          ご契約ありがとうございます。サブスク契約の処理が正常に完了しました。
        </p>

        {sessionId && (
          <p className="text-xs text-gray-500 mb-4">
            セッションID: <span className="font-mono break-all">{sessionId}</span>
          </p>
        )}

        <p className="text-sm text-gray-700 mb-6">
          ステータス:{" "}
          <span className="font-medium">
            {status === "succeeded" ? "成功" : status}
          </span>
        </p>

        <a
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          ダッシュボードへ戻る
        </a>
      </div>
    </div>
  );
}
