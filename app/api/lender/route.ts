import type { NextRequest } from 'next/server';
import { staffScope } from '@/lib/server/auth';
import { body, handle } from '@/lib/server/http';
import { getLenderCase, getLenderData, lenderAction } from '@/lib/server/services/lender';

export const runtime = 'nodejs';
// Allows time to switch to the local demo database if Supabase cannot be reached (lib/server/db.ts)
export const maxDuration = 60;

export const dynamic = 'force-dynamic';

export const GET = (req: NextRequest) => handle(async () => {
  const q = req.nextUrl.searchParams;
  const scope = await staffScope(req, 'lender');
  const id = q.get('case');
  return id ? getLenderCase(scope, id, q.get('asOf') ?? new Date().toISOString().slice(0, 10), { dossier: q.get('dossier') === '1' }) : getLenderData(scope);
});
export const POST = (req: NextRequest) => handle(async () => lenderAction(await staffScope(req, 'lender'), await body(req)));
