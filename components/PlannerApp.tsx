'use client';
import { useMemo, useState } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Legend, Line, ReferenceArea, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Cell,
} from 'recharts';
import { useStore } from '@/lib/store';
import { DEMO_DATES, UNION } from '@/lib/demo';
import { CHANNEL_LABEL, CITIES, HEATWAVE, PRODUCTS, channelTotals, forecast, type City, type ProductId } from '@/lib/demand';
import { CAP_SHARE, FAIRNESS_MIN, MONTHS_LEAN, SOCIETIES, SOURCES, SUGGESTED_IDS, incentiveImpact, milkGap, plan } from '@/lib/union';
import { fmtDate, inr, inrShort, num, pct } from '@/lib/util';
import { CHART, Chip, ConsoleShell, Count, Note, PageTitle, Segmented, Stat } from './ui';
import { IconCheck, IconChevron } from './icons';
import DemandMap from './DemandMap';

const pill = (on: boolean) => `rounded-full border px-3 py-1 text-sm transition-colors ${on ? 'border-primary bg-primary font-semibold text-white' : 'border-line bg-white hover:bg-alt'}`;
const axis = { tickLine: false, axisLine: false, fontSize: 11, stroke: '#5B6275' } as const;

const USERS = { planner: 'Priya (planner)', approver: 'Mr Shah (approver)' };

export default function PlannerApp() {
  const s = useStore();
  const [view, setView] = useState('health');
  const menu = [
    { id: 'health', label: 'Data health' }, { id: 'demand', label: 'Demand and forecast' }, { id: 'map', label: 'Demand map' }, { id: 'mix', label: 'Product mix' },
    { id: 'gap', label: 'Milk gap' }, { id: 'incentive', label: 'Incentive designer' },
    { id: 'approvals', label: 'Approvals', badge: s.incentive.status === 'submitted' || s.incentive.status === 'concern' ? 1 : 0 },
    { id: 'monitor', label: 'Monitor and report' },
  ];
  return (
    <ConsoleShell title="Planner console" place={UNION} menu={menu} active={view} onSelect={setView}
      right={<label className="flex items-center gap-2 text-white/75">Signed in as
        <select className="rounded-full border-0 bg-white/10 px-3 py-1 text-white outline-none [&>option]:text-ink" value={s.plannerUser} onChange={(e) => s.set({ plannerUser: e.target.value as 'planner' | 'approver' })}>
          <option value="planner">{USERS.planner}</option><option value="approver">{USERS.approver}</option></select></label>}>
      {view === 'health' ? <Health /> : view === 'demand' ? <Demand /> : view === 'map' ? <DemandMap /> : view === 'mix' ? <Mix /> : view === 'gap' ? <Gap go={setView} /> : view === 'incentive' ? <Incentive go={setView} /> : view === 'approvals' ? <Approvals /> : <Monitor />}
    </ConsoleShell>
  );
}

