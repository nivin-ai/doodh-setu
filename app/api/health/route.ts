import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    gnani: Boolean(process.env.GNANI_API_KEY),
    ai: process.env.ANTHROPIC_API_KEY ? 'claude' : null,
    db: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : null,
  });
}
