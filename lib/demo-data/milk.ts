// SYNTHETIC demo data generator: every morning and evening pour by the demo farmer (member 0412).
import { addDays, gauss, iso, monthKey, mulberry32, toDate } from '../util';
import type { Session } from '../farmer';


// month index 0-11 -> yield factor (flush in winter, lean in summer)
const SEASON = [1.12, 1.1, 1.0, 0.86, 0.8, 0.84, 0.92, 0.98, 1.0, 1.04, 1.1, 1.13];
// buffalo SNF story: dips in Feb (fodder shortage), recovers in Mar-Apr
const BUF_SNF: Record<string, number> = { '2027-01': 8.95, '2027-02': 8.72, '2027-03': 9.02, '2027-04': 9.1 };

export function generateSessions(): Session[] {
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

