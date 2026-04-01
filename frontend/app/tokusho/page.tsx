export default function TokushoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900">特定商取引法に基づく表記</h1>
          <p className="text-sm text-gray-500 mt-1">Act on Specified Commercial Transactions</p>
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <tbody>
              {[
                { label: '販売業者', value: '松本美香' },
                { label: '代表者名', value: '松本美香' },
                { label: '所在地', value: '〒815-0081　福岡県福岡市南区高木3-5-10-101' },
                { label: '電話番号', value: '0878858463', note: '※お問い合わせはメールにてお願いします。電話でのお問い合わせには対応しておりません。' },
                { label: 'メールアドレス', value: 'info@seibisystem.com' },
                { label: 'サービス名', value: 'PitLink（ピットリンク）' },
                {
                  label: '販売価格',
                  value: '・BASICプラン：¥9,800／月（税込）\n・STANDARDプラン：¥15,000／月（税込）\n・PROプラン：¥20,000／月（税込）',
                },
                { label: '支払方法', value: 'クレジットカード決済（Visa・Mastercard・American Express・JCB等）' },
                { label: '支払時期', value: 'ご契約開始時および毎月の更新日に自動引き落とし' },
                { label: 'サービス提供時期', value: '決済完了後、即時ご利用いただけます。' },
                {
                  label: '解約・返金について',
                  value: '解約はシステム管理画面より申請できます。解約申請月の翌月末までサービスをご利用いただけます。\n既にお支払いいただいた料金の返金は行っておりません。',
                },
                { label: '動作環境', value: 'Google Chrome・Safari・Microsoft Edge（最新版推奨）\nスマートフォン（iOS・Android）対応' },
                { label: '個人情報の取り扱い', value: '取得した個人情報はサービス提供・お問い合わせ対応の目的にのみ使用し、第三者への提供は行いません。' },
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <th className="text-left text-xs font-bold text-gray-600 bg-gray-50 px-5 py-4 w-36 align-top whitespace-nowrap">
                    {row.label}
                  </th>
                  <td className="text-gray-800 px-5 py-4 align-top">
                    <span className="whitespace-pre-line">{row.value}</span>
                    {row.note && (
                      <p className="text-xs text-gray-500 mt-1">{row.note}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">
          © {new Date().getFullYear()} PitLink. All rights reserved.
        </p>
      </div>
    </div>
  );
}
