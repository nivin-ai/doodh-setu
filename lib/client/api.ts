'use client';
// Browser side of the data layer: fetches module data from the API routes, keeps it fresh across
// tabs (BroadcastChannel) and exposes loading and error states. Business data is never stored in
// the browser; this only caches the last response in memory.
import { useCallback, useEffect, useRef, useState } from 'react';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function parse<T>(r: Response): Promise<T> {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError((j as { error?: string }).error ?? `Request failed (${r.status})`, r.status);
  return j as T;
}

export const getJson = <T,>(url: string) => fetch(url, { cache: 'no-store' }).then((r) => parse<T>(r));

const EVENT = 'ds-data-changed';
let channel: BroadcastChannel | null = null;
const bc = () => (typeof window !== 'undefined' && 'BroadcastChannel' in window ? (channel ??= new BroadcastChannel('doodh-setu-data')) : null);

// Tell every open tab that data changed, so they refetch
export function notifyChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENT));
  bc()?.postMessage(Date.now());
}

export async function postJson<T = { ok: boolean }>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const out = await parse<T>(r);
  notifyChange();
  return out;
}

export interface Resource<T> { data: T | null; error: ApiError | null; loading: boolean; refresh: () => Promise<void> }

// Loads a URL and reloads it when data changes anywhere in this browser, when the tab regains
// focus and (optionally) on an interval, for changes made on other devices.
export function useResource<T>(url: string | null, opts: { poll?: number; before?: () => Promise<void> } = {}): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const live = useRef(url);
  live.current = url;
  const before = useRef(opts.before);
  before.current = opts.before;

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      let d: T;
      try { d = await getJson<T>(url); }
      catch (e) {
        if (e instanceof ApiError && e.status === 401 && before.current) { await before.current(); d = await getJson<T>(url); }
        else throw e;
      }
      if (live.current === url) { setData(d); setError(null); }
    } catch (e) {
      if (live.current === url) setError(e instanceof ApiError ? e : new ApiError(String(e), 0));
    } finally {
      if (live.current === url) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void load();
    if (!url) return;
    const on = () => void load();
    const vis = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener(EVENT, on);
    window.addEventListener('focus', on);
    document.addEventListener('visibilitychange', vis);
    const c = bc();
    c?.addEventListener('message', on);
    const t = opts.poll ? window.setInterval(vis, opts.poll) : undefined;
    return () => {
      window.removeEventListener(EVENT, on); window.removeEventListener('focus', on); document.removeEventListener('visibilitychange', vis);
      c?.removeEventListener('message', on);
      if (t) window.clearInterval(t);
    };
  }, [url, load, opts.poll]);

  return { data, error, loading, refresh: load };
}
