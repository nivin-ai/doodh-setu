// Zone-level (neighbourhood) demand for the demand map. Synthetic.
// The city forecast from demand.ts is split across zones using quick-commerce dark-store (pincode) data,
// which is the only channel granular enough to see demand below city level.
import { forecast, series, type City, type DemandData, type ProductId } from './demand';
import { addDays, iso, mean, mulberry32, toDate } from './util';
// Zones (demand_zones) and demand come from the database; this file only holds the calculations.

export interface Zone { id: string; name: string; city: City; lat: number; lng: number; aff: number; inland: number; weight: number; qShare: number }

export const CITY_VIEW: Record<City, { center: [number, number]; zoom: number }> = {
  Mumbai: { center: [19.07, 72.875], zoom: 11 },
  Ahmedabad: { center: [23.04, 72.575], zoom: 12 },
};

export const AS_OF = '2027-03-20';
// Weeks starting Monday 22 Mar to Monday 21 Jun 2027 (14 weeks), forecast horizon of the planner
export const WEEKS = Array.from({ length: 14 }, (_, i) => iso(addDays(toDate('2027-03-22'), i * 7)));

export interface ZoneWeek { demand: number; change: number; qcomm: number; capacity: number; risk: number; heat: number }

function weekAvg(get: (d: string) => number | undefined, start: string) {
  const v: number[] = [];
  for (let k = 0; k < 7; k++) { const x = get(iso(addDays(toDate(start), k))); if (x !== undefined) v.push(x); }
  return mean(v);
}

const caches = new WeakMap<DemandData, Map<string, ZoneWeek[][]>>();

// [zone index within city][week] for one city and product
export function zoneWeeks(D: DemandData, zones: Zone[], city: City, prod: ProductId) {
  const key = `${city}|${prod}`;
  if (!caches.has(D)) caches.set(D, new Map());
  const cache = caches.get(D)!;
  if (cache.has(key)) return cache.get(key)!;
  const HEATWAVE = D.heatwave;
  const f = forecast(D, city, prod, AS_OF, 104, 0);
  const fcByDate = new Map(f.points.map((p) => [p.date, p.forecast ?? p.actual]));
  const arr = series(D, city, prod);
  const byDate = new Map(arr.map((x) => [x.date, x.total]));
  const ly = (d: string) => byDate.get(iso(addDays(toDate(d), -364)));
  const own = zones.filter((z) => z.city === city);
  const r = mulberry32(city.length * 31 + prod.length);
  // Planned dark-store stock headroom (model assumption, deterministic per city and product)
  const headroom = own.map((z) => 1.05 + 0.13 * (1 - z.inland) + r() * 0.04); // coastal dark stores are bigger and carry more buffer
  // Days inside the IMD heatwave outlook run about HEATWAVE.plus degrees above normal
  const excess = (d: string) => (d >= HEATWAVE.from && d <= HEATWAVE.to ? HEATWAVE.plus : 0);
  const out = own.map((z, zi) => WEEKS.map((w) => {
    const cityNow = weekAvg((d) => fcByDate.get(d), w);
    const cityNormal = weekAvg((d) => { const v = fcByDate.get(d); return v === undefined ? undefined : v * Math.exp(-f.beta * excess(d)); }, w);
    const cityLy = weekAvg(ly, w);
    const ex = weekAvg(excess, w);
    const growth = 1 + (z.aff - 0.55) * 0.08; // premium neighbourhoods growing faster
    const heat = Math.exp(f.beta * ex * 0.9 * z.inland); // inland zones get hotter than the city reading
    const demand = cityNow * z.weight * growth * heat;
    const normal = cityNormal * z.weight * growth;
    const qcomm = demand * z.qShare;
    const capacity = normal * z.qShare * headroom[zi]; // dark-store stock planned for normal weather plus headroom
    return { demand, change: demand / (cityLy * z.weight) - 1, qcomm, capacity, risk: qcomm / capacity, heat: demand / normal - 1 };
  }));
  cache.set(key, out);
  return out;
}

export function heatWeek(D: DemandData, w: string) {
  const end = iso(addDays(toDate(w), 6));
  return end >= D.heatwave.from && w <= D.heatwave.to;
}