function Health() {
  const s = useStore();
  const today = DEMO_DATES[s.demoDate].date;
  const shares = useMemo(() => channelTotals(today), [today]);
  const now = SOURCES.filter((x) => x.kind === 'Demand').map((x) => ({ name: x.name, x: +(shares[x.id as keyof typeof shares] * 100).toFixed(1), y: x.quality }));
  const prev = SOURCES.filter((x) => x.kind === 'Demand').map((x) => ({ name: x.name + ' (last month)', x: +(shares[x.id as keyof typeof shares] * 100 * (x.id === 'qcomm' ? 0.95 : x.id === 'shop' ? 0.96 : 1.005)).toFixed(1), y: x.prevQuality }));
  return (
    <div>
      <PageTitle title="Data health" sub="Every forecast depends on these sources. The goal is to move each demand channel towards high volume and high quality." />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <div className="card overflow-hidden">
          <table className="tbl w-full"><thead><tr><th>Source</th><th>Type</th><th>Freshness</th><th>Granularity</th><th>Quality</th></tr></thead>
            <tbody>{SOURCES.map((x) => (
              <tr key={x.id}><td><b>{x.name}</b><div className="text-xs text-muted">{x.note}</div></td><td>{x.kind}</td><td>{x.lag}</td><td>{x.grain}</td>
                <td><Chip tone={x.quality >= 80 ? 'good' : x.quality >= 50 ? 'primary' : 'warn'}>{x.quality}/100</Chip>{x.prevQuality !== x.quality ? <div className="text-xs text-good">+{x.quality - x.prevQuality} vs last month</div> : null}</td></tr>
            ))}</tbody></table>
        </div>
        <div className="card p-4">
          <div className="font-bold">Demand channels: volume vs quality</div>
          <div className="h-72"><ResponsiveContainer>
            <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
              <CartesianGrid stroke={CHART.grid} />
              <ReferenceArea x1={50} x2={100} y1={70} y2={100} fill="#E3F2E9" fillOpacity={0.7} label={{ value: 'Target zone', position: 'insideTopRight', fontSize: 11, fill: CHART.green }} />
              <XAxis type="number" dataKey="x" name="Share of sales" unit="%" domain={[0, 100]} label={{ value: 'Share of sales (volume)', position: 'bottom', fontSize: 12 }} />
              <YAxis type="number" dataKey="y" name="Quality" domain={[0, 100]} label={{ value: 'Data quality', angle: -90, position: 'insideLeft', fontSize: 12 }} />
              <ZAxis range={[160, 160]} />
              <Tooltip cursor={false} formatter={(v: number, n: string) => [n === 'Share of sales' ? `${v}%` : v, n]} labelFormatter={() => ''} />
              <Scatter name="Last month" data={prev} fill={CHART.grey} animationDuration={600} />
              <Scatter name="Now" data={now} fill={CHART.indigo} animationDuration={600}><LabelList dataKey="name" position="right" fontSize={11} /></Scatter>
            </ScatterChart>
          </ResponsiveContainer></div>
          <Note>Dealers: high volume, low quality (late, aggregated, stocking not consumption). Quick commerce: growing, quality depends on platform data sharing. Amul Shop: high quality, low volume.</Note>
        </div>
      </div>
    </div>
  );
}

function Demand() {
  const s = useStore();
  const today = DEMO_DATES['mar'].date;
  const [city, setCity] = useState<City>('Mumbai');
  const [prod, setProd] = useState<ProductId>('curd');
  const f = useMemo(() => forecast(city, prod, today, 90, 75), [city, prod, today]);
  const p = PRODUCTS.find((x) => x.id === prod)!;
  const data = f.points.map((x) => ({ ...x, range: x.lo !== undefined ? [x.lo, x.hi] : undefined, label: x.date.slice(5) }));
  const aprAvg = f.avgNext('2027-04-01', '2027-06-30');
  const drivers = [
    { k: 'Growth vs last year', v: f.growth, t: 'Trend in recent weeks compared with the same weeks last year' },
    { k: 'Heatwave 10-24 Apr (IMD outlook)', v: f.heatLift, t: `Each extra °C changes ${p.name.toLowerCase()} demand by about ${pct(Math.exp(f.beta) - 1, 1)}` },
    { k: 'Season', v: 0, t: 'Summer pattern carried from last year (lean milk supply, high cold-product demand)' },
  ];
  void s;
  return (
    <div>
      <PageTitle title="Demand and forecast" sub={`Forecast made on ${fmtDate(today)} from all channels, weather and events. Shaded band = 80% range.`} />
      <div className="mb-4 flex flex-wrap gap-2">
        {CITIES.map((c) => <button key={c} onClick={() => setCity(c)} className={pill(city === c)}>{c}</button>)}
        <span className="mx-2 border-l border-line" />
        {PRODUCTS.map((x) => <button key={x.id} onClick={() => setProd(x.id)} className={pill(prod === x.id)}>{x.name}</button>)}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Apr-Jun daily average (forecast)" value={`${num(Math.round(aprAvg))} ${p.unit}`} sub={city} />
        <Stat label="Growth vs last year" value={pct(f.growth, 1)} tone={f.growth > 0 ? 'good' : 'bad'} />
        <Stat label="Heatwave lift" value={pct(f.heatLift, 1)} sub="During 10-24 Apr" tone={f.heatLift > 0.03 ? 'warn' : undefined} />
        <Stat label="Accuracy (last 28 days)" value={`${pct(1 - f.mape, 0)}`} sub={`MAPE ${pct(f.mape, 1)}`} />
      </div>
      <div key={`${city}-${prod}`} className="card mt-4 animate-view-in p-4">
        <div className="h-80"><ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 40, left: 10, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="label" interval={14} {...axis} />
            <YAxis yAxisId="d" {...axis} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
            <YAxis yAxisId="t" orientation="right" domain={[20, 50]} {...axis} unit="°" />
            <ReferenceArea yAxisId="d" x1={HEATWAVE.from.slice(5)} x2={HEATWAVE.to.slice(5)} fill="#FFF3CF" label={{ value: 'Heatwave outlook', position: 'insideTop', fontSize: 11, fill: CHART.marigoldDeep }} />
            <Area yAxisId="d" dataKey="range" stroke="none" fill={CHART.indigoSoft} fillOpacity={0.55} name="80% range" animationDuration={700} />
            <Line yAxisId="d" dataKey="actual" stroke="#171A26" dot={false} strokeWidth={1.5} name="Actual" animationDuration={700} />
            <Line yAxisId="d" dataKey="forecast" stroke={CHART.indigo} dot={false} strokeWidth={2.5} name="Forecast" animationDuration={900} />
            <Line yAxisId="t" dataKey="temp" stroke={CHART.temp} dot={false} strokeWidth={1.2} strokeDasharray="4 3" name="Max temp (°C)" animationDuration={700} />
            <Tooltip formatter={(v: number | number[], n: string) => [Array.isArray(v) ? `${num(v[0])} - ${num(v[1])}` : n.startsWith('Max') ? `${v}°C` : num(v), n]} />
            <Legend iconType="circle" />
          </ComposedChart>
        </ResponsiveContainer></div>
      </div>
      <div className="card mt-4 p-4">
        <div className="font-bold">Main drivers</div>
        <ul className="mt-2 space-y-1.5 text-sm">{drivers.map((d) => <li key={d.k}><b className="font-semibold">{d.k}</b>{d.v ? <span className={d.v > 0 ? 'text-good' : 'text-bad'}> {d.v > 0 ? '+' : ''}{pct(d.v, 1)}</span> : null}: {d.t}</li>)}</ul>
        <Note>Sources used: dealer orders (3-day lag), quick commerce feed (partial SKUs), Amul Shop orders, weather. Model: last year&apos;s pattern adjusted for growth and temperature. A starting point for a production model.</Note>
      </div>
    </div>
  );
}

