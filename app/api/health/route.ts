import { NextRequest, NextResponse } from 'next/server';
import { dbStatus, driver } from '@/lib/server/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // /api/health?check=db opens the database first (switching to the local one if Supabase is down):
  // a pre-flight check before a demo. Plain /api/health answers instantly (used by the voice feature).
  let dbError: string | null = null;
  if (req.nextUrl.searchParams.get('check') === 'db') try { await (await driver()).transaction((tx) => tx.query('select 1')); } catch (e) { dbError = e instanceof Error ? e.message : String(e); }
  const db = dbStatus();
  return NextResponse.json({
    gnani: Boolean(process.env.GNANI_API_KEY),
    stt: process.env.GEMINI_API_KEY ? 'gemini' : null,
    ai: process.env.ANTHROPIC_API_KEY ? 'claude' : null,
    db: db.mode, // 'postgres' (Supabase) or 'pglite' (local demo database, also after a fallback)
    dbFallback: db.fallback, // { since, reason } when Supabase could not be reached
    dbError,
  });
}
