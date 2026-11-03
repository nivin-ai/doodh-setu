'use client';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore, threadOf } from '@/lib/store';
import { DEMO_DATES, FARMER, PREMIUM_PERIOD } from '@/lib/demo';
import { LANGS, signalMessage, type Lang } from '@/lib/i18n';
import { worthToFarmer } from '@/lib/farmer';
import { inr, num } from '@/lib/util';
import { memberRows, TOTAL_MEMBERS, type MemberRow } from '@/lib/members';
import { CHART, Chip, ConsoleShell, Count, Note, PageTitle, PlayButton, Segmented, Stat } from './ui';
import { IconCheck, IconChevron } from './icons';


export default function SocietyApp() {
  const s = useStore();
  const [view, setView] = useState('overview');
  const inc = s.incentive;
  const pendingTarget = inc.status === 'approved' ? 1 : 0;
  const openQ = s.queries.filter((q) => q.status === 'open').length;
  const menu = [
    { id: 'overview', label: 'Overview' }, { id: 'targets', label: 'Targets', badge: pendingTarget },
    { id: 'members', label: 'Members' }, { id: 'queries', label: 'Queries', badge: openQ }, { id: 'reports', label: 'Reports' },
  ];
  return (
    <ConsoleShell title="Society dashboard" place={FARMER.society} menu={menu} active={view} onSelect={setView}>
      {view === 'overview' ? <Overview go={setView} /> : view === 'targets' ? <Targets /> : view === 'members' ? <Members /> : view === 'queries' ? <Queries /> : <Reports />}
    </ConsoleShell>
  );
}

function reach(published: boolean, heardMe: boolean, intMe: boolean, apr: boolean) {
  if (!published) return { heard: 0, interested: 0 };
  const rows = memberRows({ published, apr, lang: 'gu', heard: heardMe, interested: intMe });
  return { heard: rows.filter((m) => m.status !== 'Not heard').length, interested: rows.filter((m) => m.status === 'Interested').length };
}

const LANG_NAME: Record<string, string> = { gu: 'Gujarati', hi: 'Hindi', en: 'English', mr: 'Marathi', bn: 'Bengali', te: 'Telugu', ta: 'Tamil', kn: 'Kannada', ml: 'Malayalam', or: 'Odia' };

// Interested members as an Excel file, so the secretary can call each one back.
async function downloadInterested(rows: MemberRow[], o: { rate: number; demoDate: string }) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const list = rows.filter((r) => r.status === 'Interested');
  const H = (v: string) => ({ value: v, fontWeight: 'bold' as const, color: '#FFFFFF', backgroundColor: '#0B5CAD' });
  const header = ['Member ID', 'Name', 'Mobile number', 'Device', 'Reach by', 'Language', 'Village', 'Buffaloes', 'Cows', 'Avg milk (L/day)', 'Status', 'Called back', 'Notes'].map(H);
  const data = [header, ...list.map((m) => [
    { value: m.id }, { value: m.name }, { value: m.mobile }, { value: m.device },
    { value: m.device === 'Smartphone' ? 'App or call' : 'Voice call' }, { value: LANG_NAME[m.lang] ?? m.lang }, { value: m.village },
    { value: m.buffaloes, type: Number }, { value: m.cows, type: Number }, { value: Math.round(m.litres * 10) / 10, type: Number, format: '0.0' },
    { value: m.status }, { value: '' }, { value: '' },
  ])];
  const about = [
    [{ value: 'Interested members', fontWeight: 'bold' as const, fontSize: 14 }],
    [{ value: 'Society' }, { value: FARMER.society }],
    [{ value: 'Signal' }, { value: `Lean-season buffalo milk premium, Rs ${o.rate} per kg fat, ${PREMIUM_PERIOD.from} to ${PREMIUM_PERIOD.to}` }],
    [{ value: 'Members interested' }, { value: list.length, type: Number }],
    [{ value: 'Data as of' }, { value: o.demoDate }],
    [{ value: 'How to use' }, { value: 'Call each member back, then fill in the Called back and Notes columns.' }],
    [{ value: 'Note' }, { value: 'Demo data. Names and phone numbers are made up. Contact details are personal data: share only within the society.' }],
  ];
  await writeExcelFile([
    { data, sheet: 'Interested members', columns: [9, 22, 18, 20, 13, 11, 12, 10, 7, 14, 11, 12, 30].map((width) => ({ width })), stickyRowsCount: 1 },
    { data: about, sheet: 'About', columns: [{ width: 20 }, { width: 90 }] },
  ]).toFile(`Interested_members_${FARMER.society.replace(/\s+/g, '_')}_${o.demoDate}.xlsx`);
}

