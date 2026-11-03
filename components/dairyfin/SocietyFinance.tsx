'use client';
// Society finance desk: loans for chilling, testing and working capital, applied for by the
// society's authorised representative with the society's own consent.
import { useResource } from '@/lib/client/api';
import type { SocietyFinanceData } from '@/lib/types/api';
import { ErrorState, Loading } from '../DataState';
import { PageTitle } from '../ui';
import Workspace from './Workspace';

export default function SocietyFinance({ asOf }: { asOf: string }) {
  const r = useResource<SocietyFinanceData>(`/api/dairyfin/society?asOf=${asOf}`, { poll: 8000 });
  return (
    <div className="max-w-[920px]">
      <PageTitle title="Finance" sub="Apply for the society's own finance. Applications go to the lender you choose; the lender decides. Members' applications are private to them and are not shown here." />
      {!r.data ? (r.error ? <ErrorState error={r.error} onRetry={r.refresh} /> : <Loading label="Loading finance..." />)
        : <Workspace data={{ ...r.data, kind: 'society' }} url="/api/dairyfin/society" refresh={r.refresh} />}
    </div>
  );
}
