'use client';
// Planner console: one screen (FRD P-01). Sections follow the planning story:
// data health -> demand -> product mix -> milk gap and incentive (with approval) -> marketing -> results.
import { useMemo, useState } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useStore } from '@/lib/store';
import { DEMO_DATES, UNION } from '@/lib/demo';
import { CITIES, HEATWAVE, PRODUCTS, forecast, type City, type ProductId } from '@/lib/demand';
import { CAP_SHARE, FAIRNESS_MIN, MONTHS_LEAN, SOCIETIES, SOURCES, SUGGESTED_IDS, incentiveImpact, milkGap, plan } from '@/lib/union';
import { CAMPAIGNS, campaignPlan, campaignResult, type Campaign } from '@/lib/marketing';
import { fmtDate, inr, inrShort, num, pct } from '@/lib/util';
import { CHART, Chip, ConsoleShell, Count, Note, PageTitle, Segmented, Stat } from './ui';
import { IconCheck } from './icons';
import DemandMap from './DemandMap';

const pill = (on: boolean) => `rounded-full border px-3 py-1 text-sm transition-colors ${on ? 'border-primary bg-primary font-semibold text-white' : 'border-line bg-white hover:bg-alt'}`;
const axis = { tickLine: false, axisLine: false, fontSize: 11, stroke: '#5B6275' } as const;
const ASOF = DEMO_DATES['mar'].date;

const USERS = { planner: 'Priya (planner)', approver: 'Mr Shah (approver)', marketer: 'Neha (marketing)' };

export default function PlannerApp() {
  const s = useStore();
  return (
    <ConsoleShell title="Planner console" place={UNION} menu={[]} active="planner" onSelect={() => undefined}
      right={<label className="flex items-center gap-2 text-white/75">Signed in as
        <select className="rounded-full border-0 bg-white/10 px-3 py-1 text-white outline-none [&>option]:text-ink" value={s.plannerUser} onChange={(e) => s.set({ plannerUser: e.target.value as 'planner' | 'approver' | 'marketer' })}>
          <option value="planner">{USERS.planner}</option><option value="approver">{USERS.approver}</option><option value="marketer">{USERS.marketer}</option></select></label>}>
      <Overview />
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Section n={1} title="Demand forecast" sub="What will sell, where and when"><DemandCard /></Section>
        <Section n={2} title="Product mix" sub="Best use of each litre of milk"><MixCard /></Section>
        <Section n={3} title="Buffalo milk gap and incentive" sub="Close the gap with a premium; approver signs off" wide><GapIncentive /></Section>
        <Section n={4} title="Marketing" sub="Promote only what the plants can supply"><MarketingCard /></Section>
        <Section n={5} title="Results" sub="What the signal and campaigns delivered"><ResultsCard /></Section>
      </div>
    </ConsoleShell>
  );
}

function Section({ n, title, sub, wide, children }: { n: number; title: string; sub: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`card p-4 md:p-5 ${wide ? 'xl:col-span-2' : ''}`}>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">{n}</span>
        <h2 className="font-display text-[19px] font-bold leading-tight">{title}</h2>
        <span className="hidden text-sm text-muted sm:inline">{sub}</span>
      </div>
      {children}
    </section>
  );
}

function Details({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button className="text-sm font-semibold text-primary" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} {label}</button>
      {open ? <div className="mt-2 animate-view-in">{children}</div> : null}
    </div>
  );
}

const Mini = ({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'warn' }) => (
  <div className="rounded-xl bg-fill px-3 py-2"><div className="text-[12px] text-muted">{label}</div>
    <div className={`num text-[17px] font-bold ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : ''}`}>{value}</div></div>
);

