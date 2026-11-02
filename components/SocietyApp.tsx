'use client';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '@/lib/store';
import { DEMO_DATES, FARMER, PREMIUM_PERIOD } from '@/lib/demo';
import { LANGS, signalMessage, storyMessage, type Lang } from '@/lib/i18n';
import { milkStory } from '@/lib/marketing';
import { worthToFarmer } from '@/lib/farmer';
import { gauss, inr, mulberry32, num } from '@/lib/util';
import { CHART, Chip, ConsoleShell, Count, Note, PageTitle, PlayButton, Segmented, Stat } from './ui';
import { IconCheck, IconChevron } from './icons';

const MEMBERS = (() => {
  const r = mulberry32(7);
  const first = ['Ramila', 'Jashodaben', 'Kantibhai', 'Hansaben', 'Manubhai', 'Bhartiben', 'Dahyabhai', 'Kokilaben', 'Pravinbhai', 'Sharda', 'Ishwarbhai', 'Mina', 'Rekha', 'Bhikhabhai', 'Geeta'];
  const last = ['Patel', 'Parmar', 'Solanki', 'Chauhan', 'Thakor', 'Rathod', 'Makwana', 'Vaghela'];
  const list = Array.from({ length: 411 }, (_, i) => {
    const feature = r() < 0.28;
    return { id: String(i + 1).padStart(4, '0'), name: `${first[Math.floor(r() * first.length)]} ${last[Math.floor(r() * last.length)]}`, phone: feature ? 'Feature phone (IVR)' : 'Smartphone', lang: (r() < 0.85 ? 'gu' : r() < 0.8 ? 'hi' : 'en') as Lang, litres: Math.max(3, 12 + gauss(r) * 5), heardP: r(), interestedP: r() };
  });
  return list;
})();

export default function SocietyApp() {
  const s = useStore();
  const [view, setView] = useState('overview');
  const inc = s.incentive;
  const pendingTarget = inc.status === 'approved' ? 1 : 0;
  const openQ = s.queries.filter((q) => q.status === 'open').length;
  const menu = [
    { id: 'overview', label: 'Overview' }, { id: 'targets', label: 'Targets', badge: pendingTarget },
    { id: 'members', label: 'Members' }, { id: 'queries', label: 'Queries', badge: openQ }, { id: 'story', label: 'Milk story', badge: s.marketing.story === 'sent' ? 1 : 0 }, { id: 'reports', label: 'Reports' },
  ];
  return (
    <ConsoleShell title="Society dashboard" place={FARMER.society} menu={menu} active={view} onSelect={setView} right={<span className="rounded-full bg-white/10 px-3 py-1">Rameshbhai, secretary</span>}>
      {view === 'overview' ? <Overview go={setView} /> : view === 'targets' ? <Targets /> : view === 'members' ? <Members /> : view === 'queries' ? <Queries /> : view === 'story' ? <MilkStory /> : <Reports />}
    </ConsoleShell>
  );
}

