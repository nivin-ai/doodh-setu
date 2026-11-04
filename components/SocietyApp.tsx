'use client';
import { createContext, useContext, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '@/lib/store';
import { DEMO_DATES } from '@/lib/demo';
import { LANGS, signalMessage, type Lang } from '@/lib/i18n';
import { fmtDate, fmtMonth, inr, num } from '@/lib/util';
import { postJson, useResource } from '@/lib/client/api';
import type { MemberRow, SendSlot, SocietyData } from '@/lib/types/api';
import { Empty, ErrorState, Loading } from './DataState';
import { CHART, Chip, ConsoleShell, Count, Note, PageTitle, PlayButton, Segmented, Stat } from './ui';
import { IconCheck, IconChevron } from './icons';


// Society data comes from the database (/api/society), scoped to the signed-in secretary's society
interface Ctx { d: SocietyData; asOf: string; act: (action: string, body?: Record<string, unknown>) => Promise<boolean>; busy: boolean; err: string }
const SocietyCtx = createContext<Ctx | null>(null);
const useSociety = () => useContext(SocietyCtx) as Ctx;

export default function SocietyApp() {
  const s = useStore();
  const [view, setView] = useState('overview');
  const asOf = DEMO_DATES[s.demoDate].date;
  const r = useResource<SocietyData>(`/api/society?asOf=${asOf}`, { poll: 5000 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const act = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(true); setErr('');
    try { await postJson('/api/society', { ...body, action, asOf }); await r.refresh(); return true; }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); return false; }
    finally { setBusy(false); }
  };
  const d = r.data;
  const pendingTarget = d?.program?.status === 'approved' ? 1 : 0;
  const openQ = d ? d.queries.filter((q) => q.status === 'open').length : 0;
  const menu = [
    { id: 'overview', label: 'Overview' }, { id: 'targets', label: 'Targets', badge: pendingTarget },
    { id: 'members', label: 'Members' }, { id: 'queries', label: 'Queries', badge: openQ }, { id: 'reports', label: 'Reports' },
  ];
  return (
    <ConsoleShell title="Society dashboard" place={d?.society.name} menu={menu} active={view} onSelect={setView}>
      {!d ? (r.error ? <ErrorState error={r.error} onRetry={r.refresh} /> : <Loading label="Loading society records..." />) : (
        <SocietyCtx.Provider value={{ d, asOf, act, busy, err }}>
          {view === 'overview' ? <Overview go={setView} /> : view === 'targets' ? <Targets /> : view === 'members' ? <Members /> : view === 'queries' ? <Queries /> : <Reports />}
        </SocietyCtx.Provider>
      )}
    </ConsoleShell>
  );
}

const LANG_NAME: Record<string, string> = { gu: 'Gujarati', hi: 'Hindi', en: 'English', mr: 'Marathi', bn: 'Bengali', te: 'Telugu', ta: 'Tamil', kn: 'Kannada', ml: 'Malayalam', or: 'Odia' };

