import type { NextRequest } from 'next/server';
import { staffScope } from '@/lib/server/auth';
import { body, handle } from '@/lib/server/http';
import { getPlannerDataset, getPlannerWorkflow, plannerAction } from '@/lib/server/services/planner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: NextRequest) => handle(async () => {
  const q = req.nextUrl.searchParams;
  const scope = await staffScope(req, 'planner', q.get('actingAs'));
  return q.get('view') === 'dataset' ? getPlannerDataset(scope, q.get('asOf') ?? '') : getPlannerWorkflow(scope);
});
export const POST = (req: NextRequest) => handle(async () => {
  const b = await body(req);
  return plannerAction(await staffScope(req, 'planner', b.actingAs as string), b);
});
