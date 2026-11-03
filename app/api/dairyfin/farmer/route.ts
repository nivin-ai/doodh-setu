import type { NextRequest } from 'next/server';
import { farmerScope } from '@/lib/server/auth';
import { body, handle } from '@/lib/server/http';
import { farmerFinanceAction, getFarmerFinance } from '@/lib/server/services/dairyfin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: NextRequest) => handle(async () => getFarmerFinance(await farmerScope(req), req.nextUrl.searchParams.get('asOf') ?? ''));
export const POST = (req: NextRequest) => handle(async () => farmerFinanceAction(await farmerScope(req), await body(req)));
