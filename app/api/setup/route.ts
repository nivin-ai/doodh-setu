import { NextRequest, NextResponse } from 'next/server';
import { asSystem, migrate, postgresOnly } from '@/lib/server/db';
import { seedDemoData } from '@/lib/server/seed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// One-time database setup for a new Supabase project: applies supabase/migrations and loads the
// synthetic demo data (skipped if already there). Needs SETUP_KEY in the environment and
// ?key=<SETUP_KEY> in the URL. Safe to run again: migrations that ran are skipped, and the seed
// does nothing once the demo union exists. Remove SETUP_KEY afterwards to switch it off.
export async function GET(req: NextRequest) {
  const key = process.env.SETUP_KEY?.trim();
  const env = { DATABASE_URL: Boolean(process.env.DATABASE_URL), AUTH_SECRET: Boolean(process.env.AUTH_SECRET), SETUP_KEY: Boolean(key) };
  // Says which settings this deployment has (never their values), so a missing variable is easy to spot
  if (!key) return NextResponse.json({ error: 'SETUP_KEY is not set in this deployment. Add it in Vercel (enable it for Preview and Production), then redeploy.', settings: env }, { status: 404 });
  if ((req.nextUrl.searchParams.get('key') ?? '').trim() !== key) return NextResponse.json({ error: 'The key in the link does not match SETUP_KEY', settings: env }, { status: 403 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'DATABASE_URL is not set in this deployment, nothing to set up', settings: env }, { status: 400 });
  const log: string[] = [];
  const t0 = Date.now();
  try {
    await migrate(postgresOnly());
    log.push(`Migrations applied (${Date.now() - t0} ms)`);
    const seeded = await asSystem((tx) => seedDemoData(tx, { log: (m) => log.push(m) }), { strict: true });
    log.push(seeded ? `Demo data loaded (${Date.now() - t0} ms total)` : 'Demo data was already present');
    const counts = await asSystem((tx) => tx.query(`select (select count(*) from societies)::int societies, (select count(*) from farmers)::int farmers,
      (select count(*) from demand_daily)::int demand_rows, (select count(*) from milk_transactions)::int milk_rows, (select count(*) from app_users)::int staff_accounts`), { strict: true });
    return NextResponse.json({ ok: true, log, counts: counts[0] });
  } catch (e) {
    console.error('[setup]', e);
    return NextResponse.json({ ok: false, log, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
