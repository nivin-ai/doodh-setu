import { NextRequest, NextResponse } from 'next/server';
import { ACCESS, COOKIE, HOME_FOR, verify } from '@/lib/session';

// Staff modules need a signed-in user with the right role. The farmer app stays open.
export async function middleware(req: NextRequest) {
  const mod = req.nextUrl.pathname.split('/')[1] as keyof typeof ACCESS;
  const s = await verify(req.cookies.get(COOKIE)?.value);
  if (!s) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (s.r === 'farmer' || s.r === 'consumer') return NextResponse.redirect(new URL('/login', req.url));
  if (!ACCESS[mod]?.includes(s.r)) return NextResponse.redirect(new URL(HOME_FOR[s.r], req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/planner/:path*', '/society/:path*', '/lender/:path*'] };
