'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import { useStore, activePremium, type AppStatus } from '@/lib/store';
import { DEMO_DATES, FARMER } from '@/lib/demo';
import { LANGS, LANG_CODE, PHRASES, SIGNAL_NEED, SIGNAL_TITLE, STT_LANGS, signalMessage, t, type Lang } from '@/lib/i18n';
import { dayTotals, explainChange, monthKeysUpTo, monthSummary, worthToFarmer, type MonthSummary } from '@/lib/farmer';
import { answer } from '@/lib/ask';
import { browserRecognition, recordWav, speak, stopSpeaking, transcribe, voiceHealth, type Recorder } from '@/lib/voice';
import { buildContext } from '@/lib/askContext';
import { CREDIT, KYC, NOTICE_VERSION, PROPERTY, CATEGORIES, fin } from '@/lib/finance';
import { fmtMonth, inr, MONTHS } from '@/lib/util';
import { Chip, Count, PlayButton, Segmented, Waveform, CHART } from './ui';
import { IconBack, IconBank, IconCheck, IconChevron, IconHome, IconMic, IconNotice, IconPhone, IconRupee, IconSend, IconUser } from './icons';

type Tab = 'home' | 'earnings' | 'signals' | 'finance' | 'ask';
type Sub = null | 'signal' | 'why' | 'income' | 'afford' | 'products' | 'consent' | 'loanConsent' | 'apply' | 'tracker' | 'profile';

const PRODUCTS_DEMO = [
  { id: 'gpb', lender: 'Gramin Partner Bank (demo)', name: 'Cattle loan', purpose: 'cattle', min: 25000, max: 200000, rate: 10.5, maxTenure: 36, feePct: 1, elig: 'Society member for 12+ months with regular milk supply' },
  { id: 'scn', lender: 'Sahakari Credit NBFC (demo)', name: 'Feed and fodder credit', purpose: 'feed', min: 10000, max: 100000, rate: 13, maxTenure: 24, feePct: 1.5, elig: 'Society member for 6+ months' },
];

