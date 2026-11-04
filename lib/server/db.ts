// Database access for the server. Two drivers, one SQL code path:
//   * DATABASE_URL set  -> Supabase Postgres (or any Postgres) through postgres.js
//   * DATABASE_URL unset -> local demo database: PGlite (Postgres compiled to WebAssembly) in this
//     server process, created from the same migrations and seed. Data lives only in memory (or in
//     PGLITE_DIR if set) and resets when the server restarts. For demos and development only.
//
// Every user request runs through withScope(): a transaction that switches to the low-privilege
// role doodh_app and sets the caller's scope, so the row-level security policies in
// supabase/migrations/0003_access_control.sql decide what the request can read and write.
import { MIGRATIONS } from './migrations.sql';
import type { Role } from '../roles';

export type Row = Record<string, unknown>;
export interface Tx {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>; // several statements, no parameters (migrations)
}
interface Driver { kind: 'postgres' | 'pglite'; transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> }

export type DbRole = Exclude<Role, 'admin'> | 'farmer';
export interface Scope {
  role: DbRole;
  actor: string;
  farmerId?: string | null;
  societyId?: string | null;
  cooperativeId?: string | null;
  lenderId?: string | null;
}

export class DbError extends Error {
  constructor(message: string, readonly status = 500) { super(message); }
}

const g = globalThis as unknown as { __dsDriver?: Promise<Driver>; __dsStandby?: Promise<Driver>; __dsFallback?: FallbackInfo; __dsPg?: Promise<Driver> };

// ---------------------------------------------------------------------------------------------
// Safe fallback. If DATABASE_URL is set but Supabase cannot be reached (network blocked, pooler
// down, project paused, wrong host, password changed, schema not set up), the server switches to
// the local demo database (PGlite) with the same migrations and the same seed, instead of
// showing "The database is not reachable". Ids in the seed are stable, so existing sign-in
// cookies keep working after the switch. The switch is sticky for this server process: restart
// the server to try Supabase again. GET /api/health shows which database is in use and why.
//   DB_FALLBACK=off   never fall back (errors are shown instead)
//   DB_STANDBY=on|off prepare the local database in the background at start-up so a switch is
//                     instant. Default: on when running on your computer, off on Vercel.
// ---------------------------------------------------------------------------------------------
export interface FallbackInfo { since: string; reason: string }
const fallbackAllowed = () => (process.env.DB_FALLBACK ?? '').toLowerCase() !== 'off';
const standbyWanted = () => {
  const v = (process.env.DB_STANDBY ?? '').toLowerCase();
  return v ? v === 'on' || v === 'true' || v === '1' : !process.env.VERCEL;
};
const PROBE_MS = Number(process.env.DB_PROBE_TIMEOUT_MS || 6000);

// Errors that mean "cannot talk to the database", as opposed to a bad query or a refused permission
const CONNECTION_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'ECONNABORTED',
  'CONNECT_TIMEOUT', 'CONNECTION_CLOSED', 'CONNECTION_ENDED', 'CONNECTION_DESTROYED', 'SASL_SIGNATURE_MISMATCH',
  '28P01', '28000', '3D000', '53300', '57P01', '57P02', '57P03', 'XX000']);
export function isConnectionError(e: unknown): boolean {
  const err = e as { code?: string; errno?: string; message?: string } | null;
  const code = String(err?.code ?? err?.errno ?? '');
  if (CONNECTION_CODES.has(code) || code.startsWith('08')) return true;
  return /tenant or user not found|connection terminated|timeout exceeded when trying to connect|self[- ]signed certificate|certificate|getaddrinfo|socket hang up|server closed the connection|too many connections|max client connections|password authentication failed|db probe timed out/i.test(String(err?.message ?? ''));
}
const describe = (e: unknown) => {
  const err = e as { code?: string; message?: string };
  // never include the connection string or password
  return [err?.code, String(err?.message ?? e).replace(/postgres(ql)?:\/\/\S+/gi, '<connection string>')].filter(Boolean).join(': ').slice(0, 300);
};

async function postgresDriver(url: string): Promise<Driver> {
  const { default: postgres } = await import('postgres');
  const local = /localhost|127\.0\.0\.1/.test(url);
  // prepare: false works with Supabase's transaction pooler (port 6543).
  // connect_timeout keeps a blocked network from hanging a request for 30 s (the library default).
  const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: Number(process.env.DB_CONNECT_TIMEOUT_S || 5), ssl: local ? false : 'require', onnotice: () => undefined });
  return {
    kind: 'postgres',
    transaction: (fn) => sql.begin((t) => fn({
      query: async (text, params = []) => (await t.unsafe(text, params as never[])) as never,
      exec: async (text) => { await t.unsafe(text); },
    })) as never,
  };
}

async function pgliteDriver(): Promise<Driver> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const db = new PGlite({ dataDir: process.env.PGLITE_DIR || undefined, extensions: { pgcrypto } });
  const driver: Driver = {
    kind: 'pglite',
    transaction: (fn) => db.transaction((t) => fn({
      query: async (text, params) => (await t.query(text, params as unknown[])).rows as never,
      exec: async (text) => { await t.exec(text); },
    })),
  };
  await migrate(driver);
  const { seedDemoData } = await import('./seed');
  await driver.transaction((tx) => seedDemoData(tx));
  return driver;
}

