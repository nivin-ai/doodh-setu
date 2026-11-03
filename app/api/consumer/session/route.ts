import { NextResponse } from 'next/server';
import { asSystem } from '@/lib/server/db';
import { CONSUMER_COOKIE, sign } from '@/lib/session';

export const runtime = 'nodejs';

// PROTOTYPE: opens the simulated wallet as the demo consumer. A real app would sign the consumer in
// with a verified mobile number; no payment credentials are ever collected here.
export async function POST() {
  const c = (await asSystem((tx) => tx.query<{ id: string; n: string }>(`select consumer_id::text id, display_name n from consumers where is_synthetic order by created_at limit 1`)))[0];
  if (!c) return NextResponse.json({ error: 'Demo consumer not found. Seed the database first.' }, { status: 404 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CONSUMER_COOKIE, await sign({ u: c.id, n: c.n, r: 'consumer', k: c.id }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 });
  return res;
}