// Interested members as an Excel file, so the secretary can call each one back.
async function downloadInterested(rows: MemberRow[], o: { rate: number; demoDate: string; society: string; from: string; to: string }) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const list = rows.filter((r) => r.status === 'Interested');
  const H = (v: string) => ({ value: v, fontWeight: 'bold' as const, color: '#FFFFFF', backgroundColor: '#0B5CAD' });
  const header = ['Member ID', 'Name', 'Mobile number', 'Device', 'Reach by', 'Language', 'Village', 'Buffaloes', 'Cows', 'Avg milk (L/day)', 'Status', 'Called back', 'Notes'].map(H);
  const data = [header, ...list.map((m) => [
    { value: m.code }, { value: m.name }, { value: m.mobile ?? '' }, { value: m.device },
    { value: m.device === 'Smartphone' ? 'App or call' : 'Voice call' }, { value: LANG_NAME[m.lang] ?? m.lang }, { value: m.village },
    { value: m.buffaloes, type: Number }, { value: m.cows, type: Number }, { value: Math.round(m.litres * 10) / 10, type: Number, format: '0.0' },
    { value: m.status }, { value: '' }, { value: '' },
  ])];
  const about = [
    [{ value: 'Interested members', fontWeight: 'bold' as const, fontSize: 14 }],
    [{ value: 'Society' }, { value: o.society }],
    [{ value: 'Signal' }, { value: `Lean-season buffalo milk premium, Rs ${o.rate} per kg fat, ${o.from} to ${o.to}` }],
    [{ value: 'Members interested' }, { value: list.length, type: Number }],
    [{ value: 'Data as of' }, { value: o.demoDate }],
    [{ value: 'How to use' }, { value: 'Call each member back, then fill in the Called back and Notes columns.' }],
    [{ value: 'Note' }, { value: 'Demo data. Names and phone numbers are made up. Contact details are personal data: share only within the society.' }],
  ];
  await writeExcelFile([
    { data, sheet: 'Interested members', columns: [9, 22, 18, 20, 13, 11, 12, 10, 7, 14, 11, 12, 30].map((width) => ({ width })), stickyRowsCount: 1 },
    { data: about, sheet: 'About', columns: [{ width: 20 }, { width: 90 }] },
  ]).toFile(`Interested_members_${o.society.replace(/\s+/g, '_')}_${o.demoDate}.xlsx`);
}

