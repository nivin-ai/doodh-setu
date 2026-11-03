import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, HOME_FOR, MAX_AGE, sign } from '@/lib/session';
import { DEMO_USERS } from '@/lib/users';

export async function POST(req: NextRequest) {
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const u = DEMO_USERS.find((x) => x.username === String(username ?? '').trim().toLowerCase() && x.password === password);
  if (!u) return NextResponse.json({ error: 'Incorrect username or password.' }, { status: 401 });
  const res = NextResponse.json({ ok: true, home: HOME_FOR[u.role], name: u.name, role: u.role });
  res.cookies.set(COOKIE, await sign({ u: u.username, n: u.name, r: u.role }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE });
  return res;
}
