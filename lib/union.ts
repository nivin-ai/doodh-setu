import { CITIES, PRODUCTS, ProductId, forecast } from './demand';
import { mulberry32, gauss } from './util';

// Share of the two city markets supplied by this union (demo assumption)
export const UNION_SHARE = 0.55;

export interface MixProduct {
  id: ProductId | 'sink';
  name: string;
  milkPerUnit: number; // litres of milk per unit of product
  valuePerLitre: number; // net value to the cooperative per litre of milk used (Rs)
  capacity: number; // litres of milk per day the plant can convert
  buffaloShare: number; // share of milk that should be buffalo
}

export const MIX: MixProduct[] = [
  { id: 'milk', name: 'Liquid milk', milkPerUnit: 1, valuePerLitre: 56, capacity: Infinity, buffaloShare: 0.4 },
  { id: 'paneer', name: 'Paneer', milkPerUnit: 4.5, valuePerLitre: 90, capacity: 70000, buffaloShare: 1 },
  { id: 'icecream', name: 'Ice cream', milkPerUnit: 0.9, valuePerLitre: 84, capacity: 30000, buffaloShare: 0.5 },
  { id: 'lassi', name: 'Lassi and buttermilk', milkPerUnit: 0.6, valuePerLitre: 72, capacity: 60000, buffaloShare: 0.3 },
  { id: 'curd', name: 'Curd', milkPerUnit: 1.05, valuePerLitre: 66, capacity: 120000, buffaloShare: 0.5 },
  { id: 'sink', name: 'Milk powder and butter', milkPerUnit: 1, valuePerLitre: 40, capacity: Infinity, buffaloShare: 0 },
];

// Last year's April-June plan (litres of milk per day) used as "current plan"
const CURRENT: Record<string, number> = { paneer: 30000, icecream: 16000, lassi: 22000, curd: 70000 };

export const MONTHS_LEAN = [
  { key: '2027-04', label: 'Apr', from: '2027-04-01', to: '2027-04-30', supply: { buffalo: 282000, cow: 398000 } },
  { key: '2027-05', label: 'May', from: '2027-05-01', to: '2027-05-31', supply: { buffalo: 270000, cow: 382000 } },
  { key: '2027-06', label: 'Jun', from: '2027-06-01', to: '2027-06-30', supply: { buffalo: 278000, cow: 392000 } },
];

export function demandMilkLitres(asOf: string, from: string, to: string) {
  const d: Record<string, number> = {};
  for (const p of PRODUCTS) {
    let units = 0;
    for (const c of CITIES) units += forecast(c, p.id, asOf, 110, 1).avgNext(from, to);
    const m = MIX.find((x) => x.id === p.id)!;
    d[p.id] = units * UNION_SHARE * m.milkPerUnit;
  }
  return d;
}

export interface Allocation { id: string; name: string; litres: number; value: number; buffalo: number; want: number }
export interface MixPlan { rows: Allocation[]; totalValue: number; valuePerLitre: number; buffaloNeeded: number; buffaloUsed: number; supply: number; buffaloSupply: number }

// Allocate milk to products. Recommended plan: buffalo milk is the scarce input, so it goes
// first to the products that earn the most per litre of buffalo milk (value above the
// powder-and-butter fallback, divided by the product's buffalo share). Limited by demand,
// plant capacity and available buffalo milk. Current plan: last year's mix.
const SINK_VALUE = 40;
export const perBuffaloLitre = (m: MixProduct) => (m.valuePerLitre - SINK_VALUE) / m.buffaloShare;
export function plan(asOf: string, month = MONTHS_LEAN[0], recommended = true, extraBuffalo = 0): MixPlan {
  const demand = demandMilkLitres(asOf, month.from, month.to);
  const buf = month.supply.buffalo + extraBuffalo;
  const supply = buf + month.supply.cow;
  let left = supply;
  const rows: Allocation[] = [];
  const liquid = demand.milk;
  rows.push({ id: 'milk', name: 'Liquid milk', litres: liquid, value: liquid * 56, buffalo: liquid * 0.4, want: liquid });
  left -= liquid;
  let bufLeft = buf - liquid * 0.4;
  let need = liquid * 0.4;
  const products = MIX.filter((m) => m.id !== 'milk' && m.id !== 'sink');
  const order = recommended ? [...products].sort((a, b) => perBuffaloLitre(b) - perBuffaloLitre(a)) : products;
  for (const m of order) {
    const want = recommended ? Math.min(demand[m.id] ?? 0, m.capacity) : CURRENT[m.id as string];
    need += Math.min(demand[m.id] ?? 0, m.capacity) * m.buffaloShare;
    const byBuf = recommended && m.buffaloShare > 0 ? Math.max(0, bufLeft) / m.buffaloShare : Infinity;
    const l = Math.max(0, Math.min(want, left, byBuf));
    rows.push({ id: m.id, name: m.name, litres: l, value: l * m.valuePerLitre, buffalo: l * m.buffaloShare, want });
    left -= l;
    bufLeft -= l * m.buffaloShare;
  }
  rows.push({ id: 'sink', name: 'Milk powder and butter', litres: left, value: left * 40, buffalo: 0, want: left });
  const totalValue = rows.reduce((x, r) => x + r.value, 0);
  const buffaloUsed = rows.reduce((x, r) => x + r.buffalo, 0);
  return { rows, totalValue, valuePerLitre: totalValue / supply, buffaloNeeded: need, buffaloUsed, supply, buffaloSupply: buf };
}

