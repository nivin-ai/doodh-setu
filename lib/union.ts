// Union planning: product mix, buffalo milk gap and the lean-season incentive model.
// Pure functions over the planning data loaded from the database (PlannerDataset). Only model
// parameters and policy limits are constants here.
import { CITIES, demandFromDataset, forecast, type DemandData, type ProductId } from './demand';
import type { PlannerDataset, ProductRow, SocietyLite } from './types/api';
import { MONTHS } from './util';

export interface MixProduct { id: ProductId | 'sink'; name: string; milkPerUnit: number; valuePerLitre: number; capacity: number; buffaloShare: number }
export interface LeanMonth { key: string; label: string; from: string; to: string; supply: { buffalo: number; cow: number } }
export type SizeGroup = 'small' | 'medium' | 'large';
export interface Society extends SocietyLite { size: SizeGroup }

export interface PlanModel {
  asOf: string;
  D: DemandData;
  mix: MixProduct[];
  months: LeanMonth[];
  unionShare: number;
  baseline: Record<string, number>;
  societies: Society[];
  cache: Map<string, unknown>;
}

// Policy and model parameters
export const ELASTICITY = 0.0014; // extra buffalo supply share per Rs/kg fat of premium (assumption, to be calibrated from AMCS history)
export const CAP_SHARE = 1;       // board cap: break-even, incentive cost <= value gained from the extra milk
export const FAIRNESS_MIN = 0.7;  // each size group gets at least 70% of its member share
const KG_PER_LITRE = 1.03, BUFFALO_FAT = 0.07;

export const sizeGroup = (members: number): SizeGroup => (members < 200 ? 'small' : members <= 500 ? 'medium' : 'large');
const lastDay = (month: string) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

export function planModel(ds: PlannerDataset): PlanModel {
  const toMix = (p: ProductRow): MixProduct => ({ id: p.id, name: p.name, milkPerUnit: p.milkPerUnit, valuePerLitre: p.valuePerLitre, capacity: p.capacity ?? Infinity, buffaloShare: p.buffaloShare });
  const ordered = [...ds.products.filter((p) => p.isLiquidMilk), ...ds.products.filter((p) => !p.isLiquidMilk && !p.isFallback), ...ds.products.filter((p) => p.isFallback)];
  return {
    asOf: ds.asOf,
    D: demandFromDataset(ds),
    mix: ordered.map(toMix),
    months: ds.supply.map((s) => {
      const key = s.month.slice(0, 7);
      return { key, label: MONTHS[Number(key.slice(5, 7)) - 1], from: `${key}-01`, to: `${key}-${String(lastDay(key)).padStart(2, '0')}`, supply: { buffalo: s.buffalo, cow: s.cow } };
    }),
    unionShare: ds.supply[0]?.marketShare ?? 0.55,
    baseline: ds.baseline,
    societies: ds.societies.map((s) => ({ ...s, size: sizeGroup(s.members) })),
    cache: new Map(),
  };
}

function memo<T>(P: PlanModel, key: string, f: () => T): T {
  if (!P.cache.has(key)) P.cache.set(key, f());
  return P.cache.get(key) as T;
}

export const liquid = (P: PlanModel) => P.mix[0];
export const fallback = (P: PlanModel) => P.mix[P.mix.length - 1];
export const flexible = (P: PlanModel) => P.mix.slice(1, -1);

// Litres of milk per day needed to meet forecast demand, by product
export function demandMilkLitres(P: PlanModel, asOf: string, from: string, to: string) {
  return memo(P, `dm|${asOf}|${from}|${to}`, () => {
    const d: Record<string, number> = {};
    for (const p of P.D.products) {
      let units = 0;
      for (const c of CITIES) units += forecast(P.D, c, p.id, asOf, 110, 1).avgNext(from, to);
      const m = P.mix.find((x) => x.id === p.id)!;
      d[p.id] = units * P.unionShare * m.milkPerUnit;
    }
    return d;
  });
}

export interface Allocation { id: string; name: string; litres: number; value: number; buffalo: number; want: number }
export interface MixPlan { rows: Allocation[]; totalValue: number; valuePerLitre: number; buffaloNeeded: number; buffaloUsed: number; supply: number; buffaloSupply: number }

