'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { CITIES, type City, type DemandData, type ProductId } from '@/lib/demand';
import { WEEKS, heatWeek, zoneWeeks, type Zone } from '@/lib/geo';
import { fmtDate, num, pct } from '@/lib/util';
import { CHART, Chip, Count, Note, PageTitle, Segmented } from './ui';
import type { Cell } from './ZoneMap';

const ZoneMap = dynamic(() => import('./ZoneMap'), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading map</div> });

type Metric = 'risk' | 'change' | 'demand';
const METRICS: { id: Metric; label: string }[] = [
  { id: 'risk', label: 'Stockout risk' }, { id: 'change', label: 'Growth vs last year' }, { id: 'demand', label: 'Demand' },
];

function hex(h: string) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function ramp(stops: string[], t: number) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const a = hex(stops[i]), b = hex(stops[i + 1]), k = x - i;
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(',')})`;
}
const RISK = ['#BCD5EE', '#F2BE2C', '#E0662E', '#B23A2E', '#7E1F17'];
const GROWTH = ['#FFF5D6', '#F2BE2C', '#E0662E', '#B23A2E'];
const VOLUME = ['#E6F0FA', '#7FB0E0', '#0B5CAD', '#06315C'];

const riskT = (r: number) => (r - 0.9) / 0.3; // 0.90 -> 0, 1.20 -> 1
const growthT = (g: number) => (g - 0.05) / 0.3;

const pill = (on: boolean) => `rounded-full border px-3 py-1 text-sm transition-colors ${on ? 'border-primary bg-primary font-semibold text-white' : 'border-line bg-white hover:bg-alt'}`;

function riskWord(r: number) { return r > 1.1 ? 'Will run out' : r > 1 ? 'Over capacity' : r > 0.97 ? 'Tight' : 'Comfortable'; }

// Demand and zones come from the planner's database-backed dataset (props)
export default function DemandMap({ D, zones: ZONES }: { D: DemandData; zones: Zone[] }) {
  const PRODUCTS = D.products;
  const [city, setCity] = useState<City>('Ahmedabad');
  const [prod, setProd] = useState<ProductId>('icecream');
  const [metric, setMetric] = useState<Metric>('risk');
  const [w, setW] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setW((x) => { if (x >= WEEKS.length - 1) { setPlaying(false); return x; } return x + 1; }), 850);
    return () => clearInterval(t);
  }, [playing]);
  useEffect(() => { setSel(null); }, [city]);

  const p = PRODUCTS.find((x) => x.id === prod)!;
  const zones = useMemo(() => ZONES.filter((z) => z.city === city), [ZONES, city]);
  const data = useMemo(() => zoneWeeks(D, ZONES, city, prod), [D, ZONES, city, prod]);
  const maxDemand = useMemo(() => Math.max(...data.flat().map((d) => d.demand)), [data]);

  const fmt = (m: Metric, d: (typeof data)[0][0]) => m === 'risk' ? `${riskWord(d.risk)}: quick commerce demand at ${pct(d.risk)} of stock planned`
    : m === 'change' ? `${d.change >= 0 ? '+' : ''}${pct(d.change, 1)} vs same week last year` : `${num(Math.round(d.demand))} ${p.unit} a day`;

  const cells: Cell[] = zones.map((z, i) => {
    const d = data[i][w];
    const color = metric === 'risk' ? ramp(RISK, riskT(d.risk)) : metric === 'change' ? ramp(GROWTH, growthT(d.change)) : ramp(VOLUME, d.demand / maxDemand);
    const base = city === 'Mumbai' ? 720 : 440;
    return { zone: z, color, radius: base * Math.sqrt(z.weight * zones.length) * (metric === 'demand' ? 0.85 + 0.4 * (d.demand / maxDemand) : 1), label: fmt(metric, d) };
  });

  const week = WEEKS[w];
  const hot = heatWeek(D, week);
  const now = zones.map((z, i) => ({ z, d: data[i][w] }));
  const over = now.filter((x) => x.d.risk > 1);
  const shortUnits = over.reduce((a, x) => a + (x.d.qcomm - x.d.capacity), 0);
  const top = [...now].sort((a, b) => b.d.risk - a.d.risk).slice(0, 5);
  const selIdx = sel ? zones.findIndex((z) => z.id === sel) : -1;
  const selZone = selIdx >= 0 ? zones[selIdx] : null;
  const heatFrom = WEEKS.findIndex((w) => heatWeek(D, w)), heatTo = WEEKS.length - 1 - [...WEEKS].reverse().findIndex((w) => heatWeek(D, w));

  return (
    <div>
      <PageTitle title="Demand map" sub={`Where demand will land, neighbourhood by neighbourhood. Forecast made on ${fmtDate('2027-03-20')}; zone detail comes from quick commerce dark-store (pincode) data, which dealer reports cannot give.`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {CITIES.map((c) => <button key={c} onClick={() => setCity(c)} className={pill(city === c)}>{c}</button>)}
        <span className="mx-1 h-6 border-l border-line" />
        {PRODUCTS.map((x) => <button key={x.id} onClick={() => setProd(x.id)} className={pill(prod === x.id)}>{x.name}</button>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <Segmented options={METRICS} value={metric} onChange={(v) => setMetric(v as Metric)} />
            <Legend metric={metric} />
          </div>
          <div className="relative h-[460px]">
            <ZoneMap city={city} cells={cells} selected={sel} onSelect={setSel} />
            <div key={week} className="pointer-events-none absolute right-3 top-3 z-[500] animate-pop rounded-xl bg-white/95 px-3 py-2 shadow-[0_4px_14px_-6px_rgba(18,32,48,.35)]">
              <div className="text-[12px] text-muted">Week of</div>
              <div className="font-bold leading-tight">{fmtDate(week)}</div>
              {hot ? <div className="mt-1"><Chip tone="marigold">Heatwave outlook</Chip></div> : null}
            </div>
          </div>
          <div className="border-t border-line px-4 py-3">
            <div className="flex items-center gap-3">
              <button aria-label={playing ? 'Pause' : 'Play the weeks'} onClick={() => { if (!playing && w >= WEEKS.length - 1) setW(0); setPlaying(!playing); }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-dark active:scale-95">
                {playing ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><rect x="2" y="1.5" width="3.5" height="11" rx="1" fill="currentColor" /><rect x="8.5" y="1.5" width="3.5" height="11" rx="1" fill="currentColor" /></svg>
                  : <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden><path d="M2.5 1.2 11 6l-8.5 4.8Z" fill="currentColor" /></svg>}
              </button>
              <div className="relative flex-1 pt-4">
                <div className="absolute top-0 h-2.5 rounded-full bg-marigold-soft" style={{ left: `calc(${(heatFrom / (WEEKS.length - 1)) * 100}% - 6px)`, width: `calc(${((heatTo - heatFrom) / (WEEKS.length - 1)) * 100}% + 12px)` }} />
                <span className="absolute -top-0.5 text-[11px] font-semibold text-marigold-deep" style={{ left: `${(heatFrom / (WEEKS.length - 1)) * 100}%` }}>Heatwave</span>
                <input type="range" aria-label="Week" min={0} max={WEEKS.length - 1} value={w} onChange={(e) => { setPlaying(false); setW(Number(e.target.value)); }} className="w-full accent-[#0B5CAD]" />
                <div className="flex justify-between text-[11px] text-muted"><span>{fmtDate(WEEKS[0])}</span><span>{fmtDate(WEEKS[WEEKS.length - 1])}</span></div>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="label">Zones over quick commerce capacity</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className={`num font-display text-[34px] font-bold leading-none ${over.length ? 'text-bad' : 'text-ink'}`}><Count value={over.length} format={(n) => String(Math.round(n))} /></span>
              <span className="text-muted">of {zones.length}</span>
            </div>
            <div className="mt-1 text-[13px] text-muted">{over.length ? `Short by about ${num(Math.round(shortUnits))} ${p.unit} a day of ${p.name.toLowerCase()} in dark stores` : `Dark-store stock of ${p.name.toLowerCase()} covers demand this week`}</div>
          </div>

          {selZone ? (
            <div key={selZone.id} className="card animate-view-in p-4">
              <div className="flex items-start justify-between gap-2">
                <div><div className="text-[18px] font-bold">{selZone.name}</div><div className="text-[13px] text-muted">{city}, {pct(selZone.qShare, 0)} of sales through quick commerce</div></div>
                <button className="text-sm font-semibold text-primary hover:underline" onClick={() => setSel(null)}>Close</button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted">Demand</dt><dd className="num text-right font-semibold">{num(Math.round(data[selIdx][w].demand))} {p.unit}/day</dd>
                <dt className="text-muted">Vs last year</dt><dd className="num text-right font-semibold">{data[selIdx][w].change >= 0 ? '+' : ''}{pct(data[selIdx][w].change, 1)}</dd>
                <dt className="text-muted">Heat effect</dt><dd className="num text-right font-semibold">{data[selIdx][w].heat > 0.001 ? `+${pct(data[selIdx][w].heat, 1)}` : 'None'}</dd>
                <dt className="text-muted">Stock planned</dt><dd className="text-right"><Chip tone={data[selIdx][w].risk > 1 ? 'bad' : data[selIdx][w].risk > 0.97 ? 'warn' : 'good'}>{riskWord(data[selIdx][w].risk)}</Chip></dd>
              </dl>
              <div className="mt-3 h-24">
                <ResponsiveContainer>
                  <AreaChart data={data[selIdx].map((d, i) => ({ i, v: +(d.risk * 100).toFixed(1) }))} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis dataKey="i" hide /><YAxis hide domain={[85, 'dataMax + 4']} />
                    <ReferenceLine y={100} stroke={CHART.red} strokeDasharray="3 3" />
                    <ReferenceLine x={w} stroke={CHART.indigo} />
                    <Area dataKey="v" stroke={CHART.indigo} fill={CHART.indigoSoft} fillOpacity={0.5} strokeWidth={2} animationDuration={500} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <Note>Demand as a share of stock planned, by week. Above the red line, the dark stores run out.</Note>
            </div>
          ) : (
            <div className="card p-4">
              <div className="font-bold">Act first</div>
              <p className="text-[13px] text-muted">Highest stockout risk this week. Click a zone on the map for its detail.</p>
              <ol className="mt-2 divide-y divide-[#E6EDF5]">
                {top.map(({ z, d }) => (
                  <li key={z.id}>
                    <button onClick={() => setSel(z.id)} className="flex w-full items-center gap-3 py-2 text-left transition-colors hover:text-primary">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: ramp(RISK, riskT(d.risk)) }} />
                      <span className="flex-1">{z.name}</span>
                      <span className="num text-sm text-muted">{pct(d.risk)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="rounded-sheet bg-primary-light p-4 text-[14px] leading-relaxed text-primary">
            <b>What to do with this:</b> move {p.name.toLowerCase()} stock to the dark stores in red before the heatwave, ask quick commerce partners to share pincode-level sell-through, and plan cold-chain runs for inland zones first.
          </div>
        </aside>
      </div>
      <Note>Synthetic data. City forecasts come from the Demand and forecast page; each zone&apos;s share, quick commerce share and heat sensitivity are assumptions for the prototype. Map tiles by CARTO from OpenStreetMap data.</Note>
    </div>
  );
}

function Legend({ metric }: { metric: Metric }) {
  if (metric === 'risk') {
    return (
      <div className="flex items-center gap-3 text-[12px] text-muted">
        {[['Comfortable', 0.9], ['Tight', 0.99], ['Over capacity', 1.05], ['Will run out', 1.18]].map(([l, v]) => (
          <span key={l as string} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ramp(RISK, riskT(v as number)) }} />{l}</span>
        ))}
      </div>
    );
  }
  const stops = metric === 'change' ? GROWTH : VOLUME;
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted">
      <span>{metric === 'change' ? '+5%' : 'Low'}</span>
      <span className="h-2.5 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }} />
      <span>{metric === 'change' ? '+35%' : 'High'}</span>
    </div>
  );
}
