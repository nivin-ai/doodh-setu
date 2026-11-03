import { NextResponse } from 'next/server';
import { dbMode } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    gnani: Boolean(process.env.GNANI_API_KEY),
    ai: process.env.ANTHROPIC_API_KEY ? 'claude' : null,
    db: dbMode(), // 'postgres' (DATABASE_URL, e.g. Supabase) or 'pglite' (local demo database)
  });
}