function reach(published: boolean, heardSavita: boolean, intSavita: boolean, apr: boolean) {
  if (!published) return { heard: 0, interested: 0 };
  const h = MEMBERS.filter((m) => m.heardP < (apr ? 0.86 : 0.68)).length + (heardSavita ? 1 : 0);
  const i = MEMBERS.filter((m) => m.interestedP < (apr ? 0.27 : 0.18)).length + (intSavita ? 1 : 0);
  return { heard: h, interested: i };
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
      <div className="mt-6 max-w-[720px]">
        <h3 className="font-bold">Needs your action</h3>
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {s.incentive.status === 'approved' ? <li><button className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold text-primary transition-colors hover:bg-primary-light" onClick={() => go('targets')}><span className="h-2.5 w-2.5 rounded-full bg-marigold" />New approved target from the union: publish to members<IconChevron className="ml-auto" /></button></li> : null}
          {s.queries.filter((q) => q.status === 'open').length ? <li><button className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold text-primary transition-colors hover:bg-primary-light" onClick={() => go('queries')}><span className="h-2.5 w-2.5 rounded-full bg-marigold" />{s.queries.filter((q) => q.status === 'open').length} member {s.queries.filter((q) => q.status === 'open').length === 1 ? 'query' : 'queries'} waiting<IconChevron className="ml-auto" /></button></li> : null}
          {s.marketing.story === 'sent' ? <li><button className="flex w-full items-center gap-3 px-4 py-3 text-left font-semibold text-primary transition-colors hover:bg-primary-light" onClick={() => go('story')}><span className="h-2.5 w-2.5 rounded-full bg-marigold" />Monthly milk story from the union: review and publish<IconChevron className="ml-auto" /></button></li> : null}
          {s.incentive.status !== 'approved' && !s.queries.some((q) => q.status === 'open') && s.marketing.story !== 'sent' ? <li className="px-4 py-3 text-muted">Nothing pending.</li> : null}
        </ul>
      </div>
    </div>
  );
}

function Targets() {
  const s = useStore();
  const inc = s.incentive;
  const [prep, setPrep] = useState(false);
  const [concern, setConcern] = useState('');
  const [showConcern, setShowConcern] = useState(false);
  const [justSent, setJustSent] = useState(false);
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
  // Languages this society's members use (Savitaben's own choice included); templates exist for all ten
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
              <Note>Personal figure shown for {FARMER.first}; each member hears their own amount.</Note>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card mt-4 p-4">
        <div className="font-bold">Local note (optional)</div>
        <p className="text-xs text-muted">Reviewed templates exist in 10 languages; the cards above are the languages your members use. Gnani.ai provides voice, not translation. Write the note in each language, or leave the other languages blank to send the template only.</p>
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
        <div className="card p-4 text-sm"><div className="font-bold">Send at</div>Tomorrow, 8:00 AM (after morning collection)</div>
      </div>
      {showConcern ? (
        <div className="card mt-4 p-4">
          <div className="font-bold">Raise a concern with the union</div>
          <textarea className="input mt-2 h-20" value={concern} onChange={(e) => setConcern(e.target.value)} placeholder="e.g. Many of our members have no buffalo; the target is too high." />
          <div className="mt-2 flex gap-2"><button className="btn-quiet" onClick={() => setShowConcern(false)}>Cancel</button>
            <button className="btn-primary" disabled={!concern.trim()} onClick={() => { s.setIncentive({ status: 'concern', concern }); s.log('Rameshbhai (society)', `Raised concern: ${concern}`); }}>Send concern</button></div>
        </div>
      ) : null}
      <div className="mt-5 flex justify-between">
        <button className="btn-secondary" onClick={() => setShowConcern(true)}>Raise concern</button>
        <button className="btn-primary" onClick={() => { setJustSent(true); s.setIncentive({ status: 'published' }); s.log('Rameshbhai (society)', `Published summer buffalo premium (₹${inc.rate}/kg fat, ${PREMIUM_PERIOD.from} to ${PREMIUM_PERIOD.to}) to 412 members`); }}>Publish to members</button>
      </div>
    </div>
  );
}

