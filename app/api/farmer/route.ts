import type { NextRequest } from 'next/server';
import { farmerScope } from '@/lib/server/auth';
import { body, handle } from '@/lib/server/http';
import { farmerAction, getFarmerData } from '@/lib/server/services/farmer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: NextRequest) => handle(async () => getFarmerData(await farmerScope(req), req.nextUrl.searchParams.get('asOf') ?? ''));
export const POST = (req: NextRequest) => handle(async () => farmerAction(await farmerScope(req), await body(req)));