export const emiFor = (p: number, annual: number, n: number) => {
  const r = annual / 1200;
  return r === 0 ? p / n : (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
};


type Ctx = {
  s: ReturnType<typeof useStore.getState>; lang: Lang; T: (k: string) => string; today: string; premium: ReturnType<typeof activePremium>;
  months: MonthSummary[]; worth: number; published: boolean; go: (t: Tab, s?: Sub) => void; setSub: (s: Sub) => void; flash: (m: string) => void;
  sub: Sub; loan: Loan; setLoan: (l: Loan) => void; whyMonth: string | null; setWhyMonth: (m: string | null) => void; monthKeys: string[]; complete: boolean;
};
type Loan = { amount: number; rate: number; tenure: number; expenses: number; existing: number; product: string; purpose: string };
const F = createContext<Ctx | null>(null);
const useF = () => useContext(F) as Ctx;

const STATUS_TONE: Record<AppStatus, 'primary' | 'good' | 'warn' | 'bad' | 'neutral'> = { submitted: 'primary', in_review: 'primary', more_info: 'warn', approved: 'good', declined: 'bad', withdrawn: 'neutral' };

export default function FarmerApp() {
  const s = useStore();
  const lang = s.lang;
  const T = (k: string) => t(lang, k);
  const today = DEMO_DATES[s.demoDate].date;
  const premium = activePremium(s);
  const [tab, setTab] = useState<Tab>('home');
  const [sub, setSub] = useState<Sub>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [whyMonth, setWhyMonth] = useState<string | null>(null);
  const [loan, setLoan] = useState<Loan>({ amount: 60000, rate: 10.5, tenure: 24, expenses: 14000, existing: 0, product: 'gpb', purpose: 'cattle' });
  const go = (t2: Tab, s2: Sub = null) => { setTab(t2); setSub(s2); window.scrollTo(0, 0); };
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  useEffect(() => { if (sub === 'signal' && !s.farmer.heard) s.setFarmer({ heard: true }); }, [sub]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = today.endsWith('-30') || today.endsWith('-31');
  const monthKeys = monthKeysUpTo(today, 7);
  const completeKeys = complete ? monthKeys : monthKeys.slice(0, -1);
  const months = useMemo(() => completeKeys.map((k) => monthSummary(k, premium, today)), [today, premium?.rate, s.incentive.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const worth = worthToFarmer(today, s.incentive.rate);
  const published = s.incentive.status === 'published';

  const ctx = { s, lang, T, today, premium, months, worth, published, go, setSub, sub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete };
  const TABS: { id: Tab; Icon: (p: { size?: number }) => JSX.Element }[] = [
    { id: 'home', Icon: IconHome }, { id: 'earnings', Icon: IconRupee }, { id: 'signals', Icon: IconNotice }, { id: 'finance', Icon: IconBank }, { id: 'ask', Icon: IconMic },
  ];
  const tabIndex = TABS.findIndex((x) => x.id === tab);
  const viewKey = `${tab}-${sub ?? 'root'}-${lang}`;
  return (
    <F.Provider value={ctx}>
    <div className="relative mx-auto min-h-screen max-w-[430px] overflow-hidden bg-milk sm:my-5 sm:min-h-[880px] sm:rounded-[34px] sm:border-[10px] sm:border-[#11152A] sm:shadow-[0_30px_60px_-30px_rgba(27,37,96,.45)]">
      <header className="sticky top-0 z-20 bg-console text-white">
        <div className="flex items-center gap-2 px-4 pb-3 pt-3.5">
          {sub ? <button aria-label={T('back')} className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10" onClick={() => setSub(null)}><IconBack /></button> : null}
          <div className="flex-1 truncate font-display text-[21px] font-bold leading-none">{sub === 'profile' ? T('profile') : T('appName')}</div>
          <LangSelect lang={lang} onChange={(l) => s.set({ lang: l })} label={T('language')} />
          <button aria-label={T('profile')} onClick={() => setSub('profile')} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"><IconUser /></button>
        </div>
      </header>

      <div key={viewKey} className={`indic px-4 pb-32 pt-4 text-[17px] ${sub ? 'animate-slide-in' : 'animate-view-in'}`}>
        {sub === 'profile' ? <Profile /> :
          tab === 'home' ? <Home /> :
          tab === 'earnings' ? (sub === 'why' ? <Why /> : <Earnings />) :
          tab === 'signals' ? (sub === 'signal' ? <SignalDetail /> : <Signals />) :
          tab === 'finance' ? <Finance /> :
          <Ask />}
      </div>

      {toast ? <div role="status" className="fixed bottom-24 left-1/2 z-30 flex w-[90%] max-w-[380px] -translate-x-1/2 animate-toast-in items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-[15px] text-white shadow-lg"><IconCheck size={18} className="text-marigold" />{toast}</div> : null}

      {tab !== 'ask' && !sub ? (
        <button aria-label={T('ask')} onClick={() => go('ask')} className="fixed bottom-[86px] z-20 flex h-14 w-14 items-center justify-center rounded-full bg-marigold text-ink shadow-[0_8px_20px_-6px_rgba(201,138,0,.7)] transition active:scale-95 sm:absolute" style={{ right: 'max(16px, calc(50% - 195px))' }}><IconMic size={24} /></button>
      ) : null}

      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:absolute sm:max-w-none" aria-label="Main">
        <div className="relative grid grid-cols-5">
          <span className="absolute top-0 h-[3px] w-[20%] rounded-b-full bg-primary transition-transform duration-300 ease-out" style={{ transform: `translateX(${tabIndex * 100}%)` }} />
          {TABS.map(({ id: k, Icon }) => {
            const dot = k === 'signals' && published && !s.farmer.heard;
            const on = tab === k;
            return (
              <button key={k} onClick={() => go(k)} aria-current={on ? 'page' : undefined} className={`relative flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[12px] transition-colors ${on ? 'font-semibold text-primary' : 'text-muted'}`}>
                <Icon size={22} />{T(k)}
                {dot ? <span className="absolute right-[28%] top-2 h-2.5 w-2.5 rounded-full bg-marigold ring-2 ring-white" /> : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
    </F.Provider>
  );
}

// ---------------- Home ----------------
function Home() {
  const { s, lang, T, today, premium, worth, published, go, monthKeys } = useF();
  const d = dayTotals(today, premium);
  const curKey = today.slice(0, 7);
  const cur = monthSummary(curKey, premium, today);
  const day = Number(today.slice(8, 10));
  const prevKey = monthKeys[monthKeys.length - 2];
  const prevTotal = Math.round(monthSummary(prevKey, premium, `${prevKey}-${String(day).padStart(2, '0')}`).total);
  const diff = cur.total - prevTotal;
  const good = d.snf >= 8.8;
  const litres = d.am + d.pm;
  const milkText = PHRASES[lang].milk(d.am.toFixed(1), d.pm.toFixed(1), d.fat.toFixed(1), d.snf.toFixed(1), d.amount);
  const monthText = PHRASES[lang].month(cur.total);
  return (
    <div className="space-y-3.5">
      <div className="pt-1">
        <div className="font-display text-[26px] font-bold leading-tight">{T('namaste')}, {FARMER.first}</div>
        <div className="text-[14px] text-muted">{FARMER.society}, {T('member')} {FARMER.memberId}</div>
      </div>

      <section className="overflow-hidden rounded-sheet border border-line bg-white">
        <div className="flex items-start justify-between px-4 pt-4">
          <div><div className="label">{T('todaysMilk')}</div>
            <div className="num font-display text-[34px] font-bold leading-none text-primary"><Count value={d.amount} format={(n) => inr(Math.round(n))} /></div></div>
          <PlayButton text={milkText} lang={lang} />
        </div>
        <div className="mt-3 grid grid-cols-2 border-t border-line text-[15px]">
          <div className="px-4 py-2.5"><div className="text-muted">{T('morning')}</div><div className="num text-[20px] font-semibold">{d.am.toFixed(1)} L</div></div>
          <div className="border-l border-line px-4 py-2.5"><div className="text-muted">{T('evening')}</div><div className="num text-[20px] font-semibold">{d.pm.toFixed(1)} L</div></div>
        </div>
        <div className="flex items-center justify-between bg-alt px-4 py-2 text-[14px]">
          <span className="num">Fat {d.fat.toFixed(1)}%, SNF {d.snf.toFixed(1)}%</span>
          <Chip tone={good ? 'good' : 'bad'}>{good ? T('goodQuality') : T('checkQuality')}</Chip>
        </div>
        <div className="h-1.5 bg-fill"><div className="bar-anim h-full bg-primary/70" style={{ width: `${Math.min(100, (litres / 18) * 100)}%` }} /></div>
      </section>

      <section className="rounded-sheet border border-line bg-white px-4 py-4">
        <div className="flex items-start justify-between">
          <div><div className="label">{T('monthSoFar')}</div>
            <div className="num font-display text-[30px] font-bold leading-tight"><Count value={cur.total} format={(n) => inr(Math.round(n))} /></div></div>
          <PlayButton text={monthText} lang={lang} />
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 text-[14px]">
          <span className={`font-semibold ${diff >= 0 ? 'text-good' : 'text-bad'}`}>{diff >= 0 ? '+' : '-'}{inr(Math.abs(diff))} {T('vsLastMonth')}</span>
          <span className="text-muted">{Math.round(cur.litres)} L, 1-{day} {MONTHS[Number(curKey.slice(5)) - 1]}</span>
        </div>
      </section>

      {published ? <SignalNotice onOpen={() => go('signals', 'signal')} /> : (
        <div className="rounded-sheet border border-dashed border-line px-4 py-5 text-center text-[15px] text-muted">{T('noSignals')}</div>
      )}
      <div className="px-1 text-[14px] text-muted">{T('alertsNone')}</div>
    </div>
  );
}

function SignalNotice({ onOpen, compact }: { onOpen: () => void; compact?: boolean }) {
  const { s, lang, T, worth } = useF();
  const fresh = !s.farmer.heard;
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      className="block w-full cursor-pointer overflow-hidden rounded-sheet bg-marigold text-left text-ink shadow-[0_10px_24px_-14px_rgba(201,138,0,.9)] transition active:scale-[0.99]">
      <div className="blockprint h-3" />
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink/75">{fresh ? T('newFromSociety') : `${T('fromSociety')}: ${FARMER.society}`}</span>
          <PlayButton tone="onMarigold" text={signalMessage(lang, { society: FARMER.society, rate: s.incentive.rate, worth })} lang={lang} />
        </div>
        <div className="mt-1 font-display text-[22px] font-bold leading-tight">{SIGNAL_TITLE[lang]}</div>
        {!compact ? <div className="mt-0.5 text-[15px]">{SIGNAL_NEED[lang](s.incentive.rate)[1]}</div> : <div className="text-[14px]">1 Apr - 30 Jun 2027</div>}
        <div className="mt-3 flex items-end justify-between">
          <div><div className="text-[13px] text-ink/75">{T('worthToYou')}</div><div className="num font-display text-[24px] font-bold leading-none">{T('about')} {inr(worth)}<span className="text-[15px] font-semibold">{T('perMonth')}</span></div></div>
          <span className="flex items-center gap-0.5 text-[14px] font-semibold">{T('seeDetails')}<IconChevron size={16} /></span>
        </div>
      </div>
    </div>
  );
}

// ---------------- Signals ----------------
function Signals() {
  const { T, published, setSub } = useF();
  return published ? <SignalNotice compact onOpen={() => setSub('signal')} />
    : <div className="rounded-sheet border border-dashed border-line px-4 py-10 text-center text-muted">{T('noSignals')}</div>;
}

function SignalDetail() {
  const { s, lang, T, worth, go, flash, loan, setLoan } = useF();
  const msg = signalMessage(lang, { society: FARMER.society, rate: s.incentive.rate, worth });
  const autoRef = useRef(false);
  const [justSent, setJustSent] = useState(false);
  useEffect(() => { if (s.autoplay && !autoRef.current) { autoRef.current = true; speak(msg, lang); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3.5">
      <div className="overflow-hidden rounded-sheet bg-marigold">
        <div className="blockprint h-3" />
        <div className="px-4 pb-4 pt-3">
          <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-ink/75">{T('fromSociety')}: {FARMER.society}</span><PlayButton tone="onMarigold" text={msg} lang={lang} /></div>
          <h2 className="mt-1 font-display text-[24px] font-bold leading-tight">{SIGNAL_TITLE[lang]}</h2>
          <div className="mt-2 space-y-0.5 text-[15px]">{SIGNAL_NEED[lang](s.incentive.rate).map((x) => <div key={x}>{x}</div>)}</div>
        </div>
      </div>
      <section className="rounded-sheet border border-good/30 bg-good-light px-4 py-4">
        <div className="label !text-good">{T('worthToYou')}</div>
        <div className="num font-display text-[30px] font-bold leading-tight text-good">{T('about')} {inr(worth)} <span className="text-[17px]">{T('perMonth')}</span></div>
        <div className="text-[13px] text-muted">{T('basedOn')}. {T('estimateOnly')}.</div>
      </section>
      <section className="rounded-sheet border border-line bg-white px-4 py-4">
        <div className="label">{T('whatYouCanDo')}</div>
        <ul className="mt-2 space-y-2 text-[15px]">{['act1', 'act2', 'act3'].map((k) => <li key={k} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{T(k)}</li>)}</ul>
        <button className="mt-3 flex items-center gap-0.5 text-[14px] font-semibold text-primary" onClick={() => { setLoan({ ...loan, product: 'scn', purpose: 'feed', amount: 30000, tenure: 12 }); go('finance', 'afford'); }}>{T('exploreFinance')}<IconChevron size={16} /></button>
      </section>
      {s.farmer.interested ? (
        <div className={`flex items-center justify-center gap-2 rounded-xl border border-good/40 bg-good-light p-3 font-semibold text-good ${justSent ? 'animate-pop' : ''}`}><IconCheck animate={justSent} />{T('interestedDone')}</div>
      ) : (
        <button className="btn-primary w-full !min-h-[54px] text-[17px]" onClick={() => { setJustSent(true); s.setFarmer({ interested: true }); s.log('Savitaben (farmer)', 'Marked interested in the summer buffalo premium'); }}>{T('interested')}</button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={() => go('ask')}>{T('askQ')}</button>
        <button className="btn-secondary" onClick={() => flash(`${T('callSociety')}: ${FARMER.society} (demo)`)}><IconPhone />{T('callSociety')}</button>
      </div>
    </div>
  );
}

// ---------------- Earnings ----------------
function Earnings() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  const [sel, setSel] = useState(months.length - 1);
  const m = months[sel];
  const data = months.map((x) => ({ m: MONTHS[Number(x.key.slice(5)) - 1], v: x.total }));
  const text = PHRASES[lang].statement(fmtMonth(m.key), Math.round(m.litres), m.total);
  return (
    <div className="space-y-3">
      <div className="card rounded-sheet p-3">
        <div className="h-40">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis hide />
              <Bar dataKey="v" radius={[6, 6, 0, 0]} onClick={(_, i) => setSel(i)} animationDuration={500}>
                {data.map((_, i) => <Cell key={i} fill={i === sel ? CHART.indigo : CHART.indigoSoft} cursor="pointer" />)}
                <LabelList dataKey="v" position="top" fontSize={10} formatter={(v: number) => `${Math.round(v / 1000)}k`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card rounded-sheet p-4">
        <div className="flex items-center justify-between"><span className="label">{T('statement')}: {fmtMonth(m.key)}</span><PlayButton text={text} lang={lang} /></div>
        <Row k={T('litres')} v={`${Math.round(m.litres)} L`} />
        <Row k={T('base')} v={inr(m.base)} />
        <Row k={T('snfBonus')} v={inr(m.snf)} />
        {m.premium ? <Row k={T('premium')} v={inr(m.premium)} good /> : null}
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3"><span className="font-semibold">{T('total')}</span><span className="num font-display text-[28px] font-bold leading-none"><Count value={m.total} format={(n) => inr(Math.round(n))} /></span></div>
      </div>
      {sel > 0 ? <button className="btn-primary w-full" onClick={() => { setWhyMonth(m.key); setSub('why'); }}>{T('whyChanged')}</button> : null}
    </div>
  );
}

function Row({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return <div className="mt-1 flex justify-between text-[15px]"><span className="text-muted">{k}</span><span className={good ? 'font-bold text-good' : ''}>{v}</span></div>;
}

function Why() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  const i = Math.max(1, months.findIndex((x) => x.key === whyMonth));
  const cur = months[i], prev = months[i - 1];
  const diff = cur.total - prev.total;
  const reasons = explainChange(prev, cur);
  const label = (k: string, a: number) => k === 'premium' ? T('rPremium') : k === 'snf' ? (a >= 0 ? T('rSnfUp') : T('rSnfDown')) : (a >= 0 ? T('rVolUp') : T('rVolDown'));
  const spoken = `${T('whyChanged')} ${diff >= 0 ? '+' : '-'}${Math.abs(diff)}. ` + reasons.map((r) => `${r.amount >= 0 ? '+' : '-'}${Math.abs(r.amount)}: ${label(r.key, r.amount)}`).join('. ');
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><span className="text-sm text-muted">{fmtMonth(cur.key)} {T('comparedWith')} {fmtMonth(prev.key)}</span><PlayButton text={spoken} lang={lang} /></div>
      <div className={`num font-display text-[38px] font-bold leading-none ${diff >= 0 ? 'text-good' : 'text-bad'}`}>{diff >= 0 ? '+' : '-'}{inr(Math.abs(diff))}</div>
      {reasons.map((r) => (
        <div key={r.key} className={`card rounded-sheet border-l-4 p-4 ${r.amount >= 0 ? '!border-l-good' : '!border-l-bad'}`}>
          <div className={`num text-[20px] font-bold ${r.amount >= 0 ? 'text-good' : 'text-bad'}`}>{r.amount >= 0 ? '+ ' : '- '}{inr(Math.abs(r.amount))}</div>
          <div className="text-[15px]">{label(r.key, r.amount)}</div>
          {r.key === 'snf' ? <div className="text-xs text-muted">SNF {prev.avgSnfBuffalo.toFixed(2)}% → {cur.avgSnfBuffalo.toFixed(2)}%</div> : null}
          {r.key === 'volume' ? <div className="text-xs text-muted">{Math.round(prev.litres)} L → {Math.round(cur.litres)} L</div> : null}
        </div>
      ))}
      {reasons.some((r) => r.key === 'premium') ? (
        <div className="rounded-xl border border-primary bg-primary-light p-4"><div className="label !text-primary">{T('whyPremium')}</div><div className="text-[15px]">{T('whyPremiumText')}</div></div>
      ) : null}
      <div className="text-sm text-muted">{T('total')}: {inr(cur.total)} ({fmtMonth(prev.key)}: {inr(prev.total)})</div>
      <button className="btn-secondary w-full" onClick={() => { s.addQuery(`Question about ${fmtMonth(cur.key)} payment`, lang); flash(T('sentToSociety')); }}>{T('talkSociety')}</button>
    </div>
  );
}

// ---------------- Finance (DairyFin) ----------------
function Finance() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete , sub } = useF();
  const last12 = months.length >= 6 ? monthKeysUpTo(today, 13).slice(complete ? 1 : 0, complete ? 13 : 12).map((k) => monthSummary(k, premium, today)) : months;
  const avg6 = Math.round(last12.slice(-6).reduce((x, m) => x + m.total, 0) / 6);
  if (sub === 'income') return <Income list={last12} />;
  if (sub === 'afford') return <Afford list={last12} />;
  if (sub === 'products') return <Products />;
  if (sub === 'consent') return <Consent />;
  if (sub === 'loanConsent') return <LoanConsent />;
  if (sub === 'apply') return <Apply />;
  if (sub === 'tracker') return <Tracker />;
  return (
    <div className="space-y-3">
      <div className="font-display text-[26px] font-bold leading-tight">{T('financeHome')}</div>
      <div className="card rounded-sheet p-4">
        <div className="flex items-center justify-between"><span className="label">{T('avgMonthly')}</span><Chip tone="warn">{T('simulated')}</Chip></div>
        <div className="num mt-0.5 font-display text-[32px] font-bold leading-tight">{inr(avg6)}</div>
        <div className="text-xs text-muted">{fmtMonth(last12[last12.length - 6].key)} - {fmtMonth(last12[last12.length - 1].key)}</div>
      </div>
      {[['income', T('incomeInsights')], ['afford', T('checkAfford')], ['products', T('exploreOptions')], ['tracker', T('trackApp')]].map(([k, l]) => (
        <button key={k} onClick={() => setSub(k as Sub)} className="card rounded-sheet flex w-full items-center justify-between px-4 py-3.5 text-left font-semibold transition hover:border-primary/40 active:scale-[0.99]">
          <span>{l}</span>{k === 'tracker' && s.application ? <Chip tone={STATUS_TONE[s.application.status]}>{T('st_' + s.application.status)}</Chip> : <IconChevron className="text-muted" />}
        </button>
      ))}
      <p className="text-xs text-muted">DairyFin is not a lender. Banks make their own decisions.</p>
    </div>
  );
}

function Income({ list }: { list: MonthSummary[] }) {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  const [n, setN] = useState(6);
  const sel = list.slice(-n);
  const data = sel.map((m) => ({ m: MONTHS[Number(m.key.slice(5)) - 1], v: m.total }));
  const total = sel.reduce((x, m) => x + m.total, 0);
  const download = () => {
    const rows = ['month,litres,net_payment_rs,source', ...sel.map((m) => `${m.key},${Math.round(m.litres)},${m.total},simulated collection records`)];
    const blob = new Blob([`Doodh Setu income report (demo data)\nFarmer: ${FARMER.name}, member ${FARMER.memberId}\nGenerated: ${new Date().toISOString()}\nNot a credit decision.\n\n${rows.join('\n')}`], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'income-report-demo.csv'; a.click();
  };
  return (
    <div className="space-y-3">
      <div className="font-display text-[24px] font-bold leading-tight">{T('incomeInsights')}</div>
      <Segmented options={[3, 6, 12].map((k) => ({ id: String(k), label: `${k} ${T('months')}` }))} value={String(n)} onChange={(v) => setN(Number(v))} />
      <div className="card rounded-sheet p-4">
        <div className="label">{T('total')}</div><div className="num font-display text-[30px] font-bold leading-tight"><Count value={total} format={(x) => inr(Math.round(x))} /></div>
        <div className="text-sm text-muted">{T('avgMonthly')}: {inr(Math.round(total / sel.length))}, {Math.round(sel.reduce((x, m) => x + m.litres, 0))} L</div>
        <div className="mt-3 h-40"><ResponsiveContainer><BarChart data={data} margin={{ top: 16, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={11} /><YAxis hide />
          <Bar dataKey="v" fill={CHART.indigo} radius={[6, 6, 0, 0]} animationDuration={500}><LabelList dataKey="v" position="top" fontSize={10} formatter={(v: number) => `${Math.round(v / 1000)}k`} /></Bar>
        </BarChart></ResponsiveContainer></div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">{sel.length} / {n} {T('coverage')} <Chip tone="warn">{T('simulated')}</Chip></div>
      </div>
      <button className="btn-secondary w-full" onClick={download}>{T('download')}</button>
    </div>
  );
}

function Afford({ list }: { list: MonthSummary[] }) {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  const income = Math.round(list.slice(-6).reduce((x, m) => x + m.total, 0) / 6);
  const lowest = Math.min(...list.map((m) => m.total));
  const emi = Math.round(emiFor(loan.amount, loan.rate, loan.tenure));
  const surplus = income - loan.expenses - loan.existing;
  const left = surplus - emi;
  const lowOk = lowest - loan.expenses - loan.existing - emi >= 0;
  const high = surplus > 0 && emi / surplus > 0.5;
  const field = (k: keyof typeof loan, l: string, extra?: string) => (
    <label className="block"><span className="text-[13px] font-semibold text-muted">{l}{extra ? <span className="font-normal"> ({extra})</span> : null}</span>
      <input className="input mt-1" type="number" inputMode="numeric" value={loan[k] as number} onChange={(e) => setLoan({ ...loan, [k]: Number(e.target.value) })} /></label>
  );
  const spoken = `${T('estimateOnly')}. ${T('emi')} ${emi}. ${T('leftAfter')} ${left}. ${lowOk ? T('lowestOk') : T('lowestBad')}. ${T('notGuaranteed')}`;
  return (
    <div className="space-y-3">
      <div className="font-display text-[24px] font-bold leading-tight">{T('checkAfford')}</div>
      {field('amount', T('loanAmount'))}{field('rate', T('interest'))}{field('tenure', T('tenure'))}
      <label className="block"><span className="text-[13px] font-semibold text-muted">{T('monthlyIncome')} <span className="font-normal">({T('fromRecords')})</span></span><div className="input mt-1 bg-fill">{inr(income)}</div></label>
      {field('expenses', T('expenses'))}{field('existing', T('existingEmi'))}
      <div className={`rounded-sheet border-2 border-dashed p-4 transition-colors duration-300 ${high || !lowOk ? 'border-marigold-deep bg-warn-light' : 'border-primary/50 bg-white'}`}>
        <div className="flex items-center justify-between"><Chip>{T('estimateOnly')}</Chip><PlayButton text={spoken} lang={lang} /></div>
        <div className="mt-2 font-display text-[28px] font-bold leading-tight">{T('emi')} <Count value={emi} format={(x) => inr(Math.round(x))} /> <span className="text-[16px] font-semibold">{T('perMonth')}</span></div>
        <div className="text-[15px]">{T('leftAfter')}: {inr(left)}</div>
        <div className={`mt-1 text-sm font-bold ${lowOk ? 'text-good' : 'text-bad'}`}>{lowOk ? T('lowestOk') : T('lowestBad')}</div>
        {high ? <div className="mt-2 text-sm font-bold text-warn">{T('emiHigh')}</div> : null}
      </div>
      {published ? <div className="rounded-xl border border-warn bg-warn-light p-3 text-sm text-warn">{T('notGuaranteed')}</div> : null}
      <button className="btn-primary w-full" onClick={() => setSub('products')}>{T('compare')}</button>
    </div>
  );
}

function Products() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  return (
    <div className="space-y-3">
      <div className="font-display text-[24px] font-bold leading-tight">{T('exploreOptions')}</div>
      <SharedData />
      {PRODUCTS_DEMO.map((p) => {
        const amt = Math.min(Math.max(loan.amount, p.min), p.max), n = Math.min(loan.tenure, p.maxTenure);
        const e = emiFor(amt, p.rate, n), fee = (amt * p.feePct) / 100;
        return (
          <div key={p.id} className="card rounded-sheet p-4">
            <div className="flex items-start justify-between gap-2"><div><div className="font-bold">{p.lender}</div><div className="text-sm">{p.name}</div></div><Chip tone="warn">{T('demoOffer')}</Chip></div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
              <span className="text-muted">{T('range')}</span><span>{inr(p.min)} - {inr(p.max)}</span>
              <span className="text-muted">{T('rate')}</span><span>{p.rate}%, {p.maxTenure} {T('months')}</span>
              <span className="text-muted">{T('fees')}</span><span>{p.feePct}% ({inr(fee)})</span>
              <span className="text-muted">{T('emi')}</span><span className="font-bold">{inr(Math.round(e))} × {n}</span>
              <span className="text-muted">{T('total')}</span><span>{inr(Math.round(e * n + fee))}</span>
            </div>
            <div className="mt-1 text-xs text-muted">{T('eligibility')}: {p.elig}, source date 31 Oct 2026 (demo)</div>
            <button className="btn-secondary mt-3 w-full" onClick={() => { setLoan({ ...loan, product: p.id, amount: amt, tenure: n, rate: p.rate }); setSub('consent'); }}>{T('startApp')}</button>
          </div>
        );
      })}
    </div>
  );
}

function Consent() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  const p = PRODUCTS_DEMO.find((x) => x.id === loan.product)!;
  const [ok, setOk] = useState(false);
  const rows: [string, string][] = [[T('sharedWith'), p.lender], [T('purpose'), T('purposeText')], [T('data'), T('dataText')], [T('period'), T('last12')], [T('keptFor'), T('keptText')], [T('youCan'), T('youCanText')]];
  return (
    <div className="space-y-3">
      <div className="font-display text-[24px] font-bold leading-tight">{T('shareRecords')}</div>
      <div className="flex items-center justify-between text-sm text-muted">{T('listenCarefully')}<PlayButton text={rows.map((r) => `${r[0]}: ${r[1]}`).join('. ')} lang={lang} /></div>
      {rows.map(([k, v]) => <div key={k} className="card rounded-sheet px-4 py-2.5"><div className="label">{k}</div><div className="text-[15px]">{v}</div></div>)}
      <label className="flex items-center gap-3 rounded-xl border border-line bg-fill p-3 font-bold"><input type="checkbox" className="h-5 w-5" checked={ok} onChange={(e) => setOk(e.target.checked)} />{T('allow')}</label>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary !min-h-[52px]" onClick={() => setSub('products')}>{T('notNow')}</button>
        <button className="btn-primary !min-h-[52px]" disabled={!ok} onClick={() => {
          s.grantConsent({ recipient: p.lender, purpose: 'Assess loan application', scope: 'Milk quantity and payments', period: 'Last 12 months', language: lang, method: 'digital' });
          setSub('loanConsent');
        }}>{T('continue')}</button>
      </div>
    </div>
  );
}

// "When you apply, this is also shared" (Explore finance options)
function SharedData() {
  const { lang, T } = useF();
  const F = fin(lang);
  const items: [string, string, string][] = [
    [F.kycTitle, F.kycText, KYC.map((k) => `${k.type} ${k.masked}`).join(' | ')],
    [F.landTitle, F.landText, `${PROPERTY.record}, survey ${PROPERTY.survey}, ${PROPERTY.village}`],
    [F.creditTitle, F.creditText, `${CREDIT.bureau} ${CREDIT.score}`],
    [F.milkTitle, F.milkText, ''],
  ];
  return (
    <div className="rounded-sheet border border-primary/25 bg-primary-light p-4">
      <div className="flex items-start justify-between gap-2"><div className="font-bold text-primary">{F.alsoShared}</div><PlayButton text={[F.alsoShared, ...items.map((i) => `${i[0]}: ${i[1]}`)].join('. ')} lang={lang} /></div>
      <div className="mt-0.5 text-[13px] text-muted">{F.alsoSharedSub}</div>
      <ul className="mt-2 space-y-2">{items.map(([t1, d, v]) => (
        <li key={t1} className="text-[14px]"><div className="font-semibold">{t1}</div><div className="text-muted">{d}</div>{v ? <div className="num mt-0.5 text-[12px]">{v} <Chip tone="warn">{T('simulated')}</Chip></div> : null}</li>
      ))}</ul>
    </div>
  );
}

// DPDP consent for sharing farmer information for loan applications (consent_records)
function LoanConsent() {
  const { s, lang, T, setSub, loan } = useF();
  const p = PRODUCTS_DEMO.find((x) => x.id === loan.product)!;
  const F = fin(lang);
  const [ticks, setTicks] = useState([false, false, false]);
  const all = ticks.every(Boolean);
  const spoken = [F.consentTitle, F.consentIntro, ...F.notice.map(([k, v]) => `${k}: ${v}`), ...F.statements].join('. ');
  return (
    <div className="space-y-3">
      <div className="font-display text-[23px] font-bold leading-tight">{F.consentTitle}</div>
      <div className="flex items-center justify-between gap-2 text-sm text-muted">{F.consentIntro}<PlayButton text={spoken} lang={lang} /></div>
      <div className="card rounded-sheet p-4">
        <div className="label">{F.noticeTitle}</div>
        <dl className="mt-2 space-y-2 text-[14px]">{[[T('sharedWith'), p.lender] as [string, string], ...F.notice].map(([k, v]) => <div key={k}><dt className="font-semibold">{k}</dt><dd className="text-muted">{v}</dd></div>)}</dl>
      </div>
      {F.statements.map((st, i) => (
        <label key={i} className={`flex gap-3 rounded-xl border p-3 text-[14px] leading-snug transition-colors ${ticks[i] ? 'border-primary bg-primary-light' : 'border-line bg-white'}`}>
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={ticks[i]} onChange={(e) => setTicks(ticks.map((t0, j) => (j === i ? e.target.checked : t0)))} />{st}
        </label>
      ))}
      <div className="text-xs text-muted">{F.version} {NOTICE_VERSION}</div>
      {!all ? <div className="text-sm text-muted">{F.tickAll}</div> : null}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary !min-h-[52px]" onClick={() => setSub('products')}>{T('notNow')}</button>
        <button className="btn-primary !min-h-[52px]" disabled={!all} onClick={() => {
          s.grantConsent({ recipient: p.lender, purpose: 'Loan assessment, verification and processing', scope: 'Identity and KYC, land and property records, credit history, milk income', period: 'Until the application is decided, then as the law requires', noticeVersion: NOTICE_VERSION, categories: [...CATEGORIES], method: 'digital', language: lang, statements: 3 });
          setSub('apply');
        }}>{F.agree}</button>
      </div>
    </div>
  );
}

function Apply() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  const p = PRODUCTS_DEMO.find((x) => x.id === loan.product)!;
  const F = fin(lang);
  const lc = s.consents.find((x) => x.recipient === p.lender && x.status === 'active' && x.noticeVersion);
  return (
    <div className="space-y-3">
      <div className="font-display text-[24px] font-bold leading-tight">{T('application')}</div>
      <div className="card rounded-sheet p-4 text-[15px]"><div className="font-bold">{p.lender}</div><div>{p.name}</div>
        <div className="mt-1">{inr(loan.amount)}, {loan.tenure} {T('months')}, {p.rate}%</div></div>
      <div className="card rounded-sheet p-4"><div className="label">{T('documents')}</div>
        <div className="mt-2 space-y-1.5 text-[15px]">
          <div className="flex items-start gap-2"><IconCheck size={18} className="mt-0.5 shrink-0 text-good" /><span>{F.kycTitle}: {KYC.map((k) => `${k.type} ${k.masked}`).join(', ')}</span></div>
          <div className="flex items-start gap-2"><IconCheck size={18} className="mt-0.5 shrink-0 text-good" /><span>{F.landTitle}: {PROPERTY.record}, survey {PROPERTY.survey}</span></div>
          <div className="flex items-start gap-2"><IconCheck size={18} className="mt-0.5 shrink-0 text-good" /><span>{F.creditTitle}: {CREDIT.bureau} {CREDIT.score}</span></div>
          <div className="flex items-center gap-2"><IconCheck size={18} className="text-good" />{T('bankAcc')}</div>
          <div className="flex items-center gap-2 text-muted"><span className="mx-[3px] h-3 w-3 rounded-full border-2 border-line" />{T('cattleQuote')}</div>
        </div>
        {lc ? <div className="mt-2 text-xs text-muted">{F.version} {lc.noticeVersion}, consent {lc.id}</div> : null}</div>
      <p className="text-sm text-muted">{T('bankDecides')}</p>
      <button className="btn-primary w-full" onClick={() => {
        const c = s.consents.find((x) => x.recipient === p.lender && x.status === 'active' && !x.noticeVersion);
        s.submitApplication({ product: p.name, lender: p.lender, amount: loan.amount, tenure: loan.tenure, rate: p.rate, consentId: c?.id ?? '', loanConsentId: lc?.id });
        setSub('tracker');
      }}>{T('submit')}</button>
    </div>
  );
}

function Tracker() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  const a = s.application;
  if (!a) return <div className="rounded-sheet border border-dashed border-line p-8 text-center text-muted">{T('noApp')}</div>;
  return (
    <div className="space-y-3">
      <div className="card rounded-sheet p-4"><div className="flex items-center justify-between"><span className="font-bold">{T('reference')} {a.ref}</span><Chip tone={STATUS_TONE[a.status]}>{T('st_' + a.status)}</Chip></div>
        <div className="text-sm">{a.lender}, {a.product}, {inr(a.amount)}</div></div>
      {a.status === 'more_info' ? (
        <div className="animate-pop rounded-sheet border border-marigold-deep/40 bg-warn-light p-4"><div className="font-bold text-warn">{T('docRequested')}</div><div className="text-sm">{T('cattleQuote')}</div>
          <button className="btn-primary mt-2 w-full" onClick={() => { s.uploadDoc(); flash(T('uploaded')); }}>{T('upload')}</button></div>
      ) : null}
      <div className="card rounded-sheet p-4">
        <div className="label">{T('status')}</div>
        <ol className="mt-3 space-y-4 border-l-2 border-line pl-5">
          {a.history.map((h, i) => (
            <li key={i} className="relative animate-view-in"><span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${i === a.history.length - 1 ? 'bg-primary' : 'bg-line'}`} /><div className="font-semibold">{T('st_' + h.status)}</div><div className="text-xs text-muted">{new Date(h.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div><div className="text-sm">{h.note}</div></li>
          ))}
        </ol>
      </div>
      <p className="text-sm text-muted">{T('bankDecides')}</p>
      {['submitted', 'in_review', 'more_info'].includes(a.status) ? <button className="btn-quiet w-full" onClick={() => s.setAppStatus('withdrawn', 'Withdrawn by farmer')}>{T('withdraw')}</button> : null}
    </div>
  );
}

// ---------------- Ask ----------------
type Answer = { text: string; bullets?: string[]; ai: boolean; handoff?: boolean; why?: string };
// Other languages show English until reviewed translations are added.
const VOICE_ERR: Record<string, Partial<Record<Lang, string>> & { en: string }> = {
  mic: { en: 'Microphone is blocked. Allow microphone access for this site, then try again.', hi: 'माइक्रोफ़ोन बंद है। इस साइट के लिए माइक्रोफ़ोन की अनुमति दें, फिर कोशिश करें।', gu: 'માઇક્રોફોન બંધ છે. આ સાઇટ માટે માઇક્રોફોનની મંજૂરી આપો, પછી ફરી પ્રયાસ કરો.' },
  heard: { en: 'Could not hear clearly. Try again or type.', hi: 'साफ़ सुनाई नहीं दिया। फिर से बोलें या लिखें।', gu: 'સ્પષ્ટ સંભળાયું નહીં. ફરી બોલો અથવા લખો.' },
  switched: { en: 'Gnani voice did not respond, switched to the browser voice. Tap and speak again.', hi: 'Gnani आवाज़ ने जवाब नहीं दिया, ब्राउज़र की आवाज़ पर बदला। फिर से दबाएँ और बोलें।', gu: 'Gnani અવાજે જવાબ ન આપ્યો, બ્રાઉઝર અવાજ પર ફેરવ્યું. ફરી દબાવો અને બોલો.' },
  none: { en: 'Voice is not available in this browser. Please type, or open the app in Chrome.', hi: 'इस ब्राउज़र में आवाज़ उपलब्ध नहीं है। कृपया लिखें, या Chrome में खोलें।', gu: 'આ બ્રાઉઝરમાં અવાજ ઉપલબ્ધ નથી. કૃપા કરી લખો, અથવા Chrome માં ખોલો.' },
};
const AI_LABEL: Partial<Record<Lang, string>> & { en: string } = { en: 'AI answer from your records', hi: 'आपके रिकॉर्ड से AI जवाब', gu: 'તમારા રેકોર્ડ પરથી AI જવાબ' };

function Ask() {
  const { s, lang, T, today, premium, flash } = useF();
  const [q, setQ] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const [ans, setAns] = useState<Answer | null>(null);
  const [state, setState] = useState<'idle' | 'listening' | 'working' | 'error'>('idle');
  const [err, setErr] = useState<string>('heard');
  const [gnaniOn, setGnaniOn] = useState(false);
  const [hasBrowser, setHasBrowser] = useState(false);
  const [forceBrowser, setForceBrowser] = useState(false);
  const mode: 'gnani' | 'browser' | 'none' = gnaniOn && !forceBrowser && STT_LANGS.includes(lang) ? 'gnani' : hasBrowser ? 'browser' : 'none';
  const [fb, setFb] = useState<string | null>(null);
  const rec = useRef<Recorder | null>(null);
  const history = useRef<{ q: string; a: string }[]>([]);
  useEffect(() => { setHasBrowser(!!browserRecognition()); voiceHealth().then((h) => setGnaniOn(h.gnani)); }, []);
  const fail = (k: string) => { setErr(k); setState('error'); };

  const run = async (text: string, voice: boolean) => {
    setSaid(text); setFb(null); setAns(null); setState('working');
    let a: Answer | null = null, why = 'AI not reachable';
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, lang, name: FARMER.first, history: history.current, context: buildContext(today, premium) }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { a = { text: j.text, bullets: j.bullets?.length ? j.bullets : undefined, ai: true, handoff: j.handoff }; history.current = [...history.current, { q: text, a: [j.text, ...(j.bullets ?? [])].join(' ') }].slice(-3); }
      else why = r.status === 501 ? 'AI key not set on the server (GEMINI_API_KEY)' : `AI error: ${String(j.error ?? r.status).slice(0, 120)}`;
    } catch { /* fall back to rule-based answer */ }
    if (!a) { const f = answer(text, lang, today, premium); a = { text: f.text, bullets: f.bullets, ai: false, handoff: f.intent === 'unknown', why }; }
    setAns(a); setState('idle');
    if (voice) speak([a.text, ...(a.bullets ?? [])].join('. '), lang);
  };

  const listenBrowser = () => {
    const R = browserRecognition();
    if (!R) { fail('none'); return; }
    const r = new R(); r.lang = LANG_CODE[lang]; r.interimResults = false; r.maxAlternatives = 1;
    let got = false;
    r.onresult = (e) => { got = true; run(e.results[0][0].transcript, true); };
    r.onerror = () => { if (!got) fail('heard'); };
    r.onend = () => { if (!got) setState((x) => (x === 'listening' ? (setErr('heard'), 'error') : x)); };
    rec.current = { stop: () => r.stop() }; r.start();
  };

  const start = async () => {
    if (state === 'listening') { rec.current?.stop(); return; }
    if (state === 'working') return;
    stopSpeaking();
    setState('listening');
    try {
      if (mode === 'gnani') {
        rec.current = await recordWav(async (wav) => {
          if (!wav) { fail('heard'); return; }
          setState('working');
          const tx = await transcribe(wav, lang);
          if (tx.text) { run(tx.text, true); return; }
          if (tx.error !== 'empty' && browserRecognition()) { setForceBrowser(true); fail('switched'); return; }
          fail('heard');
        });
      } else if (mode === 'browser') listenBrowser();
      else fail('none');
    } catch (e) {
      const name = (e as { name?: string })?.name;
      fail(name === 'NotAllowedError' || name === 'SecurityError' || name === 'NotFoundError' ? 'mic' : 'heard');
    }
  };

  const full = ans ? [ans.text, ...(ans.bullets ?? [])].join('. ') : '';
  return (
    <div className="space-y-3">
      {said ? (
        <div className="animate-view-in rounded-sheet border border-line bg-fill p-3.5"><div className="label">{T('youSaid')}</div><div className="italic">“{said}”</div>
          <button className="mt-1 text-sm font-bold text-primary" onClick={() => { setSaid(null); setAns(null); setState('idle'); }}>{T('tryAgain')}</button></div>
      ) : null}
      {state === 'working' && said ? <div className="card rounded-sheet animate-view-in p-4 text-muted">{T('thinking')}</div> : null}
      {ans ? (
        <div className="card rounded-sheet animate-view-in p-4">
          <div className="flex items-center justify-between"><Chip tone={ans.ai ? 'primary' : undefined}>{ans.ai ? AI_LABEL[lang] ?? AI_LABEL.en : T('automated')}</Chip><PlayButton text={full} lang={lang} /></div>
          <div className="mt-2">{ans.text}</div>
          {ans.why ? <div className="mt-1 text-[11px] text-muted">Scripted answer because: {ans.why}</div> : null}
          {ans.bullets ? <ul className="mt-1 list-disc pl-5 text-[15px]">{ans.bullets.map((b) => <li key={b}>{b}</li>)}</ul> : null}
          <div className="mt-2 flex items-center gap-3 text-sm text-muted">{T('helpful')} <button className="font-bold text-primary" onClick={() => setFb('y')}>{T('yes')}</button><button className="font-bold text-primary" onClick={() => setFb('n')}>{T('no')}</button>{fb ? <IconCheck size={16} className="text-good" /> : null}</div>
          <button className={`${ans.handoff ? 'btn-primary' : 'btn-secondary'} mt-3 w-full`} onClick={() => { s.addQuery(said ?? '', lang); flash(T('sentToSociety')); }}>{T('talkPerson')}</button>
        </div>
      ) : null}
      <div className="label pt-1 text-center">{T('suggested')}</div>
      <div className="flex flex-col items-center gap-2">
        {['sq1', 'sq2', 'sq3', 'sq4'].map((k) => <button key={k} disabled={state === 'working'} onClick={() => run(T(k), false)} className="w-full max-w-[340px] rounded-full border border-line bg-white px-4 py-2 text-[15px] transition hover:border-primary/40 hover:bg-primary-light active:scale-[0.99]">{T(k)}</button>)}
      </div>
      <form className="flex gap-2 pt-2" onSubmit={(e) => { e.preventDefault(); if (q.trim() && state !== 'working') { run(q.trim(), false); setQ(''); } }}>
        <input className="input" placeholder={T('typeInstead')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-quiet" type="submit" aria-label="Ask"><IconSend /></button>
      </form>
      <div className="flex flex-col items-center pt-4">
        <button aria-label={T('tapSpeak')} onClick={start} className={`flex h-[84px] w-[84px] items-center justify-center rounded-full transition ${state === 'listening' ? 'listening bg-primary text-white' : 'bg-marigold text-ink shadow-[0_10px_24px_-10px_rgba(201,138,0,.8)] active:scale-95'}`}>{state === 'listening' ? <Waveform bars={5} className="!h-7 [&>span]:!w-1" color="#fff" /> : <IconMic size={34} />}</button>
        <div className="mt-2 max-w-[340px] text-center text-sm text-muted">{state === 'listening' ? T('listening') : state === 'working' ? T('thinking') : state === 'error' ? VOICE_ERR[err]?.[lang] ?? VOICE_ERR[err]?.en ?? VOICE_ERR.heard.en : T('tapSpeak')}</div>
        <div className="mt-1 text-[11px] text-muted">{T('voiceSource')}: {mode === 'gnani' ? 'Gnani.ai' : mode === 'browser' ? 'browser' : 'not available, please type'}</div>
      </div>
    </div>
  );
}

// ---------------- Profile ----------------
function Profile() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  return (
    <div className="space-y-3">
      <div className="card rounded-sheet p-4"><div className="font-bold">{FARMER.name}</div><div className="text-sm text-muted">{FARMER.society}, {T('member')} {FARMER.memberId}, {FARMER.village}</div>
        <div className="text-sm text-muted">{FARMER.animals.buffalo} buffaloes, {FARMER.animals.cow} cow</div></div>
      <div className="card rounded-sheet p-4"><div className="label">{T('language')}</div>
        <div className="mt-2 grid grid-cols-2 gap-2">{LANGS.map((l) => <button key={l.id} onClick={() => s.set({ lang: l.id })} aria-pressed={lang === l.id} className={`flex items-center justify-between rounded-xl border px-3.5 py-2 text-left transition-colors ${lang === l.id ? 'border-primary bg-primary text-white' : 'border-line bg-white hover:bg-alt'}`}><span>{l.native}</span>{lang === l.id ? <IconCheck size={16} /> : <span className="text-[12px] text-muted">{l.name}</span>}</button>)}</div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.autoplay} onChange={(e) => s.set({ autoplay: e.target.checked })} /> Play messages aloud automatically</label>
      </div>
      <div className="card rounded-sheet p-4"><div className="label">{T('myData')}</div><p className="mt-1 text-[15px]">{T('myDataText')}</p>
        <button className="btn-quiet mt-2 w-full" disabled={s.farmer.correction} onClick={() => { s.setFarmer({ correction: true }); s.addQuery('Data correction request', lang); }}>{s.farmer.correction ? T('requested') : T('requestCorrection')}</button></div>
      <div className="card rounded-sheet p-4"><div className="label">{T('consents')}</div>
        <div className="mt-2 flex items-center justify-between text-sm"><span>Signals from {FARMER.society}</span><Chip tone="good">active</Chip></div>
        {s.consents.map((c) => (
          <div key={c.id} className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2 text-sm">
            <span>{c.id}: {c.recipient}<br /><span className="text-xs text-muted">{c.purpose}, {c.period}{c.noticeVersion ? `. Notice ${c.noticeVersion}` : ''}</span></span>
            {c.status === 'active' ? <button className="btn-quiet !min-h-[34px] !px-3 text-xs" onClick={() => s.withdrawConsent(c.id)}>{T('withdraw')}</button> : <Chip>{T('withdrawn')}</Chip>}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Grievance officer (demo): grievance@doodhsetu.example, Your data stays in India.</p>
    </div>
  );
}

// Language picker in the header: a native select, so phones show their own list
function LangSelect({ lang, onChange, label }: { lang: Lang; onChange: (l: Lang) => void; label: string }) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{label}</span>
      <svg className="pointer-events-none absolute left-2.5 text-marigold" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9s-1.3 6.2-3.8 9c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3Z" /></svg>
      <select aria-label={label} value={lang} onChange={(e) => onChange(e.target.value as Lang)}
        className="h-9 max-w-[140px] cursor-pointer appearance-none truncate rounded-full border-0 bg-white/10 pl-8 pr-7 text-[14px] font-semibold text-white outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-marigold [&>option]:text-ink">
        {LANGS.map((l) => <option key={l.id} value={l.id}>{l.native}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2.5 text-white/80" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
    </label>
  );
}
