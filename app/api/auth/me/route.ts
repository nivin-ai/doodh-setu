import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, verify } from '@/lib/session';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const s = await verify(req.cookies.get(COOKIE)?.value);
  return NextResponse.json(s ? { user: { username: s.u, name: s.n, role: s.r } } : { user: null });
}