function Overview({ go }: { go: (v: string) => void }) {
  const s = useStore();
  const apr = s.demoDate === 'apr';
  const published = s.incentive.status === 'published';
  const r = reach(published, s.farmer.heard, s.farmer.interested, apr);
  const buf = apr ? 2310 : 2560, cow = apr ? 1980 : 2120;
  const target = apr && published ? Math.round(buf / 1.04 * 1.06) : null;
  return (
    <div>
      <PageTitle title="Overview" sub={`Collection on ${DEMO_DATES[s.demoDate].label}`} />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Buffalo milk today" value={`${num(buf)} L`} sub={target ? `Target ${num(target)} L` : 'No active target'} tone={target ? (buf >= target ? 'good' : 'warn') : undefined} />
        <Stat label="Cow milk today" value={`${num(cow)} L`} sub="No active target" />
        <Stat label="Members reached" value={published ? `${r.heard} / 412` : '-'} sub={published ? 'Heard the latest signal' : 'No active signal'} />
        <Stat label="Interested" value={published ? r.interested : '-'} sub={published ? 'Asked for follow-up' : ''} />
      </div>
      {published && r.interested ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <button className="btn-secondary !min-h-[38px] text-sm" onClick={() => downloadInterested(memberRows({ published, apr, lang: s.lang, heard: s.farmer.heard, interested: s.farmer.interested }), { rate: s.incentive.rate, demoDate: DEMO_DATES[s.demoDate].date })}><IconDownload />Download interested members (Excel)</button>
          <span className="text-muted">Names, phone numbers and herd size, to call each one back.</span>
        </div>
      ) : null}
      <div className="mt-6 max-w-[720px]">
        <h3 className="font-bold">Needs your action</h3>
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {s.incentive.status === 'approved' ? <li><button className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold text-primary transition-colors hover:bg-primary-light" onClick={() => go('targets')}><span className="h-2.5 w-2.5 rounded-full bg-marigold" />New approved target from the union: publish to members<IconChevron className="ml-auto" /></button></li> : null}
          {s.queries.filter((q) => q.status === 'open').length ? <li><button className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold text-primary transition-colors hover:bg-primary-light" onClick={() => go('queries')}><span className="h-2.5 w-2.5 rounded-full bg-marigold" />{s.queries.filter((q) => q.status === 'open').length} member {s.queries.filter((q) => q.status === 'open').length === 1 ? 'query' : 'queries'} waiting<IconChevron className="ml-auto" /></button></li> : null}
          {s.incentive.status !== 'approved' && !s.queries.some((q) => q.status === 'open') ? <li className="px-4 py-3 text-muted">Nothing pending.</li> : null}
        </ul>
      </div>
    </div>
  );
}

type SendSlot = 'evening' | 'morning' | 'both';
const SEND_SLOTS: { id: SendSlot; label: string; when: string; why: string }[] = [
  { id: 'evening', label: 'Evening', when: 'Tomorrow, 7:30 PM (after evening collection)', why: 'Members are home and more likely to listen to the full voice call and discuss it with the family.' },
  { id: 'morning', label: 'Morning', when: 'Tomorrow, 8:00 AM (after morning collection)', why: 'Arrives right after members see their morning litres and fat, but mornings are busy with fodder and field work.' },
  { id: 'both', label: 'Both', when: 'Tomorrow, 8:00 AM, with a 7:30 PM reminder', why: 'The evening reminder goes only to members who did not open the message or answer the call in the morning.' },
];

function Targets() {
  const s = useStore();
  const inc = s.incentive;
  const [prep, setPrep] = useState(false);
  const [concern, setConcern] = useState('');
  const [showConcern, setShowConcern] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [sendAt, setSendAt] = useState<SendSlot>('evening');
  const worth = worthToFarmer(DEMO_DATES[s.demoDate].date, inc.rate);
  if (inc.status === 'none' || inc.status === 'submitted' || inc.status === 'rejected') {
    return (<div><PageTitle title="Targets and incentives" /><div className="rounded-sheet border border-dashed border-line p-10 text-center text-muted">No approved targets from the union yet. {inc.status === 'submitted' ? 'A proposal is awaiting union approval.' : ''}</div></div>);
  }
  const row = (
    <table className="tbl card w-full overflow-hidden">
      <thead><tr><th>Target</th><th>Period</th><th>Incentive</th><th>Status</th><th></th></tr></thead>
      <tbody><tr>
        <td>+6% buffalo milk</td><td>1 Apr - 30 Jun 2027</td><td>₹{inc.rate} per kg fat (fixed)</td>
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
        {inc.status === 'published' && justSent ? <Delivery /> : null}
        {inc.status === 'published' ? <Note>Published to all eligible members by app and IVR. Members see it as a message from {FARMER.society}.</Note> : null}
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
          const msg = signalMessage(l.id, { society: FARMER.society, rate: inc.rate, worth });
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
              <textarea className="input indic mt-1 h-20" value={inc.notes[l.id] ?? ''} onChange={(e) => s.setIncentive({ notes: { ...inc.notes, [l.id]: e.target.value } })}
                placeholder={l.id === 'en' ? 'e.g. Subsidised maize seed at the society from 1 March.' : ''} /></label>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="card p-4 text-sm"><div className="font-bold">Audience</div>All eligible members (412): 298 by app, 114 by voice call (IVR)<br /><span className="text-xs text-muted">Feature-phone members get the same message by voice call at the same time.</span></div>
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
            <button className="btn-primary" disabled={!concern.trim()} onClick={() => { s.setIncentive({ status: 'concern', concern }); s.log('Society secretary', `Raised concern: ${concern}`); }}>Send concern</button></div>
        </div>
      ) : null}
      <div className="mt-5 flex justify-between">
        <button className="btn-secondary" onClick={() => setShowConcern(true)}>Raise concern</button>
        <button className="btn-primary" onClick={() => { setJustSent(true); s.setIncentive({ status: 'published' }); s.log('Society secretary', `Published summer buffalo premium (₹${inc.rate}/kg fat, ${PREMIUM_PERIOD.from} to ${PREMIUM_PERIOD.to}) to 412 members, sending ${SEND_SLOTS.find((x) => x.id === sendAt)!.when.toLowerCase()}`); }}>Publish to members</button>
      </div>
    </div>
  );
}