// The local demo database, created once per server process (shared by the fallback and by
// "no DATABASE_URL" mode).
function standby(): Promise<Driver> {
  if (!g.__dsStandby) g.__dsStandby = pgliteDriver().catch((e) => { g.__dsStandby = undefined; throw e; });
  return g.__dsStandby;
}

function switchToFallback(reason: unknown) {
  if (!g.__dsFallback) {
    g.__dsFallback = { since: new Date().toISOString(), reason: describe(reason) };
    console.warn(`[db] Supabase not reachable (${g.__dsFallback.reason}). Switched to the local demo database for this server process.`);
  }
  g.__dsDriver = standby();
  return g.__dsDriver;
}

// Supabase with a safety net: every transaction that fails because the database cannot be
// reached is retried once on Supabase, then run on the local demo database.
function resilient(pg: Driver): Driver {
  return {
    kind: 'postgres',
    async transaction(fn) {
      if (g.__dsFallback) return (await standby()).transaction(fn);
      try { return await pg.transaction(fn); }
      catch (e) {
        if (!isConnectionError(e) || !fallbackAllowed()) throw e;
        try { return await pg.transaction(fn); }
        catch (e2) {
          if (!isConnectionError(e2)) throw e2;
          return (await switchToFallback(e2)).transaction(fn);
        }
      }
    },
  };
}

// Supabase only, never the fallback (setup route and maintenance scripts).
export function postgresOnly(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (!url) return Promise.reject(new DbError('DATABASE_URL is not set', 400));
  if (!g.__dsPg) g.__dsPg = postgresDriver(url).catch((e) => { g.__dsPg = undefined; throw e; });
  return g.__dsPg;
}

// Checks once, at start-up, that Supabase answers and has the schema. Any failure -> fallback.
async function connect(url: string): Promise<Driver> {
  void url;
  const pg = await postgresOnly();
  if (!fallbackAllowed()) return pg;
  if (standbyWanted()) standby().catch((e) => console.error('[db] local standby database failed to start', e));
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      pg.transaction((tx) => tx.query('select 1 from app_users limit 1')),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('DB probe timed out')), PROBE_MS); }),
    ]).finally(() => clearTimeout(timer));
    return resilient(pg);
  } catch (e) {
    return switchToFallback(e);
  }
}

// 'postgres' while Supabase is in use, 'pglite' for the local demo database (also after a fallback)
export function dbMode(): 'postgres' | 'pglite' { return process.env.DATABASE_URL && !g.__dsFallback ? 'postgres' : 'pglite'; }
export function dbStatus() {
  return { mode: dbMode(), configured: process.env.DATABASE_URL ? 'postgres' : 'pglite', fallback: g.__dsFallback ?? null, fallbackEnabled: fallbackAllowed() };
}

export function driver(): Promise<Driver> {
  if (!g.__dsDriver) {
    const url = process.env.DATABASE_URL;
    g.__dsDriver = (url ? connect(url) : standby()).catch((e) => { g.__dsDriver = undefined; throw e; });
  }
  return g.__dsDriver;
}

// Applies migrations that have not run yet (used for the local database and by scripts/db.ts).
export async function migrate(d?: Driver | Promise<Driver>) {
  const drv = (await d) ?? (await driver());
  await drv.transaction(async (tx) => {
    await tx.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
    const done = new Set((await tx.query<{ name: string }>('select name from schema_migrations')).map((r) => r.name));
    for (const m of MIGRATIONS) {
      if (done.has(m.name)) continue;
      await tx.exec(m.sql);
      await tx.query('insert into schema_migrations (name) values ($1)', [m.name]);
    }
  });
}

const SETTINGS: [keyof Scope, string][] = [['role', 'role'], ['actor', 'actor'], ['farmerId', 'farmer_id'], ['societyId', 'society_id'], ['cooperativeId', 'cooperative_id'], ['lenderId', 'lender_id']];

// Runs fn as the given user. Row-level security applies to everything fn does.
export async function withScope<T>(scope: Scope, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const drv = await driver();
  return drv.transaction(async (tx) => {
    await tx.query('set local role doodh_app');
    const sel = SETTINGS.map((_, i) => `set_config('app.${SETTINGS[i][1]}', $${i + 1}, true)`).join(', ');
    await tx.query(`select ${sel}`, SETTINGS.map(([k]) => (scope[k] ?? '') as string));
    return fn(tx);
  });
}

// Runs fn with the server's own rights (no user scope): sign-in, seeding, demo reset and public
// aggregate counts only. Never use it to return individual records to a browser.
// strict: Supabase only, never the local fallback (setup and maintenance).
export async function asSystem<T>(fn: (tx: Tx) => Promise<T>, opts: { strict?: boolean } = {}): Promise<T> {
  const drv = opts.strict ? await postgresOnly() : await driver();
  return drv.transaction(fn);
}

// Small helpers for repositories
export const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export const n0 = (v: unknown) => Number(v ?? 0);
export function placeholders(rows: number, cols: number, start = 1) {
  const out: string[] = [];
  for (let r = 0; r < rows; r++) out.push('(' + Array.from({ length: cols }, (_, c) => `$${start + r * cols + c}`).join(', ') + ')');
  return out.join(', ');
}
export async function insertMany(tx: Tx, table: string, columns: string[], rows: unknown[][], suffix = '') {
  const per = Math.max(1, Math.floor(30000 / columns.length));
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    await tx.query(`insert into ${table} (${columns.join(', ')}) values ${placeholders(chunk.length, columns.length)} ${suffix}`, chunk.flat());
  }
}
