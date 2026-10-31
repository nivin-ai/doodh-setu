import { addDays, gauss, interp, iso, mean, mulberry32, sd, toDate, daysBetween } from './util';

export type City = 'Mumbai' | 'Ahmedabad';
export type ProductId = 'milk' | 'curd' | 'paneer' | 'lassi' | 'icecream';
export type Channel = 'dealer' | 'qcomm' | 'shop';

export const CITIES: City[] = ['Mumbai', 'Ahmedabad'];
export const CHANNELS: Channel[] = ['dealer', 'qcomm', 'shop'];
export const CHANNEL_LABEL: Record<Channel, string> = { dealer: 'Retailers via dealers', qcomm: 'Quick commerce', shop: 'Amul Shop (D2C)' };

export const PRODUCTS: { id: ProductId; name: string; unit: string; base: Record<City, number>; beta: number }[] = [
  { id: 'milk', name: 'Liquid milk', unit: 'L', base: { Mumbai: 420000, Ahmedabad: 310000 }, beta: -0.002 },
  { id: 'curd', name: 'Curd', unit: 'kg', base: { Mumbai: 52000, Ahmedabad: 41000 }, beta: 0.014 },
  { id: 'paneer', name: 'Paneer', unit: 'kg', base: { Mumbai: 9500, Ahmedabad: 6500 }, beta: 0.006 },
  { id: 'lassi', name: 'Lassi and buttermilk', unit: 'L', base: { Mumbai: 30000, Ahmedabad: 28000 }, beta: 0.03 },
  { id: 'icecream', name: 'Ice cream', unit: 'L', base: { Mumbai: 14000, Ahmedabad: 9000 }, beta: 0.05 },
];

// Monthly normal daily maximum temperatures (deg C), approximate
const TEMP_NORMALS: Record<City, number[]> = {
  Mumbai: [30, 31, 32, 33, 34, 32, 30, 30, 31, 33, 34, 32],
  Ahmedabad: [28, 31, 36, 40, 42, 38, 33, 32, 34, 36, 33, 29],
};

export const HEATWAVE = { from: '2027-04-10', to: '2027-04-24', plus: 4 };

export const EVENTS: { name: string; from: string; to: string; effects: Partial<Record<ProductId, number>> }[] = [
  { name: 'Holi', from: '2025-03-13', to: '2025-03-15', effects: { lassi: 0.25, icecream: 0.1 } },
  { name: 'Navratri', from: '2025-09-22', to: '2025-10-01', effects: { milk: 0.05, paneer: 0.1 } },
  { name: 'Diwali', from: '2025-10-15', to: '2025-10-23', effects: { milk: 0.08, paneer: 0.3 } },
  { name: 'Holi', from: '2026-03-03', to: '2026-03-05', effects: { lassi: 0.25, icecream: 0.1 } },
  { name: 'Navratri', from: '2026-10-11', to: '2026-10-19', effects: { milk: 0.05, paneer: 0.1 } },
  { name: 'Diwali', from: '2026-11-03', to: '2026-11-10', effects: { milk: 0.08, paneer: 0.3 } },
  { name: 'Holi', from: '2027-03-21', to: '2027-03-23', effects: { lassi: 0.25, icecream: 0.1 } },
  { name: 'Heatwave (IMD outlook)', from: HEATWAVE.from, to: HEATWAVE.to, effects: {} },
];

function eventEffect(s: string, p: ProductId) {
  let f = 1;
  for (const e of EVENTS) if (s >= e.from && s <= e.to && e.effects[p]) f *= 1 + (e.effects[p] as number);
  const m = Number(s.slice(5, 7));
  if (p === 'paneer' && (m === 11 || m === 12 || m === 1 || m === 2)) f *= 1.12; // wedding season
  return f;
}

export const START = '2025-04-01';
export const END = '2027-06-30';

export interface DayPoint { date: string; temp: number; byChannel: Record<Channel, number>; total: number }

function climTemp(city: City, d: Date) {
  return interp(TEMP_NORMALS[city], d);
}

function generate() {
  const r = mulberry32(2027);
  const temps: Record<City, Record<string, number>> = { Mumbai: {}, Ahmedabad: {} };
  const out: Record<string, DayPoint[]> = {};
  const start = toDate(START), end = toDate(END);
  for (const c of CITIES) {
    let d = start;
    while (d <= end) {
      const s = iso(d);
      let t = climTemp(c, d) + gauss(r) * 1.2;
      if (s >= '2026-04-12' && s <= '2026-04-20') t += 2;
      if (s >= HEATWAVE.from && s <= HEATWAVE.to) t += HEATWAVE.plus;
      temps[c][s] = +t.toFixed(1);
      d = addDays(d, 1);
    }
  }
  for (const c of CITIES) for (const p of PRODUCTS) {
    const arr: DayPoint[] = [];
    let d = start;
    while (d <= end) {
      const s = iso(d);
      const years = daysBetween(start, d) / 365;
      const dow = d.getUTCDay();
      const weekend = dow === 0 || dow === 6;
      const wk = weekend && (p.id === 'icecream' || p.id === 'paneer') ? 1.08 : 1;
      const v = p.base[c] * Math.pow(1.09, years) * Math.exp(p.beta * (temps[c][s] - 30)) * eventEffect(s, p.id) * wk * Math.exp(gauss(r) * 0.045);
      const q = 0.08 + 0.05 * Math.min(1, years / 2);
      const sh = 0.02 + 0.015 * Math.min(1, years / 2);
      const byChannel = { dealer: v * (1 - q - sh), qcomm: v * q, shop: v * sh };
      arr.push({ date: s, temp: temps[c][s], byChannel, total: v });
      d = addDays(d, 1);
    }
    out[`${c}|${p.id}`] = arr;
  }
  return { temps, out };
}

const G = generate();
export const TEMPS = G.temps;
export const series = (c: City, p: ProductId) => G.out[`${c}|${p}`];

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

export function forecast(c: City, p: ProductId, asOf: string, horizon = 90, history = 120): Forecast {
  const arr = series(c, p);
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

export function channelTotals(asOf: string, days = 30) {
  const totals: Record<Channel, number> = { dealer: 0, qcomm: 0, shop: 0 };
  for (const c of CITIES) for (const p of PRODUCTS) {
    const arr = series(c, p.id);
    for (const x of arr) if (x.date <= asOf && x.date > iso(addDays(toDate(asOf), -days))) {
      // weight by rough value per unit so products are comparable
      const w = p.id === 'paneer' ? 4.5 : p.id === 'curd' ? 1.1 : 1;
      CHANNELS.forEach((ch) => (totals[ch] += x.byChannel[ch] * w));
    }
  }
  const sum = totals.dealer + totals.qcomm + totals.shop;
  return { dealer: totals.dealer / sum, qcomm: totals.qcomm / sum, shop: totals.shop / sum };
}