function Members() {
  const s = useStore();
  const [f, setF] = useState<'all' | 'interested' | 'not' | 'ivr'>('all');
  const [busy, setBusy] = useState(false);
  const apr = s.demoDate === 'apr';
  const published = s.incentive.status === 'published';
  const all = memberRows({ published, apr, lang: s.lang, heard: s.farmer.heard, interested: s.farmer.interested });
  const nInterested = all.filter((r) => r.status === 'Interested').length;
  const filtered = all.filter((r) => f === 'all' || (f === 'interested' && r.status === 'Interested') || (f === 'not' && r.status === 'Not heard') || (f === 'ivr' && r.device !== 'Smartphone'));
  const rows = filtered.slice(0, 80);
  const dl = async () => { setBusy(true); try { await downloadInterested(all, { rate: s.incentive.rate, demoDate: DEMO_DATES[s.demoDate].date }); } finally { setBusy(false); } };
  return (
    <div>
      <PageTitle title="Members" sub={`${TOTAL_MEMBERS} members. ${filtered.length > rows.length ? `Showing the first ${rows.length} of ${filtered.length}.` : `Showing ${filtered.length}.`}`} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented options={[{ id: 'all', label: 'All' }, { id: 'interested', label: 'Interested' }, { id: 'not', label: 'Not heard' }, { id: 'ivr', label: 'IVR only' }]} value={f} onChange={(v) => setF(v as typeof f)} />
        <button className="btn-secondary ml-auto !min-h-[38px] text-sm" disabled={!published || !nInterested || busy} onClick={dl} title={!published ? 'Available once a signal is published' : undefined}>
          <IconDownload />{busy ? 'Preparing...' : `Download interested (${published ? nInterested : 0}) as Excel`}
        </button>
      </div>
      {!published ? <p className="mb-3 text-sm text-muted">Interest is recorded once a signal is published to members. The download is available then.</p> : null}
      <div className="card overflow-x-auto">
        <table className="tbl w-full min-w-[760px]">
          <thead><tr><th>ID</th><th>Name</th><th>Mobile</th><th>Device</th><th>Language</th><th>Herd</th><th>Avg L/day</th><th>Signal status</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className={r.isDemoFarmer ? 'bg-primary-light' : 'hover:bg-alt'}><td>{r.id}</td><td>{r.name}<div className="text-xs text-muted">{r.village}</div></td><td className="num whitespace-nowrap">{r.mobile}</td><td className="text-xs">{r.device}</td><td>{r.lang.toUpperCase()}</td><td className="whitespace-nowrap text-xs">{r.buffaloes} buf, {r.cows} cow</td><td className="num">{r.litres.toFixed(1)}</td>
              <td>{r.status === '-' ? <span className="text-muted">-</span> : <Chip tone={r.status === 'Interested' ? 'good' : r.status === 'Heard' ? 'primary' : 'neutral'}>{r.status}</Chip>}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <Note>Phone numbers are personal data. They are visible only to the society and are not shared with lenders without the member&apos;s consent.</Note>
    </div>
  );
}