function Members() {
  const s = useStore();
  const [f, setF] = useState<'all' | 'interested' | 'not' | 'ivr'>('all');
  const apr = s.demoDate === 'apr';
  const published = s.incentive.status === 'published';
  const status = (hp: number, ip: number) => !published ? '-' : ip < (apr ? 0.27 : 0.18) ? 'Interested' : hp < (apr ? 0.86 : 0.68) ? 'Heard' : 'Not heard';
  const rows = [
    { id: FARMER.memberId, name: FARMER.name, phone: 'Smartphone', lang: s.lang, litres: 16, st: !published ? '-' : s.farmer.interested ? 'Interested' : s.farmer.heard ? 'Heard' : 'Not heard' },
    ...MEMBERS.slice(0, 60).map((m) => ({ id: m.id, name: m.name, phone: m.phone, lang: m.lang, litres: m.litres, st: status(m.heardP, m.interestedP) })),
  ].filter((r) => f === 'all' || (f === 'interested' && r.st === 'Interested') || (f === 'not' && r.st === 'Not heard') || (f === 'ivr' && r.phone.startsWith('Feature')));
  return (
    <div>
      <PageTitle title="Members" sub="412 members. Showing the first 61." />
      <div className="mb-3"><Segmented options={[{ id: 'all', label: 'All' }, { id: 'interested', label: 'Interested' }, { id: 'not', label: 'Not heard' }, { id: 'ivr', label: 'IVR only' }]} value={f} onChange={(v) => setF(v as typeof f)} /></div>
      <table className="tbl card w-full overflow-hidden">
        <thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Language</th><th>Avg L/day</th><th>Signal status</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className={r.id === FARMER.memberId ? 'bg-primary-light' : 'hover:bg-alt'}><td>{r.id}</td><td>{r.name}</td><td>{r.phone}</td><td>{r.lang.toUpperCase()}</td><td className="num">{r.litres.toFixed(1)}</td>
            <td>{r.st === '-' ? <span className="text-muted">-</span> : <Chip tone={r.st === 'Interested' ? 'good' : r.st === 'Heard' ? 'primary' : 'neutral'}>{r.st}</Chip>}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

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
              <span className="ml-auto"><Chip tone={q.status === 'open' ? 'warn' : 'good'}>{q.status}</Chip></span></div>
            <p className="indic mt-2">“{q.text}”</p>
            {q.reply ? <p className="mt-2 animate-pop rounded-lg bg-good-light p-2.5 text-sm">Reply: {q.reply}</p> : (
              <div className="mt-2 flex gap-2"><input className="input" placeholder="Type a reply (sent to the farmer in their language)" value={reply[q.id] ?? ''} onChange={(e) => setReply({ ...reply, [q.id]: e.target.value })} />
                <button className="btn-primary" disabled={!reply[q.id]} onClick={() => s.replyQuery(q.id, reply[q.id])}>Send</button></div>
            )}
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
        <div className="mt-3 h-64"><ResponsiveContainer><BarChart data={apr ? data : data.slice(0, 3)}><CartesianGrid vertical={false} stroke={CHART.grid} /><XAxis dataKey="m" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F3F5F9' }} /><Legend iconType="circle" />
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

// S-10: the union's monthly milk story, published in the society's name (FRD SW6)
function MilkStory() {
  const s = useStore();
  const st = s.marketing.story;
  const shares = milkStory();
  if (st === 'none') return <div><PageTitle title="Milk story" /><div className="rounded-sheet border border-dashed border-line p-10 text-center text-muted">No story from the union yet. The planner sends one each month (Planner console, Marketing, Farmer members).</div></div>;
  const langs: { id: Lang; name: string }[] = [{ id: 'gu', name: 'Gujarati' }, { id: 'hi', name: 'Hindi' }, { id: 'en', name: 'English' }];
  return (
    <div>
      <PageTitle title="Milk story" chip={<Chip tone={st === 'published' ? 'good' : 'primary'}>{st === 'published' ? 'Published' : 'From the union'}</Chip>} sub="Where the society's milk goes this summer, from the union's product-mix plan. Members hear it in the society's name." />
      <div className="grid gap-4 lg:grid-cols-3">
        {langs.map((l) => {
          const msg = storyMessage(l.id, FARMER.society, shares);
          return (
            <div key={l.id} className="card overflow-hidden"><div className="blockprint h-1.5" /><div className="p-4">
              <div className="flex items-center justify-between"><span className="font-semibold">{l.name}</span><PlayButton text={msg} lang={l.id} /></div>
              <p className="indic mt-2 text-sm">{msg}</p>
              <div className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-good"><IconCheck size={14} />Template reviewed</div>
            </div></div>
          );
        })}
      </div>
      <div className="card mt-4 p-4 text-sm"><div className="font-bold">Audience</div>All members (412): 298 by app, 114 by voice call (IVR). Counts towards each member&apos;s limit of 2 messages a week; the premium signal is never held back for it.</div>
      <div className="mt-5 flex justify-between">
        {st === 'sent' ? <>
          <button className="btn-secondary" onClick={() => { s.setMarketing({ story: 'none' }); s.log('Rameshbhai (society)', 'Raised a concern on the milk story; returned to the union'); }}>Raise concern</button>
          <button className="btn-primary" onClick={() => { s.setMarketing({ story: 'published' }); s.log('Rameshbhai (society)', 'Published the April milk story to 412 members'); }}>Publish to members</button>
        </> : <Note>Published to all members by app and IVR.</Note>}
      </div>
    </div>
  );
}