function Mix() {
  const s = useStore();
  const asOf = DEMO_DATES['mar'].date;
  const [mi, setMi] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const month = MONTHS_LEAN[mi];
  const cur = useMemo(() => plan(asOf, month, false), [mi]); // eslint-disable-line react-hooks/exhaustive-deps
  const rec = useMemo(() => plan(asOf, month, true), [mi]); // eslint-disable-line react-hooks/exhaustive-deps
  const chart = rec.rows.map((r, i) => ({ name: r.name, current: Math.round(cur.rows.find((c) => c.id === r.id)!.litres / 1000), recommended: Math.round(r.litres / 1000), i }));
  const days = Number(month.to.slice(8, 10));
  void s;
  return (
    <div>
      <PageTitle title="Product mix" sub="How to use each litre of milk: highest value per litre first, within demand, plant capacity, available buffalo milk and the liquid milk commitment." />
      <div className="mb-4"><Segmented options={MONTHS_LEAN.map((m, i) => ({ id: String(i), label: `${m.label} 2027` }))} value={String(mi)} onChange={(v) => setMi(Number(v))} /></div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Milk available per day" value={`${num(Math.round(rec.supply / 1000))}k L`} sub={`Buffalo ${num(month.supply.buffalo / 1000)}k, cow ${num(month.supply.cow / 1000)}k`} />
        <Stat label="Value per litre: current" value={`₹${cur.valuePerLitre.toFixed(2)}`} />
        <Stat label="Value per litre: recommended" value={`₹${rec.valuePerLitre.toFixed(2)}`} tone="good" sub={`+₹${(rec.valuePerLitre - cur.valuePerLitre).toFixed(2)} per litre`} />
        <Stat label="Extra value this month" value={inrShort((rec.totalValue - cur.totalValue) * days)} tone="good" sub="Before any incentive" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="card p-4"><div className="font-bold">Milk allocation (thousand litres per day)</div>
          <div className="h-72"><ResponsiveContainer><BarChart data={chart} layout="vertical" margin={{ left: 60, right: 30 }}>
            <CartesianGrid stroke={CHART.grid} horizontal={false} /><XAxis type="number" {...axis} /><YAxis type="category" dataKey="name" {...axis} width={130} />
            <Tooltip cursor={{ fill: '#F3F5F9' }} /><Legend iconType="circle" /><Bar dataKey="current" name="Current plan" fill={CHART.grey} radius={[0, 4, 4, 0]} /><Bar dataKey="recommended" name="Recommended" fill={CHART.indigo} radius={[0, 4, 4, 0]}><LabelList dataKey="recommended" position="right" fontSize={10} /></Bar>
          </BarChart></ResponsiveContainer></div>
        </div>
        <div className="card overflow-hidden">
          <table className="tbl w-full"><thead><tr><th>Product</th><th>Value / L</th><th>Current</th><th>Recommended</th><th>Limited by</th></tr></thead>
            <tbody>{rec.rows.map((r) => {
              const c = cur.rows.find((x) => x.id === r.id)!;
              const lim = r.id === 'milk' ? 'Commitment' : r.id === 'sink' ? 'Remainder' : r.litres < r.want - 1 ? 'Buffalo milk' : 'Demand or capacity';
              return <tr key={r.id}><td>{r.name}</td><td>₹{(r.value / Math.max(1, r.litres)).toFixed(0)}</td><td>{num(Math.round(c.litres))}</td><td className="num font-bold">{num(Math.round(r.litres))}</td><td>{lim === 'Buffalo milk' ? <Chip tone="warn">Buffalo milk</Chip> : <span className="text-xs text-muted">{lim}</span>}</td></tr>;
            })}</tbody></table>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className={accepted ? 'btn bg-good-light text-good' : 'btn-primary'} disabled={accepted} onClick={() => setAccepted(true)}>{accepted ? <><IconCheck size={18} animate />Plan accepted</> : 'Accept recommended plan'}</button>
        <span className="text-sm text-muted">{accepted ? 'Sent to plant scheduling. Paneer is still limited by buffalo milk: see Milk gap.' : 'Liquid milk commitments are always met first (BR-15).'}</span>
      </div>
    </div>
  );
}