const IconDownload = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>);

function Queries() {
  const s = useStore();
  const [reply, setReply] = useState<Record<string, string>>({});
  return (
    <div>
      <PageTitle title="Member queries" sub="Questions the assistant could not answer, disputes and data requests (BR-11)." />
      {s.queries.length === 0 ? <div className="rounded-sheet border border-dashed border-line p-10 text-center text-muted">No queries yet. Questions the farmer app cannot answer land here.</div> : null}
      <div className="space-y-3">
        {s.queries.map((q) => (
          <div key={q.id} className="card animate-view-in p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><b>{q.id}</b><span>{FARMER.name}</span><Chip>{q.lang.toUpperCase()}</Chip><span className="text-xs text-muted">{new Date(q.at).toLocaleString('en-IN')}</span>
              <span className="ml-auto"><Chip tone={q.status === 'open' ? 'warn' : 'good'}>{q.status === 'open' ? 'waiting for society' : 'replied'}</Chip></span></div>
            <div className="mt-2 space-y-1.5">
              {threadOf(q).map((m, i) => (
                <div key={i} className={`flex ${m.from === 'society' ? 'justify-end' : ''}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.from === 'society' ? 'bg-good-light' : 'bg-fill'}`}>
                    <div className="text-[11px] font-semibold text-muted">{m.from === 'society' ? 'Society' : FARMER.name}</div>
                    <div className="indic">{m.text}</div>
                  </div>
                </div>
              ))}
            </div>
            {q.status === 'resolved' && q.farmerSeen ? <div className="mt-1 text-right text-[11px] text-muted">Seen by farmer</div> : null}
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (reply[q.id]?.trim()) { s.replyQuery(q.id, reply[q.id].trim()); setReply({ ...reply, [q.id]: '' }); } }}>
              <input className="input" placeholder={q.status === 'open' ? 'Type a reply (sent to the farmer in their language)' : 'Add another reply'} value={reply[q.id] ?? ''} onChange={(e) => setReply({ ...reply, [q.id]: e.target.value })} />
              <button className="btn-primary" type="submit" disabled={!reply[q.id]?.trim()}>Send</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reports() {
  const s = useStore();
  const published = s.incentive.status === 'published';
  const apr = s.demoDate === 'apr';
  const data = ['Jan', 'Feb', 'Mar', 'Apr'].map((m, i) => ({ m, buffalo: [2950, 2880, 2600, 2310][i], target: i === 3 && published ? 2360 : null }));
  return (
    <div>
      <PageTitle title="Reports" />
      <div className="card p-5"><div className="font-bold">Buffalo milk collection (litres per day, monthly average)</div>
        <div className="mt-3 h-64"><ResponsiveContainer><BarChart data={apr ? data : data.slice(0, 3)}><CartesianGrid vertical={false} stroke={CHART.grid} /><XAxis dataKey="m" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F4F8FC' }} /><Legend iconType="circle" />
          <Bar dataKey="buffalo" name="Collected" fill={CHART.indigo} radius={[6, 6, 0, 0]} /><Bar dataKey="target" name="Target" fill={CHART.marigold} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <Note>Demo figures. Lean-season fall is expected; the target is set against last year&apos;s April.</Note>
      </div>
      {published && apr ? <div className="mt-4 max-w-[420px]"><Stat label="Premium paid to members in April (society total)" value={inr(2310 * 30 * 1.03 * 0.07 * s.incentive.rate)} tone="good" /></div> : null}
    </div>
  );
}

// Shown once, right after Publish: each dot is a member; they light up as the message goes out.
function Delivery() {
  const total = 412, app = 298;
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
