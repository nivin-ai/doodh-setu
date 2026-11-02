'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DemoDateKey } from './demo';
import type { Lang } from './i18n';
import { SUGGESTED_IDS } from './union';
import { PREMIUM_PERIOD } from './demo';
import type { Premium } from './farmer';

export type IncentiveStatus = 'none' | 'submitted' | 'approved' | 'rejected' | 'concern' | 'published';
export type AppStatus = 'submitted' | 'in_review' | 'more_info' | 'approved' | 'declined' | 'withdrawn';

export interface Consent { id: string; recipient: string; purpose: string; scope: string; period: string; grantedAt: string; status: 'active' | 'withdrawn'; withdrawnAt?: string }
export interface Query { id: string; text: string; lang: Lang; at: string; reply?: string; status: 'open' | 'resolved' }
export interface Application {
  ref: string; product: string; lender: string; amount: number; tenure: number; rate: number; status: AppStatus;
  history: { status: AppStatus; at: string; note: string }[];
  docs: { id: 'id' | 'bank' | 'quote'; status: 'received' | 'requested' | 'missing' }[];
  consentId: string;
}
export type CampaignStatus = 'draft' | 'approved' | 'held' | 'override';
export interface Marketing { campaigns: Record<string, CampaignStatus>; overrides: Record<string, string>; story: 'none' | 'sent' | 'published'; storyHeard: boolean }
export interface AuditEvent { at: string; actor: string; action: string }

interface State {
  demoDate: DemoDateKey;
  lang: Lang;
  autoplay: boolean;
  plannerUser: 'planner' | 'approver' | 'marketer';
  marketing: Marketing;
  incentive: { status: IncentiveStatus; rate: number; ids: number[]; submittedBy?: string; approvedBy?: string; concern?: string; reason?: string; notes: Partial<Record<Lang, string>> };
  farmer: { heard: boolean; interested: boolean; correction: boolean; signalConsent: boolean };
  consents: Consent[];
  queries: Query[];
  application: Application | null;
  audit: AuditEvent[];
  set: (p: Partial<State>) => void;
  log: (actor: string, action: string) => void;
  setIncentive: (p: Partial<State['incentive']>) => void;
  setFarmer: (p: Partial<State['farmer']>) => void;
  setCampaign: (id: string, st: CampaignStatus, reason?: string) => void;
  setMarketing: (p: Partial<Marketing>) => void;
  addQuery: (text: string, lang: Lang) => void;
  replyQuery: (id: string, reply: string) => void;
  grantConsent: (c: Omit<Consent, 'id' | 'grantedAt' | 'status'>) => string;
  withdrawConsent: (id: string) => void;
  submitApplication: (a: Omit<Application, 'ref' | 'status' | 'history' | 'docs'>) => void;
  setAppStatus: (s: AppStatus, note: string) => void;
  requestDoc: () => void;
  uploadDoc: () => void;
  reset: () => void;
}

const now = () => new Date().toISOString();
const initial = {
  demoDate: 'mar' as DemoDateKey,
  lang: 'gu' as Lang,
  autoplay: false,
  plannerUser: 'planner' as State['plannerUser'],
  marketing: { campaigns: {}, overrides: {}, story: 'none', storyHeard: false } as Marketing,
  incentive: { status: 'none' as IncentiveStatus, rate: 40, ids: SUGGESTED_IDS, notes: { gu: '', hi: '', en: '' } },
  farmer: { heard: false, interested: false, correction: false, signalConsent: true },
  consents: [] as Consent[],
  queries: [] as Query[],
  application: null as Application | null,
  audit: [] as AuditEvent[],
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      set: (p) => set(p),
      log: (actor, action) => set({ audit: [{ at: now(), actor, action }, ...get().audit].slice(0, 200) }),
      setIncentive: (p) => set({ incentive: { ...get().incentive, ...p } }),
      setFarmer: (p) => set({ farmer: { ...get().farmer, ...p } }),
      setCampaign: (id, st, reason) => {
        const m = get().marketing;
        set({ marketing: { ...m, campaigns: { ...m.campaigns, [id]: st }, overrides: reason ? { ...m.overrides, [id]: reason } : m.overrides } });
      },
      setMarketing: (p) => set({ marketing: { ...get().marketing, ...p } }),
      addQuery: (text, lang) => set({ queries: [{ id: 'Q' + (get().queries.length + 101), text, lang, at: now(), status: 'open' }, ...get().queries] }),
      replyQuery: (id, reply) => set({ queries: get().queries.map((q) => (q.id === id ? { ...q, reply, status: 'resolved' } : q)) }),
      grantConsent: (c) => {
        const id = 'C' + (get().consents.length + 1).toString().padStart(3, '0');
        set({ consents: [{ ...c, id, grantedAt: now(), status: 'active' }, ...get().consents] });
        get().log('Savitaben (farmer)', `Granted consent ${id} to ${c.recipient} for "${c.purpose}"`);
        return id;
      },
      withdrawConsent: (id) => {
        set({ consents: get().consents.map((c) => (c.id === id ? { ...c, status: 'withdrawn', withdrawnAt: now() } : c)) });
        get().log('Savitaben (farmer)', `Withdrew consent ${id}`);
      },
      submitApplication: (a) => {
        const app: Application = { ...a, ref: 'DF-10024', status: 'submitted', history: [{ status: 'submitted', at: now(), note: 'Application received by the bank' }], docs: [{ id: 'id', status: 'received' }, { id: 'bank', status: 'received' }, { id: 'quote', status: 'missing' }] };
        set({ application: app });
        get().log('Savitaben (farmer)', `Submitted application ${app.ref} to ${a.lender}`);
      },
      setAppStatus: (s, note) => {
        const a = get().application; if (!a) return;
        set({ application: { ...a, status: s, history: [...a.history, { status: s, at: now(), note }] } });
        get().log('Anita (lender)', `Set ${a.ref} to ${s}${note ? ': ' + note : ''}`);
      },
      requestDoc: () => {
        const a = get().application; if (!a) return;
        set({ application: { ...a, status: 'more_info', docs: a.docs.map((d) => (d.id === 'quote' ? { ...d, status: 'requested' } : d)), history: [...a.history, { status: 'more_info', at: now(), note: 'Please upload a cattle purchase quote' }] } });
        get().log('Anita (lender)', `Requested cattle purchase quote on ${a.ref}`);
      },
      uploadDoc: () => {
        const a = get().application; if (!a) return;
        set({ application: { ...a, status: 'in_review', docs: a.docs.map((d) => (d.id === 'quote' ? { ...d, status: 'received' } : d)), history: [...a.history, { status: 'in_review', at: now(), note: 'Document received; back in review' }] } });
        get().log('Savitaben (farmer)', `Uploaded cattle purchase quote for ${a.ref}`);
      },
      reset: () => set({ ...initial, incentive: { ...initial.incentive, ids: [...SUGGESTED_IDS] }, marketing: { campaigns: {}, overrides: {}, story: 'none', storyHeard: false } }),
    }),
    { name: 'doodh-setu-demo-v1' },
  ),
);

export function activePremium(s: { incentive: State['incentive'] }): Premium | null {
  return s.incentive.status === 'published' ? { rate: s.incentive.rate, ...PREMIUM_PERIOD } : null;
}
