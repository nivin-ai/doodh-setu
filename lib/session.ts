// Signed session cookies. Works in middleware (edge) and route handlers.
//   ds_session: staff console user (app_users). Carries the user's scope ids for the database.
//   ds_farmer:  the farmer app on a registered phone (prototype: the demo farmer's device).
import type { Role } from './roles';
export * from './roles';
export interface Session {
  u: string; n: string; r: Role | 'farmer'; exp: number;
  c?: string | null; s?: string | null; l?: string | null; f?: string | null; // cooperative, society, lender, farmer ids
}

export const COOKIE = 'ds_session';
export const FARMER_COOKIE = 'ds_farmer';
export const MAX_AGE = 60 * 60 * 12; // 12 hours

const enc = new TextEncoder();
const secret = () => process.env.AUTH_SECRET || 'doodh-setu-demo-secret-change-me';
const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

async function key() {
  return crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function sign(s: Omit<Session, 'exp'>): Promise<string> {
  const body = b64(enc.encode(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + MAX_AGE })));
  const sig = await crypto.subtle.sign('HMAC', await key(), enc.encode(body));
  return `${body}.${b64(sig)}`;
}

export async function verify(token?: string | null): Promise<Session | null> {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  try {
    const raw = unb64(sig); const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const ok = await crypto.subtle.verify('HMAC', await key(), bytes, enc.encode(body));
    if (!ok) return null;
    const s = JSON.parse(unb64(body)) as Session;
    return s.exp > Date.now() / 1000 ? s : null;
  } catch { return null; }
}
