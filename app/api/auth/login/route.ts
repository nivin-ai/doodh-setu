import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, HOME_FOR, MAX_AGE, sign } from '@/lib/session';
import { asSystem } from '@/lib/server/db';
import { findStaffUser } from '@/lib/server/repositories/users';

export const runtime = 'nodejs';
// Allows time to switch to the local demo database if Supabase cannot be reached (lib/server/db.ts)
export const maxDuration = 60;


// Staff sign-in against app_users (scrypt password hashes). The cookie carries the user's scope ids,
// which the server turns into the database scope for each request (lib/server/auth.ts).
export async function POST(req: NextRequest) {
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  if (!username || !password) return NextResponse.json({ error: 'Enter your username and password.' }, { status: 400 });
  let u;
  try { u = await asSystem((tx) => findStaffUser(tx, String(username), String(password))); }
  catch (e) { console.error('[login]', e); return NextResponse.json({ error: 'The database is not reachable. Try again shortly.' }, { status: 503 }); }
  if (!u) return NextResponse.json({ error: 'Incorrect username or password.' }, { status: 401 });
  const res = NextResponse.json({ ok: true, home: HOME_FOR[u.role], name: u.name, role: u.role });
  res.cookies.set(COOKIE, await sign({ u: u.username, n: u.name, r: u.role, c: u.cooperativeId, s: u.societyId, l: u.lenderId }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE });
  return res;
}