function Overview({ go }: { go: (v: string) => void }) {
  const { d, asOf } = useSociety();
  const p = d.program;
  const published = p?.status === 'published';
  const r = d.reach;
  const buf = d.collection?.buffalo ?? 0, cow = d.collection?.cow ?? 0;
  const live = published && p && asOf >= p.from && asOf <= p.to;
  const target = live ? Math.round(buf / 1.04 * 1.06) : null;
  const queries = d.queries.filter((q) => q.status === 'open').length;
  return (
    <div>
      <PageTitle title="Overview" sub={`Collection on ${fmtDate(asOf)}`} />
      {!d.collection ? <div className="mb-3"><Empty>No collection recorded for this date.</Empty></div> : null}
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Buffalo milk today" value={`${num(buf)} L`} sub={target ? `Target ${num(target)} L` : 'No active target'} tone={target ? (buf >= target ? 'good' : 'warn') : undefined} />
        <Stat label="Cow milk today" value={`${num(cow)} L`} sub="No active target" />
        <Stat label="Members reached" value={published ? `${r.heard} / ${d.society.members}` : '-'} sub={published ? 'Heard the latest signal' : 'No active signal'} />
        <Stat label="Interested" value={published ? r.interested : '-'} sub={published ? 'Asked for follow-up' : ''} />
      </div>
      {published && r.interested ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <button className="btn-secondary !min-h-[38px] text-sm" onClick={() => downloadInterested(d.members, { rate: p!.rate, demoDate: asOf, society: d.society.name, from: p!.from, to: p!.to })}><IconDownload />Download interested members (Excel)</button>
          <span className="text-muted">Names, phone numbers and herd size, to call each one back.</span>
        </div>
      ) : null}
      <div className="mt-6 max-w-[720px]">
        <h3 className="font-bold">Needs your action</h3>
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {p?.status === 'approved' ? <li><button className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold text-primary transition-colors hover:bg-primary-light" onClick={() => go('targets')}><span className="h-2.5 w-2.5 rounded-full bg-marigold" />New approved target from the union: publish to members<IconChevron className="ml-auto" /></button></li> : null}
          {queries ? <li><button className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold text-primary transition-colors hover:bg-primary-light" onClick={() => go('queries')}><span className="h-2.5 w-2.5 rounded-full bg-marigold" />{queries} member {queries === 1 ? 'query' : 'queries'} waiting<IconChevron className="ml-auto" /></button></li> : null}
          {p?.status !== 'approved' && !queries ? <li className="px-4 py-3 text-muted">Nothing pending.</li> : null}
        </ul>
      </div>
    </div>
  );
}

const SEND_SLOTS: { id: SendSlot; label: string; when: string; why: string }[] = [
  { id: 'evening', label: 'Evening', when: 'Tomorrow, 7:30 PM (after evening collection)', why: 'Members are home and more likely to listen to the full voice call and discuss it with the family.' },
  { id: 'morning', label: 'Morning', when: 'Tomorrow, 8:00 AM (after morning collection)', why: 'Arrives right after members see their morning litres and fat, but mornings are busy with fodder and field work.' },
  { id: 'both', label: 'Both', when: 'Tomorrow, 8:00 AM, with a 7:30 PM reminder', why: 'The evening reminder goes only to members who did not open the message or answer the call in the morning.' },
];

function Targets() {
  const s = useStore();
  const { d, act, busy, err } = useSociety();
  const p = d.program;
  const [notes, setNotes] = useState<Partial<Record<Lang, string>>>(p?.notes ?? {});
  const inc = { status: p?.status ?? 'none', rate: p?.rate ?? 0, concern: p?.concern, notes };
  const [prep, setPrep] = useState(false);
  const [concern, setConcern] = useState('');
  const [showConcern, setShowConcern] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [sendAt, setSendAt] = useState<SendSlot>('evening');
  const worth = d.preview?.worth ?? 0;
  const society = d.society.name;
  if (inc.status === 'none' || inc.status === 'submitted' || inc.status === 'rejected') {
    return (<div><PageTitle title="Targets and incentives" /><div className="rounded-sheet border border-dashed border-line p-10 text-center text-muted">No approved targets from the union yet. Approved targets appear here.</div></div>);
  }
  const row = (
    <table className="tbl card w-full overflow-hidden">
      <thead><tr><th>Target</th><th>Period</th><th>Incentive</th><th>Status</th><th></th></tr></thead>
      <tbody><tr>
        <td>+6% buffalo milk</td><td>{fmtDate(p!.from)} - {fmtDate(p!.to)}</td><td>₹{inc.rate} per kg fat (fixed)</td>
        <td><Chip tone={inc.status === 'published' ? 'good' : inc.status === 'concern' ? 'warn' : 'primary'}>{inc.status === 'approved' ? 'Approved by union' : inc.status === 'concern' ? 'Concern raised' : 'Published'}</Chip></td>
        <td>{inc.status === 'approved' ? <button className="btn-primary !min-h-[36px] text-sm" onClick={() => setPrep(true)}>Prepare message</button> : null}</td>
      </tr></tbody>
    </table>
  );
  if (!prep || inc.status !== 'approved') {
    return (
      <div>
        <PageTitle title="Targets and incentives" />{row}
        {inc.status === 'concern' ? <Note>Your concern was sent to the union planner: “{inc.concern}”. The signal stays unpublished until resolved.</Note> : null}
        {inc.status === 'published' && justSent ? <Delivery total={d.society.members} app={d.reach.app} /> : null}
        {inc.status === 'published' ? <Note>Published to all eligible members by app and IVR. Members see it as a message from {society}.</Note> : null}
      </div>
    );
  }
  // Languages this society's members use (this farmer's own choice included); templates exist for all ten
  const langs = LANGS.filter((l) => ['gu', 'hi', 'en', s.lang].includes(l.id));
  return (
    <div>
      <PageTitle title="Prepare member message" chip={<Chip tone="good">Approved by union</Chip>} sub={`Target: +6% buffalo milk, Apr to Jun | Premium ₹${inc.rate} per kg fat (fixed). The amount cannot be edited here.`} />
      <div className="grid gap-4 lg:grid-cols-3">
        {langs.map((l) => {
          const msg = signalMessage(l.id, { society, rate: inc.rate, worth });
          const note = inc.notes[l.id];
          return (
            <div key={l.id} className="card overflow-hidden">
              <div className="blockprint h-1.5" />
              <div className="p-4">
              <div className="flex items-center justify-between"><span className="font-semibold">{l.name}</span><PlayButton text={msg + (note ? ' ' + note : '')} lang={l.id} /></div>
              <p className="indic mt-2 text-sm">{msg}</p>
              {note ? <p className="indic mt-2 animate-view-in rounded-lg bg-marigold-soft p-2 text-sm">{note}</p> : null}
              <div className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-good"><IconCheck size={14} />Template reviewed</div>
              <Note>Personal figure shown for this farmer; each member hears their own amount.</Note>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card mt-4 p-4">
        <div className="font-bold">Local note (optional)</div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {langs.map((l) => (
            <label key={l.id} className="block text-sm"><span className="font-bold">{l.name}</span>
              <textarea className="input indic mt-1 h-20" value={inc.notes[l.id] ?? ''} onChange={(e) => setNotes({ ...notes, [l.id]: e.target.value })}
                placeholder={l.id === 'en' ? 'e.g. Subsidised maize seed at the society from 1 March.' : ''} /></label>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="card p-4 text-sm"><div className="font-bold">Audience</div>All eligible members ({d.society.members}): {d.reach.app} by app, {d.reach.voice} by voice call (IVR)<br /><span className="text-xs text-muted">Feature-phone members get the same message by voice call at the same time.</span></div>
        <div className="card p-4 text-sm"><div className="font-bold">Send at</div>
          <div className="mt-2"><Segmented options={SEND_SLOTS.map((x) => ({ id: x.id, label: x.label }))} value={sendAt} onChange={setSendAt} /></div>
          <div className="mt-2">{SEND_SLOTS.find((x) => x.id === sendAt)!.when}</div>
          <span className="text-xs text-muted">{SEND_SLOTS.find((x) => x.id === sendAt)!.why}</span>
        </div>
      </div>
      {showConcern ? (
        <div className="card mt-4 p-4">
          <div className="font-bold">Raise a concern with the union</div>
          <textarea className="input mt-2 h-20" value={concern} onChange={(e) => setConcern(e.target.value)} placeholder="e.g. Many of our members have no buffalo; the target is too high." />
          <div className="mt-2 flex gap-2"><button className="btn-quiet" onClick={() => setShowConcern(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy || !concern.trim()} onClick={() => act('concern', { text: concern })}>Send concern</button></div>
        </div>
      ) : null}
      {err ? <p role="alert" className="mt-3 text-sm text-bad">{err}</p> : null}
      <div className="mt-5 flex justify-between">
        <button className="btn-secondary" onClick={() => setShowConcern(true)}>Raise concern</button>
        <button className="btn-primary" disabled={busy} onClick={async () => { if (await act('publish', { sendSlot: sendAt, notes })) setJustSent(true); }}>{busy ? 'Publishing...' : 'Publish to members'}</button>
      </div>
    </div>
  );
}

type MilkBand = 'all' | 'small' | 'medium' | 'large';
const MILK_BANDS: { id: MilkBand; label: string; test: (l: number) => boolean }[] = [
  { id: 'all', label: 'Any amount', test: () => true },
  { id: 'small', label: 'Under 8 L a day', test: (l) => l < 8 },
  { id: 'medium', label: '8 to 15 L a day', test: (l) => l >= 8 && l <= 15 },
  { id: 'large', label: 'Over 15 L a day', test: (l) => l > 15 },
];
const LANG_LABEL: Record<string, string> = Object.fromEntries(LANGS.map((l) => [l.id, l.name]));
const PAGE = 80;

function Members() {
  const { d, asOf } = useSociety();
  const [f, setF] = useState<'all' | 'interested' | 'heard' | 'not'>('all');
  const [village, setVillage] = useState('all');
  const [milk, setMilk] = useState<MilkBand>('all');
  const [animals, setAnimals] = useState<'all' | 'buffalo' | 'cow'>('all');
  const [lang, setLang] = useState('all');
  const [reach, setReach] = useState<'all' | 'app' | 'ivr'>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'id' | 'milk'>('id');
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const p = d.program;
  const published = p?.status === 'published';
  const all = d.members;
  const count = (key: (r: MemberRow) => string) => all.reduce<Record<string, number>>((a, r) => { a[key(r)] = (a[key(r)] ?? 0) + 1; return a; }, {});
  const villages = Object.entries(count((r) => r.village)).sort((a, b) => b[1] - a[1]);
  const langs = Object.entries(count((r) => r.lang)).sort((a, b) => b[1] - a[1]);
  const band = MILK_BANDS.find((b) => b.id === milk)!;
  const needle = q.trim().toLowerCase();
  // everything except the signal status, so the status buttons can show how many each would give
  const base = all.filter((r) =>
    (village === 'all' || r.village === village) && band.test(r.litres)
    && (animals === 'all' || (animals === 'buffalo' ? r.buffaloes > 0 : r.buffaloes === 0 && r.cows > 0))
    && (lang === 'all' || r.lang === lang) && (reach === 'all' || (reach === 'app') === (r.device === 'Smartphone'))
    && (!needle || r.name.toLowerCase().includes(needle) || r.code.includes(needle)));
  const statusOk = (r: MemberRow) => f === 'all' || (f === 'interested' && r.status === 'Interested') || (f === 'heard' && r.status === 'Heard') || (f === 'not' && r.status === 'Not heard');
  const filtered = base.filter(statusOk).sort((a, b) => (sort === 'milk' ? b.litres - a.litres : a.code.localeCompare(b.code)));
  const rows = filtered.slice(0, limit);
  const interestedHere = base.filter((r) => r.status === 'Interested');
  const nStatus = (st: string) => base.filter((r) => r.status === st).length;
  const narrowed = village !== 'all' || milk !== 'all' || animals !== 'all' || lang !== 'all' || reach !== 'all' || !!needle;
  const clear = () => { setVillage('all'); setMilk('all'); setAnimals('all'); setLang('all'); setReach('all'); setQ(''); setF('all'); setLimit(PAGE); };
  const litres = filtered.reduce((x, r) => x + r.litres, 0);
  const buffaloes = filtered.reduce((x, r) => x + r.buffaloes, 0);
  const dl = async () => { setBusy(true); try { await downloadInterested(interestedHere, { rate: p!.rate, demoDate: asOf, society: d.society.name, from: p!.from, to: p!.to }); } finally { setBusy(false); } };
  const sel = 'input !min-h-[38px] !py-1.5 text-sm';
  const field = (label: string, el: React.ReactNode) => <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-semibold text-muted">{label}{el}</label>;
  return (
    <div>
      <PageTitle title="Members" sub={`${d.society.members} members. Filter to find who to call, then download the interested ones.`} />
      <div className="card mb-3 p-3">
        <div className="flex flex-wrap gap-3">
          {field('Village', <select className={sel} value={village} onChange={(e) => { setVillage(e.target.value); setLimit(PAGE); }}><option value="all">All villages ({all.length})</option>{villages.map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}</select>)}
          {field('Milk per day', <select className={sel} value={milk} onChange={(e) => { setMilk(e.target.value as MilkBand); setLimit(PAGE); }}>{MILK_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>)}
          {field('Animals', <select className={sel} value={animals} onChange={(e) => { setAnimals(e.target.value as typeof animals); setLimit(PAGE); }}><option value="all">Any</option><option value="buffalo">Has buffalo</option><option value="cow">Cows only</option></select>)}
          {field('Language', <select className={sel} value={lang} onChange={(e) => { setLang(e.target.value); setLimit(PAGE); }}><option value="all">Any language</option>{langs.map(([l, n]) => <option key={l} value={l}>{LANG_LABEL[l] ?? l} ({n})</option>)}</select>)}
          {field('Reached by', <select className={sel} value={reach} onChange={(e) => { setReach(e.target.value as typeof reach); setLimit(PAGE); }}><option value="all">App or voice call</option><option value="app">App (smartphone)</option><option value="ivr">Voice call only (IVR)</option></select>)}
          {field('Search', <input className={sel} placeholder="Name or member ID" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />)}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented options={[{ id: 'all', label: `All (${base.length})` }, { id: 'interested', label: `Interested (${nStatus('Interested')})` }, { id: 'heard', label: `Heard (${nStatus('Heard')})` }, { id: 'not', label: `Not heard (${nStatus('Not heard')})` }]} value={f} onChange={(v) => { setF(v as typeof f); setLimit(PAGE); }} />
        <label className="flex items-center gap-2 text-sm text-muted">Sort<select className="input !min-h-[34px] !w-auto !py-1 text-sm" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="id">Member ID</option><option value="milk">Most milk first</option></select></label>
        {narrowed || f !== 'all' ? <button className="text-sm font-semibold text-primary hover:underline" onClick={clear}>Clear filters</button> : null}
        <button className="btn-secondary ml-auto !min-h-[38px] text-sm" disabled={!published || !interestedHere.length || busy} onClick={dl} title={!published ? 'Available once a signal is published' : undefined}>
          <IconDownload />{busy ? 'Preparing...' : `Download ${narrowed ? 'these ' : ''}interested (${published ? interestedHere.length : 0}) as Excel`}
        </button>
      </div>
      {!published ? <p className="mb-3 text-sm text-muted">Interest is recorded once a signal is published to members. The download is available then.</p> : null}
      <div className="mb-2 text-sm text-muted" aria-live="polite"><b className="text-ink">{filtered.length}</b> member{filtered.length === 1 ? '' : 's'} match{filtered.length === 1 ? 'es' : ''}{filtered.length ? <>, about <b className="text-ink">{Math.round(litres).toLocaleString('en-IN')} L</b> of milk a day from <b className="text-ink">{buffaloes}</b> buffaloes</> : null}.</div>
      <div className="card overflow-x-auto">
        <table className="tbl w-full min-w-[760px]">
          <thead><tr><th>ID</th><th>Name</th><th>Mobile</th><th>Device</th><th>Language</th><th>Herd</th><th>Avg L/day</th><th>Signal status</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className={r.isDemoFarmer ? 'bg-primary-light' : 'hover:bg-alt'}><td>{r.code}</td><td>{r.name}<div className="text-xs text-muted">{r.village}</div></td><td className="num whitespace-nowrap">{r.mobile ?? '-'}</td><td className="text-xs">{r.device}</td><td>{r.lang.toUpperCase()}</td><td className="whitespace-nowrap text-xs">{r.buffaloes} buf, {r.cows} cow</td><td className="num">{r.litres.toFixed(1)}</td>
              <td>{r.status === '-' ? <span className="text-muted">-</span> : <Chip tone={r.status === 'Interested' ? 'good' : r.status === 'Heard' ? 'primary' : 'neutral'}>{r.status}</Chip>}</td></tr>
          ))}</tbody>
        </table>
        {!filtered.length ? <div className="p-6 text-center text-sm text-muted">No members match these filters. <button className="font-semibold text-primary hover:underline" onClick={clear}>Clear filters</button></div> : null}
      </div>
      {filtered.length > rows.length ? <div className="mt-3 text-center"><button className="btn-secondary !min-h-[38px] text-sm" onClick={() => setLimit((n) => n + 200)}>Show more ({filtered.length - rows.length} left)</button></div> : null}
      <Note>Phone numbers are personal data. They are visible only to the society and are not shared with lenders without the member&apos;s consent.</Note>
    </div>
  );
}

const IconDownload = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>);

function Queries() {
  const { d, act, busy } = useSociety();
  const [reply, setReply] = useState<Record<string, string>>({});
  const queries = d.queries;
  return (
    <div>
      <PageTitle title="Member queries" sub="Questions the assistant could not answer, disputes and data requests (BR-11)." />
      {queries.length === 0 ? <div className="rounded-sheet border border-dashed border-line p-10 text-center text-muted">No queries yet. Questions the farmer app cannot answer land here.</div> : null}
      <div className="space-y-3">
        {queries.map((q) => (
          <div key={q.id} className="card animate-view-in p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><b>{q.code}</b><span>{q.farmerName}</span><Chip>{q.lang.toUpperCase()}</Chip><span className="text-xs text-muted">{new Date(q.at).toLocaleString('en-IN')}</span>
              <span className="ml-auto"><Chip tone={q.status === 'open' ? 'warn' : 'good'}>{q.status === 'open' ? 'waiting for society' : 'replied'}</Chip></span></div>
            <div className="mt-2 space-y-1.5">
              {q.messages.map((m, i) => (
                <div key={i} className={`flex ${m.from === 'society' ? 'justify-end' : ''}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.from === 'society' ? 'bg-good-light' : 'bg-fill'}`}>
                    <div className="text-[11px] font-semibold text-muted">{m.from === 'society' ? 'Society' : q.farmerName}</div>
                    <div className="indic">{m.text}</div>
                  </div>
                </div>
              ))}
            </div>
            {q.status === 'resolved' && q.farmerSeen ? <div className="mt-1 text-right text-[11px] text-muted">Seen by farmer</div> : null}
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (reply[q.id]?.trim()) { void act('reply', { queryId: q.id, text: reply[q.id].trim() }); setReply({ ...reply, [q.id]: '' }); } }}>
              <input className="input" placeholder={q.status === 'open' ? 'Type a reply (sent to the farmer in their language)' : 'Add another reply'} value={reply[q.id] ?? ''} onChange={(e) => setReply({ ...reply, [q.id]: e.target.value })} />
              <button className="btn-primary" type="submit" disabled={busy || !reply[q.id]?.trim()}>Send</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reports() {
  const { d, asOf } = useSociety();
  const p = d.program;
  const published = p?.status === 'published';
  const complete = asOf.endsWith('-30') || asOf.endsWith('-31');
  const months = d.monthly.filter((m) => complete || m.month < asOf.slice(0, 7));
  const inPremium = (m: string) => !!p && m >= p.from.slice(0, 7) && m <= p.to.slice(0, 7);
  // target: 6% above the same month last year (approximated by the month's lean-season expectation)
  const data = months.map((m) => ({ m: fmtMonth(m.month).split(' ')[0], buffalo: m.buffalo, target: published && inPremium(m.month) ? Math.round(m.buffalo / 1.04 * 1.06 / 10) * 10 : null }));
  const premiumMonth = months.find((m) => inPremium(m.month));
  return (
    <div>
      <PageTitle title="Reports" />
      <div className="card p-5"><div className="font-bold">Buffalo milk collection (litres per day, monthly average)</div>
        <div className="mt-3 h-64"><ResponsiveContainer><BarChart data={data}><CartesianGrid vertical={false} stroke={CHART.grid} /><XAxis dataKey="m" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F4F8FC' }} /><Legend iconType="circle" />
          <Bar dataKey="buffalo" name="Collected" fill={CHART.indigo} radius={[6, 6, 0, 0]} /><Bar dataKey="target" name="Target" fill={CHART.marigold} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <Note>From the society&apos;s daily collection records (synthetic demo data). Lean-season fall is expected; the target is set against last year&apos;s same month.</Note>
      </div>
      {published && premiumMonth ? <div className="mt-4 max-w-[420px]"><Stat label={`Premium paid to members in ${fmtMonth(premiumMonth.month)} (society total)`} value={inr(premiumMonth.buffalo * 30 * 1.03 * 0.07 * p!.rate)} tone="good" /></div> : null}
    </div>
  );
}

// Shown once, right after Publish: each dot is a member; they light up as the message goes out.
function Delivery({ total, app }: { total: number; app: number }) {
  return (
    <div className="mt-5 max-w-[720px] animate-view-in rounded-sheet border border-line bg-white p-5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-2 font-bold text-good"><IconCheck size={20} animate />Published</div>
        <div className="text-[15px]"><span className="num font-display text-[26px] font-bold"><Count value={total} format={(n) => String(Math.round(n))} /></span> <span className="text-muted">members reached</span></div>
      </div>
      <div className="mt-3 grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(9px, 1fr))' }} aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className="aspect-square rounded-full" style={{ background: i < app ? CHART.indigo : CHART.marigold, opacity: 0, animation: `pop 260ms ease-out ${Math.round((i / total) * 1100)}ms forwards` }} />
        ))}
      </div>
      <div className="mt-3 flex gap-5 text-[13px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART.indigo }} />App, {app}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART.marigold }} />Voice call, {total - app}</span>
      </div>
    </div>
  );
}
