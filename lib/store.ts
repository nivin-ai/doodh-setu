'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DemoDateKey } from './demo';
import type { Lang } from './i18n';
import { SUGGESTED_IDS } from './union';
import { PREMIUM_PERIOD } from './demo';
import type { Premium } from './farmer';
import { syncFinance } from './finance';

const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export type IncentiveStatus = 'none' | 'submitted' | 'approved' | 'rejected' | 'concern' | 'published';
export type AppStatus = 'submitted' | 'in_review' | 'more_info' | 'approved' | 'declined' | 'withdrawn';

export interface Consent {
  id: string; uuid?: string; recipient: string; purpose: string; scope: string; period: string; grantedAt: string; status: 'active' | 'withdrawn'; withdrawnAt?: string;
  // DPDP loan consent (consent_records): notice version, data categories, method and notice language
  noticeVersion?: string; categories?: string[]; method?: 'digital' | 'assisted'; language?: Lang; statements?: number;
}
// data_sharing_logs: actual sharing events, kept separate from consent
export interface SharingLog { id: string; uuid?: string; consentId: string; recipient: string; categories: string[]; purpose: string; status: 'initiated' | 'completed' | 'failed'; at: string }
export interface Query { id: string; text: string; lang: Lang; at: string; reply?: string; status: 'open' | 'resolved' }
export interface Application {
  ref: string; uuid?: string; product: string; lender: string; amount: number; tenure: number; rate: number; status: AppStatus;
  history: { status: AppStatus; at: string; note: string }[];
  docs: { id: 'id' | 'bank' | 'quote' | 'kyc' | 'land' | 'credit'; status: 'received' | 'requested' | 'missing' }[];
  consentId: string;
  loanConsentId?: string;
  sharing?: SharingLog[];
}
export interface AuditEvent { at: string; actor: string; action: string }

interface State {
  demoDate: DemoDateKey;
  lang: Lang;
  autoplay: boolean;
  plannerUser: 'planner' | 'approver';
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
  addQuery: (text: string, lang: Lang) => void;
  replyQuery: (id: string, reply: string) => void;
  grantConsent: (c: Omit<Consent, 'id' | 'grantedAt' | 'status'>) => string;
  withdrawConsent: (id: string) => void;
  submitApplication: (a: Omit<Application, 'ref' | 'status' | 'history' | 'docs' | 'sharing'>) => void;
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
      addQuery: (text, lang) => set({ queries: [{ id: 'Q' + (get().queries.length + 101), text, lang, at: now(), status: 'open' }, ...get().queries] }),
      replyQuery: (id, reply) => set({ queries: get().queries.map((q) => (q.id === id ? { ...q, reply, status: 'resolved' } : q)) }),
      grantConsent: (c) => {
        const id = 'C' + (get().consents.length + 1).toString().padStart(3, '0');
        const rec: Consent = { ...c, id, uuid: uuid(), grantedAt: now(), status: 'active' };
        set({ consents: [rec, ...get().consents] });
        get().log('Farmer', `Granted consent ${id} to ${c.recipient} for "${c.purpose}"${c.noticeVersion ? ` (notice ${c.noticeVersion})` : ''}`);
        syncFinance({ type: 'consent', consent: rec });
        return id;
      },
      withdrawConsent: (id) => {
        const at = now();
        set({ consents: get().consents.map((c) => (c.id === id ? { ...c, status: 'withdrawn', withdrawnAt: at } : c)) });
        get().log('Farmer', `Withdrew consent ${id}`);
        const c = get().consents.find((x) => x.id === id);
        if (c?.uuid) syncFinance({ type: 'withdraw', consentUuid: c.uuid, at });
      },
      submitApplication: (a) => {
        const lc = a.loanConsentId ? get().consents.find((c) => c.id === a.loanConsentId && c.status === 'active') : undefined;
        const sharing: SharingLog[] = lc ? [{ id: 'S' + Date.now().toString(36).toUpperCase(), uuid: uuid(), consentId: lc.id, recipient: a.lender, categories: lc.categories ?? [], purpose: 'Loan assessment and processing', status: 'completed', at: now() }] : [];
        const app: Application = {
          ...a, ref: 'DF-10024', uuid: uuid(), status: 'submitted', sharing,
          history: [{ status: 'submitted', at: now(), note: 'Application received by the bank' }],
          docs: [{ id: 'kyc', status: lc ? 'received' : 'missing' }, { id: 'land', status: lc ? 'received' : 'missing' }, { id: 'credit', status: lc ? 'received' : 'missing' }, { id: 'id', status: 'received' }, { id: 'bank', status: 'received' }, { id: 'quote', status: 'missing' }],
        };
        set({ application: app });
        get().log('Farmer', `Submitted application ${app.ref} to ${a.lender}`);
        syncFinance({ type: 'application', application: app, loanConsentUuid: lc?.uuid ?? null });
        if (sharing.length) get().log('DairyFin', `Shared ${sharing[0].categories.join(', ')} with ${a.lender} under consent ${sharing[0].consentId} (${sharing[0].id})`);
      },
      setAppStatus: (s, note) => {
        const a = get().application; if (!a) return;
        set({ application: { ...a, status: s, history: [...a.history, { status: s, at: now(), note }] } });
        if (a.uuid) syncFinance({ type: 'status', applicationUuid: a.uuid, status: s, at: now() });
        get().log('Lender', `Set ${a.ref} to ${s}${note ? ': ' + note : ''}`);
      },
      requestDoc: () => {
        const a = get().application; if (!a) return;
        set({ application: { ...a, status: 'more_info', docs: a.docs.map((d) => (d.id === 'quote' ? { ...d, status: 'requested' } : d)), history: [...a.history, { status: 'more_info', at: now(), note: 'Please upload a cattle purchase quote' }] } });
        get().log('Lender', `Requested cattle purchase quote on ${a.ref}`);
      },
      uploadDoc: () => {
        const a = get().application; if (!a) return;
        set({ application: { ...a, status: 'in_review', docs: a.docs.map((d) => (d.id === 'quote' ? { ...d, status: 'received' } : d)), history: [...a.history, { status: 'in_review', at: now(), note: 'Document received; back in review' }] } });
        get().log('Farmer', `Uploaded cattle purchase quote for ${a.ref}`);
      },
      reset: () => set({ ...initial, incentive: { ...initial.incentive, ids: [...SUGGESTED_IDS] } }),
    }),
    { name: 'doodh-setu-demo-v1' },
  ),
);

export function activePremium(s: { incentive: State['incentive'] }): Premium | null {
  return s.incentive.status === 'published' ? { rate: s.incentive.rate, ...PREMIUM_PERIOD } : null;
}