// Allocate milk to products. Recommended plan: buffalo milk is the scarce input, so it goes
// first to the products that earn the most per litre of buffalo milk (value above the
// powder-and-butter fallback, divided by the product's buffalo share). Limited by demand,
// plant capacity and available buffalo milk. Current plan: last season's accepted plan.
export const perBuffaloLitre = (P: PlanModel, m: MixProduct) => (m.valuePerLitre - fallback(P).valuePerLitre) / m.buffaloShare;
export function plan(P: PlanModel, asOf: string, month: LeanMonth = P.months[0], recommended = true, extraBuffalo = 0): MixPlan {
  return memo(P, `plan|${asOf}|${month.key}|${recommended}|${extraBuffalo}`, () => {
    const demand = demandMilkLitres(P, asOf, month.from, month.to);
    const L = liquid(P), F = fallback(P);
    const buf = month.supply.buffalo + extraBuffalo;
    const supply = buf + month.supply.cow;
    let left = supply;
    const rows: Allocation[] = [];
    const lq = demand[L.id];
    rows.push({ id: L.id, name: L.name, litres: lq, value: lq * L.valuePerLitre, buffalo: lq * L.buffaloShare, want: lq });
    left -= lq;
    let bufLeft = buf - lq * L.buffaloShare;
    let need = lq * L.buffaloShare;
    const products = flexible(P);
    const order = recommended ? [...products].sort((a, b) => perBuffaloLitre(P, b) - perBuffaloLitre(P, a)) : products;
    for (const m of order) {
      const want = recommended ? Math.min(demand[m.id] ?? 0, m.capacity) : P.baseline[m.id as string] ?? 0;
      need += Math.min(demand[m.id] ?? 0, m.capacity) * m.buffaloShare;
      const byBuf = recommended && m.buffaloShare > 0 ? Math.max(0, bufLeft) / m.buffaloShare : Infinity;
      const l = Math.max(0, Math.min(want, left, byBuf));
      rows.push({ id: m.id, name: m.name, litres: l, value: l * m.valuePerLitre, buffalo: l * m.buffaloShare, want });
      left -= l;
      bufLeft -= l * m.buffaloShare;
    }
    rows.push({ id: F.id, name: F.name, litres: left, value: left * F.valuePerLitre, buffalo: 0, want: left });
    const totalValue = rows.reduce((x, r) => x + r.value, 0);
    const buffaloUsed = rows.reduce((x, r) => x + r.buffalo, 0);
    return { rows, totalValue, valuePerLitre: totalValue / supply, buffaloNeeded: need, buffaloUsed, supply, buffaloSupply: buf };
  });
}

// Evaluate a plan the planner has adjusted by hand. Liquid milk stays at its commitment;
// whatever milk is left over goes to milk powder and butter.
export function customPlan(P: PlanModel, asOf: string, month: LeanMonth, litres: Record<string, number>): MixPlan & { buffaloShort: number; milkShort: number } {
  const base = plan(P, asOf, month, true);
  const F = fallback(P);
  const rows: Allocation[] = base.rows.filter((r) => r.id === liquid(P).id);
  let used = rows[0].litres;
  for (const m of flexible(P)) {
    const r = base.rows.find((x) => x.id === m.id)!;
    const l = Math.max(0, litres[m.id] ?? r.litres);
    rows.push({ id: m.id, name: m.name, litres: l, value: l * m.valuePerLitre, buffalo: l * m.buffaloShare, want: r.want });
    used += l;
  }
  const left = Math.max(0, base.supply - used);
  rows.push({ id: F.id, name: F.name, litres: left, value: left * F.valuePerLitre, buffalo: 0, want: left });
  const totalValue = rows.reduce((x, r) => x + r.value, 0);
  const buffaloUsed = rows.reduce((x, r) => x + r.buffalo, 0);
  return { ...base, rows, totalValue, valuePerLitre: totalValue / base.supply, buffaloUsed,
    buffaloShort: Math.max(0, buffaloUsed - base.buffaloSupply), milkShort: Math.max(0, used - base.supply) };
}

export function milkGap(P: PlanModel, asOf: string) {
  return P.months.map((m) => {
    const p = plan(P, asOf, m, true);
    const required = p.buffaloNeeded;
    const expected = m.supply.buffalo;
    return { month: m.label, required: Math.round(required), expected, gap: Math.max(0, Math.round(required - expected)), gapPct: Math.max(0, required / expected - 1) };
  });
}

// Societies suggested for the premium: the 86 largest buffalo suppliers, plus the demo society
export function suggestedSocietyIds(P: PlanModel) {
  return [...P.societies].sort((a, b) => b.buffaloLitres - a.buffaloLitres).slice(0, 86).map((s) => s.id)
    .concat(P.societies[0]?.id ?? []).filter((v, i, a) => a.indexOf(v) === i);
}

export function incentiveImpact(P: PlanModel, asOf: string, rate: number, ids: string[]) {
  const chosen = P.societies.filter((s) => ids.includes(s.id));
  const totalBuf = P.societies.reduce((x, s) => x + s.buffaloLitres, 0) || 1;
  const share = chosen.reduce((x, s) => x + s.buffaloLitres, 0) / totalBuf;
  const months = P.months;
  let cost = 0, extraValue = 0, mixGain = 0, extraL = 0;
  for (const m of months) {
    const days = Number(m.to.slice(8, 10));
    const eligibleBuf = m.supply.buffalo * share;
    const extra = eligibleBuf * ELASTICITY * rate;
    extraL += extra / months.length;
    cost += (eligibleBuf + extra) * KG_PER_LITRE * BUFFALO_FAT * rate * days;
    const base = plan(P, asOf, m, true, 0);
    const withExtra = plan(P, asOf, m, true, extra);
    const current = plan(P, asOf, m, false, 0);
    extraValue += (withExtra.totalValue - base.totalValue) * days;
    mixGain += (base.totalValue - current.totalValue) * days;
  }
  // Value gained counts only what the premium causes (the extra buffalo milk).
  // The mix gain happens with or without a premium, so it is reported separately.
  const valueGained = extraValue;
  const groups: SizeGroup[] = ['small', 'medium', 'large'];
  const totalMembers = P.societies.reduce((x, s) => x + s.members, 0) || 1;
  const chosenBuf = chosen.reduce((x, s) => x + s.buffaloLitres, 0) || 1;
  const fairness = groups.map((g) => {
    const memberShare = P.societies.filter((s) => s.size === g).reduce((x, s) => x + s.members, 0) / totalMembers;
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
