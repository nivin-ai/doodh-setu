// Demand forecasting. Pure functions over demand and weather records loaded from the database
// (demand_daily, weather_daily, calendar_events). No data is stored here.
import { addDays, iso, mean, sd, toDate } from './util';
import type { PlannerDataset } from './types/api';

export type City = 'Mumbai' | 'Ahmedabad';
export type ProductId = 'milk' | 'curd' | 'paneer' | 'lassi' | 'icecream';
export type Channel = 'dealer' | 'qcomm' | 'shop';

export const CITIES: City[] = ['Mumbai', 'Ahmedabad'];
export const CHANNELS: Channel[] = ['dealer', 'qcomm', 'shop'];
export const CHANNEL_LABEL: Record<Channel, string> = { dealer: 'Retailers via dealers', qcomm: 'Quick commerce', shop: 'Amul Shop (D2C)' };

export interface DayPoint { date: string; temp: number; byChannel: Record<Channel, number>; total: number }
export interface DemandEvent { name: string; from: string; to: string }
export interface Heatwave { from: string; to: string; plus: number }
export interface DemandData { series: Record<string, DayPoint[]>; events: DemandEvent[]; heatwave: Heatwave; products: { id: ProductId; name: string; unit: string }[] }

// Rebuilds daily series (city x product) from the columnar planner dataset
export function demandFromDataset(ds: PlannerDataset): DemandData {
  const series: Record<string, DayPoint[]> = {};
  for (const [key, u] of Object.entries(ds.units)) {
    const city = key.split('|')[0] as City;
    series[key] = ds.dates.map((date, i) => {
      const byChannel = { dealer: u.dealer[i], qcomm: u.qcomm[i], shop: u.shop[i] };
      return { date, temp: ds.temps[city][i], byChannel, total: byChannel.dealer + byChannel.qcomm + byChannel.shop };
    });
  }
  const hw = ds.events.find((e) => e.kind === 'heatwave');
  return {
    series,
    events: ds.events.map((e) => ({ name: e.name, from: e.from, to: e.to })),
    heatwave: hw ? { from: hw.from, to: hw.to, plus: Number(hw.effects.temp_plus ?? 0) } : { from: '9999-01-01', to: '9999-01-01', plus: 0 },
    products: ds.products.filter((p) => !p.isFallback).map((p) => ({ id: p.id as ProductId, name: p.name, unit: p.unit })),
  };
}

export const series = (D: DemandData, c: City, p: ProductId) => D.series[`${c}|${p}`] ?? [];

export interface ForecastPoint { date: string; actual?: number; forecast?: number; lo?: number; hi?: number; temp: number; event?: string }
export interface Forecast {
  points: ForecastPoint[];
  growth: number;
  beta: number;
  heatLift: number;
  mape: number;
  band: number;
  avgNext: (from: string, to: string) => number;
}

function smooth(arr: DayPoint[], i: number) {
  const a = arr.slice(Math.max(0, i - 3), i + 4).map((x) => x.total);
  return mean(a);
}

function fit(arr: DayPoint[], idx: Map<string, number>, asOfIdx: number) {
  const xs: number[] = [], ys: number[] = [];
  for (let i = Math.max(364, asOfIdx - 300); i <= asOfIdx; i++) {
    const ly = smooth(arr, i - 364);
    xs.push(arr[i].temp - arr[i - 364].temp);
    ys.push(Math.log(arr[i].total / ly));
  }
  const mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  xs.forEach((x, k) => { num += (x - mx) * (ys[k] - my); den += (x - mx) ** 2; });
  const beta = den ? num / den : 0;
  const a = my - beta * mx;
  const resid = ys.map((y, k) => y - a - beta * xs[k]);
  return { a, beta, s: sd(resid) };
}

export function forecast(D: DemandData, c: City, p: ProductId, asOf: string, horizon = 90, history = 120): Forecast {
  const arr = series(D, c, p);
  const HEATWAVE = D.heatwave, EVENTS = D.events;
  if (!arr.length || !arr.some((x) => x.date === asOf)) return { points: [], growth: 0, beta: 0, heatLift: 0, mape: 0, band: 0, avgNext: () => 0 };
  const idx = new Map(arr.map((x, i) => [x.date, i]));
  const ai = idx.get(asOf)!;
  const { a, beta, s } = fit(arr, idx, ai);
  const band = 1.2816 * s;
  const fc = (i: number) => {
    const ly = smooth(arr, i - 364);
    const tfc = arr[i].temp; // outlook temperature (includes IMD heatwave outlook)
    return ly * Math.exp(a + beta * (tfc - arr[i - 364].temp));
  };
  // backtest: forecast made 28 days ago with parameters fitted then
  const b = fit(arr, idx, ai - 28);
  const errs: number[] = [];
  for (let i = ai - 27; i <= ai; i++) {
    const ly = smooth(arr, i - 364);
    const f = ly * Math.exp(b.a + b.beta * (arr[i].temp - arr[i - 364].temp));
    errs.push(Math.abs(f - arr[i].total) / arr[i].total);
  }
  const points: ForecastPoint[] = [];
  for (let i = ai - history; i <= Math.min(arr.length - 1, ai + horizon); i++) {
    const x = arr[i];
    const ev = EVENTS.find((e) => x.date >= e.from && x.date <= e.to);
    if (i <= ai) points.push({ date: x.date, actual: Math.round(x.total), temp: x.temp, event: ev?.name });
    else {
      const f = fc(i);
      points.push({ date: x.date, forecast: Math.round(f), lo: Math.round(f * Math.exp(-band)), hi: Math.round(f * Math.exp(band)), temp: x.temp, event: ev?.name });
    }
  }
  // heatwave lift: forecast with outlook temps vs with normal temps, over heatwave days
  let lift = 0, n = 0;
  for (let i = ai + 1; i <= Math.min(arr.length - 1, ai + horizon); i++) {
    const s0 = arr[i].date;
    if (s0 >= HEATWAVE.from && s0 <= HEATWAVE.to) { lift += Math.exp(beta * HEATWAVE.plus) - 1; n++; }
  }
  return {
    points, growth: Math.exp(a) - 1, beta, heatLift: n ? lift / n : 0, mape: mean(errs), band,
    avgNext: (from, to) => {
      const v: number[] = [];
      for (let i = ai + 1; i < arr.length; i++) if (arr[i].date >= from && arr[i].date <= to) v.push(fc(i));
      return mean(v);
    },
  };
}

export function channelTotals(D: DemandData, asOf: string, days = 30) {
  const totals: Record<Channel, number> = { dealer: 0, qcomm: 0, shop: 0 };
  for (const c of CITIES) for (const p of D.products) {
    const arr = series(D, c, p.id);
    for (const x of arr) if (x.date <= asOf && x.date > iso(addDays(toDate(asOf), -days))) {
      // weight by rough value per unit so products are comparable
      const w = p.id === 'paneer' ? 4.5 : p.id === 'curd' ? 1.1 : 1;
      CHANNELS.forEach((ch) => (totals[ch] += x.byChannel[ch] * w));
    }
  }
  const sum = totals.dealer + totals.qcomm + totals.shop;
  return { dealer: totals.dealer / sum, qcomm: totals.qcomm / sum, shop: totals.shop / sum };
}
