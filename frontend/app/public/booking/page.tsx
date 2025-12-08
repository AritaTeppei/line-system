import PublicBookingForm from './PublicBookingForm';

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

function toSingle(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

// ★ async を付ける
export default async function PublicBookingPage({
  searchParams,
}: {
  // ★ searchParams は Promise として受け取る
  searchParams: Promise<SearchParams>;
}) {
  // ★ ここで一回 unwrap
  const sp = await searchParams;

  const tenantIdParam = toSingle(sp.tenantId);
  const customerIdParam = toSingle(sp.customerId);
  const carIdParam = toSingle(sp.carId);
  const dateParam = toSingle(sp.date);

  return (
    <PublicBookingForm
      tenantIdParam={tenantIdParam}
      customerIdParam={customerIdParam}
      carIdParam={carIdParam}
      dateParam={dateParam}
    />
  );
}