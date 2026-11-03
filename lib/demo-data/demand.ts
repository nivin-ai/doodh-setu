// SYNTHETIC demo data generator: consumer demand by city, product and channel, plus daily
// temperatures and festival calendar. Used only by the seed script (lib/server/seed.ts).
// The app reads these records from the database; nothing in the UI imports this file.
import { addDays, gauss, interp, iso, mulberry32, toDate, daysBetween } from '../util';
import type { City, ProductId, Channel } from '../demand';

const CITIES: City[] = ['Mumbai', 'Ahmedabad'];
export const GEN_PRODUCTS: { id: ProductId; name: string; unit: string; base: Record<City, number>; beta: number }[] = [
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

interface DayPoint { date: string; temp: number; byChannel: Record<Channel, number>; total: number }

function climTemp(city: City, d: Date) {
  return interp(TEMP_NORMALS[city], d);
}

export function generateDemand() {
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
  for (const c of CITIES) for (const p of GEN_PRODUCTS) {
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

