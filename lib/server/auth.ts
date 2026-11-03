// Turns a signed cookie into a database scope for one module. Route handlers call these before
// touching the database; the database's row-level security then enforces the same scope again.
import type { NextRequest } from 'next/server';
import { ACCESS, COOKIE, FARMER_COOKIE, verify, type Session } from '../session';
import { DbError, type Scope } from './db';

export type Module = 'planner' | 'society' | 'lender';

export async function staffSession(req: NextRequest): Promise<Session | null> {
  const s = await verify(req.cookies.get(COOKIE)?.value);
  return s && s.r !== 'farmer' ? s : null;
}

// The database role for a staff user in a module. The demo admin acts as the module's role
// (and, in the planner, as planner or approver as chosen in the header).
export async function staffScope(req: NextRequest, module: Module, actingAs?: string | null): Promise<Scope> {
  const s = await staffSession(req);
  if (!s) throw new DbError('Sign in required', 401);
  if (s.r === 'farmer' || !ACCESS[module].includes(s.r)) throw new DbError('This account cannot open this module', 403);
  const base = { actor: s.n };
  if (module === 'planner') {
    const role = s.r === 'admin' ? (actingAs === 'approver' ? 'approver' : 'planner') : (s.r as 'planner' | 'approver');
    return { ...base, actor: s.r === 'admin' ? (role === 'approver' ? 'Approver' : 'Planner') : s.n, role, cooperativeId: s.c };
  }
  if (module === 'society') return { ...base, role: 'secretary', societyId: s.s };
  return { ...base, role: 'lender', lenderId: s.l };
}

export async function farmerScope(req: NextRequest): Promise<Scope> {
  const s = await verify(req.cookies.get(FARMER_COOKIE)?.value);
  if (!s || s.r !== 'farmer' || !s.f) throw new DbError('Farmer device not registered', 401);
  return { role: 'farmer', actor: s.n, farmerId: s.f };
}
