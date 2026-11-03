import type { NextRequest } from 'next/server';
import { consumerScope } from '@/lib/server/auth';
import { body, handle } from '@/lib/server/http';
import { getWallet, walletAction } from '@/lib/server/services/dairyfin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: NextRequest) => handle(async () => getWallet(await consumerScope(req)));
export const POST = (req: NextRequest) => handle(async () => walletAction(await consumerScope(req), await body(req)));
