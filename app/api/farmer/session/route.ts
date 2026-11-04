import { NextResponse } from 'next/server';
import { asSystem } from '@/lib/server/db';
import { FARMER_COOKIE, MAX_AGE, sign } from '@/lib/session';

export const runtime = 'nodejs';
// Allows time to switch to the local demo database if Supabase cannot be reached (lib/server/db.ts)
export const maxDuration = 60;


// PROTOTYPE: registers this browser as the demo farmer's phone (member 0412 of the demo society).
// A real app would verify the member's mobile number with a one-time code before issuing this.
export async function POST() {
  const f = (await asSystem((tx) => tx.query<{ id: string; n: string }>(`select f.farmer_id::text id, coalesce(f.display_name, f.first_name) n from farmers f
    join societies s on s.society_id = f.society_id where f.is_synthetic and s.code = 'S001' and f.farmer_code = '0412'`)))[0];
  if (!f) return NextResponse.json({ error: 'Demo farmer not found. Seed the database first.' }, { status: 404 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(FARMER_COOKIE, await sign({ u: f.id, n: f.n, r: 'farmer', f: f.id }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  void MAX_AGE;
  return res;
}