// ---------- Overview: headline numbers and data health ----------
function Overview() {
  const s = useStore();
  const inc = s.incentive;
  const cur = useMemo(() => plan(ASOF, MONTHS_LEAN[0], false), []);
  const rec = useMemo(() => plan(ASOF, MONTHS_LEAN[0], true), []);
  const gap = useMemo(() => milkGap(ASOF), []);
  const peak = gap.reduce((a, b) => (b.gapPct > a.gapPct ? b : a), gap[0]);
  const f = useMemo(() => forecast('Mumbai', 'curd', ASOF, 90, 75), []);
  return (
    <div>
      <PageTitle title="Planning overview" sub={`Plan for April to June 2027, made on ${fmtDate(ASOF)} from all sales channels, weather and festivals.`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Heatwave lift, curd in Mumbai" value={`+${pct(f.heatLift, 1)}`} sub={`${fmtDate(HEATWAVE.from)} to ${fmtDate(HEATWAVE.to)}`} tone="warn" />
        <Stat label="Value per litre, April" value={`+₹${(rec.valuePerLitre - cur.valuePerLitre).toFixed(2)}`} sub="Recommended vs current mix" tone="good" />
        <Stat label="Buffalo milk gap" value={pct(peak.gapPct, 1)} sub={`Peak in ${peak.month}, ${num(peak.gap)} L/day`} tone="bad" />
        <Stat label="Incentive" value={inc.status === 'none' ? 'Not started' : inc.status[0].toUpperCase() + inc.status.slice(1)} sub={inc.status === 'none' ? 'Design it in section 3' : `₹${inc.rate} per kg fat`} tone={inc.status === 'published' || inc.status === 'approved' ? 'good' : undefined} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">Data health:</span>
        {SOURCES.map((x) => <Chip key={x.id} tone={x.quality >= 80 ? 'good' : x.quality >= 50 ? 'primary' : 'warn'}>{x.name} {x.quality}</Chip>)}
      </div>
      <Details label="data source details">
        <div className="card overflow-hidden"><table className="tbl w-full"><thead><tr><th>Source</th><th>Type</th><th>Freshness</th><th>Granularity</th><th>Quality</th></tr></thead>
          <tbody>{SOURCES.map((x) => (
            <tr key={x.id}><td><b>{x.name}</b><div className="text-xs text-muted">{x.note}</div></td><td>{x.kind}</td><td>{x.lag}</td><td>{x.grain}</td>
              <td>{x.quality}/100{x.prevQuality !== x.quality ? <div className="text-xs text-good">+{x.quality - x.prevQuality} vs last month</div> : null}</td></tr>
          ))}</tbody></table></div>
        <Note>Dealers: high volume, low quality (late, aggregated). Quick commerce: growing, quality depends on platform data sharing. Amul Shop: high quality, low volume.</Note>
      </Details>
    </div>
  );
}

// ---------- 1. Demand ----------
function DemandCard() {
  const [city, setCity] = useState<City>('Mumbai');
  const [prod, setProd] = useState<ProductId>('curd');
  const f = useMemo(() => forecast(city, prod, ASOF, 90, 75), [city, prod]);
  const p = PRODUCTS.find((x) => x.id === prod)!;
  const data = f.points.map((x) => ({ ...x, range: x.lo !== undefined ? [x.lo, x.hi] : undefined, label: x.date.slice(5) }));
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {CITIES.map((c) => <button key={c} onClick={() => setCity(c)} className={pill(city === c)}>{c}</button>)}
        <span className="mx-1 border-l border-line" />
        {PRODUCTS.map((x) => <button key={x.id} onClick={() => setProd(x.id)} className={pill(prod === x.id)}>{x.name}</button>)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Mini label="Apr-Jun per day" value={`${num(Math.round(f.avgNext('2027-04-01', '2027-06-30')))} ${p.unit}`} />
        <Mini label="Growth vs last year" value={pct(f.growth, 1)} tone={f.growth > 0 ? 'good' : 'bad'} />
        <Mini label="Heatwave lift" value={pct(f.heatLift, 1)} tone={f.heatLift > 0.03 ? 'warn' : undefined} />
      </div>
      <div key={`${city}-${prod}`} className="mt-3 h-64 animate-view-in"><ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" interval={20} {...axis} />
          <YAxis {...axis} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
          <ReferenceArea x1={HEATWAVE.from.slice(5)} x2={HEATWAVE.to.slice(5)} fill="#FFF3CF" label={{ value: 'Heatwave', position: 'insideTop', fontSize: 11, fill: CHART.marigoldDeep }} />
          <Area dataKey="range" stroke="none" fill={CHART.indigoSoft} fillOpacity={0.55} name="80% range" />
          <Line dataKey="actual" stroke="#171A26" dot={false} strokeWidth={1.5} name="Actual" />
          <Line dataKey="forecast" stroke={CHART.indigo} dot={false} strokeWidth={2.5} name="Forecast" />
          <Tooltip formatter={(v: number | number[], n: string) => [Array.isArray(v) ? `${num(v[0])} - ${num(v[1])}` : num(v), n]} />
          <Legend iconType="circle" />
        </ComposedChart>
      </ResponsiveContainer></div>
      <Note>Forecast accuracy over the last 28 days: {pct(1 - f.mape, 0)}. Built from dealer orders, quick commerce, Amul Shop and the weather outlook.</Note>
      <Details label="neighbourhood demand map"><DemandMap /></Details>
    </div>
  );
}

// ---------- 2. Product mix ----------
function MixCard() {
  const [mi, setMi] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const month = MONTHS_LEAN[mi];
  const cur = useMemo(() => plan(ASOF, month, false), [mi]); // eslint-disable-line react-hooks/exhaustive-deps
  const rec = useMemo(() => plan(ASOF, month, true), [mi]); // eslint-disable-line react-hooks/exhaustive-deps
  const chart = rec.rows.map((r) => ({ name: r.name, current: Math.round(cur.rows.find((c) => c.id === r.id)!.litres / 1000), recommended: Math.round(r.litres / 1000) }));
  const days = Number(month.to.slice(8, 10));
  return (
    <div>
      <Segmented options={MONTHS_LEAN.map((m, i) => ({ id: String(i), label: m.label }))} value={String(mi)} onChange={(v) => setMi(Number(v))} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Mini label="Milk per day" value={`${num(Math.round(rec.supply / 1000))}k L`} />
        <Mini label="Value per litre" value={`₹${cur.valuePerLitre.toFixed(1)} → ₹${rec.valuePerLitre.toFixed(1)}`} tone="good" />
        <Mini label="Extra value this month" value={inrShort((rec.totalValue - cur.totalValue) * days)} tone="good" />
      </div>
      <div className="mt-3 h-60"><ResponsiveContainer><BarChart data={chart} layout="vertical" margin={{ left: 10, right: 30 }}>
        <CartesianGrid stroke={CHART.grid} horizontal={false} /><XAxis type="number" {...axis} /><YAxis type="category" dataKey="name" {...axis} width={120} />
        <Tooltip cursor={{ fill: '#F3F5F9' }} formatter={(v: number) => `${num(v)}k L/day`} /><Legend iconType="circle" />
        <Bar dataKey="current" name="Current plan" fill={CHART.grey} radius={[0, 4, 4, 0]} />
        <Bar dataKey="recommended" name="Recommended" fill={CHART.indigo} radius={[0, 4, 4, 0]}><LabelList dataKey="recommended" position="right" fontSize={10} /></Bar>
      </BarChart></ResponsiveContainer></div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button className={accepted ? 'btn bg-good-light text-good' : 'btn-primary'} disabled={accepted} onClick={() => setAccepted(true)}>{accepted ? <><IconCheck size={18} animate />Plan accepted</> : 'Accept recommended plan'}</button>
        <span className="text-sm text-muted">{accepted ? 'Sent to plant scheduling. Paneer is still short of buffalo milk (section 3).' : 'Liquid milk commitments are always met first (BR-15).'}</span>
      </div>
      <Details label="allocation table">
        <table className="tbl w-full"><thead><tr><th>Product</th><th>Value / L</th><th>Current</th><th>Recommended</th><th>Limited by</th></tr></thead>
          <tbody>{rec.rows.map((r) => {
            const c = cur.rows.find((x) => x.id === r.id)!;
            const lim = r.id === 'milk' ? 'Commitment' : r.id === 'sink' ? 'Remainder' : r.litres < r.want - 1 ? 'Buffalo milk' : 'Demand or capacity';
            return <tr key={r.id}><td>{r.name}</td><td>₹{(r.value / Math.max(1, r.litres)).toFixed(0)}</td><td>{num(Math.round(c.litres))}</td><td className="num font-bold">{num(Math.round(r.litres))}</td><td>{lim === 'Buffalo milk' ? <Chip tone="warn">Buffalo milk</Chip> : <span className="text-xs text-muted">{lim}</span>}</td></tr>;
          })}</tbody></table>
      </Details>
    </div>
  );
}

// ---------- 3. Milk gap, incentive and approval ----------
function GapIncentive() {
  const s = useStore();
  const inc = s.incentive;
  const g = useMemo(() => milkGap(ASOF), []);
  const gapData = g.map((x) => ({ month: x.month, req: Math.round(x.required / 1000), exp: Math.round(x.expected / 1000) }));
  const locked = inc.status !== 'none' && inc.status !== 'rejected';
  const imp = useMemo(() => incentiveImpact(ASOF, inc.rate, inc.ids), [inc.rate, inc.ids]);
  const [why, setWhy] = useState('');
  const smallIds = SOCIETIES.filter((x) => x.size === 'small').map((x) => x.id);
  const preset = (ids: number[]) => s.setIncentive({ ids: Array.from(new Set(ids)) });
  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <div className="label">Buffalo milk needed vs expected (thousand L/day)</div>
        <div className="mt-1 h-52"><ResponsiveContainer><BarChart data={gapData} margin={{ top: 20, right: 6, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="month" {...axis} fontSize={12} /><YAxis {...axis} /><Tooltip cursor={{ fill: '#F3F5F9' }} formatter={(v: number) => `${num(v)}k L/day`} /><Legend iconType="circle" />
          <Bar dataKey="req" name="Needed" fill={CHART.marigold} radius={[6, 6, 0, 0]}><LabelList dataKey="req" position="top" fontSize={11} /></Bar>
          <Bar dataKey="exp" name="Expected" fill={CHART.indigo} radius={[6, 6, 0, 0]}><LabelList dataKey="exp" position="top" fontSize={11} /></Bar>
        </BarChart></ResponsiveContainer></div>
        <div className="mt-2 flex flex-wrap gap-2">{g.map((x) => <Chip key={x.month} tone={x.gapPct > 0.05 ? 'bad' : 'warn'}>{x.month}: {pct(x.gapPct, 1)} short</Chip>)}</div>
        <Note>Breeding and herd signals need 9+ months of notice. For this season, a fixed lean-season premium is the lever with enough lead time.</Note>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2"><span className="font-bold">Lean-season premium on buffalo milk, 1 Apr to 30 Jun</span>
          {inc.status !== 'none' ? <Chip tone={inc.status === 'published' || inc.status === 'approved' ? 'good' : inc.status === 'rejected' ? 'bad' : 'primary'}>{inc.status}</Chip> : null}</div>
        <div className="mt-2 flex items-center gap-4">
          <div className="num shrink-0 whitespace-nowrap font-display text-[28px] font-bold leading-tight text-primary">₹<Count value={inc.rate} format={(n) => String(Math.round(n))} /><span className="text-[14px] font-semibold text-muted"> per kg fat</span></div>
          <input type="range" aria-label="Amount per kg fat" min={0} max={80} step={5} value={inc.rate} disabled={locked} onChange={(e) => s.setIncentive({ rate: Number(e.target.value) })} className="w-full accent-[#26347F]" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Societies: {imp.societies} of {SOCIETIES.length}</span>
          <button disabled={locked} className="btn-quiet !min-h-[32px] text-sm" onClick={() => preset(SUGGESTED_IDS)}>Suggested</button>
          <button disabled={locked} className="btn-quiet !min-h-[32px] text-sm" onClick={() => preset([...inc.ids, ...smallIds])}>+ Small societies</button>
          <button disabled={locked} className="btn-quiet !min-h-[32px] text-sm" onClick={() => preset(SOCIETIES.map((x) => x.id))}>All</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label="Extra buffalo milk" value={`+${num(imp.extraLitresPerDay)} L/day`} />
          <Mini label="Cost" value={inrShort(imp.cost)} />
          <Mini label="Value gained" value={inrShort(imp.valueGained)} tone="good" />
          <Mini label="Share to farmers" value={pct(imp.shareToFarmers)} />
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2 text-sm">
            <Chip tone={imp.capOk ? 'good' : 'bad'}>{imp.capOk ? `Cost within cap (${pct(CAP_SHARE)} of value)` : 'Cost above cap'}</Chip>
            <Chip tone={imp.fairOk ? 'good' : 'warn'}>{imp.fairOk ? 'Fair to small and large societies' : 'Fairness below board minimum'}</Chip>
          </div>
          {imp.fairness.map((f) => (
            <div key={f.group} className="grid grid-cols-[120px_1fr_90px] items-center gap-2 text-sm">
              <span>{f.group[0].toUpperCase() + f.group.slice(1)}</span>
              <div className="relative h-4 rounded-full bg-fill"><div className={`bar-anim h-4 rounded-full ${f.ok ? 'bg-primary' : 'bg-bad'}`} style={{ width: `${f.payoutShare * 100}%` }} />
                <div className="bar-anim absolute top-[-3px] h-[22px] w-[3px] rounded-full bg-marigold-deep" style={{ left: `${f.memberShare * 100}%` }} title="Share of members" /></div>
              <span className={`num text-right ${f.ok ? '' : 'font-bold text-bad'}`}>{pct(f.payoutShare)}</span>
            </div>
          ))}
          <div className="text-xs text-muted">Bar = share of payout; amber line = share of members. Each group should get at least {pct(FAIRNESS_MIN)} of its member share (BR-28).</div>
        </div>
        {!imp.fairOk && !locked ? <textarea className="input mt-3 h-14" placeholder="Written justification required to submit below the board minimum" value={why} onChange={(e) => setWhy(e.target.value)} /> : null}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {!locked ? (
            <button className="btn-primary" disabled={!imp.capOk || (!imp.fairOk && !why.trim()) || s.plannerUser !== 'planner'}
              onClick={() => { s.setIncentive({ status: 'submitted', submittedBy: USERS.planner, reason: why }); s.log(USERS.planner, `Submitted lean-season premium ₹${inc.rate}/kg fat for ${imp.societies} societies`); }}>Submit for approval</button>
          ) : null}
          {s.plannerUser !== 'planner' && !locked ? <span className="text-sm text-muted">Switch to the planner (top right) to submit.</span> : null}
        </div>
        <Approval />
      </div>
    </div>
  );
}

function Approval() {
  const s = useStore();
  const inc = s.incentive;
  const [reason, setReason] = useState('');
  if (inc.status === 'concern') {
    return (
      <div className="mt-3 rounded-xl border border-marigold-deep/40 bg-warn-light p-3 text-sm">
        <div className="font-bold text-warn">Concern raised by Anand Milk Society</div><p className="mt-1">“{inc.concern}”</p>
        <button className="btn-primary mt-2" onClick={() => { s.setIncentive({ status: 'approved', concern: undefined }); s.log(USERS.planner, 'Responded to society concern; target confirmed'); }}>Respond and confirm target</button>
      </div>
    );
  }
  if (inc.status === 'approved') return <div className="mt-3 text-sm text-good"><IconCheck size={16} className="inline" /> Approved by {inc.approvedBy ?? USERS.approver}. Released to societies to publish.</div>;
  if (inc.status === 'published') return <div className="mt-3 text-sm text-good"><IconCheck size={16} className="inline" /> Published by societies. See results in section 5.</div>;
  if (inc.status !== 'submitted') return null;
  const isApprover = s.plannerUser === 'approver';
  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary-light p-3 text-sm">
      <div className="font-bold text-primary">Waiting for approval</div>
      <div>Submitted by {inc.submittedBy}. The person who submits cannot approve (maker-checker, BR-17).{inc.reason ? <> Justification: “{inc.reason}”</> : null}</div>
      {isApprover ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={() => { s.setIncentive({ status: 'approved', approvedBy: USERS.approver }); s.log(USERS.approver, 'Approved lean-season premium; released to societies'); }}>Approve and release</button>
          <input className="input max-w-[220px]" placeholder="Reason (to reject)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn-quiet" disabled={!reason.trim()} onClick={() => { s.setIncentive({ status: 'rejected', reason }); s.log(USERS.approver, `Rejected: ${reason}`); }}>Reject</button>
        </div>
      ) : <div className="mt-1 text-muted">Switch to {USERS.approver} (top right) to decide.</div>}
    </div>
  );
}

