// Module G: marketing and advertising intelligence (BRD FR-G1 to FR-G10).
// Uses the same forecast and product-mix plan as procurement, so marketing never
// promotes what the cooperative cannot supply (supply check, BR-33).
import { CITIES, PRODUCTS, forecast, series, type City, type ProductId } from './demand';
import { MIX, MONTHS_LEAN, SOCIETIES, SUGGESTED_IDS, UNION_SHARE, demandMilkLitres, plan } from './union';
import { mean } from './util';

export const ASOF = '2027-03-20';
const APRIL = MONTHS_LEAN[0];

// ---------- Supply check ----------
export interface SupplyCheck { ok: boolean; reason: string }

export function supplyCheck(p: ProductId, asOf = ASOF, months = MONTHS_LEAN): SupplyCheck {
  const m = MIX.find((x) => x.id === p);
  if (!m) return { ok: false, reason: 'Not in the product-mix plan' };
  const short: { label: string; ratio: number; buffalo: boolean }[] = [];
  let spare = Infinity;
  const bufTight: string[] = [];
  for (const mo of months) {
    const rec = plan(asOf, mo, true);
    const row = rec.rows.find((r) => r.id === p)!;
    const demand = demandMilkLitres(asOf, mo.from, mo.to)[p] ?? 0;
    const sinkLeft = rec.rows.find((r) => r.id === 'sink')!.litres > 0;
    if (row.litres < row.want - 1) short.push({ label: mo.label, ratio: row.litres / Math.max(1, demand), buffalo: sinkLeft });
    else if (demand >= m.capacity * 0.95) short.push({ label: mo.label, ratio: m.capacity / demand, buffalo: false });
    if (m.buffaloShare > 0.5 && rec.buffaloNeeded > rec.buffaloSupply && !short.some((x) => x.label === mo.label)) bufTight.push(mo.label);
    spare = Math.min(spare, m.capacity - row.litres);
  }
  if (bufTight.length && !short.length) {
    return { ok: false, reason: `Made mostly from buffalo milk, which is short in ${bufTight.join(', ')} (see Milk gap). Extra demand would take buffalo milk from curd, which is already below demand.` };
  }
  if (short.length) {
    const worst = Math.min(...short.map((x) => x.ratio));
    const what = short.some((x) => x.buffalo) ? 'buffalo milk' : 'milk or plant capacity';
    return { ok: false, reason: `Short of ${what} in ${short.map((x) => x.label).join(', ')}: the plan meets as little as ${Math.round(worst * 100)}% of forecast demand. More demand would mean stockouts.` };
  }
  return { ok: true, reason: `Milk and plant capacity cover the expected lift in every month (at least ${Math.round(spare / 1000)}k L/day of capacity spare).` };
}

// ---------- Demand opportunities (P-11) ----------
export interface Opportunity { product: ProductId; name: string; city: City; growth: number; heatLift: number; qcommShare: number; shopShare: number; check: SupplyCheck }

function channelShare(c: City, p: ProductId, asOf: string) {
  const arr = series(c, p).filter((x) => x.date <= asOf).slice(-30);
  const tot = arr.reduce((a, x) => a + x.total, 0);
  return { qcomm: arr.reduce((a, x) => a + x.byChannel.qcomm, 0) / tot, shop: arr.reduce((a, x) => a + x.byChannel.shop, 0) / tot };
}

export function opportunities(asOf = ASOF): Opportunity[] {
  const out: Opportunity[] = [];
  for (const p of PRODUCTS.filter((x) => x.id !== 'milk')) {
    const check = supplyCheck(p.id, asOf);
    for (const c of CITIES) {
      const f = forecast(c, p.id, asOf, 40, 1);
      const sh = channelShare(c, p.id, asOf);
      out.push({ product: p.id, name: p.name, city: c, growth: f.growth, heatLift: f.heatLift, qcommShare: sh.qcomm, shopShare: sh.shop, check });
    }
  }
  return out.sort((a, b) => b.growth + b.heatLift - (a.growth + a.heatLift));
}

// ---------- Campaigns (P-12) ----------
export interface Campaign {
  id: string; product: ProductId; title: string; moment: string; cities: City[]; from: string; to: string;
  channels: string[]; budget: number; lift: number; control: string; alt?: string;
}

