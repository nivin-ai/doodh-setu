// Staff accounts (app_users). Read with the server's own rights at sign-in only.
import { scryptSync, timingSafeEqual } from 'node:crypto';
import type { Tx } from '../db';
import type { Role } from '../../roles';

export interface StaffUser { username: string; name: string; role: Role; cooperativeId: string | null; societyId: string | null; lenderId: string | null }

export function checkPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const a = scryptSync(password, salt, 32), b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function findStaffUser(tx: Tx, username: string, password: string): Promise<StaffUser | null> {
  const r = (await tx.query<Record<string, unknown>>(`select username, display_name, role, password_hash, cooperative_id::text c, society_id::text s, lender_id::text l
    from app_users where username = $1`, [username.trim().toLowerCase()]))[0];
  if (!r || !checkPassword(password, String(r.password_hash))) return null;
  return { username: String(r.username), name: String(r.display_name), role: r.role as Role, cooperativeId: (r.c as string) ?? null, societyId: (r.s as string) ?? null, lenderId: (r.l as string) ?? null };
}