// ---------- 4. Marketing ----------
function MarketingCard() {
  const s = useStore();
  const isMkt = s.plannerUser === 'marketer';
  const story = s.marketing.story;
  return (
    <div>
      {!isMkt ? <div className="mb-3 rounded-xl bg-fill p-2.5 text-sm text-muted">Campaigns are decided by the marketing manager (BR-34). Switch to <b>{USERS.marketer}</b> at the top right.</div> : null}
      <div className="space-y-2">{CAMPAIGNS.map((c) => <CampaignRow key={c.id} c={c} isMkt={isMkt} />)}</div>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <div className="text-sm"><b>Milk story for farmers</b>: tells members where their milk goes this summer.</div>
        {story === 'none' ? <button className="btn-quiet !min-h-[34px] text-sm" onClick={() => { s.setMarketing({ story: 'sent' }); s.log(USERS[s.plannerUser], 'Sent the April milk story to societies for publishing'); }}>Send to societies</button>
          : <Chip tone={story === 'published' ? 'good' : 'primary'}>{story === 'sent' ? 'Sent to societies' : 'Published'}</Chip>}
      </div>
    </div>
  );
}

function CampaignRow({ c, isMkt }: { c: Campaign; isMkt: boolean }) {
  const s = useStore();
  const p = useMemo(() => campaignPlan(c), [c]);
  const st = s.marketing.campaigns[c.id] ?? 'draft';
  const [over, setOver] = useState(false);
  const [why, setWhy] = useState('');
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{c.title}</span>
        <Chip tone={p.check.ok ? 'good' : 'warn'}>Supply {p.check.ok ? 'go' : 'hold'}</Chip>
        {st !== 'draft' ? <Chip tone={st === 'approved' ? 'good' : st === 'override' ? 'bad' : 'warn'}>{st === 'override' ? 'Approved over hold' : st}</Chip> : null}
      </div>
      <div className="mt-0.5 text-[13px] text-muted">{c.cities.join(', ')} | budget {inrShort(c.budget)} | expected +{pct(c.lift)} sales, ₹{p.perRupee.toFixed(1)} per ₹1</div>
      {!p.check.ok ? <div className="mt-1 text-[13px]">{p.check.reason}</div> : null}
      {st === 'draft' && isMkt ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {p.check.ok
            ? <button className="btn-primary !min-h-[34px] text-sm" onClick={() => { s.setCampaign(c.id, 'approved'); s.log(USERS.marketer, `Approved campaign "${c.title}" (${inrShort(c.budget)}); supply check go`); }}>Approve</button>
            : <><button className="btn-primary !min-h-[34px] text-sm" onClick={() => { s.setCampaign(c.id, 'held'); s.log(USERS.marketer, `Held campaign "${c.title}": ${p.check.reason}`); }}>Accept hold</button>
              <button className="btn-quiet !min-h-[34px] text-sm" onClick={() => setOver(!over)}>Override</button></>}
        </div>
      ) : null}
      {over && st === 'draft' ? (
        <div className="mt-2 flex gap-2">
          <input className="input" placeholder="Written reason; the planner is alerted" value={why} onChange={(e) => setWhy(e.target.value)} />
          <button className="btn-quiet" disabled={!why.trim()} onClick={() => { s.setCampaign(c.id, 'override', why); s.log(USERS.marketer, `Overrode supply-check hold on "${c.title}": ${why}`); }}>Approve</button>
        </div>
      ) : null}
    </div>
  );
}

