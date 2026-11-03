'use client';
// Browser UI state only: demo date, language, playback preference and (for the demo admin) which
// planner role to act as. Business data lives in the database and is loaded through lib/client/api.ts.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DemoDateKey } from './demo';
import type { Lang } from './i18n';
import { postJson } from './client/api';

interface State {
  demoDate: DemoDateKey;
  lang: Lang;
  autoplay: boolean;
  plannerUser: 'planner' | 'approver';
  set: (p: Partial<Omit<State, 'set' | 'reset'>>) => void;
  reset: () => Promise<void>;
}

const initial = { demoDate: 'mar' as DemoDateKey, lang: 'gu' as Lang, autoplay: false, plannerUser: 'planner' as const };

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...initial,
      set: (p) => set(p),
      // Resets the demo story in the database (synthetic records only) and the UI preferences
      reset: async () => { await postJson('/api/demo', {}); set({ ...initial }); },
    }),
    { name: 'doodh-setu-ui-v2', partialize: (s) => ({ demoDate: s.demoDate, lang: s.lang, autoplay: s.autoplay, plannerUser: s.plannerUser }) },
  ),
);
