import type { NextRequest } from 'next/server';
import { staffScope, staffSession } from '@/lib/server/auth';
import { body, handle } from '@/lib/server/http';
import { getSocietyFinance, isAuthorisedSignatory, societyFinanceAction } from '@/lib/server/services/dairyfin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The society's finance desk. Submitting needs the demo authorisation of the signed-in representative.
async function who(req: NextRequest) {
  const scope = await staffScope(req, 'society');
  const s = await staffSession(req);
  return { scope, signatory: { name: s!.n, authorised: await isAuthorisedSignatory(s!.u) } };
}
export const GET = (req: NextRequest) => handle(async () => { const w = await who(req); return getSocietyFinance(w.scope, w.signatory, req.nextUrl.searchParams.get('asOf') ?? ''); });
export const POST = (req: NextRequest) => handle(async () => { const w = await who(req); return societyFinanceAction(w.scope, w.signatory.authorised, await body(req)); });
