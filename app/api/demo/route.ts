import { NextResponse } from 'next/server';
import { handle } from '@/lib/server/http';
import { demoState, resetAllowed, resetDemo } from '@/lib/server/services/demo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = () => handle(demoState);
// Resets what was done during a demo (synthetic records only). Disable with ALLOW_DEMO_RESET=false.
export async function POST() {
  if (!resetAllowed()) return NextResponse.json({ error: 'Demo reset is disabled' }, { status: 403 });
  return handle(async () => { await resetDemo(); return { ok: true }; });
}
