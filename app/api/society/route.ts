import type { NextRequest } from 'next/server';
import { staffScope } from '@/lib/server/auth';
import { body, handle } from '@/lib/server/http';
import { getSocietyData, societyAction } from '@/lib/server/services/society';

export const runtime = 'nodejs';
// Allows time to switch to the local demo database if Supabase cannot be reached (lib/server/db.ts)
export const maxDuration = 60;

export const dynamic = 'force-dynamic';

export const GET = (req: NextRequest) => handle(async () => getSocietyData(await staffScope(req, 'society'), req.nextUrl.searchParams.get('asOf') ?? ''));
export const POST = (req: NextRequest) => handle(async () => societyAction(await staffScope(req, 'society'), await body(req)));
