'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';

// Keeps demo state in sync across browser tabs (farmer app in one tab, society in another, etc.)
export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'doodh-setu-demo-v1') useStore.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return <>{children}</>;
}

export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok ? <>{children}</> : <div className="p-8 text-muted">Loading...</div>;
}
