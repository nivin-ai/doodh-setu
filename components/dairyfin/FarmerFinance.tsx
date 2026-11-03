'use client';
// Farmer app finance screens, backed by /api/dairyfin/farmer (the farmer's own records only).
import { useResource } from '@/lib/client/api';
import type { FarmerFinanceData } from '@/lib/types/api';
import { ErrorState, Loading } from '../DataState';
import Workspace from './Workspace';

const registerDevice = () => fetch('/api/farmer/session', { method: 'POST' }).then(() => undefined);

export default function FarmerFinance({ asOf, start }: { asOf: string; start: 'home' | 'catalogue' | 'apps' | 'policies' }) {
  const r = useResource<FarmerFinanceData>(`/api/dairyfin/farmer?asOf=${asOf}`, { poll: 8000, before: registerDevice });
  if (!r.data) return r.error ? <ErrorState error={r.error} onRetry={r.refresh} /> : <Loading label="Loading finance..." />;
  return <Workspace data={{ ...r.data, kind: 'farmer' }} url="/api/dairyfin/farmer" refresh={r.refresh} start={start} />;
}