// Evaluate a plan the planner has adjusted by hand. Liquid milk stays at its commitment;
// whatever milk is left over goes to milk powder and butter.
export function customPlan(asOf: string, month: (typeof MONTHS_LEAN)[number], litres: Record<string, number>): MixPlan & { buffaloShort: number; milkShort: number } {
  const base = plan(asOf, month, true);
  const rows: Allocation[] = base.rows.filter((r) => r.id === 'milk');
  let used = rows[0].litres;
  for (const m of MIX.filter((x) => x.id !== 'milk' && x.id !== 'sink')) {
    const r = base.rows.find((x) => x.id === m.id)!;
    const l = Math.max(0, litres[m.id] ?? r.litres);
    rows.push({ id: m.id, name: m.name, litres: l, value: l * m.valuePerLitre, buffalo: l * m.buffaloShare, want: r.want });
    used += l;
  }
  const left = Math.max(0, base.supply - used);
  rows.push({ id: 'sink', name: 'Milk powder and butter', litres: left, value: left * SINK_VALUE, buffalo: 0, want: left });
  const totalValue = rows.reduce((x, r) => x + r.value, 0);
  const buffaloUsed = rows.reduce((x, r) => x + r.buffalo, 0);
  return { ...base, rows, totalValue, valuePerLitre: totalValue / base.supply, buffaloUsed,
    buffaloShort: Math.max(0, buffaloUsed - base.buffaloSupply), milkShort: Math.max(0, used - base.supply) };
}

export function milkGap(asOf: string) {
  return MONTHS_LEAN.map((m) => {
    const p = plan(asOf, m, true);
    const required = p.buffaloNeeded;
    const expected = m.supply.buffalo;
    return { month: m.label, required: Math.round(required), expected, gap: Math.max(0, Math.round(required - expected)), gapPct: Math.max(0, required / expected - 1) };
  });
}

// ---------- Societies ----------
export type SizeGroup = 'small' | 'medium' | 'large';
export interface Society { id: number; name: string; members: number; buffaloLitres: number; size: SizeGroup; region: 'North' | 'Central' | 'South' }

const NAMES = ['Anand', 'Bakrol', 'Vallabh Vidyanagar', 'Karamsad', 'Bhalej', 'Ode', 'Umreth', 'Borsad', 'Petlad', 'Sojitra', 'Tarapur', 'Khambhat', 'Nadiad', 'Kapadvanj', 'Mahudha', 'Thasra', 'Matar', 'Kheda', 'Mehmedabad', 'Vaso'];
function societies(): Society[] {
  const r = mulberry32(86);
  const out: Society[] = [];
  for (let i = 0; i < 120; i++) {
    const members = Math.round(Math.max(60, Math.exp(5.6 + gauss(r) * 0.55)));
    const size: SizeGroup = members < 200 ? 'small' : members <= 500 ? 'medium' : 'large';
    const perMember = 6 + r() * 3 + (size === 'large' ? 2 : 0);
    out.push({
      id: i + 1,
      name: i === 0 ? 'Anand Milk Society' : `${NAMES[i % NAMES.length]} Milk Society ${Math.floor(i / NAMES.length) + 1}`,
      members, size, buffaloLitres: Math.round(members * perMember),
      region: (['North', 'Central', 'South'] as const)[i % 3],
    });
  }
  out[0].members = 412; out[0].size = 'medium';
  return out;
}
export const SOCIETIES = societies();
export const SUGGESTED_IDS = [...SOCIETIES].sort((a, b) => b.buffaloLitres - a.buffaloLitres).slice(0, 86).map((s) => s.id).concat(SOCIETIES[0].id).filter((v, i, a) => a.indexOf(v) === i);

