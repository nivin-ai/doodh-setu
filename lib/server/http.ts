import { NextResponse } from 'next/server';
import { DbError } from './db';

// Consistent JSON errors for route handlers. Database messages are not passed to the browser.
export async function handle<T>(fn: () => Promise<T>) {
  try {
    return NextResponse.json(await fn(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof DbError) return NextResponse.json({ error: e.message }, { status: e.status });
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api]', msg);
    // row-level security and trigger refusals surface as permission errors
    if (/row-level security|not allowed|maker-checker|permission denied/i.test(msg)) return NextResponse.json({ error: 'Not allowed for this account' }, { status: 403 });
    return NextResponse.json({ error: 'Something went wrong on the server' }, { status: 500 });
  }
}
export const body = async (req: Request) => (await req.json().catch(() => ({}))) as Record<string, unknown>;
