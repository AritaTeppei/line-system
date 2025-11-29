// frontend/app/bookings/page.tsx
import { Suspense } from 'react';
import BookingsPageClient from './BookingsPageClient';

export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-gray-700">
          予約カレンダーを読み込み中です...
        </div>
      }
    >
      <BookingsPageClient />
    </Suspense>
  );
}
