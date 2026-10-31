'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import { useStore, activePremium, type AppStatus } from '@/lib/store';
import { DEMO_DATES, FARMER } from '@/lib/demo';
import { LANGS, SIGNAL_NEED, SIGNAL_TITLE, signalMessage, t, type Lang } from '@/lib/i18n';
import { dayTotals, explainChange, monthKeysUpTo, monthSummary, SESSIONS, worthToFarmer, type MonthSummary } from '@/lib/farmer';
import { answer } from '@/lib/ask';
import { browserRecognition, recordWav, speak, transcribe, voiceHealth, type Recorder } from '@/lib/voice';
import { fmtMonth, inr, MONTHS } from '@/lib/util';
import { Chip, PlayButton } from './ui';

type Tab = 'home' | 'earnings' | 'signals' | 'finance' | 'ask';
type Sub = null | 'signal' | 'why' | 'income' | 'afford' | 'products' | 'consent' | 'apply' | 'tracker' | 'profile';

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
  return (
    <F.Provider value={ctx}>
    <div className="mx-auto min-h-screen max-w-[430px] bg-white shadow-sm sm:my-4 sm:min-h-[860px] sm:rounded-[28px] sm:border-2 sm:border-ink">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-alt px-4 py-3 sm:rounded-t-[26px]">
        {sub ? <button aria-label={T('back')} className="px-1 text-xl font-bold" onClick={() => setSub(null)}>‹</button> : null}
        <div className="flex-1 truncate text-[17px] font-bold">{sub === 'profile' ? T('profile') : T('appName')}</div>
        <div className="flex overflow-hidden rounded-full border border-line text-[11px] font-bold">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => s.set({ lang: l.id })} className={`px-2 py-1 ${lang === l.id ? 'bg-primary text-white' : 'bg-white text-ink'}`}>{l.id.toUpperCase()}</button>
          ))}
        </div>
        <button aria-label={T('profile')} onClick={() => setSub('profile')} className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-sm">👤</button>
      </header>

      <div className="indic px-4 pb-28 pt-4 text-[17px]">
        {sub === 'profile' ? <Profile /> :
          tab === 'home' ? <Home /> :
          tab === 'earnings' ? (sub === 'why' ? <Why /> : <Earnings />) :
          tab === 'signals' ? (sub === 'signal' ? <SignalDetail /> : <Signals />) :
          tab === 'finance' ? <Finance /> :
          <Ask />}
      </div>

      {toast ? <div className="fixed bottom-24 left-1/2 z-30 w-[90%] max-w-[380px] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">{toast}</div> : null}

      {tab !== 'ask' && !sub ? (
        <button aria-label={T('ask')} onClick={() => go('ask')} className="fixed bottom-24 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-white shadow-lg sm:absolute" style={{ right: 'max(16px, calc(50% - 199px))' }}>🎤</button>
      ) : null}

      <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-5 border-t border-line bg-alt sm:rounded-b-[26px]">
        {(['home', 'earnings', 'signals', 'finance', 'ask'] as Tab[]).map((k) => {
          const icon = { home: '🏠', earnings: '₹', signals: '📣', finance: '🏦', ask: '🎤' }[k];
          const dot = k === 'signals' && published && !s.farmer.heard;
          return (
            <button key={k} onClick={() => go(k)} className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${tab === k ? 'font-bold text-primary' : 'text-muted'}`}>
              <span className="text-lg">{icon}</span>{T(k)}
              {dot ? <span className="absolute right-[30%] top-1.5 h-2.5 w-2.5 rounded-full bg-warn" /> : null}
            </button>
          );
        })}
      </nav>
    </div>
    </F.Provider>
  );
}

// ---------------- Home ----------------
function Home() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  const d = dayTotals(today, premium);
  const curKey = today.slice(0, 7);
  const cur = monthSummary(curKey, premium, today);
  const day = Number(today.slice(8, 10));
  const prevKey = monthKeys[monthKeys.length - 2];
  const prevSame = SESSIONS.filter((x) => x.date.startsWith(prevKey) && Number(x.date.slice(8, 10)) <= day);
  const prevTotal = Math.round(monthSummary(prevKey, premium, `${prevKey}-${String(day).padStart(2, '0')}`).total);
  void prevSame;
  const diff = cur.total - prevTotal;
  const good = d.snf >= 8.8;
  const milkText = lang === 'gu' ? `આજે સવારે ${d.am.toFixed(1)} લિટર, સાંજે ${d.pm.toFixed(1)} લિટર. ફેટ ${d.fat.toFixed(1)} ટકા, એસએનએફ ${d.snf.toFixed(1)} ટકા. આજની રકમ ${d.amount} રૂપિયા.`
    : lang === 'hi' ? `आज सुबह ${d.am.toFixed(1)} लीटर, शाम ${d.pm.toFixed(1)} लीटर। फैट ${d.fat.toFixed(1)} प्रतिशत, एसएनएफ ${d.snf.toFixed(1)} प्रतिशत। आज की राशि ${d.amount} रुपये।`
    : `Today ${d.am.toFixed(1)} litres in the morning and ${d.pm.toFixed(1)} in the evening. Fat ${d.fat.toFixed(1)} percent, SNF ${d.snf.toFixed(1)} percent. Today's amount ${d.amount} rupees.`;
  const monthText = lang === 'gu' ? `આ મહિને અત્યાર સુધી ${cur.total} રૂપિયા.` : lang === 'hi' ? `इस महीने अब तक ${cur.total} रुपये।` : `This month so far ${cur.total} rupees.`;
  return (
    <div className="space-y-3">
      <div>
        <div className="text-lg font-bold">{T('namaste')}, {FARMER.first}</div>
        <div className="text-xs text-muted">{FARMER.society} | {T('member')} {FARMER.memberId}</div>
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between"><span className="label">{T('todaysMilk')}</span><PlayButton text={milkText} lang={lang} /></div>
        <div className="mt-2 grid grid-cols-2 gap-2 font-bold"><div>{T('morning')} {d.am.toFixed(1)} L</div><div>{T('evening')} {d.pm.toFixed(1)} L</div></div>
        <div className="mt-1 flex items-center gap-2 text-sm">Fat {d.fat.toFixed(1)}% · SNF {d.snf.toFixed(1)}% <Chip tone={good ? 'good' : 'bad'}>{good ? T('goodQuality') : T('checkQuality')}</Chip></div>
        <div className="mt-3 border-t border-line pt-2 text-2xl font-bold text-primary">{inr(d.amount)} <span className="text-base font-normal text-muted">{T('today')}</span></div>
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between"><span className="label">{T('monthSoFar')}</span><PlayButton text={monthText} lang={lang} /></div>
        <div className="mt-1 flex items-baseline gap-3"><span className="text-3xl font-bold">{inr(cur.total)}</span>
          <span className={`text-sm font-bold ${diff >= 0 ? 'text-good' : 'text-bad'}`}>{diff >= 0 ? '+' : '-'}{inr(Math.abs(diff))} {T('vsLastMonth')}</span></div>
        <div className="text-xs text-muted">{Math.round(cur.litres)} L · 1-{day} {MONTHS[Number(curKey.slice(5)) - 1]}</div>
      </div>
      {published ? (
        <button onClick={() => go('signals', 'signal')} className={`card block w-full p-4 text-left ${s.farmer.heard ? '' : 'border-warn bg-warn-light'}`}>
          <div className="flex items-center justify-between"><Chip tone={s.farmer.heard ? 'primary' : 'warn'}>{s.farmer.heard ? `${T('fromSociety')}: ${FARMER.society}` : T('newFromSociety')}</Chip>
            <PlayButton text={signalMessage(lang, { society: FARMER.society, rate: s.incentive.rate, worth })} lang={lang} /></div>
          <div className="mt-2 font-bold">{SIGNAL_TITLE[lang]}</div>
          <div className="text-sm">{SIGNAL_NEED[lang](s.incentive.rate)[1]}</div>
          <div className="mt-1 text-sm font-bold text-warn">{T('worthToYou')}: {T('about')} {inr(worth)} {T('perMonth')}</div>
          <div className="mt-1 text-sm font-bold text-primary">{T('seeDetails')} ›</div>
        </button>
      ) : (
        <div className="card border-dashed p-4 text-sm text-muted">{T('noSignals')}</div>
      )}
      <div className="card border-dashed p-4 text-sm text-muted">{T('alertsNone')}</div>
    </div>
  );
}

// ---------------- Signals ----------------
function Signals() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  return published ? (
    <button onClick={() => setSub('signal')} className="card block w-full p-4 text-left">
      <Chip tone="primary">{T('fromSociety')}: {FARMER.society}</Chip>
      <div className="mt-2 font-bold">{SIGNAL_TITLE[lang]}</div>
      <div className="text-sm text-muted">1 Apr - 30 Jun 2027</div>
      <div className="mt-1 text-sm font-bold text-primary">{T('seeDetails')} ›</div>
    </button>
  ) : <div className="card border-dashed p-6 text-center text-muted">{T('noSignals')}</div>;
}

function SignalDetail() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  const msg = signalMessage(lang, { society: FARMER.society, rate: s.incentive.rate, worth });
  const autoRef = useRef(false);
  useEffect(() => { if (s.autoplay && !autoRef.current) { autoRef.current = true; speak(msg, lang); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><Chip tone="primary">{T('fromSociety')}: {FARMER.society}</Chip><PlayButton text={msg} lang={lang} /></div>
      <h2 className="text-lg font-bold">{SIGNAL_TITLE[lang]}</h2>
      <div className="card p-4"><div className="label">{T('whatNeeded')}</div>{SIGNAL_NEED[lang](s.incentive.rate).map((x) => <div key={x} className="mt-1">{x}</div>)}</div>
      <div className="rounded-xl border border-good bg-good-light p-4">
        <div className="label !text-good">{T('worthToYou')}</div>
        <div className="text-2xl font-bold text-good">{T('about')} {inr(worth)} {T('perMonth')}</div>
        <div className="text-xs italic text-muted">{T('basedOn')} · {T('estimateOnly')}</div>
      </div>
      <div className="card p-4">
        <div className="label">{T('whatYouCanDo')}</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]"><li>{T('act1')}</li><li>{T('act2')}</li><li>{T('act3')}</li></ul>
        <button className="mt-3 text-sm font-bold text-primary" onClick={() => { setLoan({ ...loan, product: 'scn', purpose: 'feed', amount: 30000, tenure: 12 }); go('finance', 'afford'); }}>{T('exploreFinance')} ›</button>
      </div>
      {s.farmer.interested ? <div className="rounded-xl border border-good bg-good-light p-3 text-center font-bold text-good">✓ {T('interestedDone')}</div> :
        <button className="btn-primary w-full !min-h-[52px]" onClick={() => { s.setFarmer({ interested: true }); s.log('Savitaben (farmer)', 'Marked interested in the summer buffalo premium'); flash(T('interestedDone')); }}>{T('interested')}</button>}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={() => go('ask')}>{T('askQ')}</button>
        <button className="btn-secondary" onClick={() => flash(`📞 ${FARMER.society} (demo)`)}>{T('callSociety')}</button>
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
  const text = lang === 'gu' ? `${fmtMonth(m.key)} માં ${Math.round(m.litres)} લિટર, કુલ ${m.total} રૂપિયા.` : lang === 'hi' ? `${fmtMonth(m.key)} में ${Math.round(m.litres)} लीटर, कुल ${m.total} रुपये।` : `${fmtMonth(m.key)}: ${Math.round(m.litres)} litres, total ${m.total} rupees.`;
  return (
    <div className="space-y-3">
      <div className="card p-3">
        <div className="h-40">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis hide />
              <Bar dataKey="v" radius={[4, 4, 0, 0]} onClick={(_, i) => setSel(i)}>
                {data.map((_, i) => <Cell key={i} fill={i === sel ? '#1F5FA8' : '#B5CDEB'} cursor="pointer" />)}
                <LabelList dataKey="v" position="top" fontSize={10} formatter={(v: number) => `${Math.round(v / 1000)}k`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between"><span className="label">{T('statement')}: {fmtMonth(m.key)}</span><PlayButton text={text} lang={lang} /></div>
        <Row k={T('litres')} v={`${Math.round(m.litres)} L`} />
        <Row k={T('base')} v={inr(m.base)} />
        <Row k={T('snfBonus')} v={inr(m.snf)} />
        {m.premium ? <Row k={T('premium')} v={inr(m.premium)} good /> : null}
        <div className="mt-2 flex justify-between border-t border-line pt-2 text-xl font-bold"><span>{T('total')}</span><span>{inr(m.total)}</span></div>
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
      <div className={`text-2xl font-bold ${diff >= 0 ? 'text-good' : 'text-bad'}`}>{diff >= 0 ? '+' : '-'}{inr(Math.abs(diff))}</div>
      {reasons.map((r) => (
        <div key={r.key} className="card p-4">
          <div className={`text-lg font-bold ${r.amount >= 0 ? 'text-good' : 'text-bad'}`}>{r.amount >= 0 ? '+ ' : '- '}{inr(Math.abs(r.amount))}</div>
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
  if (sub === 'apply') return <Apply />;
  if (sub === 'tracker') return <Tracker />;
  return (
    <div className="space-y-3">
      <div className="text-lg font-bold">{T('financeHome')}</div>
      <div className="card p-4">
        <div className="flex items-center justify-between"><span className="label">{T('avgMonthly')}</span><Chip tone="warn">{T('simulated')}</Chip></div>
        <div className="mt-1 text-3xl font-bold">{inr(avg6)}</div>
        <div className="text-xs text-muted">{fmtMonth(last12[last12.length - 6].key)} - {fmtMonth(last12[last12.length - 1].key)}</div>
      </div>
      {[['income', T('incomeInsights')], ['afford', T('checkAfford')], ['products', T('exploreOptions')], ['tracker', T('trackApp')]].map(([k, l]) => (
        <button key={k} onClick={() => setSub(k as Sub)} className="card flex w-full items-center justify-between p-4 text-left font-bold">
          <span>{l}</span>{k === 'tracker' && s.application ? <Chip tone={STATUS_TONE[s.application.status]}>{T('st_' + s.application.status)}</Chip> : <span className="text-muted">›</span>}
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
      <div className="text-lg font-bold">{T('incomeInsights')}</div>
      <div className="flex gap-2">{[3, 6, 12].map((k) => <button key={k} onClick={() => setN(k)} className={`rounded-full border px-3 py-1 text-sm ${n === k ? 'border-primary bg-primary-light font-bold text-primary' : 'border-line'}`}>{k} {T('months')}</button>)}</div>
      <div className="card p-4">
        <div className="label">{T('total')}</div><div className="text-2xl font-bold">{inr(total)}</div>
        <div className="text-sm text-muted">{T('avgMonthly')}: {inr(Math.round(total / sel.length))} · {Math.round(sel.reduce((x, m) => x + m.litres, 0))} L</div>
        <div className="mt-3 h-40"><ResponsiveContainer><BarChart data={data} margin={{ top: 16, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={11} /><YAxis hide />
          <Bar dataKey="v" fill="#1F5FA8" radius={[3, 3, 0, 0]}><LabelList dataKey="v" position="top" fontSize={10} formatter={(v: number) => `${Math.round(v / 1000)}k`} /></Bar>
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
    <label className="block"><span className="text-xs font-bold text-muted">{l}{extra ? <span className="font-normal"> ({extra})</span> : null}</span>
      <input className="input mt-1" type="number" inputMode="numeric" value={loan[k] as number} onChange={(e) => setLoan({ ...loan, [k]: Number(e.target.value) })} /></label>
  );
  const spoken = `${T('estimateOnly')}. ${T('emi')} ${emi}. ${T('leftAfter')} ${left}. ${lowOk ? T('lowestOk') : T('lowestBad')}. ${T('notGuaranteed')}`;
  return (
    <div className="space-y-3">
      <div className="text-lg font-bold">{T('checkAfford')}</div>
      {field('amount', T('loanAmount'))}{field('rate', T('interest'))}{field('tenure', T('tenure'))}
      <label className="block"><span className="text-xs font-bold text-muted">{T('monthlyIncome')} <span className="font-normal">({T('fromRecords')})</span></span><div className="input mt-1 bg-fill">{inr(income)}</div></label>
      {field('expenses', T('expenses'))}{field('existing', T('existingEmi'))}
      <div className={`rounded-xl border-2 border-dashed p-4 ${high || !lowOk ? 'border-warn bg-warn-light' : 'border-primary'}`}>
        <div className="flex items-center justify-between"><Chip>{T('estimateOnly')}</Chip><PlayButton text={spoken} lang={lang} /></div>
        <div className="mt-2 text-xl font-bold">{T('emi')} {inr(emi)} {T('perMonth')}</div>
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
      <div className="text-lg font-bold">{T('exploreOptions')}</div>
      {PRODUCTS_DEMO.map((p) => {
        const amt = Math.min(Math.max(loan.amount, p.min), p.max), n = Math.min(loan.tenure, p.maxTenure);
        const e = emiFor(amt, p.rate, n), fee = (amt * p.feePct) / 100;
        return (
          <div key={p.id} className="card p-4">
            <div className="flex items-start justify-between gap-2"><div><div className="font-bold">{p.lender}</div><div className="text-sm">{p.name}</div></div><Chip tone="warn">{T('demoOffer')}</Chip></div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
              <span className="text-muted">{T('range')}</span><span>{inr(p.min)} - {inr(p.max)}</span>
              <span className="text-muted">{T('rate')}</span><span>{p.rate}% · {p.maxTenure} {T('months')}</span>
              <span className="text-muted">{T('fees')}</span><span>{p.feePct}% ({inr(fee)})</span>
              <span className="text-muted">{T('emi')}</span><span className="font-bold">{inr(Math.round(e))} × {n}</span>
              <span className="text-muted">{T('total')}</span><span>{inr(Math.round(e * n + fee))}</span>
            </div>
            <div className="mt-1 text-xs text-muted">{T('eligibility')}: {p.elig} · source date 31 Oct 2026 (demo)</div>
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
      <div className="text-lg font-bold">{T('shareRecords')}</div>
      <div className="flex items-center justify-between text-sm text-muted">{T('listenCarefully')}<PlayButton text={rows.map((r) => `${r[0]}: ${r[1]}`).join('. ')} lang={lang} /></div>
      {rows.map(([k, v]) => <div key={k} className="card px-4 py-2"><div className="label">{k}</div><div className="text-[15px]">{v}</div></div>)}
      <label className="flex items-center gap-3 rounded-xl border border-line bg-fill p-3 font-bold"><input type="checkbox" className="h-5 w-5" checked={ok} onChange={(e) => setOk(e.target.checked)} />{T('allow')}</label>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary !min-h-[52px]" onClick={() => setSub('products')}>{T('notNow')}</button>
        <button className="btn-primary !min-h-[52px]" disabled={!ok} onClick={() => {
          s.grantConsent({ recipient: p.lender, purpose: 'Assess loan application', scope: 'Milk quantity and payments', period: 'Last 12 months' });
          setSub('apply');
        }}>{T('continue')}</button>
      </div>
    </div>
  );
}

function Apply() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  const p = PRODUCTS_DEMO.find((x) => x.id === loan.product)!;
  return (
    <div className="space-y-3">
      <div className="text-lg font-bold">{T('application')}</div>
      <div className="card p-4 text-[15px]"><div className="font-bold">{p.lender}</div><div>{p.name}</div>
        <div className="mt-1">{inr(loan.amount)} · {loan.tenure} {T('months')} · {p.rate}%</div></div>
      <div className="card p-4"><div className="label">{T('documents')}</div>
        <div className="mt-2 space-y-1 text-[15px]"><div>✓ {T('idProof')}</div><div>✓ {T('bankAcc')}</div><div className="text-muted">○ {T('cattleQuote')}</div></div></div>
      <p className="text-sm text-muted">{T('bankDecides')}</p>
      <button className="btn-primary w-full" onClick={() => {
        const c = s.consents.find((x) => x.recipient === p.lender && x.status === 'active');
        s.submitApplication({ product: p.name, lender: p.lender, amount: loan.amount, tenure: loan.tenure, rate: p.rate, consentId: c?.id ?? '' });
        setSub('tracker');
      }}>{T('submit')}</button>
    </div>
  );
}

function Tracker() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  const a = s.application;
  if (!a) return <div className="card border-dashed p-6 text-center text-muted">{T('noApp')}</div>;
  return (
    <div className="space-y-3">
      <div className="card p-4"><div className="flex items-center justify-between"><span className="font-bold">{T('reference')} {a.ref}</span><Chip tone={STATUS_TONE[a.status]}>{T('st_' + a.status)}</Chip></div>
        <div className="text-sm">{a.lender} · {a.product} · {inr(a.amount)}</div></div>
      {a.status === 'more_info' ? (
        <div className="rounded-xl border border-warn bg-warn-light p-4"><div className="font-bold text-warn">{T('docRequested')}</div><div className="text-sm">{T('cattleQuote')}</div>
          <button className="btn-primary mt-2 w-full" onClick={() => { s.uploadDoc(); flash(T('uploaded')); }}>{T('upload')}</button></div>
      ) : null}
      <div className="card p-4">
        <div className="label">{T('status')}</div>
        <ol className="mt-2 space-y-3 border-l-2 border-line pl-4">
          {a.history.map((h, i) => (
            <li key={i}><div className="font-bold">{T('st_' + h.status)}</div><div className="text-xs text-muted">{new Date(h.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div><div className="text-sm">{h.note}</div></li>
          ))}
        </ol>
      </div>
      <p className="text-sm text-muted">{T('bankDecides')}</p>
      {['submitted', 'in_review', 'more_info'].includes(a.status) ? <button className="btn-quiet w-full" onClick={() => s.setAppStatus('withdrawn', 'Withdrawn by farmer')}>{T('withdraw')}</button> : null}
    </div>
  );
}

// ---------------- Ask ----------------
function Ask() {
  const { s, lang, T, today, premium, months, worth, published, go, setSub, flash, loan, setLoan, whyMonth, setWhyMonth, monthKeys, complete } = useF();
  const [q, setQ] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const [ans, setAns] = useState<ReturnType<typeof answer> | null>(null);
  const [state, setState] = useState<'idle' | 'listening' | 'working' | 'error'>('idle');
  const [mode, setMode] = useState<'gnani' | 'browser' | 'none'>('none');
  const [fb, setFb] = useState<string | null>(null);
  const rec = useRef<Recorder | null>(null);
  useEffect(() => { voiceHealth().then((h) => setMode(h.gnani ? 'gnani' : browserRecognition() ? 'browser' : 'none')); }, []);
  const run = (text: string, voice: boolean) => {
    setSaid(text); setFb(null);
    const a = answer(text, lang, today, premium); setAns(a);
    if (voice) speak([a.text, ...(a.bullets ?? [])].join('. '), lang);
  };
  const start = async () => {
    if (state === 'listening') { rec.current?.stop(); return; }
    setState('listening');
    try {
      if (mode === 'gnani') {
        rec.current = await recordWav(async (wav) => {
          if (!wav) { setState('error'); return; }
          setState('working');
          const tx = await transcribe(wav, lang);
          if (tx) { setState('idle'); run(tx, true); } else setState('error');
        });
      } else if (mode === 'browser') {
        const R = browserRecognition()!; const r = new R(); r.lang = { gu: 'gu-IN', hi: 'hi-IN', en: 'en-IN' }[lang]; r.interimResults = false; r.maxAlternatives = 1;
        r.onresult = (e) => { setState('idle'); run(e.results[0][0].transcript, true); };
        r.onerror = () => setState('error'); r.onend = () => setState((x) => (x === 'listening' ? 'idle' : x));
        rec.current = { stop: () => r.stop() }; r.start();
      } else setState('error');
    } catch { setState('error'); }
  };
  const full = ans ? [ans.text, ...(ans.bullets ?? [])].join('. ') : '';
  return (
    <div className="space-y-3">
      {said ? (
        <div className="rounded-xl border border-line bg-fill p-3"><div className="label">{T('youSaid')}</div><div className="italic">“{said}”</div>
          <button className="mt-1 text-sm font-bold text-primary" onClick={() => { setSaid(null); setAns(null); }}>{T('tryAgain')}</button></div>
      ) : null}
      {ans ? (
        <div className="card p-4">
          <div className="flex items-center justify-between"><Chip>{T('automated')}</Chip><PlayButton text={full} lang={lang} /></div>
          <div className="mt-2">{ans.text}</div>
          {ans.bullets ? <ul className="mt-1 list-disc pl-5 text-[15px]">{ans.bullets.map((b) => <li key={b}>{b}</li>)}</ul> : null}
          <div className="mt-2 flex items-center gap-3 text-sm text-muted">{T('helpful')} <button className="font-bold text-primary" onClick={() => setFb('y')}>{T('yes')}</button><button className="font-bold text-primary" onClick={() => setFb('n')}>{T('no')}</button>{fb ? '✓' : ''}</div>
          <button className="btn-secondary mt-3 w-full" onClick={() => { s.addQuery(said ?? '', lang); flash(T('sentToSociety')); }}>{T('talkPerson')}</button>
        </div>
      ) : null}
      <div className="label pt-2 text-center">{T('suggested')}</div>
      <div className="flex flex-col items-center gap-2">
        {['sq1', 'sq2', 'sq3', 'sq4'].map((k) => <button key={k} onClick={() => run(T(k), false)} className="w-full max-w-[320px] rounded-full border border-line bg-white px-4 py-2 text-[15px]">{T(k)}</button>)}
      </div>
      <form className="flex gap-2 pt-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { run(q.trim(), false); setQ(''); } }}>
        <input className="input" placeholder={T('typeInstead')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-quiet" type="submit">→</button>
      </form>
      <div className="flex flex-col items-center pt-4">
        <button aria-label={T('tapSpeak')} onClick={start} className={`flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl text-white ${state === 'listening' ? 'listening' : ''}`}>🎤</button>
        <div className="mt-2 text-sm text-muted">{state === 'listening' ? T('listening') : state === 'working' ? T('thinking') : state === 'error' ? 'Could not hear clearly. Try again or type.' : T('tapSpeak')}</div>
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
      <div className="card p-4"><div className="font-bold">{FARMER.name}</div><div className="text-sm text-muted">{FARMER.society} · {T('member')} {FARMER.memberId} · {FARMER.village}</div>
        <div className="text-sm text-muted">🐃 {FARMER.animals.buffalo} · 🐄 {FARMER.animals.cow}</div></div>
      <div className="card p-4"><div className="label">{T('language')}</div>
        <div className="mt-2 flex gap-2">{LANGS.map((l) => <button key={l.id} onClick={() => s.set({ lang: l.id })} className={`rounded-full border px-3 py-1 ${lang === l.id ? 'border-primary bg-primary-light font-bold text-primary' : 'border-line'}`}>{l.label}</button>)}</div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.autoplay} onChange={(e) => s.set({ autoplay: e.target.checked })} /> Play messages aloud automatically</label>
      </div>
      <div className="card p-4"><div className="label">{T('myData')}</div><p className="mt-1 text-[15px]">{T('myDataText')}</p>
        <button className="btn-quiet mt-2 w-full" disabled={s.farmer.correction} onClick={() => { s.setFarmer({ correction: true }); s.addQuery('Data correction request', lang); }}>{s.farmer.correction ? T('requested') : T('requestCorrection')}</button></div>
      <div className="card p-4"><div className="label">{T('consents')}</div>
        <div className="mt-2 flex items-center justify-between text-sm"><span>Signals from {FARMER.society}</span><Chip tone="good">active</Chip></div>
        {s.consents.map((c) => (
          <div key={c.id} className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2 text-sm">
            <span>{c.id}: {c.recipient}<br /><span className="text-xs text-muted">{c.purpose} · {c.period}</span></span>
            {c.status === 'active' ? <button className="btn-quiet !min-h-[34px] !px-3 text-xs" onClick={() => s.withdrawConsent(c.id)}>{T('withdraw')}</button> : <Chip>{T('withdrawn')}</Chip>}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Grievance officer (demo): grievance@doodhsetu.example · Your data stays in India.</p>
    </div>
  );
}