// ---------- 5. Results ----------
function ResultsCard() {
  const s = useStore();
  const inc = s.incentive;
  const apr = s.demoDate === 'apr';
  const live = CAMPAIGNS.filter((c) => ['approved', 'override'].includes(s.marketing.campaigns[c.id] ?? ''));
  const published = inc.status === 'published';
  const imp = incentiveImpact(ASOF, inc.rate, inc.ids);
  const aprCost = imp.cost / 3, aprValue = imp.valueGained / 3;
  const ctrl = [{ g: 'Pilot societies', v: 865 + 36 + inc.rate }, { g: 'Control societies', v: 865 + 34 }];
  const camp = live.map((c) => ({ c, r: campaignResult(c) }));
  const spend = live.reduce((a, c) => a + c.budget, 0), cValue = camp.reduce((a, x) => a + x.r.value, 0);
  return (
    <div>
      {!published && !live.length ? <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Nothing live yet. Approve the incentive (section 3) and have the society publish it, or approve a campaign (section 4).</div> : null}
      {published ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="Members reached" value={apr ? '86%' : '68%'} />
            <Mini label="Interested" value={apr ? '27%' : '18%'} />
            <Mini label="Buffalo milk vs expected" value={apr ? '+4.1%' : '-'} tone={apr ? 'good' : undefined} />
            <Mini label="Premium paid (Apr)" value={apr ? inrShort(aprCost) : '-'} />
          </div>
          {apr ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
              <ul className="space-y-1 text-sm">
                <li>Value from better planning: <b>{inrShort(aprValue)}</b></li>
                <li>Paid to farmers: <b>{inrShort(aprCost)}</b> ({pct(aprCost / aprValue)} of value)</li>
                <li>Quick commerce stockouts (Mumbai): <b>-31%</b> vs April 2026</li>
              </ul>
              <div className="h-28"><ResponsiveContainer><BarChart data={ctrl} layout="vertical" margin={{ left: 10, right: 50 }}>
                <XAxis type="number" domain={[800, 960]} hide /><YAxis type="category" dataKey="g" width={110} {...axis} />
                <Bar dataKey="v" radius={[0, 6, 6, 0]} barSize={20}>{ctrl.map((_, i) => <Cell key={i} fill={i === 0 ? CHART.green : CHART.grey} />)}<LabelList dataKey="v" position="right" formatter={(v: number) => inr(v)} /></Bar>
              </BarChart></ResponsiveContainer><div className="text-center text-xs text-muted">Buffalo price per kg fat, April</div></div>
            </div>
          ) : <div className="mt-2 text-sm text-muted">Results appear after the first month: switch the demo date to 30 Apr.</div>}
        </>
      ) : null}
      {live.length ? (
        <div className="mt-3 border-t border-line pt-3 text-sm">
          <b>Campaigns:</b> {live.length} live, spend {inrShort(spend)}.{' '}
          {apr ? <>Sales lift vs control areas {camp.map(({ c, r }) => `${c.title.split(':')[0]} +${pct(r.lift, 1)}`).join(', ')}; return <b>₹{(cValue / spend).toFixed(1)} per ₹1</b>.</> : 'Lift vs control areas shows after launch (30 Apr).'}
        </div>
      ) : null}
      <Details label="audit log">
        <ul className="max-h-56 divide-y divide-[#E8EBF1] overflow-auto text-[13px]">{s.audit.length ? s.audit.map((a, i) => <li key={i} className="grid grid-cols-[140px_1fr] gap-3 py-1.5"><span className="num text-muted">{new Date(a.at).toLocaleString('en-IN')}</span><span><b className="font-semibold">{a.actor}</b>: {a.action}</span></li>) : <li className="py-1.5 text-muted">No actions yet.</li>}</ul>
      </Details>
    </div>
  );
}
