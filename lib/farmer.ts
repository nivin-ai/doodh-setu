import { addDays, gauss, iso, monthKey, mulberry32, toDate } from './util';

export type MilkType = 'buffalo' | 'cow';
export interface Session {
  date: string;
  session: 'AM' | 'PM';
  type: MilkType;
  litres: number;
  fat: number;
  snf: number;
}
export interface Premium {
  rate: number; // Rs per kg fat, buffalo milk
  from: string;
  to: string;
}

export const BASE_RATE = 865; // Rs per kg fat (Amul Dairy, June 2025 public figure)
export const SNF_BONUS_PER_POINT = 6; // Rs per kg fat for every 0.1% SNF above 8.5
const DENSITY = 1.03;

// month index 0-11 -> yield factor (flush in winter, lean in summer)
const SEASON = [1.12, 1.1, 1.0, 0.86, 0.8, 0.84, 0.92, 0.98, 1.0, 1.04, 1.1, 1.13];
// buffalo SNF story: dips in Feb (fodder shortage), recovers in Mar-Apr
const BUF_SNF: Record<string, number> = { '2027-01': 8.95, '2027-02': 8.72, '2027-03': 9.02, '2027-04': 9.1 };

function generate(): Session[] {
  const r = mulberry32(412);
  const out: Session[] = [];
  let d = toDate('2026-01-01');
  const end = toDate('2027-06-30');
  while (d <= end) {
    const s = iso(d);
    const m = d.getUTCMonth();
    const f = SEASON[m];
    const bSnf = BUF_SNF[monthKey(s)] ?? 9.0;
    const lean = m >= 3 && m <= 5;
    for (const session of ['AM', 'PM'] as const) {
      const share = session === 'AM' ? 0.55 : 0.45;
      const bL = 9.2 * f * share * (1 + gauss(r) * 0.05);
      const cL = 6.0 * f * share * (1 + gauss(r) * 0.06);
      out.push({ date: s, session, type: 'buffalo', litres: +bL.toFixed(1), fat: +(6.8 + (lean ? 0.2 : 0) + gauss(r) * 0.12).toFixed(1), snf: +(bSnf + gauss(r) * 0.06).toFixed(1) });
      out.push({ date: s, session, type: 'cow', litres: +cL.toFixed(1), fat: +(4.2 + gauss(r) * 0.1).toFixed(1), snf: +(8.5 + gauss(r) * 0.05).toFixed(1) });
    }
    d = addDays(d, 1);
  }
  return out;
}

export const SESSIONS = generate();

export const kgFat = (s: Session) => (s.litres * DENSITY * s.fat) / 100;
export const snfBonus = (snf: number) => Math.max(0, Math.round((snf - 8.5) * 10)) * SNF_BONUS_PER_POINT;

export function premiumFor(s: Session, p: Premium | null) {
  if (!p || s.type !== 'buffalo' || s.date < p.from || s.date > p.to) return 0;
  return p.rate;
}

export function amount(s: Session, p: Premium | null) {
  return kgFat(s) * (BASE_RATE + snfBonus(s.snf) + premiumFor(s, p));
}

export function sessionsUpTo(today: string) {
  return SESSIONS.filter((s) => s.date <= today);
}

export interface MonthSummary {
  key: string;
  days: number;
  litres: number;
  kgFat: number;
  buffaloKgFat: number;
  avgFat: number;
  avgSnfBuffalo: number;
  base: number;
  snf: number;
  premium: number;
  total: number;
}

export function monthSummary(key: string, p: Premium | null, today: string): MonthSummary {
  const ss = SESSIONS.filter((s) => monthKey(s.date) === key && s.date <= today);
  const days = new Set(ss.map((s) => s.date)).size;
  let litres = 0, kf = 0, bkf = 0, base = 0, snf = 0, prem = 0, fatW = 0, bSnfW = 0, bL = 0;
  for (const s of ss) {
    const k = kgFat(s);
    litres += s.litres; kf += k; fatW += s.fat * s.litres;
    base += k * BASE_RATE; snf += k * snfBonus(s.snf); prem += k * premiumFor(s, p);
    if (s.type === 'buffalo') { bkf += k; bSnfW += s.snf * s.litres; bL += s.litres; }
  }
  return {
    key, days, litres, kgFat: kf, buffaloKgFat: bkf,
    avgFat: litres ? fatW / litres : 0, avgSnfBuffalo: bL ? bSnfW / bL : 0,
    base: Math.round(base), snf: Math.round(snf), premium: Math.round(prem),
    total: Math.round(base) + Math.round(snf) + Math.round(prem),
  };
}

export type ReasonKey = 'premium' | 'snf' | 'volume';
export interface Reason { key: ReasonKey; amount: number }

// Decompose the change in monthly payment into reasons that add up exactly.
export function explainChange(prev: MonthSummary, cur: MonthSummary): Reason[] {
  // Quality effect: change in SNF bonus per kg fat, applied to this month's fat.
  // Volume effect: everything else from base and bonus (more or less milk). Sums exactly.
  const perPrev = prev.kgFat ? prev.snf / prev.kgFat : 0;
  const perCur = cur.kgFat ? cur.snf / cur.kgFat : 0;
  const snfEffect = Math.round((perCur - perPrev) * cur.kgFat);
  const volume = cur.base - prev.base + (cur.snf - prev.snf - snfEffect);
  const reasons: Reason[] = [
    { key: 'premium', amount: cur.premium - prev.premium },
    { key: 'snf', amount: snfEffect },
    { key: 'volume', amount: volume },
  ];
  return reasons.filter((r) => r.amount !== 0);
}

export function dayTotals(date: string, p: Premium | null) {
  const ss = SESSIONS.filter((s) => s.date === date);
  const am = ss.filter((s) => s.session === 'AM');
  const pm = ss.filter((s) => s.session === 'PM');
  const sum = (a: Session[]) => a.reduce((x, s) => x + s.litres, 0);
  const buf = ss.filter((s) => s.type === 'buffalo');
  const avg = (a: Session[], f: (s: Session) => number) => (a.length ? a.reduce((x, s) => x + f(s), 0) / a.length : 0);
  return {
    am: sum(am), pm: sum(pm),
    fat: avg(buf, (s) => s.fat), snf: avg(buf, (s) => s.snf),
    amount: Math.round(ss.reduce((x, s) => x + amount(s, p), 0)),
  };
}

export function monthKeysUpTo(today: string, n: number) {
  const keys: string[] = [];
  const d = toDate(today.slice(0, 7) + '-01');
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    keys.push(iso(x).slice(0, 7));
  }
  return keys;
}

// Estimated monthly value of a buffalo premium for this farmer, from her last 90 days
export function worthToFarmer(today: string, rate: number) {
  const from = iso(addDays(toDate(today), -90));
  const buf = SESSIONS.filter((s) => s.type === 'buffalo' && s.date > from && s.date <= today);
  const perDay = buf.reduce((x, s) => x + kgFat(s), 0) / 90;
  // lean-season yield is lower: apply April-June factor relative to recent months
  const leanAdj = 0.83 / 1.07;
  return Math.round((perDay * leanAdj * rate * 30) / 10) * 10;
}

export function last12MonthsIncome(today: string, p: Premium | null) {
  const keys = monthKeysUpTo(today, 13).slice(0, 12);
  // exclude current incomplete month unless today is month end
  const complete = today.endsWith('-30') || today.endsWith('-31') ? monthKeysUpTo(today, 12) : keys;
  return complete.map((k) => monthSummary(k, p, today));
}