function Gap({ go }: { go: (v: string) => void }) {
  const asOf = DEMO_DATES['mar'].date;
  const g = useMemo(() => milkGap(asOf), [asOf]);
  const data = g.map((x) => ({ ...x, req: Math.round(x.required / 1000), exp: Math.round(x.expected / 1000) }));
  return (
    <div>
      <PageTitle title="Milk gap" sub="Buffalo milk needed for the recommended plan vs buffalo milk expected from members (lean season)." />
      <div className="grid gap-4 md:grid-cols-3">{g.map((x) => <Stat key={x.month} label={`${x.month} 2027 gap`} value={pct(x.gapPct, 1)} sub={`${num(x.gap)} L/day of buffalo milk`} tone={x.gapPct > 0.05 ? 'bad' : 'warn'} />)}</div>
      <div className="card mt-4 p-4"><div className="h-72"><ResponsiveContainer><BarChart data={data} margin={{ top: 22, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="month" {...axis} fontSize={13} /><YAxis unit="k" {...axis} /><Tooltip cursor={{ fill: '#F3F5F9' }} formatter={(v: number) => `${num(v)}k L/day`} /><Legend iconType="circle" />
        <Bar dataKey="req" name="Required" fill={CHART.marigold} radius={[6, 6, 0, 0]}><LabelList dataKey="req" position="top" fontSize={11} /></Bar>
        <Bar dataKey="exp" name="Expected" fill={CHART.indigo} radius={[6, 6, 0, 0]}><LabelList dataKey="exp" position="top" fontSize={11} /></Bar>
      </BarChart></ResponsiveContainer></div>
        <Note>Long-term signals (breeding, herd) need 9+ months of notice. For this season, a fixed lean-season premium is the lever with enough lead time.</Note>
      </div>
      <button className="btn-primary mt-4" onClick={() => go('incentive')}>Design an incentive for this gap<IconChevron /></button>
    </div>
  );
}

function Incentive({ go }: { go: (v: string) => void }) {
  const s = useStore();
  const inc = s.incentive;
  const asOf = DEMO_DATES['mar'].date;
  const locked = inc.status !== 'none' && inc.status !== 'rejected';
  const imp = useMemo(() => incentiveImpact(asOf, inc.rate, inc.ids), [inc.rate, inc.ids, asOf]);
  const [why, setWhy] = useState('');
  const smallIds = SOCIETIES.filter((x) => x.size === 'small').map((x) => x.id);
  const preset = (ids: number[]) => s.setIncentive({ ids: Array.from(new Set(ids)) });
  return (
    <div>
      <PageTitle title="Incentive designer" sub="Gap: buffalo milk, Apr to Jun 2027. Incentives add to the base price; the base formula is never changed (BR-04)."
        chip={inc.status !== 'none' ? <Chip tone={inc.status === 'published' ? 'good' : inc.status === 'rejected' ? 'bad' : 'primary'}>{inc.status}</Chip> : undefined} />
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="card space-y-4 p-4">
          <div><div className="label">Type</div><div>Lean-season premium on buffalo milk (fixed for the period)</div></div>
          <div><div className="label">Amount</div><div className="num font-display text-[30px] font-bold leading-tight text-primary">₹<Count value={inc.rate} format={(n) => String(Math.round(n))} /> <span className="text-[15px] font-semibold text-muted">per kg fat</span></div>
            <input type="range" aria-label="Amount per kg fat" min={0} max={80} step={5} value={inc.rate} disabled={locked} onChange={(e) => s.setIncentive({ rate: Number(e.target.value) })} className="mt-1 w-full accent-[#26347F]" /></div>
          <div><div className="label">Period</div><div>1 Apr - 30 Jun 2027</div></div>
          <div><div className="label">Societies: {imp.societies} of {SOCIETIES.length}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button disabled={locked} className="btn-quiet !min-h-[34px] text-sm" onClick={() => preset(SUGGESTED_IDS)}>Suggested (highest buffalo supply)</button>
              <button disabled={locked} className="btn-quiet !min-h-[34px] text-sm" onClick={() => preset([...inc.ids, ...smallIds])}>+ Include all small societies</button>
              <button disabled={locked} className="btn-quiet !min-h-[34px] text-sm" onClick={() => preset(SOCIETIES.map((x) => x.id))}>All societies</button>
            </div></div>
        </div>
        <div className="card p-4">
          <div className="label">Estimated impact (Apr-Jun)</div>
          <table className="mt-2 w-full text-[15px] [&_tr]:border-b [&_tr]:border-[#E8EBF1] [&_td]:py-2"><tbody>
            <tr><td className="py-1">Extra buffalo milk</td><td className="num text-right font-bold">+<Count value={imp.extraLitresPerDay} format={(n) => num(Math.round(n))} /> L/day <span className="font-normal text-muted">(range {num(imp.extraLo)} - {num(imp.extraHi)})</span></td></tr>
            <tr><td className="py-1">Incentive cost</td><td className="num text-right font-bold"><Count value={imp.cost} format={inrShort} /></td></tr>
            <tr><td className="py-1">Value gained (better mix + extra milk)</td><td className="num text-right font-bold"><Count value={imp.valueGained} format={inrShort} /></td></tr>
            <tr><td className="py-1">Cap check (cost ≤ {pct(CAP_SHARE)} of value)</td><td className="text-right"><Chip tone={imp.capOk ? 'good' : 'bad'}>{imp.capOk ? 'Within cap' : 'Above cap'}</Chip></td></tr>
            <tr><td className="py-1">Share of value paid to farmers</td><td className="num text-right font-bold">{pct(imp.shareToFarmers)}</td></tr>
          </tbody></table>
        </div>
      </div>
      <div className="card mt-5 p-4">
        <div className="flex items-center gap-2"><span className="font-bold">Fairness view: who benefits</span>{imp.fairOk ? <Chip tone="good">Meets board minimum</Chip> : <Chip tone="warn">Below board minimum</Chip>}</div>
        <div className="mt-3 space-y-3">{imp.fairness.map((f) => (
          <div key={f.group} className="grid grid-cols-[180px_1fr_120px] items-center gap-3 text-sm">
            <span>{f.group[0].toUpperCase() + f.group.slice(1)} societies</span>
            <div className="relative h-5 rounded-full bg-fill"><div className={`bar-anim h-5 rounded-full ${f.ok ? 'bg-primary' : 'bg-bad'}`} style={{ width: `${f.payoutShare * 100}%` }} />
              <div className="bar-anim absolute top-[-4px] h-[28px] w-[3px] rounded-full bg-marigold-deep" style={{ left: `${f.memberShare * 100}%` }} title="Share of members" /></div>
            <span className={`num ${f.ok ? '' : 'font-bold text-bad'}`}>{pct(f.payoutShare)} of payout</span>
          </div>
        ))}</div>
        <Note>Amber line = share of members. Each group should get at least {pct(FAIRNESS_MIN)} of its member share (BR-28).</Note>
        {!imp.fairOk && !locked ? <textarea className="input mt-3 h-16" placeholder="Written justification required to submit below the board minimum" value={why} onChange={(e) => setWhy(e.target.value)} /> : null}
      </div>
      <div className="mt-5 flex items-center gap-3">
        {!locked ? (
          <button className="btn-primary" disabled={!imp.capOk || (!imp.fairOk && !why.trim()) || s.plannerUser !== 'planner'}
            onClick={() => { s.setIncentive({ status: 'submitted', submittedBy: USERS.planner, reason: why }); s.log(USERS.planner, `Submitted lean-season premium ₹${inc.rate}/kg fat for ${imp.societies} societies`); go('approvals'); }}>Submit for approval</button>
        ) : <span className="text-sm text-muted">Locked while {inc.status}. {inc.status === 'submitted' ? 'Waiting for the approver.' : ''}</span>}
        {!imp.capOk ? <span className="text-sm font-bold text-bad">Cost is above the cap (BR-16). Lower the amount or the societies.</span> : null}
        {s.plannerUser !== 'planner' && !locked ? <span className="text-sm text-muted">Switch to the planner to submit.</span> : null}
      </div>
    </div>
  );
}

function Approvals() {
  const s = useStore();
  const inc = s.incentive;
  const imp = useMemo(() => incentiveImpact(DEMO_DATES['mar'].date, inc.rate, inc.ids), [inc.rate, inc.ids]);
  const [reason, setReason] = useState('');
  if (inc.status === 'concern') {
    return (<div><PageTitle title="Approvals" />
      <div className="card animate-view-in border-l-4 !border-l-marigold-deep p-5"><div className="font-bold text-warn">Concern raised by Anand Milk Society</div><p className="mt-1">“{inc.concern}”</p>
        <div className="mt-3 flex gap-2"><button className="btn-primary" onClick={() => { s.setIncentive({ status: 'approved', concern: undefined }); s.log(USERS.planner, 'Responded to society concern; target confirmed'); }}>Respond and confirm target</button></div></div></div>);
  }
  if (inc.status !== 'submitted') return <div><PageTitle title="Approvals" /><div className="rounded-sheet border border-dashed border-line p-10 text-center text-muted">Nothing awaiting approval. Current status: <b>{inc.status}</b>.</div></div>;
  const isSubmitter = s.plannerUser === 'planner';
  return (
    <div>
      <PageTitle title="Approvals" sub="One-page summary for the approver. The person who submits cannot approve (maker-checker, BR-17)." />
      <div className="card p-5">
        <div className="flex items-center gap-2"><span className="text-lg font-bold">Lean-season premium on buffalo milk</span><Chip tone="primary">submitted by {inc.submittedBy}</Chip></div>
        <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
          <div><div className="label">What</div>₹{inc.rate} per kg fat, 1 Apr - 30 Jun 2027, {imp.societies} societies</div>
          <div><div className="label">Why</div>Buffalo milk gap of 4-9% for the recommended product mix</div>
          <div><div className="label">Expected milk</div>+{num(imp.extraLitresPerDay)} L/day ({num(imp.extraLo)} - {num(imp.extraHi)})</div>
          <div><div className="label">Cost</div>{inrShort(imp.cost)}</div>
          <div><div className="label">Value gained</div>{inrShort(imp.valueGained)}, {imp.capOk ? 'within cap' : 'above cap'}</div>
          <div><div className="label">Share to farmers</div>{pct(imp.shareToFarmers)}</div>
        </div>
        <div className="mt-4"><div className="label">Fairness</div>
          <div className="text-sm">{imp.fairness.map((f) => `${f.group}: ${pct(f.payoutShare)} of payout vs ${pct(f.memberShare)} of members`).join('; ')} {imp.fairOk ? <Chip tone="good">OK</Chip> : <Chip tone="warn">Below minimum</Chip>}</div>
          {inc.reason ? <div className="mt-1 text-sm">Justification: “{inc.reason}”</div> : null}</div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={isSubmitter} onClick={() => { s.setIncentive({ status: 'approved', approvedBy: USERS.approver }); s.log(USERS.approver, 'Approved lean-season premium; released to societies'); }}>Approve and release to societies</button>
          <input className="input max-w-xs" placeholder="Reason (required to reject)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn-quiet" disabled={isSubmitter || !reason.trim()} onClick={() => { s.setIncentive({ status: 'rejected', reason }); s.log(USERS.approver, `Rejected: ${reason}`); }}>Reject</button>
          {isSubmitter ? <span className="text-sm text-muted">You submitted this. Switch to the approver (top right) to decide.</span> : null}
        </div>
      </div>
    </div>
  );
}

function Monitor() {
  const s = useStore();
  const inc = s.incentive;
  const apr = s.demoDate === 'apr';
  if (inc.status !== 'published') return <div><PageTitle title="Monitor and report" /><div className="rounded-sheet border border-dashed border-line p-10 text-center text-muted">No published signal yet. Approve an incentive and publish it from the society dashboard.</div></div>;
  const imp = incentiveImpact(DEMO_DATES['mar'].date, inc.rate, inc.ids);
  const aprCost = imp.cost / 3;
  const aprValue = imp.valueGained / 3;
  const ctrl = [{ g: 'Pilot societies', v: 865 + 36 + inc.rate }, { g: 'Control societies', v: 865 + 34 }];
  return (
    <div>
      <PageTitle title="Monitor and report" sub={apr ? 'April 2027 results (demo)' : 'Signal published. Results appear after the first month (switch demo date to 30 Apr).'} />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Members reached" value={apr ? '86%' : '68%'} sub="Heard the signal (app + IVR)" />
        <Stat label="Interested" value={apr ? '27%' : '18%'} sub="Asked for follow-up" />
        <Stat label="Buffalo milk vs expected" value={apr ? '+4.1%' : '-'} tone={apr ? 'good' : undefined} sub={apr ? 'Eligible societies, April' : ''} />
        <Stat label="Premium paid (Apr)" value={apr ? inrShort(aprCost) : '-'} />
      </div>
      {apr ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="card p-4"><div className="font-bold">Board report: April 2027</div>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Value realised from better planning: <b>{inrShort(aprValue)}</b></li>
              <li>Paid to farmers as premium: <b>{inrShort(aprCost)}</b> ({pct(aprCost / aprValue)} of value)</li>
              <li>Stockouts of fresh SKUs on quick commerce (Mumbai): <b>-31%</b> vs April 2026</li>
            </ul><Note>Demo figures for the prototype.</Note></div>
          <div className="card p-4"><div className="font-bold">Price per kg fat, April (buffalo)</div>
            <div className="h-48"><ResponsiveContainer><BarChart data={ctrl} layout="vertical" margin={{ left: 40, right: 50 }}>
              <XAxis type="number" domain={[800, 960]} hide /><YAxis type="category" dataKey="g" width={120} {...axis} fontSize={12} />
              <Bar dataKey="v" fill={CHART.indigo} radius={[0, 6, 6, 0]} barSize={26}>{ctrl.map((_, i) => <Cell key={i} fill={i === 0 ? CHART.green : CHART.grey} />)}<LabelList dataKey="v" position="right" formatter={(v: number) => inr(v)} /></Bar>
            </BarChart></ResponsiveContainer></div></div>
        </div>
      ) : null}
      <div className="card mt-4 p-4"><div className="font-bold">Audit log</div>
        <ul className="mt-2 max-h-64 divide-y divide-[#E8EBF1] overflow-auto text-[13px]">{s.audit.map((a, i) => <li key={i} className="grid grid-cols-[150px_1fr] gap-3 py-1.5"><span className="num text-muted">{new Date(a.at).toLocaleString('en-IN')}</span><span><b className="font-semibold">{a.actor}</b>: {a.action}</span></li>)}</ul></div>
    </div>
  );
}

void CHANNEL_LABEL;
