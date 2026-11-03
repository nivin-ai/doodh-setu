'use client';
import { useEffect, useState } from 'react';
import type { Role } from '@/lib/roles';

export interface User { username: string; name: string; role: Role }
let cache: Promise<User | null> | null = null;
const load = () => (cache ??= fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json()).then((j) => j.user ?? null).catch(() => null));

export function useSession() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => { let on = true; load().then((u) => on && setUser(u)); return () => { on = false; }; }, []);
  return { user, loading: user === undefined };
}

export async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  cache = null;
  window.location.href = '/';
}
export const resetSession = () => { cache = null; };
