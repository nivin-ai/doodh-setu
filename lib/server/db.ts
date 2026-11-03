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

const g = globalThis as unknown as { __dsDriver?: Promise<Driver> };

async function postgresDriver(url: string): Promise<Driver> {
  const { default: postgres } = await import('postgres');
  const local = /localhost|127\.0\.0\.1/.test(url);
  // prepare: false works with Supabase's transaction pooler (port 6543)
  const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, ssl: local ? false : 'require' });
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

export function dbMode(): 'postgres' | 'pglite' { return process.env.DATABASE_URL ? 'postgres' : 'pglite'; }

export function driver(): Promise<Driver> {
  if (!g.__dsDriver) {
    const url = process.env.DATABASE_URL;
    g.__dsDriver = (url ? postgresDriver(url) : pgliteDriver()).catch((e) => { g.__dsDriver = undefined; throw e; });
  }
  return g.__dsDriver;
}

// Applies migrations that have not run yet (used for the local database and by scripts/db.ts).
export async function migrate(d?: Driver) {
  const drv = d ?? (await driver());
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
export async function asSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const drv = await driver();
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