// ---------- Incentive model ----------
export const ELASTICITY = 0.0014; // extra buffalo supply share per Rs/kg fat of premium
export const CAP_SHARE = 1; // board cap: break-even, incentive cost <= value gained from the extra milk
export const FAIRNESS_MIN = 0.7; // each size group gets at least 70% of its member share

export function incentiveImpact(asOf: string, rate: number, ids: number[]) {
  const chosen = SOCIETIES.filter((s) => ids.includes(s.id));
  const totalBuf = SOCIETIES.reduce((x, s) => x + s.buffaloLitres, 0);
  const share = chosen.reduce((x, s) => x + s.buffaloLitres, 0) / totalBuf;
  const months = MONTHS_LEAN;
  let cost = 0, extraValue = 0, mixGain = 0, extraL = 0;
  for (const m of months) {
    const days = Number(m.to.slice(8, 10));
    const eligibleBuf = m.supply.buffalo * share;
    const extra = eligibleBuf * ELASTICITY * rate;
    extraL += extra / months.length;
    cost += (eligibleBuf + extra) * 1.03 * 0.07 * rate * days;
    const base = plan(asOf, m, true, 0);
    const withExtra = plan(asOf, m, true, extra);
    const current = plan(asOf, m, false, 0);
    extraValue += (withExtra.totalValue - base.totalValue) * days;
    mixGain += (base.totalValue - current.totalValue) * days;
  }
  // Value gained counts only what the premium causes (the extra buffalo milk).
  // The mix gain happens with or without a premium, so it is reported separately.
  const valueGained = extraValue;
  const groups: SizeGroup[] = ['small', 'medium', 'large'];
  const totalMembers = SOCIETIES.reduce((x, s) => x + s.members, 0);
  const chosenBuf = chosen.reduce((x, s) => x + s.buffaloLitres, 0) || 1;
  const fairness = groups.map((g) => {
    const memberShare = SOCIETIES.filter((s) => s.size === g).reduce((x, s) => x + s.members, 0) / totalMembers;
    const payoutShare = chosen.filter((s) => s.size === g).reduce((x, s) => x + s.buffaloLitres, 0) / chosenBuf;
    return { group: g, memberShare, payoutShare, ok: payoutShare >= FAIRNESS_MIN * memberShare };
  });
  return {
    extraLitresPerDay: Math.round(extraL), extraLo: Math.round(extraL * 0.75), extraHi: Math.round(extraL * 1.2),
    cost, valueGained, mixGain, extraValue,
    capOk: cost <= CAP_SHARE * valueGained,
    shareToFarmers: valueGained ? cost / valueGained : 0,
    fairness, fairOk: fairness.every((f) => f.ok), societies: chosen.length,
  };
}

// ---------- Data sources ----------
export const SOURCES = [
  { id: 'dealer', name: 'Retailers via dealers', kind: 'Demand', lag: '3 days', grain: 'Region x week', quality: 35, prevQuality: 30, note: 'Orders reflect stocking, not consumption. Digitised dealer orders (pilot) raised quality from 30.' },
  { id: 'qcomm', name: 'Quick commerce', kind: 'Demand', lag: '1 day', grain: 'SKU x dark store x day', quality: 62, prevQuality: 55, note: 'Feed covers about 70% of SKUs under the current data-sharing terms.' },
  { id: 'shop', name: 'Amul Shop (D2C)', kind: 'Demand', lag: 'Real time', grain: 'Order level', quality: 95, prevQuality: 95, note: 'Full control, small volume.' },
  { id: 'amcs', name: 'Milk collection (AMCS)', kind: 'Supply', lag: '2 hours', grain: 'Farmer x session', quality: 92, prevQuality: 92, note: 'Litres, fat and SNF for every pour.' },
  { id: 'weather', name: 'Weather and calendar', kind: 'External', lag: 'Daily', grain: 'City x day', quality: 85, prevQuality: 85, note: 'Includes IMD heatwave outlook for 10-24 Apr.' },
];