export const CAMPAIGNS: Campaign[] = [
  { id: 'lassi-heat', product: 'lassi', title: 'Beat the heat: lassi and buttermilk', moment: 'Heatwave 10-24 Apr (IMD outlook)', cities: ['Mumbai', 'Ahmedabad'], from: '2027-04-08', to: '2027-04-24',
    channels: ['Quick commerce in-app ads', 'Amul Shop push', 'Booth posters'], budget: 600000, lift: 0.08, control: '14 matched dark stores (8 Mumbai, 6 Ahmedabad) with no ads' },
  { id: 'icecream-weekend', product: 'icecream', title: 'Summer weekends: ice cream', moment: 'Weekends, Apr to May', cities: ['Mumbai', 'Ahmedabad'], from: '2027-04-01', to: '2027-05-31',
    channels: ['Quick commerce in-app ads', 'Amul Shop push'], budget: 1200000, lift: 0.06, control: '12 matched dark stores with no ads' },
  { id: 'paneer-summer', product: 'paneer', title: 'Summer meals: paneer', moment: 'April to June', cities: ['Mumbai', 'Ahmedabad'], from: '2027-04-01', to: '2027-06-30',
    channels: ['Quick commerce in-app ads', 'Regional radio'], budget: 6000000, lift: 0.05, control: 'Matched pin codes in both cities',
    alt: 'Hold for the lean season. Run it in the flush season (Oct to Feb), when buffalo milk is plentiful and Diwali and weddings lift demand.' },
  { id: 'curd-mumbai', product: 'curd', title: 'Curd on quick commerce: Mumbai', moment: 'April, fast-growing on quick commerce', cities: ['Mumbai'], from: '2027-04-01', to: '2027-04-30',
    channels: ['Quick commerce sponsored listings', 'Amul Shop subscription offer'], budget: 600000, lift: 0.05, control: '10 matched Mumbai dark stores with no ads',
    alt: 'Hold until the summer buffalo premium raises supply. Move the budget to lassi, which passes the check.' },
];

export function campaignPlan(c: Campaign, asOf = ASOF) {
  const m = MIX.find((x) => x.id === c.product)!;
  let units = 0;
  for (const city of c.cities) {
    const f = forecast(city, c.product, asOf, 110, 1);
    const days = Math.round((Date.parse(c.to) - Date.parse(c.from)) / 864e5) + 1;
    units += f.avgNext(c.from, c.to) * days * UNION_SHARE;
  }
  const extraUnits = units * c.lift;
  // Extra milk sold as this product instead of going to powder and butter (Rs 40 per litre)
  const value = extraUnits * m.milkPerUnit * (m.valuePerLitre - MIX.find((x) => x.id === 'sink')!.valuePerLitre);
  return { baseUnits: units, extraUnits, value, perRupee: value / c.budget, check: supplyCheck(c.product, asOf, MONTHS_LEAN.filter((mo) => mo.to >= c.from && mo.from <= c.to)), unit: PRODUCTS.find((p) => p.id === c.product)!.unit };
}

// Measured results on the April demo date (synthetic, deterministic).
const ACTUAL_FACTOR: Record<string, number> = { 'lassi-heat': 1.18, 'icecream-weekend': 0.85, 'paneer-summer': 1.06, 'curd-mumbai': 1 };
export function campaignResult(c: Campaign) {
  const p = campaignPlan(c);
  const lift = c.lift * ACTUAL_FACTOR[c.id];
  const value = p.value * ACTUAL_FACTOR[c.id];
  const control = 100 + Math.round(p.check.ok ? 3 : 0);
  return { lift, value, perRupee: value / c.budget, campaignIndex: Math.round(control * (1 + lift)), controlIndex: control, stockout: c.id === 'lassi-heat' ? 0.021 : 0.017 };
}

// ---------- Member segments (P-14) ----------
const TOTAL_MEMBERS = SOCIETIES.reduce((a, s) => a + s.members, 0);
const PREMIUM_MEMBERS = SOCIETIES.filter((s) => SUGGESTED_IDS.includes(s.id)).reduce((a, s) => a + s.members, 0);
export const SEGMENTS = [
  { id: 'all', name: 'All members, pilot union', rule: 'Every member of the 120 pilot societies', count: TOTAL_MEMBERS, use: 'Monthly milk story' },
  { id: 'buffalo', name: 'Buffalo owners in premium societies', rule: 'Pours buffalo milk; society eligible for the summer premium', count: Math.round(PREMIUM_MEMBERS * 0.62), use: 'Summer premium signal' },
  { id: 'lowsnf', name: 'Low SNF last month', rule: 'Average SNF below 8.5% in February', count: Math.round(TOTAL_MEMBERS * 0.18), use: 'Feed and mineral mixture advice' },
  { id: 'ivr', name: 'Feature-phone members', rule: 'No smartphone on record; reached by IVR call', count: Math.round(TOTAL_MEMBERS * 0.28), use: 'Same messages by voice call' },
  { id: 'noheard', name: 'Not yet heard the premium signal', rule: 'Signal published; not opened or answered', count: Math.round(PREMIUM_MEMBERS * 0.62 * 0.32), use: 'Reminder through the secretary' },
];
export const WEEKLY_CAP = 2;

// ---------- Milk story (FR-G8) ----------
export interface StoryShare { id: string; share: number }
export function milkStory(asOf = ASOF): StoryShare[] {
  const rec = plan(asOf, APRIL, true);
  const raw = rec.rows.map((r) => ({ id: r.id, v: (r.litres / rec.supply) * 100 }));
  const floor = raw.map((r) => ({ id: r.id, share: Math.floor(r.v), rem: r.v - Math.floor(r.v) }));
  let left = 100 - floor.reduce((a, r) => a + r.share, 0);
  [...floor].sort((a, b) => b.rem - a.rem).forEach((r) => { if (left > 0) { r.share++; left--; } });
  return floor.map(({ id, share }) => ({ id, share }));
}

export const avgOf = mean;
